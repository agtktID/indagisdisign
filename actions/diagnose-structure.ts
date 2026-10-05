import { defineAction } from "@agent-native/core/action";
import { eq } from "@agent-native/core/db/schema";
import { z } from "zod";

import { diagnoseStructure } from "../shared/diagnosis.ts";
import { getDb, schema } from "../server/db/index.ts";
import { loadVideo } from "../server/studio.ts";

export default defineAction({
  description:
    "Diagnostiquer la structure narrative d'une vidéo en appliquant mécaniquement les règles de la méthode : acte sous-couvert, climax sans enjeu lisible en amont, fin déconnectée, courbe plate, matière sans intention, marqueurs orphelins. Renvoie des OBSERVATIONS, jamais un correctif tout fait — l'utilisateur ou l'agent en tire des essais.",
  schema: z.object({
    videoId: z.string().describe("Identifiant de la vidéo"),
  }),
  http: { method: "GET" },
  run: async ({ videoId }) => {
    const video = await loadVideo(videoId);
    const db = getDb();

    const [beats, markers] = await Promise.all([
      db.select().from(schema.storyBeats).where(eq(schema.storyBeats.videoId, videoId)),
      db.select().from(schema.markers).where(eq(schema.markers.videoId, videoId)),
    ]);

    // Les règles elles-mêmes vivent dans `shared/diagnosis.ts`, sans base : c'est ce qui
    // les rend testables. Cette action ne fait que charger et rendre.
    return { video: { id: video.id, title: video.title }, ...diagnoseStructure(beats, markers) };
  },
});
