/**
 * Transformer une carte narrative en brief de composition.
 *
 * C'est la pièce qui manquait entre les deux moitiés du produit. L'écran « Créer »
 * assemblait modèle + kit de marque + demande, et ignorait entièrement les 12 étapes,
 * la courbe et les marqueurs — la bibliothèque était un produit posé à côté du produit.
 *
 * Ce que ça rend possible : « fais-moi un teaser de l'acte III depuis ma carte ». Aucun
 * autre outil ne peut exécuter cette phrase, parce qu'aucun autre ne possède à la fois
 * les étapes du récit et les timecodes réels des rushes.
 *
 * **Le brief décrit, il ne prescrit pas.** Il donne à l'agent la matière — ce que
 * l'utilisateur a écrit, ressenti, repéré — et le laisse composer. Il n'invente aucune
 * scène et ne comble aucun trou : une étape vide est annoncée comme vide, parce que
 * c'est une information utile, pas une lacune à masquer.
 */
import { ACTS, stepByNumber } from "./hero-journey.ts";

/** Ce qu'une étape apporte au brief. */
export interface BriefBeat {
  step: number;
  note: string | null;
  intensity: number | null;
  isCovered: boolean;
}

/** Ce qu'un marqueur apporte au brief. */
export interface BriefMarker {
  label: string;
  rushName: string | null;
  startMs: number;
  endMs: number | null;
  step: number | null;
  intendedFeeling: string | null;
  editAttempt: string | null;
}

/**
 * Le périmètre demandé : tout le récit, un acte, ou une seule étape.
 *
 * Un acte plutôt qu'une plage libre de numéros : les actes sont les unités que la
 * méthode nomme, et « l'acte III » est une phrase qu'un monteur prononce. « Les étapes
 * 10 à 12 » n'en est pas une.
 */
export type BriefScope = "all" | "depart" | "initiation" | "retour" | number;

/** Les étapes que le périmètre désigne. */
export function stepsInScope(scope: BriefScope): number[] {
  if (typeof scope === "number") return [scope];
  if (scope === "all") return Array.from({ length: 12 }, (_, index) => index + 1);
  const act = ACTS.find((candidate) => candidate.id === scope);
  return act ? [...act.steps] : [];
}

/** Le nom lisible du périmètre, pour l'en-tête du brief. */
export function scopeLabel(scope: BriefScope): string {
  if (typeof scope === "number") return `l'étape ${scope} — ${stepByNumber(scope).title}`;
  if (scope === "all") return "le récit complet";
  const act = ACTS.find((candidate) => candidate.id === scope);
  return act ? `l'acte ${act.numeral} — ${act.label}` : scope;
}

/** `00:01:23.400`, depuis le début du rush. */
function timecode(ms: number): string {
  const total = Math.max(0, Math.floor(ms));
  const pad = (value: number, size = 2) => String(value).padStart(size, "0");
  return (
    `${pad(Math.floor(total / 3_600_000))}:` +
    `${pad(Math.floor((total % 3_600_000) / 60_000))}:` +
    `${pad(Math.floor((total % 60_000) / 1000))}.` +
    `${pad(total % 1000, 3)}`
  );
}

/**
 * Compose le brief.
 *
 * Les marqueurs arrivent **dans l'ordre narratif** — c'est à l'appelant de les trier,
 * et cet ordre est précisément ce que la méthode distingue de l'ordre chronologique.
 */
export function buildNarrativeBrief(options: {
  videoTitle: string;
  scope: BriefScope;
  beats: readonly BriefBeat[];
  markers: readonly BriefMarker[];
}): { content: string; coveredSteps: number; totalSteps: number; markerCount: number } {
  const { videoTitle, scope, beats, markers } = options;
  const steps = stepsInScope(scope);
  const inScope = new Set(steps);

  const beatByStep = new Map(beats.map((beat) => [beat.step, beat]));
  const markersInScope = markers.filter(
    (marker) => marker.step !== null && inScope.has(marker.step),
  );

  const lines: string[] = [
    `Vidéo : ${videoTitle}`,
    `Périmètre : ${scopeLabel(scope)}`,
    "",
    "## La carte narrative",
    "",
  ];

  let covered = 0;
  for (const step of steps) {
    const reference = stepByNumber(step);
    const beat = beatByStep.get(step);
    if (beat?.isCovered) covered += 1;

    const intensity =
      beat?.intensity !== null && beat?.intensity !== undefined
        ? ` · intensité ${beat.intensity}/100`
        : "";
    lines.push(`### ${step}. ${reference.title}${intensity}`);

    if (beat?.isCovered && beat.note) {
      lines.push(beat.note.trim());
    } else {
      // Dire le vide plutôt que le combler : l'agent doit savoir qu'il n'a rien ici.
      lines.push("_(aucune note — cette étape n'est pas encore écrite)_");
    }

    const stepMarkers = markersInScope.filter((marker) => marker.step === step);
    if (stepMarkers.length > 0) {
      lines.push("", "Passages repérés :");
      for (const marker of stepMarkers) {
        const where = marker.rushName ? `${marker.rushName} ` : "";
        const span =
          marker.endMs === null
            ? timecode(marker.startMs)
            : `${timecode(marker.startMs)} → ${timecode(marker.endMs)}`;
        const extras = [
          marker.intendedFeeling ? `sensation visée : ${marker.intendedFeeling}` : null,
          marker.editAttempt ? `essai de montage : ${marker.editAttempt}` : null,
        ].filter(Boolean);
        lines.push(
          `- ${marker.label} — ${where}${span}${extras.length ? ` (${extras.join(" ; ")})` : ""}`,
        );
      }
    }
    lines.push("");
  }

  lines.push(
    "## Ce que cette matière permet, et ce qu'elle ne permet pas",
    "",
    `${covered} étape(s) sur ${steps.length} portent une note. ${markersInScope.length} passage(s) repéré(s).`,
    "",
    "Les timecodes sont **relatifs à leur rush**, jamais à un montage : ils disent où " +
      "retrouver un passage dans un fichier source, pas sa place dans la vidéo finale.",
    "",
    "N'invente aucune scène et ne comble aucune étape vide. Compose à partir de ce qui " +
      "est écrit ci-dessus ; si la matière manque pour ce qui est demandé, dis-le.",
  );

  return {
    content: lines.join("\n"),
    coveredSteps: covered,
    totalSteps: steps.length,
    markerCount: markersInScope.length,
  };
}
