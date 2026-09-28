import { useActionQuery } from "@agent-native/core/client/hooks";
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

const STAGE_LABELS: Record<string, string> = {
  idea: "Idée",
  script: "Écriture",
  shoot: "Tournage",
  edit: "Montage",
  published: "Publiée",
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

  const blockedList =
    (
      blocked.data as
        | { blocked: { video: VideoRow; daysSinceStageChange: number }[] }
        | undefined
    )?.blocked ?? [];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-6">
      <header>
        <h1 className="text-xl font-semibold">Échéances</h1>
        <p className="text-muted-foreground text-sm">
          Ce qui arrive, ce qui est dépassé, et ce qui n&apos;a pas bougé depuis trop
          longtemps.
        </p>
      </header>

      <Section title="Dépassées" rows={overdue} tone="warn" />
      <Section title="À venir" rows={upcoming} tone="muted" />

      <section>
        <h2 className="mb-2 text-sm font-semibold">Sans mouvement</h2>
        {blockedList.length === 0 ? (
          <p className="text-muted-foreground text-sm">Aucune vidéo bloquée.</p>
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
                    {STAGE_LABELS[entry.video.stage] ?? entry.video.stage}
                  </Badge>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {entry.daysSinceStageChange} j
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
  rows,
  tone,
}: {
  title: string;
  rows: (VideoRow & { dueAt: string })[];
  tone: "warn" | "muted";
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <EmptyState title={`Rien dans « ${title.toLowerCase()} »`} />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((video) => (
            <li key={video.id}>
              <Link
                to={`/video/${video.id}`}
                className="border-border hover:bg-muted/30 flex items-center gap-3 rounded-md border p-3 text-sm transition"
              >
                <span className="flex-1 truncate font-medium">{video.title}</span>
                <Badge tone="accent">{STAGE_LABELS[video.stage] ?? video.stage}</Badge>
                <Badge tone={tone}>
                  {new Date(video.dueAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                  })}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
