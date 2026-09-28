import { defineAction } from "@agent-native/core/action";
import { desc, eq } from "@agent-native/core/db/schema";
import { z } from "zod";

import { BLOCKED_THRESHOLD_DAYS } from "../shared/constants.ts";
import { computeCoverage } from "../shared/coverage.ts";
import { getDb, schema } from "../server/db/index.ts";
import { daysSince, loadVideo } from "../server/studio.ts";

export default defineAction({
  description:
    "Lire une vidéo Studio : ses métadonnées, sa couverture narrative, son dernier changement d'étape et le volume de travail déjà posé (marqueurs, essais ouverts, réponses de préparation).",
  schema: z.object({
    videoId: z.string().describe("Identifiant de la vidéo"),
  }),
  http: { method: "GET" },
  run: async ({ videoId }) => {
    const video = await loadVideo(videoId);
    const db = getDb();

    const [beats, markerRows, experimentRows, prepRows, events] = await Promise.all([
      db
        .select({ step: schema.storyBeats.step, note: schema.storyBeats.note })
        .from(schema.storyBeats)
        .where(eq(schema.storyBeats.videoId, videoId)),
      db
        .select({ id: schema.markers.id, step: schema.markers.step })
        .from(schema.markers)
        .where(eq(schema.markers.videoId, videoId)),
      db
        .select({ id: schema.experiments.id, status: schema.experiments.status })
        .from(schema.experiments)
        .where(eq(schema.experiments.videoId, videoId)),
      db
        .select({ answer: schema.prepAnswers.answer })
        .from(schema.prepAnswers)
        .where(eq(schema.prepAnswers.videoId, videoId)),
      db
        .select()
        .from(schema.stageEvents)
        .where(eq(schema.stageEvents.videoId, videoId))
        .orderBy(desc(schema.stageEvents.occurredAt))
        .limit(1),
    ]);

    const daysSinceStageChange = daysSince(video.stageChangedAt);

    return {
      video,
      coverage: computeCoverage(beats),
      lastStageEvent: events[0] ?? null,
      daysSinceStageChange,
      isBlocked:
        !video.archivedAt &&
        video.stage !== "published" &&
        daysSinceStageChange > BLOCKED_THRESHOLD_DAYS,
      counts: {
        markers: markerRows.length,
        markersWithoutStep: markerRows.filter((row) => row.step === null).length,
        openExperiments: experimentRows.filter(
          (row) => row.status === "todo" || row.status === "testing",
        ).length,
        prepAnswered: prepRows.filter(
          (row) => typeof row.answer === "string" && row.answer.trim().length > 0,
        ).length,
      },
    };
  },
});
