/**
 * Les trois axes de tri du catalogue de prompts, repris du site qui a inspiré
 * l'écran : catégorie (à quoi ça sert), style (le rendu), scène (le domaine).
 *
 * Ce module est volontairement léger : c'est le seul du catalogue que
 * l'interface importe. Les 550 prompts eux-mêmes ne transitent que par
 * l'action `list-prompts`, pour ne pas alourdir le navigateur.
 */

/** Une variable repérée dans le corps du prompt, sous la forme `{argument name="x"}`. */
export interface CatalogVariable {
  key: string;
  default: string;
}

export interface CatalogPrompt {
  key: string;
  kind: "image" | "video";
  category: string;
  /** Le titre traduit en français. */
  name: string;
  /** Le titre d'origine, conservé pour retrouver le prompt dans la source. */
  originalName: string;
  styles: readonly string[];
  scenes: readonly string[];
  /** La langue du corps : il n'est pas traduit, les modèles le comprennent tel quel. */
  language: "zh" | "en" | "mixed";
  /** Un rapport d'image mentionné dans le corps, quand il y en a un. */
  format: string | null;
  source: string | null;
  variables: readonly CatalogVariable[];
  body: string;
  /** Notes de méthode, présentes sur les cas vidéo. */
  notes?: string;
}

export interface CatalogFacet {
  key: string;
  label: string;
  count: number;
}

export const CATALOG_CATEGORIES: readonly CatalogFacet[] = [
  { key: "ui-interfaces", label: "Interfaces", count: 73 },
  { key: "charts-infographics", label: "Graphiques et infographies", count: 53 },
  { key: "posters-typography", label: "Affiches et typographie", count: 90 },
  { key: "products-e-commerce", label: "Produits et commerce", count: 42 },
  { key: "brand-logos", label: "Marque et logos", count: 27 },
  { key: "architecture-spaces", label: "Architecture et lieux", count: 12 },
  { key: "photography-realism", label: "Photographie et réalisme", count: 78 },
  { key: "illustration-art", label: "Illustration et art", count: 59 },
  { key: "characters-people", label: "Personnages", count: 31 },
  { key: "scenes-storytelling", label: "Scènes et narration", count: 21 },
  { key: "history-classical-themes", label: "Histoire et thèmes classiques", count: 16 },
  { key: "documents-publishing", label: "Documents et édition", count: 11 },
  { key: "other-use-cases", label: "Autres usages", count: 28 },
  { key: "seedance-commercial", label: "Usages commerciaux", count: 9 },
];

export const CATALOG_STYLES: readonly CatalogFacet[] = [
  { key: "3D", label: "3D", count: 40 },
  { key: "Architecture", label: "Architecture", count: 4 },
  { key: "Brand", label: "Marque", count: 86 },
  { key: "Character", label: "Personnage", count: 113 },
  { key: "Characters", label: "Personnages", count: 2 },
  { key: "Charts", label: "Graphiques", count: 3 },
  { key: "Classical", label: "Classique", count: 14 },
  { key: "Documents", label: "Documents", count: 4 },
  { key: "History", label: "Histoire", count: 7 },
  { key: "Illustration", label: "Illustration", count: 103 },
  { key: "Infographic", label: "Infographie", count: 74 },
  { key: "Other Use Cases", label: "Autres usages", count: 9 },
  { key: "Photography", label: "Photographie", count: 3 },
  { key: "Poster", label: "Affiche", count: 199 },
  { key: "Product", label: "Produit", count: 56 },
  { key: "Products", label: "Produits", count: 5 },
  { key: "Realistic", label: "Réaliste", count: 217 },
  { key: "Scenes", label: "Scènes", count: 2 },
  { key: "UI", label: "Interface", count: 250 },
];

export const CATALOG_SCENES: readonly CatalogFacet[] = [
  { key: "Creative", label: "Création", count: 52 },
  { key: "Tech", label: "Technologie", count: 404 },
  { key: "Commerce", label: "Commerce", count: 382 },
  { key: "Education", label: "Éducation", count: 42 },
  { key: "Social", label: "Réseaux sociaux", count: 87 },
  { key: "Fashion", label: "Mode", count: 122 },
  { key: "Food", label: "Cuisine", count: 42 },
  { key: "Travel", label: "Voyage", count: 48 },
  { key: "Story", label: "Récit", count: 65 },
  { key: "History", label: "Histoire", count: 12 },
];

export const CATALOG_LANGUAGES: Record<CatalogPrompt["language"], string> = {
  zh: "chinois",
  en: "anglais",
  mixed: "mixte",
};

/** Combien de prompts le catalogue contient, par axe de production. */
export const CATALOG_COUNTS = {
  total: 550,
  image: 541,
  video: 9,
} as const;
