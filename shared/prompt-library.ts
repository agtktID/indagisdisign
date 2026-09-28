/**
 * La bibliothèque de prompts livrée avec l'application.
 *
 * Ces prompts vivent dans le code, pas en base. Trois raisons :
 * - l'utilisateur en dispose dès l'installation, sans étape de remplissage ;
 * - une mise à jour de l'application met à jour les prompts ;
 * - ils ne peuvent pas être abîmés par accident — on les copie pour les modifier.
 *
 * Ce sont des points de départ, pas des recettes. Chacun est écrit pour le travail que
 * fait cette application : structurer et illustrer un récit vidéo.
 */

/** Une variable à remplacer dans le corps du prompt. */
export interface PromptVariable {
  key: string;
  label: string;
  hint: string;
}

export interface PromptTemplate {
  key: string;
  name: string;
  /** Ce que le prompt produit : une image fixe, ou une vidéo animée. */
  kind: "image" | "video";
  /** Clé de `ASSET_CATEGORIES` — à quoi la sortie sert. */
  category: string;
  /** Clé de `ASSET_FORMATS` — la forme conseillée. */
  format: string;
  description: string;
  /** Le corps du prompt. Les `{{variables}}` sont remplacées avant envoi. */
  body: string;
  variables: readonly PromptVariable[];
  tags: readonly string[];
}

const VIDEO_TITLE: PromptVariable = {
  key: "titre",
  label: "Titre de la vidéo",
  hint: "Le sujet, en une ligne",
};

const AUDIENCE: PromptVariable = {
  key: "public",
  label: "Public visé",
  hint: "À qui ça s'adresse, en quelques mots",
};

const MOOD: PromptVariable = {
  key: "ambiance",
  label: "Ambiance",
  hint: "Lumière, couleurs, sensation recherchée",
};

/* ------------------------------------------------------------------------- */
/* Prompts image                                                              */
/* ------------------------------------------------------------------------- */

