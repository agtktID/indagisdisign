import { defineAction } from "@agent-native/core/action";
import { eq } from "@agent-native/core/db/schema";
import { desc } from "drizzle-orm";
import { z } from "zod";

import { EXPORT_FRAME_RATES } from "../shared/export-formats.ts";
import { parseMarkers, type ImportFormat } from "../shared/import-markers.ts";

import { getDb, newId, nowIso, schema } from "../server/db/index.ts";
import { loadVideoForWrite, ownerStamp } from "../server/studio.ts";

export default defineAction({
  description:
    "Importer des marqueurs dans le carnet depuis un texte : un CSV (celui que l'export produit, ou un autre à colonnes nommées), un EDL CMX3600 venu de Resolve ou Premiere, ou de simples lignes « rush début fin intitulé » collées depuis un dérushage. Le format est reconnu tout seul. Les lignes incompréhensibles sont RENDUES avec leur numéro et leur raison, jamais devinées ni avalées. Pour un EDL, la cadence est obligatoire : un EDL ne la porte pas, et la supposer décalerait tous les timecodes en silence. Les marqueurs importés se rangent à la suite du carnet, jamais à la place. Utiliser dryRun pour voir ce qui serait créé sans rien écrire.",
  schema: z.object({
    videoId: z.string().describe("Identifiant de la vidéo"),
    content: z
      .string()
      .min(1)
      .describe("Le texte à lire : contenu d'un CSV, d'un EDL, ou lignes collées"),
    format: z
      .enum(["csv", "edl", "lines"])
      .optional()
      .describe("Imposer le format ; absent = reconnu depuis le contenu"),
    fps: z.coerce
      .number()
      .optional()
      .describe(
        `Cadence, obligatoire pour un EDL. Au choix : ${EXPORT_FRAME_RATES.join(", ")}`,
      ),
    dryRun: z.coerce
      .boolean()
      .optional()
      .describe("Lire et rendre le compte rendu sans rien écrire"),
  }),
  run: async ({ videoId, content, format, fps, dryRun }) => {
    await loadVideoForWrite(videoId);

    // Une cadence hors de la liste décalerait tout sans rien signaler. Mieux vaut la
    // refuser ici que produire un carnet subtilement faux.
    if (fps !== undefined && !EXPORT_FRAME_RATES.includes(fps as never)) {
      throw new Error(
        `Cadence « ${fps} » inconnue. Au choix : ${EXPORT_FRAME_RATES.join(", ")}.`,
      );
    }

    const report = parseMarkers(content, {
      format: format as ImportFormat | undefined,
      fps: fps as never,
    });

    if (dryRun || report.markers.length === 0) {
      return {
        format: report.format,
        imported: 0,
        read: report.markers.length,
        rejected: report.rejected,
        dryRun: Boolean(dryRun),
        preview: report.markers.slice(0, 10),
      };
    }

    const db = getDb();
    const timestamp = nowIso();

    // Les marqueurs importés se rangent à la suite, jamais à la place : un import ne
    // doit pas pouvoir effacer un carnet. Supprimer reste un geste explicite, marqueur
    // par marqueur, par `delete-marker`.
    const last = (
      await db
        .select({ sortOrder: schema.markers.sortOrder })
        .from(schema.markers)
        .where(eq(schema.markers.videoId, videoId))
        .orderBy(desc(schema.markers.sortOrder))
        .limit(1)
    )[0];

    let nextOrder = (last?.sortOrder ?? -1) + 1;
    const inserted = await db
      .insert(schema.markers)
      .values(
        report.markers.map((marker) => ({
          id: newId(),
          videoId,
          label: marker.label,
          rushName: marker.rushName,
          startMs: marker.startMs,
          endMs: marker.endMs,
          step: marker.step,
          intendedFeeling: marker.intendedFeeling,
          editAttempt: marker.editAttempt,
          sortOrder: nextOrder++,
          createdAt: timestamp,
          updatedAt: timestamp,
          ...ownerStamp(),
        })),
      )
      .returning();

    return {
      format: report.format,
      imported: inserted.length,
      read: report.markers.length,
      rejected: report.rejected,
      dryRun: false,
      markers: inserted,
    };
  },
});
