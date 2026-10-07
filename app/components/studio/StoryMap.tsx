import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import { IconBulb, IconCheck, IconChevronDown } from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FINAL_REVIEW } from "@shared/hero-journey";

import { BriefComposer } from "./BriefComposer";
import { EmotionCurve } from "./EmotionCurve";
import { MapDiagnostic } from "./MapDiagnostic";
import { actColor, Badge, CoverageBar, Textarea } from "./primitives";

interface StoryStep {
  step: number;
  actId: string;
  title: string;
  tagline: string;
  definition: string;
  editing: string;
  exercise: string;
  examples: string[];
  referenceIntensity: number;
  pitfall: string | null;
  note: string | null;
  intensity: number | null;
  status: string;
  isCovered: boolean;
  markers: { id: string; label: string; startTimecode: string }[];
}

interface StoryMapData {
  video: { id: string; title: string; stage: string };
  acts: {
    id: string;
    numeral: string;
    label: string;
    color: string;
    steps: number[];
    covered: number;
    total: number;
  }[];
  steps: StoryStep[];
  curve: { step: number; intensity: number | null; referenceIntensity: number }[];
  coverage: { covered: number; total: number };
  unassignedMarkers: number;
}


export function StoryMap({
  videoId,
  openStep,
  onOpenStep,
}: {
  videoId: string;
  openStep: number | null;
  onOpenStep: (step: number | null) => void;
}) {
  const t = useT();
  const { data, isLoading } = useActionQuery("get-story-map", { videoId });
  const map = data as StoryMapData | undefined;

  if (isLoading || !map) {
    return (
      <p className="text-muted-foreground p-6 text-sm">{t("storyMap.loading")}</p>
    );
  }

  const selected =
    openStep === null ? null : (map.steps.find((s) => s.step === openStep) ?? null);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("storyMap.title")}</h2>
          <p className="text-muted-foreground text-sm">
            {t("storyMap.coverageSummary", {
              covered: map.coverage.covered,
              total: map.coverage.total,
            })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {map.unassignedMarkers > 0 ? (
            <Badge tone="muted">
              {t("studio.unassignedMarkers", { count: map.unassignedMarkers })}
            </Badge>
          ) : null}
          <MapDiagnostic videoId={videoId} onOpenStep={onOpenStep} />
          <BriefComposer videoId={videoId} openStep={openStep} />
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {map.acts.map((act) => {
          const colors = actColor(act.color);
          return (
            <section
              key={act.id}
              className={cn("rounded-lg border p-3", colors.bar)}
              aria-label={t("storyMap.actAriaLabel", {
                numeral: act.numeral,
                label: act.label,
              })}
            >
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  <span className="mr-1.5 opacity-60">{act.numeral}</span>
                  {act.label}
                </h3>
              </div>
              <CoverageBar covered={act.covered} total={act.total} color={act.color} />
              <ul className="mt-3 flex flex-col gap-1.5">
                {act.steps.map((stepNumber) => {
                  const step = map.steps.find((s) => s.step === stepNumber);
                  if (!step) return null;
                  const isOpen = openStep === stepNumber;
                  return (
                    <li key={stepNumber}>
                      <button
                        type="button"
                        onClick={() => onOpenStep(isOpen ? null : stepNumber)}
                        aria-expanded={isOpen}
                        className={cn(
                          "hover:bg-background/70 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition",
                          isOpen && "bg-background ring-1",
                          isOpen && colors.ring,
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded text-[11px] font-semibold",
                            step.isCovered
                              ? colors.chip
                              : "bg-background/60 text-muted-foreground",
                          )}
                        >
                          {step.isCovered ? <IconCheck size={12} /> : stepNumber}
                        </span>
                        <span
                          className={cn(
                            "flex-1 truncate",
                            !step.isCovered && "text-muted-foreground",
                          )}
                        >
                          {step.title}
                        </span>
                        {step.intensity !== null ? (
                          <span className="text-muted-foreground text-[11px] tabular-nums">
                            {step.intensity}
                          </span>
                        ) : null}
                        <IconChevronDown
                          size={14}
                          className={cn(
                            "shrink-0 opacity-40 transition",
                            isOpen && "rotate-180",
                          )}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {selected ? (
        <StepPanel videoId={videoId} step={selected} onClose={() => onOpenStep(null)} />
      ) : null}

      <section className="border-border rounded-lg border p-4">
        <h3 className="mb-1 text-sm font-semibold">{t("storyMap.curveTitle")}</h3>
        <p className="text-muted-foreground mb-2 text-xs">{t("storyMap.curveHint")}</p>
        <EmotionCurve curve={map.curve} />
      </section>

      <section className="border-border rounded-lg border p-4">
        <h3 className="mb-3 text-sm font-semibold">
          {t("storyMap.finalReviewTitle")}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FINAL_REVIEW.map((block) => (
            <div key={block.key} className="bg-muted/40 rounded-md p-3">
              <p className="mb-1.5 text-xs font-semibold">{block.label}</p>
              <ul className="text-muted-foreground flex flex-col gap-1 text-xs">
                {block.checks.map((check) => (
                  <li key={check}>{check}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StepPanel({
  videoId,
  step,
  onClose,
}: {
  videoId: string;
  step: StoryStep;
  onClose: () => void;
}) {
  const t = useT();
  const [note, setNote] = useState(step.note ?? "");
  const [intensity, setIntensity] = useState<number | null>(step.intensity);
  const setBeat = useActionMutation("set-beat");

  useEffect(() => {
    setNote(step.note ?? "");
    setIntensity(step.intensity);
  }, [step.step, step.note, step.intensity]);

  const dirty = note !== (step.note ?? "") || intensity !== step.intensity;

  return (
    <section className="border-border bg-card rounded-lg border p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">
            <span className="text-muted-foreground mr-2 tabular-nums">
              {String(step.step).padStart(2, "0")}
            </span>
            {step.title}
          </h3>
          <p className="text-muted-foreground text-sm italic">{step.tagline}</p>
        </div>
        {step.isCovered ? (
          <Badge tone="ok">{t("storyMap.covered")}</Badge>
        ) : (
          <Badge>{t("storyMap.notCovered")}</Badge>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-3 text-sm">
          <p>{step.definition}</p>
          <div className="bg-muted/50 rounded-md p-3">
            <p className="mb-1 text-xs font-semibold tracking-wide uppercase opacity-70">
              {t("storyMap.inTheEdit")}
            </p>
            <p className="text-sm">{step.editing}</p>
          </div>
          <p className="text-muted-foreground flex gap-2 text-xs">
            <IconBulb size={16} className="mt-px shrink-0" />
            <span>
              <strong className="font-semibold">{t("storyMap.tryThis")}</strong>{" "}
              {step.exercise}
            </span>
          </p>
          {step.pitfall ? (
            <p className="rounded-md bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
              <strong className="font-semibold">{t("storyMap.commonMistake")}</strong>{" "}
              {step.pitfall}
            </p>
          ) : null}
          <details className="text-muted-foreground text-xs">
            <summary className="cursor-pointer select-none">
              {t("storyMap.examples")}
            </summary>
            <ul className="mt-1 list-disc pl-5">
              {step.examples.map((example) => (
                <li key={example}>{example}</li>
              ))}
            </ul>
          </details>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">{t("storyMap.noteLabel")}</span>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("storyMap.notePlaceholder")}
              rows={6}
            />
            <span className="text-muted-foreground text-xs">
              {t("storyMap.noteHint")}
            </span>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              {t("storyMap.intensityLabel")}{" "}
              <span className="text-muted-foreground font-normal tabular-nums">
                {intensity ?? "—"}
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={intensity ?? 0}
              onChange={(event) => setIntensity(Number(event.target.value))}
              className="accent-primary"
            />
            <span className="text-muted-foreground text-xs">
              {t("storyMap.intensityReference", { value: step.referenceIntensity })}
            </span>
          </label>

          {step.markers.length > 0 ? (
            <div className="text-sm">
              <p className="mb-1 font-medium">{t("storyMap.attachedMarkers")}</p>
              <ul className="text-muted-foreground flex flex-col gap-0.5 text-xs">
                {step.markers.map((marker) => (
                  <li key={marker.id} className="flex gap-2">
                    <span className="tabular-nums opacity-70">{marker.startTimecode}</span>
                    <span className="truncate">{marker.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={!dirty || setBeat.isPending}
              onClick={() =>
                setBeat.mutate({
                  videoId,
                  step: step.step,
                  note,
                  ...(intensity === null ? {} : { intensity }),
                })
              }
            >
              {setBeat.isPending ? t("studio.saving") : t("studio.save")}
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              {t("studio.close")}
            </Button>
            {setBeat.isError ? (
              <span className="text-destructive text-xs">
                {(setBeat.error as Error)?.message ?? t("studio.saveFailed")}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
