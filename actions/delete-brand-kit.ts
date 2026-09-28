import { defineAction } from "@agent-native/core/action";
import { and, eq, isNull } from "@agent-native/core/db/schema";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.ts";
import { ownedByCurrentUser } from "../server/studio.ts";

export default defineAction({
  description:
    "Supprimer un kit de marque. Les modèles et ressources qui s'y rattachaient redeviennent globaux — rien n'est perdu.",
  schema: z.object({
    brandKitId: z.string().describe("Identifiant du kit"),
  }),
  run: async ({ brandKitId }) => {
    const db = getDb();

    // Détacher avant de supprimer : sans ça, modèles et ressources pointeraient dans le vide.
    await db
      .update(schema.assetTemplates)
      .set({ brandKitId: null })
      .where(eq(schema.assetTemplates.brandKitId, brandKitId));
    await db
      .update(schema.assets)
      .set({ brandKitId: null })
      .where(eq(schema.assets.brandKitId, brandKitId));

    const deleted = await db
      .delete(schema.brandKits)
      .where(and(eq(schema.brandKits.id, brandKitId), ownedByCurrentUser(schema.brandKits)))
      .returning();

    if (deleted.length === 0) throw new Error(`Kit de marque « ${brandKitId} » introuvable.`);
    return { deleted: true, brandKitId, detached: true };
  },
});
