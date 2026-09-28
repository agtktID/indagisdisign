import { defineAction } from "@agent-native/core/action";
import { eq } from "@agent-native/core/db/schema";
import { z } from "zod";

import { getDb, nowIso, schema } from "../server/db/index.ts";
import { loadVideoForWrite } from "../server/studio.ts";

export default defineAction({
  description:
    "Archiver ou désarchiver une vidéo. L'archivage est logique et réversible : le travail narratif n'est jamais supprimé.",
  schema: z.object({
    videoId: z.string().describe("Identifiant de la vidéo"),
    archived: z
      .boolean()
      .default(true)
      .describe("true pour archiver, false pour sortir de l'archive"),
  }),
  run: async ({ videoId, archived }) => {
    await loadVideoForWrite(videoId);
    const db = getDb();

    const [video] = await db
      .update(schema.videos)
      .set({ archivedAt: archived ? nowIso() : null, updatedAt: nowIso() })
      .where(eq(schema.videos.id, videoId))
      .returning();

    return { video, archived };
  },
});
