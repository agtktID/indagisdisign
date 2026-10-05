import { markAgentChatHomeHandoff } from "@agent-native/toolkit/app/chat/agentkit-chat/rail";
import { appPath } from "@agent-native/core/client/api-path";
import { useEffect, useRef, useState } from "react";

import { APP_TITLE } from "@/lib/app-config";
import { getChatHomeThreadId } from "@/lib/chat-home-thread";

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

export default function ChatRoute() {
  const [threadId] = useState(getChatHomeThreadId);
  const handoffStartedRef = useRef(false);

  useEffect(() => {
    if (handoffStartedRef.current) return;
    handoffStartedRef.current = true;
    markAgentChatHomeHandoff("chat");
    try {
      window.location.replace(appPath(`/chat/${encodeURIComponent(threadId)}`));
    } catch (error) {
      handoffStartedRef.current = false;
      throw error;
    }
  }, [threadId]);

  return null;
}
