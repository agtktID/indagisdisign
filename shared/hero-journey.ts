/**
 * Référentiel figé de la méthode « Le voyage du héros pour le montage ».
 *
 * Ce contenu n'est PAS de la donnée utilisateur : il ne vit pas en base. Les tables
 * `story_beats`, `markers`, `prep_answers` et `experiments` ne stockent que ce que
 * l'utilisateur en fait pour sa vidéo. Un numéro d'étape (1 à 12) est la clé de jointure
 * entre la base et ce module.
 *
 * Les textes sont transcrits de la méthode source. Les reformuler introduirait un écart
 * silencieux entre ce que l'utilisateur a lu et ce que l'outil lui dit.
 */

export type ActId = "depart" | "initiation" | "retour";

export interface Act {
  id: ActId;
  /** Numéro romain affiché */
  numeral: string;
  label: string;
  steps: number[];
  /** Jeton de couleur, résolu côté UI */
  color: "teal" | "orange" | "violet";
}

export const ACTS: readonly Act[] = [
  {
    id: "depart",
    numeral: "I",
    label: "Le départ",
    steps: [1, 2, 3, 4],
    color: "teal",
  },
  {
    id: "initiation",
    numeral: "II",
    label: "L'initiation",
    steps: [5, 6, 7, 8, 9],
    color: "orange",
  },
  {
    id: "retour",
    numeral: "III",
    label: "Le retour",
    steps: [10, 11, 12],
    color: "violet",
  },
] as const;

export interface JourneyStep {
  /** 1 à 12 */
  step: number;
  actId: ActId;
  title: string;
  /** La formule courte qui résume l'étape */
  tagline: string;
  /** Ce que l'étape représente narrativement */
  definition: string;
  /** Ce qu'il faut chercher ou poser dans le montage */
  editing: string;
  /** L'exercice « À essayer » */
  exercise: string;
  /** Exemples tirés de Star Wars (1977), Matrix (1999), Le Seigneur des Anneaux */
  examples: string[];
  /**
   * Intensité de référence (0-100) pour la courbe émotionnelle.
   * Pic à l'étape 8, respiration à la 9, relance à la 11.
   * C'est une référence indicative, jamais une cible imposée à l'utilisateur.
   */
  referenceIntensity: number;
  /** Piège documenté par la méthode pour cette étape, le cas échéant */
  pitfall?: string;
}

