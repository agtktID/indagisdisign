import { appPath } from "@agent-native/core/client/api-path";
import { useEffect, useRef } from "react";

import { APP_TITLE } from "@/lib/app-config";

const SEO_TITLE = `${APP_TITLE} — structurer le récit d'un montage vidéo`;
const SEO_DESCRIPTION =
  "Le voyage du héros appliqué au montage : 12 étapes, 3 actes, courbe émotionnelle, " +
  "carnet de marqueurs et diagnostic de structure. Open source, tourne sur votre machine.";

export function meta() {
  return [
    { title: SEO_TITLE },
    {
      name: "description",
      content: SEO_DESCRIPTION,
    },
    { property: "og:title", content: SEO_TITLE },
    { property: "og:description", content: SEO_DESCRIPTION },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: SEO_TITLE },
    { name: "twitter:description", content: SEO_DESCRIPTION },
  ];
}

/**
 * L'accueil mène aux vidéos, pas au chat.
 *
 * Le gabarit Agent-Native ouvre sur une conversation vide. Pour cette application,
 * c'était le mauvais premier écran : un monteur qui découvre Studio tombait sur un
 * champ de saisie réclamant une clé d'API, et ne voyait jamais la carte narrative —
 * c'est-à-dire le produit. L'agent reste à un clic, dans la barre latérale et par le
 * bouton d'ouverture du panneau.
 *
 * Changement volontairement réversible : remettre `/chat/${threadId}` ci-dessous suffit
 * à revenir au comportement du gabarit.
 */
export default function ChatRoute() {
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    try {
      window.location.replace(appPath("/videos"));
    } catch (error) {
      redirectedRef.current = false;
      throw error;
    }
  }, []);

  return null;
}
