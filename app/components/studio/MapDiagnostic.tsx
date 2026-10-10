/**
 * Le diagnostic, là où le regard est déjà.
 *
 * Il vivait dans l'onglet « Essais ». Or la carte est l'écran où le monteur passe son
 * temps, et le diagnostic répond à la question qui fonde le produit : *qu'est-ce qui
 * manque à mon histoire ?* La réponse était à un onglet de distance de la question.
 *
 * Ce que cette surface apporte que l'onglet Essais n'a pas : **chaque remarque est
 * cliquable**. `Finding.steps` nomme les étapes concernées ; les lire ici permet de
 * déplier directement la bonne, au lieu de la chercher à la main après avoir changé
 * d'onglet.
 *
 * Elle ne remplace pas l'onglet Essais : c'est là qu'on ouvre un essai depuis une
 * remarque, et qu'on le mène jusqu'au verdict. Ici on constate, là-bas on agit.
 */
import { useActionQuery } from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import { IconAlertTriangle, IconStethoscope } from "@tabler/icons-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

interface Finding {
  rule: string;
  severity: "info" | "warn";
  message: string;
  steps: number[];
}

export function MapDiagnostic({
  videoId,
  onOpenStep,
}: {
  videoId: string;
  onOpenStep: (step: number | null) => void;
}) {
  const t = useT();
  // `diagnose-structure` est une lecture (`http: { method: "GET" }`) déclenchée par un
  // clic : `useActionQuery` désactivée puis `refetch()`, et non `useActionMutation`, qui
  // enverrait un POST et se ferait refuser en 405.
  const diagnose = useActionQuery("diagnose-structure", { videoId }, { enabled: false });
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    try {
      const { data } = await diagnose.refetch();
      setFindings((data as { findings: Finding[] } | undefined)?.findings ?? []);
    } catch (cause) {
      setError((cause as Error)?.message ?? t("mapDiagnostic.failed"));
    }
  }

  const warnings = findings?.filter((finding) => finding.severity === "warn").length ?? 0;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        {findings && findings.length > 0 ? (
          <span
            className={
              warnings > 0
                ? "rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-800 dark:text-amber-200"
                : "text-muted-foreground text-xs"
            }
          >
            {t("mapDiagnostic.count", { count: findings.length })}
          </span>
        ) : null}
        <Button size="sm" variant="outline" onClick={run} disabled={diagnose.isFetching}>
          <IconStethoscope size={13} />{" "}
          {diagnose.isFetching ? t("mapDiagnostic.running") : t("mapDiagnostic.run")}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}

      {findings ? (
        findings.length === 0 ? (
          <p className="text-muted-foreground max-w-md text-right text-xs">
            {t("mapDiagnostic.nothing")}
          </p>
        ) : (
          <ul className="flex max-w-md flex-col items-end gap-1">
            {findings.map((finding) => (
              <li key={finding.rule} className="text-right text-xs">
                {/*
                  La gravité ne passait que par la couleur — ambre contre gris. En
                  niveaux de gris, pour un daltonien, ou pour un lecteur d'écran, un
                  avertissement était indiscernable d'une simple remarque. L'icône et
                  le libellé caché portent l'information ; la couleur la renforce.
                */}
                <span
                  className={
                    finding.severity === "warn"
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-muted-foreground"
                  }
                >
                  {finding.severity === "warn" ? (
                    <IconAlertTriangle
                      size={12}
                      className="mr-1 inline-block align-[-1px]"
                      aria-hidden="true"
                    />
                  ) : null}
                  <span className="sr-only">
                    {finding.severity === "warn"
                      ? t("mapDiagnostic.severityWarn")
                      : t("mapDiagnostic.severityInfo")}
                  </span>
                  {finding.message}
                </span>
                {finding.steps.length > 0 ? (
                  <span className="ml-1.5 inline-flex flex-wrap gap-1">
                    {finding.steps.map((step) => (
                      <button
                        key={step}
                        type="button"
                        onClick={() => onOpenStep(step)}
                        title={t("mapDiagnostic.openStep", { step })}
                        className="border-border hover:bg-accent rounded border px-1 tabular-nums"
                      >
                        {step}
                      </button>
                    ))}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
