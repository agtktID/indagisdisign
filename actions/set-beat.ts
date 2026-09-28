import { defineAction } from "@agent-native/core/action";
import { and, eq } from "@agent-native/core/db/schema";
import { z } from "zod";

import { isBeatCovered } from "../shared/coverage.ts";
import { stepByNumber } from "../shared/hero-journey.ts";
import { getDb, newId, nowIso, schema } from "../server/db/index.ts";
import { assertIntensity, assertStep, loadVideoForWrite, ownerStamp } from "../server/studio.ts";

export default defineAction({
  description:
    "Écrire la note et l'intensité émotionnelle d'une des 12 étapes du voyage du héros pour une vidéo. Attention : une intensité seule ne rend PAS l'étape couverte — seule une note non vide le fait.",
  schema: z.object({
    videoId: z.string().describe("Identifiant de la vidéo"),
    step: z.number().int().describe("Numéro d'étape, de 1 à 12"),
    note: z.string().optional().describe("Ce que l'utilisateur écrit pour cette étape"),
    intensity: z
      .number()
      .int()
      .optional()
      .describe("Intensité émotionnelle de 0 à 100, pour la courbe"),
    status: z
      .enum(["drafted", "locked"])
      .optional()
      .describe("drafted en cours d'écriture, locked quand l'étape est arrêtée"),
  }),
  run: async ({ videoId, step, note, intensity, status }) => {
    await loadVideoForWrite(videoId);
    assertStep(step);
    if (intensity !== undefined) assertIntensity(intensity);

    if (note === undefined && intensity === undefined && status === undefined) {
      throw new Error(
        "Rien à écrire : fournissez au moins une note, une intensité ou un statut.",
      );
    }

    const db = getDb();
    const timestamp = nowIso();

    const existing = (
      await db
        .select()
        .from(schema.storyBeats)
        .where(
          and(eq(schema.storyBeats.videoId, videoId), eq(schema.storyBeats.step, step)),
        )
        .limit(1)
    )[0];

    let beat;
    if (existing) {
      const patch: Record<string, unknown> = { updatedAt: timestamp };
      if (note !== undefined) patch.note = note;
      if (intensity !== undefined) patch.intensity = intensity;
      if (status !== undefined) patch.status = status;
      [beat] = await db
        .update(schema.storyBeats)
        .set(patch)
        .where(eq(schema.storyBeats.id, existing.id))
        .returning();
    } else {
      [beat] = await db
        .insert(schema.storyBeats)
        .values({
          id: newId(),
          videoId,
          step,
          note: note ?? null,
          intensity: intensity ?? null,
          status: status ?? "drafted",
          createdAt: timestamp,
          updatedAt: timestamp,
          ...ownerStamp(),
        })
        .returning();
    }

    const reference = stepByNumber(step);
    const isCovered = isBeatCovered(beat);

    return {
      beat,
      step: { number: step, title: reference.title, actId: reference.actId },
      isCovered,
      hint: isCovered
        ? undefined
        : "Cette étape n'est pas encore couverte : seule une note non vide la rend couverte, l'intensité seule ne suffit pas.",
    };
  },
});
