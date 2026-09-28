/**
 * Helpers partagés par les actions Studio.
 *
 * Objectif : que chaque action se concentre sur sa logique métier, et que les règles
 * transverses — estampillage du propriétaire, contrôle d'accès, validation d'étape —
 * aient une seule implémentation.
 */

import { getRequestOrgId, getRequestUserEmail } from "@agent-native/core/server/request-context";
import { accessFilter, assertAccess } from "@agent-native/core/sharing";
import { and, eq, isNull } from "@agent-native/core/db/schema";
import type { AnyColumn } from "drizzle-orm";

import { isValidStep, LAST_STEP, FIRST_STEP } from "../shared/hero-journey.ts";
import { MAX_INTENSITY, MIN_INTENSITY } from "../shared/constants.ts";
import { getDb, schema, type Video } from "./db/index.ts";

/** Type de ressource partageable inscrit dans `server/db/index.ts`. */
export const RESOURCE_TYPE = "studio-video";

/**
 * L'email du propriétaire, depuis le contexte de requête.
 *
 * Jamais de repli sur une valeur sentinelle : cela regrouperait toutes les écritures non
 * authentifiées dans un même locataire partagé.
 */
export function requireOwnerEmail(): string {
  const ownerEmail = getRequestUserEmail();
  if (!ownerEmail) {
    throw new Error("Non authentifié : impossible d'écrire sans session utilisateur.");
  }
  return ownerEmail;
}

/** Colonnes de propriété à poser sur toute ligne créée. */
export function ownerStamp(): { ownerEmail: string; orgId: string | null } {
  return { ownerEmail: requireOwnerEmail(), orgId: getRequestOrgId() ?? null };
}

/**
 * Charge une vidéo accessible au demandeur, ou lève une erreur nommée.
 * Ne renvoie jamais `undefined` silencieusement : une vidéo introuvable est une
 * information, pas un résultat vide.
 */
export async function loadVideo(videoId: string): Promise<Video> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.videos)
    .where(
      and(
        eq(schema.videos.id, videoId),
        accessFilter(schema.videos, schema.videoShares),
      ),
    )
    .limit(1);

  const video = rows[0];
  if (!video) {
    throw new Error(
      `Vidéo « ${videoId} » introuvable, ou vous n'y avez pas accès. Vérifiez l'identifiant avec list-videos.`,
    );
  }
  return video;
}

/** Vérifie le droit d'écriture sur une vidéo avant toute mutation. */
export async function assertVideoEditable(videoId: string): Promise<void> {
  await assertAccess(RESOURCE_TYPE, videoId, "editor");
}

/** Charge une vidéo et vérifie le droit d'écriture, en un geste. */
export async function loadVideoForWrite(videoId: string): Promise<Video> {
  const video = await loadVideo(videoId);
  await assertVideoEditable(videoId);
  return video;
}

/** Filtre d'accès sur la table des vidéos, pour les lectures de liste. */
export function videoAccessFilter() {
  return accessFilter(schema.videos, schema.videoShares);
}

/** Filtre « vidéos actives » : accessibles et non archivées. */
export function activeVideosFilter() {
  return and(videoAccessFilter(), isNull(schema.videos.archivedAt));
}

/**
 * Filtre « m'appartient » pour les tables de la bibliothèque.
 *
 * Ces tables ne sont pas des ressources partageables : pas de table de partages, pas
 * d'`accessFilter`. La portée est donc l'utilisateur courant, explicitement.
 */
export function ownedByCurrentUser(table: { ownerEmail: AnyColumn }) {
  return eq(table.ownerEmail, requireOwnerEmail());
}

/** Valide un numéro d'étape narrative, ou lève avec un message actionnable. */
export function assertStep(step: number): number {
  if (!isValidStep(step)) {
    throw new Error(
      `Étape ${step} invalide : le voyage du héros compte ${LAST_STEP} étapes, numérotées de ${FIRST_STEP} à ${LAST_STEP}.`,
    );
  }
  return step;
}

/** Valide une intensité émotionnelle, ou lève avec un message actionnable. */
export function assertIntensity(intensity: number): number {
  if (
    !Number.isInteger(intensity) ||
    intensity < MIN_INTENSITY ||
    intensity > MAX_INTENSITY
  ) {
    throw new Error(
      `Intensité ${intensity} invalide : attendu un entier entre ${MIN_INTENSITY} et ${MAX_INTENSITY}.`,
    );
  }
  return intensity;
}

/** Nombre de jours entiers écoulés depuis un horodatage ISO. */
export function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 0;
  return Math.floor((Date.now() - then) / 86_400_000);
}

/** Convertit des millisecondes en timecode lisible `HH:MM:SS.mmm`. */
export function msToTimecode(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "";
  const total = Math.max(0, Math.floor(ms));
  const hours = Math.floor(total / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  const millis = total % 1000;
  const pad = (value: number, size = 2) => String(value).padStart(size, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(millis, 3)}`;
}
