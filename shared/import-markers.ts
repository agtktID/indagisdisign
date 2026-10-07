/**
 * Relire un carnet de marqueurs écrit ailleurs.
 *
 * L'échange était à sens unique : Studio produisait un CSV et un EDL, il n'en lisait
 * aucun. Or le monteur pose déjà ses repères dans Resolve pendant qu'il dérushe. Les
 * retaper un par un était le prix d'entrée du produit, et le plus cher.
 *
 * **Le principe tenu partout ici : rejeter plutôt que deviner.** Une ligne
 * incompréhensible est rendue avec son numéro et sa raison. Un carnet à moitié faux
 * coûte plus cher qu'un carnet vide, parce qu'on ne sait pas quelle moitié.
 *
 * **Les timecodes lus sont relatifs à leur rush**, comme ceux qu'on écrit. C'est
 * pourquoi l'EDL est lu sur ses timecodes *source* et jamais sur ses *record* : le
 * record dit où le passage tombe dans l'assemblage, une information qui n'existe pas
 * encore et qui changera au premier coup de ciseaux.
 */
import { EXPORT_FRAME_RATES, type ExportFrameRate } from "./export-formats.ts";

export type ImportFormat = "csv" | "edl" | "lines";

/** Exactement les champs qu'`upsert-marker` accepte. */
export interface ImportedMarker {
  label: string;
  rushName: string | null;
  startMs: number;
  endMs: number | null;
  step: number | null;
  intendedFeeling: string | null;
  editAttempt: string | null;
}

export interface RejectedLine {
  /** Numéro de ligne dans le texte fourni, à partir de 1. */
  line: number;
  raw: string;
  reason: string;
}

export interface ImportReport {
  format: ImportFormat;
  markers: ImportedMarker[];
  rejected: RejectedLine[];
}

/** Au-delà, c'est un collage accidentel plutôt qu'un dérushage. */
const DEFAULT_MAX_ROWS = 500;

/**
 * Lire un timecode.
 *
 * Accepte ce qu'un monteur écrit réellement : `1:30`, `01:02:03`, `4,2`, `4.2`,
 * `00:00:04.200`. Avec une cadence, accepte en plus le timecode d'images `00:00:04:05`
 * — quatre groupes, le dernier comptant des images.
 *
 * Rend `null` plutôt que zéro sur ce qu'il ne comprend pas : un marqueur silencieusement
 * placé à zéro est pire qu'un marqueur refusé.
 */
export function parseMarkerTimecode(value: string, fps?: ExportFrameRate): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Un entier seul, ce sont des millisecondes — c'est ce que notre CSV écrit.
  if (/^\d+$/.test(trimmed)) return Number(trimmed);

  const parts = trimmed.split(":").map((part) => part.trim());
  if (parts.length > 4 || parts.some((part) => part === "")) return null;

  // Quatre groupes = heures:minutes:secondes:images. Sans cadence on ne peut pas
  // convertir les images, et en supposer une décalerait tout en silence.
  if (parts.length === 4) {
    if (!fps) return null;
    const [hours, minutes, seconds, frames] = parts.map((part) => Number(part));
    if ([hours, minutes, seconds, frames].some((n) => !Number.isFinite(n))) return null;
    return Math.round(
      ((hours! * 60 + minutes!) * 60 + seconds!) * 1000 + (frames! * 1000) / fps,
    );
  }

  const numbers = parts.map((part) => Number(part.replace(",", ".")));
  if (numbers.some((n) => !Number.isFinite(n))) return null;
  const seconds = numbers.pop()!;
  const minutes = numbers.pop() ?? 0;
  const hours = numbers.pop() ?? 0;
  return Math.round(((hours * 60 + minutes) * 60 + seconds) * 1000);
}

/** Les colonnes que notre export écrit, et qu'un import sait relire. */
const KNOWN_COLUMNS = [
  "ordre",
  "etape",
  "titre_etape",
  "intitule",
  "rush",
  "debut_ms",
  "fin_ms",
  "debut_tc",
  "fin_tc",
  "sensation_visee",
  "essai_montage",
];

/**
 * Reconnaître le format à ce qu'il annonce de lui-même.
 *
 * Un CSV est reconnu à **deux colonnes connues au moins**, et non à la seule présence
 * d'`intitule`. La nuance compte : un CSV auquel il manque justement `intitule` doit
 * être reconnu comme un CSV pour qu'on puisse dire ce qui lui manque. Le prendre pour
 * des lignes libres ferait répondre « aucun timecode lisible » à un fichier dont le
 * seul défaut est une colonne absente.
 */
