#!/usr/bin/env node
/**
 * Construit `shared/prompt-catalog/` à partir d'une bibliothèque de prompts au
 * format markdown.
 *
 *   node tools/prompt-catalog/build.mjs <dossier-source>
 *
 * Le dossier source doit contenir `image-generation/*.md` et
 * `video-generation/*.md` au format des dépôts d'origine :
 *
 *   ## Case 11: <titre>
 *   **Styles:** Illustration
 *   **Scenes:** Travel
 *   **Source:** https://...
 *   **Prompt:**
 *   ```
 *   <le corps>
 *   ```
 *
 * Les titres français viennent de `titles-fr.tsv`, apparié par le rang du titre
 * dans l'ordre de dédoublonnage — relancer le script après avoir modifié la
 * source oblige donc à vérifier ce fichier.
 *
 * Provenance et licences : voir le README de ce dossier.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = join(HERE, "..", "..");
const OUT_DIR = join(PROJECT, "shared", "prompt-catalog");
const DATA_DIR = join(OUT_DIR, "data");

const SRC = process.argv[2];
if (!SRC) {
  console.error("Usage : node tools/prompt-catalog/build.mjs <dossier-source>");
  process.exit(1);
}
const IMG = join(SRC, "image-generation");

/** Les rapports d'image que l'on sait reconnaître dans un corps de prompt. */
const RATIOS = [
  "9:21", "9:16", "2:3", "3:4", "4:5", "1:1", "5:4", "4:3", "3:2",
  "16:10", "16:9", "2:1", "21:9",
];


