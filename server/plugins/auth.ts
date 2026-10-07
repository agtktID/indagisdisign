/**
 * La page de connexion — le premier écran que voit qui clone ce dépôt.
 *
 * Ce fichier n'avait **qu'un seul commit** : e1577cc, le gabarit initial. Il portait
 * encore mot pour mot l'argumentaire du modèle « chat » du framework — « Start from a
 * chat-first agent-native app and add actions, screens, and workflows as you grow », ses
 * trois puces sur MCP et A2A, et un lien vers `agent-native.com/apps/chat`.
 *
 * Autrement dit : un monteur venu structurer un récit était accueilli, en anglais, par
 * la promotion d'un outil de construction d'applications. Trouvé en démarrant un clone
 * neuf sur une base vierge — ce que la CI ne fait jamais, puisqu'elle ne lance pas
 * l'interface.
 *
 * Troisième endroit où le gabarit avait figé quelque chose, après les 41 pins tiptap de
 * `pnpm-workspace.yaml` et le constructeur de catalogue d'`app/i18n/index.ts`.
 *
 * Le texte est en français, comme le produit et le README. `AuthMarketingProps` ne prend
 * qu'un seul jeu de chaînes : il n'y a pas de variante par langue à remplir.
 */
import { createAuthPlugin } from "@agent-native/core/server";

export default createAuthPlugin({
  workspaceAppPublicPaths: ["/"],
  marketing: {
    appName: "Indagis Studio",
    learnMoreUrl: "https://github.com/agtktID/indagisdisign",
    tagline:
      "L'atelier qui vous dit ce qui manque à votre histoire, avant que le montage ne le révèle trop tard.",
    description:
      "Ni un logiciel de montage, ni un gestionnaire de tâches : l'outil qui manque entre les deux. Tout tourne sur votre machine, sans compte ni abonnement.",
    features: [
      "Les 12 étapes du voyage du héros, en 3 actes, avec la courbe émotionnelle de votre montage",
      "Un carnet de marqueurs aux timecodes réels, réordonnable selon le récit et non la chronologie",
      "Douze règles de diagnostic : acte sous-couvert, climax sans enjeu lisible, fin déconnectée",
      "Un agent qui travaille sur vos données, et compose un brief depuis votre carte",
    ],
  },
});
