/**
 * La règle de couverture narrative (FR-006).
 *
 * Une seule implémentation, partagée par l'écran, l'agent et l'export — les dupliquer
 * les ferait diverger, et la couverture est le chiffre sur lequel l'utilisateur juge
 * l'avancement de son récit.
 *
 * La règle : une étape ne compte comme couverte que si elle porte une **note non vide**.
 * Une intensité seule ne suffit pas. Déplacer un curseur n'est pas structurer un récit.
 */

import { ACTS, type ActId, LAST_STEP } from "./hero-journey.ts";

/** Forme minimale attendue d'un beat : seul le contenu de la note compte. */
export interface CoverableBeat {
  step: number;
  note?: string | null;
}

/** Vrai si ce beat rend son étape couverte. */
export function isBeatCovered(beat: Pick<CoverableBeat, "note"> | null | undefined): boolean {
  if (!beat) return false;
  return typeof beat.note === "string" && beat.note.trim().length > 0;
}

export interface ActCoverage {
  actId: ActId;
  covered: number;
  total: number;
}

export interface Coverage {
  covered: number;
  total: number;
  byAct: Record<ActId, number>;
  acts: ActCoverage[];
}

/**
 * Calcule la couverture d'une vidéo à partir de ses beats.
 * Les beats absents comptent comme non couverts : c'est le cas normal d'une carte vide.
 */
export function computeCoverage(beats: readonly CoverableBeat[]): Coverage {
  const coveredSteps = new Set<number>();
  for (const beat of beats) {
    if (isBeatCovered(beat)) coveredSteps.add(beat.step);
  }

  const acts: ActCoverage[] = ACTS.map((act) => ({
    actId: act.id,
    covered: act.steps.filter((step) => coveredSteps.has(step)).length,
    total: act.steps.length,
  }));

  const byAct = Object.fromEntries(
    acts.map((act) => [act.actId, act.covered]),
  ) as Record<ActId, number>;

  return { covered: coveredSteps.size, total: LAST_STEP, byAct, acts };
}
