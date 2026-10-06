/**
 * Les formats d'export du carnet, en fonctions pures et testables.
 *
 * ## Ce que nos données permettent, et ce qu'elles ne permettent pas
 *
 * `startMs` et `endMs` sont **relatifs à leur rush**, jamais à un montage. On ne connaît
 * donc aucune position dans la vidéo finale — elle n'existe pas encore.
 *
 * Ce qu'on connaît en revanche, c'est l'**ordre narratif** (`sortOrder`). Mis bout à
 * bout dans cet ordre, les passages forment un **assemblage** : chaque plan garde ses
 * timecodes source, et reçoit une position cumulée sur la timeline.
 *
 * C'est exactement ce qu'un EDL encode. Les positions produites ne sont donc pas une
 * supposition : elles décrivent l'assemblage brut que l'export propose, sur lequel le
 * monteur travaillera ensuite.
 *
 * ## Limite assumée
 *
 * Ces sorties n'ont **pas été ré-importées dans Resolve ou Premiere** depuis ce dépôt.
 * Les invariants de structure sont testés — numérotation, cadence, monotonie des
 * timecodes d'enregistrement, troncature des bobines. La compatibilité réelle avec un
 * logiciel donné reste à confirmer par qui l'essaiera.
 */

/** Ce qu'un format d'export a besoin de savoir d'un marqueur. */
export interface ExportableMarker {
  label: string;
  rushName: string | null;
  startMs: number;
  endMs: number | null;
  step: number | null;
}

/**
 * Les cadences acceptées.
 *
 * Aucune n'est devinée : une cadence fausse décale tout l'export, et le décalage est
 * silencieux. Mieux vaut l'exiger que la supposer.
 */
export const EXPORT_FRAME_RATES = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60] as const;
export type ExportFrameRate = (typeof EXPORT_FRAME_RATES)[number];

/**
 * Convertit des millisecondes en nombre de trames.
 *
 * Pour les cadences fractionnaires (23,976 · 29,97 · 59,94), la base entière sert à
 * écrire le timecode — c'est la convention du **non-drop frame**, qui dérive lentement
 * de l'horloge murale. Le drop-frame, lui, saute des numéros de trame pour rester
 * aligné ; il n'est pas émis ici, et l'en-tête `FCM:` le déclare.
 */
export function msToFrames(ms: number, fps: ExportFrameRate): number {
  return Math.round((ms / 1000) * Math.round(fps));
}

/** Timecode `HH:MM:SS:FF`, non-drop. */
export function framesToTimecode(frames: number, fps: ExportFrameRate): string {
  const base = Math.round(fps);
  const safe = Math.max(0, Math.round(frames));
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    pad(Math.floor(safe / (base * 3600))),
    pad(Math.floor((safe % (base * 3600)) / (base * 60))),
    pad(Math.floor((safe % (base * 60)) / base)),
    pad(safe % base),
  ].join(":");
}

/**
 * Un identifiant de bobine conforme au CMX3600 : huit caractères au plus, en majuscules.
 *
 * Les vrais noms de rush sont presque toujours plus longs (`interview-02.mp4`). L'usage
 * établi est de tronquer ici et de porter le nom complet dans le commentaire
 * `* FROM CLIP NAME:`, que les logiciels de montage lisent.
 */
export function reelName(rushName: string | null, index: number): string {
  if (!rushName) return `AX${String(index + 1).padStart(6, "0")}`;
  const cleaned = rushName
    .replace(/\.[^.]+$/, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
  return (cleaned || `AX${index + 1}`).slice(0, 8);
}

/** Un marqueur sans fin ne dure rien : il ne peut pas devenir un plan. */
function isAssemblable(marker: ExportableMarker): boolean {
  return marker.endMs !== null && marker.endMs > marker.startMs;
}

/**
 * Un EDL CMX3600 d'assemblage.
 *
 * Les marqueurs arrivent **dans l'ordre où ils doivent être montés** — c'est à
 * l'appelant de les trier. Chaque plan conserve ses timecodes source ; les timecodes
 * d'enregistrement se cumulent, donc le premier commence à `00:00:00:00`.
 *
 * Les marqueurs ponctuels (sans `endMs`) sont ignorés : un point n'est pas un plan.
 * Leur nombre est renvoyé plutôt que passé sous silence, pour que l'appelant le dise.
 */
export function toEdl(
  markers: readonly ExportableMarker[],
  options: { title: string; fps: ExportFrameRate },
): { content: string; eventCount: number; skippedPoints: number } {
  const { title, fps } = options;
  const clips = markers.filter(isAssemblable);
  const skippedPoints = markers.length - clips.length;

  const lines = [
    `TITLE: ${title.replace(/[\r\n]+/g, " ").slice(0, 70)}`,
    "FCM: NON-DROP FRAME",
  ];

  let recordFrames = 0;
  clips.forEach((marker, index) => {
    const sourceIn = msToFrames(marker.startMs, fps);
    const sourceOut = msToFrames(marker.endMs as number, fps);
    const duration = Math.max(1, sourceOut - sourceIn);
    const recordIn = recordFrames;
    const recordOut = recordIn + duration;
    recordFrames = recordOut;

    const event = String(index + 1).padStart(3, "0");
    const reel = reelName(marker.rushName, index).padEnd(8, " ");
    lines.push(
      `${event}  ${reel} V     C        ` +
        [
          framesToTimecode(sourceIn, fps),
          framesToTimecode(sourceOut, fps),
          framesToTimecode(recordIn, fps),
          framesToTimecode(recordOut, fps),
        ].join(" "),
    );
    if (marker.rushName) lines.push(`* FROM CLIP NAME: ${marker.rushName}`);
    lines.push(`* COMMENT: ${marker.label.replace(/[\r\n]+/g, " ")}`);
  });

  return { content: `${lines.join("\n")}\n`, eventCount: clips.length, skippedPoints };
}

/**
 * Des chapitres au format YouTube.
 *
 * YouTube impose trois règles, et les trois sont respectées ici : le premier chapitre
 * commence à `0:00`, il en faut **au moins trois**, et les horodatages sont croissants.
 * En deçà de trois plans assemblables, rien n'est produit — un export que la plateforme
 * refuserait ne rend service à personne.
 *
 * Les positions viennent de l'assemblage, pas d'un montage existant : elles changeront
 * dès que le monteur coupera. C'est un point de départ, pas un relevé.
 */
export function toYouTubeChapters(markers: readonly ExportableMarker[]): {
  content: string;
  chapterCount: number;
  refusal: string | null;
} {
  const clips = markers.filter(isAssemblable);
  if (clips.length < 3) {
    return {
      content: "",
      chapterCount: 0,
      refusal: `YouTube exige au moins trois chapitres ; l'assemblage n'en compte que ${clips.length}. Rattachez d'autres passages avec une fin, puis réessayez.`,
    };
  }

  const stamp = (ms: number) => {
    const total = Math.floor(ms / 1000);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const pad = (value: number) => String(value).padStart(2, "0");
    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
  };

  let position = 0;
  const lines = clips.map((marker) => {
    const line = `${stamp(position)} ${marker.label.replace(/[\r\n]+/g, " ")}`;
    position += (marker.endMs as number) - marker.startMs;
    return line;
  });

  return { content: `${lines.join("\n")}\n`, chapterCount: lines.length, refusal: null };
}
