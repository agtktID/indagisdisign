import { describe, expect, it } from "vitest";

import {
  diagnoseStructure,
  type DiagnosableBeat,
  type DiagnosableMarker,
} from "../../shared/diagnosis.js";

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

/**
 * Un marqueur sans durée : il ne pèse rien, et ne déclenche aucune règle de matière.
 * C'est la forme qu'avaient tous les marqueurs des tests avant l'arrivée des timecodes.
 */
const point = (step: number | null): DiagnosableMarker => ({
  step,
  startMs: 0,
  endMs: null,
  rushName: null,
});

/** Un passage de `seconds` secondes dans un rush nommé. */
const passage = (
  step: number | null,
  seconds: number,
  rushName = "rush-01",
  startMs = 0,
): DiagnosableMarker => ({
  step,
  startMs,
  endMs: startMs + seconds * 1000,
  rushName,
});

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
      [point(null), point(null), point(null), point(null), point(null)],
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
      const result = diagnoseStructure(COMPLETE.slice(0, 4), [point(7), point(7)]);
      const finding = result.findings.find((f) => f.rule === "matiere-sans-intention");
      expect(finding).toBeDefined();
      expect(finding!.steps).toEqual([7]);
      // Le message nomme l'étape, pour que l'utilisateur sache où écrire.
      expect(finding!.message).toContain("Approche de la caverne");
    });

    it("ne compte chaque étape qu'une fois, et les trie", () => {
      const result = diagnoseStructure(COMPLETE.slice(0, 2), [
        point(9),
        point(5),
        point(9),
      ]);
      const finding = result.findings.find((f) => f.rule === "matiere-sans-intention");
      expect(finding!.steps).toEqual([5, 9]);
    });

    it("se tait quand l'étape porte déjà une note", () => {
      const result = diagnoseStructure(COMPLETE, [point(7), point(8)]);
      expect(rules(result)).not.toContain("matiere-sans-intention");
    });

    it("ignore les marqueurs sans étape", () => {
      const result = diagnoseStructure(COMPLETE, [point(null), point(null)]);
      expect(rules(result)).not.toContain("matiere-sans-intention");
    });
  });

  describe("marqueurs orphelins", () => {
    it("se tait en deçà de cinq marqueurs", () => {
      // « Une étape peut manquer » est une phrase de la méthode, pas un défaut.
      const result = diagnoseStructure(COMPLETE, [point(null), point(null)]);
      expect(rules(result)).not.toContain("marqueurs-orphelins");
    });

    it("signale quand plus de la moitié des marqueurs flottent", () => {
      const result = diagnoseStructure(COMPLETE, [
        point(null),
        point(null),
        point(null),
        point(1),
        point(2),
      ]);
      expect(rules(result)).toContain("marqueurs-orphelins");
    });

    it("se tait quand la majorité est rattachée", () => {
      const result = diagnoseStructure(COMPLETE, [
        point(null),
        point(null),
        point(1),
        point(2),
        point(3),
      ]);
      expect(rules(result)).not.toContain("marqueurs-orphelins");
    });
  });

  describe("ce que disent les timecodes", () => {
    it("totalise la matière par acte et par étape", () => {
      const result = diagnoseStructure(COMPLETE, [
        passage(2, 30),
        passage(6, 45),
        passage(6, 15),
        point(11),
      ]);
      expect(result.material.totalMs).toBe(90_000);
      expect(result.material.byStep[6]).toBe(60_000);
      expect(result.material.byAct.depart).toBe(30_000);
      // Un point ne pèse aucune durée : il marque un instant, pas un passage.
      expect(result.material.byAct.retour ?? 0).toBe(0);
    });

    it("se tait en deçà d'une minute de matière", () => {
      // Trois marqueurs ne disent rien d'un déséquilibre : le carnet est trop jeune.
      const result = diagnoseStructure(COMPLETE, [passage(1, 30), passage(12, 20)]);
      expect(rules(result)).not.toContain("acte-ii-sous-dote");
    });

    it("signale un acte II plus léger que les autres", () => {
      const result = diagnoseStructure(COMPLETE, [
        passage(1, 60),
        passage(6, 20),
        passage(12, 50),
      ]);
      const finding = result.findings.find((f) => f.rule === "acte-ii-sous-dote");
      expect(finding).toBeDefined();
      // Le message chiffre, plutôt que de qualifier.
      expect(finding!.message).toContain("20 s");
      expect(finding!.steps).toEqual([5, 6, 7, 8, 9]);
    });

    it("ne dit rien quand l'acte II est bien le plus lourd", () => {
      const result = diagnoseStructure(COMPLETE, [
        passage(1, 20),
        passage(6, 90),
        passage(12, 20),
      ]);
      expect(rules(result)).not.toContain("acte-ii-sous-dote");
    });

    it("signale un climax écrit mais sans une seconde de rush", () => {
      const result = diagnoseStructure(COMPLETE, [passage(1, 60), passage(6, 40)]);
      const finding = result.findings.find((f) => f.rule === "climax-sans-matiere");
      expect(finding).toBeDefined();
      expect(finding!.steps).toEqual([8]);
    });

    it("ne le signale pas dès que le climax porte de la matière", () => {
      const result = diagnoseStructure(COMPLETE, [passage(1, 60), passage(8, 40)]);
      expect(rules(result)).not.toContain("climax-sans-matiere");
    });

    it("signale deux passages qui se recouvrent dans un même rush", () => {
      const result = diagnoseStructure(COMPLETE, [
        passage(3, 10, "rush-02", 0),
        passage(4, 10, "rush-02", 5_000),
      ]);
      const finding = result.findings.find((f) => f.rule === "marqueurs-superposes");
      expect(finding).toBeDefined();
      expect(finding!.message).toContain("rush-02");
    });

    it("ne compare jamais des timecodes de rushes différents", () => {
      // Deux passages aux mêmes timecodes, mais dans deux rushes : aucun recouvrement.
      const result = diagnoseStructure(COMPLETE, [
        passage(3, 10, "rush-02", 0),
        passage(4, 10, "rush-07", 0),
      ]);
      expect(rules(result)).not.toContain("marqueurs-superposes");
    });

    it("ignore les marqueurs sans nom de rush pour le recouvrement", () => {
      // Sans rush nommé, on ne sait pas d'où vient le passage : rien à comparer.
      const result = diagnoseStructure(COMPLETE, [
        { step: 3, startMs: 0, endMs: 10_000, rushName: null },
        { step: 4, startMs: 5_000, endMs: 15_000, rushName: null },
      ]);
      expect(rules(result)).not.toContain("marqueurs-superposes");
    });

    it("deux passages jointifs ne se recouvrent pas", () => {
      const result = diagnoseStructure(COMPLETE, [
        passage(3, 10, "rush-02", 0),
        passage(4, 10, "rush-02", 10_000),
      ]);
      expect(rules(result)).not.toContain("marqueurs-superposes");
    });
  });

  it("reste une lecture : aucun constat ne prescrit de correctif", () => {
    const result = diagnoseStructure([beat(8)], [point(null)]);
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