function detectLanguage(text) {
  const cjk = (text.match(/[一-鿿]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  if (cjk === 0) return "en";
  if (cjk > latin / 2) return "zh";
  return "mixed";
}

function detectFormat(body) {
  for (const ratio of RATIOS) {
    // Un rapport écrit tel quel, entouré de non-chiffres, pour éviter 116:90.
    const pattern = new RegExp(`(^|[^\\d.])${ratio.replace(":", "\\s*:\\s*")}([^\\d.]|$)`);
    if (pattern.test(body)) return ratio;
  }
  return null;
}

/** `{argument name="hair color" default="blonde"}` → une variable remplissable. */
function extractVariables(body) {
  const found = new Map();
  const pattern = /\{argument\s+name=\\?"([^"\\]+)\\?"(?:\s+default=\\?"([^"\\]*)\\?")?\}/g;
  let match;
  while ((match = pattern.exec(body)) !== null) {
    const key = match[1].trim();
    if (!found.has(key)) found.set(key, { key, default: (match[2] ?? "").trim() });
  }
  return [...found.values()];
}

function parseCase(block, category) {
  const titleMatch = block.match(/^## Case (\d+):\s*(.*)$/m);
  if (!titleMatch) return null;

  const field = (name) => {
    const m = block.match(new RegExp(`^\\*\\*${name}:\\*\\*\\s*(.*)$`, "m"));
    return m ? m[1].trim() : null;
  };

  const bodyMatch = block.match(/\*\*Prompt:\*\*\n```\n([\s\S]*?)\n```/);
  if (!bodyMatch) return null;

  const body = bodyMatch[1];
  const list = (value) =>
    value ? value.split(",").map((part) => part.trim()).filter(Boolean) : [];

  return {
    key: `img-${titleMatch[1]}`,
    caseNumber: Number(titleMatch[1]),
    kind: "image",
    category,
    title: titleMatch[2].trim(),
    styles: normalizeStyles(list(field("Styles"))),
    scenes: list(field("Scenes")),
    source: field("Source"),
    language: detectLanguage(body),
    format: detectFormat(body),
    variables: extractVariables(body),
    body,
  };
}


const images = [];
for (const file of readdirSync(IMG).filter((name) => name.endsWith(".md")).sort()) {
  const category = file.replace(/\.md$/, "");
  const text = readFileSync(join(IMG, file), "utf8");
  // Découper sur les en-têtes, pas sur « --- » : trois corps de prompt en contiennent un.
  for (const block of text.split(/\n(?=## Case )/)) {
    if (!block.startsWith("## Case ")) continue;
    const parsed = parseCase(block, category);
    if (parsed) images.push(parsed);
  }
}

/* --- Vidéo : un seul fichier, neuf cas d'usage Seedance -------------------- */

const videoText = readFileSync(
  join(SRC, "video-generation", "seedance-commercial-use-cases.md"),
  "utf8",
);

const videos = [];
for (const block of videoText.split(/\n(?=## \d+\. )/)) {
  const titleMatch = block.match(/^## (\d+)\.\s*(.*)$/m);
  if (!titleMatch) continue;
  const bodyMatch = block.match(/\*\*提示词\*\*：\n```\n([\s\S]*?)\n```/);
  const notes = [
    ...block.matchAll(
      /^\*\*(特点|方法|流程|Tips|技巧)\*\*[：:]?\s*\n?([\s\S]*?)(?=\n\*\*|\n## |$)/gm,
    ),
  ]
    .map((m) => `${m[1]} : ${m[2].trim()}`)
    .join("\n\n");

  videos.push({
    key: `vid-seedance-${titleMatch[1]}`,
    caseNumber: Number(titleMatch[1]),
    kind: "video",
    category: "seedance-commercial",
    title: titleMatch[2].trim(),
    styles: [],
    scenes: [],
    source: "https://github.com/ZeroLu/awesome-seedance",
    language: "zh",
    format: bodyMatch ? detectFormat(bodyMatch[1]) : null,
    variables: [],
    body: bodyMatch ? bodyMatch[1] : "",
    notes,
  });
}

const all = [...images, ...videos];

/* --- Titres français, appariés par l'ordre de dédoublonnage --------------- */

const uniqueTitles = [...new Set(all.map((p) => p.title))];
const frByIndex = new Map();
for (const line of readFileSync(join(HERE, "titles-fr.tsv"), "utf8").trimEnd().split("\n")) {
  const [index, french] = line.split("\t");
  frByIndex.set(Number(index), french);
}
if (frByIndex.size !== uniqueTitles.length) {
  throw new Error(
    `${frByIndex.size} traductions dans titles-fr.tsv pour ${uniqueTitles.length} titres uniques`,
  );
}
const frByTitle = new Map(uniqueTitles.map((title, i) => [title, frByIndex.get(i + 1)]));
for (const [title, french] of frByTitle) {
  if (!french) throw new Error(`Titre sans traduction : ${title}`);
}



const count = (predicate) => all.filter(predicate).length;

const CATEGORY_LABELS = {
  "ui-interfaces": "Interfaces",
  "charts-infographics": "Graphiques et infographies",
  "posters-typography": "Affiches et typographie",
  "products-e-commerce": "Produits et commerce",
  "brand-logos": "Marque et logos",
  "architecture-spaces": "Architecture et lieux",
  "photography-realism": "Photographie et réalisme",
  "illustration-art": "Illustration et art",
  "characters-people": "Personnages",
  "scenes-storytelling": "Scènes et narration",
  "history-classical-themes": "Histoire et thèmes classiques",
  "documents-publishing": "Documents et édition",
  "other-use-cases": "Autres usages",
  "seedance-commercial": "Usages commerciaux",
};

/**
 * Les dépôts amont écrivent le même style tantôt au singulier, tantôt au pluriel —
 * `Character` 113 fois et `Characters` 2 fois, `Product` 56 fois et `Products` 5 fois.
 * Recopiées telles quelles, ces variantes produisaient **deux facettes côte à côte pour
 * le même rendu** dans l'écran Prompts : « Personnage 113 » puis « Personnages 2 ». Un
 * lecteur ne peut pas deviner laquelle choisir, et la seconde a l'air d'un défaut.
 *
 * On fusionne donc vers la forme majoritaire. C'est la seule normalisation que le script
 * s'autorise : les **corps** de prompt restent intouchés, conformément à la règle du
 * dossier — c'est le texte éprouvé qui part au modèle.
 */
const STYLE_ALIASES = {
  Characters: "Character",
  Products: "Product",
};

/** Replie les variantes sur leur forme retenue, sans créer de doublon dans la liste. */
function normalizeStyles(styles) {
  return [...new Set(styles.map((style) => STYLE_ALIASES[style] ?? style))];
}

const STYLE_LABELS = {
  "3D": "3D",
  Architecture: "Architecture",
  Brand: "Marque",
  Character: "Personnage",
  Charts: "Graphiques",
  Classical: "Classique",
  Documents: "Documents",
  History: "Histoire",
  Illustration: "Illustration",
  Infographic: "Infographie",
  "Other Use Cases": "Autres usages",
  Photography: "Photographie",
  Poster: "Affiche",
  Product: "Produit",
  Realistic: "Réaliste",
  Scenes: "Scènes",
  UI: "Interface",
};

const SCENE_LABELS = {
  Creative: "Création",
  Tech: "Technologie",
  Commerce: "Commerce",
  Education: "Éducation",
  Social: "Réseaux sociaux",
  Fashion: "Mode",
  Food: "Cuisine",
  Travel: "Voyage",
  Story: "Récit",
  History: "Histoire",
};

const styleOrder = Object.keys(STYLE_LABELS);
const sceneOrder = Object.keys(SCENE_LABELS);

/* --- Vérification : aucune valeur inconnue ne doit passer ------------------ */

for (const prompt of all) {
  if (!CATEGORY_LABELS[prompt.category]) throw new Error(`Catégorie inconnue : ${prompt.category}`);
  for (const style of prompt.styles) {
    if (!STYLE_LABELS[style]) throw new Error(`Style inconnu : ${style}`);
  }
  for (const scene of prompt.scenes) {
    if (!SCENE_LABELS[scene]) throw new Error(`Scène inconnue : ${scene}`);
  }
}

/* --- Écriture -------------------------------------------------------------- */

// N'effacer que ce qui est généré : `fill.ts` est écrit à la main et doit survivre.
rmSync(DATA_DIR, { recursive: true, force: true });
mkdirSync(DATA_DIR, { recursive: true });

const s = (value) => JSON.stringify(value);
const moduleName = (category) => category.replace(/[^a-z0-9]+/g, "-");
const identifier = (category) =>
  category.replace(/(^|-)([a-z])/g, (_, __, letter) => letter.toUpperCase());

const HEADER = `/**
 * Fichier généré — ne pas modifier à la main.
 *
 * Source : les fichiers markdown de la bibliothèque de prompts de l'utilisateur,
 * eux-mêmes tirés de dépôts publics sous licence MIT :
 * - images : https://github.com/freestylefly/awesome-gpt-image-2
 * - vidéo  : https://github.com/ZeroLu/awesome-seedance
 *
 * Les corps de prompt sont recopiés tels quels. Seuls les titres ont été traduits
 * en français, pour que la bibliothèque soit navigable.
 */
`;

const categories = [...new Set(all.map((p) => p.category))].sort(
  (a, b) => Object.keys(CATEGORY_LABELS).indexOf(a) - Object.keys(CATEGORY_LABELS).indexOf(b),
);

for (const category of categories) {
  const prompts = all.filter((p) => p.category === category);
  const lines = prompts.map((p) => {
    const fields = [
      `    key: ${s(p.key)},`,
      `    kind: ${s(p.kind)},`,
      `    category: ${s(p.category)},`,
      `    name: ${s(frByTitle.get(p.title))},`,
      `    originalName: ${s(p.title)},`,
      `    styles: ${s(p.styles)},`,
      `    scenes: ${s(p.scenes)},`,
      `    language: ${s(p.language)},`,
      `    format: ${p.format ? s(p.format) : "null"},`,
      `    source: ${p.source ? s(p.source) : "null"},`,
      `    variables: ${s(p.variables.map((v) => ({ key: v.key, default: v.default })))},`,
      `    body: ${s(p.body)},`,
    ];
    if (p.notes) fields.push(`    notes: ${s(p.notes)},`);
    return `  {\n${fields.join("\n")}\n  },`;
  });

  const constant = `CATALOG_${identifier(category).toUpperCase().replace(/-/g, "_")}`;
  writeFileSync(
    join(DATA_DIR, `${moduleName(category)}.ts`),
    `${HEADER}
import type { CatalogPrompt } from "../types.ts";

/** ${CATEGORY_LABELS[category]} — ${prompts.length} prompts. */
export const ${constant}: readonly CatalogPrompt[] = [
${lines.join("\n")}
];
`,
  );
}

/* --- types.ts : petit, sûr à importer côté navigateur ---------------------- */

const facet = (key, label, n) => `  { key: ${s(key)}, label: ${s(label)}, count: ${n} },`;

writeFileSync(
  join(OUT_DIR, "types.ts"),
  `/**
 * Les trois axes de tri du catalogue de prompts, repris du site qui a inspiré
 * l'écran : catégorie (à quoi ça sert), style (le rendu), scène (le domaine).
 *
 * Ce module est volontairement léger : c'est le seul du catalogue que
 * l'interface importe. Les ${all.length} prompts eux-mêmes ne transitent que par
 * l'action \`list-prompts\`, pour ne pas alourdir le navigateur.
 */

/** Une variable repérée dans le corps du prompt, sous la forme \`{argument name="x"}\`. */
export interface CatalogVariable {
  key: string;
  default: string;
}

export interface CatalogPrompt {
  key: string;
  kind: "image" | "video";
  category: string;
  /** Le titre traduit en français. */
  name: string;
  /** Le titre d'origine, conservé pour retrouver le prompt dans la source. */
  originalName: string;
  styles: readonly string[];
  scenes: readonly string[];
  /** La langue du corps : il n'est pas traduit, les modèles le comprennent tel quel. */
  language: "zh" | "en" | "mixed";
  /** Un rapport d'image mentionné dans le corps, quand il y en a un. */
  format: string | null;
  source: string | null;
  variables: readonly CatalogVariable[];
  body: string;
  /** Notes de méthode, présentes sur les cas vidéo. */
  notes?: string;
}

export interface CatalogFacet {
  key: string;
  label: string;
  count: number;
}

export const CATALOG_CATEGORIES: readonly CatalogFacet[] = [
${categories.map((c) => facet(c, CATEGORY_LABELS[c], count((p) => p.category === c))).join("\n")}
];

export const CATALOG_STYLES: readonly CatalogFacet[] = [
${styleOrder.map((st) => facet(st, STYLE_LABELS[st], count((p) => p.styles.includes(st)))).join("\n")}
];

export const CATALOG_SCENES: readonly CatalogFacet[] = [
${sceneOrder.map((sc) => facet(sc, SCENE_LABELS[sc], count((p) => p.scenes.includes(sc)))).join("\n")}
];

export const CATALOG_LANGUAGES: Record<CatalogPrompt["language"], string> = {
  zh: "chinois",
  en: "anglais",
  mixed: "mixte",
};

/** Combien de prompts le catalogue contient, par axe de production. */
export const CATALOG_COUNTS = {
  total: ${all.length},
  image: ${count((p) => p.kind === "image")},
  video: ${count((p) => p.kind === "video")},
} as const;
`,
);

/* --- index.ts : le catalogue complet, côté serveur seulement --------------- */

writeFileSync(
  join(OUT_DIR, "index.ts"),
  `${HEADER}
import type { CatalogPrompt } from "./types.ts";
${categories
  .map((c) => {
    const constant = `CATALOG_${identifier(c).toUpperCase().replace(/-/g, "_")}`;
    return `import { ${constant} } from "./data/${moduleName(c)}.ts";`;
  })
  .join("\n")}

export * from "./types.ts";

/**
 * Les ${all.length} prompts du catalogue.
 *
 * N'importer ce module que depuis une action : il pèse ${Math.round(
   all.reduce((n, p) => n + p.body.length, 0) / 1024,
 )} Ko de texte, et
 * l'interface n'en a jamais besoin en entier.
 */
export const CATALOG_PROMPTS: readonly CatalogPrompt[] = [
${categories
  .map((c) => `  ...CATALOG_${identifier(c).toUpperCase().replace(/-/g, "_")},`)
  .join("\n")}
];

const byKey = new Map(CATALOG_PROMPTS.map((prompt) => [prompt.key, prompt]));

export function catalogPromptByKey(key: string): CatalogPrompt | undefined {
  return byKey.get(key);
}
`,
);

console.log(`${categories.length} modules de données + types.ts + index.ts`);
console.log(`${all.length} prompts écrits dans shared/prompt-catalog/`);
