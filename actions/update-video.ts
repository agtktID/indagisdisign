import { defineAction } from "@agent-native/core/action";
import { eq } from "@agent-native/core/db/schema";
import { z } from "zod";

import { getDb, nowIso, schema } from "../server/db/index.ts";
import { loadVideoForWrite } from "../server/studio.ts";

export default defineAction({
  description:
    "Modifier le titre, le type ou l'échéance d'une vidéo. Ne change PAS l'étape de production : utiliser move-stage pour cela, afin que chaque changement laisse une trace dans l'historique.",
  schema: z.object({
    videoId: z.string().describe("Identifiant de la vidéo"),
    title: z.string().min(1).optional().describe("Nouveau titre"),
    kind: z.enum(["long", "short"]).optional().describe("Vidéo longue ou dérivé court"),
    dueAt: z
      .string()
      .nullable()
      .optional()
      .describe("Nouvelle échéance ISO-8601, ou null pour la retirer"),
    stage: z
      .string()
      .optional()
      .describe("NE PAS UTILISER — passer par move-stage"),
  }),
  run: async ({ videoId, title, kind, dueAt, stage }) => {
    if (stage !== undefined) {
      throw new Error(
        "update-video ne change pas l'étape de production. Utilisez move-stage : c'est le seul chemin qui enregistre le changement dans l'historique.",
      );
    }

    await loadVideoForWrite(videoId);
    const db = getDb();

    const patch: Record<string, unknown> = { updatedAt: nowIso() };
    if (title !== undefined) patch.title = title.trim();
    if (kind !== undefined) patch.kind = kind;
    if (dueAt !== undefined) patch.dueAt = dueAt;

    if (Object.keys(patch).length === 1) {
      throw new Error("Rien à modifier : fournissez au moins un champ (title, kind, dueAt).");
    }

    const [video] = await db
      .update(schema.videos)
      .set(patch)
      .where(eq(schema.videos.id, videoId))
      .returning();

    return { video };
  },
});