const IMAGE_PROMPTS: readonly PromptTemplate[] = [
  {
    key: "miniature-question",
    name: "Miniature — la question ouverte",
    kind: "image",
    category: "social",
    format: "16:9",
    description:
      "Une miniature qui pose la question du récit au lieu d'en donner la réponse. C'est l'appel à l'aventure, en une image.",
    body: `Miniature pour une vidéo intitulée « {{titre}} », destinée à {{public}}.

Un seul sujet, lisible à la taille d'un pouce. Le regard ou le geste du sujet doit
suggérer une question sans la résoudre — on doit vouloir savoir la suite.

Ambiance : {{ambiance}}.

Laisse un tiers de l'image respirer pour un titre court ajouté ensuite. Pas de texte
incrusté. Pas de flèches ni de cercles rouges.`,
    variables: [VIDEO_TITLE, AUDIENCE, MOOD],
    tags: ["miniature", "accroche", "étape 2"],
  },
  {
    key: "hero-monde-ordinaire",
    name: "Hero — le monde ordinaire",
    kind: "image",
    category: "hero",
    format: "21:9",
    description:
      "Le visuel d'ouverture : la situation avant que tout change. C'est le repère qui permettra plus tard de mesurer le chemin parcouru.",
    body: `Visuel d'ouverture large pour « {{titre}} ».

Montre la situation de départ : un quotidien, une habitude, un manque. Rien de
spectaculaire — c'est le repère auquel le spectateur reviendra à la fin.

Ambiance : {{ambiance}}.

Composition calme, ligne d'horizon basse, beaucoup d'espace négatif à droite pour un
titre. Un détail concret doit ancrer la scène.`,
    variables: [VIDEO_TITLE, MOOD],
    tags: ["hero", "étape 1", "ouverture"],
  },
  {
    key: "diagramme-courbe",
    name: "Diagramme — la courbe émotionnelle",
    kind: "image",
    category: "diagram",
    format: "16:9",
    description:
      "La courbe d'intensité du récit, lisible d'un coup d'œil : montée vers le climax, respiration, relance.",
    body: `Diagramme clair de la courbe émotionnelle d'un récit en douze étapes.

Une seule courbe continue, montant progressivement jusqu'à un pic marqué à l'étape 8,
redescendant à l'étape 9, puis remontant à l'étape 11 avant de retomber.

Trois zones de fond distinctes pour les trois actes. Étiquettes courtes, épaisseurs de
trait constantes, beaucoup de blanc.

Ambiance : {{ambiance}}.`,
    variables: [MOOD],
    tags: ["diagramme", "pédagogie", "courbe"],
  },
  {
    key: "carton-chapitre",
    name: "Carton de chapitre",
    kind: "image",
    category: "image",
    format: "16:9",
    description:
      "Un carton de transition entre deux actes, à insérer au montage. Sobre, pour ne pas voler la vedette.",
    body: `Carton de transition pour le passage à l'acte « {{acte}} » de « {{titre}} ».

Fond uni ou texture très discrète. Une grande zone vide au centre pour le titre du
chapitre, ajouté ensuite au montage. Aucun élément qui attire l'œil hors du centre.

Ambiance : {{ambiance}}.`,
    variables: [
      VIDEO_TITLE,
      { key: "acte", label: "Acte", hint: "Le départ, l'initiation, ou le retour" },
      MOOD,
    ],
    tags: ["transition", "montage", "carton"],
  },
  {
    key: "portrait-sujet",
    name: "Portrait — le sujet de l'histoire",
    kind: "image",
    category: "product",
    format: "4:5",
    description:
      "Un portrait vertical du sujet ou du produit dont parle la vidéo, cadré pour les formats sociaux.",
    body: `Portrait vertical de {{sujet}}, pour accompagner « {{titre}} ».

Sujet net, arrière-plan simplifié. Cadrage serré mais respirant, regard légèrement hors
champ. Rien dans l'image ne doit distraire du sujet.

Ambiance : {{ambiance}}.`,
    variables: [
      { key: "sujet", label: "Sujet", hint: "La personne, l'objet, le lieu" },
      VIDEO_TITLE,
      MOOD,
    ],
    tags: ["portrait", "vertical", "social"],
  },
  {
    key: "style-reference",
    name: "Référence de style",
    kind: "image",
    category: "style-only",
    format: "16:9",
    description:
      "Ni sujet, ni message : seulement le rendu. À marquer comme référence pour que les générations suivantes s'y accrochent.",
    body: `Planche de référence de style, sans sujet identifiable.

Textures, lumière et palette uniquement. {{ambiance}}.

Pas de personnage, pas de texte, pas d'objet reconnaissable — l'image ne doit servir
qu'à fixer un rendu.`,
    variables: [MOOD],
    tags: ["style", "référence", "direction artistique"],
  },
];

/* ------------------------------------------------------------------------- */
/* Prompts vidéo                                                              */
/* ------------------------------------------------------------------------- */

