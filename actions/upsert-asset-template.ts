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
    // Optionnels, pas `.default()` : un défaut zod est indiscernable d'une valeur fournie,
    // et sur le chemin de modification il écrasait. Renommer un modèle en 9:16 le
    // ramenait en « social · 1:1 » sans un mot. Le défaut vit dans `run`, à la création.
    category: z
      .string()
      .optional()
      .describe(`Catégorie : ${ASSET_CATEGORY_KEYS.join(", ")} (défaut : social)`),
    format: z
      .string()
      .optional()
      .describe(`Format : ${ASSET_FORMAT_KEYS.join(", ")} (défaut : 1:1)`),
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
    if (category !== undefined && !assetCategoryByKey(category)) {
      throw new Error(
        `Catégorie « ${category} » inconnue. Valides : ${ASSET_CATEGORY_KEYS.join(", ")}.`,
      );
    }
    if (format !== undefined && !assetFormatByKey(format)) {
      throw new Error(`Format « ${format} » inconnu. Valides : ${ASSET_FORMAT_KEYS.join(", ")}.`);
    }

    const db = getDb();
    const timestamp = nowIso();

    if (templateId) {
      // On n'écrit que ce que l'appelant a nommé : drizzle ignore `undefined`.
      const patch: Record<string, unknown> = { ...fields, updatedAt: timestamp };
      if (category !== undefined) patch.category = category;
      if (format !== undefined) patch.format = format;

      const [template] = await db
        .update(schema.assetTemplates)
        .set(patch)
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
        category: category ?? "social",
        format: format ?? "1:1",
        createdAt: timestamp,
        updatedAt: timestamp,
        ...ownerStamp(),
      })
      .returning();
    return { template, created: true };
  },
});