export const JOURNEY_STEPS: readonly JourneyStep[] = [
  {
    step: 1,
    actId: "depart",
    title: "Monde ordinaire",
    tagline: "Le point de départ.",
    definition:
      "La situation avant que tout change : une habitude, un manque, un problème. Ce repère permet au spectateur de comprendre ce qui compte et, plus tard, de mesurer le chemin parcouru.",
    editing:
      "Poser une situation initiale. Garder juste assez de contexte pour que la suite ait du poids, puis avancer. Même en ouvrant sur un moment spectaculaire, revenir vite à l'enjeu humain — et garder un motif visuel sous le coude pour le retrouver à la fin.",
    exercise: "Trouve le détail qui rend ta situation de départ concrète.",
    examples: [
      "Luke rêve de quitter la ferme de son oncle (Star Wars)",
      "Neo sent que quelque chose cloche (Matrix)",
      "Frodon vit tranquille dans la Comté (SdA)",
    ],
    referenceIntensity: 10,
  },
  {
    step: 2,
    actId: "depart",
    title: "Appel à l'aventure",
    tagline: "Une raison de rester.",
    definition:
      "La porte qui s'ouvre : un problème à résoudre, quelque chose à découvrir, un objectif à atteindre. Le spectateur commence à imaginer ce qui pourrait changer et veut savoir comment on va y arriver.",
    editing:
      "À la fin de l'introduction, poser la promesse forte de la vidéo : un défi, un mystère, une rencontre qui peut tout changer. Le public doit sentir pourquoi ça vaut le coup de rester. Une phrase, un message reçu ou une décision suffisent à porter la promesse ; un changement de musique peut la souligner.",
    exercise: "Écris la question que ton intro donne envie de voir résolue.",
    examples: [
      "Luke reçoit l'appel à l'aide de Leia",
      "Neo lit « Suis le lapin blanc » sur son écran",
      "Frodon apprend la vérité sur son anneau",
    ],
    referenceIntensity: 25,
  },
  {
    step: 3,
    actId: "depart",
    title: "Refus / hésitation",
    tagline: "Le doute trouve sa place.",
    definition:
      "Le personnage hésite : peur d'échouer, manque de confiance, souvenir d'une tentative ratée. Cette résistance rend le parcours crédible — on comprend pourquoi le problème n'est pas déjà réglé.",
    editing:
      "Ce doute est le moment d'hésitation que le spectateur pourrait ressentir après une promesse trop belle. L'assumer crée une connexion forte et ajoute de l'enjeu à la promesse. Ralentir ou stopper brusquement la musique peut marquer cette hésitation — mais choisis un obstacle réel, qui pèse sur la suite du récit.",
    exercise: "Repère ce qui pourrait empêcher ton personnage d'aller au bout.",
    examples: [
      "Luke refuse de suivre Obi-Wan, il a du travail",
      "Neo renonce à fuir par l'échafaudage",
      "Frodon supplie Gandalf de prendre l'anneau",
    ],
    referenceIntensity: 20,
  },
  {
    step: 4,
    actId: "depart",
    title: "Rencontre avec le mentor",
    tagline: "Une clé pour avancer.",
    definition:
      "Le mentor apporte ce qui manque : un conseil, une méthode, une info, un outil. Ça peut être une personne, mais aussi une découverte. Son rôle : rendre la suite possible.",
    editing:
      "Repérer la rencontre ou l'info qui change la manière d'aborder le problème (une archive dans une enquête, le conseil d'une personne expérimentée dans un défi). C'est aussi souvent le moment d'introduire le narrateur — par exemple en le laissant en off tout le début, puis en faisant son premier face-cam ici pour donner plus de poids à son intervention.",
    exercise: "Relie la découverte à la décision qu'elle rend possible.",
    examples: [
      "Obi-Wan donne à Luke le sabre de son père",
      "Morpheus offre à Neo le choix des deux pilules",
      "Gandalf explique à Frodon ce qui l'attend",
    ],
    referenceIntensity: 35,
  },
  {
    step: 5,
    actId: "initiation",
    title: "Franchissement du seuil",
    tagline: "L'entrée dans l'action.",
    definition:
      "Le personnage s'engage vraiment : il quitte ce qu'il connaît pour se lancer dans quelque chose de nouveau. Ce qui n'était qu'une possibilité devient une action.",
    editing:
      "L'intro est finie, on peut commencer à développer le propos. Donner du relief à cette bascule avec une coupe franche, un changement d'ambiance ou un son du lieu. Le mot-clé : la rupture. Garder ensuite un plan qui installe dans ce nouvel espace — on doit comprendre ce qui commence et pourquoi revenir en arrière devient plus difficile.",
    exercise: "Identifie le geste qui engage vraiment ton personnage.",
    examples: [
      "Luke, sa ferme brûlée, quitte Tatooine",
      "Neo avale la pilule rouge et se réveille",
      "Frodon et Sam quittent la Comté pour de bon",
    ],
    referenceIntensity: 45,
  },
  {
    step: 6,
    actId: "initiation",
    title: "Épreuves, alliés, ennemis",
    tagline: "Apprendre en avançant.",
    definition:
      "Le personnage essaie, se prend des obstacles, trouve de l'aide. Chaque tentative change la situation, ou sa façon de la comprendre. Le récit avance par découvertes successives : des progrès, et parfois de nouveaux problèmes.",
    editing:
      "C'est la partie la plus longue — elle ne doit surtout pas être linéaire, sinon le spectateur s'ennuie. Relancer régulièrement l'attention avec des ruptures et des révélations, et faire varier le rythme : alterner moments explicatifs et moments de plus en plus intenses. Éviter d'être redondant : si deux séquences racontent la même chose, les fusionner ou garder la plus forte.",
    exercise: "Note ce qui change après chacune de tes scènes.",
    examples: [
      "Luke s'allie à Han face aux stormtroopers",
      "Neo s'entraîne, voit l'Oracle, Cypher trahit",
      "Frodon affronte les Nazgûls, puis la Moria",
    ],
    referenceIntensity: 55,
  },
  {
    step: 7,
    actId: "initiation",
    title: "Approche de la caverne",
    tagline: "L'attente se resserre.",
    definition:
      "On approche de l'épreuve décisive. Les enjeux se précisent : on sait ce que le personnage espère réussir et ce qu'il risque de perdre. Toute l'attention se concentre sur le moment qui va apporter la réponse.",
    editing:
      "Avant le moment décisif, rappeler ce qui se joue et ce qui reste incertain, et mettre de l'intensité (par le rythme, la musique). Écarter les détours, resserrer l'attention sur les détails utiles. On peut accélérer les coupes, rapprocher les cadrages ou laisser durer une attente — à adapter au propos : toutes les vidéos ne sont pas des films d'action.",
    exercise:
      "Anticipe l'état émotionnel du public et surprends-le par ta façon de clôturer cette partie.",
    examples: [
      "Luke s'infiltre dans l'Étoile de la Mort",
      "Neo et Trinity entrent armés dans l'immeuble",
      "Frodon et Sam entrent en Mordor",
    ],
    referenceIntensity: 75,
  },
  {
    step: 8,
    actId: "initiation",
    title: "Le climax",
    tagline: "Le moment décisif.",
    definition:
      "C'est l'épreuve centrale. La question préparée depuis le début trouve enfin sa réponse : réussite, échec, révélation ou décision. Ce moment n'a de force que grâce à tout ce qu'on a compris et attendu avant.",
    editing:
      "C'est le moment de la grande révélation — il faut tenir la promesse de départ. Le spectateur doit comprendre ce qui arrive et ce que ça change. Choisir le point de vue qui rend ce moment le plus lisible. Laisser une action ou une parole aller jusqu'au bout avant de commenter. Ne pas avoir peur du silence : un plan tenu peut peser autant qu'une phrase décisive — l'émotion vient souvent du non-dit.",
    exercise: "Garde le plan ou la parole qui porte vraiment le basculement.",
    examples: [
      "Luke voit Obi-Wan tomber face à Vador",
      "Neo esquive les balles et sauve Morpheus",
      "Frodon cède à l'anneau, qui finit dans la lave",
    ],
    referenceIntensity: 100,
    pitfall:
      "Le climax arrive trop tôt : montrer le résultat dès le début puis dérouler les préparatifs peut sembler malin, mais si la question principale a déjà sa réponse, tout ce qui suit paraît secondaire — déplacer la musique ne suffira pas à recréer un enjeu. Préfère l'attente : comprendre l'objectif, découvrir l'obstacle, puis suivre la tentative, pour que le résultat réponde à une question encore ouverte. Une révélation en ouverture peut marcher, à condition qu'elle ouvre une autre question forte.",
  },
  {
    step: 9,
    actId: "initiation",
    title: "Récompense",
    tagline: "Le gain devient sensible.",
    definition:
      "Après l'épreuve, le personnage récupère ce qu'il a gagné, ou en prend la mesure : un objet, une compréhension, un soulagement. C'est une respiration : le spectateur ressent le résultat avant que le récit reparte.",
    editing:
      "Après le moment fort, garder une réaction ou un détail qui laisse l'effet retomber — un souffle, un regard, un lieu soudain calme. Alléger le montage et laisser vivre cette émotion avant de relancer. Si l'issue est un échec, le gain peut être une prise de conscience. S'appuyer sur ce que les images montrent, sans leur coller de force une fin heureuse.",
    exercise: "Garde un moment pour ressentir les conséquences immédiates.",
    examples: [
      "Luke s'enfuit avec Leia et les plans",
      "Neo commence enfin à croire en lui",
      "Frodon souffle : l'anneau est enfin détruit",
    ],
    referenceIntensity: 40,
  },
  {
    step: 10,
    actId: "retour",
    title: "Chemin du retour",
    tagline: "La découverte rejoint la vie.",
    definition:
      "Le personnage rentre vers son quotidien avec ce qu'il a appris ou obtenu. On voit les conséquences de l'épreuve : qu'est-ce que cette découverte change dans sa façon d'agir ?",
    editing:
      "Après le point culminant, montrer ce que le résultat change. Resserrer cette partie autour des conséquences utiles : qu'est-ce qu'on a appris, qu'est-ce qu'on a gagné ? Une question encore ouverte peut porter la fin. Éviter le résumé complet, garder uniquement les scènes qui apportent une réponse nouvelle.",
    exercise: "Formule la grande leçon de ta vidéo.",
    examples: [
      "Luke rejoint la base rebelle, Han s'en va",
      "Neo fuit les agents pour rejoindre la sortie",
      "Frodon rentre dans une Comté inchangée",
    ],
    referenceIntensity: 45,
  },
  {
    step: 11,
    actId: "retour",
    title: "Résurrection",
    tagline: "La transformation se confirme.",
    definition:
      "Une dernière épreuve révèle ce qui a changé chez le personnage. Face à une difficulté, il agit avec ce qu'il a appris. C'est la preuve qu'il s'est vraiment transformé. Le nom est grandiose, mais le geste peut être tout simple.",
    editing:
      "Chercher une dernière situation qui révèle le chemin parcouru. Rapprocher ce passage d'un moment comparable du début pour que le contraste saute aux yeux — laisser le public constater la différence : sa connaissance ou son point de vue doit avoir évolué.",
    exercise:
      "Fais un bookend : finir sur des plans proches du début, mais dont le sens a changé.",
    examples: [
      "Luke coupe son viseur et se fie à la Force",
      "Neo meurt, se relève et voit la Matrice en code",
      "Sam, jadis timide, va enfin parler à Rosie",
    ],
    referenceIntensity: 85,
  },
  {
    step: 12,
    actId: "retour",
    title: "Retour avec l'élixir",
    tagline: "Quelque chose à emporter.",
    definition:
      "Le personnage revient avec quelque chose qu'il peut utiliser ou partager. La boucle se referme et le chemin parcouru devient visible. L'élixir peut être une compétence, une leçon ou un nouveau regard sur le problème de départ.",
    editing:
      "Pour conclure, retrouver une image, un lieu ou une question du début, avec un sens nouveau. Dans un portrait, un geste du quotidien peut raconter le changement. Dans un récit, une phrase peut éclairer toute l'expérience. Garder ce qui laisse une trace : une émotion, un point de vue ou une question à emporter. Laisser vivre cette dernière impression. Si on ajoute un appel à l'action, le faire court pour ne pas casser la conclusion.",
    exercise: "Choisis ce que tu veux laisser en tête après la dernière image.",
    examples: [
      "Luke, simple fermier, est décoré en héros",
      "Neo promet un monde sans limites et s'envole",
      "Frodon confie à Sam le livre de leur histoire",
    ],
    referenceIntensity: 30,
  },
] as const;

