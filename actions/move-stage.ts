import { defineAction } from "@agent-native/core/action";
import { eq } from "@agent-native/core/db/schema";
import { z } from "zod";

import { getDb, newId, nowIso, schema, STAGES } from "../server/db/index.ts";
import { loadVideoForWrite, ownerStamp } from "../server/studio.ts";

export default defineAction({
  description:
    "Faire changer une vidéo d'étape de production. C'est le SEUL chemin autorisé vers le champ d'étape : il enregistre le changement dans l'historique et remet à zéro le compteur de blocage. Le retour en arrière est permis — un montage peut renvoyer à l'écriture.",
  schema: z.object({
    videoId: z.string().describe("Identifiant de la vidéo"),
    toStage: z
      .enum(STAGES)
      .describe("Étape visée : idea, script, shoot, edit ou published"),
    note: z.string().optional().describe("Pourquoi ce changement"),
  }),
  run: async ({ videoId, toStage, note }) => {
    const video = await loadVideoForWrite(videoId);

    if (video.stage === toStage) {
      throw new Error(
        `La vidéo est déjà à l'étape « ${toStage} ». Aucun mouvement enregistré — un faux mouvement fausserait le compteur de blocage.`,
      );
    }

    const db = getDb();
    const timestamp = nowIso();

    const [updated] = await db
      .update(schema.videos)
      .set({ stage: toStage, stageChangedAt: timestamp, updatedAt: timestamp })
      .where(eq(schema.videos.id, videoId))
      .returning();

    const [event] = await db
      .insert(schema.stageEvents)
      .values({
        id: newId(),
        videoId,
        fromStage: video.stage,
        toStage,
        note: note ?? null,
        occurredAt: timestamp,
        ...ownerStamp(),
      })
      .returning();

    return { video: updated, event };
  },
});
