/**
 * Composer un brief depuis la carte, et l'envoyer à l'agent.
 *
 * L'action `get-narrative-brief` existait depuis la PR #9 mais **aucun bouton ne la
 * déclenchait** : la seule façon d'y accéder était de taper la demande à l'agent. Une
 * fonctionnalité que rien ne signale n'existe pas pour l'utilisateur.
 *
 * Ce que ça rend possible en un clic : « un teaser de l'acte III depuis ma carte ».
 * Aucun autre outil ne peut exécuter cette phrase, parce qu'aucun autre ne possède à la
 * fois les étapes du récit et les timecodes réels des rushes.
 *
 * Le brief part en **contexte** du message, pas dans le message : l'utilisateur garde la
 * main sur ce qu'il demande, l'agent reçoit la matière sans qu'elle encombre la
 * conversation.
 */
import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { useT } from "@agent-native/core/client/i18n";
import { callAction } from "@agent-native/core/client/use-action";
import { IconSparkles } from "@tabler/icons-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ACTS } from "@shared/hero-journey";

interface BriefResult {
  content: string;
  coveredSteps: number;
  totalSteps: number;
  markerCount: number;
}

export function BriefComposer({
  videoId,
  openStep,
}: {
  videoId: string;
  /** L'étape dépliée, s'il y en a une : elle devient un périmètre proposé en plus. */
  openStep: number | null;
}) {
  const t = useT();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function compose(scope: string | number, label: string) {
    setPending(String(scope));
    setError(null);
    try {
      // `{ method: "GET" }` n'est pas décoratif : l'action déclare `http: { method:
      // "GET" }`, et `callAction` poste par défaut. Sans cette option, le serveur
      // répond 405 — ce qu'aucun test ne voyait, puisque rien ne cliquait.
      const brief = await callAction<BriefResult>(
        "get-narrative-brief",
        { videoId, scope },
        { method: "GET" },
      );

      // Une carte vide produirait un brief vide. Le dire ici, plutôt que de laisser
      // l'agent recevoir une page de « aucune note » et composer dans le vide.
      if (brief.coveredSteps === 0) {
        setError(t("brief.nothingWritten"));
        return;
      }

      sendToAgentChat({
        message: t("brief.agentRequest", { scope: label }),
        context: brief.content,
        submit: true,
        openSidebar: true,
      });
    } catch (cause) {
      setError((cause as Error)?.message ?? t("brief.failed"));
    } finally {
      setPending(null);
    }
  }

  const choices: { key: string | number; label: string }[] = [
    { key: "all", label: t("brief.scopeAll") },
    ...ACTS.map((act) => ({ key: act.id, label: `${act.numeral} · ${act.label}` })),
    ...(openStep !== null
      ? [{ key: openStep, label: t("brief.scopeStep", { step: openStep }) }]
      : []),
  ];

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <span className="text-muted-foreground mr-0.5 text-xs">{t("brief.label")}</span>
        {choices.map(({ key, label }) => (
          <Button
            key={String(key)}
            size="sm"
            variant="outline"
            disabled={pending !== null}
            onClick={() => compose(key, label)}
            title={t("brief.buttonTitle", { scope: label })}
          >
            {pending === String(key) ? (
              t("brief.composing")
            ) : (
              <>
                <IconSparkles size={13} /> {label}
              </>
            )}
          </Button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
