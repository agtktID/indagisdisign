import { describe, expect, it } from "vitest";

import {
  framesToTimecode,
  msToFrames,
  reelName,
  toEdl,
  toYouTubeChapters,
  type ExportableMarker,
} from "../../shared/export-formats.js";

/** Un passage assemblable : il a une fin, donc il pèse une durée. */
const clip = (
  label: string,
  startMs: number,
  endMs: number,
  rushName: string | null = "rush-01.mp4",
): ExportableMarker => ({ label, rushName, startMs, endMs, step: null });

/** Un point : pas de fin, donc pas un plan. */
const point = (label: string, startMs = 0): ExportableMarker => ({
  label,
  rushName: "rush-01.mp4",
  startMs,
  endMs: null,
  step: null,
});

describe("conversion en trames", () => {
  it("convertit à la cadence demandée", () => {
    expect(msToFrames(1000, 25)).toBe(25);
    expect(msToFrames(1000, 30)).toBe(30);
    expect(msToFrames(500, 24)).toBe(12);
  });

  it("utilise la base entière pour les cadences fractionnaires", () => {
    // 29,97 s'écrit sur une base de 30 en non-drop : c'est la convention, et l'en-tête
    // FCM la déclare. Arrondir à 29 décalerait tout l'export.
    expect(msToFrames(1000, 29.97)).toBe(30);
    expect(msToFrames(1000, 23.976)).toBe(24);
  });

  it("écrit un timecode HH:MM:SS:FF", () => {
    expect(framesToTimecode(0, 25)).toBe("00:00:00:00");
    expect(framesToTimecode(25, 25)).toBe("00:00:01:00");
    expect(framesToTimecode(25 * 60, 25)).toBe("00:01:00:00");
    expect(framesToTimecode(25 * 3600, 25)).toBe("01:00:00:00");
    expect(framesToTimecode(25 * 3661 + 7, 25)).toBe("01:01:01:07");
  });

  it("ne produit jamais un numéro de trame égal à la cadence", () => {
    // 25 trames à 25 i/s font une seconde pleine, pas « :25 ».
    for (const frames of [24, 25, 26, 49, 50]) {
      const ff = framesToTimecode(frames, 25).split(":")[3];
      expect(Number(ff)).toBeLessThan(25);
    }
  });
});

describe("identifiant de bobine", () => {
  it("tronque à huit caractères, en majuscules", () => {
    expect(reelName("interview-02.mp4", 0)).toBe("INTERVIE");
    expect(reelName("rush-01.mp4", 0)).toBe("RUSH01");
  });

  it("fabrique un identifiant quand le rush n'est pas nommé", () => {
    expect(reelName(null, 0)).toBe("AX000001");
    expect(reelName(null, 11)).toBe("AX000012");
  });

  it("ne renvoie jamais plus de huit caractères", () => {
    for (const name of ["a".repeat(40), "é-é-é-é-é-é-é-é-é", "A004_C012_190101_R1AB.mov"]) {
      expect(reelName(name, 0).length).toBeLessThanOrEqual(8);
    }
  });
});

