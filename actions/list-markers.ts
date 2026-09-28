import { defineAction } from "@agent-native/core/action";
import { and, eq } from "@agent-native/core/db/schema";
import { asc } from "drizzle-orm";
import { z } from "zod";

import { stepByNumber } from "../shared/hero-journey.ts";
import { getDb, schema } from "../server/db/index.ts";
import { assertStep, loadVideo, msToTimecode } from "../server/studio.ts";

export default defineAction({
  description:
    "Lister le carnet de marqueurs d'une vidéo. L'ordre narratif (par défaut) peut différer de l'ordre chronologique — c'est l'objet même d'un remontage.",
  schema: z.object({
    videoId: z.string().describe("Identifiant de la vidéo"),
    step: z
      .number()
      .int()
      .optional()
      .describe("Ne garder que les marqueurs rattachés à cette étape, 1 à 12"),
    order: z
      .enum(["narrative", "timecode"])
      .default("narrative")
      .describe("Tri par ordre narratif ou par timecode"),
  }),
  http: { method: "GET" },
  run: async ({ videoId, step, order }) => {
    await loadVideo(videoId);
    if (step !== undefined) assertStep(step);

    const db = getDb();
    const where =
      step === undefined
        ? eq(schema.markers.videoId, videoId)
        : and(eq(schema.markers.videoId, videoId), eq(schema.markers.step, step));

    const rows = await db
      .select()
      .from(schema.markers)
      .where(where)
      .orderBy(
        order === "timecode"
          ? asc(schema.markers.startMs)
          : asc(schema.markers.sortOrder),
      );

    return {
      order,
      markers: rows.map((marker) => ({
        ...marker,
        startTimecode: msToTimecode(marker.startMs),
        endTimecode: msToTimecode(marker.endMs),
        stepTitle: marker.step === null ? null : stepByNumber(marker.step).title,
      })),
      unassignedCount: rows.filter((marker) => marker.step === null).length,
    };
  },
});