/** Les cinq questions de la fiche de préparation. Les clés sont stables et persistées. */
export interface PrepQuestion {
  key: string;
  label: string;
  hint: string;
}

export const PREP_QUESTIONS: readonly PrepQuestion[] = [
  {
    key: "probleme-ouvrant",
    label: "Quel problème ouvre le récit ?",
    hint: "La situation ou le manque qui donne une raison de regarder.",
  },
  {
    key: "ce-qui-change",
    label: "Qu'est-ce qui doit changer ?",
    hint: "La transformation que la vidéo doit rendre visible.",
  },
  {
    key: "scene-du-changement",
    label: "Quelle scène rend ce changement visible ?",
    hint: "Le rush ou le passage précis, pas une idée abstraite.",
  },
  {
    key: "prerequis",
    label: "Que faut-il comprendre avant cette scène ?",
    hint: "Ce que le spectateur doit savoir pour que la scène porte.",
  },
  {
    key: "premier-essai",
    label: "Quelle première modification vas-tu tester ?",
    hint: "Un seul changement, pour pouvoir comparer avant/après.",
  },
] as const;

/** Les cinq symptômes du diagnostic de timeline. Les clés sont stables et persistées. */
export interface DiagnosticSymptom {
  key: string;
  observation: string;
  suggestion: string;
  /** Étapes de la carte concernées par ce symptôme */
  relatedSteps: number[];
}

