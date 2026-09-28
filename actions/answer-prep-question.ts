import { defineAction } from "@agent-native/core/action";
import { and, eq } from "@agent-native/core/db/schema";
import { z } from "zod";

import { PREP_QUESTIONS, prepQuestionByKey } from "../shared/hero-journey.ts";
import { getDb, newId, nowIso, schema } from "../server/db/index.ts";
import { loadVideoForWrite, ownerStamp } from "../server/studio.ts";

export default defineAction({
  description:
    "Répondre à une des cinq questions de la fiche de préparation. La clé de question doit appartenir au référentiel : une clé inconnue est rejetée, jamais insérée.",
  schema: z.object({
    videoId: z.string().describe("Identifiant de la vidéo"),
    questionKey: z
      .string()
      .describe(
        `Clé de la question : ${PREP_QUESTIONS.map((question) => question.key).join(", ")}`,
      ),
    answer: z.string().describe("La réponse de l'utilisateur"),
  }),
  run: async ({ videoId, questionKey, answer }) => {
    await loadVideoForWrite(videoId);

    const question = prepQuestionByKey(questionKey);
    if (!question) {
      throw new Error(
        `Question « ${questionKey} » inconnue. Clés valides : ${PREP_QUESTIONS.map((item) => item.key).join(", ")}.`,
      );
    }

    const db = getDb();
    const timestamp = nowIso();

    const existing = (
      await db
        .select()
        .from(schema.prepAnswers)
        .where(
          and(
            eq(schema.prepAnswers.videoId, videoId),
            eq(schema.prepAnswers.questionKey, questionKey),
          ),
        )
        .limit(1)
    )[0];

    const [row] = existing
      ? await db
          .update(schema.prepAnswers)
          .set({ answer, updatedAt: timestamp })
          .where(eq(schema.prepAnswers.id, existing.id))
          .returning()
      : await db
          .insert(schema.prepAnswers)
          .values({
            id: newId(),
            videoId,
            questionKey,
            answer,
            createdAt: timestamp,
            updatedAt: timestamp,
            ...ownerStamp(),
          })
          .returning();

    return { answer: row, question: { key: question.key, label: question.label } };
  },
});
