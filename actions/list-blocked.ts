import { defineAction } from "@agent-native/core/action";
import { and, eq, isNull, or } from "@agent-native/core/db/schema";
import { z } from "zod";

import { BLOCKED_THRESHOLD_DAYS } from "../shared/constants.ts";
import { getDb, schema } from "../server/db/index.ts";
import { daysSince, videoAccessFilter } from "../server/studio.ts";

export default defineAction({
  description:
    "Lister les vidéos bloquées : celles qui n'ont pas changé d'étape de production depuis plus longtemps que le seuil. Les vidéos archivées et publiées n'y figurent jamais.",
  schema: z.object({
    thresholdDays: z
      .number()
      .int()
      .positive()
      .default(BLOCKED_THRESHOLD_DAYS)
      .describe("Nombre de jours sans mouvement au-delà duquel une vidéo est bloquée"),
  }),
  http: { method: "GET" },
  run: async ({ thresholdDays }) => {
    const db = getDb();

    const rows = await db
      .select()
      .from(schema.videos)
      .where(
        and(
          videoAccessFilter(),
          isNull(schema.videos.archivedAt),
          or(
            eq(schema.videos.stage, "idea"),
            eq(schema.videos.stage, "script"),
            eq(schema.videos.stage, "shoot"),
            eq(schema.videos.stage, "edit"),
          ),
        ),
      );

    const blocked = rows
      .map((video) => ({ video, daysSinceStageChange: daysSince(video.stageChangedAt) }))
      .filter((entry) => entry.daysSinceStageChange > thresholdDays)
      .sort((a, b) => b.daysSinceStageChange - a.daysSinceStageChange);

    return { blocked, thresholdDays, checked: rows.length };
  },
});
