import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import {
  DIAGNOSTIC_SYMPTOMS,
  ONE_CHANGE_AT_A_TIME,
  symptomByKey,
} from "../shared/hero-journey.ts";
import { getDb, newId, nowIso, schema } from "../server/db/index.ts";
import { assertStep, loadVideoForWrite, ownerStamp } from "../server/studio.ts";

export default defineAction({
  description:
    "Ouvrir un essai : une observation à transformer en hypothèse puis en tentative de montage. L'origine est un diagnostic de structure, un retour de spectateur (roasting), ou l'utilisateur lui-même.",
  schema: z.object({
    videoId: z.string().describe("Identifiant de la vidéo"),
    source: z
      .enum(["diagnostic", "roasting", "self"])
      .describe("D'où vient l'observation"),
    observation: z
      .string()
      .min(1)
      .describe("Ce qui a été constaté, mot pour mot si c'est un retour de spectateur"),
    symptomKey: z
      .string()
      .optional()
      .describe(
        `Symptôme du référentiel, uniquement si source = diagnostic : ${DIAGNOSTIC_SYMPTOMS.map((symptom) => symptom.key).join(", ")}`,
      ),
    step: z.number().int().optional().describe("Étape narrative visée, 1 à 12"),
    hypothesis: z.string().optional().describe("La cause probable, selon l'utilisateur"),
    attempt: z.string().optional().describe("Ce qui va être changé"),
  }),
  run: async ({ videoId, source, observation, symptomKey, step, hypothesis, attempt }) => {
    await loadVideoForWrite(videoId);
    if (step !== undefined) assertStep(step);

    if (symptomKey !== undefined) {
      if (source !== "diagnostic") {
        throw new Error(
          "Un symptôme ne s'attache qu'à un essai de source « diagnostic ». Pour un retour de spectateur, utilisez source = « roasting » et décrivez l'observation telle qu'elle a été formulée.",
        );
      }
      if (!symptomByKey(symptomKey)) {
        throw new Error(
          `Symptôme « ${symptomKey} » inconnu. Clés valides : ${DIAGNOSTIC_SYMPTOMS.map((symptom) => symptom.key).join(", ")}.`,
        );
      }
    }

    const db = getDb();
    const timestamp = nowIso();

    const [experiment] = await db
      .insert(schema.experiments)
      .values({
        id: newId(),
        videoId,
        step: step ?? null,
        source,
        symptomKey: symptomKey ?? null,
        observation: observation.trim(),
        hypothesis: hypothesis ?? null,
        attempt: attempt ?? null,
        status: "todo",
        createdAt: timestamp,
        updatedAt: timestamp,
        ...ownerStamp(),
      })
      .returning();

    return {
      experiment,
      symptom: symptomKey ? (symptomByKey(symptomKey) ?? null) : null,
      rule: ONE_CHANGE_AT_A_TIME,
    };
  },
});
