import { defineAction } from "@agent-native/core/action";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { ACTS, JOURNEY_STEPS } from "../shared/hero-journey.ts";
import { computeCoverage, isBeatCovered } from "../shared/coverage.ts";
import { getDb, schema } from "../server/db/index.ts";
import { loadVideo, msToTimecode } from "../server/studio.ts";

export default defineAction({
  description:
    "Lire la carte narrative d'une vidéo : les 12 étapes du voyage du héros avec leur note, leur intensité, les marqueurs rattachés, la courbe émotionnelle et la couverture par acte. Les 12 étapes sont toujours renvoyées, même vides — l'absence de contenu est une information.",
  schema: z.object({
    videoId: z.string().describe("Identifiant de la vidéo"),
  }),
  http: { method: "GET" },
  run: async ({ videoId }) => {
    const video = await loadVideo(videoId);
    const db = getDb();

    const [beatRows, markerRows] = await Promise.all([
      db.select().from(schema.storyBeats).where(eq(schema.storyBeats.videoId, videoId)),
      db
        .select()
        .from(schema.markers)
        .where(eq(schema.markers.videoId, videoId))
        .orderBy(asc(schema.markers.sortOrder)),
    ]);

    const beatByStep = new Map(beatRows.map((beat) => [beat.step, beat]));
    const markersByStep = new Map<number, typeof markerRows>();
    for (const marker of markerRows) {
      if (marker.step === null) continue;
      const list = markersByStep.get(marker.step) ?? [];
      list.push(marker);
      markersByStep.set(marker.step, list);
    }

    const steps = JOURNEY_STEPS.map((reference) => {
      const beat = beatByStep.get(reference.step);
      return {
        step: reference.step,
        actId: reference.actId,
        title: reference.title,
        tagline: reference.tagline,
        definition: reference.definition,
        editing: reference.editing,
        exercise: reference.exercise,
        examples: reference.examples,
        referenceIntensity: reference.referenceIntensity,
        pitfall: reference.pitfall ?? null,
        note: beat?.note ?? null,
        intensity: beat?.intensity ?? null,
        status: beat ? beat.status : ("empty" as const),
        isCovered: isBeatCovered(beat),
        markers: (markersByStep.get(reference.step) ?? []).map((marker) => ({
          id: marker.id,
          label: marker.label,
          startMs: marker.startMs,
          endMs: marker.endMs,
          startTimecode: msToTimecode(marker.startMs),
          sortOrder: marker.sortOrder,
        })),
      };
    });

    const coverage = computeCoverage(beatRows);
    const coveredByAct = new Map(coverage.acts.map((act) => [act.actId, act]));

    return {
      video: { id: video.id, title: video.title, stage: video.stage },
      acts: ACTS.map((act) => ({
        id: act.id,
        numeral: act.numeral,
        label: act.label,
        color: act.color,
        steps: act.steps,
        covered: coveredByAct.get(act.id)?.covered ?? 0,
        total: act.steps.length,
      })),
      steps,
      curve: steps.map(({ step, intensity, referenceIntensity }) => ({
        step,
        intensity,
        referenceIntensity,
      })),
      coverage: { covered: coverage.covered, total: coverage.total },
      unassignedMarkers: markerRows.filter((marker) => marker.step === null).length,
    };
  },
});
