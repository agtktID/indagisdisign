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

    // **Autoriser d'abord.** Le détachement partait avant ce contrôle et sans filtre de
    // propriétaire : appeler l'action sur le modèle d'un autre détachait ses ressources,
    // puis échouait sur « introuvable ». Le refus arrivait après les dégâts.
    const owned = (
      await db
        .select({ id: schema.assetTemplates.id })
        .from(schema.assetTemplates)
        .where(
          and(eq(schema.assetTemplates.id, templateId), ownedByCurrentUser(schema.assetTemplates)),
        )
        .limit(1)
    )[0];
    if (!owned) throw new Error(`Modèle « ${templateId} » introuvable.`);

    // Les ressources produites gardent leur trace, mais ne pointent plus vers un absent.
    await db
      .update(schema.assets)
      .set({ templateId: null })
      .where(and(eq(schema.assets.templateId, templateId), ownedByCurrentUser(schema.assets)));

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
