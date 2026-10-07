import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import {
  IconCopy,
  IconExternalLink,
  IconPhoto,
  IconSparkles,
  IconTrash,
  IconVideo,
} from "@tabler/icons-react";
import { useState } from "react";

import { Badge, EmptyState, Textarea } from "@/components/studio/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fillPrompt, type PromptTemplate } from "@shared/prompt-library";
import { fillCatalogPrompt } from "@shared/prompt-catalog/fill";
import { CATALOG_LANGUAGES, type CatalogFacet, type CatalogPrompt } from "@shared/prompt-catalog/types";

type Kind = "image" | "video";
type Source = "catalog" | "hero" | "mine";

interface MyPrompt {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  category: string;
  format: string | null;
  body: string;
  tags: string | null;
  sourceKey: string | null;
}

interface Response {
  catalog: CatalogPrompt[];
  catalogTotal: number;
  hasMore: boolean;
  facets: { categories: CatalogFacet[]; styles: CatalogFacet[]; scenes: CatalogFacet[] };
  facetTotals: { categories: number; styles: number; scenes: number };
  builtIn: PromptTemplate[];
  mine: MyPrompt[];
  counts: { image: number; video: number; catalog: number; hero: number; mine: number };
}

const PAGE = 24;

/**
 * La section Prompts.
 *
 * Trois sources, jamais mélangées : le catalogue livré avec l'application, les
 * prompts écrits pour le voyage du héros, et ceux de l'utilisateur. Seul le
 * catalogue est assez gros pour mériter des filtres — trois axes, comme sur le
 * site qui a inspiré l'écran : catégorie, style, scène.
 *
 * Rien de ce qui est livré n'est modifiable : « Copier chez moi » est le seul
 * chemin vers la modification, et c'est ce qui protège l'original.
 */
