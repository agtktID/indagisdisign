import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import { useSetPageTitle } from "@agent-native/toolkit/app-shell";
import { IconArchive, IconArchiveOff, IconArrowLeft } from "@tabler/icons-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useEffect, useState } from "react";

import { ExperimentsTab } from "@/components/studio/ExperimentsTab";
import { MarkersTab } from "@/components/studio/MarkersTab";
import { PrepTab } from "@/components/studio/PrepTab";
import { PublicationTab } from "@/components/studio/PublicationTab";
import { StoryMap } from "@/components/studio/StoryMap";
import { Badge } from "@/components/studio/primitives";
import { cn } from "@/lib/utils";

export function meta() {
  return [{ title: "Fiche vidéo — Indagis Studio" }];
}

/**
 * La fiche vidéo : une seule route, cinq onglets.
 *
 * L'onglet et l'étape dépliée vivent dans la query string, pas dans le chemin — la fiche
 * reste un seul écran de premier niveau (FR-020), et un lien vers un onglet précis reste
 * partageable. `use-navigation-state` lit ces paramètres pour que l'agent sache ce que
 * l'utilisateur regarde.
 */
const TABS = [
  { id: "map", labelKey: "video.tabMap" },
  { id: "markers", labelKey: "video.tabMarkers" },
  { id: "prep", labelKey: "video.tabPrep" },
  { id: "experiments", labelKey: "video.tabExperiments" },
  { id: "publication", labelKey: "video.tabPublication" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** Les libellés vivent déjà dans le catalogue : on pointe dessus, on ne les recopie pas. */
const STAGE_KEYS: Record<string, string> = {
  idea: "publication.stageIdea",
  script: "publication.stageScript",
  shoot: "publication.stageShoot",
  edit: "publication.stageEdit",
  published: "publication.stagePublished",
};

export default function VideoRoute() {
  const t = useT();
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const videoId = id ?? "";

  const rawTab = searchParams.get("tab");
  const tab: TabId = TABS.some((entry) => entry.id === rawTab) ? (rawTab as TabId) : "map";

  const rawStep = Number(searchParams.get("step"));
  const openStep = Number.isInteger(rawStep) && rawStep >= 1 && rawStep <= 12 ? rawStep : null;

  const { data, isLoading, error } = useActionQuery("get-video", { videoId });
  const detail = data as
    | {
        video: {
          id: string;
          title: string;
          stage: string;
          dueAt: string | null;
          archivedAt: string | null;
        };
        coverage: { covered: number; total: number };
        isBlocked: boolean;
        daysSinceStageChange: number;
      }
    | undefined;

  useSetPageTitle(detail?.video.title ?? t("video.pageTitle"));

  function setTab(next: TabId) {
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    params.delete("step");
    setSearchParams(params, { replace: true });
  }

  function setStep(next: number | null) {
    const params = new URLSearchParams(searchParams);
    if (next === null) params.delete("step");
    else params.set("step", String(next));
    setSearchParams(params, { replace: true });
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <p className="text-destructive text-sm">{(error as Error).message}</p>
        <Link to="/videos" className="text-muted-foreground mt-3 inline-block text-sm underline">
          {t("video.backToList")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-6">
      <div>
        <Link
          to="/videos"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          <IconArrowLeft size={14} /> {t("video.allVideos")}
        </Link>
      </div>

      <header className="flex flex-wrap items-center justify-between gap-3">
        {isLoading || !detail ? (
          <h1 className="text-xl font-semibold">{t("video.loading")}</h1>
        ) : (
          <TitleField videoId={videoId} title={detail.video.title} />
        )}
        <div className="flex flex-wrap items-center gap-2">
          {detail ? (
            <>
              <Badge tone="accent">
                {STAGE_KEYS[detail.video.stage]
                  ? t(STAGE_KEYS[detail.video.stage]!)
                  : detail.video.stage}
              </Badge>
              <Badge tone={detail.coverage.covered === 12 ? "ok" : "muted"}>
                {t("video.stepsCovered", {
                  covered: detail.coverage.covered,
                  total: detail.coverage.total,
                })}
              </Badge>
              {detail.isBlocked ? (
                <Badge tone="warn">{t("video.blocked", { count: detail.daysSinceStageChange })}</Badge>
              ) : null}
              <DueDateField videoId={videoId} dueAt={detail.video.dueAt} />
              <ArchiveButton
                videoId={videoId}
                title={detail.video.title}
                archived={Boolean(detail.video.archivedAt)}
              />
            </>
          ) : null}
        </div>
      </header>

      <nav className="border-border flex gap-1 overflow-x-auto border-b" aria-label={t("video.sections")}>
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            aria-current={tab === entry.id ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm transition",
              tab === entry.id
                ? "border-primary text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {t(entry.labelKey)}
          </button>
        ))}
      </nav>

      {videoId ? (
        <>
          {tab === "map" ? (
            <StoryMap videoId={videoId} openStep={openStep} onOpenStep={setStep} />
          ) : null}
          {tab === "markers" ? <MarkersTab videoId={videoId} /> : null}
          {tab === "prep" ? <PrepTab videoId={videoId} /> : null}
          {tab === "experiments" ? <ExperimentsTab videoId={videoId} /> : null}
          {tab === "publication" ? <PublicationTab videoId={videoId} /> : null}
        </>
      ) : null}
    </div>
  );
}

/**
 * Le titre, modifiable sur place.
 *
 * FR-001 exige de pouvoir créer, **renommer** et archiver une vidéo. `update-video`
 * acceptait déjà un titre, mais aucune surface ne l'appelait : seul l'agent pouvait
 * renommer. Une fonctionnalité qui n'existe que pour l'agent n'est pas finie.
 *
 * Édition sur place plutôt qu'un écran de réglages — le Principe V limite l'interface,
 * et un titre se corrige là où on le lit.
 */
function TitleField({ videoId, title }: { videoId: string; title: string }) {
  const update = useActionMutation("update-video");
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  useEffect(() => {
    setDraft(title);
  }, [title]);

  // Un titre vide n'a pas de sens, et l'action le refuserait : on revient au précédent.
  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    if (!next || next === title) {
      setDraft(title);
      return;
    }
    update.mutate({ videoId, title: next });
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        title={t("video.rename")}
        className="hover:bg-muted/60 -mx-2 rounded-md px-2 py-0.5 text-left text-xl font-semibold transition"
      >
        {title}
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
        if (event.key === "Escape") {
          setDraft(title);
          setEditing(false);
        }
      }}
      aria-label={t("video.titleLabel")}
      className="border-input bg-background -mx-2 rounded-md border px-2 py-0.5 text-xl font-semibold"
    />
  );
}

