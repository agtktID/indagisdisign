import { defineAction } from "@agent-native/core/action";
import { eq } from "@agent-native/core/db/schema";
import { asc } from "drizzle-orm";
import { z } from "zod";

import { CSV_MAX_ROWS } from "../shared/constants.ts";
import { csvRow } from "../shared/csv.ts";
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
    "Exporter le carnet de marqueurs en CSV. Le contenu est renvoyé directement dans la réponse — aucun stockage externe n'est requis, aucun compte à connecter.",
  schema: z.object({
    videoId: z.string().describe("Identifiant de la vidéo"),
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
  run: async ({ videoId, order, maxRows }) => {
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
      filename: `marqueurs-${video.title.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.csv`,
    };
  },
});
