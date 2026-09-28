/**
 * Taxonomie de la bibliothèque de ressources.
 *
 * Contenu figé, comme `hero-journey.ts` : ce sont les cases dans lesquelles l'utilisateur
 * range son matériel, pas de la donnée utilisateur. La base ne stocke que les clés.
 *
 * Trois axes, volontairement distincts :
 * - le **type** dit ce que c'est (une vidéo, un son, un modèle…) ;
 * - la **catégorie** dit à quoi ça sert (une bannière, un logo, une campagne…) ;
 * - le **format** dit quelle forme ça a (carré, vertical, cinéma…).
 *
 * Un même fichier peut être une image (type) de logo (catégorie) en 1:1 (format).
 */

/** Ce que la ressource est. */
export interface AssetKind {
  key: string;
  label: string;
  /** Extensions ou exemples courants, à titre indicatif pour l'interface. */
  hint: string;
}

export const ASSET_KINDS: readonly AssetKind[] = [
  { key: "video", label: "Vidéo", hint: "mp4, mov, webm" },
  { key: "image", label: "Image", hint: "png, jpg, webp, svg" },
  { key: "audio", label: "Audio", hint: "wav, mp3, musique, voix" },
  { key: "template", label: "Modèle", hint: "composition réutilisable" },
  { key: "document", label: "Document", hint: "script, note, transcription" },
  { key: "font", label: "Typographie", hint: "police de caractères" },
  { key: "palette", label: "Palette", hint: "couleurs de marque" },
  { key: "other", label: "Autre", hint: "tout le reste" },
] as const;

/** À quoi la ressource sert. */
export interface AssetCategory {
  key: string;
  label: string;
  description: string;
}

export const ASSET_CATEGORIES: readonly AssetCategory[] = [
  {
    key: "hero",
    label: "Hero",
    description: "Le visuel d'ouverture, celui qu'on voit en premier.",
  },
  {
    key: "landing-page",
    label: "Page d'atterrissage",
    description: "Visuels destinés à une page de présentation.",
  },
  {
    key: "product",
    label: "Produit",
    description: "Le produit lui-même, en situation ou détouré.",
  },
  {
    key: "logo",
    label: "Logo",
    description: "Marque, signature, déclinaisons.",
  },
  {
    key: "diagram",
    label: "Diagramme",
    description: "Schéma, courbe, explication visuelle.",
  },
  {
    key: "video",
    label: "Vidéo",
    description: "Rushes, montages, exports.",
  },
  {
    key: "image",
    label: "Image",
    description: "Visuel sans destination particulière.",
  },
  {
    key: "social",
    label: "Réseaux sociaux",
    description: "Formats courts destinés aux plateformes.",
  },
  {
    key: "campaign",
    label: "Campagne",
    description: "Ensemble cohérent autour d'une sortie.",
  },
  {
    key: "style-only",
    label: "Style seul",
    description: "Référence d'ambiance : ni sujet, ni message, juste le rendu.",
  },
  {
    key: "skeleton",
    label: "Squelette",
    description: "Gabarit de composition, à remplir.",
  },
  {
    key: "other",
    label: "Autre",
    description: "Ce qui n'entre dans aucune autre case.",
  },
] as const;

/** Quelle forme la ressource a. */
export interface AssetFormat {
  key: string;
  label: string;
  /** Largeur divisée par hauteur : sert au tri et à dessiner un aperçu à l'échelle. */
  ratio: number;
  orientation: "square" | "portrait" | "landscape";
  /** Usage typique, pour guider sans imposer. */
  usage: string;
}

/**
 * Les formats, du plus vertical au plus large.
 *
 * `ratio` est posé explicitement plutôt que dérivé du libellé : les formats cinéma
 * (1,85:1 · 2,35:1 · 2,39:1) ne sont pas des fractions d'entiers.
 */
export const ASSET_FORMATS: readonly AssetFormat[] = [
  { key: "9:21", label: "9:21", ratio: 9 / 21, orientation: "portrait", usage: "vertical extrême" },
  { key: "9:16", label: "9:16", ratio: 9 / 16, orientation: "portrait", usage: "story, short, reel" },
  { key: "2:3", label: "2:3", ratio: 2 / 3, orientation: "portrait", usage: "affiche, photo verticale" },
  { key: "3:4", label: "3:4", ratio: 3 / 4, orientation: "portrait", usage: "portrait classique" },
  { key: "4:5", label: "4:5", ratio: 4 / 5, orientation: "portrait", usage: "publication verticale" },
  { key: "1:1", label: "1:1", ratio: 1, orientation: "square", usage: "carré, vignette, avatar" },
  { key: "5:4", label: "5:4", ratio: 5 / 4, orientation: "landscape", usage: "paysage légèrement large" },
  { key: "4:3", label: "4:3", ratio: 4 / 3, orientation: "landscape", usage: "diapositive, télévision d'époque" },
  { key: "3:2", label: "3:2", ratio: 3 / 2, orientation: "landscape", usage: "photo argentique" },
  { key: "16:10", label: "16:10", ratio: 16 / 10, orientation: "landscape", usage: "écran d'ordinateur" },
  { key: "16:9", label: "16:9", ratio: 16 / 9, orientation: "landscape", usage: "vidéo standard, bannière" },
  { key: "1.85:1", label: "1,85:1", ratio: 1.85, orientation: "landscape", usage: "cinéma, projection large" },
  { key: "2:1", label: "2:1", ratio: 2, orientation: "landscape", usage: "bandeau, couverture" },
  { key: "2.35:1", label: "2,35:1", ratio: 2.35, orientation: "landscape", usage: "cinémascope" },
  { key: "2.39:1", label: "2,39:1", ratio: 2.39, orientation: "landscape", usage: "scope moderne" },
  { key: "21:9", label: "21:9", ratio: 21 / 9, orientation: "landscape", usage: "ultra-large" },
] as const;

export function assetKindByKey(key: string): AssetKind | undefined {
  return ASSET_KINDS.find((kind) => kind.key === key);
}

export function assetCategoryByKey(key: string): AssetCategory | undefined {
  return ASSET_CATEGORIES.find((category) => category.key === key);
}

export function assetFormatByKey(key: string): AssetFormat | undefined {
  return ASSET_FORMATS.find((format) => format.key === key);
}

export const ASSET_KIND_KEYS = ASSET_KINDS.map((kind) => kind.key);
export const ASSET_CATEGORY_KEYS = ASSET_CATEGORIES.map((category) => category.key);
export const ASSET_FORMAT_KEYS = ASSET_FORMATS.map((format) => format.key);
