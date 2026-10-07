import { createRequire } from "node:module";

import { agentNative } from "@agent-native/core/vite";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

const reactRouterPlugins = reactRouter as unknown as () => any[];
const agentNativePlugins = agentNative as unknown as (
  options?: Parameters<typeof agentNative>[0],
) => any[];
const appRequire = createRequire(import.meta.url);
const coreRequire = createRequire(
  appRequire.resolve("@agent-native/core/vite"),
);

export default defineConfig({
  optimizeDeps: {
    /**
     * Les deux moitiés d'AgentKit doivent être du MÊME côté du pré-bundling.
     *
     * `AgentKitContext` est créé par un simple `createContext(null)`, sans le garde
     * `globalThis` que le contexte de locale du framework utilise, lui. Il existe donc
     * autant d'instances du contexte que de copies du module.
     *
     * Et il y en avait deux : le fournisseur, atteint par
     * `…/app/chat/agentkit-chat/index`, arrivait **pré-bundlé par esbuild** — on le
     * voyait à son code, `(0, import_jsx_runtime.jsx)(AgentKitRoot, …)` — tandis que les
     * hooks, importés depuis `…/app/agentkit`, étaient servis **bruts** depuis
     * `node_modules`. Le fournisseur remplissait un contexte, les hooks en lisaient un
     * autre, et la page de chat plein écran mourait sur « AgentKit hooks require an
     * AgentKitProvider » — alors que le panneau de la barre latérale, qui ne traverse
     * pas cette frontière, fonctionnait.
     *
     * Les déclarer tous ici les fait passer par la même passe : Vite partage alors un
     * unique module de contexte entre eux.
     */
    include: [
      "@agent-native/toolkit/app/agentkit",
      "@agent-native/toolkit/app/chat",
      "@agent-native/toolkit/app/chat/agentkit-chat/index",
      "@agent-native/toolkit/app/chat/agentkit-chat/composer",
      "@agent-native/toolkit/app/chat/agentkit-chat/connections",
      "@agent-native/toolkit/app/chat/agentkit-chat/questions",
      "@agent-native/toolkit/app/chat/agentkit-chat/rail",
      "@agent-native/toolkit/app/chat/agentkit-chat/suggestions",
      "@agent-native/toolkit/app/chat/chat/run-recovery",
    ],
    entries: [
      "app/entry.client.tsx",
      "app/root.tsx",
      "app/components/layout/{Layout,Sidebar}.tsx",
      "app/components/chat/ChatRouteContent.tsx",
      "app/routes/{home,chat.$threadId}.tsx",
    ],
  },
  resolve: {
    dedupe: [
      "@assistant-ui/react",
      "@assistant-ui/core",
      "@assistant-ui/store",
      "@assistant-ui/tap",
    ],
    alias: [
      {
        find: /^@assistant-ui\/react$/,
        replacement: coreRequire.resolve("@assistant-ui/react"),
      },
      {
        find: /^@assistant-ui\/core$/,
        replacement: coreRequire.resolve("@assistant-ui/core"),
      },
      {
        find: /^@assistant-ui\/store$/,
        replacement: coreRequire.resolve("@assistant-ui/store"),
      },
      {
        find: /^@assistant-ui\/tap$/,
        replacement: coreRequire.resolve("@assistant-ui/tap"),
      },
      {
        find: /^assistant-stream$/,
        replacement: coreRequire.resolve("assistant-stream"),
      },
      {
        find: /^assistant-stream\/utils$/,
        replacement: coreRequire.resolve("assistant-stream/utils"),
      },
    ],
  },
  plugins: [
    ...reactRouterPlugins(),
    ...agentNativePlugins({
      ssrStubs: ["shiki"],
    }),
  ],
});
