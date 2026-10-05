import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { IconArrowDown, IconArrowUp, IconDownload, IconPlus, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { Badge, EmptyState, Textarea } from "./primitives";

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
        title="Modifier"
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
  const [order, setOrder] = useState<"narrative" | "timecode">("narrative");
  const { data } = useActionQuery("list-markers", { videoId, order });
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
  // `export-markers` est aussi une lecture : même traitement que diagnose-structure.
  const exportCsv = useActionQuery(
    "export-markers",
    { videoId, order },
    { enabled: false },
  );

  const [draft, setDraft] = useState({ label: "", rush: "", start: "", end: "", feeling: "", attempt: "" });
  const [error, setError] = useState<string | null>(null);

  function move(index: number, delta: number) {
    const next = [...markers];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    reorder.mutate({ videoId, orderedMarkerIds: next.map((marker) => marker.id) });
  }

  async function download() {
    const { data } = await exportCsv.refetch();
    const payload = data as
      | { content: string; filename: string; rowCount: number }
      | undefined;
    if (!payload) {
      setError("L'export n'a rien renvoyé. Réessayez.");
      return;
    }
    const blob = new Blob([`﻿${payload.content}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = payload.filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function addMarker() {
    setError(null);
    const startMs = parseTimecode(draft.start);
    if (startMs === null) {
      setError("Début invalide. Formats acceptés : 90000, 1:30, 00:01:30.");
      return;
    }
    let endMs: number | undefined;
    if (draft.end.trim()) {
      const parsed = parseTimecode(draft.end);
      if (parsed === null) {
        setError("Fin invalide. Formats acceptés : 90000, 1:30, 00:01:30.");
        return;
      }
      endMs = parsed;
    }
    if (!draft.label.trim()) {
      setError("Un intitulé est nécessaire pour retrouver le passage.");
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
          <h2 className="text-lg font-semibold">Carnet de marqueurs</h2>
          <p className="text-muted-foreground text-sm">
            Un même passage peut remplir plusieurs fonctions, et une étape peut très bien
            manquer — ce n&apos;est pas un défaut.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-muted flex rounded-md p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setOrder("narrative")}
              className={`rounded px-2 py-1 ${order === "narrative" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              Ordre narratif
            </button>
            <button
              type="button"
              onClick={() => setOrder("timecode")}
              className={`rounded px-2 py-1 ${order === "timecode" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              Timecode
            </button>
          </div>
          <Button size="sm" variant="outline" onClick={download} disabled={markers.length === 0}>
            <IconDownload size={14} /> Exporter CSV
          </Button>
        </div>
      </header>

      {result && result.unassignedCount > 0 ? (
        <Badge tone="muted" className="self-start">
          {result.unassignedCount} marqueur{result.unassignedCount > 1 ? "s" : ""} sans étape
        </Badge>
      ) : null}

      {markers.length === 0 ? (
        <EmptyState
          title="Le carnet est vide"
          hint="Posez un premier marqueur sur un passage qui vous a marqué au dérushage. Le rattacher à une étape peut attendre."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-3xl border-collapse text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs">
                <th className="w-8 py-2" />
                <th className="py-2 pr-3">Passage</th>
                <th className="py-2 pr-3">Rush</th>
                <th className="py-2 pr-3">Début</th>
                <th className="py-2 pr-3">Fin</th>
                <th className="py-2 pr-3">Étape</th>
                <th className="py-2 pr-3">Sensation visée</th>
                <th className="py-2 pr-3">Essai de montage</th>
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
                          aria-label="Monter"
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-25"
                        >
                          <IconArrowUp size={12} />
                        </button>
                        <button
                          type="button"
                          aria-label="Descendre"
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
                      placeholder="Sans intitulé"
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
                      <option value="">— aucune</option>
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
                      aria-label="Supprimer"
                      onClick={() => remove.mutate({ markerId: marker.id })}
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
        <h3 className="mb-3 text-sm font-semibold">Ajouter un marqueur</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs sm:col-span-2">
            <span className="font-medium">Passage</span>
            <Input
              value={draft.label}
              onChange={(event) => setDraft({ ...draft, label: event.target.value })}
              placeholder="Luke dans la tranchée"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">Rush</span>
            <Input
              value={draft.rush}
              onChange={(event) => setDraft({ ...draft, rush: event.target.value })}
              placeholder="A004_C012"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium">Début</span>
              <Input
                value={draft.start}
                onChange={(event) => setDraft({ ...draft, start: event.target.value })}
                placeholder="1:30"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium">Fin</span>
              <Input
                value={draft.end}
                onChange={(event) => setDraft({ ...draft, end: event.target.value })}
                placeholder="1:45"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs sm:col-span-2">
            <span className="font-medium">Sensation visée</span>
            <Textarea
              className="min-h-16"
              value={draft.feeling}
              onChange={(event) => setDraft({ ...draft, feeling: event.target.value })}
              placeholder="Tension puis soulagement"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs sm:col-span-2">
            <span className="font-medium">Essai de montage</span>
            <Textarea
              className="min-h-16"
              value={draft.attempt}
              onChange={(event) => setDraft({ ...draft, attempt: event.target.value })}
              placeholder="Garder le tir lisible"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={addMarker} disabled={upsert.isPending}>
            <IconPlus size={14} /> Ajouter
          </Button>
          {error ? <span className="text-destructive text-xs">{error}</span> : null}
        </div>
      </section>
    </div>
  );
}
