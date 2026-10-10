import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import { IconCopy, IconDots, IconPlus, IconTrash } from "@tabler/icons-react";
import { useState } from "react";

import { Badge, EmptyState, Textarea } from "@/components/studio/primitives";
import { confirmDelete } from "@/lib/confirm-delete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ASSET_CATEGORIES,
  ASSET_FORMATS,
} from "@shared/asset-taxonomy";

interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string;
  format: string;
  categoryLabel: string;
  formatLabel: string;
  brandKitId: string | null;
  model: string | null;
  imageSize: string;
  promptTemplate: string | null;
  textPolicy: string | null;
  referencePolicy: string;
  composeCanonicalLogo: boolean;
  useSkeleton: boolean;
  sortOrder: number;
}

interface BrandKit {
  id: string;
  name: string;
}

const DEFAULT_TEXT_POLICY =
  "Ne préférez pas de texte intégré. Gardez tout texte demandé court et lisible.";

export function TemplatesView({
  onEdit,
}: {
  onEdit: (templateId: string) => void;
}) {
  const t = useT();
  const [category, setCategory] = useState<string>("");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const { data } = useActionQuery("list-asset-templates", {});
  const templates = (data as { templates: Template[] } | undefined)?.templates ?? [];

  const kitsQuery = useActionQuery("list-brand-kits", {});
  const brandKits = (kitsQuery.data as { brandKits: BrandKit[] } | undefined)?.brandKits ?? [];

  const needle = search.trim().toLowerCase();
  const shown = templates.filter(
    (template) =>
      (!category || template.category === category) &&
      (!needle ||
        `${template.name} ${template.description ?? ""}`.toLowerCase().includes(needle)),
  );

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="border-input bg-background rounded-md border px-3 py-2 text-sm"
          aria-label={t("templates.filterByCategory")}
        >
          <option value="">{t("templates.allTemplates")}</option>
          {ASSET_CATEGORIES.map((entry) => (
            <option key={entry.key} value={entry.key}>
              {entry.label}
            </option>
          ))}
        </select>

        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("templates.search")}
          className="max-w-md flex-1"
        />

        <Button size="sm" onClick={() => setCreating(true)}>
          <IconPlus size={14} /> {t("templates.newTemplate")}
        </Button>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title={t("templates.emptyTitle")}
          hint={t("templates.emptyHint")}
          action={
            <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
              {t("templates.newTemplate")}
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((template) => (
            <li key={template.id}>
              <TemplateCard template={template} brandKits={brandKits} onEdit={onEdit} />
            </li>
          ))}
        </ul>
      )}

      {creating ? (
        <NewTemplateDialog brandKits={brandKits} onClose={() => setCreating(false)} />
      ) : null}
    </div>
  );
}

