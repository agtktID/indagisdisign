import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import { IconDownload } from "@tabler/icons-react";
import { useState } from "react";

import { Badge } from "@/components/studio/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { assetCategoryByKey, assetFormatByKey } from "@shared/asset-taxonomy";
import { STARTER_TEMPLATES } from "@shared/starter-templates";

interface BrandKit {
  id: string;
  name: string;
}

/**
 * Les ressources de départ, livrées avec l'application.
 *
 * Elles vivent dans le code, en lecture seule : dès l'installation, la bibliothèque n'est
 * pas vide. « Installer » en copie une dans les modèles de l'utilisateur, où elle devient
 * modifiable sans que l'original bouge.
 */
export function StarterView({ onInstalled }: { onInstalled: () => void }) {
  const t = useT();
  const kitsQuery = useActionQuery("list-brand-kits", {});
  const brandKits = (kitsQuery.data as { brandKits: BrandKit[] } | undefined)?.brandKits ?? [];

  const templatesQuery = useActionQuery("list-asset-templates", {});
  const installedNames = new Set(
    ((templatesQuery.data as { templates: { name: string }[] } | undefined)?.templates ?? []).map(
      (template) => template.name,
    ),
  );

  const install = useActionMutation("install-starter-template");
  const [targetKit, setTargetKit] = useState("");
  const [search, setSearch] = useState("");

  const needle = search.trim().toLowerCase();
  const shown = STARTER_TEMPLATES.filter(
    (starter) =>
      !needle ||
      `${starter.name} ${starter.description} ${starter.useCase}`.toLowerCase().includes(needle),
  );

  return (
    <div className="flex flex-col gap-5 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("starter.title")}</h2>
          <p className="text-muted-foreground text-sm">
            {t("starter.description")}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <span>{t("starter.installInto")}</span>
            <select
              value={targetKit}
              onChange={(event) => setTargetKit(event.target.value)}
              className="border-input bg-background text-foreground rounded-md border px-2 py-1 text-xs"
            >
              <option value="">{t("create.global")}</option>
              {brandKits.map((kit) => (
                <option key={kit.id} value={kit.id}>
                  {kit.name}
                </option>
              ))}
            </select>
          </label>

          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("starter.search")}
            className="w-48"
          />
        </div>
      </header>

      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((starter) => {
          const already = installedNames.has(starter.name);
          const category = assetCategoryByKey(starter.category);
          const format = assetFormatByKey(starter.format);

          return (
            <li key={starter.key}>
              <article className="border-border bg-card flex h-full flex-col gap-2 rounded-lg border p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold">{starter.name}</h3>
                  <Badge>{format?.label ?? starter.format}</Badge>
                </div>

                <div className="flex flex-wrap gap-1">
                  <Badge tone="accent">{category?.label ?? starter.category}</Badge>
                  <Badge tone="muted">{starter.imageSize}</Badge>
                  {already ? <Badge tone="ok">{t("starter.installed")}</Badge> : null}
                </div>

                <p className="text-muted-foreground text-xs">{starter.description}</p>

                <p className="text-xs italic">{starter.useCase}</p>

                <details className="text-muted-foreground text-[11px]">
                  <summary className="cursor-pointer select-none">Voir le gabarit</summary>
                  <pre className="bg-muted/50 mt-1 max-h-32 overflow-auto rounded p-2 whitespace-pre-wrap">
                    {starter.promptTemplate}
                  </pre>
                </details>

                <Button
                  size="sm"
                  variant={already ? "ghost" : "outline"}
                  className="mt-auto self-start"
                  disabled={install.isPending}
                  onClick={() =>
                    install.mutate(
                      {
                        starterKey: starter.key,
                        brandKitId: targetKit || null,
                      },
                      { onSuccess: onInstalled },
                    )
                  }
                >
                  <IconDownload size={13} />
                  {already ? t("starter.installAgain") : t("starter.install")}
                </Button>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
