/**
 * Fichier généré — ne pas modifier à la main.
 *
 * Source : les fichiers markdown de la bibliothèque de prompts de l'utilisateur,
 * eux-mêmes tirés de dépôts publics sous licence MIT :
 * - images : https://github.com/freestylefly/awesome-gpt-image-2
 * - vidéo  : https://github.com/ZeroLu/awesome-seedance
 *
 * Les corps de prompt sont recopiés tels quels. Seuls les titres ont été traduits
 * en français, pour que la bibliothèque soit navigable.
 */

import type { CatalogPrompt } from "./types.ts";
import { CATALOG_UIINTERFACES } from "./data/ui-interfaces.ts";
import { CATALOG_CHARTSINFOGRAPHICS } from "./data/charts-infographics.ts";
import { CATALOG_POSTERSTYPOGRAPHY } from "./data/posters-typography.ts";
import { CATALOG_PRODUCTSECOMMERCE } from "./data/products-e-commerce.ts";
import { CATALOG_BRANDLOGOS } from "./data/brand-logos.ts";
import { CATALOG_ARCHITECTURESPACES } from "./data/architecture-spaces.ts";
import { CATALOG_PHOTOGRAPHYREALISM } from "./data/photography-realism.ts";
import { CATALOG_ILLUSTRATIONART } from "./data/illustration-art.ts";
import { CATALOG_CHARACTERSPEOPLE } from "./data/characters-people.ts";
import { CATALOG_SCENESSTORYTELLING } from "./data/scenes-storytelling.ts";
import { CATALOG_HISTORYCLASSICALTHEMES } from "./data/history-classical-themes.ts";
import { CATALOG_DOCUMENTSPUBLISHING } from "./data/documents-publishing.ts";
import { CATALOG_OTHERUSECASES } from "./data/other-use-cases.ts";
import { CATALOG_SEEDANCECOMMERCIAL } from "./data/seedance-commercial.ts";

export * from "./types.ts";

/**
 * Les 550 prompts du catalogue.
 *
 * N'importer ce module que depuis une action : il pèse 665 Ko de texte, et
 * l'interface n'en a jamais besoin en entier.
 */
export const CATALOG_PROMPTS: readonly CatalogPrompt[] = [
  ...CATALOG_UIINTERFACES,
  ...CATALOG_CHARTSINFOGRAPHICS,
  ...CATALOG_POSTERSTYPOGRAPHY,
  ...CATALOG_PRODUCTSECOMMERCE,
  ...CATALOG_BRANDLOGOS,
  ...CATALOG_ARCHITECTURESPACES,
  ...CATALOG_PHOTOGRAPHYREALISM,
  ...CATALOG_ILLUSTRATIONART,
  ...CATALOG_CHARACTERSPEOPLE,
  ...CATALOG_SCENESSTORYTELLING,
  ...CATALOG_HISTORYCLASSICALTHEMES,
  ...CATALOG_DOCUMENTSPUBLISHING,
  ...CATALOG_OTHERUSECASES,
  ...CATALOG_SEEDANCECOMMERCIAL,
];

const byKey = new Map(CATALOG_PROMPTS.map((prompt) => [prompt.key, prompt]));

export function catalogPromptByKey(key: string): CatalogPrompt | undefined {
  return byKey.get(key);
}
