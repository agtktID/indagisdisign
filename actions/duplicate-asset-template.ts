import { defineAction } from "@agent-native/core/action";
import { and, eq } from "@agent-native/core/db/schema";
import { z } from "zod";

import { nullableId } from "../shared/cli-compat.ts";

import { getDb, newId, nowIso, schema } from "../server/db/index.ts";
import { ownedByCurrentUser, ownerStamp } from "../server/studio.ts";

export default defineAction({
  description:
    "Dupliquer un modèle dans un kit de marque. C'est ainsi qu'on spécialise un modèle global pour une marque sans toucher à l'original.",
  schema: z.object({
    templateId: z.string().describe("Modèle à dupliquer"),
    brandKitId: nullableId("Kit de destination, ou null pour une copie globale"),
    name: z.string().optional().describe("Nom de la copie ; par défaut « … (copie) »"),
  }),
  run: async ({ templateId, brandKitId, name }) => {
    const db = getDb();

    const source = (
      await db
        .select()
        .from(schema.assetTemplates)
        .where(
          and(
            eq(schema.assetTemplates.id, templateId),
            ownedByCurrentUser(schema.assetTemplates),
          ),
        )
        .limit(1)
    )[0];

    if (!source) throw new Error(`Modèle « ${templateId} » introuvable.`);

    const timestamp = nowIso();
    const { id: _id, createdAt: _created, updatedAt: _updated, ...copyable } = source;

    const [template] = await db
      .insert(schema.assetTemplates)
      .values({
        ...copyable,
        id: newId(),
        name: name ?? `${source.name} (copie)`,
        brandKitId,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...ownerStamp(),
      })
      .returning();

    return { template, from: templateId };
  },
});
