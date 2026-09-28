import { defineAction } from "@agent-native/core/action";
import { and, eq } from "@agent-native/core/db/schema";
import { asc } from "drizzle-orm";
import { z } from "zod";

import { BUILT_IN_PROMPTS, PROMPT_KINDS } from "../shared/prompt-library.ts";
import {
  CATALOG_CATEGORIES,
  CATALOG_PROMPTS,
  CATALOG_SCENES,
  CATALOG_STYLES,
  type CatalogPrompt,
} from "../shared/prompt-catalog/index.ts";
import { getDb, schema } from "../server/db/index.ts";
import { ownedByCurrentUser } from "../server/studio.ts";

/** Une page de catalogue : assez pour remplir l'écran, pas assez pour le noyer. */
const DEFAULT_LIMIT = 24;

/** Tout ce sur quoi une recherche porte, mis bout à bout une seule fois. */
function haystack(prompt: CatalogPrompt): string {
  return [
    prompt.name,
    prompt.originalName,
    prompt.category,
    prompt.styles.join(" "),
    prompt.scenes.join(" "),
    prompt.body,
  ]
    .join(" ")
    .toLowerCase();
}

/** Les compteurs d'un axe, recalculés sur l'ensemble déjà filtré par les autres. */
function facetsFor(
  prompts: readonly CatalogPrompt[],
  axis: readonly { key: string; label: string }[],
  belongs: (prompt: CatalogPrompt, key: string) => boolean,
) {
  return axis
    .map(({ key, label }) => ({
      key,
      label,
      count: prompts.filter((prompt) => belongs(prompt, key)).length,
    }))
    .filter((facet) => facet.count > 0);
}

export default defineAction({
  description:
    "Lister les prompts réutilisables. Trois sources : le catalogue de 550 prompts livré avec l'application, les prompts du voyage du héros, et ceux de l'utilisateur. Le catalogue se trie sur trois axes — catégorie, style, scène — et se pagine.",
  schema: z.object({
    kind: z.enum(["image", "video"]).optional().describe("Ne garder qu'un axe de production"),
    source: z
      .enum(["all", "catalog", "hero", "mine"])
      .optional()
      .describe("Quelle source interroger ; all par défaut"),
    category: z
      .string()
      .optional()
      .describe(`Catégorie du catalogue : ${CATALOG_CATEGORIES.map((c) => c.key).join(", ")}`),
    style: z
      .string()
      .optional()
      .describe(`Style : ${CATALOG_STYLES.map((s) => s.key).join(", ")}`),
    scene: z
      .string()
      .optional()
      .describe(`Scène : ${CATALOG_SCENES.map((s) => s.key).join(", ")}`),
    search: z.string().optional().describe("Recherche sur le titre, les mots-clés et le corps"),
    limit: z.coerce.number().int().min(1).max(200).optional().describe("Taille de page du catalogue"),
    offset: z.coerce.number().int().min(0).optional().describe("Décalage dans le catalogue"),
  }),
  http: { method: "GET" },
  run: async ({ kind, source = "all", category, style, scene, search, limit, offset }) => {
    const needle = search?.trim().toLowerCase();
    const matches = (text: string) => !needle || text.toLowerCase().includes(needle);

    /* --- Le catalogue ----------------------------------------------------- */

    const wantsCatalog = source === "all" || source === "catalog";
    const byKind = CATALOG_PROMPTS.filter((prompt) => !kind || prompt.kind === kind);

    const filtered = byKind.filter(
      (prompt) =>
        (!category || prompt.category === category) &&
        (!style || prompt.styles.includes(style)) &&
        (!scene || prompt.scenes.includes(scene)) &&
        (!needle || haystack(prompt).includes(needle)),
    );

    const start = offset ?? 0;
    const size = limit ?? DEFAULT_LIMIT;
    const page = wantsCatalog ? filtered.slice(start, start + size) : [];

    /* --- Les facettes, comptées sur ce que les autres filtres laissent ----- */

    const withoutCategory = byKind.filter(
      (prompt) =>
        (!style || prompt.styles.includes(style)) &&
        (!scene || prompt.scenes.includes(scene)) &&
        (!needle || haystack(prompt).includes(needle)),
    );
    const withoutStyle = byKind.filter(
      (prompt) =>
        (!category || prompt.category === category) &&
        (!scene || prompt.scenes.includes(scene)) &&
        (!needle || haystack(prompt).includes(needle)),
    );
    const withoutScene = byKind.filter(
      (prompt) =>
        (!category || prompt.category === category) &&
        (!style || prompt.styles.includes(style)) &&
        (!needle || haystack(prompt).includes(needle)),
    );

    /* --- Le voyage du héros et les prompts de l'utilisateur ---------------- */

    const hero =
      source === "all" || source === "hero"
        ? BUILT_IN_PROMPTS.filter(
            (prompt) =>
              (!kind || prompt.kind === kind) &&
              matches(`${prompt.name} ${prompt.description} ${prompt.tags.join(" ")} ${prompt.body}`),
          )
        : [];

    let mine: (typeof schema.prompts.$inferSelect)[] = [];
    if (source === "all" || source === "mine") {
      const conditions = [ownedByCurrentUser(schema.prompts)];
      if (kind) conditions.push(eq(schema.prompts.kind, kind));
      const rows = await getDb()
        .select()
        .from(schema.prompts)
        .where(and(...conditions))
        .orderBy(asc(schema.prompts.name));
      mine = rows.filter((prompt) =>
        matches(`${prompt.name} ${prompt.description ?? ""} ${prompt.tags ?? ""} ${prompt.body}`),
      );
    }

    return {
      source,
      catalog: page,
      catalogTotal: filtered.length,
      offset: start,
      limit: size,
      hasMore: start + page.length < filtered.length,
      // Le compte de « Tous » n'est pas la somme des facettes : un prompt porte
      // plusieurs styles et plusieurs scènes, les additionner le compterait deux fois.
      facetTotals: {
        categories: withoutCategory.length,
        styles: withoutStyle.length,
        scenes: withoutScene.length,
      },
      facets: {
        categories: facetsFor(
          withoutCategory,
          CATALOG_CATEGORIES,
          (prompt, key) => prompt.category === key,
        ),
        styles: facetsFor(withoutStyle, CATALOG_STYLES, (prompt, key) =>
          prompt.styles.includes(key),
        ),
        scenes: facetsFor(withoutScene, CATALOG_SCENES, (prompt, key) =>
          prompt.scenes.includes(key),
        ),
      },
      // `builtIn` est conservé sous son ancien nom : les prompts du voyage du héros.
      builtIn: hero,
      mine,
      kinds: PROMPT_KINDS,
      counts: {
        image: CATALOG_PROMPTS.filter((prompt) => prompt.kind === "image").length,
        video: CATALOG_PROMPTS.filter((prompt) => prompt.kind === "video").length,
        catalog: CATALOG_PROMPTS.length,
        hero: BUILT_IN_PROMPTS.filter((prompt) => !kind || prompt.kind === kind).length,
        mine: mine.length,
      },
    };
  },
});