export const DIAGNOSTIC_SYMPTOMS: readonly DiagnosticSymptom[] = [
  {
    key: "debut-repete",
    observation: "Le début répète le problème",
    suggestion:
      "Garde la scène la plus claire, puis avance vers la promesse (étape 2, l'appel à l'aventure).",
    relatedSteps: [1, 2],
  },
  {
    key: "milieu-repetitif",
    observation: "Le milieu semble répétitif",
    suggestion:
      "Cherche ce que chaque bloc change vraiment dans la situation. Supprime les doublons — si deux séquences racontent la même chose, garde la plus forte.",
    relatedSteps: [6],
  },
  {
    key: "climax-faible",
    observation: "Le climax semble faible",
    suggestion:
      "Vérifie que l'enjeu et le résultat sont lisibles même sans musique. Si le spectateur a besoin de la bande-son pour comprendre que c'est LE moment décisif, le montage seul ne porte pas assez l'info.",
    relatedSteps: [7, 8],
  },
  {
    key: "fin-deconnectee",
    observation: "La fin paraît déconnectée",
    suggestion:
      "Garde les conséquences (étape 10, chemin du retour) et une preuve de transformation (étape 11, résurrection) — pas juste un résumé.",
    relatedSteps: [10, 11],
  },
  {
    key: "passage-confus",
    observation: "Un passage paraît confus",
    suggestion:
      "Montre le résultat, puis isole le détail qui l'explique : une preuve avant son explication.",
    relatedSteps: [],
  },
] as const;

