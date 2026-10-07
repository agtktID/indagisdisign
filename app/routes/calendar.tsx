import { useActionQuery } from "@agent-native/core/client/hooks";
import { useFormatters, useT } from "@agent-native/core/client/i18n";
import { useSetPageTitle } from "@agent-native/toolkit/app-shell";
import { IconAlertTriangle } from "@tabler/icons-react";
import { Link } from "react-router";

import { Badge, EmptyState } from "@/components/studio/primitives";

export function meta() {
  return [{ title: "Calendrier — Indagis Studio" }];
}

interface VideoRow {
  id: string;
  title: string;
  stage: string;
  dueAt: string | null;
  isBlocked: boolean;
  daysSinceStageChange: number;
}

/** Les libellés vivent déjà dans le catalogue : on pointe dessus, on ne les recopie pas. */
const STAGE_KEYS: Record<string, string> = {
  idea: "publication.stageIdea",
  script: "publication.stageScript",
  shoot: "publication.stageShoot",
  edit: "publication.stageEdit",
  published: "publication.stagePublished",
};

function daysUntil(iso: string): number {
  return Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000);
}

export default function CalendarRoute() {
  useSetPageTitle("Calendrier");
  const { data } = useActionQuery("list-videos", {});
  const blocked = useActionQuery("list-blocked", {});

  const videos = (data as { videos: VideoRow[] } | undefined)?.videos ?? [];
  const withDue = videos
    .filter((video): video is VideoRow & { dueAt: string } => Boolean(video.dueAt))
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));

  const overdue = withDue.filter((video) => daysUntil(video.dueAt) < 0);
  const upcoming = withDue.filter((video) => daysUntil(video.dueAt) >= 0);

  const t = useT();
  const blockedList =
    (
      blocked.data as
        | { blocked: { video: VideoRow; daysSinceStageChange: number }[] }
        | undefined
    )?.blocked ?? [];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-6">
      <header>
        <h1 className="text-xl font-semibold">{t("calendar.heading")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("calendar.description")}
        </p>
      </header>

      <Section
        title={t("calendar.overdue")}
        emptyTitle={t("calendar.overdueEmpty")}
        rows={overdue}
        tone="warn"
      />
      <Section
        title={t("calendar.upcoming")}
        emptyTitle={t("calendar.upcomingEmpty")}
        rows={upcoming}
        tone="muted"
      />

      <section>
        <h2 className="mb-2 text-sm font-semibold">{t("calendar.stalled")}</h2>
        {blockedList.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("calendar.stalledEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {blockedList.map((entry) => (
              <li key={entry.video.id}>
                <Link
                  to={`/video/${entry.video.id}`}
                  className="border-border hover:bg-muted/30 flex items-center gap-3 rounded-md border p-3 text-sm transition"
                >
                  <IconAlertTriangle
                    size={16}
                    className="shrink-0 text-amber-600 dark:text-amber-400"
                  />
                  <span className="flex-1 truncate font-medium">{entry.video.title}</span>
                  <Badge tone="accent">
                    {STAGE_KEYS[entry.video.stage]
                      ? t(STAGE_KEYS[entry.video.stage]!)
                      : entry.video.stage}
                  </Badge>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {t("calendar.days", { count: entry.daysSinceStageChange })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Section({
  title,
  emptyTitle,
  rows,
  tone,
}: {
  title: string;
  emptyTitle: string;
  rows: (VideoRow & { dueAt: string })[];
  tone: "warn" | "muted";
}) {
  const t = useT();
  const { formatDate } = useFormatters();
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <EmptyState title={emptyTitle} />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((video) => (
            <li key={video.id}>
              <Link
                to={`/video/${video.id}`}
                className="border-border hover:bg-muted/30 flex items-center gap-3 rounded-md border p-3 text-sm transition"
              >
                <span className="flex-1 truncate font-medium">{video.title}</span>
                <Badge tone="accent">
                  {STAGE_KEYS[video.stage] ? t(STAGE_KEYS[video.stage]!) : video.stage}
                </Badge>
                <Badge tone={tone}>
                  {formatDate(new Date(video.dueAt), { day: "numeric", month: "short" })}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
