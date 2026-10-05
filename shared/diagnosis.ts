/**
 * Les règles du diagnostic de structure, en un seul endroit et sans base de données.
 *
 * Elles vivaient dans l'action, mêlées aux requêtes : impossible à tester sans monter
 * un serveur et une base. Or c'est la fonctionnalité qui porte la valeur du produit —
 * neuf règles, entièrement déterministes, le cas le plus facile à vérifier du dépôt.
 *
 * Le contrat qui ne doit pas bouger : **ce sont des observations, jamais des verdicts.**
 * Chaque constat dit ce qui est constaté et pourquoi ça compte au montage, puis laisse
 * l'utilisateur en tirer un essai. Aucune règle ne prescrit un correctif.
 */
import { ACTS, ONE_CHANGE_AT_A_TIME, stepByNumber } from "./hero-journey.ts";
import { computeCoverage, isBeatCovered } from "./coverage.ts";

/** Ce qu'une règle a besoin de savoir d'une étape. */
export interface DiagnosableBeat {
  step: number;
  note: string | null;
  intensity: number | null;
}

/** Ce qu'une règle a besoin de savoir d'un marqueur : son étape, ou son absence. */
export interface DiagnosableMarker {
  step: number | null;
}

export interface Finding {
  rule: string;
  severity: "info" | "warn";
  message: string;
  /** Les étapes que le constat désigne. Vide quand il ne porte sur aucune en particulier. */
  steps: number[];
}

export interface Diagnosis {
  coverage: ReturnType<typeof computeCoverage>;
  findings: Finding[];
  /** La règle de méthode qui encadre toute lecture du diagnostic. */
  rule: string;
  next: string;
}

/** Quand aucune étape ne porte de note, une seule chose compte : par où commencer. */
const EMPTY_MAP: Finding = {
  rule: "carte-vide",
  severity: "info",
  message:
    "La carte est vide : aucune étape ne porte de note. Commencez par le monde ordinaire (étape 1) et le climax (étape 8) — ce sont les deux points qui tiennent tout le reste.",
  steps: [1, 8],
};

/**
 * Applique les règles de la méthode à une carte narrative.
 *
 * Pure : mêmes entrées, mêmes constats, dans le même ordre.
 */
