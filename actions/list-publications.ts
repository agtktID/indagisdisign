import { defineAction } from "@agent-native/core/action";
import { eq, inArray } from "@agent-native/core/db/schema";
import { asc, desc } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.ts";
import { loadVideo } from "../server/studio.ts";

export default defineAction({
  description:
    "Lire les cibles de diffusion d'une vidéo, chacune avec ses relevés de performance saisis manuellement, du plus récent au plus ancien.",
  schema: z.object({
    videoId: z.string().describe("Identifiant de la vidéo"),
  }),
  http: { method: "GET" },
  run: async ({ videoId }) => {
    await loadVideo(videoId);
    const db = getDb();

    const publications = await db
      .select()
      .from(schema.publications)
      .where(eq(schema.publications.videoId, videoId))
      .orderBy(asc(schema.publications.platform));

    const ids = publications.map((publication) => publication.id);
    const metrics = ids.length
      ? await db
          .select()
          .from(schema.metrics)
          .where(inArray(schema.metrics.publicationId, ids))
          .orderBy(desc(schema.metrics.measuredOn))
      : [];

    return {
      publications: publications.map((publication) => ({
        ...publication,
        metrics: metrics.filter((metric) => metric.publicationId === publication.id),
      })),
      totalMetrics: metrics.length,
    };
  },
});
