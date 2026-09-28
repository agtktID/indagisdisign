import { defineAction } from "@agent-native/core/action";
import { and, desc, eq, inArray, isNull } from "@agent-native/core/db/schema";
import { z } from "zod";

import { BLOCKED_THRESHOLD_DAYS } from "../shared/constants.ts";
import { computeCoverage } from "../shared/coverage.ts";
import { getDb, schema } from "../server/db/index.ts";
import { daysSince, videoAccessFilter } from "../server/studio.ts";

export default defineAction({
  description:
    "Lister les projets vidéo avec leur couverture narrative (combien des 12 étapes du voyage du héros sont renseignées), leur étape de production et leur éventuel blocage.",
  schema: z.object({
    includeArchived: z
      .boolean()
      .default(false)
      .describe("Inclure les vidéos archivées"),
    stage: z
      .enum(["idea", "script", "shoot", "edit", "published"])
      .optional()
      .describe("Ne garder que les vidéos à cette étape de production"),
    blockedOnly: z
      .boolean()
      .default(false)
      .describe("Ne garder que les vidéos bloquées"),
  }),
  http: { method: "GET" },
  run: async ({ includeArchived, stage, blockedOnly }) => {
    const db = getDb();

    const conditions = [videoAccessFilter()];
    if (!includeArchived) conditions.push(isNull(schema.videos.archivedAt));
    if (stage) conditions.push(eq(schema.videos.stage, stage));

    const rows = await db
      .select()
      .from(schema.videos)
      .where(and(...conditions))
      .orderBy(desc(schema.videos.updatedAt));

    const ids = rows.map((row) => row.id);
    const beats = ids.length
      ? await db
          .select({
            videoId: schema.storyBeats.videoId,
            step: schema.storyBeats.step,
            note: schema.storyBeats.note,
          })
          .from(schema.storyBeats)
          .where(inArray(schema.storyBeats.videoId, ids))
      : [];

    const beatsByVideo = new Map<string, { step: number; note: string | null }[]>();
    for (const beat of beats) {
      const list = beatsByVideo.get(beat.videoId) ?? [];
      list.push({ step: beat.step, note: beat.note });
      beatsByVideo.set(beat.videoId, list);
    }

    const videos = rows.map((video) => {
      const daysSinceStageChange = daysSince(video.stageChangedAt);
      return {
        ...video,
        coverage: computeCoverage(beatsByVideo.get(video.id) ?? []),
        daysSinceStageChange,
        isBlocked:
          !video.archivedAt &&
          video.stage !== "published" &&
          daysSinceStageChange > BLOCKED_THRESHOLD_DAYS,
      };
    });

    return {
      videos: blockedOnly ? videos.filter((video) => video.isBlocked) : videos,
      thresholdDays: BLOCKED_THRESHOLD_DAYS,
    };
  },
});
