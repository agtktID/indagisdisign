/**
 * Les ressources de départ livrées avec l'application.
 *
 * Même principe que `prompt-library.ts` : elles vivent dans le code. À l'installation,
 * l'utilisateur dispose déjà de quelque chose — il n'ouvre pas une bibliothèque vide.
 *
 * Elles sont en lecture seule. « Installer » en fait une copie dans sa propre
 * bibliothèque, qu'il peut ensuite modifier sans risquer de perdre l'original.
 */

export interface StarterTemplate {
  key: string;
  name: string;
  description: string;
  /** Clé de `ASSET_CATEGORIES`. */
  category: string;
  /** Clé de `ASSET_FORMATS`. */
  format: string;
  promptTemplate: string;
  textPolicy: string;
  imageSize: "1K" | "2K" | "4K";
  /** Ce à quoi ce modèle sert dans le travail réel, en une phrase. */
  useCase: string;
}

const NO_TEXT =
  "Pas de texte incrusté. Si un texte exact est demandé, cinq mots au plus, assez grands pour rester lisibles sur mobile.";

const SHORT_TEXT =
  "Texte incrusté accepté, mais court : un titre de six mots au plus, une seule ligne.";

export const STARTER_TEMPLATES: readonly StarterTemplate[] = [
  {
    key: "miniature-16-9",
    name: "Miniature de vidéo",
    description:
      "Visuel d'accroche large, sujet unique lisible en petit, espace réservé pour un titre ajouté ensuite.",
    category: "social",
    format: "16:9",
    promptTemplate:
      "Miniature pour {{prompt}}. Un seul sujet, lisible à la taille d'un pouce. Réserve un tiers de l'image pour un titre ajouté au montage. Pas de flèches ni de cercles.",
    textPolicy: NO_TEXT,
    imageSize: "2K",
    useCase: "L'image qui décide si on clique ou non.",
  },
  {
    key: "hero-large",
    name: "Bandeau d'ouverture",
    description:
      "Visuel très large pour ouvrir une vidéo ou une page, avec beaucoup d'espace négatif.",
    category: "hero",
    format: "21:9",
    promptTemplate:
      "Bandeau d'ouverture sur le thème {{prompt}}. Composition calme, ligne d'horizon basse, large espace vide à droite pour un titre. Un détail concret ancre la scène.",
    textPolicy: NO_TEXT,
    imageSize: "2K",
    useCase: "Poser le monde ordinaire, l'étape 1 du voyage.",
  },
  {
    key: "story-verticale",
    name: "Story verticale",
    description: "Format plein écran mobile, sujet centré, zones hautes et basses dégagées.",
    category: "social",
    format: "9:16",
    promptTemplate:
      "Visuel vertical plein écran sur {{prompt}}. Sujet centré dans le tiers médian. Laisse les zones haute et basse dégagées : l'interface des plateformes les recouvre.",
    textPolicy: SHORT_TEXT,
    imageSize: "2K",
    useCase: "Stories, shorts, reels — tout ce qui se regarde à la verticale.",
  },
  {
    key: "publication-carree",
    name: "Publication carrée",
    description: "Le format le plus polyvalent : profil, vignette, publication de flux.",
    category: "social",
    format: "1:1",
    promptTemplate:
      "Visuel carré sur {{prompt}}. Sujet fort et lisible à petite taille, composition centrée, sans détail dans les coins.",
    textPolicy: NO_TEXT,
    imageSize: "2K",
    useCase: "Le format qui marche partout quand on hésite.",
  },
  {
    key: "diagramme-explicatif",
    name: "Diagramme explicatif",
    description:
      "Schéma conceptuel à étiquettes courtes, épaisseurs de trait constantes, beaucoup de blanc.",
    category: "diagram",
    format: "16:9",
    promptTemplate:
      "Diagramme clair expliquant {{prompt}}. Étiquettes courtes, épaisseurs de trait constantes, beaucoup d'espace blanc. Aucune décoration qui n'explique rien.",
    textPolicy: SHORT_TEXT,
    imageSize: "2K",
    useCase: "Montrer une structure plutôt que la décrire.",
  },
  {
    key: "logo-carre",
    name: "Déclinaison de logo",
    description: "Marque isolée sur fond neutre, marges généreuses, aucune scène autour.",
    category: "logo",
    format: "1:1",
    promptTemplate:
      "Déclinaison de logo pour {{prompt}}. Forme isolée, fond neutre uni, marges généreuses. Aucune mise en scène, aucun reflet, aucune ombre portée marquée.",
    textPolicy: NO_TEXT,
    imageSize: "2K",
    useCase: "Une marque qui doit rester reconnaissable partout.",
  },
  {
    key: "fiche-produit",
    name: "Fiche produit",
    description: "Le produit détouré ou en situation simple, format portrait pour le mobile.",
    category: "product",
    format: "4:5",
    promptTemplate:
      "Visuel produit vertical pour {{prompt}}. Produit net et centré, arrière-plan simplifié, éclairage doux et directionnel. Rien ne doit distraire du produit.",
    textPolicy: NO_TEXT,
    imageSize: "2K",
    useCase: "Montrer un objet sans que le décor prenne toute la place.",
  },
  {
    key: "carton-cinema",
    name: "Carton cinéma",
    description: "Format large de projection, centre vide pour un titre de chapitre.",
    category: "image",
    format: "2.39:1",
    promptTemplate:
      "Carton de transition sur {{prompt}}. Fond sobre ou texture très discrète, grande zone vide au centre pour un titre ajouté au montage.",
    textPolicy: NO_TEXT,
    imageSize: "2K",
    useCase: "Séparer deux actes sans casser le rythme.",
  },
  {
    key: "planche-style",
    name: "Planche de style",
    description:
      "Références d'ambiance sans sujet : textures, lumière, palette. À marquer comme référence.",
    category: "style-only",
    format: "16:9",
    promptTemplate:
      "Planche de référence de style pour {{prompt}}. Textures, lumière et palette uniquement. Aucun personnage, aucun texte, aucun objet reconnaissable.",
    textPolicy: NO_TEXT,
    imageSize: "2K",
    useCase: "Fixer un rendu avant de générer quoi que ce soit d'autre.",
  },
  {
    key: "gabarit-squelette",
    name: "Gabarit à remplir",
    description:
      "Une composition de base sur laquelle les générations suivantes viennent se poser.",
    category: "skeleton",
    format: "16:9",
    promptTemplate:
      "Gabarit de composition pour {{prompt}}. Zones clairement délimitées, hiérarchie visuelle explicite, aucun contenu définitif — c'est une structure d'accueil.",
    textPolicy: NO_TEXT,
    imageSize: "2K",
    useCase: "Garder la même ossature d'un visuel à l'autre.",
  },
];

export function starterTemplateByKey(key: string): StarterTemplate | undefined {
  return STARTER_TEMPLATES.find((template) => template.key === key);
}
