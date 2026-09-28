import { defineAction } from "@agent-native/core/action";
import { and, eq } from "@agent-native/core/db/schema";
import { z } from "zod";

import { nullableId } from "../shared/cli-compat.ts";

import {
  ASSET_CATEGORY_KEYS,
  ASSET_FORMAT_KEYS,
  ASSET_KIND_KEYS,
  assetCategoryByKey,
  assetFormatByKey,
  assetKindByKey,
} from "../shared/asset-taxonomy.ts";
import { getDb, newId, nowIso, schema } from "../server/db/index.ts";
import { ownedByCurrentUser, ownerStamp } from "../server/studio.ts";

export default defineAction({
  description:
    "Ajouter ou modifier une ressource dans la bibliothèque : vidéo, image, son, modèle, document. Seule l'URL est enregistrée — jamais le fichier lui-même.",
  schema: z.object({
    assetId: z.string().optional().describe("Ressource à modifier ; absent = création"),
    name: z.string().min(1).describe("Nom de la ressource"),
    description: z.string().optional(),
    kind: z.string().default("image").describe(`Type : ${ASSET_KIND_KEYS.join(", ")}`),
    category: z
      .string()
      .default("other")
      .describe(`Catégorie : ${ASSET_CATEGORY_KEYS.join(", ")}`),
    format: nullableId(
      `Format : ${ASSET_FORMAT_KEYS.join(", ")} — nul pour l'audio et les documents`,
    ).optional(),
    status: z
      .enum(["draft", "generated", "reference"])
      .optional()
      .describe("brouillon, générée, ou référence"),
    url: z.string().optional().describe("URL du fichier, jamais le fichier"),
    thumbnailUrl: z.string().optional(),
    tags: z.string().optional().describe("Mots-clés séparés par des virgules"),
    brandKitId: nullableId("Kit de marque de rattachement").optional(),
    templateId: nullableId("Modèle ayant produit la ressource").optional(),
    videoId: nullableId("Vidéo Studio de rattachement").optional(),
    prompt: z.string().optional().describe("Invite ayant servi à la génération"),
  }),
  run: async ({ assetId, kind, category, format, ...fields }) => {
    if (!assetKindByKey(kind)) {
      throw new Error(`Type « ${kind} » inconnu. Valides : ${ASSET_KIND_KEYS.join(", ")}.`);
    }
    if (!assetCategoryByKey(category)) {
      throw new Error(
        `Catégorie « ${category} » inconnue. Valides : ${ASSET_CATEGORY_KEYS.join(", ")}.`,
      );
    }
    if (format && !assetFormatByKey(format)) {
      throw new Error(`Format « ${format} » inconnu. Valides : ${ASSET_FORMAT_KEYS.join(", ")}.`);
    }

    const db = getDb();
    const timestamp = nowIso();

    if (assetId) {
      const [asset] = await db
        .update(schema.assets)
        .set({ ...fields, kind, category, format: format ?? null, updatedAt: timestamp })
        .where(and(eq(schema.assets.id, assetId), ownedByCurrentUser(schema.assets)))
        .returning();
      if (!asset) throw new Error(`Ressource « ${assetId} » introuvable.`);
      return { asset, created: false };
    }

    const [asset] = await db
      .insert(schema.assets)
      .values({
        id: newId(),
        ...fields,
        kind,
        category,
        format: format ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...ownerStamp(),
      })
      .returning();
    return { asset, created: true };
  },
});
