import { defineAction } from "@agent-native/core/action";
import { and, eq } from "@agent-native/core/db/schema";
import { z } from "zod";

import { nullableId } from "../shared/cli-compat.ts";
import { ASSET_CATEGORY_KEYS, assetCategoryByKey } from "../shared/asset-taxonomy.ts";
import { builtInPromptByKey } from "../shared/prompt-library.ts";
import { catalogPromptByKey } from "../shared/prompt-catalog/index.ts";
import { assetCategoryForCatalog } from "../shared/prompt-catalog/fill.ts";
import { getDb, newId, nowIso, schema } from "../server/db/index.ts";
import { ownedByCurrentUser, ownerStamp } from "../server/studio.ts";

export default defineAction({
  description:
    "Créer ou modifier un prompt réutilisable. Pour partir d'un prompt livré avec l'application, passer sa clé dans fromBuiltIn (voyage du héros) ou fromCatalog (les 550 du catalogue) : il en est fait une copie modifiable, l'original reste intact.",
  schema: z.object({
    promptId: z.string().optional().describe("Prompt à modifier ; absent = création"),
    fromBuiltIn: z
      .string()
      .optional()
      .describe("Clé d'un prompt du voyage du héros à copier ; les autres champs deviennent optionnels"),
    fromCatalog: z
      .string()
      .optional()
      .describe("Clé d'un prompt du catalogue à copier, par exemple img-11 ou vid-seedance-2"),
    name: z.string().optional(),
    description: z.string().optional(),
    kind: z.enum(["image", "video"]).optional(),
    category: z.string().optional().describe(`Catégorie : ${ASSET_CATEGORY_KEYS.join(", ")}`),
    format: nullableId("Format conseillé").optional(),
    body: z.string().optional().describe("Le corps du prompt, avec ses {{variables}}"),
    tags: z.string().optional().describe("Mots-clés séparés par des virgules"),
  }),
  run: async ({ promptId, fromBuiltIn, fromCatalog, ...fields }) => {
    if (fromBuiltIn && fromCatalog) {
      throw new Error("Copier depuis une seule source à la fois : fromBuiltIn ou fromCatalog.");
    }

    const source = fromBuiltIn ? builtInPromptByKey(fromBuiltIn) : undefined;
    if (fromBuiltIn && !source) {
      throw new Error(`Prompt intégré « ${fromBuiltIn} » inconnu.`);
    }

    const fromCat = fromCatalog ? catalogPromptByKey(fromCatalog) : undefined;
    if (fromCatalog && !fromCat) {
      throw new Error(`Prompt de catalogue « ${fromCatalog} » inconnu.`);
    }

    // Le catalogue n'a pas de description rédigée : on décrit ce qu'on sait de lui.
    const catalogDescription = fromCat
      ? [fromCat.originalName, [...fromCat.styles, ...fromCat.scenes].join(", ")]
          .filter(Boolean)
          .join(" — ")
      : undefined;

    const resolved = {
      name: fields.name ?? source?.name ?? fromCat?.name,
      description: fields.description ?? source?.description ?? catalogDescription ?? null,
      kind: fields.kind ?? source?.kind ?? fromCat?.kind ?? "image",
      category:
        fields.category ??
        source?.category ??
        (fromCat ? assetCategoryForCatalog(fromCat.category) : undefined) ??
        "other",
      format: fields.format ?? source?.format ?? fromCat?.format ?? null,
      body: fields.body ?? source?.body ?? fromCat?.body,
      tags:
        fields.tags ??
        source?.tags.join(", ") ??
        (fromCat ? [...fromCat.styles, ...fromCat.scenes].join(", ") || null : null),
    };

    if (!resolved.name) throw new Error("Un nom est requis.");
    if (!resolved.body) throw new Error("Le corps du prompt est requis.");
    if (!assetCategoryByKey(resolved.category)) {
      throw new Error(
        `Catégorie « ${resolved.category} » inconnue. Valides : ${ASSET_CATEGORY_KEYS.join(", ")}.`,
      );
    }

    const db = getDb();
    const timestamp = nowIso();

    if (promptId) {
      const [prompt] = await db
        .update(schema.prompts)
        .set({ ...resolved, name: resolved.name, body: resolved.body, updatedAt: timestamp })
        .where(and(eq(schema.prompts.id, promptId), ownedByCurrentUser(schema.prompts)))
        .returning();
      if (!prompt) throw new Error(`Prompt « ${promptId} » introuvable.`);
      return { prompt, created: false };
    }

    const [prompt] = await db
      .insert(schema.prompts)
      .values({
        id: newId(),
        ...resolved,
        name: resolved.name,
        body: resolved.body,
        sourceKey: fromBuiltIn ?? fromCatalog ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...ownerStamp(),
      })
      .returning();

    return { prompt, created: true, copiedFrom: fromBuiltIn ?? fromCatalog ?? null };
  },
});
