import { defineAction } from "@agent-native/core/action";
import { and, eq } from "@agent-native/core/db/schema";
import { z } from "zod";

import { nullableId } from "../shared/cli-compat.ts";

import {
  ASSET_CATEGORY_KEYS,
  ASSET_FORMAT_KEYS,
  assetCategoryByKey,
  assetFormatByKey,
} from "../shared/asset-taxonomy.ts";
import { getDb, newId, nowIso, schema } from "../server/db/index.ts";
import { ownedByCurrentUser, ownerStamp } from "../server/studio.ts";

export default defineAction({
  description:
    "Créer ou modifier un modèle de génération : ce qui fige la forme d'une sortie — catégorie, format, gabarit d'invite, politique de texte.",
  schema: z.object({
    templateId: z.string().optional().describe("Modèle à modifier ; absent = création"),
    name: z.string().min(1).describe("Nom du modèle"),
    description: z.string().optional(),
    category: z
      .string()
      .default("social")
      .describe(`Catégorie : ${ASSET_CATEGORY_KEYS.join(", ")}`),
    format: z.string().default("1:1").describe(`Format : ${ASSET_FORMAT_KEYS.join(", ")}`),
    promptTemplate: z
      .string()
      .optional()
      .describe("Gabarit d'invite ; {{prompt}} reçoit la demande de l'utilisateur"),
    textPolicy: z.string().optional().describe("Règle sur le texte incrusté"),
    referencePolicy: z.enum(["auto", "always", "never"]).optional(),
    brandKitId: nullableId("Kit de rattachement, ou null").optional(),
    model: z.string().optional().describe("Nom du modèle de génération"),
    imageSize: z.enum(["1K", "2K", "4K"]).optional(),
    composeCanonicalLogo: z.boolean().optional(),
    useSkeleton: z.boolean().optional(),
    skeletonUrl: z.string().optional(),
    sortOrder: z.number().int().optional(),
  }),
  run: async ({ templateId, category, format, ...fields }) => {
    if (!assetCategoryByKey(category)) {
      throw new Error(
        `Catégorie « ${category} » inconnue. Valides : ${ASSET_CATEGORY_KEYS.join(", ")}.`,
      );
    }
    if (!assetFormatByKey(format)) {
      throw new Error(`Format « ${format} » inconnu. Valides : ${ASSET_FORMAT_KEYS.join(", ")}.`);
    }

    const db = getDb();
    const timestamp = nowIso();

    if (templateId) {
      const [template] = await db
        .update(schema.assetTemplates)
        .set({ ...fields, category, format, updatedAt: timestamp })
        .where(
          and(
            eq(schema.assetTemplates.id, templateId),
            ownedByCurrentUser(schema.assetTemplates),
          ),
        )
        .returning();
      if (!template) throw new Error(`Modèle « ${templateId} » introuvable.`);
      return { template, created: false };
    }

    const [template] = await db
      .insert(schema.assetTemplates)
      .values({
        id: newId(),
        ...fields,
        category,
        format,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...ownerStamp(),
      })
      .returning();
    return { template, created: true };
  },
});
