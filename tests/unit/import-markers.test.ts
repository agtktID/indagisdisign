/**
 * L'import du carnet, qui est l'exact inverse de l'export.
 *
 * Le principe que ces tests protègent : **rejeter plutôt que deviner.** Une ligne
 * incompréhensible est rendue à l'utilisateur avec son numéro et sa raison, jamais
 * devinée à moitié ni avalée en silence. Un carnet à moitié faux coûte plus cher qu'un
 * carnet vide, parce qu'on ne sait pas quelle moitié.
 */
import { describe, expect, it } from "vitest";

import { toEdl } from "../../shared/export-formats.js";
import {
  detectImportFormat,
  parseMarkerTimecode,
  parseMarkers,
} from "../../shared/import-markers.js";

describe("lire un timecode", () => {
  it("accepte les formes qu'un monteur écrit", () => {
    expect(parseMarkerTimecode("1:30")).toBe(90_000);
    expect(parseMarkerTimecode("01:02:03")).toBe(3_723_000);
    expect(parseMarkerTimecode("4,2")).toBe(4_200);
    expect(parseMarkerTimecode("4.2")).toBe(4_200);
    expect(parseMarkerTimecode("00:00:04.200")).toBe(4_200);
  });

  it("lit un timecode d'image quand la cadence est donnée", () => {
    // 00:00:04:05 à 25 i/s = 4 s + 5 images = 4200 ms.
    expect(parseMarkerTimecode("00:00:04:05", 25)).toBe(4_200);
  });

  it("refuse ce qu'il ne comprend pas, au lieu de rendre zéro", () => {
    expect(parseMarkerTimecode("")).toBeNull();
    expect(parseMarkerTimecode("bientôt")).toBeNull();
    expect(parseMarkerTimecode("1:2:3:4:5")).toBeNull();
  });
});

describe("reconnaître le format", () => {
  it("voit un EDL à son en-tête", () => {
    expect(detectImportFormat("TITLE: Essai\nFCM: NON-DROP FRAME\n")).toBe("edl");
  });

  it("voit un CSV à ses colonnes", () => {
    expect(detectImportFormat("ordre,etape,titre_etape,intitule,rush\n1,,,A,b\n")).toBe("csv");
  });

  it("retombe sur les lignes libres", () => {
    expect(detectImportFormat("rush-01.mp4 1:30 1:45 Ouverture")).toBe("lines");
  });
});

describe("lignes libres", () => {
  it("lit rush, début, fin et intitulé", () => {
    const { markers, rejected } = parseMarkers("rush-01.mp4 1:30 1:45 Ouverture");
    expect(rejected).toEqual([]);
    expect(markers).toEqual([
      {
        label: "Ouverture",
        rushName: "rush-01.mp4",
        startMs: 90_000,
        endMs: 105_000,
        step: null,
        intendedFeeling: null,
        editAttempt: null,
      },
    ]);
  });

  it("accepte un repère sans fin — c'est un point, pas un passage", () => {
    const { markers } = parseMarkers("rush-02.mov 0:08 Le regard");
    expect(markers[0]).toMatchObject({ startMs: 8_000, endMs: null, label: "Le regard" });
  });

  it("accepte une ligne sans rush", () => {
    const { markers } = parseMarkers("2:00 2:10 Plan de coupe");
    expect(markers[0]).toMatchObject({ rushName: null, startMs: 120_000, endMs: 130_000 });
  });

  it("tolère les tabulations, que les tableurs collent", () => {
    const { markers, rejected } = parseMarkers("rush-01.mp4\t1:30\t1:45\tOuverture");
    expect(rejected).toEqual([]);
    expect(markers[0]?.label).toBe("Ouverture");
  });

  it("ignore les lignes vides sans les compter comme des refus", () => {
    const { markers, rejected } = parseMarkers("\n\nrush-01.mp4 1:30 A\n\n");
    expect(markers).toHaveLength(1);
    expect(rejected).toEqual([]);
  });

  it("rend sa ligne et sa raison à ce qu'il refuse", () => {
    const { markers, rejected } = parseMarkers("rush-01.mp4 1:30 Bon\nn'importe quoi");
    expect(markers).toHaveLength(1);
    expect(rejected).toEqual([
      { line: 2, raw: "n'importe quoi", reason: "aucun timecode lisible" },
    ]);
  });

  it("refuse une fin antérieure au début", () => {
    const { rejected } = parseMarkers("rush-01.mp4 2:00 1:00 À l'envers");
    expect(rejected[0]?.reason).toBe("la fin précède le début");
  });

  it("refuse un passage sans intitulé — un marqueur anonyme ne sert à rien", () => {
    const { rejected } = parseMarkers("rush-01.mp4 1:30 1:45");
    expect(rejected[0]?.reason).toBe("intitulé absent");
  });
});

