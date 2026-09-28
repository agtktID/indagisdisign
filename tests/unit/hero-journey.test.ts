import { describe, expect, it } from "vitest";

import {
  ACTS,
  DIAGNOSTIC_SYMPTOMS,
  JOURNEY_STEPS,
  PREP_QUESTIONS,
  actForStep,
  isValidStep,
  prepQuestionByKey,
  stepByNumber,
  symptomByKey,
} from "../../shared/hero-journey.js";

describe("référentiel du voyage du héros", () => {
  it("porte exactement 12 étapes, numérotées de 1 à 12 sans trou", () => {
    expect(JOURNEY_STEPS).toHaveLength(12);
    expect(JOURNEY_STEPS.map((step) => step.step)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });

  it("répartit les 12 étapes sur 3 actes, sans doublon ni oubli", () => {
    const covered = ACTS.flatMap((act) => act.steps).sort((a, b) => a - b);
    expect(covered).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(ACTS.map((act) => act.steps.length)).toEqual([4, 5, 3]);
  });

  it("place le pic de la courbe de référence à l'étape 8", () => {
    const peak = JOURNEY_STEPS.reduce((best, step) =>
      step.referenceIntensity > best.referenceIntensity ? step : best,
    );
    expect(peak.step).toBe(8);
  });

  it("fait respirer l'étape 9 après le climax, puis relancer à la 11", () => {
    const at = (n: number) => stepByNumber(n).referenceIntensity;
    expect(at(9)).toBeLessThan(at(8));
    expect(at(11)).toBeGreaterThan(at(10));
  });

  it("rejette un numéro d'étape hors de 1–12", () => {
    expect(isValidStep(0)).toBe(false);
    expect(isValidStep(13)).toBe(false);
    expect(isValidStep(1.5)).toBe(false);
    expect(() => stepByNumber(13)).toThrow(/12 étapes/);
  });

  it("rattache chaque étape à son acte", () => {
    expect(actForStep(1).id).toBe("depart");
    expect(actForStep(8).id).toBe("initiation");
    expect(actForStep(12).id).toBe("retour");
  });

  it("expose 5 questions de préparation et 5 symptômes, à clés uniques", () => {
    expect(PREP_QUESTIONS).toHaveLength(5);
    expect(DIAGNOSTIC_SYMPTOMS).toHaveLength(5);
    expect(new Set(PREP_QUESTIONS.map((q) => q.key)).size).toBe(5);
    expect(new Set(DIAGNOSTIC_SYMPTOMS.map((s) => s.key)).size).toBe(5);
  });

  it("renvoie undefined pour une clé inconnue plutôt que de lever", () => {
    expect(prepQuestionByKey("inventee")).toBeUndefined();
    expect(symptomByKey("inventee")).toBeUndefined();
  });
});
