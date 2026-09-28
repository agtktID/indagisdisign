import { defineAction } from "@agent-native/core/action";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { ONE_CHANGE_AT_A_TIME } from "../shared/hero-journey.ts";
import { getDb, nowIso, schema } from "../server/db/index.ts";
import { loadVideoForWrite } from "../server/studio.ts";

export default defineAction({
  description:
    "Faire avancer un essai : le passer en cours de test, le conserver ou l'abandonner. Conserver ou abandonner exige de dire ce qui a été observé — clore un essai sans verdict vide la boucle de son intérêt.",
  schema: z.object({
    experimentId: z.string().describe("Identifiant de l'essai"),
    status: z
      .enum(["testing", "kept", "discarded"])
      .describe("testing en cours, kept conservé, discarded abandonné"),
    verdictNote: z
      .string()
      .optional()
      .describe("Ce qui a été observé ; obligatoire pour kept et discarded"),
    attempt: z.string().optional().describe("Ce qui a été changé, si ce n'est pas déjà noté"),
  }),
  run: async ({ experimentId, status, verdictNote, attempt }) => {
    const db = getDb();

    const existing = (
      await db
        .select()
        .from(schema.experiments)
        .where(eq(schema.experiments.id, experimentId))
        .limit(1)
    )[0];

    if (!existing) {
      throw new Error(`Essai « ${experimentId} » introuvable.`);
    }

    await loadVideoForWrite(existing.videoId);

    if ((status === "kept" || status === "discarded") && !verdictNote?.trim()) {
      throw new Error(
        "Un verdict est requis pour conserver ou abandonner un essai : dites ce que la comparaison avant/après a montré.",
      );
    }

    const patch: Record<string, unknown> = { status, updatedAt: nowIso() };
    if (verdictNote !== undefined) patch.verdictNote = verdictNote;
    if (attempt !== undefined) patch.attempt = attempt;

    const [experiment] = await db
      .update(schema.experiments)
      .set(patch)
      .where(eq(schema.experiments.id, experimentId))
      .returning();

    let warning: string | undefined;
    if (status === "testing") {
      const others = await db
        .select({ id: schema.experiments.id })
        .from(schema.experiments)
        .where(
          and(
            eq(schema.experiments.videoId, existing.videoId),
            eq(schema.experiments.status, "testing"),
            ne(schema.experiments.id, experimentId),
          ),
        );
      if (others.length > 0) {
        warning = `${others.length + 1} essais sont maintenant en cours sur cette vidéo. ${ONE_CHANGE_AT_A_TIME}`;
      }
    }

    return { experiment, warning };
  },
});
