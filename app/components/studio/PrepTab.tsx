import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import { Badge, Textarea } from "./primitives";

interface PrepQuestion {
  key: string;
  label: string;
  hint: string;
  answer: string | null;
  answered: boolean;
}

export function PrepTab({ videoId }: { videoId: string }) {
  const { data } = useActionQuery("get-prep-sheet", { videoId });
  const sheet = data as
    | { questions: PrepQuestion[]; answeredCount: number; total: number }
    | undefined;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h2 className="text-lg font-semibold">Fiche de préparation</h2>
        <p className="text-muted-foreground text-sm">
          Commencez avec ce que vous savez déjà — une question sans réponse vous indique
          quoi chercher dans vos rushes.
        </p>
      </header>

      {sheet ? (
        <Badge tone={sheet.answeredCount === sheet.total ? "ok" : "muted"} className="self-start">
          {sheet.answeredCount} / {sheet.total} renseignée{sheet.answeredCount > 1 ? "s" : ""}
        </Badge>
      ) : null}

      <div className="flex flex-col gap-4">
        {(sheet?.questions ?? []).map((question) => (
          <PrepQuestionCard key={question.key} videoId={videoId} question={question} />
        ))}
      </div>
    </div>
  );
}

function PrepQuestionCard({
  videoId,
  question,
}: {
  videoId: string;
  question: PrepQuestion;
}) {
  const [value, setValue] = useState(question.answer ?? "");
  const answer = useActionMutation("answer-prep-question");

  useEffect(() => setValue(question.answer ?? ""), [question.answer]);

  const dirty = value !== (question.answer ?? "");

  return (
    <section className="border-border rounded-lg border p-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium">{question.label}</h3>
        {question.answered ? <Badge tone="ok">Renseignée</Badge> : null}
      </div>
      <p className="text-muted-foreground mb-2 text-xs">{question.hint}</p>
      <Textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="À compléter…"
        rows={3}
      />
      <div className="mt-2 flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!dirty || answer.isPending}
          onClick={() => answer.mutate({ videoId, questionKey: question.key, answer: value })}
        >
          {answer.isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
        {answer.isError ? (
          <span className="text-destructive text-xs">{(answer.error as Error).message}</span>
        ) : null}
      </div>
    </section>
  );
}