/**
 * L'archivage, réversible, depuis l'en-tête.
 *
 * `archive-video` existait sans aucune surface. L'archivage est logique et se défait
 * — d'où une confirmation simple plutôt qu'un dialogue lourd : ce n'est pas une
 * suppression, et le dire est plus utile que de faire peur.
 */
function ArchiveButton({
  videoId,
  title,
  archived,
}: {
  videoId: string;
  title: string;
  archived: boolean;
}) {
  const t = useT();
  const archive = useActionMutation("archive-video");
  const navigate = useNavigate();
  const label = archived ? t("video.unarchive") : t("video.archive");

  return (
    <button
      type="button"
      disabled={archive.isPending}
      onClick={() => {
        // On ne demande confirmation que dans le sens qui retire la vidéo de la liste.
        // Désarchiver est sans conséquence, et une boîte de dialogue y serait du bruit.
        if (!archived) {
          const confirmed = window.confirm(
            `${t("video.archiveConfirm", { title })}\n\n${t("video.archiveExplain")}`,
          );
          if (!confirmed) return;
        }
        // Le bouton ne savait qu'archiver : `archived` n'était jamais passé, donc toujours
        // `true` par défaut. Une fois archivée, la fiche restait atteignable par son URL
        // mais plus rien ne permettait de faire le chemin inverse.
        archive.mutate(
          { videoId, archived: !archived },
          { onSuccess: () => (archived ? undefined : navigate("/videos")) },
        );
      }}
      title={label}
      aria-label={label}
      className="text-muted-foreground hover:text-foreground rounded-md p-1.5 transition disabled:opacity-50"
    >
      {archived ? <IconArchiveOff size={15} /> : <IconArchive size={15} />}
    </button>
  );
}

/**
 * L'échéance de la vidéo, éditable depuis l'en-tête.
 *
 * C'est la seule donnée que le calendrier lit et que l'utilisateur doit pouvoir poser :
 * sans ce champ, les blocs « Dépassées » et « À venir » restaient vides pour toujours.
 * Placée ici plutôt que dans un écran de réglages — trois routes, pas quatre.
 */
function DueDateField({ videoId, dueAt }: { videoId: string; dueAt: string | null }) {
  const t = useT();
  const update = useActionMutation("update-video");
  const value = dueAt ? dueAt.slice(0, 10) : "";

  return (
    <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
      <span>{t("video.dueDate")}</span>
      <input
        type="date"
        value={value}
        onChange={(event) =>
          update.mutate({
            videoId,
            dueAt: event.target.value
              ? new Date(`${event.target.value}T12:00:00Z`).toISOString()
              : null,
          })
        }
        className="border-input bg-background text-foreground rounded-md border px-2 py-1 text-xs"
        aria-label={t("video.dueDateLabel")}
      />
      {value ? (
        <button
          type="button"
          onClick={() => update.mutate({ videoId, dueAt: null })}
          className="hover:text-foreground px-1"
          aria-label={t("video.clearDueDate")}
        >
          ×
        </button>
      ) : null}
    </label>
  );
}
