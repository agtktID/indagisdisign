import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import { callAction } from "@agent-native/core/client/use-action";
import {
  IconArrowDown,
  IconArrowUp,
  IconDownload,
  IconFileImport,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { confirmDelete } from "@/lib/confirm-delete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { MarkerImport } from "./MarkerImport";
import { Badge, EmptyState, Textarea } from "./primitives";

/**
 * Les trois formats que `export-markers` sait produire.
 *
 * Seul le CSV était atteignable depuis l'écran. L'EDL est pourtant celui qui compte
 * pour un monteur : c'est lui qui s'importe dans Resolve ou Premiere. Les chapitres
 * YouTube se collent directement sous une vidéo publiée.
 *
 * Le contenu arrive dans la réponse, jamais par un fichier stocké quelque part : aucun
 * compte à connecter, rien qui sorte de la machine.
 */
type ExportFormat = "csv" | "edl" | "youtube-chapters";

const EXPORT_FORMATS: {
  format: ExportFormat;
  labelKey: string;
  titleKey: string;
}[] = [
  { format: "csv", labelKey: "markers.exportCsv", titleKey: "markers.exportCsvTitle" },
  { format: "edl", labelKey: "markers.exportEdl", titleKey: "markers.exportEdlTitle" },
  {
    format: "youtube-chapters",
    labelKey: "markers.exportChapters",
    titleKey: "markers.exportChaptersTitle",
  },
];

const EXPORT_MIME: Record<ExportFormat, string> = {
  csv: "text/csv",
  // Resolve et Premiere acceptent un .edl servi en texte brut ; leur donner un type
  // inventé comme `application/edl` fait seulement refuser le fichier à certains
  // navigateurs au téléchargement.
  edl: "text/plain",
  "youtube-chapters": "text/plain",
};

interface Marker {
  id: string;
  label: string;
  rushName: string | null;
  startMs: number;
  endMs: number | null;
  step: number | null;
  stepTitle: string | null;
  intendedFeeling: string | null;
  editAttempt: string | null;
  sortOrder: number;
  startTimecode: string;
  endTimecode: string;
}

const STEP_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);

function parseTimecode(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const parts = trimmed.split(":").map((part) => part.trim());
  if (parts.some((part) => part === "" || Number.isNaN(Number(part.replace(",", "."))))) {
    return null;
  }
  const seconds = Number(parts.pop()!.replace(",", "."));
  const minutes = parts.length ? Number(parts.pop()) : 0;
  const hours = parts.length ? Number(parts.pop()) : 0;
  return Math.round(((hours * 60 + minutes) * 60 + seconds) * 1000);
}

/**
 * Une cellule du carnet, modifiable sur place.
 *
 * `upsert-marker` acceptait déjà un `markerId` ; aucune surface ne l'utilisait, donc
 * corriger une faute de frappe ou un timecode imposait de supprimer la ligne et de
 * tout resaisir. Sur un carnet de cinquante marqueurs, c'est rédhibitoire.
 *
 * On n'enregistre qu'au changement réel : revenir sur une cellule sans rien modifier
 * ne doit pas écrire en base.
 */
function EditableCell({
  value,
  placeholder,
  align,
  onCommit,
}: {
  value: string;
  placeholder: string;
  align?: "tabular";
  onCommit: (next: string) => void;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() === value.trim()) return;
    onCommit(draft.trim());
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        title={t("markers.editCell")}
        className={cn(
          "hover:bg-muted/60 -mx-1 w-full rounded px-1 py-0.5 text-left transition",
          align === "tabular" && "tabular-nums",
          !value && "text-muted-foreground",
        )}
      >
        {value || placeholder}
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
        if (event.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
      className={cn(
        "border-input bg-background -mx-1 w-full rounded border px-1 py-0.5 text-xs",
        align === "tabular" && "tabular-nums",
      )}
    />
  );
}

