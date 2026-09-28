import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { IconAlertTriangle, IconStethoscope } from "@tabler/icons-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

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

const SYMPTOMS = [
  { key: "debut-repete", label: "Le début répète le problème" },
  { key: "milieu-repetitif", label: "Le milieu semble répétitif" },
  { key: "climax-faible", label: "Le climax semble faible" },
  { key: "fin-deconnectee", label: "La fin paraît déconnectée" },
  { key: "passage-confus", label: "Un passage paraît confus" },
];

const STATUS_LABELS: Record<string, string> = {
  todo: "À tester",
  testing: "En cours",
  kept: "Conservé",
  discarded: "Abandonné",
};

export function ExperimentsTab({ videoId }: { videoId: string }) {
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
        <h2 className="text-lg font-semibold">Essais</h2>
        <p className="text-muted-foreground text-sm">
          Chaque symptôme peut avoir plusieurs causes. Changez une seule chose à la fois,
          puis comparez avant de conclure.
        </p>
      </header>

      {list?.warning ? (
        <p className="flex items-center gap-2 rounded-md bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
          <IconAlertTriangle size={16} className="shrink-0" />
          {list.warning}
        </p>
      ) : null}

      <section className="border-border rounded-lg border p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Diagnostic de structure</h3>
          <Button size="sm" variant="outline" onClick={runDiagnostic} disabled={diagnose.isFetching}>
            <IconStethoscope size={14} />
            {diagnose.isFetching ? "Analyse…" : "Analyser la carte"}
          </Button>
        </div>
        {findings ? (
          findings.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Aucune règle de structure ne se déclenche sur cette carte.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {findings.map((finding) => (
                <li
                  key={finding.rule}
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
                    Ouvrir un essai sur ce constat
                  </Button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <p className="text-muted-foreground text-sm">
            Le diagnostic produit des observations, pas des correctifs : à vous de décider
            lesquelles vous voulez tester.
          </p>
        )}
      </section>

      <section className="border-border rounded-lg border p-4">
        <h3 className="mb-2 text-sm font-semibold">Partir d&apos;un symptôme</h3>
        <div className="flex flex-wrap gap-2">
          {SYMPTOMS.map((symptom) => (
            <Button
              key={symptom.key}
              size="sm"
              variant="outline"
              onClick={() =>
                create.mutate({
                  videoId,
                  source: "diagnostic",
                  symptomKey: symptom.key,
                  observation: symptom.label,
                })
              }
            >
              {symptom.label}
            </Button>
          ))}
        </div>
      </section>

      <section className="border-border rounded-lg border p-4">
        <h3 className="mb-1 text-sm font-semibold">Noter un retour de spectateur</h3>
        <p className="text-muted-foreground mb-2 text-xs">
          Écrivez ce que la personne a dit, mot pour mot. « J&apos;ai décroché ici »
          localise un vrai problème ; « ajoute une musique » est déjà une solution
          proposée — à vérifier avant de l&apos;appliquer.
        </p>
        <Textarea
          value={observation}
          onChange={(event) => setObservation(event.target.value)}
          placeholder="« Je pensais que c'était fini. »"
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
            Enregistrer l&apos;observation
          </Button>
          {error ? <span className="text-destructive text-xs">{error}</span> : null}
        </div>
      </section>

      {(list?.experiments.length ?? 0) === 0 ? (
        <EmptyState
          title="Aucun essai ouvert"
          hint="Un essai part d'une observation, pas d'une solution. Lancez un diagnostic ou notez un retour de spectateur."
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
  const [verdict, setVerdict] = useState("");
  const closed = experiment.status === "kept" || experiment.status === "discarded";

  return (
    <section className="border-border rounded-lg border p-4 text-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge tone={experiment.status === "testing" ? "warn" : closed ? "ok" : "muted"}>
          {STATUS_LABELS[experiment.status] ?? experiment.status}
        </Badge>
        <Badge>{experiment.source}</Badge>
        {experiment.step ? <Badge>Étape {experiment.step}</Badge> : null}
      </div>
      <p className="mb-1">
        <strong className="font-medium">Observation — </strong>
        {experiment.observation}
      </p>
      {experiment.symptom ? (
        <p className="text-muted-foreground mb-1 text-xs">
          <strong className="font-medium">À essayer — </strong>
          {experiment.symptom.suggestion}
        </p>
      ) : null}
      {experiment.hypothesis ? (
        <p className="mb-1">
          <strong className="font-medium">Hypothèse — </strong>
          {experiment.hypothesis}
        </p>
      ) : null}
      {experiment.attempt ? (
        <p className="mb-1">
          <strong className="font-medium">Essai — </strong>
          {experiment.attempt}
        </p>
      ) : null}
      {experiment.verdictNote ? (
        <p className="text-muted-foreground mb-1 text-xs">
          <strong className="font-medium">Verdict — </strong>
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
              Passer en cours de test
            </Button>
          ) : (
            <>
              <Textarea
                className="min-h-16"
                value={verdict}
                onChange={(event) => setVerdict(event.target.value)}
                placeholder="Ce que la comparaison avant/après a montré…"
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
                  Conserver
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
                  Abandonner
                </Button>
                <span className="text-muted-foreground text-xs">
                  Un verdict est requis : clore sans dire ce qu&apos;on a appris vide la
                  boucle de son intérêt.
                </span>
              </div>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