const VIDEO_PROMPTS: readonly PromptTemplate[] = [
  {
    key: "teaser-vertical",
    name: "Teaser vertical — l'accroche",
    kind: "video",
    category: "social",
    format: "9:16",
    description:
      "Trente secondes verticales qui posent la promesse sans la tenir. C'est l'étape 2 du voyage, isolée.",
    body: `Teaser vertical de 30 secondes pour « {{titre}} », destiné à {{public}}.

Structure : trois secondes pour situer le monde ordinaire, puis la promesse, puis une
question laissée ouverte. Ne révèle jamais la réponse.

Rythme serré, coupes nettes. Texte à l'écran réduit à cinq mots maximum, lisible sur
mobile. Ambiance : {{ambiance}}.

Utilise les marqueurs de l'acte I de la carte narrative comme points de montage.`,
    variables: [VIDEO_TITLE, AUDIENCE, MOOD],
    tags: ["teaser", "vertical", "étape 2"],
  },
  {
    key: "climax-extrait",
    name: "Extrait — le moment décisif",
    kind: "video",
    category: "social",
    format: "9:16",
    description:
      "L'étape 8 sortie de son contexte, montée pour tenir seule. L'enjeu doit rester lisible sans musique.",
    body: `Extrait vertical de 20 à 40 secondes autour du moment décisif de « {{titre}} ».

Rappelle l'enjeu en cinq secondes, puis laisse le moment se dérouler sans commentaire.
Le spectateur doit comprendre ce qui se joue même sans le son.

Ne coupe pas la parole ou l'action avant sa fin. Ambiance : {{ambiance}}.

Utilise les marqueurs rattachés à l'étape 8 de la carte narrative.`,
    variables: [VIDEO_TITLE, MOOD],
    tags: ["extrait", "climax", "étape 8"],
  },
  {
    key: "generique-ouverture",
    name: "Générique d'ouverture",
    kind: "video",
    category: "hero",
    format: "16:9",
    description:
      "Dix secondes d'ouverture qui installent le ton. À réutiliser d'une vidéo à l'autre pour créer une signature.",
    body: `Générique d'ouverture de 8 à 12 secondes pour « {{titre}} ».

Un motif visuel simple qui se construit puis se résout sur le titre. Aucun effet
spectaculaire : c'est une signature, pas un feu d'artifice.

Le même motif doit pouvoir revenir en clôture avec un sens différent.

Ambiance : {{ambiance}}.`,
    variables: [VIDEO_TITLE, MOOD],
    tags: ["générique", "signature", "bookend"],
  },
  {
    key: "courbe-animee",
    name: "Courbe émotionnelle animée",
    kind: "video",
    category: "diagram",
    format: "16:9",
    description:
      "La courbe du récit qui se trace à l'écran, étape après étape. Pour expliquer sa structure à d'autres.",
    body: `Animation de 15 à 25 secondes : une courbe émotionnelle se trace de gauche à droite.

Douze points apparaissent l'un après l'autre. Le pic à l'étape 8 marque un temps d'arrêt,
la descente vers l'étape 9 est nette, la remontée à l'étape 11 est plus brève.

Les trois actes se distinguent par des zones de fond. Étiquettes courtes, apparaissant
avec leur point.

Ambiance : {{ambiance}}.`,
    variables: [MOOD],
    tags: ["animation", "diagramme", "pédagogie"],
  },
  {
    key: "recap-chapitres",
    name: "Récapitulatif par chapitres",
    kind: "video",
    category: "campaign",
    format: "16:9",
    description:
      "Un montage court qui parcourt les douze étapes, une image par étape. Utile pour présenter une vidéo longue.",
    body: `Montage récapitulatif de 45 à 60 secondes pour « {{titre}} ».

Une image par étape couverte de la carte narrative, dans l'ordre narratif — pas
chronologique. Chaque étape reçoit un carton d'une ligne.

Le rythme suit la courbe d'intensité : plus lent au début, resserré vers l'étape 8, une
respiration à la 9.

Ambiance : {{ambiance}}.`,
    variables: [VIDEO_TITLE, MOOD],
    tags: ["récapitulatif", "chapitres", "ordre narratif"],
  },
  {
    key: "bookend-cloture",
    name: "Clôture — le bookend",
    kind: "video",
    category: "image",
    format: "16:9",
    description:
      "Les derniers plans font écho à l'ouverture, mais leur sens a changé. C'est l'étape 12.",
    body: `Séquence de clôture de 10 à 20 secondes pour « {{titre}} ».

Reprends le cadrage, le lieu ou le motif de l'ouverture — mais quelque chose a changé, et
ce changement doit se voir sans être expliqué.

Laisse la dernière image vivre deux secondes de plus que nécessaire.

Ambiance : {{ambiance}}.`,
    variables: [VIDEO_TITLE, MOOD],
    tags: ["clôture", "bookend", "étape 12"],
  },
];

export const BUILT_IN_PROMPTS: readonly PromptTemplate[] = [
  ...IMAGE_PROMPTS,
  ...VIDEO_PROMPTS,
];

export const PROMPT_KINDS = [
  { key: "image", label: "Prompts image" },
  { key: "video", label: "Prompts vidéo" },
] as const;

export function builtInPromptByKey(key: string): PromptTemplate | undefined {
  return BUILT_IN_PROMPTS.find((prompt) => prompt.key === key);
}

/** Remplace les `{{variables}}` par les valeurs fournies ; laisse les manquantes visibles. */
export function fillPrompt(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = values[key]?.trim();
    return value ? value : match;
  });
}
