/**
 * Ce que le catalogue a besoin de faire à l'exécution.
 *
 * Contrairement aux autres fichiers du dossier, **celui-ci est écrit à la main** :
 * `tools/prompt-catalog/build.mjs` ne le régénère pas et ne l'efface pas.
 *
 * Léger et sans dépendance : l'interface l'importe directement.
 */

/**
 * Les prompts du catalogue portent leurs variables sous la forme
 * `{argument name="hair color" default="blonde"}`, parfois avec les guillemets
 * échappés parce que le corps est du JSON.
 *
 * Remplir, c'est remplacer chaque occurrence par la valeur donnée ; à défaut par
 * la valeur par défaut d'origine, pour que le prompt reste utilisable tel quel.
 */
export function fillCatalogPrompt(body: string, values: Record<string, string>): string {
  return body.replace(
    /\{argument\s+name=\\?"([^"\\]+)\\?"(?:\s+default=\\?"([^"\\]*)\\?")?\}/g,
    (_match, key: string, fallback: string | undefined) => {
      const value = values[key.trim()]?.trim();
      return value || fallback || "";
    },
  );
}

/**
 * Les catégories du catalogue et celles de la bibliothèque de ressources ne sont
 * pas le même vocabulaire : le catalogue dit ce que le prompt produit, la
 * bibliothèque dit à quoi la ressource sert.
 *
 * Cette table dit dans quelle case de la bibliothèque ranger une copie. Quand
 * aucune case ne correspond vraiment, `other` — mieux vaut une case honnête
 * qu'un rangement inventé.
 */
export const CATALOG_TO_ASSET_CATEGORY: Record<string, string> = {
  "ui-interfaces": "other",
  "charts-infographics": "diagram",
  "posters-typography": "image",
  "products-e-commerce": "product",
  "brand-logos": "logo",
  "architecture-spaces": "image",
  "photography-realism": "image",
  "illustration-art": "image",
  "characters-people": "image",
  "scenes-storytelling": "image",
  "history-classical-themes": "image",
  "documents-publishing": "other",
  "other-use-cases": "other",
  "seedance-commercial": "video",
};

export function assetCategoryForCatalog(category: string): string {
  return CATALOG_TO_ASSET_CATEGORY[category] ?? "other";
}
