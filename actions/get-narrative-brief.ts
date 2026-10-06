import { defineAction } from "@agent-native/core/action";
import { eq } from "@agent-native/core/db/schema";
import { asc } from "drizzle-orm";
import { z } from "zod";

import { isBeatCovered } from "../shared/coverage.ts";
import { buildNarrativeBrief, type BriefScope } from "../shared/narrative-brief.ts";
import { getDb, schema } from "../server/db/index.ts";
import { loadVideo } from "../server/studio.ts";

export default defineAction({
  description:
    "Composer un brief de création à partir de la carte narrative d'une vidéo : les notes d'étapes, les intensités, et les passages de rushes repérés, dans l'ordre narratif. Permet « fais-moi un teaser de l'acte III depuis ma carte ». Le périmètre peut être tout le récit, un acte (depart, initiation, retour) ou une seule étape. Le brief DÉCRIT la matière disponible, il ne prescrit rien : une étape sans note est annoncée comme vide plutôt que comblée.",
  schema: z.object({
    videoId: z.string().describe("Identifiant de la vidéo"),
    scope: z
      .union([
        z.enum(["all", "depart", "initiation", "retour"]),
        z.coerce.number().int().min(1).max(12),
      ])
      .default("all")
      .describe("Tout le récit, un acte, ou un numéro d'étape de 1 à 12"),
  }),
  http: { method: "GET" },
  run: async ({ videoId, scope }) => {
    const video = await loadVideo(videoId);
    const db = getDb();

    const [beats, markers] = await Promise.all([
      db.select().from(schema.storyBeats).where(eq(schema.storyBeats.videoId, videoId)),
      db
        .select()
        .from(schema.markers)
        .where(eq(schema.markers.videoId, videoId))
        // L'ordre narratif, pas le chronologique : c'est la distinction que la méthode
        // porte, et celle qu'aucun logiciel de montage ne sait exprimer.
        .orderBy(asc(schema.markers.sortOrder)),
    ]);

    const brief = buildNarrativeBrief({
      videoTitle: video.title,
      scope: scope as BriefScope,
      beats: beats.map((beat) => ({
        step: beat.step,
        note: beat.note,
        intensity: beat.intensity,
        isCovered: isBeatCovered(beat),
      })),
      markers: markers.map((marker) => ({
        label: marker.label,
        rushName: marker.rushName,
        startMs: marker.startMs,
        endMs: marker.endMs,
        step: marker.step,
        intendedFeeling: marker.intendedFeeling,
        editAttempt: marker.editAttempt,
      })),
    });

    return { video: { id: video.id, title: video.title }, scope, ...brief };
  },
});
