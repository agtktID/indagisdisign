import { useActionQuery } from "@agent-native/core/client/hooks";
import { useFormatters, useT } from "@agent-native/core/client/i18n";
import { useSetPageTitle } from "@agent-native/toolkit/app-shell";
import {
  IconClipboardList,
  IconDownload,
  IconLayoutGrid,
  IconMessage2Bolt,
  IconPalette,
  IconSparkles,
  IconTemplate,
} from "@tabler/icons-react";
import { useSearchParams } from "react-router";

import { AssetsView } from "@/components/library/AssetsView";
import { BrandKitsView } from "@/components/library/BrandKitsView";
import { CreateView } from "@/components/library/CreateView";
import { TemplateEditor } from "@/components/library/TemplateEditor";
import { PromptsView } from "@/components/library/PromptsView";
import { StarterView } from "@/components/library/StarterView";
import { TemplatesView } from "@/components/library/TemplatesView";
import { Badge } from "@/components/studio/primitives";
import { cn } from "@/lib/utils";

export function meta() {
  return [{ title: "Bibliothèque — Indagis Studio" }];
}

/**
 * La bibliothèque : l'espace de travail des ressources de création.
 *
 * C'est le quatrième écran de premier niveau. La constitution limite l'interface à trois
 * routes et exige une justification explicite au-delà : celle-ci est la demande de
 * l'utilisateur d'un espace où ranger vidéos, images, sons et modèles, parce que sans
 * rangement on se perd. Les sections vivent dans cette seule route, pas en écrans
 * séparés — la prolifération reste un échec de conception.
 */
const SECTIONS = [
  { id: "create", labelKey: "library.sectionCreate", Icon: IconSparkles },
  { id: "library", labelKey: "library.sectionLibrary", Icon: IconLayoutGrid },
  { id: "prompts", labelKey: "library.sectionPrompts", Icon: IconMessage2Bolt },
  { id: "templates", labelKey: "library.sectionTemplates", Icon: IconTemplate },
  { id: "starter", labelKey: "library.sectionStarter", Icon: IconDownload },
  { id: "kits", labelKey: "library.sectionKits", Icon: IconPalette },
  { id: "journal", labelKey: "library.sectionJournal", Icon: IconClipboardList },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export default function LibraryRoute() {
  const t = useT();
  useSetPageTitle(t("library.pageTitle"));
  const [searchParams, setSearchParams] = useSearchParams();

  const rawSection = searchParams.get("section");
  const section: SectionId = SECTIONS.some((entry) => entry.id === rawSection)
    ? (rawSection as SectionId)
    : "library";

  const editingTemplateId = searchParams.get("template");

  function go(next: SectionId) {
    const params = new URLSearchParams(searchParams);
    params.set("section", next);
    params.delete("template");
    setSearchParams(params, { replace: true });
  }

  function editTemplate(templateId: string | null) {
    const params = new URLSearchParams(searchParams);
    params.set("section", "templates");
    if (templateId) params.set("template", templateId);
    else params.delete("template");
    setSearchParams(params, { replace: true });
  }

  return (
    <div className="flex h-full min-h-0">
      <nav
        aria-label={t("library.sections")}
        className="border-border bg-sidebar-background/40 flex w-52 shrink-0 flex-col gap-0.5 border-r p-2"
      >
        {SECTIONS.map(({ id, labelKey, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => go(id)}
            aria-current={section === id ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition",
              section === id
                ? "bg-muted font-medium"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <Icon size={15} className="shrink-0" strokeWidth={1.8} />
            <span className="truncate">{t(labelKey)}</span>
          </button>
        ))}
      </nav>

      <div className="min-w-0 flex-1 overflow-y-auto">
        {section === "create" ? <CreateView /> : null}
        {section === "library" ? <AssetsView /> : null}
        {section === "templates" ? (
          editingTemplateId ? (
            <TemplateEditor
              templateId={editingTemplateId}
              onBack={() => editTemplate(null)}
            />
          ) : (
            <TemplatesView onEdit={editTemplate} />
          )
        ) : null}
        {section === "prompts" ? <PromptsView /> : null}
        {section === "starter" ? <StarterView onInstalled={() => go("templates")} /> : null}
        {section === "kits" ? <BrandKitsView /> : null}
        {section === "journal" ? <JournalView /> : null}
      </div>
    </div>
  );
}

/** Le journal : ce qui a bougé récemment dans la bibliothèque. */
function JournalView() {
  const t = useT();
  // `useFormatters` n'expose pas de `formatDateTime` : la date et l'heure passent par
  // `formatDate` avec les options d'heure, et suivent la locale active.
  const { formatDate } = useFormatters();
  const { data } = useActionQuery("list-assets", {});
  const assets =
    (data as { assets: { id: string; name: string; kindLabel: string; status: string; updatedAt: string }[] } | undefined)
      ?.assets ?? [];

  const templatesQuery = useActionQuery("list-asset-templates", {});
  const templates =
    (templatesQuery.data as { templates: { id: string; name: string; updatedAt: string }[] } | undefined)
      ?.templates ?? [];

  const entries = [
    ...assets.map((asset) => ({
      id: `a-${asset.id}`,
      when: asset.updatedAt,
      what: t("library.journalEntry", { kind: asset.kindLabel, name: asset.name }),
      tag: asset.status,
    })),
    ...templates.map((template) => ({
      id: `t-${template.id}`,
      when: template.updatedAt,
      what: t("library.journalTemplate", { name: template.name }),
      tag: t("library.tagTemplate"),
    })),
  ].sort((a, b) => (a.when < b.when ? 1 : -1));

  return (
    <div className="flex flex-col gap-4 p-6">
      <header>
        <h2 className="text-lg font-semibold">{t("library.journalTitle")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("library.journalDescription")}
        </p>
      </header>

      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("library.journalEmpty")}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {entries.slice(0, 100).map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-baseline gap-2 text-sm">
              <span className="text-muted-foreground w-36 shrink-0 text-xs tabular-nums">
                {formatDate(new Date(entry.when), {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className="flex-1">{entry.what}</span>
              <Badge tone="muted">{entry.tag}</Badge>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
