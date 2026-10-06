import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import { IconAlertTriangle, IconStethoscope } from "@tabler/icons-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DIAGNOSTIC_SYMPTOMS } from "@shared/hero-journey";

import { Badge, EmptyState, Textarea } from "./primitives";

interface Experiment {
  id: string;
  step: number | null;
  source: string;
  symptomKey: string | null;
  observation: string;
  hypothesis: string | null;
  attempt: string | null;
  status: string;
  verdictNote: string | null;
  symptom: { key: string; observation: string; suggestion: string } | null;
}

/** Entrée de `resolve-experiment`, typée pour que le hook la valide à la compilation. */
interface ResolveInput {
  experimentId: string;
  status: "testing" | "kept" | "discarded";
  verdictNote?: string;
  attempt?: string;
}

interface Finding {
  rule: string;
  severity: "info" | "warn";
  message: string;
  steps: number[];
}


/** Les statuts viennent de la base ; seuls leurs libellés sont de l'interface. */
const STATUS_KEYS: Record<string, string> = {
  todo: "experiments.statusTodo",
  testing: "experiments.statusTesting",
  kept: "experiments.statusKept",
  discarded: "experiments.statusDiscarded",
};

export function ExperimentsTab({ videoId }: { videoId: string }) {
  const t = useT();
  const { data } = useActionQuery("list-experiments", { videoId });
  const list = data as
    | { experiments: Experiment[]; openCount: number; testingCount: number; warning?: string }
    | undefined;

  // `diagnose-structure` est une lecture (`http: { method: "GET" }`) déclenchée par un
  // clic : `useActionQuery` désactivée puis `refetch()`, et non `useActionMutation`, qui
  // enverrait un POST et se ferait refuser en 405.
  const diagnose = useActionQuery(
    "diagnose-structure",
    { videoId },
    { enabled: false },
  );
  const create = useActionMutation("create-experiment");
  const resolve = useActionMutation("resolve-experiment");

  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [observation, setObservation] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function runDiagnostic() {
    const { data: result } = await diagnose.refetch();
    setFindings((result as { findings: Finding[] } | undefined)?.findings ?? []);
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h2 className="text-lg font-semibold">{t("experiments.title")}</h2>
        <p className="text-muted-foreground text-sm">{t("experiments.description")}</p>
      </header>

      {list?.warning ? (
        <p className="flex items-center gap-2 rounded-md bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
          <IconAlertTriangle size={16} className="shrink-0" />
          {list.warning}
        </p>
      ) : null}

      <section className="border-border rounded-lg border p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{t("experiments.diagnosticTitle")}</h3>
          <Button size="sm" variant="outline" onClick={runDiagnostic} disabled={diagnose.isFetching}>
            <IconStethoscope size={14} />
            {diagnose.isFetching ? t("experiments.analyzing") : t("experiments.analyze")}
          </Button>
        </div>
        {findings ? (
          findings.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("experiments.noFindings")}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {findings.map((finding) => (
                <li
                  key={`${finding.rule}:${finding.steps.join(",")}`}
                  className="bg-muted/40 flex flex-col gap-2 rounded-md p-3 text-sm"
                >
                  <div className="flex items-start gap-2">
                    <Badge tone={finding.severity === "warn" ? "warn" : "muted"}>
                      {finding.rule}
                    </Badge>
                    <p className="flex-1">{finding.message}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="self-start"
                    onClick={() =>
                      create.mutate({
                        videoId,
                        source: "diagnostic",
                        observation: finding.message,
                        ...(finding.steps.length ? { step: finding.steps[0] } : {}),
                      })
                    }
                  >
                    {t("experiments.openFromFinding")}
                  </Button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <p className="text-muted-foreground text-sm">
            {t("experiments.diagnosticHint")}
          </p>
        )}
      </section>

      <section className="border-border rounded-lg border p-4">
        <h3 className="mb-2 text-sm font-semibold">
          {t("experiments.fromSymptomTitle")}
        </h3>
        <div className="flex flex-wrap gap-2">
          {DIAGNOSTIC_SYMPTOMS.map((symptom) => (
            <Button
              key={symptom.key}
              size="sm"
              variant="outline"
                title={symptom.suggestion}
              onClick={() =>
                create.mutate({
                  videoId,
                  source: "diagnostic",
                  symptomKey: symptom.key,
                  observation: symptom.observation,
                })
              }
            >
              {symptom.observation}
            </Button>
          ))}
        </div>
      </section>

      <section className="border-border rounded-lg border p-4">
        <h3 className="mb-1 text-sm font-semibold">{t("experiments.feedbackTitle")}</h3>
        <p className="text-muted-foreground mb-2 text-xs">
          {t("experiments.feedbackHint")}
        </p>
        <Textarea
          value={observation}
          onChange={(event) => setObservation(event.target.value)}
          placeholder={t("experiments.feedbackPlaceholder")}
          rows={2}
        />
        <div className="mt-2 flex items-center gap-2">
          <Button
            size="sm"
            disabled={!observation.trim() || create.isPending}
            onClick={() =>
              create.mutate(
                { videoId, source: "roasting", observation },
                {
                  onSuccess: () => {
                    setObservation("");
                    setError(null);
                  },
                  onError: (mutationError) => setError((mutationError as Error).message),
                },
              )
            }
          >
            {t("experiments.saveObservation")}
          </Button>
          {error ? <span className="text-destructive text-xs">{error}</span> : null}
        </div>
      </section>

      {(list?.experiments.length ?? 0) === 0 ? (
        <EmptyState
          title={t("experiments.emptyTitle")}
          hint={t("experiments.emptyHint")}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {list?.experiments.map((experiment) => (
            <ExperimentCard
              key={experiment.id}
              experiment={experiment}
              onResolve={(input) => resolve.mutate(input)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ExperimentCard({
  experiment,
  onResolve,
}: {
  experiment: Experiment;
  onResolve: (input: ResolveInput) => void;
}) {
  const t = useT();
  const [verdict, setVerdict] = useState("");
  const closed = experiment.status === "kept" || experiment.status === "discarded";
  const statusKey = STATUS_KEYS[experiment.status];

  return (
    <section className="border-border rounded-lg border p-4 text-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge tone={experiment.status === "testing" ? "warn" : closed ? "ok" : "muted"}>
          {statusKey ? t(statusKey) : experiment.status}
        </Badge>
        <Badge>{experiment.source}</Badge>
        {experiment.step ? (
          <Badge>{t("studio.stepBadge", { step: experiment.step })}</Badge>
        ) : null}
      </div>
      <p className="mb-1">
        <strong className="font-medium">{t("experiments.observationLabel")}</strong>{" "}
        {experiment.observation}
      </p>
      {experiment.symptom ? (
        <p className="text-muted-foreground mb-1 text-xs">
          <strong className="font-medium">{t("experiments.suggestionLabel")}</strong>{" "}
          {experiment.symptom.suggestion}
        </p>
      ) : null}
      {experiment.hypothesis ? (
        <p className="mb-1">
          <strong className="font-medium">{t("experiments.hypothesisLabel")}</strong>{" "}
          {experiment.hypothesis}
        </p>
      ) : null}
      {experiment.attempt ? (
        <p className="mb-1">
          <strong className="font-medium">{t("experiments.attemptLabel")}</strong>{" "}
          {experiment.attempt}
        </p>
      ) : null}
      {experiment.verdictNote ? (
        <p className="text-muted-foreground mb-1 text-xs">
          <strong className="font-medium">{t("experiments.verdictLabel")}</strong>{" "}
          {experiment.verdictNote}
        </p>
      ) : null}

      {!closed ? (
        <div className="mt-3 flex flex-col gap-2">
          {experiment.status === "todo" ? (
            <Button
              size="sm"
              variant="outline"
              className="self-start"
              onClick={() => onResolve({ experimentId: experiment.id, status: "testing" })}
            >
              {t("experiments.startTesting")}
            </Button>
          ) : (
            <>
              <Textarea
                className="min-h-16"
                value={verdict}
                onChange={(event) => setVerdict(event.target.value)}
                placeholder={t("experiments.verdictPlaceholder")}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  disabled={!verdict.trim()}
                  onClick={() =>
                    onResolve({
                      experimentId: experiment.id,
                      status: "kept",
                      verdictNote: verdict,
                    })
                  }
                >
                  {t("experiments.keep")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!verdict.trim()}
                  onClick={() =>
                    onResolve({
                      experimentId: experiment.id,
                      status: "discarded",
                      verdictNote: verdict,
                    })
                  }
                >
                  {t("experiments.discard")}
                </Button>
                <span className="text-muted-foreground text-xs">
                  {t("experiments.verdictRequired")}
                </span>
              </div>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