export function MarkersTab({ videoId }: { videoId: string }) {
  const t = useT();
  const [order, setOrder] = useState<"narrative" | "timecode">("narrative");
  const { data, refetch } = useActionQuery("list-markers", { videoId, order });
  const result = data as { markers: Marker[]; unassignedCount: number } | undefined;
  const markers = result?.markers ?? [];

  const upsert = useActionMutation("upsert-marker");
  const remove = useActionMutation("delete-marker");
  const assign = useActionMutation("assign-marker-step");

  /**
   * Modifie un champ d'un marqueur existant.
   *
   * `upsert-marker` exige `label` et `startMs` à chaque appel : on les renvoie depuis
   * le marqueur courant, pour qu'une modification d'une seule colonne n'efface pas
   * les autres.
   */
  const edit = (
    marker: Marker,
    patch: Partial<{
      label: string;
      rushName: string;
      startMs: number;
      endMs: number | null;
      intendedFeeling: string;
      editAttempt: string;
    }>,
  ) =>
    upsert.mutate({
      videoId,
      markerId: marker.id,
      label: marker.label,
      startMs: marker.startMs,
      ...patch,
    });
  const reorder = useActionMutation("reorder-markers");
  // `export-markers` est une lecture (`http: { method: "GET" }`). On l'appelle
  // impérativement plutôt qu'avec useActionQuery : le format est choisi au clic, et
  // monter une requête par format n'aurait servi qu'à les garder en cache pour rien.
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const [draft, setDraft] = useState({ label: "", rush: "", start: "", end: "", feeling: "", attempt: "" });
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  function move(index: number, delta: number) {
    const next = [...markers];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    reorder.mutate({ videoId, orderedMarkerIds: next.map((marker) => marker.id) });
  }

  async function download(format: ExportFormat) {
    setError(null);
    setExporting(format);
    try {
      const payload = await callAction<{ content: string; filename: string }>(
        "export-markers",
        { videoId, order, format },
        { method: "GET" },
      );
      if (!payload?.content) {
        setError(t("markers.exportEmpty"));
        return;
      }
      // Le BOM n'est utile qu'au CSV : c'est lui qui évite à Excel de massacrer les
      // accents. Un EDL en est corrompu — Resolve lit l'en-tête octet par octet.
      const body = format === "csv" ? `﻿${payload.content}` : payload.content;
      const blob = new Blob([body], { type: `${EXPORT_MIME[format]};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = payload.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError((cause as Error)?.message ?? t("markers.exportFailed"));
    } finally {
      setExporting(null);
    }
  }

  function addMarker() {
    setError(null);
    const startMs = parseTimecode(draft.start);
    if (startMs === null) {
      setError(t("markers.invalidStart"));
      return;
    }
    let endMs: number | undefined;
    if (draft.end.trim()) {
      const parsed = parseTimecode(draft.end);
      if (parsed === null) {
        setError(t("markers.invalidEnd"));
        return;
      }
      endMs = parsed;
    }
    if (!draft.label.trim()) {
      setError(t("markers.labelRequired"));
      return;
    }
    upsert.mutate(
      {
        videoId,
        label: draft.label,
        startMs,
        ...(endMs === undefined ? {} : { endMs }),
        ...(draft.rush.trim() ? { rushName: draft.rush } : {}),
        ...(draft.feeling.trim() ? { intendedFeeling: draft.feeling } : {}),
        ...(draft.attempt.trim() ? { editAttempt: draft.attempt } : {}),
      },
      {
        onSuccess: () => setDraft({ label: "", rush: "", start: "", end: "", feeling: "", attempt: "" }),
        onError: (mutationError) => setError((mutationError as Error).message),
      },
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("markers.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("markers.description")}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-muted flex rounded-md p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setOrder("narrative")}
              className={`rounded px-2 py-1 ${order === "narrative" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              {t("markers.orderNarrative")}
            </button>
            <button
              type="button"
              onClick={() => setOrder("timecode")}
              className={`rounded px-2 py-1 ${order === "timecode" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              {t("markers.orderTimecode")}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant={importOpen ? "default" : "outline"}
              onClick={() => setImportOpen((previous) => !previous)}
            >
              <IconFileImport size={14} /> {t("import.open")}
            </Button>
            {EXPORT_FORMATS.map(({ format, labelKey, titleKey }) => (
              <Button
                key={format}
                size="sm"
                variant="outline"
                onClick={() => download(format)}
                disabled={markers.length === 0 || exporting !== null}
                title={t(titleKey)}
              >
                <IconDownload size={14} />{" "}
                {exporting === format ? t("markers.exporting") : t(labelKey)}
              </Button>
            ))}
          </div>
        </div>
      </header>

      {importOpen ? (
        <MarkerImport
          videoId={videoId}
          onImported={() => void refetch()}
          onClose={() => setImportOpen(false)}
        />
      ) : null}

      {result && result.unassignedCount > 0 ? (
        <Badge tone="muted" className="self-start">
          {t("studio.unassignedMarkers", { count: result.unassignedCount })}
        </Badge>
      ) : null}

      {markers.length === 0 ? (
        <EmptyState
          title={t("markers.emptyTitle")}
          hint={t("markers.emptyHint")}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-3xl border-collapse text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs">
                <th className="w-8 py-2" />
                <th className="py-2 pr-3">{t("markers.colLabel")}</th>
                <th className="py-2 pr-3">{t("markers.colRush")}</th>
                <th className="py-2 pr-3">{t("markers.colStart")}</th>
                <th className="py-2 pr-3">{t("markers.colEnd")}</th>
                <th className="py-2 pr-3">{t("markers.colStep")}</th>
                <th className="py-2 pr-3">{t("markers.colFeeling")}</th>
                <th className="py-2 pr-3">{t("markers.colAttempt")}</th>
                <th className="w-8 py-2" />
              </tr>
            </thead>
            <tbody>
              {markers.map((marker, index) => (
                <tr key={marker.id} className="hover:bg-muted/30 border-b last:border-0">
                  <td className="py-1.5">
                    {order === "narrative" ? (
                      <div className="flex flex-col">
                        <button
                          type="button"
                          aria-label={t("markers.moveUp")}
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-25"
                        >
                          <IconArrowUp size={12} />
                        </button>
                        <button
                          type="button"
                          aria-label={t("markers.moveDown")}
                          disabled={index === markers.length - 1}
                          onClick={() => move(index, 1)}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-25"
                        >
                          <IconArrowDown size={12} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs tabular-nums">{index + 1}</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 font-medium">
                    <EditableCell
                      value={marker.label}
                      placeholder={t("markers.untitled")}
                      onCommit={(next) => next && edit(marker, { label: next })}
                    />
                  </td>
                  <td className="text-muted-foreground py-1.5 pr-3 text-xs">
                    <EditableCell
                      value={marker.rushName ?? ""}
                      placeholder="—"
                      onCommit={(next) => edit(marker, { rushName: next })}
                    />
                  </td>
                  <td className="py-1.5 pr-3 text-xs">
                    <EditableCell
                      value={marker.startTimecode}
                      placeholder="—"
                      align="tabular"
                      onCommit={(next) => {
                        const parsed = parseTimecode(next);
                        if (parsed !== null) edit(marker, { startMs: parsed });
                      }}
                    />
                  </td>
                  <td className="py-1.5 pr-3 text-xs">
                    <EditableCell
                      value={marker.endTimecode || ""}
                      placeholder="—"
                      align="tabular"
                      onCommit={(next) => edit(marker, { endMs: parseTimecode(next) })}
                    />
                  </td>
                  <td className="py-1.5 pr-3">
                    <select
                      value={marker.step ?? ""}
                      onChange={(event) =>
                        assign.mutate({
                          markerId: marker.id,
                          step: event.target.value === "" ? null : Number(event.target.value),
                        })
                      }
                      className="border-input bg-background rounded border px-1.5 py-1 text-xs"
                    >
                      <option value="">{t("markers.stepNone")}</option>
                      {STEP_OPTIONS.map((step) => (
                        <option key={step} value={step}>
                          {step}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="text-muted-foreground py-1.5 pr-3 text-xs">
                    <EditableCell
                      value={marker.intendedFeeling ?? ""}
                      placeholder="—"
                      onCommit={(next) => edit(marker, { intendedFeeling: next })}
                    />
                  </td>
                  <td className="text-muted-foreground py-1.5 pr-3 text-xs">
                    <EditableCell
                      value={marker.editAttempt ?? ""}
                      placeholder="—"
                      onCommit={(next) => edit(marker, { editAttempt: next })}
                    />
                  </td>
                  <td className="py-1.5">
                    <button
                      type="button"
                      aria-label={t("markers.delete")}
                      onClick={() => {
                        if (!confirmDelete(t, marker.label)) return;
                        remove.mutate({ markerId: marker.id });
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <IconTrash size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="border-border rounded-lg border p-4">
        <h3 className="mb-3 text-sm font-semibold">{t("markers.addTitle")}</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs sm:col-span-2">
            <span className="font-medium">{t("markers.colLabel")}</span>
            <Input
              value={draft.label}
              onChange={(event) => setDraft({ ...draft, label: event.target.value })}
              placeholder={t("markers.labelPlaceholder")}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">{t("markers.colRush")}</span>
            <Input
              value={draft.rush}
              onChange={(event) => setDraft({ ...draft, rush: event.target.value })}
              placeholder={t("markers.rushPlaceholder")}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium">{t("markers.colStart")}</span>
              <Input
                value={draft.start}
                onChange={(event) => setDraft({ ...draft, start: event.target.value })}
                placeholder="1:30"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium">{t("markers.colEnd")}</span>
              <Input
                value={draft.end}
                onChange={(event) => setDraft({ ...draft, end: event.target.value })}
                placeholder="1:45"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs sm:col-span-2">
            <span className="font-medium">{t("markers.colFeeling")}</span>
            <Textarea
              className="min-h-16"
              value={draft.feeling}
              onChange={(event) => setDraft({ ...draft, feeling: event.target.value })}
              placeholder={t("markers.feelingPlaceholder")}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs sm:col-span-2">
            <span className="font-medium">{t("markers.colAttempt")}</span>
            <Textarea
              className="min-h-16"
              value={draft.attempt}
              onChange={(event) => setDraft({ ...draft, attempt: event.target.value })}
              placeholder={t("markers.attemptPlaceholder")}
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={addMarker} disabled={upsert.isPending}>
            <IconPlus size={14} /> {t("studio.add")}
          </Button>
          {error ? <span className="text-destructive text-xs">{error}</span> : null}
        </div>
      </section>
    </div>
  );
}
