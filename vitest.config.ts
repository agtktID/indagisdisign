import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./app"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  test: {
    exclude: [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/.react-router/**",
      // Les worktrees d'agents sont montés DANS le projet. Sans cette exclusion, vitest
      // ramasse leurs fichiers de test en plus des nôtres et le compte devient faux —
      // 165 au lieu de 89, constaté au premier travail en parallèle.
      "**/.claude/worktrees/**",
    ],
  },
});
