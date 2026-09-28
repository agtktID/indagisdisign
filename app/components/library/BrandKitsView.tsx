import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { IconPalette, IconPlus, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { Badge, EmptyState, Textarea } from "@/components/studio/primitives";
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
const SETUP_GUIDE = [
  {
    title: "Importer des ressources de référence",
    body: "Marquez 3 à 5 exemples solides comme références, pour que le style s'apprenne d'un travail réel plutôt que de suppositions.",
  },
  {
    title: "Rédiger une description de style précise",
    body: "Nommez des traits concrets — éclairage, composition, texture — plutôt que des adjectifs vagues.",
  },
  {
    title: "Utiliser les instructions personnalisées pour les contraintes strictes",
    body: "Placement du logo, couleurs interdites, mentions légales : ce que l'agent ne doit jamais oublier.",
  },
  {
    title: "Créer un modèle par format récurrent",
    body: "Enregistrez le format, la catégorie et le gabarit d'invite pour retrouver la même forme de sortie à chaque fois.",
  },
];

export function BrandKitsView() {
  const { data } = useActionQuery("list-brand-kits", {});
  const brandKits = (data as { brandKits: BrandKit[] } | undefined)?.brandKits ?? [];
  const create = useActionMutation("upsert-brand-kit");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = brandKits.find((kit) => kit.id === selectedId) ?? brandKits[0] ?? null;

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Kits de marque</h2>
          <p className="text-muted-foreground text-sm">
            Une direction visuelle réutilisable : palette, style, contraintes permanentes.
          </p>
        </div>
        <Button
          size="sm"
          disabled={create.isPending}
          onClick={() =>
            create.mutate(
              { name: "Kit nouvelle marque" },
              { onSuccess: (result) => setSelectedId((result as { brandKit: BrandKit }).brandKit.id) },
            )
          }
        >
          <IconPlus size={14} /> Nouveau kit
        </Button>
      </div>

      {brandKits.length === 0 ? (
        <EmptyState
          title="Aucun kit de marque."
          hint="Sans kit, tout reste global — ce qui va très bien pour commencer. Créez-en un le jour où vous travaillez pour plusieurs marques."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
          <nav className="flex flex-col gap-1" aria-label="Kits de marque">
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
          <span className="font-medium">Nom</span>
          <Input
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium">Description</span>
          <Textarea
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            placeholder="Décrivez l'orientation visuelle ou le contenu de ce kit de marque."
            rows={3}
          />
        </label>

        <div className="mt-3">
          <p className="text-xs font-medium">Utilisation par les agents</p>
          <p className="text-muted-foreground mb-1.5 text-xs">
            L'agent cible ce kit par son identifiant.
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
            <span className="text-sm font-semibold">Guide de configuration</span>
            <span className="text-muted-foreground block text-xs">
              Ce qui rend les générations fidèles à la marque plutôt qu'approximatives.
            </span>
          </span>
          <span className="text-muted-foreground text-xs">{guideOpen ? "▲" : "▼"}</span>
        </button>

        {guideOpen ? (
          <ul className="mt-3 flex flex-col gap-3">
            {SETUP_GUIDE.map((entry) => (
              <li key={entry.title}>
                <p className="text-sm font-medium">{entry.title}</p>
                <p className="text-muted-foreground text-xs">{entry.body}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="border-border flex flex-col gap-3 rounded-lg border p-4">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium">Description du style</span>
          <Textarea
            value={draft.styleDescription}
            onChange={(event) => setDraft({ ...draft, styleDescription: event.target.value })}
            placeholder="Lumière rasante, cadrages serrés, grain argentique léger…"
            rows={4}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium">Instructions personnalisées</span>
          <Textarea
            value={draft.customInstructions}
            onChange={(event) => setDraft({ ...draft, customInstructions: event.target.value })}
            placeholder="Préférences que l'agent doit appliquer chaque fois qu'il utilise ce kit."
            rows={4}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium">Palette</span>
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
          <span className="font-medium">Logo canonique</span>
          <Input
            value={draft.canonicalLogoUrl}
            onChange={(event) => setDraft({ ...draft, canonicalLogoUrl: event.target.value })}
            placeholder="https://… — le lien, jamais le fichier"
          />
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={save.isPending}
          onClick={() => save.mutate({ brandKitId: brandKit.id, ...draft })}
        >
          {save.isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => remove.mutate({ brandKitId: brandKit.id })}
        >
          <IconTrash size={14} /> Supprimer
        </Button>
        <Badge tone="muted">
          Les modèles et ressources rattachés redeviennent globaux, rien n'est perdu.
        </Badge>
      </div>
    </div>
  );
}
