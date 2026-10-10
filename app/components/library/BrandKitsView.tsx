import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import { IconPalette, IconPlus, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { Badge, EmptyState, Textarea } from "@/components/studio/primitives";
import { confirmDelete } from "@/lib/confirm-delete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface BrandKit {
  id: string;
  name: string;
  description: string | null;
  styleDescription: string | null;
  customInstructions: string | null;
  palette: string | null;
  canonicalLogoUrl: string | null;
}

/** Repères repris du guide de configuration : ce qui rend un kit réellement utile. */
const SETUP_GUIDE = ["references", "styleDescription", "constraints", "templates"] as const;

export function BrandKitsView() {
  const t = useT();
  const { data } = useActionQuery("list-brand-kits", {});
  const brandKits = (data as { brandKits: BrandKit[] } | undefined)?.brandKits ?? [];
  const create = useActionMutation("upsert-brand-kit");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = brandKits.find((kit) => kit.id === selectedId) ?? brandKits[0] ?? null;

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("brandKits.title")}</h2>
          <p className="text-muted-foreground text-sm">
            {t("brandKits.description")}
          </p>
        </div>
        <Button
          size="sm"
          disabled={create.isPending}
          onClick={() =>
            create.mutate(
              { name: t("brandKits.newKitName") },
              { onSuccess: (result) => setSelectedId((result as { brandKit: BrandKit }).brandKit.id) },
            )
          }
        >
          <IconPlus size={14} /> {t("brandKits.newKit")}
        </Button>
      </div>

      {brandKits.length === 0 ? (
        <EmptyState
          title={t("brandKits.emptyTitle")}
          hint={t("brandKits.emptyHint")}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
          <nav className="flex flex-col gap-1" aria-label={t("brandKits.title")}>
            {brandKits.map((kit) => (
              <button
                key={kit.id}
                type="button"
                onClick={() => setSelectedId(kit.id)}
                aria-current={selected?.id === kit.id ? "true" : undefined}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
                  selected?.id === kit.id
                    ? "bg-muted font-medium"
                    : "text-muted-foreground hover:bg-muted/60"
                }`}
              >
                <IconPalette size={14} className="shrink-0" />
                <span className="truncate">{kit.name}</span>
              </button>
            ))}
          </nav>

          {selected ? <BrandKitPanel key={selected.id} brandKit={selected} /> : null}
        </div>
      )}
    </div>
  );
}

function BrandKitPanel({ brandKit }: { brandKit: BrandKit }) {
  const t = useT();
  const save = useActionMutation("upsert-brand-kit");
  const remove = useActionMutation("delete-brand-kit");
  const [guideOpen, setGuideOpen] = useState(false);
  const [draft, setDraft] = useState({
    name: brandKit.name,
    description: brandKit.description ?? "",
    styleDescription: brandKit.styleDescription ?? "",
    customInstructions: brandKit.customInstructions ?? "",
    palette: brandKit.palette ?? "",
    canonicalLogoUrl: brandKit.canonicalLogoUrl ?? "",
  });

  useEffect(() => {
    setDraft({
      name: brandKit.name,
      description: brandKit.description ?? "",
      styleDescription: brandKit.styleDescription ?? "",
      customInstructions: brandKit.customInstructions ?? "",
      palette: brandKit.palette ?? "",
      canonicalLogoUrl: brandKit.canonicalLogoUrl ?? "",
    });
  }, [brandKit]);

  const colors = draft.palette
    .split(",")
    .map((color) => color.trim())
    .filter((color) => /^#[0-9a-f]{3,8}$/i.test(color));

  return (
    <div className="flex flex-col gap-4">
      <section className="border-border rounded-lg border p-4">
        <label className="mb-3 flex flex-col gap-1 text-xs">
          <span className="font-medium">{t("brandKits.name")}</span>
          <Input
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium">{t("brandKits.descriptionLabel")}</span>
          <Textarea
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            placeholder={t("brandKits.descriptionPlaceholder")}
            rows={3}
          />
        </label>

        <div className="mt-3">
          <p className="text-xs font-medium">{t("brandKits.agentUsage")}</p>
          <p className="text-muted-foreground mb-1.5 text-xs">
            {t("brandKits.agentUsageHint")}
          </p>
          <code className="bg-muted block rounded px-2 py-1.5 font-mono text-xs break-all">
            {brandKit.id}
          </code>
        </div>
      </section>

      <section className="border-border rounded-lg border p-4">
        <button
          type="button"
          onClick={() => setGuideOpen((open) => !open)}
          aria-expanded={guideOpen}
          className="flex w-full items-center justify-between text-left"
        >
          <span>
            <span className="text-sm font-semibold">{t("brandKits.guideTitle")}</span>
            <span className="text-muted-foreground block text-xs">
              {t("brandKits.guideHint")}
            </span>
          </span>
          <span className="text-muted-foreground text-xs">{guideOpen ? "▲" : "▼"}</span>
        </button>

        {guideOpen ? (
          <ul className="mt-3 flex flex-col gap-3">
            {SETUP_GUIDE.map((entry) => (
              <li key={entry}>
                <p className="text-sm font-medium">{t(`brandKits.guide_${entry}_title`)}</p>
                <p className="text-muted-foreground text-xs">{t(`brandKits.guide_${entry}_body`)}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="border-border flex flex-col gap-3 rounded-lg border p-4">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium">{t("brandKits.styleLabel")}</span>
          <Textarea
            value={draft.styleDescription}
            onChange={(event) => setDraft({ ...draft, styleDescription: event.target.value })}
            placeholder={t("brandKits.stylePlaceholder")}
            rows={4}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium">{t("brandKits.customLabel")}</span>
          <Textarea
            value={draft.customInstructions}
            onChange={(event) => setDraft({ ...draft, customInstructions: event.target.value })}
            placeholder={t("brandKits.customPlaceholder")}
            rows={4}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium">{t("brandKits.paletteLabel")}</span>
          <Input
            value={draft.palette}
            onChange={(event) => setDraft({ ...draft, palette: event.target.value })}
            placeholder="#111827, #f8fafc, #2563eb"
          />
        </label>

        {colors.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {colors.map((color) => (
              <span
                key={color}
                className="border-border size-7 rounded border"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        ) : null}

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium">{t("brandKits.logoLabel")}</span>
          <Input
            value={draft.canonicalLogoUrl}
            onChange={(event) => setDraft({ ...draft, canonicalLogoUrl: event.target.value })}
            placeholder={t("brandKits.logoPlaceholder")}
          />
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={save.isPending}
          onClick={() => save.mutate({ brandKitId: brandKit.id, ...draft })}
        >
          {save.isPending ? t("studio.saving") : t("studio.save")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (!confirmDelete(t, brandKit.name)) return;
            remove.mutate({ brandKitId: brandKit.id });
          }}
        >
          <IconTrash size={14} /> {t("brandKits.delete")}
        </Button>
        <Badge tone="muted">
          {t("brandKits.deleteNote")}
        </Badge>
      </div>
    </div>
  );
}