/** La règle qui gouverne toute la boucle d'essais. */
export const ONE_CHANGE_AT_A_TIME =
  "Chaque symptôme peut avoir plusieurs causes. Change une seule chose à la fois, puis compare avant de conclure.";

/** Les quatre points de la relecture finale. */
export interface FinalReviewPoint {
  key: string;
  label: string;
  checks: string[];
}

export const FINAL_REVIEW: readonly FinalReviewPoint[] = [
  {
    key: "debut",
    label: "Le début",
    checks: ["Le problème est clair.", "La promesse donne envie de rester."],
  },
  {
    key: "milieu",
    label: "Le milieu",
    checks: ["Chaque bloc apporte du nouveau.", "On sent le passage à l'action."],
  },
  {
    key: "moment-decisif",
    label: "Le moment décisif",
    checks: ["L'enjeu prépare le résultat.", "On a le temps de le recevoir."],
  },
  {
    key: "fin",
    label: "La fin",
    checks: ["Le changement se voit.", "Le spectateur sait ce qu'il emporte."],
  },
] as const;

export const FIRST_STEP = 1;
export const LAST_STEP = 12;

/** Vrai si `step` est un numéro d'étape valide (entier de 1 à 12). */
export function isValidStep(step: unknown): step is number {
  return (
    typeof step === "number" &&
    Number.isInteger(step) &&
    step >= FIRST_STEP &&
    step <= LAST_STEP
  );
}

/** Renvoie l'étape par son numéro. Lève si le numéro est hors de 1–12. */
export function stepByNumber(step: number): JourneyStep {
  if (!isValidStep(step)) {
    throw new Error(
      `Étape ${step} inconnue : le voyage du héros compte ${LAST_STEP} étapes, numérotées de ${FIRST_STEP} à ${LAST_STEP}.`,
    );
  }
  return JOURNEY_STEPS[step - 1]!;
}

/** Renvoie l'acte auquel appartient une étape. Lève si le numéro est hors de 1–12. */
export function actForStep(step: number): Act {
  const journeyStep = stepByNumber(step);
  return ACTS.find((act) => act.id === journeyStep.actId)!;
}

/** Renvoie la question de préparation par sa clé, ou `undefined` si la clé est inconnue. */
export function prepQuestionByKey(key: string): PrepQuestion | undefined {
  return PREP_QUESTIONS.find((question) => question.key === key);
}

/** Renvoie le symptôme de diagnostic par sa clé, ou `undefined` si la clé est inconnue. */
export function symptomByKey(key: string): DiagnosticSymptom | undefined {
  return DIAGNOSTIC_SYMPTOMS.find((symptom) => symptom.key === key);
}
