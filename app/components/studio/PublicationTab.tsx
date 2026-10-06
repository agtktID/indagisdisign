import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { useFormatters, useT } from "@agent-native/core/client/i18n";
import { IconChartBar, IconHistory, IconPlus } from "@tabler/icons-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Badge, EmptyState, Textarea } from "./primitives";

/** Les étapes viennent de la base ; seuls leurs libellés sont de l'interface. */
const STAGE_KEYS: Record<string, string> = {
  idea: "publication.stageIdea",
  script: "publication.stageScript",
  shoot: "publication.stageShoot",
  edit: "publication.stageEdit",
  published: "publication.stagePublished",
};

const STAGES = ["idea", "script", "shoot", "edit", "published"] as const;

interface StageEvent {
  id: string;
  fromStage: string | null;
  toStage: string;
  note: string | null;
  occurredAt: string;
}

interface Metric {
  id: string;
  measuredOn: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  retentionPct: number | null;
}

interface Publication {
  id: string;
  platform: string;
  seoTitle: string | null;
  seoDescription: string | null;
  keywords: string | null;
  url: string | null;
  status: string;
  metrics: Metric[];
}

export function PublicationTab({ videoId }: { videoId: string }) {
  const t = useT();
  // La date et l'ancienneté suivent la locale active : « 3 oct. 2026 » et « il y a
  // 4 jours » étaient codés en français, et l'accord du pluriel était fait à la main.
  const { formatDate, formatRelativeTime } = useFormatters();
  const showDate = (iso: string) => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
      ? iso
      : formatDate(date, { day: "numeric", month: "short", year: "numeric" });
  };
  const { data } = useActionQuery("get-video", { videoId });
  const detail = data as
    | {
        video: { stage: string; dueAt: string | null };
        daysSinceStageChange: number;
        isBlocked: boolean;
      }
    | undefined;

  const history = useActionQuery("list-stage-events", { videoId });
  const events = (history.data as { events: StageEvent[] } | undefined)?.events ?? [];

  const published = useActionQuery("list-publications", { videoId });
  const publications =
    (published.data as { publications: Publication[] } | undefined)?.publications ?? [];

  const moveStage = useActionMutation("move-stage");
  const upsert = useActionMutation("upsert-publication");
  const [draft, setDraft] = useState({
    platform: "",
    seoTitle: "",
    seoDescription: "",
    keywords: "",
  });
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h2 className="text-lg font-semibold">{t("publication.title")}</h2>
        <p className="text-muted-foreground text-sm">{t("publication.description")}</p>
      </header>

      {/* Étape de production ------------------------------------------------ */}
      <section className="border-border rounded-lg border p-4">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{t("publication.stageTitle")}</h3>
          {detail ? (
            (() => {
              // `formatRelativeTime` accorde le pluriel dans chaque langue — c'est tout
              // l'intérêt de passer par Intl plutôt que par un « s » conditionnel.
              const since = formatRelativeTime(-detail.daysSinceStageChange, "day", {
                numeric: "auto",
              });
              return detail.isBlocked ? (
                <Badge tone="warn">{t("publication.blocked", { since })}</Badge>
              ) : (
                <span className="text-muted-foreground text-xs">
                  {t("publication.lastMoved", { since })}
                </span>
              );
            })()
          ) : null}
        </div>
        <p className="text-muted-foreground mb-3 text-xs">{t("publication.stageHint")}</p>

        <ol className="flex flex-wrap items-center gap-1.5">
          {STAGES.map((stage, index) => {
            const current = detail?.video.stage === stage;
            const reached = detail
              ? STAGES.indexOf(detail.video.stage as (typeof STAGES)[number]) >= index
              : false;
            return (
              <li key={stage} className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant={current ? "default" : reached ? "secondary" : "outline"}
                  disabled={current || moveStage.isPending}
                  onClick={() =>
                    moveStage.mutate(
                      { videoId, toStage: stage },
                      {
                        onError: (mutationError) =>
                          setError((mutationError as Error).message),
                        onSuccess: () => setError(null),
                      },
                    )
                  }
                >
                  {t(STAGE_KEYS[stage]!)}
                </Button>
                {index < STAGES.length - 1 ? (
                  <span className="text-muted-foreground text-xs">›</span>
                ) : null}
              </li>
            );
          })}
        </ol>
        <p className="text-muted-foreground mt-2 text-xs">
          {t("publication.backwardsAllowed")}
        </p>
        {error ? <p className="text-destructive mt-2 text-xs">{error}</p> : null}
      </section>

      {/* Historique ---------------------------------------------------------- */}
      <section className="border-border rounded-lg border p-4">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
          <IconHistory size={15} /> {t("publication.historyTitle")}
        </h3>
        {events.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t("publication.historyEmpty")}
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-baseline gap-2 text-sm">
                <span className="text-muted-foreground w-28 shrink-0 text-xs tabular-nums">
                  {showDate(event.occurredAt)}
                </span>
                <span>
                  {event.fromStage ? (
                    <>
                      <span className="text-muted-foreground">
                        {STAGE_KEYS[event.fromStage]
                          ? t(STAGE_KEYS[event.fromStage]!)
                          : event.fromStage}
                      </span>
                      <span className="text-muted-foreground mx-1.5">→</span>
                    </>
                  ) : null}
                  <span className="font-medium">
                    {STAGE_KEYS[event.toStage]
                      ? t(STAGE_KEYS[event.toStage]!)
                      : event.toStage}
                  </span>
                </span>
                {event.note ? (
                  <span className="text-muted-foreground text-xs">— {event.note}</span>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Cibles de diffusion -------------------------------------------------- */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{t("publication.targetsTitle")}</h3>
        {publications.length === 0 ? (
          <EmptyState
            title={t("publication.targetsEmptyTitle")}
            hint={t("publication.targetsEmptyHint")}
          />
        ) : (
          publications.map((publication) => (
            <PublicationCard key={publication.id} publication={publication} />
          ))
        )}
      </section>

      <section className="border-border rounded-lg border p-4">
        <h3 className="mb-3 text-sm font-semibold">
          {t("publication.addTargetTitle")}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">{t("publication.platform")}</span>
            <Input
              value={draft.platform}
              onChange={(event) => setDraft({ ...draft, platform: event.target.value })}
              placeholder={t("publication.platformPlaceholder")}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">{t("publication.seoTitle")}</span>
            <Input
              value={draft.seoTitle}
              onChange={(event) => setDraft({ ...draft, seoTitle: event.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs sm:col-span-2">
            <span className="font-medium">{t("publication.seoDescription")}</span>
            <Textarea
              className="min-h-16"
              value={draft.seoDescription}
              onChange={(event) =>
                setDraft({ ...draft, seoDescription: event.target.value })
              }
            />
          </label>
          <label className="flex flex-col gap-1 text-xs sm:col-span-2">
            <span className="font-medium">{t("publication.keywords")}</span>
            <Input
              value={draft.keywords}
              onChange={(event) => setDraft({ ...draft, keywords: event.target.value })}
              placeholder={t("publication.keywordsPlaceholder")}
            />
          </label>
        </div>
        <Button
          size="sm"
          className="mt-3"
          disabled={!draft.platform.trim() || upsert.isPending}
          onClick={() =>
            upsert.mutate(
              { videoId, ...draft },
              {
                onSuccess: () =>
                  setDraft({
                    platform: "",
                    seoTitle: "",
                    seoDescription: "",
                    keywords: "",
                  }),
              },
            )
          }
        >
          <IconPlus size={14} /> {t("studio.add")}
        </Button>
      </section>
    </div>
  );
}

/** Une cible de diffusion, ses relevés, et le formulaire pour en ajouter un. */
function PublicationCard({ publication }: { publication: Publication }) {
  const t = useT();
  const record = useActionMutation("record-metrics");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    measuredOn: new Date().toISOString().slice(0, 10),
    views: "",
    likes: "",
    comments: "",
    retentionPct: "",
  });
  const [error, setError] = useState<string | null>(null);

  const numeric = (value: string) =>
    value.trim() === "" ? undefined : Number(value.trim());

  return (
    <article className="border-border rounded-lg border p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold">{publication.platform}</h4>
        <Badge tone={publication.status === "published" ? "ok" : "muted"}>
          {publication.status === "published"
            ? t("publication.statusPublished")
            : t("publication.statusPlanned")}
        </Badge>
      </div>
      {publication.seoTitle ? (
        <p className="text-sm">{publication.seoTitle}</p>
      ) : null}
      {publication.seoDescription ? (
        <p className="text-muted-foreground text-xs">{publication.seoDescription}</p>
      ) : null}
      {publication.keywords ? (
        <p className="text-muted-foreground mt-1 text-xs">
          {t("publication.keywordsLine", { keywords: publication.keywords })}
        </p>
      ) : null}

      <div className="mt-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h5 className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
            <IconChartBar size={14} /> {t("publication.metricsTitle")}
          </h5>
          <Button size="sm" variant="ghost" onClick={() => setOpen((value) => !value)}>
            {open ? t("studio.close") : t("publication.recordMetric")}
          </Button>
        </div>

        {publication.metrics.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            {t("publication.metricsEmpty")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-md border-collapse text-xs">
              <thead>
                <tr className="text-muted-foreground border-b text-left">
                  <th className="py-1.5 pr-3">{t("publication.colDate")}</th>
                  <th className="py-1.5 pr-3 text-right">
                    {t("publication.colViews")}
                  </th>
                  <th className="py-1.5 pr-3 text-right">
                    {t("publication.colLikes")}
                  </th>
                  <th className="py-1.5 pr-3 text-right">
                    {t("publication.colCommentsShort")}
                  </th>
                  <th className="py-1.5 text-right">
                    {t("publication.colRetention")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {publication.metrics.map((metric) => (
                  <tr key={metric.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-3 tabular-nums">{metric.measuredOn}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {metric.views ?? "—"}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {metric.likes ?? "—"}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {metric.comments ?? "—"}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {metric.retentionPct === null ? "—" : `${metric.retentionPct} %`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {open ? (
          <div className="bg-muted/40 mt-3 rounded-md p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium">{t("publication.colDate")}</span>
                <input
                  type="date"
                  value={draft.measuredOn}
                  onChange={(event) =>
                    setDraft({ ...draft, measuredOn: event.target.value })
                  }
                  className="border-input bg-background rounded-md border px-2 py-1 text-xs"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium">{t("publication.colViews")}</span>
                <Input
                  inputMode="numeric"
                  value={draft.views}
                  onChange={(event) => setDraft({ ...draft, views: event.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium">{t("publication.colLikes")}</span>
                <Input
                  inputMode="numeric"
                  value={draft.likes}
                  onChange={(event) => setDraft({ ...draft, likes: event.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium">{t("publication.comments")}</span>
                <Input
                  inputMode="numeric"
                  value={draft.comments}
                  onChange={(event) =>
                    setDraft({ ...draft, comments: event.target.value })
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium">{t("publication.retentionPct")}</span>
                <Input
                  inputMode="numeric"
                  value={draft.retentionPct}
                  onChange={(event) =>
                    setDraft({ ...draft, retentionPct: event.target.value })
                  }
                />
              </label>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                disabled={record.isPending}
                onClick={() =>
                  record.mutate(
                    {
                      publicationId: publication.id,
                      measuredOn: draft.measuredOn,
                      ...(numeric(draft.views) === undefined
                        ? {}
                        : { views: numeric(draft.views) }),
                      ...(numeric(draft.likes) === undefined
                        ? {}
                        : { likes: numeric(draft.likes) }),
                      ...(numeric(draft.comments) === undefined
                        ? {}
                        : { comments: numeric(draft.comments) }),
                      ...(numeric(draft.retentionPct) === undefined
                        ? {}
                        : { retentionPct: numeric(draft.retentionPct) }),
                    },
                    {
                      onSuccess: () => {
                        setOpen(false);
                        setError(null);
                      },
                      onError: (mutationError) =>
                        setError((mutationError as Error).message),
                    },
                  )
                }
              >
                {t("publication.saveMetric")}
              </Button>
              <span className="text-muted-foreground text-xs">
                {t("publication.oneMetricPerDay")}
              </span>
            </div>
            {error ? <p className="text-destructive mt-2 text-xs">{error}</p> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
