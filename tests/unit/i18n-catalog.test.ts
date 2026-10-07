/**
 * Le catalogue de libellés, langue par langue.
 *
 * Ce que ces tests attrapent : une clé ajoutée en français et oubliée dans les dix
 * autres langues. Rien ne le signalait avant — ni le typecheck, qui ne voit que des
 * objets littéraux, ni l'écran, puisque i18next remplace une clé manquante par son
 * propre nom humanisé. C'est précisément ainsi que « App fallback name » et
 * « Search placeholder » se sont affichés pendant des semaines.
 */
import { describe, expect, it } from "vitest";

import arSA from "../../app/i18n/ar-SA.js";
import deDE from "../../app/i18n/de-DE.js";
import enUS from "../../app/i18n/en-US.js";
import esES from "../../app/i18n/es-ES.js";
import frFR from "../../app/i18n/fr-FR.js";
import hiIN from "../../app/i18n/hi-IN.js";
import jaJP from "../../app/i18n/ja-JP.js";
import koKR from "../../app/i18n/ko-KR.js";
import ptBR from "../../app/i18n/pt-BR.js";
import zhCN from "../../app/i18n/zh-CN.js";
import zhTW from "../../app/i18n/zh-TW.js";

type Messages = Record<string, unknown>;

/** `storyMap.title`, `markers.emptyState`… — les feuilles, pas les branches. */
function keyPaths(messages: Messages, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? keyPaths(value as Messages, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

function valueAt(messages: Messages, path: string): unknown {
  return path.split(".").reduce<unknown>((cursor, part) => {
    if (!cursor || typeof cursor !== "object") return undefined;
    return (cursor as Messages)[part];
  }, messages);
}

/** `en-US` est la langue source : c'est elle que le framework charge d'emblée. */
const SOURCE = { code: "en-US", messages: enUS as Messages };

const TRANSLATIONS = [
  { code: "fr-FR", messages: frFR as Messages },
  { code: "es-ES", messages: esES as Messages },
  { code: "de-DE", messages: deDE as Messages },
  { code: "pt-BR", messages: ptBR as Messages },
  { code: "zh-CN", messages: zhCN as Messages },
  { code: "zh-TW", messages: zhTW as Messages },
  { code: "ja-JP", messages: jaJP as Messages },
  { code: "ko-KR", messages: koKR as Messages },
  { code: "hi-IN", messages: hiIN as Messages },
  { code: "ar-SA", messages: arSA as Messages },
];

const sourceKeys = keyPaths(SOURCE.messages);

describe("le catalogue de libellés", () => {
  it("porte des clés dans la langue source", () => {
    expect(sourceKeys.length).toBeGreaterThan(100);
  });

  it.each(TRANSLATIONS)("$code a exactement les clés de la source", ({ messages }) => {
    expect([...keyPaths(messages)].sort()).toEqual([...sourceKeys].sort());
  });

  it.each(TRANSLATIONS)("$code n'a aucun libellé vide", ({ messages }) => {
    const vides = sourceKeys.filter((path) => {
      const value = valueAt(messages, path);
      return typeof value !== "string" || value.trim().length === 0;
    });
    expect(vides).toEqual([]);
  });

  it.each(TRANSLATIONS)("$code traduit vraiment, au lieu de recopier la source", ({ messages }) => {
    // Un fichier créé par copie et jamais traduit passerait les deux tests précédents
    // sans broncher. On ne peut pas exiger que chaque libellé diffère — un nom propre
    // ou une abréviation reste identique — mais une langue entière identique à la
    // source, c'est un fichier oublié.
    const identiques = sourceKeys.filter(
      (path) => valueAt(messages, path) === valueAt(SOURCE.messages, path),
    );
    expect(identiques.length).toBeLessThan(sourceKeys.length / 2);
  });

  it.each(TRANSLATIONS)("$code garde les variables de chaque libellé", ({ code, messages }) => {
    // `{{count}}` traduit en `{{nombre}}` ne lèverait aucune erreur : i18next
    // afficherait simplement le texte avec un trou. C'est le défaut le plus discret
    // qu'un fichier de traduction puisse porter.
    const variable = /\{\{(\w+)\}\}/g;
    const ecarts: string[] = [];
    for (const path of sourceKeys) {
      const attendues = [...String(valueAt(SOURCE.messages, path) ?? "").matchAll(variable)]
        .map((m) => m[1])
        .sort();
      const trouvees = [...String(valueAt(messages, path) ?? "").matchAll(variable)]
        .map((m) => m[1])
        .sort();
      if (attendues.join("|") !== trouvees.join("|")) {
        ecarts.push(
          `${code} ${path} : attendu ${attendues.join(", ") || "aucune"}, trouvé ${trouvees.join(", ") || "aucune"}`,
        );
      }
    }
    expect(ecarts).toEqual([]);
  });
});
