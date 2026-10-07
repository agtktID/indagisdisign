/**
 * Faire entrer un carnet au lieu de le retaper.
 *
 * Le dérushage produit vingt à cinquante repères, et le carnet n'en saisissait qu'un à
 * la fois. Vingt formulaires, c'est un abandon — c'était le prix d'entrée du produit, et
 * le plus cher.
 *
 * Deux portes, une seule action derrière : **coller un bloc** (ce que fait un monteur
 * qui vient de dérusher) ou **choisir un fichier** (le CSV ou l'EDL qu'il a déjà). Le
 * fichier est lu dans le navigateur et son texte part à l'action locale ; rien ne sort
 * de la machine.
 *
 * **La lecture à blanc est proposée avant l'écriture.** On montre ce qui serait créé et
 * ce qui serait refusé, ligne par ligne. Un carnet à moitié faux coûte plus cher qu'un
 * carnet vide, parce qu'on ne sait pas quelle moitié.
 */
import { useT } from "@agent-native/core/client/i18n";
import { callAction } from "@agent-native/core/client/use-action";
import { IconFileImport, IconUpload } from "@tabler/icons-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { EXPORT_FRAME_RATES } from "@shared/export-formats";

import { Textarea } from "./primitives";

interface ImportResult {
  format: "csv" | "edl" | "lines";
  imported: number;
  read: number;
  dryRun: boolean;
  rejected: { line: number; raw: string; reason: string }[];
}

/** La cadence du PAL, la plus courante hors Amérique du Nord. */
const DEFAULT_FPS = 25;

export function MarkerImport({
  videoId,
  onImported,
}: {
  videoId: string;
  onImported: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [fps, setFps] = useState<number>(DEFAULT_FPS);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Montrer le choix de cadence seulement quand il sert : un EDL ne porte pas la
  // sienne, un CSV n'en a pas besoin. L'afficher toujours ferait croire qu'elle influe
  // sur tout.
  const looksLikeEdl = /^\s*(TITLE|FCM):/m.test(content);

  async function run(dryRun: boolean) {
    setBusy(true);
    setError(null);
    try {
      const outcome = await callAction<ImportResult>("import-markers", {
        videoId,
        content,
        dryRun,
        ...(looksLikeEdl ? { fps } : {}),
      });
      setResult(outcome);
      if (!dryRun && outcome.imported > 0) {
        setContent("");
        onImported();
      }
    } catch (cause) {
      setError((cause as Error)?.message ?? t("import.failed"));
    } finally {
      setBusy(false);
    }
  }

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onerror = () => setError(t("import.fileUnreadable"));
    reader.onload = () => {
      setContent(String(reader.result ?? ""));
      setResult(null);
      setError(null);
    };
    reader.readAsText(file);
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <IconFileImport size={14} /> {t("import.open")}
      </Button>
    );
  }

  return (
    <section className="border-border mt-4 flex flex-col gap-3 rounded-lg border p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("import.title")}</h3>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground text-xs underline"
          onClick={() => setOpen(false)}
        >
          {t("import.close")}
        </button>
      </header>

      <p className="text-muted-foreground text-xs">{t("import.help")}</p>

      <Textarea
        value={content}
        onChange={(event) => {
          setContent(event.target.value);
          setResult(null);
        }}
        placeholder={t("import.placeholder")}
        rows={6}
      />

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept=".csv,.edl,.txt,text/plain,text/csv"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) readFile(file);
            event.target.value = "";
          }}
        />
        <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
          <IconUpload size={14} /> {t("import.chooseFile")}
        </Button>

        {looksLikeEdl ? (
          <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
            {t("import.fps")}
            <select
              className="border-border bg-background rounded border px-1.5 py-1 text-xs"
              value={fps}
              onChange={(event) => setFps(Number(event.target.value))}
            >
              {EXPORT_FRAME_RATES.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <span className="grow" />

        <Button
          size="sm"
          variant="outline"
          disabled={!content.trim() || busy}
          onClick={() => run(true)}
        >
          {t("import.dryRun")}
        </Button>
        <Button size="sm" disabled={!content.trim() || busy} onClick={() => run(false)}>
          {busy ? t("import.working") : t("import.confirm")}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="flex flex-col gap-2 text-xs">
          <p className={result.read > 0 ? "text-foreground" : "text-muted-foreground"}>
            {result.dryRun
              ? t("import.wouldCreate", { count: result.read, format: result.format })
              : t("import.created", { count: result.imported, format: result.format })}
          </p>
          {result.rejected.length > 0 ? (
            <div className="border-destructive/40 rounded border p-2">
              <p className="mb-1 font-medium">
                {t("import.rejected", { count: result.rejected.length })}
              </p>
              <ul className="text-muted-foreground flex flex-col gap-0.5">
                {result.rejected.slice(0, 12).map((row) => (
                  <li key={`${row.line}-${row.reason}`}>
                    {row.line > 0 ? (
                      <span className="tabular-nums">
                        {t("import.line", { line: row.line })}{" "}
                      </span>
                    ) : null}
                    {row.reason}
                    {row.raw ? (
                      <span className="opacity-60"> — {row.raw.slice(0, 60)}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
