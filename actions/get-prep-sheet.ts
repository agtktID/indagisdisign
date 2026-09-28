import { defineAction } from "@agent-native/core/action";
import { eq } from "@agent-native/core/db/schema";
import { z } from "zod";

import { PREP_QUESTIONS } from "../shared/hero-journey.ts";
import { getDb, schema } from "../server/db/index.ts";
import { loadVideo } from "../server/studio.ts";

export default defineAction({
  description:
    "Lire la fiche de préparation d'une vidéo : les cinq questions à se poser avant de monter, avec leur réponse si elle existe.",
  schema: z.object({
    videoId: z.string().describe("Identifiant de la vidéo"),
  }),
  http: { method: "GET" },
  run: async ({ videoId }) => {
    await loadVideo(videoId);
    const db = getDb();

    const rows = await db
      .select()
      .from(schema.prepAnswers)
      .where(eq(schema.prepAnswers.videoId, videoId));

    const byKey = new Map(rows.map((row) => [row.questionKey, row]));

    const questions = PREP_QUESTIONS.map((question) => {
      const row = byKey.get(question.key);
      const answer = row?.answer ?? null;
      return {
        key: question.key,
        label: question.label,
        hint: question.hint,
        answer,
        answered: typeof answer === "string" && answer.trim().length > 0,
        updatedAt: row?.updatedAt ?? null,
      };
    });

    return {
      questions,
      answeredCount: questions.filter((question) => question.answered).length,
      total: questions.length,
    };
  },
});
