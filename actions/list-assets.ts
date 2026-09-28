import { defineAction } from "@agent-native/core/action";
import { and, eq } from "@agent-native/core/db/schema";
import { desc } from "drizzle-orm";
import { z } from "zod";

import {
  ASSET_CATEGORIES,
  ASSET_FORMATS,
  ASSET_KINDS,
  assetCategoryByKey,
  assetFormatByKey,
  assetKindByKey,
} from "../shared/asset-taxonomy.ts";
import { getDb, schema } from "../server/db/index.ts";
import { ownedByCurrentUser } from "../server/studio.ts";

export default defineAction({
  description:
    "Lister la bibliothèque de ressources : vidéos, images, sons, modèles, documents. Filtrable par état (brouillon / générée / référence), par type, par catégorie, par format, par kit de marque ou par vidéo. Renvoie aussi les compteurs par onglet et la taxonomie complète.",
  schema: z.object({
    status: z
      .enum(["draft", "generated", "reference"])
      .optional()
      .describe("Onglet de la bibliothèque"),
    kind: z.string().optional().describe("Type : video, image, audio, template…"),
    category: z.string().optional().describe("Catégorie : hero, logo, social…"),
    format: z.string().optional().describe("Format : 1:1, 16:9, 9:16…"),
    brandKitId: z.string().optional().describe("Kit de marque de rattachement"),
    videoId: z.string().optional().describe("Vidéo Studio de rattachement"),
    search: z.string().optional().describe("Recherche sur le nom et les mots-clés"),
  }),
  http: { method: "GET" },
  run: async ({ status, kind, category, format, brandKitId, videoId, search }) => {
    const conditions = [ownedByCurrentUser(schema.assets)];
    if (status) conditions.push(eq(schema.assets.status, status));
    if (kind) conditions.push(eq(schema.assets.kind, kind));
    if (category) conditions.push(eq(schema.assets.category, category));
    if (format) conditions.push(eq(schema.assets.format, format));
    if (brandKitId) conditions.push(eq(schema.assets.brandKitId, brandKitId));
    if (videoId) conditions.push(eq(schema.assets.videoId, videoId));

    const rows = await getDb()
      .select()
      .from(schema.assets)
      .where(and(...conditions))
      .orderBy(desc(schema.assets.updatedAt));

    // La recherche texte se fait ici plutôt qu'en SQL : le volume d'une bibliothèque
    // personnelle le permet, et ça évite une dépendance à la recherche plein texte.
    const needle = search?.trim().toLowerCase();
    const filtered = needle
      ? rows.filter((asset) =>
          `${asset.name} ${asset.tags ?? ""} ${asset.description ?? ""}`
            .toLowerCase()
            .includes(needle),
        )
      : rows;

    const all = await getDb()
      .select({ status: schema.assets.status })
      .from(schema.assets)
      .where(ownedByCurrentUser(schema.assets));

    return {
      assets: filtered.map((asset) => ({
        ...asset,
        kindLabel: assetKindByKey(asset.kind)?.label ?? asset.kind,
        categoryLabel: assetCategoryByKey(asset.category)?.label ?? asset.category,
        formatLabel: asset.format ? (assetFormatByKey(asset.format)?.label ?? asset.format) : null,
        ratio: asset.format ? (assetFormatByKey(asset.format)?.ratio ?? null) : null,
      })),
      shown: filtered.length,
      counts: {
        draft: all.filter((row) => row.status === "draft").length,
        generated: all.filter((row) => row.status === "generated").length,
        reference: all.filter((row) => row.status === "reference").length,
        total: all.length,
      },
      taxonomy: { kinds: ASSET_KINDS, categories: ASSET_CATEGORIES, formats: ASSET_FORMATS },
    };
  },
});