export function PromptsView() {
  const t = useT();
  const [kind, setKind] = useState<Kind>("image");
  const [source, setSource] = useState<Source>("catalog");
  const [category, setCategory] = useState<string | null>(null);
  const [style, setStyle] = useState<string | null>(null);
  const [scene, setScene] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const { data } = useActionQuery("list-prompts", {
    kind,
    limit,
    ...(category ? { category } : {}),
    ...(style ? { style } : {}),
    ...(scene ? { scene } : {}),
    ...(search.trim() ? { search } : {}),
  });

  const result = data as Response | undefined;
  const filtersActive = Boolean(category || style || scene);

  /** Changer un filtre remet la pagination à zéro : sinon on garde une page vide. */
  const reset = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    setLimit(PAGE);
  };

  return (
    <div className="flex flex-col gap-5 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("prompts.title")}</h2>
          <p className="text-muted-foreground text-sm">
            {result
              ? t("prompts.description", { count: result.counts.catalog })
              : t("prompts.descriptionShort")}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="bg-muted flex items-center gap-0.5 rounded-md p-0.5">
            {(
              [
                { id: "image" as const, label: t("prompts.image"), Icon: IconPhoto },
                { id: "video" as const, label: t("prompts.video"), Icon: IconVideo },
              ]
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => reset(setKind)(id)}
                aria-current={kind === id ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition",
                  kind === id
                    ? "bg-background font-medium shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon size={14} /> {label}
                {result ? (
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {result.counts[id]}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          <Input
            value={search}
            onChange={(event) => reset(setSearch)(event.target.value)}
            placeholder={t("prompts.search")}
            className="w-56"
          />
        </div>
      </header>

      <nav className="flex flex-wrap items-center gap-1 border-b pb-2">
        {(
          [
            { id: "catalog" as const, label: t("prompts.catalog"), n: result?.catalogTotal },
            { id: "hero" as const, label: t("prompts.heroJourney"), n: result?.builtIn.length },
            { id: "mine" as const, label: t("prompts.mine"), n: result?.mine.length },
          ]
        ).map(({ id, label, n }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSource(id)}
            aria-current={source === id ? "page" : undefined}
            className={cn(
              "rounded px-3 py-1.5 text-sm transition",
              source === id
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            {typeof n === "number" ? (
              <span className="ml-1.5 text-xs tabular-nums opacity-70">{n}</span>
            ) : null}
          </button>
        ))}
      </nav>

      {source === "catalog" ? (
        <>
          <div className="border-border flex flex-col gap-3 rounded-lg border p-4">
            <FacetRow
              title={t("templates.category")}
              facets={result?.facets.categories ?? []}
              total={result?.facetTotals.categories ?? 0}
              selected={category}
              onSelect={reset(setCategory)}
            />
            <FacetRow
              title={t("prompts.style")}
              facets={result?.facets.styles ?? []}
              total={result?.facetTotals.styles ?? 0}
              selected={style}
              onSelect={reset(setStyle)}
            />
            <FacetRow
              title={t("prompts.scene")}
              facets={result?.facets.scenes ?? []}
              total={result?.facetTotals.scenes ?? 0}
              selected={scene}
              onSelect={reset(setScene)}
            />
          </div>

          <div className="flex items-center gap-3">
            <p className="text-muted-foreground text-sm">
              {result ? `${result.catalogTotal} prompts` : "Chargement…"}
            </p>
            {filtersActive ? (
              <button
                type="button"
                onClick={() => {
                  setCategory(null);
                  setStyle(null);
                  setScene(null);
                  setLimit(PAGE);
                }}
                className="text-muted-foreground hover:text-foreground text-xs underline"
              >
                Tout effacer
              </button>
            ) : null}
          </div>

          {result && result.catalog.length === 0 ? (
            <EmptyState
              title={t("prompts.noMatch")}
              hint={t("prompts.noMatchHint")}
            />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(result?.catalog ?? []).map((prompt) => (
                <li key={prompt.key}>
                  <CatalogCard prompt={prompt} />
                </li>
              ))}
            </ul>
          )}

          {result?.hasMore ? (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setLimit(limit + PAGE)}>
                Voir plus — {result.catalogTotal - result.catalog.length} restants
              </Button>
            </div>
          ) : null}
        </>
      ) : null}

      {source === "hero" ? (
        <section>
          <p className="text-muted-foreground mb-3 text-sm">
            {t("prompts.heroHint")}
          </p>
          {(result?.builtIn.length ?? 0) === 0 ? (
            <p className="text-muted-foreground text-sm">{t("prompts.noMatch")}</p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(result?.builtIn ?? []).map((prompt) => (
                <li key={prompt.key}>
                  <HeroCard prompt={prompt} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {source === "mine" ? (
        <section>
          {(result?.mine.length ?? 0) === 0 ? (
            <EmptyState
              title={t("prompts.emptyMine")}
              hint={t("prompts.emptyMineHint")}
            />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(result?.mine ?? []).map((prompt) => (
                <li key={prompt.id}>
                  <MyPromptCard prompt={prompt} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}

/**
 * Une rangée de pastilles, « Tous » en tête, chacune avec son compte.
 *
 * `total` vient du serveur plutôt que d'une somme des facettes : un prompt porte
 * plusieurs styles, les additionner le compterait plusieurs fois.
 */
function FacetRow({
  title,
  facets,
  total,
  selected,
  onSelect,
}: {
  title: string;
  facets: CatalogFacet[];
  total: number;
  selected: string | null;
  onSelect: (value: string | null) => void;
}) {
  // Un axe sur lequel rien ne se trie n'a rien à proposer : on ne l'affiche pas.
  if (facets.length === 0) return null;

  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        <Chip active={selected === null} onClick={() => onSelect(null)}>
          Tous <Count value={total} />
        </Chip>
        {facets.map((facet) => (
          <Chip
            key={facet.key}
            active={selected === facet.key}
            onClick={() => onSelect(selected === facet.key ? null : facet.key)}
          >
            {facet.label} <Count value={facet.count} />
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition",
        active
          ? "border-primary bg-primary/10 text-primary font-medium"
          : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Count({ value }: { value: number }) {
  return <span className="ml-0.5 tabular-nums opacity-60">{value}</span>;
}

function CatalogCard({ prompt }: { prompt: CatalogPrompt }) {
  const t = useT();
  const copy = useActionMutation("upsert-prompt");
  const [expanded, setExpanded] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  const filled = fillCatalogPrompt(prompt.body, values);
  // Un cas du catalogue vidéo décrit parfois une méthode sans livrer de prompt.
  const methodOnly = prompt.body.trim().length === 0;

  return (
    <article className="border-border bg-card flex h-full flex-col gap-2 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold">{prompt.name}</h4>
        {prompt.format ? <Badge tone="accent">{prompt.format}</Badge> : null}
      </div>

      <p className="text-muted-foreground text-xs" lang="zh">
        {prompt.originalName}
      </p>

      <div className="flex flex-wrap gap-1">
        {[...prompt.styles, ...prompt.scenes].map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
        <Badge tone={prompt.language === "en" ? "ok" : "warn"}>
          {CATALOG_LANGUAGES[prompt.language]}
        </Badge>
        {prompt.variables.length > 0 ? (
          <Badge tone="accent">{prompt.variables.length} variable(s)</Badge>
        ) : null}
        {methodOnly ? <Badge tone="warn">{t("prompts.methodOnly")}</Badge> : null}
      </div>

      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="text-muted-foreground hover:text-foreground self-start text-xs"
      >
        {expanded
          ? t("prompts.collapse")
          : methodOnly
            ? t("prompts.seeMethod")
            : t("prompts.seeAndFill")}
      </button>

      {expanded ? (
        <div className="flex flex-col gap-2">
          {prompt.variables.map((variable) => (
            <label key={variable.key} className="flex flex-col gap-1 text-xs">
              <span className="font-medium">{variable.key}</span>
              <Input
                value={values[variable.key] ?? ""}
                onChange={(event) =>
                  setValues({ ...values, [variable.key]: event.target.value })
                }
                placeholder={variable.default || t("prompts.toFill")}
              />
            </label>
          ))}

          {methodOnly ? null : (
            <pre className="bg-muted/50 max-h-72 overflow-auto rounded p-2 text-[11px] whitespace-pre-wrap">
              {filled}
            </pre>
          )}

          {prompt.notes ? (
            <p className="text-muted-foreground text-[11px] whitespace-pre-wrap">{prompt.notes}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
        {methodOnly ? (
          <p className="text-muted-foreground text-xs">
            {t("prompts.methodOnlyHint")}
          </p>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={copy.isPending}
              onClick={() => copy.mutate({ fromCatalog: prompt.key })}
            >
              <IconCopy size={13} /> {t("prompts.copyToMine")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => sendToAgentChat({ message: filled, submit: true, openSidebar: true })}
            >
              <IconSparkles size={13} /> {t("create.send")}
            </Button>
          </>
        )}
        {prompt.source ? (
          <a
            href={prompt.source}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={t("prompts.viewSource")}
            className="text-muted-foreground hover:text-foreground ml-auto"
          >
            <IconExternalLink size={14} />
          </a>
        ) : null}
      </div>
    </article>
  );
}

function HeroCard({ prompt }: { prompt: PromptTemplate }) {
  const t = useT();
  const copy = useActionMutation("upsert-prompt");
  const [expanded, setExpanded] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  const filled = fillPrompt(prompt.body, values);
  const missing = prompt.variables.filter((variable) => !values[variable.key]?.trim());

  return (
    <article className="border-border bg-card flex h-full flex-col gap-2 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold">{prompt.name}</h4>
        <Badge tone="accent">{prompt.format}</Badge>
      </div>

      <p className="text-muted-foreground text-xs">{prompt.description}</p>

      <div className="flex flex-wrap gap-1">
        {prompt.tags.map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="text-muted-foreground hover:text-foreground self-start text-xs"
      >
        {expanded ? "▲ Replier" : "▼ Voir et remplir"}
      </button>

      {expanded ? (
        <div className="flex flex-col gap-2">
          {prompt.variables.map((variable) => (
            <label key={variable.key} className="flex flex-col gap-1 text-xs">
              <span className="font-medium">{variable.label}</span>
              <Input
                value={values[variable.key] ?? ""}
                onChange={(event) =>
                  setValues({ ...values, [variable.key]: event.target.value })
                }
                placeholder={variable.hint}
              />
            </label>
          ))}

          <pre className="bg-muted/50 max-h-52 overflow-auto rounded p-2 text-[11px] whitespace-pre-wrap">
            {filled}
          </pre>

          {missing.length > 0 ? (
            <p className="text-muted-foreground text-[11px]">
              {t("prompts.stillMissing", { count: missing.length })}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => copy.mutate({ fromBuiltIn: prompt.key })}
        >
          <IconCopy size={13} /> {t("prompts.copyToMine")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => sendToAgentChat({ message: filled, submit: true, openSidebar: true })}
        >
          <IconSparkles size={13} /> {t("create.send")}
        </Button>
      </div>
    </article>
  );
}

function MyPromptCard({ prompt }: { prompt: MyPrompt }) {
  const t = useT();
  const remove = useActionMutation("delete-prompt");
  const save = useActionMutation("upsert-prompt");
  const [body, setBody] = useState(prompt.body);

  const dirty = body !== prompt.body;

  return (
    <article className="border-border bg-card flex h-full flex-col gap-2 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold">{prompt.name}</h4>
        {prompt.format ? <Badge tone="accent">{prompt.format}</Badge> : null}
      </div>

      {prompt.sourceKey ? <Badge>{t("prompts.copiedFrom", { key: prompt.sourceKey })}</Badge> : null}

      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={6}
        className="text-[11px]"
      />

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <Button
          size="sm"
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate({ promptId: prompt.id, body })}
        >
          Enregistrer
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => sendToAgentChat({ message: body, submit: true, openSidebar: true })}
        >
          <IconSparkles size={13} /> {t("prompts.send")}
        </Button>
        <button
          type="button"
          aria-label={t("brandKits.delete")}
          onClick={() => remove.mutate({ promptId: prompt.id })}
          className="text-muted-foreground hover:text-destructive ml-auto"
        >
          <IconTrash size={14} />
        </button>
      </div>
    </article>
  );
}