describe("EDL d'assemblage", () => {
  const markers = [
    clip("Ouverture", 4_000, 12_000, "rush-01.mp4"),
    clip("Le constat", 52_000, 61_000, "rush-03.mp4"),
    clip("La bascule", 0, 8_000, "interview-02.mp4"),
  ];

  it("porte un en-tête et déclare le non-drop", () => {
    const { content } = toEdl(markers, { title: "Mon montage", fps: 25 });
    expect(content.startsWith("TITLE: Mon montage\nFCM: NON-DROP FRAME\n")).toBe(true);
  });

  it("numérote les événements à partir de 001", () => {
    const { content, eventCount } = toEdl(markers, { title: "T", fps: 25 });
    expect(eventCount).toBe(3);
    expect(content).toContain("001  ");
    expect(content).toContain("002  ");
    expect(content).toContain("003  ");
  });

  it("commence la timeline à zéro et cumule sans trou", () => {
    const { content } = toEdl(markers, { title: "T", fps: 25 });
    const events = content.split("\n").filter((line) => /^\d{3}  /.test(line));
    const fields = events.map((line) => line.trim().split(/\s+/));
    const recordIn = fields.map((parts) => parts[parts.length - 2]);
    const recordOut = fields.map((parts) => parts[parts.length - 1]);

    expect(recordIn[0]).toBe("00:00:00:00");
    // La fin d'un plan est le début du suivant : un assemblage n'a pas de trou.
    expect(recordIn[1]).toBe(recordOut[0]);
    expect(recordIn[2]).toBe(recordOut[1]);
  });

  it("conserve les timecodes source, qui ne sont pas ceux de la timeline", () => {
    const { content } = toEdl([clip("Un plan", 52_000, 61_000)], { title: "T", fps: 25 });
    const event = content.split("\n").filter((line) => /^\d{3}  /.test(line))[0]!;
    const parts = event.trim().split(/\s+/);
    // source in/out viennent du rush ; record in/out partent de zéro.
    expect(parts[parts.length - 4]).toBe("00:00:52:00");
    expect(parts[parts.length - 3]).toBe("00:01:01:00");
    expect(parts[parts.length - 2]).toBe("00:00:00:00");
  });

  it("porte le vrai nom du rush en commentaire, puisque la bobine est tronquée", () => {
    const { content } = toEdl([clip("Un plan", 0, 1000, "interview-02.mp4")], {
      title: "T",
      fps: 25,
    });
    expect(content).toContain("INTERVIE");
    expect(content).toContain("* FROM CLIP NAME: interview-02.mp4");
  });

  it("ignore les points et le dit", () => {
    const { eventCount, skippedPoints } = toEdl(
      [clip("Un plan", 0, 1000), point("Un repère"), point("Un autre")],
      { title: "T", fps: 25 },
    );
    expect(eventCount).toBe(1);
    expect(skippedPoints).toBe(2);
  });

  it("donne au moins une trame à un passage trop court pour en faire une", () => {
    // 10 ms à 25 i/s arrondissent à 0 trame : un plan de durée nulle est invalide.
    const { content } = toEdl([clip("Éclair", 0, 10)], { title: "T", fps: 25 });
    const event = content.split("\n").filter((line) => /^\d{3}  /.test(line))[0]!;
    const parts = event.trim().split(/\s+/);
    expect(parts[parts.length - 1]).toBe("00:00:00:01");
  });

  it("neutralise un titre multiligne", () => {
    const { content } = toEdl([], { title: "Ligne 1\nLigne 2", fps: 25 });
    expect(content.split("\n")[0]).toBe("TITLE: Ligne 1 Ligne 2");
  });
});

describe("chapitres YouTube", () => {
  const markers = [
    clip("Le monde ordinaire", 0, 30_000),
    clip("L'appel", 0, 45_000),
    clip("Le climax", 0, 60_000),
  ];

  it("commence à 0:00, comme YouTube l'exige", () => {
    const { content } = toYouTubeChapters(markers);
    expect(content.split("\n")[0]).toBe("0:00 Le monde ordinaire");
  });

  it("cumule les durées de l'assemblage", () => {
    const { content, chapterCount } = toYouTubeChapters(markers);
    expect(chapterCount).toBe(3);
    expect(content.split("\n")[1]).toBe("0:30 L'appel");
    expect(content.split("\n")[2]).toBe("1:15 Le climax");
  });

  it("passe en heures au-delà de soixante minutes", () => {
    const long = [clip("A", 0, 3_600_000), clip("B", 0, 60_000), clip("C", 0, 60_000)];
    const { content } = toYouTubeChapters(long);
    expect(content.split("\n")[1]).toBe("1:00:00 B");
  });

  it("refuse en deçà de trois chapitres plutôt que produire un export rejeté", () => {
    const { content, chapterCount, refusal } = toYouTubeChapters([
      clip("A", 0, 1000),
      clip("B", 0, 1000),
    ]);
    expect(content).toBe("");
    expect(chapterCount).toBe(0);
    expect(refusal).toContain("au moins trois");
  });

  it("ne compte pas les points parmi les chapitres", () => {
    const { refusal } = toYouTubeChapters([clip("A", 0, 1000), point("B"), point("C")]);
    expect(refusal).not.toBeNull();
  });
});
