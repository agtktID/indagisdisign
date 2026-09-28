import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { nullableId } from "../shared/cli-compat.ts";
import { STARTER_TEMPLATES, starterTemplateByKey } from "../shared/starter-templates.ts";
import { getDb, newId, nowIso, schema } from "../server/db/index.ts";
import { ownerStamp } from "../server/studio.ts";

export default defineAction({
  description:
    "Installer une ressource de départ dans la bibliothèque de l'utilisateur : le modèle livré avec l'application y est copié, modifiable, sans que l'original bouge.",
  schema: z.object({
    starterKey: z
      .string()
      .describe(`Clé du modèle de départ : ${STARTER_TEMPLATES.map((t) => t.key).join(", ")}`),
    brandKitId: nullableId("Kit de destination, ou null pour une copie globale").optional(),
    name: z.string().optional().describe("Nom de la copie ; par défaut celui du modèle"),
  }),
  run: async ({ starterKey, brandKitId, name }) => {
    const starter = starterTemplateByKey(starterKey);
    if (!starter) {
      throw new Error(
        `Modèle de départ « ${starterKey} » inconnu. Valides : ${STARTER_TEMPLATES.map((t) => t.key).join(", ")}.`,
      );
    }

    const timestamp = nowIso();
    const [template] = await getDb()
      .insert(schema.assetTemplates)
      .values({
        id: newId(),
        name: name ?? starter.name,
        description: starter.description,
        category: starter.category,
        format: starter.format,
        promptTemplate: starter.promptTemplate,
        textPolicy: starter.textPolicy,
        imageSize: starter.imageSize,
        brandKitId: brandKitId ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...ownerStamp(),
      })
      .returning();

    return { template, installedFrom: starterKey };
  },
});
