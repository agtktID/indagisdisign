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

    // **Autoriser d'abord.** Le détachement partait avant ce contrôle, et sans filtre de
    // propriétaire : appeler l'action sur le kit de quelqu'un d'autre détachait ses
    // modèles et ses ressources, puis échouait sur « introuvable ». Le refus arrivait
    // après les dégâts, et rien ne les annulait.
    const owned = (
      await db
        .select({ id: schema.brandKits.id })
        .from(schema.brandKits)
        .where(and(eq(schema.brandKits.id, brandKitId), ownedByCurrentUser(schema.brandKits)))
        .limit(1)
    )[0];
    if (!owned) throw new Error(`Kit de marque « ${brandKitId} » introuvable.`);

    // Détacher avant de supprimer : sans ça, modèles et ressources pointeraient dans le
    // vide. Le filtre de propriétaire est répété ici — il ne coûte rien, et il tient même
    // si le contrôle ci-dessus venait à bouger.
    await db
      .update(schema.assetTemplates)
      .set({ brandKitId: null })
      .where(
        and(
          eq(schema.assetTemplates.brandKitId, brandKitId),
          ownedByCurrentUser(schema.assetTemplates),
        ),
      );
    await db
      .update(schema.assets)
      .set({ brandKitId: null })
      .where(and(eq(schema.assets.brandKitId, brandKitId), ownedByCurrentUser(schema.assets)));

    const deleted = await db
      .delete(schema.brandKits)
      .where(and(eq(schema.brandKits.id, brandKitId), ownedByCurrentUser(schema.brandKits)))
      .returning();

    if (deleted.length === 0) throw new Error(`Kit de marque « ${brandKitId} » introuvable.`);
    return { deleted: true, brandKitId, detached: true };
  },
});
