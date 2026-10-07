import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { useActionQuery } from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import { IconSparkles } from "@tabler/icons-react";
import { useState } from "react";

import { Badge, Textarea } from "@/components/studio/primitives";
import { Button } from "@/components/ui/button";
import { assetFormatByKey } from "@shared/asset-taxonomy";

interface Template {
  id: string;
  name: string;
  category: string;
  format: string;
  categoryLabel: string;
  formatLabel: string;
  promptTemplate: string | null;
  textPolicy: string | null;
  model: string | null;
  imageSize: string;
  brandKitId: string | null;
}

interface BrandKit {
  id: string;
  name: string;
  styleDescription: string | null;
  customInstructions: string | null;
  palette: string | null;
}

/**
 * L'écran « Créer ».
 *
 * Il n'appelle aucun modèle d'image lui-même : Studio n'en a pas, et prétendre le
 * contraire serait mentir. Ce qu'il fait, et qui est utile : assembler le modèle, le kit
 * de marque et la demande en une consigne complète, puis la passer à l'agent — qui, lui,
 * dispose des outils HyperFrames et Remotion.
 */
export function CreateView() {
  const t = useT();
  const templatesQuery = useActionQuery("list-asset-templates", {});
  const templates =
    (templatesQuery.data as { templates: Template[] } | undefined)?.templates ?? [];

  const kitsQuery = useActionQuery("list-brand-kits", {});
  const brandKits = (kitsQuery.data as { brandKits: BrandKit[] } | undefined)?.brandKits ?? [];

  const [templateId, setTemplateId] = useState("");
  const [prompt, setPrompt] = useState("");

  const template = templates.find((entry) => entry.id === templateId) ?? null;
  const brandKit = template?.brandKitId
    ? (brandKits.find((kit) => kit.id === template.brandKitId) ?? null)
    : null;
  const format = template ? assetFormatByKey(template.format) : null;

  const brief = buildBrief({ template, brandKit, prompt });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-6">
      <header>
        <h2 className="text-lg font-semibold">{t("create.title")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("create.description")}
        </p>
      </header>

      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium">{t("create.template")}</span>
        <select
          value={templateId}
          onChange={(event) => setTemplateId(event.target.value)}
          className="border-input bg-background rounded-md border px-3 py-2 text-sm"
        >
          <option value="">{t("create.noTemplate")}</option>
          {templates.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name} · {entry.categoryLabel} · {entry.formatLabel}
            </option>
          ))}
        </select>
      </label>

      {template ? (
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="accent">{template.categoryLabel}</Badge>
          <Badge>{template.formatLabel}</Badge>
          <Badge tone="muted">{template.imageSize}</Badge>
          {format ? <Badge tone="muted">{format.usage}</Badge> : null}
          {brandKit ? <Badge tone="ok">{brandKit.name}</Badge> : <Badge tone="muted">{t("create.global")}</Badge>}
        </div>
      ) : null}

      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium">{t("create.yourRequest")}</span>
        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={t("create.requestPlaceholder")}
          rows={4}
        />
      </label>

      <section className="border-border rounded-lg border p-4">
        <h3 className="mb-2 text-sm font-semibold">{t("create.assembled")}</h3>
        <pre className="text-muted-foreground max-h-64 overflow-auto text-xs whitespace-pre-wrap">
          {brief || t("create.assembledEmpty")}
        </pre>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={!prompt.trim()}
          onClick={() =>
            sendToAgentChat({
              message: prompt.trim(),
              context: brief,
              submit: true,
              openSidebar: true,
            })
          }
        >
          <IconSparkles size={14} /> {t("create.send")}
        </Button>
        <span className="text-muted-foreground text-xs">
          {t("create.sendHint")}
        </span>
      </div>
    </div>
  );
}

/** Assemble modèle + kit + demande en une consigne unique, lisible par l'agent. */
/**
 * La consigne assemblée s'adresse à **l'agent**, pas à l'écran.
 *
 * Elle reste donc en français en toutes langues, comme le brief narratif de
 * `shared/narrative-brief.ts`, les skills et le prompt système. Traduire celle-ci seule
 * rendrait le contexte de l'agent incohérent d'un écran à l'autre.
 */
function buildBrief({
  template,
  brandKit,
  prompt,
}: {
  template: Template | null;
  brandKit: BrandKit | null;
  prompt: string;
}): string {
  if (!prompt.trim()) return "";
  const lines: string[] = [];

  if (template) {
    lines.push(`Modèle : ${template.name}`);
    lines.push(`Catégorie : ${template.categoryLabel}`);
    lines.push(`Format : ${template.formatLabel}`);
    lines.push(`Taille : ${template.imageSize}`);
    if (template.model) lines.push(`Modèle de génération suggéré : ${template.model}`);
    if (template.promptTemplate) {
      lines.push("", "Gabarit d'invite :");
      lines.push(template.promptTemplate.replace(/\{\{prompt\}\}/g, prompt.trim()));
    }
    if (template.textPolicy) lines.push("", `Politique de texte : ${template.textPolicy}`);
  }

  if (brandKit) {
    lines.push("", `Kit de marque : ${brandKit.name}`);
    if (brandKit.styleDescription) lines.push(`Style : ${brandKit.styleDescription}`);
    if (brandKit.palette) lines.push(`Palette : ${brandKit.palette}`);
    if (brandKit.customInstructions) {
      lines.push(`Contraintes permanentes : ${brandKit.customInstructions}`);
    }
  }

  if (lines.length === 0) return prompt.trim();
  return lines.join("\n");
}
