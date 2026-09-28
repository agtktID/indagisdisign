import { defineAction } from "@agent-native/core/action";
import { and, eq } from "@agent-native/core/db/schema";
import { desc } from "drizzle-orm";
import { z } from "zod";

import { ONE_CHANGE_AT_A_TIME, symptomByKey } from "../shared/hero-journey.ts";
import { getDb, schema } from "../server/db/index.ts";
import { assertStep, loadVideo } from "../server/studio.ts";

export default defineAction({
  description:
    "Lister les essais d'une vidéo : la boucle observation → hypothèse → tentative → verdict, qu'ils viennent d'un diagnostic, d'un retour de spectateur ou de l'utilisateur lui-même.",
  schema: z.object({
    videoId: z.string().describe("Identifiant de la vidéo"),
    status: z
      .enum(["todo", "testing", "kept", "discarded"])
      .optional()
      .describe("Ne garder que les essais dans cet état"),
    source: z
      .enum(["diagnostic", "roasting", "self"])
      .optional()
      .describe("Ne garder que les essais de cette origine"),
    step: z.number().int().optional().describe("Ne garder que les essais visant cette étape"),
  }),
  http: { method: "GET" },
  run: async ({ videoId, status, source, step }) => {
    await loadVideo(videoId);
    if (step !== undefined) assertStep(step);

    const conditions = [eq(schema.experiments.videoId, videoId)];
    if (status) conditions.push(eq(schema.experiments.status, status));
    if (source) conditions.push(eq(schema.experiments.source, source));
    if (step !== undefined) conditions.push(eq(schema.experiments.step, step));

    const rows = await getDb()
      .select()
      .from(schema.experiments)
      .where(and(...conditions))
      .orderBy(desc(schema.experiments.updatedAt));

    const testingCount = rows.filter((row) => row.status === "testing").length;

    return {
      experiments: rows.map((row) => ({
        ...row,
        symptom: row.symptomKey ? (symptomByKey(row.symptomKey) ?? null) : null,
      })),
      openCount: rows.filter((row) => row.status === "todo" || row.status === "testing").length,
      testingCount,
      warning:
        testingCount > 1
          ? `${testingCount} essais sont en cours en même temps. ${ONE_CHANGE_AT_A_TIME}`
          : undefined,
    };
  },
});
