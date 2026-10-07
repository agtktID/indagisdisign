import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { useFormatters, useT } from "@agent-native/core/client/i18n";
import { useSetPageTitle } from "@agent-native/toolkit/app-shell";
import { IconAlertTriangle, IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { Link } from "react-router";

import { Badge, CoverageBar, EmptyState } from "@/components/studio/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function meta() {
  return [{ title: "Vidéos — Indagis Studio" }];
}

/** Les libellés vivent déjà dans le catalogue : on pointe dessus, on ne les recopie pas. */
const STAGE_KEYS: Record<string, string> = {
  idea: "publication.stageIdea",
  script: "publication.stageScript",
  shoot: "publication.stageShoot",
  edit: "publication.stageEdit",
  published: "publication.stagePublished",
};

interface VideoRow {
  id: string;
  title: string;
  kind: string;
  stage: string;
  dueAt: string | null;
  isBlocked: boolean;
  daysSinceStageChange: number;
  coverage: { covered: number; total: number; byAct: Record<string, number> };
}

export default function VideosRoute() {
  const t = useT();
  const { formatDate } = useFormatters();
  useSetPageTitle(t("videos.pageTitle"));
  const { data, isLoading } = useActionQuery("list-videos", {});
  const videos = (data as { videos: VideoRow[] } | undefined)?.videos ?? [];
  const create = useActionMutation("create-video");
  const [title, setTitle] = useState("");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t("videos.heading")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("videos.description")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && title.trim()) {
                create.mutate({ title }, { onSuccess: () => setTitle("") });
              }
            }}
            placeholder={t("videos.newTitlePlaceholder")}
            className="w-56"
          />
          <Button
            size="sm"
            disabled={!title.trim() || create.isPending}
            onClick={() => create.mutate({ title }, { onSuccess: () => setTitle("") })}
          >
            <IconPlus size={14} /> {t("videos.create")}
          </Button>
        </div>
      </header>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">{t("videos.loading")}</p>
      ) : videos.length === 0 ? (
        <EmptyState
          title={t("videos.emptyTitle")}
          hint={t("videos.emptyHint")}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => (
            <li key={video.id}>
              <Link
                to={`/video/${video.id}`}
                className="border-border hover:border-primary/50 hover:bg-muted/30 flex h-full flex-col gap-3 rounded-lg border p-4 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="line-clamp-2 text-sm font-semibold">{video.title}</h2>
                  {video.isBlocked ? (
                    <IconAlertTriangle
                      size={16}
                      className="shrink-0 text-amber-600 dark:text-amber-400"
                      aria-label={t("videos.blocked", { count: video.daysSinceStageChange })}
                    />
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="accent">
                    {STAGE_KEYS[video.stage] ? t(STAGE_KEYS[video.stage]!) : video.stage}
                  </Badge>
                  {video.kind === "short" ? <Badge>{t("videos.shortFormat")}</Badge> : null}
                  {video.dueAt ? (
                    <Badge>{formatDate(new Date(video.dueAt))}</Badge>
                  ) : null}
                </div>

                <div className="mt-auto">
                  <p className="text-muted-foreground mb-1 text-xs">{t("videos.coverage")}</p>
                  <CoverageBar covered={video.coverage.covered} total={video.coverage.total} />
                  <div className="text-muted-foreground mt-1.5 flex gap-3 text-[11px]">
                    <span>I · {video.coverage.byAct.depart ?? 0}/4</span>
                    <span>II · {video.coverage.byAct.initiation ?? 0}/5</span>
                    <span>III · {video.coverage.byAct.retour ?? 0}/3</span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
