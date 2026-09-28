import { defineAction } from "@agent-native/core/action";
import { and, eq } from "@agent-native/core/db/schema";
import { z } from "zod";

import { getDb, newId, nowIso, schema } from "../server/db/index.ts";
import { ownedByCurrentUser, ownerStamp } from "../server/studio.ts";

export default defineAction({
  description:
    "Créer ou modifier un kit de marque : palette, description de style, instructions permanentes, logo canonique.",
  schema: z.object({
    brandKitId: z.string().optional().describe("Kit à modifier ; absent = création"),
    name: z.string().min(1).describe("Nom du kit"),
    description: z.string().optional(),
    styleDescription: z
      .string()
      .optional()
      .describe("Traits concrets — éclairage, composition, texture — plutôt qu'adjectifs vagues"),
    customInstructions: z
      .string()
      .optional()
      .describe("Contraintes que l'agent applique à chaque génération avec ce kit"),
    palette: z.string().optional().describe("Couleurs séparées par des virgules"),
    canonicalLogoUrl: z.string().optional().describe("URL du logo, jamais le fichier"),
  }),
  run: async ({ brandKitId, ...fields }) => {
    const db = getDb();
    const timestamp = nowIso();

    if (brandKitId) {
      const [brandKit] = await db
        .update(schema.brandKits)
        .set({ ...fields, updatedAt: timestamp })
        .where(and(eq(schema.brandKits.id, brandKitId), ownedByCurrentUser(schema.brandKits)))
        .returning();
      if (!brandKit) throw new Error(`Kit de marque « ${brandKitId} » introuvable.`);
      return { brandKit, created: false };
    }

    const [brandKit] = await db
      .insert(schema.brandKits)
      .values({
        id: newId(),
        ...fields,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...ownerStamp(),
      })
      .returning();
    return { brandKit, created: true };
  },
});