export function diagnoseStructure(
  beats: readonly DiagnosableBeat[],
  markers: readonly DiagnosableMarker[],
): Diagnosis {
  const coverage = computeCoverage(beats);
  const covered = new Set(beats.filter(isBeatCovered).map((beat) => beat.step));
  const intensityByStep = new Map(
    beats
      .filter((beat) => beat.intensity !== null)
      .map((beat) => [beat.step, beat.intensity as number]),
  );

  // Une carte vide court-circuite tout le reste : lui reprocher ses déséquilibres
  // n'apprendrait rien à personne.
  if (coverage.covered === 0) {
    return {
      coverage,
      findings: [EMPTY_MAP],
      rule: ONE_CHANGE_AT_A_TIME,
      next: describeNext(1),
    };
  }

  const findings: Finding[] = [];

  // Acte sous-couvert — moins de la moitié des étapes de l'acte sont renseignées.
  for (const act of ACTS) {
    const actCovered = act.steps.filter((step) => covered.has(step)).length;
    if (actCovered * 2 < act.steps.length) {
      findings.push({
        rule: "acte-sous-couvert",
        severity: "warn",
        message: `L'acte ${act.numeral} — ${act.label} n'a que ${actCovered} étape(s) renseignée(s) sur ${act.steps.length}. ${
          act.id === "initiation"
            ? "C'est la partie la plus longue du récit ; sous-couverte, le milieu paraîtra répétitif ou vide."
            : "Le déséquilibre se verra au montage."
        }`,
        steps: act.steps.filter((step) => !covered.has(step)),
      });
    }
  }

  // Climax sans enjeu lisible en amont.
  if (covered.has(8) && !covered.has(7)) {
    findings.push({
      rule: "climax-sans-enjeu",
      severity: "warn",
      message:
        "Le climax (étape 8) est renseigné, mais pas l'approche de la caverne (étape 7). Sans ce qui se joue et ce qui reste incertain juste avant, le moment décisif n'aura pas de poids : vérifiez que l'enjeu est lisible même sans musique.",
      steps: [7, 8],
    });
  }

  // Fin déconnectée du début.
  if (covered.has(12) && !covered.has(1)) {
    findings.push({
      rule: "fin-sans-debut",
      severity: "warn",
      message:
        "Le retour avec l'élixir (étape 12) est renseigné, mais pas le monde ordinaire (étape 1). L'élixir ne se mesure que par rapport au point de départ — sans lui, la boucle ne se referme sur rien.",
      steps: [1, 12],
    });
  }
  if (covered.has(12) && !covered.has(10) && !covered.has(11)) {
    findings.push({
      rule: "fin-deconnectee",
      severity: "warn",
      message:
        "La fin arrive sans conséquences (étape 10) ni preuve de transformation (étape 11). C'est le symptôme « la fin paraît déconnectée » : gardez les conséquences et une preuve du changement, pas juste un résumé.",
      steps: [10, 11],
    });
  }

  // Courbe plate ou climax non dominant. En deçà de trois intensités, il n'y a pas
  // encore de courbe : se taire vaut mieux qu'un constat fondé sur deux points.
  if (intensityByStep.size >= 3) {
    const values = [...intensityByStep.values()];
    const spread = Math.max(...values) - Math.min(...values);
    if (spread < 20) {
      findings.push({
        rule: "courbe-plate",
        severity: "warn",
        message: `La courbe émotionnelle ne varie que de ${spread} points. Le milieu ne doit surtout pas être linéaire : faites varier le rythme, alternez moments explicatifs et moments de plus en plus intenses.`,
        steps: [6, 7, 8],
      });
    }

    const climax = intensityByStep.get(8);
    const strongerBefore = [...intensityByStep.entries()].filter(
      ([step, value]) => step < 8 && climax !== undefined && value > climax,
    );
    if (climax !== undefined && strongerBefore.length > 0) {
      findings.push({
        rule: "climax-trop-tot",
        severity: "warn",
        message: `L'étape ${strongerBefore[0]![0]} (${stepByNumber(strongerBefore[0]![0]).title}) est plus intense que le climax. Si la question principale a déjà sa réponse, tout ce qui suit paraîtra secondaire — déplacer la musique ne suffira pas à recréer un enjeu.`,
        steps: strongerBefore.map(([step]) => step).concat(8),
      });
    }
  }

  // De la matière rattachée, mais pas d'intention écrite.
  //
  // Une étape n'est couverte que par sa note : des rushes rattachés disent ce qu'on a
  // filmé, pas ce que l'étape fait dans le récit. Mais traiter une telle étape comme
  // vide serait injuste — l'utilisateur a fait la moitié du travail, et la plus
  // fastidieuse. On la nomme pour ce qu'elle est.
  const withMaterialOnly = [...new Set(markers.map((marker) => marker.step))]
    .filter((step): step is number => step !== null && !covered.has(step))
    .sort((a, b) => a - b);

  if (withMaterialOnly.length > 0) {
    findings.push({
      rule: "matiere-sans-intention",
      severity: "info",
      message: `${withMaterialOnly.length} étape(s) ont des marqueurs rattachés mais aucune note : ${withMaterialOnly
        .map((step) => `${step} (${stepByNumber(step).title})`)
        .join(", ")}. Vous avez le matériel ; il reste à nommer ce que l'étape fait dans l'histoire. Une phrase suffit.`,
      steps: withMaterialOnly,
    });
  }

  // Marqueurs orphelins en nombre. Un seul marqueur sans étape ne dit rien — « une
  // étape peut manquer » est une phrase de la méthode, pas un défaut.
  const orphans = markers.filter((marker) => marker.step === null);
  if (markers.length >= 5 && orphans.length * 2 > markers.length) {
    findings.push({
      rule: "marqueurs-orphelins",
      severity: "info",
      message: `${orphans.length} marqueurs sur ${markers.length} ne sont rattachés à aucune étape. Une étape peut manquer, ce n'est pas un défaut — mais à cette proportion, la carte ne reflète pas encore votre matériel.`,
      steps: [],
    });
  }

  return { coverage, findings, rule: ONE_CHANGE_AT_A_TIME, next: describeNext(findings.length) };
}

function describeNext(findingCount: number): string {
  return findingCount === 0
    ? "Aucune règle de structure ne se déclenche sur cette carte."
    : "Ces constats sont des hypothèses à tester, pas des verdicts. Ouvrez un essai avec create-experiment pour celui que vous voulez vérifier.";
}
