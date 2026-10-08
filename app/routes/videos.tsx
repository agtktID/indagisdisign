import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { useFormatters, useT } from "@agent-native/core/client/i18n";
import { useSetPageTitle } from "@agent-native/toolkit/app-shell";
import {
  IconAlertTriangle,
  IconArchive,
  IconArchiveOff,
  IconDots,
  IconPlus,
} from "@tabler/icons-react";
import { useState } from "react";
import { Link } from "react-router";

import { Badge, CoverageBar, EmptyState } from "@/components/studio/primitives";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  archivedAt: string | null;
  isBlocked: boolean;
  daysSinceStageChange: number;
  coverage: { covered: number; total: number; byAct: Record<string, number> };
}

export default function VideosRoute() {
  const t = useT();
  const { formatDate } = useFormatters();
  useSetPageTitle(t("videos.pageTitle"));
  // On demande **tout**, archivées comprises, et on trie côté écran. C'est ce qui permet
  // d'annoncer le nombre d'archivées sans un second aller-retour — et surtout de les
  // rendre atteignables : jusqu'ici `list-videos` était appelée nue, donc `includeArchived`
  // valait `false`, et une vidéo archivée disparaissait sans aucun chemin de retour.
  const { data, isLoading } = useActionQuery("list-videos", { includeArchived: true });
  const all = (data as { videos: VideoRow[] } | undefined)?.videos ?? [];
  const archivedCount = all.filter((video) => video.archivedAt).length;
  const [showArchived, setShowArchived] = useState(false);
  // Désarchiver la dernière vidéo vidait l'onglet « Archivées » et faisait disparaître la
  // bascule : on restait coincé devant un écran vide, sans rien à cliquer pour en sortir.
  // La vue retombe donc d'elle-même sur les actives dès qu'il n'y a plus rien à archiver.
  const viewingArchived = showArchived && archivedCount > 0;
  const videos = all.filter((video) => (viewingArchived ? video.archivedAt : !video.archivedAt));
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

      {/* La bascule n'apparaît qu'une fois qu'il y a quelque chose à y voir : sur une base
          neuve, un onglet « Archivées » vide ne ferait qu'encombrer. */}
      {archivedCount > 0 ? (
        <div className="bg-muted flex w-fit items-center gap-0.5 rounded-md p-0.5">
          <button
            type="button"
            aria-pressed={!viewingArchived}
            onClick={() => setShowArchived(false)}
            className={`rounded px-3 py-1.5 text-sm transition ${
              viewingArchived ? "text-muted-foreground hover:text-foreground" : "bg-background font-medium shadow-sm"
            }`}
          >
            {t("videos.filterActive")}
            <span className="text-muted-foreground ms-1.5 text-xs tabular-nums">
              {all.length - archivedCount}
            </span>
          </button>
          <button
            type="button"
            aria-pressed={viewingArchived}
            onClick={() => setShowArchived(true)}
            className={`rounded px-3 py-1.5 text-sm transition ${
              viewingArchived ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("videos.filterArchived")}
            <span className="text-muted-foreground ms-1.5 text-xs tabular-nums">
              {archivedCount}
            </span>
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">{t("videos.loading")}</p>
      ) : videos.length === 0 ? (
        <EmptyState
          title={viewingArchived ? t("videos.archivedEmptyTitle") : t("videos.emptyTitle")}
          hint={viewingArchived ? t("videos.archivedEmptyHint") : t("videos.emptyHint")}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => (
            <li key={video.id} className="relative">
              <Link
                to={`/video/${video.id}`}
                className="border-border hover:border-primary/50 hover:bg-muted/30 flex h-full flex-col gap-3 rounded-lg border p-4 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  {/* `pe-7` réserve la place du menu, qui flotte au-dessus de la carte :
                      un bouton imbriqué dans un lien serait du HTML invalide, et le clic
                      naviguerait au lieu d'ouvrir le menu. */}
                  <h2 className="line-clamp-2 pe-7 text-sm font-semibold">{video.title}</h2>
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
                  {video.archivedAt ? <Badge>{t("videos.archivedBadge")}</Badge> : null}
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
              <VideoCardMenu video={video} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Les gestes d'une carte, sans quitter la liste.
 *
 * Avant, la carte était un lien nu : le seul moyen d'archiver était d'ouvrir la fiche,
 * et le seul moyen de **désarchiver** était d'appeler l'action en ligne de commande — ce
 * que le message d'aide avouait lui-même. Une vidéo archivée était donc perdue pour qui
 * reste dans l'interface, alors que `archive-video` sait faire les deux sens depuis le
 * premier jour.
 *
 * On passe par le menu de Radix plutôt que par un `div` positionné à la main : il gère
 * le focus, la touche Échap et les rôles ARIA, qu'un menu maison redemanderait d'écrire.
 */
function VideoCardMenu({ video }: { video: VideoRow }) {
  const t = useT();
  const archive = useActionMutation("archive-video");
  const archived = Boolean(video.archivedAt);

  return (
    <div className="absolute end-2 top-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t("videos.cardActions")}
          className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring flex size-7 items-center justify-center rounded-md transition focus-visible:ring-2 focus-visible:outline-none"
        >
          <IconDots size={15} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={archive.isPending}
            onSelect={() => {
              // Désarchiver est sans danger : on ne demande confirmation que dans le sens
              // qui fait disparaître la vidéo de la liste.
              if (!archived) {
                const ok = window.confirm(
                  `${t("video.archiveConfirm", { title: video.title })}\n\n${t("video.archiveExplain")}`,
                );
                if (!ok) return;
              }
              archive.mutate({ videoId: video.id, archived: !archived });
            }}
          >
            {archived ? <IconArchiveOff size={14} /> : <IconArchive size={14} />}
            {archived ? t("videos.unarchive") : t("videos.archive")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
