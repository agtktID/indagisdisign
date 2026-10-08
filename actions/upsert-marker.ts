import { defineAction } from "@agent-native/core/action";
import { eq } from "@agent-native/core/db/schema";
import { and, desc } from "drizzle-orm";
import { z } from "zod";

import { nullableInteger } from "../shared/cli-compat.ts";

import { getDb, newId, nowIso, schema } from "../server/db/index.ts";
import { assertStep, loadVideoForWrite, msToTimecode, ownerStamp } from "../server/studio.ts";

export default defineAction({
  description:
    "Créer ou modifier un marqueur du carnet : un passage repéré dans les rushes, avec ses timecodes en millisecondes, l'étape narrative qu'il sert, la sensation visée et l'essai de montage tenté. Sans markerId, le marqueur est créé en fin d'ordre narratif.",
  schema: z.object({
    videoId: z.string().describe("Identifiant de la vidéo"),
    markerId: z.string().optional().describe("Marqueur à modifier ; absent = création"),
    label: z.string().min(1).describe("Intitulé du passage"),
    rushName: z.string().optional().describe("Fichier ou prise d'origine"),
    startMs: z.number().int().min(0).describe("Début, en millisecondes"),
    // `null` efface la fin, `undefined` la laisse telle quelle — même convention que
    // `step` plus bas. Sans cette distinction, l'interface ne pouvait pas transformer
    // un intervalle en point. `nullableInteger` parce que `.nullable()` désactive la
    // conversion automatique des arguments de ligne de commande.
    endMs: nullableInteger(
      "Fin, en millisecondes ; absent = inchangé, null = le marqueur devient un point",
    ).optional(),
    // La CLI passe les arguments en chaînes ; la conversion automatique du framework
    // ne s'applique pas aux champs `nullable`. On la fait explicitement pour que
    // l'action réponde sur toutes ses surfaces, CLI comprise.
    step: z
      .preprocess(
        (value) =>
          value === "" || value === "null" || value === null
            ? null
            : typeof value === "string"
              ? Number(value)
              : value,
        z.number().int().nullable(),
      )
      .optional()
      .describe("Étape narrative 1 à 12, ou null — une étape peut manquer"),
    intendedFeeling: z.string().optional().describe("Sensation visée"),
    editAttempt: z.string().optional().describe("Ce qui a été tenté au montage"),
  }),
  run: async (args) => {
    const { videoId, markerId, label, rushName, startMs, endMs, step, intendedFeeling, editAttempt } =
      args;

    await loadVideoForWrite(videoId);
    if (step !== undefined && step !== null) assertStep(step);

    if (endMs !== undefined && endMs !== null && endMs < startMs) {
      throw new Error(
        `Fin (${msToTimecode(endMs)}) antérieure au début (${msToTimecode(startMs)}) : vérifiez les timecodes.`,
      );
    }

    const db = getDb();
    const timestamp = nowIso();

    if (markerId) {
      const patch: Record<string, unknown> = {
        label: label.trim(),
        startMs,
        updatedAt: timestamp,
      };
      if (rushName !== undefined) patch.rushName = rushName;
      if (endMs !== undefined) patch.endMs = endMs;
      if (step !== undefined) patch.step = step;
      if (intendedFeeling !== undefined) patch.intendedFeeling = intendedFeeling;
      if (editAttempt !== undefined) patch.editAttempt = editAttempt;

      // Le filtre sur `videoId` n'est pas décoratif. `loadVideoForWrite(videoId)` ci-dessus
      // prouve le droit d'écrire sur **cette** vidéo ; sans ce second terme, un appelant
      // ayant ce droit pouvait écraser le marqueur de **n'importe quelle** autre vidéo en
      // passant son identifiant — y compris celle d'un autre propriétaire. Le message
      // d'erreur promettait déjà « sur cette vidéo » : il dit maintenant vrai.
      // Même motif que `delete-marker` et `assign-marker-step`, qui chargent la ligne
      // d'abord et autorisent sur SA vidéo.
      const [marker] = await db
        .update(schema.markers)
        .set(patch)
        .where(and(eq(schema.markers.id, markerId), eq(schema.markers.videoId, videoId)))
        .returning();

      if (!marker) {
        throw new Error(`Marqueur « ${markerId} » introuvable sur cette vidéo.`);
      }
      return { marker, created: false };
    }

    const last = (
      await db
        .select({ sortOrder: schema.markers.sortOrder })
        .from(schema.markers)
        .where(eq(schema.markers.videoId, videoId))
        .orderBy(desc(schema.markers.sortOrder))
        .limit(1)
    )[0];

    const [marker] = await db
      .insert(schema.markers)
      .values({
        id: newId(),
        videoId,
        label: label.trim(),
        rushName: rushName ?? null,
        startMs,
        endMs: endMs ?? null,
        step: step ?? null,
        intendedFeeling: intendedFeeling ?? null,
        editAttempt: editAttempt ?? null,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...ownerStamp(),
      })
      .returning();

    return { marker, created: true };
  },
});
