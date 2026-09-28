import { defineAction } from "@agent-native/core/action";
import { and, eq } from "@agent-native/core/db/schema";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.ts";
import { ownedByCurrentUser } from "../server/studio.ts";

export default defineAction({
  description:
    "Supprimer un prompt de l'utilisateur. Les prompts livrés avec l'application ne peuvent pas être supprimés : ils vivent dans le code.",
  schema: z.object({
    promptId: z.string().describe("Identifiant du prompt"),
  }),
  run: async ({ promptId }) => {
    const deleted = await getDb()
      .delete(schema.prompts)
      .where(and(eq(schema.prompts.id, promptId), ownedByCurrentUser(schema.prompts)))
      .returning();

    if (deleted.length === 0) {
      throw new Error(
        `Prompt « ${promptId} » introuvable. Les prompts intégrés ne sont pas supprimables.`,
      );
    }
    return { deleted: true, promptId };
  },
});
