import { defineAction } from "@agent-native/core/action";
import { and, eq } from "@agent-native/core/db/schema";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.ts";
import { ownedByCurrentUser } from "../server/studio.ts";

export default defineAction({
  description:
    "Retirer une ressource de la bibliothèque. Seule la fiche est supprimée : le fichier d'origine, qui vit ailleurs, n'est pas touché.",
  schema: z.object({
    assetId: z.string().describe("Identifiant de la ressource"),
  }),
  run: async ({ assetId }) => {
    const deleted = await getDb()
      .delete(schema.assets)
      .where(and(eq(schema.assets.id, assetId), ownedByCurrentUser(schema.assets)))
      .returning();

    if (deleted.length === 0) throw new Error(`Ressource « ${assetId} » introuvable.`);
    return { deleted: true, assetId, note: "La fiche est supprimée ; le fichier d'origine reste." };
  },
});
