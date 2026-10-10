import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import { IconArrowLeft, IconDeviceFloppy, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { Badge, Textarea } from "@/components/studio/primitives";
import { confirmDelete } from "@/lib/confirm-delete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ASSET_CATEGORIES, ASSET_FORMATS } from "@shared/asset-taxonomy";

interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string;
  format: string;
  promptTemplate: string | null;
  textPolicy: string | null;
  referencePolicy: string;
  brandKitId: string | null;
  model: string | null;
  imageSize: string;
  composeCanonicalLogo: boolean;
  useSkeleton: boolean;
  skeletonUrl: string | null;
  sortOrder: number;
}

interface BrandKit {
  id: string;
  name: string;
}

export function TemplateEditor({
  templateId,
  onBack,
}: {
  templateId: string;
  onBack: () => void;
}) {
  const t = useT();
  const { data } = useActionQuery("list-asset-templates", {});
  const template = (data as { templates: Template[] } | undefined)?.templates.find(
    (entry) => entry.id === templateId,
  );

  const kitsQuery = useActionQuery("list-brand-kits", {});
  const brandKits = (kitsQuery.data as { brandKits: BrandKit[] } | undefined)?.brandKits ?? [];

  const save = useActionMutation("upsert-asset-template");
  const remove = useActionMutation("delete-asset-template");
  const [draft, setDraft] = useState<Template | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (template) setDraft(template);
  }, [template]);

  if (!draft) {
    return <p className="text-muted-foreground p-6 text-sm">{t("editor.loading")}</p>;
  }

  const set = <K extends keyof Template>(key: K, value: Template[K]) =>
    setDraft({ ...draft, [key]: value });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          <IconArrowLeft size={14} /> {t("editor.backToTemplates")}
        </button>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (!confirmDelete(t, draft.name)) return;
              remove.mutate({ templateId }, { onSuccess: onBack });
            }}
          >
            <IconTrash size={14} /> {t("brandKits.delete")}
          </Button>
          <Button
            size="sm"
            disabled={save.isPending}
            onClick={() =>
              save.mutate(
                {
                  templateId,
                  name: draft.name,
                  description: draft.description ?? undefined,
                  category: draft.category,
                  format: draft.format,
                  promptTemplate: draft.promptTemplate ?? undefined,
                  textPolicy: draft.textPolicy ?? undefined,
                  referencePolicy: draft.referencePolicy as "auto" | "always" | "never",
                  brandKitId: draft.brandKitId,
                  model: draft.model ?? undefined,
                  imageSize: draft.imageSize as "1K" | "2K" | "4K",
                  composeCanonicalLogo: draft.composeCanonicalLogo,
                  useSkeleton: draft.useSkeleton,
                  skeletonUrl: draft.skeletonUrl ?? undefined,
                  sortOrder: draft.sortOrder,
                },
                { onError: (mutationError) => setError((mutationError as Error).message) },
              )
            }
          >
            <IconDeviceFloppy size={14} />
            {save.isPending ? t("studio.saving") : t("editor.saveChanges")}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">{draft.name}</h2>
        <Badge tone="muted">
          {draft.brandKitId
            ? (brandKits.find((kit) => kit.id === draft.brandKitId)?.name ?? "Kit")
            : t("create.global")}
        </Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">{t("brandKits.name")}</span>
            <Input value={draft.name} onChange={(event) => set("name", event.target.value)} />
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">{t("brandKits.descriptionLabel")}</span>
            <Textarea
              value={draft.description ?? ""}
              onChange={(event) => set("description", event.target.value)}
              rows={2}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium">{t("templates.category")}</span>
              <select
                value={draft.category}
                onChange={(event) => set("category", event.target.value)}
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
              <span className="font-medium">{t("editor.aspectRatio")}</span>
              <select
                value={draft.format}
                onChange={(event) => set("format", event.target.value)}
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

          <div className="border-border rounded-lg border p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{t("editor.referencePolicy")}</p>
                <p className="text-muted-foreground text-xs">
                  {t("editor.referencePolicyHint")}
                </p>
              </div>
              <select
                value={draft.referencePolicy}
                onChange={(event) => set("referencePolicy", event.target.value)}
                className="border-input bg-background rounded-md border px-2 py-1 text-xs"
              >
                <option value="auto">auto</option>
                <option value="always">toujours</option>
                <option value="never">jamais</option>
              </select>
            </div>
          </div>

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">{t("templates.promptTemplate")}</span>
            <Textarea
              value={draft.promptTemplate ?? ""}
              onChange={(event) => set("promptTemplate", event.target.value)}
              rows={5}
              placeholder={t("editor.promptPlaceholder")}
            />
            <span className="text-muted-foreground">
              {t("editor.promptHint")}
            </span>
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">{t("templates.textPolicy")}</span>
            <Textarea
              value={draft.textPolicy ?? ""}
              onChange={(event) => set("textPolicy", event.target.value)}
              rows={3}
            />
          </label>

          <label className="border-border flex items-start gap-2 rounded-md border p-3 text-xs">
            <input
              type="checkbox"
              checked={draft.composeCanonicalLogo}
              onChange={(event) => set("composeCanonicalLogo", event.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">{t("editor.composeLogo")}</span>
              <span className="text-muted-foreground block">
                {t("editor.composeLogoHint")}
              </span>
            </span>
          </label>

          <label className="border-border flex items-start gap-2 rounded-md border p-3 text-xs">
            <input
              type="checkbox"
              checked={draft.useSkeleton}
              onChange={(event) => set("useSkeleton", event.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">{t("editor.skeleton")}</span>
              <span className="text-muted-foreground block">
                {t("editor.skeletonHint")}
              </span>
            </span>
          </label>

          {draft.useSkeleton ? (
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium">{t("editor.skeletonUrl")}</span>
              <Input
                value={draft.skeletonUrl ?? ""}
                onChange={(event) => set("skeletonUrl", event.target.value)}
                placeholder="https://…"
              />
            </label>
          ) : null}

          <button
            type="button"
            onClick={() => setAdvanced((open) => !open)}
            aria-expanded={advanced}
            className="text-muted-foreground hover:text-foreground self-start text-xs"
          >
            {advanced ? t("editor.hideAdvanced") : t("editor.showAdvanced")}
          </button>

          {advanced ? (
            <div className="border-border grid grid-cols-2 gap-3 rounded-lg border p-3">
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium">{t("templates.brandKit")}</span>
                <select
                  value={draft.brandKitId ?? ""}
                  onChange={(event) => set("brandKitId", event.target.value || null)}
                  className="border-input bg-background rounded-md border px-2 py-1.5 text-xs"
                >
                  <option value="">{t("templates.globalNoKit")}</option>
                  {brandKits.map((kit) => (
                    <option key={kit.id} value={kit.id}>
                      {kit.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium">{t("editor.model")}</span>
                <Input
                  value={draft.model ?? ""}
                  onChange={(event) => set("model", event.target.value)}
                  placeholder={t("editor.freeText")}
                />
              </label>

              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium">{t("editor.imageSize")}</span>
                <select
                  value={draft.imageSize}
                  onChange={(event) => set("imageSize", event.target.value)}
                  className="border-input bg-background rounded-md border px-2 py-1.5 text-xs"
                >
                  <option value="1K">1K</option>
                  <option value="2K">2K</option>
                  <option value="4K">4K</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium">{t("editor.sortOrder")}</span>
                <Input
                  inputMode="numeric"
                  value={String(draft.sortOrder)}
                  onChange={(event) => set("sortOrder", Number(event.target.value) || 0)}
                />
              </label>
            </div>
          ) : null}

          {error ? <p className="text-destructive text-xs">{error}</p> : null}
        </div>

        <aside className="border-border h-fit rounded-lg border p-4 text-xs">
          <h3 className="mb-3 text-sm font-semibold">{t("editor.summary")}</h3>
          <dl className="flex flex-col gap-2">
            <Row label={t("templates.category")} value={draft.category} />
            <Row label={t("editor.aspectRatio")} value={draft.format} />
            <Row label={t("editor.imageSize")} value={draft.imageSize} />
            <Row label={t("editor.referencePolicy")} value={draft.referencePolicy} />
            <Row label={t("editor.model")} value={draft.model || "—"} />
            <Row
              label={t("editor.skeleton")}
              value={draft.useSkeleton ? t("editor.on") : t("editor.off")}
            />
            <Row
              label={t("brandKits.logoLabel")}
              value={draft.composeCanonicalLogo ? t("editor.composed") : t("editor.notComposed")}
            />
          </dl>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