describe("CSV", () => {
  const entete =
    "ordre,etape,titre_etape,intitule,rush,debut_ms,fin_ms,debut_tc,fin_tc,sensation_visee,essai_montage";

  it("relit ce que l'export a écrit", () => {
    const csv = `${entete}\n1,8,Le climax,"Comparatif, plein écran",comparatif.mp4,8000,34000,00:00:08.000,00:00:34.000,tension,garder le tir lisible`;
    const { markers, rejected } = parseMarkers(csv);
    expect(rejected).toEqual([]);
    expect(markers[0]).toEqual({
      // La virgule dans l'intitulé est la raison d'être des guillemets : si elle casse,
      // tout aller-retour casse avec elle.
      label: "Comparatif, plein écran",
      rushName: "comparatif.mp4",
      startMs: 8_000,
      endMs: 34_000,
      step: 8,
      intendedFeeling: "tension",
      editAttempt: "garder le tir lisible",
    });
  });

  it("trouve ses colonnes par leur nom, pas par leur rang", () => {
    const { markers } = parseMarkers("intitule,rush,debut_tc\nOuverture,rush-01.mp4,1:30");
    expect(markers[0]).toMatchObject({ label: "Ouverture", startMs: 90_000 });
  });

  it("préfère les millisecondes au timecode quand les deux sont là", () => {
    // `debut_ms` est exact ; `debut_tc` est arrondi par l'affichage.
    const { markers } = parseMarkers(`${entete}\n1,,,A,r.mp4,8123,,00:00:08.000,,,`);
    expect(markers[0]?.startMs).toBe(8_123);
  });

  it("refuse une étape hors des douze", () => {
    const { rejected } = parseMarkers("intitule,debut_tc,etape\nA,1:00,13");
    expect(rejected[0]?.reason).toBe("étape hors de 1–12");
  });

  it("refuse un CSV sans colonne d'intitulé", () => {
    const { rejected, markers } = parseMarkers("rush,debut_tc\nr.mp4,1:00");
    expect(markers).toEqual([]);
    expect(rejected[0]?.reason).toContain("intitule");
  });

  it("laisse une cellule vide devenir une absence, pas une chaîne vide", () => {
    const { markers } = parseMarkers(`${entete}\n1,,,A,,1000,,,,,`);
    expect(markers[0]).toMatchObject({ rushName: null, endMs: null, step: null });
  });
});

describe("EDL", () => {
  it("relit l'EDL que nous produisons — l'aller-retour tient", () => {
    const { content } = toEdl(
      [
        { label: "Bureau", rushName: "rush-01.mp4", startMs: 4_200, endMs: 11_800, step: 1 },
        { label: "Le NAS", rushName: "rush-12.mp4", startMs: 2_000, endMs: 9_000, step: 10 },
      ],
      { title: "Essai", fps: 25 },
    );

    const { markers, rejected } = parseMarkers(content, { fps: 25 });
    expect(rejected).toEqual([]);
    expect(markers).toHaveLength(2);
    expect(markers[0]).toMatchObject({
      label: "Bureau",
      rushName: "rush-01.mp4",
      startMs: 4_200,
      endMs: 11_800,
    });
    expect(markers[1]).toMatchObject({ label: "Le NAS", startMs: 2_000, endMs: 9_000 });
  });

  it("lit les timecodes SOURCE, pas les record", () => {
    // Le deuxième événement commence à 0 dans son rush mais à 7,6 s dans l'assemblage.
    // Prendre le record ferait croire que le passage est ailleurs dans le fichier.
    const { content } = toEdl(
      [
        { label: "A", rushName: "a.mp4", startMs: 0, endMs: 7_600 },
        { label: "B", rushName: "b.mp4", startMs: 0, endMs: 4_000 },
      ],
      { title: "T", fps: 25 },
    );
    const { markers } = parseMarkers(content, { fps: 25 });
    expect(markers[1]?.startMs).toBe(0);
  });

  it("exige une cadence, au lieu d'en supposer une", () => {
    const edl =
      "TITLE: T\nFCM: NON-DROP FRAME\n001  REEL0001 V     C        00:00:01:00 00:00:02:00 00:00:00:00 00:00:01:00\n";
    const { markers, rejected } = parseMarkers(edl);
    expect(markers).toEqual([]);
    expect(rejected[0]?.reason).toContain("cadence");
  });

  it("nomme le passage d'après le commentaire, et le rush d'après FROM CLIP NAME", () => {
    const edl = [
      "TITLE: T",
      "FCM: NON-DROP FRAME",
      "001  REEL0001 V     C        00:00:04:05 00:00:11:20 00:00:00:00 00:00:07:15",
      "* FROM CLIP NAME: rush-01.mp4",
      "* COMMENT: Bureau, disques durs",
    ].join("\n");
    const { markers } = parseMarkers(edl, { fps: 25 });
    expect(markers[0]).toMatchObject({
      label: "Bureau, disques durs",
      rushName: "rush-01.mp4",
    });
  });

  it("retombe sur le nom de bobine quand aucun commentaire ne nomme le passage", () => {
    const edl = [
      "TITLE: T",
      "FCM: NON-DROP FRAME",
      "001  RUSH0001 V     C        00:00:04:00 00:00:08:00 00:00:00:00 00:00:04:00",
    ].join("\n");
    const { markers, rejected } = parseMarkers(edl, { fps: 25 });
    expect(rejected).toEqual([]);
    expect(markers[0]?.label).toBe("RUSH0001");
  });
});

describe("garde-fous communs", () => {
  it("plafonne le nombre de marqueurs lus", () => {
    const lignes = Array.from({ length: 600 }, (_, i) => `r.mp4 0:0${i % 10} Plan ${i}`).join(
      "\n",
    );
    const { markers, rejected } = parseMarkers(lignes, { maxRows: 500 });
    expect(markers).toHaveLength(500);
    expect(rejected.at(-1)?.reason).toContain("500");
  });

  it("ne rend jamais un marqueur sans intitulé, quel que soit le format", () => {
    for (const source of ["rush.mp4 1:00 1:10", "intitule,debut_tc\n ,1:00"]) {
      const { markers } = parseMarkers(source);
      expect(markers.every((marker) => marker.label.trim().length > 0)).toBe(true);
    }
  });
});
