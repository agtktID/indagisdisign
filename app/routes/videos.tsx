import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
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

const STAGE_LABELS: Record<string, string> = {
  idea: "Idée",
  script: "Écriture",
  shoot: "Tournage",
  edit: "Montage",
  published: "Publiée",
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
  useSetPageTitle("Vidéos");
  const { data, isLoading } = useActionQuery("list-videos", {});
  const videos = (data as { videos: VideoRow[] } | undefined)?.videos ?? [];
  const create = useActionMutation("create-video");
  const [title, setTitle] = useState("");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Vos vidéos</h1>
          <p className="text-muted-foreground text-sm">
            Chaque carte montre où en est le récit, pas seulement où en est la fabrication.
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
            placeholder="Titre de la nouvelle vidéo"
            className="w-56"
          />
          <Button
            size="sm"
            disabled={!title.trim() || create.isPending}
            onClick={() => create.mutate({ title }, { onSuccess: () => setTitle("") })}
          >
            <IconPlus size={14} /> Créer
          </Button>
        </div>
      </header>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : videos.length === 0 ? (
        <EmptyState
          title="Aucune vidéo pour l'instant"
          hint="Créez un projet, puis ouvrez sa carte narrative : les 12 étapes du voyage du héros vous attendent, vides."
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
                      aria-label={`Bloquée depuis ${video.daysSinceStageChange} jours`}
                    />
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="accent">{STAGE_LABELS[video.stage] ?? video.stage}</Badge>
                  {video.kind === "short" ? <Badge>Format court</Badge> : null}
                  {video.dueAt ? (
                    <Badge>{new Date(video.dueAt).toLocaleDateString("fr-FR")}</Badge>
                  ) : null}
                </div>

                <div className="mt-auto">
                  <p className="text-muted-foreground mb-1 text-xs">Couverture narrative</p>
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
