import { describe, expect, it } from "vitest";

import {
  buildNarrativeBrief,
  scopeLabel,
  stepsInScope,
  type BriefBeat,
  type BriefMarker,
} from "../../shared/narrative-brief.js";

const beat = (step: number, note: string | null, intensity: number | null = null): BriefBeat => ({
  step,
  note,
  intensity,
  isCovered: typeof note === "string" && note.trim().length > 0,
});

const marker = (
  label: string,
  step: number | null,
  overrides: Partial<BriefMarker> = {},
): BriefMarker => ({
  label,
  rushName: "rush-01.mp4",
  startMs: 2_000,
  endMs: 9_000,
  step,
  intendedFeeling: null,
  editAttempt: null,
  ...overrides,
});

describe("périmètre", () => {
  it("couvre les douze étapes par défaut", () => {
    expect(stepsInScope("all")).toHaveLength(12);
  });

  it("découpe par acte", () => {
    expect(stepsInScope("depart")).toEqual([1, 2, 3, 4]);
    expect(stepsInScope("initiation")).toEqual([5, 6, 7, 8, 9]);
    expect(stepsInScope("retour")).toEqual([10, 11, 12]);
  });

  it("accepte une étape seule", () => {
    expect(stepsInScope(8)).toEqual([8]);
  });

  it("nomme le périmètre comme un monteur le dirait", () => {
    expect(scopeLabel("retour")).toBe("l'acte III — Le retour");
    expect(scopeLabel("all")).toBe("le récit complet");
    expect(scopeLabel(8)).toContain("l'étape 8");
  });
});

describe("composition du brief", () => {
  const beats = [
    beat(10, "Je débranche le NAS.", 55),
    beat(11, null),
    beat(12, "Le même plan.", 35),
  ];
  const markers = [marker("Débranchement", 10), marker("Plan de bureau", 12)];

  it("ne retient que les étapes du périmètre", () => {
    const { content, totalSteps } = buildNarrativeBrief({
      videoTitle: "Ma vidéo",
      scope: "retour",
      beats,
      markers,
    });
    expect(totalSteps).toBe(3);
    expect(content).toContain("### 10.");
    expect(content).not.toContain("### 9.");
  });

  it("annonce une étape vide au lieu de la combler", () => {
    const { content, coveredSteps } = buildNarrativeBrief({
      videoTitle: "Ma vidéo",
      scope: "retour",
      beats,
      markers,
    });
    // L'étape 11 n'a pas de note : le brief doit le dire, pas l'inventer.
    expect(content).toContain("aucune note");
    expect(coveredSteps).toBe(2);
  });

  it("écarte les marqueurs hors périmètre", () => {
    const { markerCount, content } = buildNarrativeBrief({
      videoTitle: "Ma vidéo",
      scope: "retour",
      beats,
      markers: [...markers, marker("Hors sujet", 2), marker("Sans étape", null)],
    });
    expect(markerCount).toBe(2);
    expect(content).not.toContain("Hors sujet");
    expect(content).not.toContain("Sans étape");
  });

  it("donne le rush et la plage de timecodes", () => {
    const { content } = buildNarrativeBrief({
      videoTitle: "Ma vidéo",
      scope: 10,
      beats,
      markers,
    });
    expect(content).toContain("rush-01.mp4 00:00:02.000 → 00:00:09.000");
  });

  it("rend un point sans flèche, puisqu'il n'a pas de fin", () => {
    const { content } = buildNarrativeBrief({
      videoTitle: "Ma vidéo",
      scope: 10,
      beats,
      markers: [marker("Un repère", 10, { endMs: null })],
    });
    expect(content).toContain("00:00:02.000");
    expect(content).not.toContain("→");
  });

  it("porte la sensation visée et l'essai de montage quand ils existent", () => {
    const { content } = buildNarrativeBrief({
      videoTitle: "Ma vidéo",
      scope: 10,
      beats,
      markers: [
        marker("Un plan", 10, {
          intendedFeeling: "soulagement",
          editAttempt: "couper avant le regard",
        }),
      ],
    });
    expect(content).toContain("sensation visée : soulagement");
    expect(content).toContain("essai de montage : couper avant le regard");
  });

  it("interdit explicitement d'inventer", () => {
    // Le garde-fou qui compte : sans lui, un modèle comble les trous de lui-même.
    const { content } = buildNarrativeBrief({
      videoTitle: "Ma vidéo",
      scope: "all",
      beats,
      markers,
    });
    expect(content).toContain("N'invente aucune scène");
  });

  it("rappelle que les timecodes sont relatifs au rush", () => {
    const { content } = buildNarrativeBrief({
      videoTitle: "Ma vidéo",
      scope: "all",
      beats,
      markers,
    });
    expect(content).toContain("relatifs à leur rush");
  });

  it("conserve l'ordre reçu, qui est l'ordre narratif", () => {
    const { content } = buildNarrativeBrief({
      videoTitle: "Ma vidéo",
      scope: 10,
      beats,
      markers: [marker("Deuxième", 10), marker("Premier", 10)],
    });
    expect(content.indexOf("Deuxième")).toBeLessThan(content.indexOf("Premier"));
  });
});
