import { defineAction } from "@agent-native/core/action";
import { writeAppStateForCurrentTab } from "@agent-native/core/application-state";
import { z } from "zod";

export default defineAction({
  description:
    "Amener l'interface sur un écran de Studio : la liste des vidéos, une fiche vidéo (avec son onglet et son étape), ou le calendrier des échéances.",
  schema: z.object({
    view: z
      .enum(["list", "video", "calendar", "library", "chat", "settings"])
      .optional()
      .describe("Écran visé"),
    videoId: z.string().optional().describe("Vidéo à ouvrir, pour view = video"),
    tab: z
      .enum(["map", "markers", "prep", "experiments", "publication"])
      .optional()
      .describe("Onglet de la fiche vidéo"),
    step: z
      .number()
      .int()
      .min(1)
      .max(12)
      .optional()
      .describe("Étape narrative dont déplier le panneau"),
    path: z.string().optional().describe("Chemin d'URL direct"),
    threadId: z.string().optional().describe("Fil de conversation à ouvrir"),
  }),
  http: false,
  run: async (args) => {
    if (!args.view && !args.path) {
      throw new Error("Précisez au moins --view ou --path.");
    }
    if (args.view === "video" && !args.videoId) {
      throw new Error("Ouvrir une fiche vidéo demande --videoId.");
    }

    const nav: Record<string, string> = {};
    if (args.view) nav.view = args.view;
    if (args.path) nav.path = args.path;
    if (args.videoId) nav.videoId = args.videoId;
    if (args.tab) nav.tab = args.tab;
    if (args.step) nav.step = String(args.step);
    if (args.threadId) nav.threadId = args.threadId;
    nav._writeId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await writeAppStateForCurrentTab("navigate", nav);

    return `Navigation vers ${args.view ?? args.path}${args.videoId ? ` (vidéo ${args.videoId})` : ""}${args.tab ? `, onglet ${args.tab}` : ""}.`;
  },
});
