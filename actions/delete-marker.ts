import { defineAction } from "@agent-native/core/action";
import { eq } from "@agent-native/core/db/schema";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.ts";
import { loadVideoForWrite } from "../server/studio.ts";

export default defineAction({
  description:
    "Supprimer un marqueur du carnet. Les marqueurs sont du matériau de travail : la suppression est définitive, contrairement à l'archivage d'une vidéo.",
  schema: z.object({
    markerId: z.string().describe("Identifiant du marqueur"),
  }),
  run: async ({ markerId }) => {
    const db = getDb();

    const existing = (
      await db.select().from(schema.markers).where(eq(schema.markers.id, markerId)).limit(1)
    )[0];

    if (!existing) {
      throw new Error(`Marqueur « ${markerId} » introuvable.`);
    }

    await loadVideoForWrite(existing.videoId);
    await db.delete(schema.markers).where(eq(schema.markers.id, markerId));

    return { deleted: true, markerId, videoId: existing.videoId };
  },
});
