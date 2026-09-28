import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb, newId, nowIso, schema } from "../server/db/index.ts";
import { ownerStamp } from "../server/studio.ts";

export default defineAction({
  description:
    "Créer un nouveau projet vidéo dans Studio. Écrit aussi le premier événement d'étape de production, pour que l'historique soit complet dès la première ligne.",
  schema: z.object({
    title: z.string().min(1).describe("Titre du projet vidéo"),
    kind: z
      .enum(["long", "short"])
      .default("long")
      .describe("Vidéo longue ou dérivé court"),
    parentVideoId: z
      .string()
      .optional()
      .describe("Vidéo longue dont ce dérivé court est issu"),
    dueAt: z
      .string()
      .optional()
      .describe("Échéance, au format ISO-8601"),
  }),
  run: async ({ title, kind, parentVideoId, dueAt }) => {
    const db = getDb();
    const id = newId();
    const timestamp = nowIso();

    const [video] = await db
      .insert(schema.videos)
      .values({
        id,
        title: title.trim(),
        kind,
        parentVideoId: parentVideoId ?? null,
        stage: "idea",
        stageChangedAt: timestamp,
        dueAt: dueAt ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...ownerStamp(),
      })
      .returning();

    await db.insert(schema.stageEvents).values({
      id: newId(),
      videoId: id,
      fromStage: null,
      toStage: "idea",
      note: "Création du projet",
      occurredAt: timestamp,
      ...ownerStamp(),
    });

    return { video };
  },
});
