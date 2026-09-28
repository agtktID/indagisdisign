import { defineAction } from "@agent-native/core/action";
import { and, eq } from "@agent-native/core/db/schema";
import { asc } from "drizzle-orm";
import { z } from "zod";

import {
  assetCategoryByKey,
  assetFormatByKey,
  ASSET_CATEGORIES,
  ASSET_FORMATS,
} from "../shared/asset-taxonomy.ts";
import { getDb, schema } from "../server/db/index.ts";
import { ownedByCurrentUser } from "../server/studio.ts";

export default defineAction({
  description:
    "Lister les modèles de génération, avec leur catégorie et leur format résolus. Renvoie aussi la taxonomie complète, pour que l'interface et l'agent proposent les mêmes choix.",
  schema: z.object({
    brandKitId: z
      .string()
      .optional()
      .describe("Ne garder que les modèles de ce kit ; absent = tous"),
    category: z.string().optional().describe("Filtrer sur une catégorie"),
  }),
  http: { method: "GET" },
  run: async ({ brandKitId, category }) => {
    const conditions = [ownedByCurrentUser(schema.assetTemplates)];
    if (brandKitId) conditions.push(eq(schema.assetTemplates.brandKitId, brandKitId));
    if (category) conditions.push(eq(schema.assetTemplates.category, category));

    const rows = await getDb()
      .select()
      .from(schema.assetTemplates)
      .where(and(...conditions))
      .orderBy(asc(schema.assetTemplates.sortOrder), asc(schema.assetTemplates.name));

    return {
      templates: rows.map((template) => ({
        ...template,
        categoryLabel: assetCategoryByKey(template.category)?.label ?? template.category,
        formatLabel: assetFormatByKey(template.format)?.label ?? template.format,
      })),
      taxonomy: { categories: ASSET_CATEGORIES, formats: ASSET_FORMATS },
    };
  },
});