export function detectImportFormat(content: string): ImportFormat {
  const head = content.slice(0, 2000);
  if (/^\s*TITLE:/m.test(head) || /^\s*FCM:/m.test(head)) return "edl";
  const firstLine = head.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
  const cells = csvCells(firstLine).map((cell) => cell.toLowerCase());
  if (cells.filter((cell) => KNOWN_COLUMNS.includes(cell)).length >= 2) return "csv";
  return "lines";
}

/** Découper une ligne CSV en respectant les guillemets. */
function csvCells(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"') {
        // `""` à l'intérieur d'une cellule citée vaut un guillemet littéral.
        if (line[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells.map((value) => value.trim());
}

function blank(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Les validations communes à tous les formats, écrites une seule fois. */
function buildMarker(
  fields: {
    label: string | null;
    rushName: string | null;
    startMs: number | null;
    endMs: number | null;
    step: number | null;
    intendedFeeling: string | null;
    editAttempt: string | null;
  },
  reject: (reason: string) => void,
): ImportedMarker | null {
  if (fields.startMs === null) {
    reject("aucun timecode lisible");
    return null;
  }
  if (!fields.label) {
    reject("intitulé absent");
    return null;
  }
  if (fields.endMs !== null && fields.endMs < fields.startMs) {
    reject("la fin précède le début");
    return null;
  }
  if (fields.step !== null && (fields.step < 1 || fields.step > 12)) {
    reject("étape hors de 1–12");
    return null;
  }
  return {
    label: fields.label,
    rushName: fields.rushName,
    startMs: fields.startMs,
    endMs: fields.endMs,
    step: fields.step,
    intendedFeeling: fields.intendedFeeling,
    editAttempt: fields.editAttempt,
  };
}

/**
 * Lire un bloc collé, une ligne par passage.
 *
 * `rush-01.mp4 1:30 1:45 Ouverture`, `2:00 2:10 Plan de coupe`, `rush.mov 0:08 Le regard`.
 * Le rush est reconnu à ce qu'il **n'est pas** un timecode ; la fin est facultative —
 * sans elle le marqueur est un point, qui ne pèse aucune durée dans le diagnostic.
 */
function parseLines(
  lines: { number: number; raw: string }[],
  reject: (line: number, raw: string, reason: string) => void,
): ImportedMarker[] {
  const markers: ImportedMarker[] = [];
  for (const { number, raw } of lines) {
    const tokens = raw
      .trim()
      .split(/[\t;]+|\s+/)
      .filter(Boolean);
    let cursor = 0;
    let rushName: string | null = null;

    if (tokens[0] !== undefined && parseMarkerTimecode(tokens[0]) === null) {
      rushName = tokens[0];
      cursor = 1;
    }

    const startMs = parseMarkerTimecode(tokens[cursor] ?? "");
    if (startMs !== null) cursor += 1;
    const endMs = parseMarkerTimecode(tokens[cursor] ?? "");
    if (endMs !== null) cursor += 1;

    const marker = buildMarker(
      {
        label: blank(tokens.slice(cursor).join(" ")),
        rushName,
        startMs,
        endMs,
        step: null,
        intendedFeeling: null,
        editAttempt: null,
      },
      (reason) => reject(number, raw, reason),
    );
    if (marker) markers.push(marker);
  }
  return markers;
}

/**
 * Lire un CSV, le nôtre comme un autre.
 *
 * Les colonnes sont trouvées **par leur nom**, jamais par leur rang : un tableur qui
 * réordonne ou ajoute une colonne ne doit pas décaler tout l'import. Seule `intitule`
 * est obligatoire — sans elle, le fichier n'est pas un carnet.
 */
function parseCsv(
  lines: { number: number; raw: string }[],
  reject: (line: number, raw: string, reason: string) => void,
): ImportedMarker[] {
  const header = lines[0];
  if (!header) return [];
  const columns = csvCells(header.raw).map((name) => name.toLowerCase());
  const at = (row: string[], name: string): string | undefined => {
    const index = columns.indexOf(name);
    return index === -1 ? undefined : row[index];
  };

  if (!columns.includes("intitule")) {
    reject(header.number, header.raw, "colonne « intitule » absente");
    return [];
  }

  const markers: ImportedMarker[] = [];
  for (const { number, raw } of lines.slice(1)) {
    const row = csvCells(raw);
    const num = (name: string): number | null => {
      const value = blank(at(row, name));
      if (value === null) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    // `debut_ms` est exact ; `debut_tc` est arrondi par l'affichage. Quand les deux sont
    // présents, c'est le brut qui gagne.
    const startMs = num("debut_ms") ?? parseMarkerTimecode(at(row, "debut_tc") ?? "");
    const endMs = num("fin_ms") ?? parseMarkerTimecode(at(row, "fin_tc") ?? "");

    const marker = buildMarker(
      {
        label: blank(at(row, "intitule")),
        rushName: blank(at(row, "rush")),
        startMs,
        endMs,
        step: num("etape"),
        intendedFeeling: blank(at(row, "sensation_visee")),
        editAttempt: blank(at(row, "essai_montage")),
      },
      (reason) => reject(number, raw, reason),
    );
    if (marker) markers.push(marker);
  }
  return markers;
}

/**
 * Lire un EDL CMX3600.
 *
 * Un événement tient sur une ligne, suivie de commentaires qui le nomment :
 *
 *     001  REEL0001 V     C        <src-in> <src-out> <rec-in> <rec-out>
 *     * FROM CLIP NAME: rush-01.mp4
 *     * COMMENT: Bureau, disques durs
 *
 * **Seuls les deux premiers timecodes sont lus.** Les deux suivants décrivent la place
 * du passage dans l'assemblage — une information qui n'existe pas dans le carnet et qui
 * changera dès la première coupe.
 */
function parseEdl(
  lines: { number: number; raw: string }[],
  fps: ExportFrameRate | undefined,
  reject: (line: number, raw: string, reason: string) => void,
): ImportedMarker[] {
  const event =
    /^\s*(\d{1,6})\s+(\S+)\s+\S+\s+\S+\s+(\d{2}:\d{2}:\d{2}[:;]\d{2})\s+(\d{2}:\d{2}:\d{2}[:;]\d{2})/;

  if (!fps) {
    const first = lines.find(({ raw }) => event.test(raw));
    if (first) {
      reject(
        first.number,
        first.raw,
        "cadence manquante : un EDL ne la porte pas, et la supposer décalerait tous " +
          `les timecodes. Choisir parmi ${EXPORT_FRAME_RATES.join(", ")}`,
      );
    }
    return [];
  }

  const markers: ImportedMarker[] = [];
  let current: { marker: ImportedMarker; reel: string } | null = null;

  const flush = () => {
    if (current) markers.push(current.marker);
    current = null;
  };

  for (const { number, raw } of lines) {
    const match = event.exec(raw);
    if (match) {
      flush();
      const reel = match[2]!;
      const startMs = parseMarkerTimecode(match[3]!.replace(";", ":"), fps);
      const endMs = parseMarkerTimecode(match[4]!.replace(";", ":"), fps);
      if (startMs === null) {
        reject(number, raw, "aucun timecode lisible");
        continue;
      }
      // Le nom de bobine fait un intitulé provisoire : un EDL d'une autre source n'a
      // pas toujours de commentaire, et un événement nommé par sa bobine vaut mieux
      // qu'un rejet.
      current = {
        reel,
        marker: {
          label: reel,
          rushName: null,
          startMs,
          endMs,
          step: null,
          intendedFeeling: null,
          editAttempt: null,
        },
      };
      continue;
    }

    if (!current) continue;
    const clip = /^\s*\*\s*FROM CLIP NAME:\s*(.+?)\s*$/i.exec(raw);
    if (clip) {
      current.marker.rushName = clip[1]!;
      continue;
    }
    const comment = /^\s*\*\s*(?:COMMENT:)?\s*(.+?)\s*$/i.exec(raw);
    if (comment && current.marker.label === current.reel) {
      current.marker.label = comment[1]!;
    }
  }
  flush();
  return markers;
}

/**
 * Lire un carnet, quel que soit son format.
 *
 * Le format est reconnu tout seul, ou imposé. La cadence n'est utile qu'à l'EDL, et y
 * est **obligatoire** : aucune n'est devinée, pour la même raison qu'à l'export — une
 * cadence fausse décale tout, et le décalage est silencieux.
 */
export function parseMarkers(
  content: string,
  options: { format?: ImportFormat; fps?: ExportFrameRate; maxRows?: number } = {},
): ImportReport {
  const format = options.format ?? detectImportFormat(content);
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
  const rejected: RejectedLine[] = [];
  const reject = (line: number, raw: string, reason: string) =>
    rejected.push({ line, raw, reason });

  const lines = content
    .split(/\r?\n/)
    .map((raw, index) => ({ number: index + 1, raw }))
    .filter(({ raw }) => raw.trim().length > 0);

  const markers =
    format === "csv"
      ? parseCsv(lines, reject)
      : format === "edl"
        ? parseEdl(lines, options.fps, reject)
        : parseLines(lines, reject);

  if (markers.length > maxRows) {
    rejected.push({
      line: 0,
      raw: "",
      reason: `au-delà de ${maxRows} marqueurs, le reste est ignoré — ${markers.length} lus`,
    });
    return { format, markers: markers.slice(0, maxRows), rejected };
  }

  return { format, markers, rejected };
}