function TemplateCard({
  template,
  brandKits,
  onEdit,
}: {
  template: Template;
  brandKits: BrandKit[];
  onEdit: (templateId: string) => void;
}) {
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const remove = useActionMutation("delete-asset-template");
  const duplicate = useActionMutation("duplicate-asset-template");

  const kitName = template.brandKitId
    ? (brandKits.find((kit) => kit.id === template.brandKitId)?.name ?? t("templates.kit"))
    : t("create.global");

  return (
    <article className="border-border bg-card flex h-full flex-col gap-2 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold">{template.name}</h3>
        <Badge>{template.formatLabel}</Badge>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge tone="muted">{kitName}</Badge>
        <Badge tone="muted">{template.imageSize}</Badge>
        <Badge tone="accent">{template.categoryLabel}</Badge>
      </div>

      <p className="text-muted-foreground line-clamp-3 text-xs">
        {template.description ?? t("templates.noDescription")}
      </p>

      <div className="mt-auto flex items-center justify-between pt-2">
        <Button size="sm" variant="ghost" onClick={() => onEdit(template.id)}>
          {t("templates.edit")}
        </Button>

        <div className="relative">
          <button
            type="button"
            aria-label={t("templates.moreOptions")}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="text-muted-foreground hover:text-foreground px-2"
          >
            <IconDots size={16} />
          </button>

          {menuOpen ? (
            <div className="border-border bg-popover absolute right-0 bottom-full z-10 mb-1 w-56 rounded-md border p-1 shadow-md">
              <p className="text-muted-foreground px-2 py-1 text-[11px]">
                {t("templates.duplicateInto")}
              </p>
              <button
                type="button"
                onClick={() => {
                  duplicate.mutate({ templateId: template.id, brandKitId: null });
                  setMenuOpen(false);
                }}
                className="hover:bg-muted flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs"
              >
                <IconCopy size={13} /> {t("templates.globalCopy")}
              </button>
              {brandKits.map((kit) => (
                <button
                  key={kit.id}
                  type="button"
                  onClick={() => {
                    duplicate.mutate({ templateId: template.id, brandKitId: kit.id });
                    setMenuOpen(false);
                  }}
                  className="hover:bg-muted flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs"
                >
                  <IconCopy size={13} /> {kit.name}
                </button>
              ))}
              <div className="bg-border my-1 h-px" />
              <button
                type="button"
                onClick={() => {
                  if (!confirmDelete(t, template.name)) {
                    setMenuOpen(false);
                    return;
                  }
                  remove.mutate({ templateId: template.id });
                  setMenuOpen(false);
                }}
                className="text-destructive hover:bg-muted flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs"
              >
                <IconTrash size={13} /> {t("brandKits.delete")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function NewTemplateDialog({
  brandKits,
  onClose,
}: {
  brandKits: BrandKit[];
  onClose: () => void;
}) {
  const t = useT();
  const create = useActionMutation("upsert-asset-template");
  const [draft, setDraft] = useState({
    name: "",
    brandKitId: "",
    category: "social",
    format: "1:1",
    promptTemplate: "",
    textPolicy: DEFAULT_TEXT_POLICY,
    composeCanonicalLogo: false,
  });
  const [error, setError] = useState<string | null>(null);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("templates.newTemplate")}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="border-border bg-card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{t("templates.newTemplate")}</h2>
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

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">{t("templates.brandKit")}</span>
            <select
              value={draft.brandKitId}
              onChange={(event) => setDraft({ ...draft, brandKitId: event.target.value })}
              className="border-input bg-background rounded-md border px-3 py-2 text-sm"
            >
              <option value="">{t("templates.globalNoKit")}</option>
              {brandKits.map((kit) => (
                <option key={kit.id} value={kit.id}>
                  {kit.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
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
          </div>

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">{t("templates.promptTemplate")}</span>
            <Textarea
              value={draft.promptTemplate}
              onChange={(event) => setDraft({ ...draft, promptTemplate: event.target.value })}
              placeholder={t("templates.promptPlaceholder")}
              rows={4}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">{t("templates.textPolicy")}</span>
            <Textarea
              value={draft.textPolicy}
              onChange={(event) => setDraft({ ...draft, textPolicy: event.target.value })}
              rows={3}
            />
          </label>

          <label className="border-border flex items-center gap-2 rounded-md border p-3 text-xs">
            <input
              type="checkbox"
              checked={draft.composeCanonicalLogo}
              onChange={(event) =>
                setDraft({ ...draft, composeCanonicalLogo: event.target.checked })
              }
            />
            <span>{t("templates.composeLogo")}</span>
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
                  name: draft.name,
                  category: draft.category,
                  format: draft.format,
                  promptTemplate: draft.promptTemplate,
                  textPolicy: draft.textPolicy,
                  composeCanonicalLogo: draft.composeCanonicalLogo,
                  brandKitId: draft.brandKitId || null,
                },
                {
                  onSuccess: onClose,
                  onError: (mutationError) => setError((mutationError as Error).message),
                },
              )
            }
          >
            {t("videos.create")}
          </Button>
        </div>
      </div>
    </div>
  );
}
