import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import { IconPlus, IconSearch, IconTrash } from "@tabler/icons-react";
import { useState } from "react";

import { Badge, EmptyState, Textarea } from "@/components/studio/primitives";
import { confirmDelete } from "@/lib/confirm-delete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ASSET_CATEGORIES,
  ASSET_FORMATS,
  ASSET_KINDS,
} from "@shared/asset-taxonomy";

type Status = "draft" | "generated" | "reference";

const TABS: { id: Status; labelKey: string }[] = [
  { id: "draft", labelKey: "assets.tabDraft" },
  { id: "generated", labelKey: "assets.tabGenerated" },
  { id: "reference", labelKey: "assets.tabReference" },
];

interface Asset {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  category: string;
  format: string | null;
  status: string;
  url: string | null;
  thumbnailUrl: string | null;
  tags: string | null;
  kindLabel: string;
  categoryLabel: string;
  formatLabel: string | null;
  ratio: number | null;
}

interface Counts {
  draft: number;
  generated: number;
  reference: number;
  total: number;
}

export function AssetsView() {
  const t = useT();
  const [status, setStatus] = useState<Status>("draft");
  const [kind, setKind] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);

  const { data } = useActionQuery("list-assets", {
    status,
    ...(kind ? { kind } : {}),
    ...(category ? { category } : {}),
    ...(search.trim() ? { search } : {}),
  });

  const result = data as { assets: Asset[]; shown: number; counts: Counts } | undefined;
  const assets = result?.assets ?? [];
  const counts = result?.counts;

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="bg-muted flex items-center gap-0.5 rounded-md p-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatus(tab.id)}
              aria-current={status === tab.id ? "page" : undefined}
              className={cn(
                "rounded px-3 py-1.5 text-sm transition",
                status === tab.id
                  ? "bg-background font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(tab.labelKey)}
              {counts ? (
                <span className="text-muted-foreground ml-1.5 text-xs tabular-nums">
                  {counts[tab.id]}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <Badge tone="muted">{t("assets.shown", { count: result?.shown ?? 0 })}</Badge>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <IconSearch
              size={14}
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("assets.search")}
              className="w-64 pl-8"
            />
          </div>
          <Button size="sm" onClick={() => setAdding(true)}>
            <IconPlus size={14} /> {t("studio.add")}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterSelect
          label={t("assets.type")}
          value={kind}
          onChange={setKind}
          options={ASSET_KINDS.map((entry) => ({ key: entry.key, label: entry.label }))}
          allLabel={t("assets.allTypes")}
        />
        <FilterSelect
          label={t("templates.category")}
          value={category}
          onChange={setCategory}
          options={ASSET_CATEGORIES.map((entry) => ({ key: entry.key, label: entry.label }))}
          allLabel={t("assets.allCategories")}
        />
      </div>

      {assets.length === 0 ? (
        <EmptyState
          title={
            status === "draft"
              ? t("assets.emptyDraft")
              : t("assets.emptyReusable")
          }
          hint={t("assets.emptyHint")}
          action={
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              {t("assets.addAsset")}
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {assets.map((asset) => (
            <li key={asset.id}>
              <AssetCard asset={asset} />
            </li>
          ))}
        </ul>
      )}

      {adding ? <AddAssetDialog status={status} onClose={() => setAdding(false)} /> : null}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { key: string; label: string }[];
  allLabel: string;
}) {
  return (
    <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-input bg-background text-foreground rounded-md border px-2 py-1 text-xs"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Les trois états d'une ressource, qui sont aussi les trois onglets.
 *
 * Une ressource naissait dans son état et y restait : un brouillon ne pouvait pas
 * devenir une référence une fois produit. `upsert-asset` acceptait pourtant `status`
 * depuis toujours — il manquait seulement le geste.
 */
const STATUSES = [
  { value: "draft", labelKey: "assets.tabDraft" },
  { value: "generated", labelKey: "assets.tabGenerated" },
  { value: "reference", labelKey: "assets.tabReference" },
] as const;

function AssetCard({ asset }: { asset: Asset }) {
  const t = useT();
  const remove = useActionMutation("delete-asset");
  const upsert = useActionMutation("upsert-asset");

  return (
    <article className="border-border bg-card flex h-full flex-col overflow-hidden rounded-lg border">
      <div
        className="bg-muted/50 flex items-center justify-center overflow-hidden"
        style={{ aspectRatio: asset.ratio ?? 16 / 9 }}
      >
        {asset.thumbnailUrl || asset.url ? (
          <img
            src={asset.thumbnailUrl ?? asset.url ?? ""}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-muted-foreground text-xs">{asset.kindLabel}</span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 text-sm font-medium">{asset.name}</h3>
        <div className="flex flex-wrap gap-1">
          <Badge tone="accent">{asset.kindLabel}</Badge>
          <Badge tone="muted">{asset.categoryLabel}</Badge>
          {asset.formatLabel ? <Badge>{asset.formatLabel}</Badge> : null}
        </div>
        {asset.tags ? (
          <p className="text-muted-foreground line-clamp-1 text-[11px]">{asset.tags}</p>
        ) : null}

        <label className="flex items-center gap-1.5 text-[11px]">
          <span className="text-muted-foreground">{t("assets.statusLabel")}</span>
          <select
            value={asset.status}
            disabled={upsert.isPending}
            // `name` est obligatoire côté action : on le renvoie, sinon changer
            // l'état effacerait le titre de la ressource.
            onChange={(event) =>
              upsert.mutate({
                assetId: asset.id,
                name: asset.name,
                status: event.target.value as (typeof STATUSES)[number]["value"],
              })
            }
            className="border-input bg-background rounded border px-1.5 py-0.5"
          >
            {STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {t(status.labelKey)}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-auto flex items-center justify-between pt-1">
          {asset.url ? (
            <a
              href={asset.url}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground text-xs underline"
            >
              {t("assets.open")}
            </a>
          ) : (
            <span className="text-muted-foreground text-xs">{t("assets.noLink")}</span>
          )}
          <button
            type="button"
            aria-label={t("assets.remove")}
            onClick={() => {
              if (!confirmDelete(t, asset.name)) return;
              remove.mutate({ assetId: asset.id });
            }}
            className="text-muted-foreground hover:text-destructive"
          >
            <IconTrash size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}

function AddAssetDialog({ status, onClose }: { status: Status; onClose: () => void }) {
  const t = useT();
  const create = useActionMutation("upsert-asset");
  const [draft, setDraft] = useState({
    name: "",
    kind: "image",
    category: "other",
    format: "1:1",
    url: "",
    tags: "",
    description: "",
  });
  const [error, setError] = useState<string | null>(null);

  const needsFormat = !["audio", "document", "font", "palette"].includes(draft.kind);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("assets.addAsset")}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="border-border bg-card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{t("assets.addAsset")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("studio.close")}
            className="text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">{t("brandKits.name")}</span>
            <Input
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium">{t("assets.type")}</span>
              <select
                value={draft.kind}
                onChange={(event) => setDraft({ ...draft, kind: event.target.value })}
                className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              >
                {ASSET_KINDS.map((entry) => (
                  <option key={entry.key} value={entry.key}>
                    {entry.label} — {entry.hint}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium">{t("templates.category")}</span>
              <select
                value={draft.category}
                onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              >
                {ASSET_CATEGORIES.map((entry) => (
                  <option key={entry.key} value={entry.key}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {needsFormat ? (
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium">{t("templates.format")}</span>
              <select
                value={draft.format}
                onChange={(event) => setDraft({ ...draft, format: event.target.value })}
                className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              >
                {ASSET_FORMATS.map((entry) => (
                  <option key={entry.key} value={entry.key}>
                    {entry.label} — {entry.usage}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">{t("assets.link")}</span>
            <Input
              value={draft.url}
              onChange={(event) => setDraft({ ...draft, url: event.target.value })}
              placeholder={t("assets.linkPlaceholder")}
            />
            <span className="text-muted-foreground">
              {t("assets.linkHint")}
            </span>
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">{t("assets.keywords")}</span>
            <Input
              value={draft.tags}
              onChange={(event) => setDraft({ ...draft, tags: event.target.value })}
              placeholder={t("assets.keywordsPlaceholder")}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">{t("brandKits.descriptionLabel")}</span>
            <Textarea
              className="min-h-16"
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
          </label>
        </div>

        {error ? <p className="text-destructive mt-3 text-xs">{error}</p> : null}

        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose}>
            {t("templates.cancel")}
          </Button>
          <Button
            size="sm"
            disabled={!draft.name.trim() || create.isPending}
            onClick={() =>
              create.mutate(
                {
                  ...draft,
                  status,
                  format: needsFormat ? draft.format : null,
                },
                {
                  onSuccess: onClose,
                  onError: (mutationError) => setError((mutationError as Error).message),
                },
              )
            }
          >
            {t("studio.add")}
          </Button>
        </div>
      </div>
    </div>
  );
}
