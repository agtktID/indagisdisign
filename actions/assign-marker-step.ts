import { defineAction } from "@agent-native/core/action";
import { eq } from "@agent-native/core/db/schema";
import { z } from "zod";

import { stepByNumber } from "../shared/hero-journey.ts";
import { getDb, nowIso, schema } from "../server/db/index.ts";
import { assertStep, loadVideoForWrite } from "../server/studio.ts";

export default defineAction({
  description:
    "Rattacher un marqueur à une étape du voyage du héros, ou l'en détacher avec step = null. N'écrase aucun autre champ du marqueur : rattacher est un geste distinct d'éditer.",
  schema: z.object({
    markerId: z.string().describe("Identifiant du marqueur"),
    // Même conversion explicite que dans upsert-marker : un champ `nullable` n'est pas
    // converti automatiquement depuis les arguments de ligne de commande.
    step: z
      .preprocess(
        (value) =>
          value === "" || value === "null" || value === null
            ? null
            : typeof value === "string"
              ? Number(value)
              : value,
        z.number().int().nullable(),
      )
      .describe("Étape 1 à 12, ou null pour détacher explicitement"),
  }),
  run: async ({ markerId, step }) => {
    const db = getDb();

    const existing = (
      await db.select().from(schema.markers).where(eq(schema.markers.id, markerId)).limit(1)
    )[0];

    if (!existing) {
      throw new Error(`Marqueur « ${markerId} » introuvable.`);
    }

    await loadVideoForWrite(existing.videoId);
    if (step !== null) assertStep(step);

    const [marker] = await db
      .update(schema.markers)
      .set({ step, updatedAt: nowIso() })
      .where(eq(schema.markers.id, markerId))
      .returning();

    return {
      marker,
      stepTitle: step === null ? null : stepByNumber(step).title,
    };
  },
});
