/**
 * Le catalogue de libellés de l'application.
 *
 * **Il passe par `createToolkitI18nCatalog`, et pas par le constructeur du cœur.**
 * Le gabarit livrait `createAgentNativeI18nCatalog` (`@agent-native/core/client/i18n`),
 * qui ne fusionne que les messages du cœur — 1602 clés — avec les nôtres. Or la coquille
 * du toolkit (panneau de réglages, menu de compte, barre de recherche, panneau agent)
 * lit ses libellés dans un catalogue à part, 2337 clés, que le cœur ignore.
 *
 * Conséquence observée à l'écran avant correction : « App fallback name »,
 * « Search placeholder », « Voice description » — i18next, faute de clé, affichait le
 * nom de la clé humanisé. Dans les onze langues.
 *
 * `createToolkitI18nCatalog` prend exactement les mêmes arguments et fusionne les deux
 * sources, les nôtres gagnant sur celles du toolkit à clé égale.
 */
import { createToolkitI18nCatalog } from "@agent-native/toolkit/app/i18n";

import enUS from "./en-US";

export const i18nCatalog = createToolkitI18nCatalog({
  messages: enUS,
  localeLoaders: {
    "zh-CN": () => import("./zh-CN"),
    "zh-TW": () => import("./zh-TW"),
    "es-ES": () => import("./es-ES"),
    "fr-FR": () => import("./fr-FR"),
    "de-DE": () => import("./de-DE"),
    "ja-JP": () => import("./ja-JP"),
    "ko-KR": () => import("./ko-KR"),
    "pt-BR": () => import("./pt-BR"),
    "hi-IN": () => import("./hi-IN"),
    "ar-SA": () => import("./ar-SA"),
  },
});
