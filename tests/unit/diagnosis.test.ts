import { describe, expect, it } from "vitest";

import { diagnoseStructure, type DiagnosableBeat } from "../../shared/diagnosis.js";

/** Une étape renseignée : une note suffit à la rendre couverte. */
const beat = (step: number, intensity: number | null = null): DiagnosableBeat => ({
  step,
  note: `Note de l'étape ${step}`,
  intensity,
});

/** Une étape touchée mais pas renseignée : l'intensité seule ne couvre pas. */
const intensityOnly = (step: number, intensity: number): DiagnosableBeat => ({
  step,
  note: null,
  intensity,
});

/** Les douze étapes renseignées, avec une courbe conforme à la méthode. */
const COMPLETE: DiagnosableBeat[] = [
  beat(1, 20),
  beat(2, 30),
  beat(3, 25),
  beat(4, 40),
  beat(5, 50),
  beat(6, 60),
  beat(7, 70),
  beat(8, 95),
  beat(9, 45),
  beat(10, 55),
  beat(11, 80),
  beat(12, 35),
];

const rules = (result: ReturnType<typeof diagnoseStructure>) =>
  result.findings.map((finding) => finding.rule);

describe("diagnoseStructure", () => {
  it("ne reproche rien à une carte complète et conforme", () => {
    const result = diagnoseStructure(COMPLETE, []);
    expect(result.findings).toEqual([]);
    expect(result.next).toContain("Aucune règle");
  });

  it("sur une carte vide, dit seulement par où commencer", () => {
    const result = diagnoseStructure([], []);
    expect(rules(result)).toEqual(["carte-vide"]);
    // Le monde ordinaire et le climax : les deux points qui tiennent le reste.
    expect(result.findings[0]!.steps).toEqual([1, 8]);
  });

  it("une intensité seule ne rend pas une carte non vide", () => {
    const result = diagnoseStructure([intensityOnly(1, 50), intensityOnly(8, 90)], []);
    expect(rules(result)).toEqual(["carte-vide"]);
  });

  it("court-circuite les autres règles quand la carte est vide", () => {
    // Des marqueurs orphelins en masse ne doivent pas s'ajouter au constat de départ :
    // reprocher ses déséquilibres à une carte vide n'apprendrait rien.
    const result = diagnoseStructure(
      [],
      [{ step: null }, { step: null }, { step: null }, { step: null }, { step: null }],
    );
    expect(rules(result)).toEqual(["carte-vide"]);
  });

  describe("acte sous-couvert", () => {
    it("se déclenche une fois par acte en deçà de la moitié", () => {
      const result = diagnoseStructure([beat(1)], []);
      expect(rules(result).filter((rule) => rule === "acte-sous-couvert")).toHaveLength(3);
    });

    it("ne se déclenche pas quand l'acte atteint la moitié", () => {
      // L'acte I compte quatre étapes : deux renseignées suffisent.
      const result = diagnoseStructure([beat(1), beat(2)], []);
      const actFindings = result.findings.filter((f) => f.rule === "acte-sous-couvert");
      expect(actFindings.map((f) => f.steps)).not.toContainEqual([3, 4]);
    });

    it("ne liste que les étapes manquantes de l'acte", () => {
      const result = diagnoseStructure([beat(1)], []);
      const depart = result.findings.find(
        (f) => f.rule === "acte-sous-couvert" && f.message.includes("Le départ"),
      );
      expect(depart!.steps).toEqual([2, 3, 4]);
    });
  });

  describe("les règles d'enchaînement", () => {
    it("signale un climax sans son approche", () => {
      const result = diagnoseStructure([beat(1), beat(8)], []);
      expect(rules(result)).toContain("climax-sans-enjeu");
    });

    it("ne le signale pas quand l'approche est renseignée", () => {
      const result = diagnoseStructure([beat(1), beat(7), beat(8)], []);
      expect(rules(result)).not.toContain("climax-sans-enjeu");
    });

    it("signale une fin sans monde ordinaire", () => {
      const result = diagnoseStructure([beat(8), beat(12)], []);
      expect(rules(result)).toContain("fin-sans-debut");
    });

    it("signale une fin sans conséquences ni preuve de transformation", () => {
      const result = diagnoseStructure([beat(1), beat(12)], []);
      expect(rules(result)).toContain("fin-deconnectee");
    });

    it("ne signale pas la fin déconnectée dès qu'une des deux étapes est là", () => {
      const result = diagnoseStructure([beat(1), beat(11), beat(12)], []);
      expect(rules(result)).not.toContain("fin-deconnectee");
    });
  });

  describe("la courbe", () => {
    it("se tait en deçà de trois intensités", () => {
      // Deux points ne font pas une courbe : mieux vaut ne rien dire.
      const result = diagnoseStructure([beat(1, 50), beat(8, 52)], []);
      expect(rules(result)).not.toContain("courbe-plate");
    });

    it("signale une courbe qui ne varie pas", () => {
      const result = diagnoseStructure([beat(1, 50), beat(7, 55), beat(8, 60)], []);
      expect(rules(result)).toContain("courbe-plate");
    });

    it("ne signale rien quand l'amplitude dépasse le seuil", () => {
      const result = diagnoseStructure([beat(1, 20), beat(7, 60), beat(8, 95)], []);
      expect(rules(result)).not.toContain("courbe-plate");
    });

    it("signale un pic placé avant le climax", () => {
      const result = diagnoseStructure([beat(1, 20), beat(6, 99), beat(7, 60), beat(8, 70)], []);
      const finding = result.findings.find((f) => f.rule === "climax-trop-tot");
      expect(finding).toBeDefined();
      expect(finding!.steps).toContain(6);
      expect(finding!.steps).toContain(8);
    });

    it("ne signale rien quand le climax domine", () => {
      const result = diagnoseStructure(COMPLETE, []);
      expect(rules(result)).not.toContain("climax-trop-tot");
    });
  });

  describe("matière sans intention", () => {
    it("signale une étape qui porte des marqueurs mais pas de note", () => {
      const result = diagnoseStructure(COMPLETE.slice(0, 4), [{ step: 7 }, { step: 7 }]);
      const finding = result.findings.find((f) => f.rule === "matiere-sans-intention");
      expect(finding).toBeDefined();
      expect(finding!.steps).toEqual([7]);
      // Le message nomme l'étape, pour que l'utilisateur sache où écrire.
      expect(finding!.message).toContain("Approche de la caverne");
    });

    it("ne compte chaque étape qu'une fois, et les trie", () => {
      const result = diagnoseStructure(COMPLETE.slice(0, 2), [
        { step: 9 },
        { step: 5 },
        { step: 9 },
      ]);
      const finding = result.findings.find((f) => f.rule === "matiere-sans-intention");
      expect(finding!.steps).toEqual([5, 9]);
    });

    it("se tait quand l'étape porte déjà une note", () => {
      const result = diagnoseStructure(COMPLETE, [{ step: 7 }, { step: 8 }]);
      expect(rules(result)).not.toContain("matiere-sans-intention");
    });

    it("ignore les marqueurs sans étape", () => {
      const result = diagnoseStructure(COMPLETE, [{ step: null }, { step: null }]);
      expect(rules(result)).not.toContain("matiere-sans-intention");
    });
  });

  describe("marqueurs orphelins", () => {
    it("se tait en deçà de cinq marqueurs", () => {
      // « Une étape peut manquer » est une phrase de la méthode, pas un défaut.
      const result = diagnoseStructure(COMPLETE, [{ step: null }, { step: null }]);
      expect(rules(result)).not.toContain("marqueurs-orphelins");
    });

    it("signale quand plus de la moitié des marqueurs flottent", () => {
      const result = diagnoseStructure(COMPLETE, [
        { step: null },
        { step: null },
        { step: null },
        { step: 1 },
        { step: 2 },
      ]);
      expect(rules(result)).toContain("marqueurs-orphelins");
    });

    it("se tait quand la majorité est rattachée", () => {
      const result = diagnoseStructure(COMPLETE, [
        { step: null },
        { step: null },
        { step: 1 },
        { step: 2 },
        { step: 3 },
      ]);
      expect(rules(result)).not.toContain("marqueurs-orphelins");
    });
  });

  it("reste une lecture : aucun constat ne prescrit de correctif", () => {
    const result = diagnoseStructure([beat(8)], [{ step: null }]);
    expect(result.rule).toContain("Change une seule chose à la fois");
    expect(result.next).toContain("hypothèses à tester, pas des verdicts");
  });

  it("produit des constats discernables les uns des autres", () => {
    // La règle seule ne suffit pas à identifier un constat : `acte-sous-couvert` est
    // émise une fois par acte. C'est ce qui avait produit des clés React dupliquées.
    const result = diagnoseStructure([beat(1)], []);
    const identities = result.findings.map((f) => `${f.rule}:${f.steps.join(",")}`);
    expect(new Set(identities).size).toBe(identities.length);
  });
});
