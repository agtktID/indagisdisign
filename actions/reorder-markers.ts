import { defineAction } from "@agent-native/core/action";
import { eq } from "@agent-native/core/db/schema";
import { z } from "zod";

import { getDb, nowIso, schema } from "../server/db/index.ts";
import { loadVideoForWrite } from "../server/studio.ts";

export default defineAction({
  description:
    "Réordonner le carnet selon une logique narrative, indépendante de l'ordre chronologique. La liste fournie doit contenir exactement tous les marqueurs de la vidéo.",
  schema: z.object({
    videoId: z.string().describe("Identifiant de la vidéo"),
    orderedMarkerIds: z
      .array(z.string())
      .describe("Tous les identifiants de marqueurs de la vidéo, dans l'ordre narratif voulu"),
  }),
  run: async ({ videoId, orderedMarkerIds }) => {
    await loadVideoForWrite(videoId);
    const db = getDb();

    const existing = await db
      .select({ id: schema.markers.id })
      .from(schema.markers)
      .where(eq(schema.markers.videoId, videoId));

    const known = new Set(existing.map((row) => row.id));
    const provided = new Set(orderedMarkerIds);

    if (provided.size !== orderedMarkerIds.length) {
      throw new Error("La liste contient des doublons : chaque marqueur doit figurer une seule fois.");
    }

    const missing = [...known].filter((id) => !provided.has(id));
    const unknown = orderedMarkerIds.filter((id) => !known.has(id));

    if (missing.length || unknown.length) {
      const details = [
        missing.length ? `${missing.length} marqueur(s) manquant(s)` : null,
        unknown.length ? `${unknown.length} identifiant(s) inconnu(s)` : null,
      ]
        .filter(Boolean)
        .join(", ");
      throw new Error(
        `La liste doit contenir exactement les ${known.size} marqueurs de la vidéo — ${details}. Une liste partielle produirait un ordre silencieusement faux.`,
      );
    }

    const timestamp = nowIso();
    for (const [position, markerId] of orderedMarkerIds.entries()) {
      await db
        .update(schema.markers)
        .set({ sortOrder: position, updatedAt: timestamp })
        .where(eq(schema.markers.id, markerId));
    }

    return { reordered: orderedMarkerIds.length, videoId };
  },
});
