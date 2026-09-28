import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { useActionQuery } from "@agent-native/core/client/hooks";
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
        <h2 className="text-lg font-semibold">Créer</h2>
        <p className="text-muted-foreground text-sm">
          Choisissez un modèle, décrivez ce que vous voulez. Studio assemble la consigne
          complète et la passe à l&apos;agent, qui dispose des outils de rendu.
        </p>
      </header>

      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium">Modèle</span>
        <select
          value={templateId}
          onChange={(event) => setTemplateId(event.target.value)}
          className="border-input bg-background rounded-md border px-3 py-2 text-sm"
        >
          <option value="">— aucun modèle, consigne libre</option>
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
          {brandKit ? <Badge tone="ok">{brandKit.name}</Badge> : <Badge tone="muted">Global</Badge>}
        </div>
      ) : null}

      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium">Votre demande</span>
        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Un teaser de 30 secondes sur l'acte III, ambiance nocturne…"
          rows={4}
        />
      </label>

      <section className="border-border rounded-lg border p-4">
        <h3 className="mb-2 text-sm font-semibold">Consigne assemblée</h3>
        <pre className="text-muted-foreground max-h-64 overflow-auto text-xs whitespace-pre-wrap">
          {brief || "Décrivez votre demande pour voir la consigne."}
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
          <IconSparkles size={14} /> Envoyer à l&apos;agent
        </Button>
        <span className="text-muted-foreground text-xs">
          L&apos;agent rendra la vidéo si les ponts HyperFrames ou Remotion tournent ; sinon
          il vous le dira.
        </span>
      </div>
    </div>
  );
}

/** Assemble modèle + kit + demande en une consigne unique, lisible par l'agent. */
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
