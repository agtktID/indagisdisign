import { defineAction } from "@agent-native/core/action";
import { eq } from "@agent-native/core/db/schema";
import { desc } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.ts";
import { loadVideo } from "../server/studio.ts";

export default defineAction({
  description:
    "Lire l'historique de production d'une vidéo : chaque changement d'étape, d'où il venait, où il allait, à quelle date. C'est la trace que move-stage écrit à chaque mouvement.",
  schema: z.object({
    videoId: z.string().describe("Identifiant de la vidéo"),
    limit: z
      .number()
      .int()
      .positive()
      .max(200)
      .default(50)
      .describe("Nombre maximum d'événements renvoyés, du plus récent au plus ancien"),
  }),
  http: { method: "GET" },
  run: async ({ videoId, limit }) => {
    await loadVideo(videoId);

    const events = await getDb()
      .select()
      .from(schema.stageEvents)
      .where(eq(schema.stageEvents.videoId, videoId))
      .orderBy(desc(schema.stageEvents.occurredAt))
      .limit(limit);

    return { events, count: events.length };
  },
});
