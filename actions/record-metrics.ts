import { defineAction } from "@agent-native/core/action";
import { and, eq } from "@agent-native/core/db/schema";
import { z } from "zod";

import { getDb, newId, nowIso, schema } from "../server/db/index.ts";
import { loadVideoForWrite, ownerStamp } from "../server/studio.ts";

export default defineAction({
  description:
    "Enregistrer un relevé de performance saisi manuellement pour une publication. Un seul relevé par jour et par publication : un second relevé le même jour corrige le précédent.",
  schema: z.object({
    publicationId: z.string().describe("Identifiant de la publication"),
    measuredOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ")
      .describe("Date du relevé, au format AAAA-MM-JJ"),
    views: z.number().int().min(0).optional().describe("Nombre de vues"),
    likes: z.number().int().min(0).optional().describe("Nombre de mentions J'aime"),
    comments: z.number().int().min(0).optional().describe("Nombre de commentaires"),
    retentionPct: z
      .number()
      .int()
      .min(0)
      .max(100)
      .optional()
      .describe("Rétention moyenne en pourcentage, de 0 à 100"),
  }),
  run: async ({ publicationId, measuredOn, views, likes, comments, retentionPct }) => {
    const db = getDb();

    const publication = (
      await db
        .select()
        .from(schema.publications)
        .where(eq(schema.publications.id, publicationId))
        .limit(1)
    )[0];

    if (!publication) {
      throw new Error(`Publication « ${publicationId} » introuvable.`);
    }

    await loadVideoForWrite(publication.videoId);

    const existing = (
      await db
        .select()
        .from(schema.metrics)
        .where(
          and(
            eq(schema.metrics.publicationId, publicationId),
            eq(schema.metrics.measuredOn, measuredOn),
          ),
        )
        .limit(1)
    )[0];

    const values = {
      views: views ?? null,
      likes: likes ?? null,
      comments: comments ?? null,
      retentionPct: retentionPct ?? null,
    };

    const [metric] = existing
      ? await db
          .update(schema.metrics)
          .set(values)
          .where(eq(schema.metrics.id, existing.id))
          .returning()
      : await db
          .insert(schema.metrics)
          .values({
            id: newId(),
            publicationId,
            videoId: publication.videoId,
            measuredOn,
            ...values,
            createdAt: nowIso(),
            ...ownerStamp(),
          })
          .returning();

    return { metric, replaced: Boolean(existing) };
  },
});
