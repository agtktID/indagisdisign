import { defineAction } from "@agent-native/core/action";
import { eq } from "@agent-native/core/db/schema";
import { asc } from "drizzle-orm";
import { z } from "zod";

import { CSV_MAX_ROWS } from "../shared/constants.ts";
import { csvRow } from "../shared/csv.ts";
import {
  EXPORT_FRAME_RATES,
  toEdl,
  toYouTubeChapters,
  type ExportFrameRate,
} from "../shared/export-formats.ts";
import { stepByNumber } from "../shared/hero-journey.ts";
import { getDb, schema } from "../server/db/index.ts";
import { loadVideo, msToTimecode } from "../server/studio.ts";

const COLUMNS = [
  "ordre",
  "etape",
  "titre_etape",
  "intitule",
  "rush",
  "debut_ms",
  "fin_ms",
  "debut_tc",
  "fin_tc",
  "sensation_visee",
  "essai_montage",
] as const;

export default defineAction({
  description:
    "Exporter le carnet de marqueurs. Trois formats : csv (tableur), edl (assemblage CMX3600 pour Resolve ou Premiere), youtube-chapters (chapitres collables). Le contenu est renvoyé directement dans la réponse — aucun stockage externe, aucun compte à connecter. L'EDL et les chapitres décrivent un ASSEMBLAGE des passages dans l'ordre narratif : les timecodes du carnet sont relatifs à leur rush, la position dans le montage final n'existe pas encore.",
  schema: z.object({
    videoId: z.string().describe("Identifiant de la vidéo"),
    format: z
      .enum(["csv", "edl", "youtube-chapters"])
      .default("csv")
      .describe("Format de sortie"),
    fps: z.coerce
      .number()
      .refine((value) => (EXPORT_FRAME_RATES as readonly number[]).includes(value), {
        message: `Cadence inconnue. Valides : ${EXPORT_FRAME_RATES.join(", ")}.`,
      })
      .default(25)
      .describe(`Cadence, pour l'EDL uniquement : ${EXPORT_FRAME_RATES.join(", ")}`),
    order: z
      .enum(["narrative", "timecode"])
      .default("narrative")
      .describe("Ordre des lignes exportées"),
    maxRows: z
      .number()
      .int()
      .positive()
      .max(CSV_MAX_ROWS)
      .default(CSV_MAX_ROWS)
      .describe("Plafond de lignes exportées"),
  }),
  http: { method: "GET" },
  run: async ({ videoId, format, fps, order, maxRows }) => {
    const video = await loadVideo(videoId);
    const db = getDb();

    const rows = await db
      .select()
      .from(schema.markers)
      .where(eq(schema.markers.videoId, videoId))
      .orderBy(
        order === "timecode" ? asc(schema.markers.startMs) : asc(schema.markers.sortOrder),
      )
      .limit(maxRows + 1);

    const truncated = rows.length > maxRows;
    const exported = truncated ? rows.slice(0, maxRows) : rows;

    const slug = video.title.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase();

    // L'EDL et les chapitres assemblent les passages : l'ordre narratif fait foi, même
    // si l'appelant a demandé l'ordre chronologique pour un tableur.
    if (format === "edl") {
      const edl = toEdl(exported, { title: video.title, fps: fps as ExportFrameRate });
      return {
        content: edl.content,
        rowCount: edl.eventCount,
        skippedPoints: edl.skippedPoints,
        truncated,
        format,
        fps,
        filename: `${slug}.edl`,
        note: "Assemblage des passages dans l'ordre narratif. Les timecodes source viennent des rushes ; les timecodes d'enregistrement se cumulent à partir de zéro. Non ré-importé dans Resolve ou Premiere depuis ce dépôt — à confirmer à l'usage.",
      };
    }

    if (format === "youtube-chapters") {
      const chapters = toYouTubeChapters(exported);
      if (chapters.refusal) throw new Error(chapters.refusal);
      return {
        content: chapters.content,
        rowCount: chapters.chapterCount,
        truncated,
        format,
        filename: `${slug}-chapitres.txt`,
        note: "Positions calculées depuis l'assemblage, pas depuis un montage existant : elles changeront dès la première coupe.",
      };
    }

    const lines = [COLUMNS.join(",")];
    for (const [position, marker] of exported.entries()) {
      lines.push(
        csvRow([
          position + 1,
          marker.step ?? "",
          marker.step === null ? "" : stepByNumber(marker.step).title,
          marker.label,
          marker.rushName,
          marker.startMs,
          marker.endMs,
          msToTimecode(marker.startMs),
          msToTimecode(marker.endMs),
          marker.intendedFeeling,
          marker.editAttempt,
        ]),
      );
    }

    return {
      content: lines.join("\n"),
      rowCount: exported.length,
      truncated,
      format: "csv" as const,
      filename: `marqueurs-${slug}.csv`,
    };
  },
});
