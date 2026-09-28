/**
 * Accès base pour Indagis Studio.
 *
 * Les actions importent `getDb` et `schema` **depuis ce module**, jamais depuis
 * `@agent-native/core` directement : l'export du noyau n'est pas typé, celui-ci porte
 * les types de notre schéma.
 */

import { createGetDb } from "@agent-native/core/db";
import { registerShareableResource } from "@agent-native/core/sharing";

import { schema } from "./schema.ts";

export const getDb = createGetDb(schema);
export { schema };
export * from "./schema.ts";

/**
 * Une seule ressource partageable : la vidéo.
 *
 * Marqueurs, beats, réponses de préparation et essais héritent de l'accès à leur vidéo ;
 * ils ne sont pas partageables séparément. On partage un récit, pas un marqueur isolé.
 *
 * Cette inscription fait passer les lectures par `accessFilter()` et les écritures par
 * `assertAccess()` sans que chaque action ait à le recoder.
 *
 * `allowPublic` et `requireOrgMemberForUserShares` restent aux valeurs par défaut :
 * la skill `sharing` réserve ces verrous aux ressources « qui exécutent du code ou
 * exposent des données privilégiées avec les identifiants du lecteur ». Une vidéo Studio
 * ne stocke que du texte et des timecodes, et partager publiquement une carte narrative
 * pour la montrer à un pair est un usage légitime.
 */
registerShareableResource({
  type: "studio-video",
  resourceTable: schema.videos,
  sharesTable: schema.videoShares,
  displayName: "Vidéo",
  titleColumn: "title",
  getResourcePath: (video: { id: string }) => `/video/${video.id}`,
  getDb,
});

/** Identifiant de ligne. Node 22 fournit `crypto.randomUUID()` nativement. */
export function newId(): string {
  return globalThis.crypto.randomUUID();
}

/** Horodatage ISO-8601 UTC — lexicographiquement ordonné, donc comparable et triable. */
export function nowIso(): string {
  return new Date().toISOString();
}
