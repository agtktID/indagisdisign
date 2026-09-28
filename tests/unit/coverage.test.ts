import { describe, expect, it } from "vitest";

import { computeCoverage, isBeatCovered } from "../../shared/coverage.js";

describe("règle de couverture narrative (FR-006)", () => {
  it("ne couvre pas une étape sans note", () => {
    expect(isBeatCovered({ note: null })).toBe(false);
    expect(isBeatCovered({ note: undefined })).toBe(false);
  });

  it("ne couvre pas une étape dont la note n'est que des espaces", () => {
    expect(isBeatCovered({ note: "   \n\t " })).toBe(false);
  });

  it("couvre une étape dont la note porte du texte", () => {
    expect(isBeatCovered({ note: "Le quotidien avant le déclic" })).toBe(true);
  });

  it("ne couvre pas une étape qui ne porte qu'une intensité", () => {
    // Le beat existe en base avec intensity = 80, mais sans note : déplacer un curseur
    // n'est pas structurer un récit.
    const coverage = computeCoverage([{ step: 8, note: "" }]);
    expect(coverage.covered).toBe(0);
    expect(coverage.byAct.initiation).toBe(0);
  });

  it("compte 12 étapes au total et ventile par acte", () => {
    const coverage = computeCoverage([
      { step: 1, note: "ok" },
      { step: 2, note: "ok" },
      { step: 8, note: "ok" },
      { step: 12, note: "ok" },
    ]);
    expect(coverage.total).toBe(12);
    expect(coverage.covered).toBe(4);
    expect(coverage.byAct.depart).toBe(2);
    expect(coverage.byAct.initiation).toBe(1);
    expect(coverage.byAct.retour).toBe(1);
  });

  it("ignore un doublon d'étape sans le compter deux fois", () => {
    const coverage = computeCoverage([
      { step: 3, note: "a" },
      { step: 3, note: "b" },
    ]);
    expect(coverage.covered).toBe(1);
  });

  it("renvoie une couverture nulle sur une carte vide", () => {
    const coverage = computeCoverage([]);
    expect(coverage.covered).toBe(0);
    expect(coverage.acts).toHaveLength(3);
  });
});
