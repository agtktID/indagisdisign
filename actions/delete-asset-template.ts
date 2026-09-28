import { defineAction } from "@agent-native/core/action";
import { and, eq } from "@agent-native/core/db/schema";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.ts";
import { ownedByCurrentUser } from "../server/studio.ts";

export default defineAction({
  description:
    "Supprimer un modèle de génération. Les ressources déjà produites avec lui sont conservées.",
  schema: z.object({
    templateId: z.string().describe("Identifiant du modèle"),
  }),
  run: async ({ templateId }) => {
    const db = getDb();

    // Les ressources produites gardent leur trace, mais ne pointent plus vers un absent.
    await db
      .update(schema.assets)
      .set({ templateId: null })
      .where(eq(schema.assets.templateId, templateId));

    const deleted = await db
      .delete(schema.assetTemplates)
      .where(
        and(
          eq(schema.assetTemplates.id, templateId),
          ownedByCurrentUser(schema.assetTemplates),
        ),
      )
      .returning();

    if (deleted.length === 0) throw new Error(`Modèle « ${templateId} » introuvable.`);
    return { deleted: true, templateId };
  },
});
