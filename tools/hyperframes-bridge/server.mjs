#!/usr/bin/env node
/**
 * Pont HyperFrames — serveur MCP local.
 *
 * Pourquoi ce programme existe
 * ----------------------------
 * Le serveur d'Indagis Studio ne peut pas lancer de commandes : la constitution du projet
 * interdit `child_process` côté serveur, pour que l'application reste déployable sur
 * n'importe quel hôte. Or HyperFrames *est* une commande.
 *
 * Ce pont tourne donc à côté, comme processus séparé sur la machine de l'utilisateur. Il
 * expose quelques capacités précises à l'agent de l'application, qui les voit apparaître
 * dans son registre d'outils sous le préfixe `mcp__hyperframes__*`.
 *
 * Aucun compte, aucun jeton : HyperFrames rend en local avec Chrome et ffmpeg.
 *
 * Sécurité
 * --------
 * Ce programme exécute des commandes. Comme Indagis Studio est publié en open source et
 * que d'autres personnes le lanceront chez elles, il est volontairement étroit :
 *
 * - liste blanche de sous-commandes — rien d'autre ne peut être lancé ;
 * - jamais de shell : `spawn` reçoit un tableau d'arguments, donc pas d'injection ;
 * - tous les chemins sont confinés sous `video/` à la racine du dépôt, vérifié après
 *   résolution (un `../` ne sort pas) ;
 * - noms de projet contraints à un motif strict ;
 * - délai maximal sur chaque commande, pour qu'un rendu qui part en vrille ne bloque pas
 *   l'agent indéfiniment.
 */

import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");

/** Toutes les compositions vivent ici. Rien n'est lu ni écrit en dehors. */
const WORKSPACE = path.join(REPO_ROOT, "video");

/** Seules ces sous-commandes HyperFrames peuvent être lancées. */
const ALLOWED_COMMANDS = new Set([
  "doctor",
  "init",
  "render",
  "lint",
  "check",
  "compositions",
  "timeline",
  "info",
  "preview",
]);

const PROJECT_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;

const DEFAULT_TIMEOUT_MS = 120_000;
const RENDER_TIMEOUT_MS = 900_000;

/** Résout un chemin de projet en garantissant qu'il reste sous `video/`. */
function projectDir(project) {
  if (!PROJECT_NAME.test(project)) {
    throw new Error(
      `Nom de projet invalide : « ${project} ». Attendu : minuscules, chiffres et tirets, 64 caractères au plus.`,
    );
  }
  const resolved = path.resolve(WORKSPACE, project);
  if (resolved !== WORKSPACE && !resolved.startsWith(WORKSPACE + path.sep)) {
    throw new Error("Chemin hors de l'espace de travail vidéo — refusé.");
  }
  return resolved;
}

/**
 * La version de HyperFrames que ce pont exécute.
 *
 * Épinglée, et non `@latest` : le pont se targue d'une liste blanche de sous-commandes
 * et de l'absence de shell — laisser npm télécharger et exécuter n'importe quelle
 * version future viderait cette rigueur de son sens. Relever ce numéro est un geste
 * délibéré, visible dans l'historique.
 *
 * Surchargeable par `--hyperframes-version=x.y.z` au lancement du pont, pour tester
 * une version sans modifier le dépôt.
 */
const HYPERFRAMES_VERSION =
  process.argv.find((arg) => arg.startsWith("--hyperframes-version="))?.split("=")[1] ??
  "0.8.134";

const HYPERFRAMES_PACKAGE = `hyperframes@${HYPERFRAMES_VERSION}`;

/**
 * Lance `npx hyperframes <commande> [...args]`.
 * Jamais de shell : les arguments passent en tableau.
 */
function runHyperframes(command, args, cwd, timeoutMs = DEFAULT_TIMEOUT_MS) {
  if (!ALLOWED_COMMANDS.has(command)) {
    return Promise.reject(
      new Error(
        `Commande « ${command} » non autorisée par le pont. Autorisées : ${[...ALLOWED_COMMANDS].join(", ")}.`,
      ),
    );
  }

  return new Promise((resolve) => {
    const child = spawn("npx", ["--yes", HYPERFRAMES_PACKAGE, command, ...args], {
      cwd,
      shell: false,
      env: { ...process.env, CI: "1" },
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, code: null, timedOut, stdout, stderr: String(error) });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        ok: code === 0 && !timedOut,
        code,
        timedOut,
        stdout: stdout.slice(-8000),
        stderr: stderr.slice(-4000),
      });
    });
  });
}

/** Met en forme un résultat de commande pour l'agent, sans jamais le maquiller. */
function asToolResult(label, result) {
  const lines = [];
  if (result.timedOut) {
    lines.push(`${label} : délai dépassé, commande interrompue.`);
  } else if (result.ok) {
    lines.push(`${label} : succès.`);
  } else {
    lines.push(`${label} : échec (code ${result.code}).`);
  }
  if (result.stdout.trim()) lines.push("", "--- sortie ---", result.stdout.trim());
  if (result.stderr.trim()) lines.push("", "--- erreurs ---", result.stderr.trim());
  return {
    content: [{ type: "text", text: lines.join("\n") }],
    isError: !result.ok,
  };
}


/**
 * Serveurs longue durée (studio, aperçu).
 *
 * Différents des commandes ponctuelles : ils ne se terminent pas. On les lance détachés,
 * on attend qu'ils annoncent leur URL sur leur sortie, et on garde la main pour les
 * arrêter. Un seul serveur à la fois par pont : en relancer un arrête le précédent.
 */
let runningServer = null;

function stopRunningServer() {
  if (!runningServer) return "Aucun serveur en cours.";
  const { child, label } = runningServer;
  runningServer = null;
  try {
    child.kill("SIGTERM");
  } catch {
    /* déjà terminé */
  }
  return `Serveur « ${label} » arrêté.`;
}

/** Lance un serveur et attend qu'il annonce une URL. */
function startServer(label, command, args, cwd, waitMs = 120_000) {
  stopRunningServer();

  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, shell: false, detached: false });
    runningServer = { child, label };

    let output = "";
    let settled = false;

    const finish = (payload) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(payload);
    };

    const timer = setTimeout(
      () =>
        finish({
          ok: false,
          text: `Le serveur « ${label} » n'a pas annoncé d'URL en ${Math.round(waitMs / 1000)} s.\n\n${output.slice(-2000)}`,
        }),
      waitMs,
    );

    const scan = (chunk) => {
      output += chunk.toString();
      const match = output.match(/https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?[^\s"']*/);
      if (match) {
        finish({
          ok: true,
          text: `Serveur « ${label} » démarré : ${match[0]}\n\nIl tourne en arrière-plan. Donnez cette adresse à l'utilisateur, et utilisez server_stop quand il a fini.`,
        });
      }
    };

    child.stdout.on("data", scan);
    child.stderr.on("data", scan);
    child.on("error", (error) =>
      finish({ ok: false, text: `Échec du démarrage de « ${label} » : ${error}` }),
    );
    child.on("close", (code) => {
      if (runningServer?.child === child) runningServer = null;
      finish({
        ok: false,
        text: `Le serveur « ${label} » s'est arrêté (code ${code}).\n\n${output.slice(-2000)}`,
      });
    });
  });
}

const server = new McpServer({ name: "hyperframes-bridge", version: "1.0.0" });

server.registerTool(
  "doctor",
  {
    title: "Vérifier l'installation HyperFrames",
    description:
      "Vérifie que HyperFrames peut rendre sur cette machine : Node, Chrome, ffmpeg. À appeler en premier, avant d'annoncer à l'utilisateur qu'un rendu est possible.",
    inputSchema: {},
  },
  async () => {
    await mkdir(WORKSPACE, { recursive: true });
    const result = await runHyperframes("doctor", [], WORKSPACE);
    return asToolResult("Diagnostic système", result);
  },
);

server.registerTool(
  "list_projects",
  {
    title: "Lister les projets vidéo",
    description: "Liste les projets de composition présents dans le dossier video/.",
    inputSchema: {},
  },
  async () => {
    await mkdir(WORKSPACE, { recursive: true });
    const entries = await readdir(WORKSPACE, { withFileTypes: true });
    const projects = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    return {
      content: [
        {
          type: "text",
          text: projects.length
            ? `Projets : ${projects.join(", ")}`
            : "Aucun projet. Utilisez l'outil init pour en créer un.",
        },
      ],
    };
  },
);

server.registerTool(
  "init",
  {
    title: "Créer un projet de composition",
    description:
      "Crée un projet HyperFrames vierge dans video/<project>. Le nom doit être en minuscules, chiffres et tirets.",
    inputSchema: {
      project: z.string().describe("Nom du projet, en minuscules et tirets"),
    },
  },
  async ({ project }) => {
    await mkdir(WORKSPACE, { recursive: true });
    projectDir(project);
    const result = await runHyperframes("init", [project], WORKSPACE);
    return asToolResult(`Création du projet « ${project} »`, result);
  },
);

server.registerTool(
  "write_composition",
  {
    title: "Écrire la composition",
    description:
      "Écrit le fichier index.html d'un projet, c'est-à-dire la composition elle-même. Remplace le contenu existant.",
    inputSchema: {
      project: z.string().describe("Nom du projet"),
      html: z.string().describe("Contenu complet du fichier index.html"),
    },
  },
  async ({ project, html }) => {
    const dir = projectDir(project);
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, "index.html");
    await writeFile(file, html, "utf8");
    return {
      content: [
        {
          type: "text",
          text: `Composition écrite dans video/${project}/index.html (${html.length} caractères). Lancez lint pour la valider avant de rendre.`,
        },
      ],
    };
  },
);

server.registerTool(
  "read_composition",
  {
    title: "Relire la composition",
    description:
      "Relit le index.html d'un projet. À utiliser pour vérifier une écriture avant de conclure qu'elle a réussi.",
    inputSchema: {
      project: z.string().describe("Nom du projet"),
    },
  },
  async ({ project }) => {
    const file = path.join(projectDir(project), "index.html");
    try {
      const html = await readFile(file, "utf8");
      return { content: [{ type: "text", text: html.slice(0, 20_000) }] };
    } catch {
      return {
        content: [
          { type: "text", text: `Aucune composition dans video/${project}/index.html.` },
        ],
        isError: true,
      };
    }
  },
);

server.registerTool(
  "lint",
  {
    title: "Valider la composition",
    description:
      "Contrôle la composition avant rendu : erreurs courantes, ressources manquantes. Rapide, à lancer après chaque écriture.",
    inputSchema: {
      project: z.string().describe("Nom du projet"),
    },
  },
  async ({ project }) => {
    const result = await runHyperframes("lint", [], projectDir(project));
    return asToolResult(`Validation de « ${project} »`, result);
  },
);

server.registerTool(
  "render",
  {
    title: "Rendre la vidéo",
    description:
      "Rend la composition en fichier vidéo. Long : plusieurs minutes selon la durée. Utiliser quality draft pendant les essais, delivery pour la version finale.",
    inputSchema: {
      project: z.string().describe("Nom du projet"),
      output: z
        .string()
        .regex(
          /^[A-Za-z0-9_-]+\.(mp4|webm)$/,
          "Nom de fichier attendu, par exemple sortie.mp4",
        )
        .default("sortie.mp4")
        .describe("Nom du fichier de sortie, dans le dossier du projet"),
      quality: z
        .enum(["draft", "looks", "delivery"])
        .default("looks")
        .describe("draft pour itérer, looks par défaut, delivery pour la version finale"),
    },
  },
  async ({ project, output, quality }) => {
    const dir = projectDir(project);
    const result = await runHyperframes(
      "render",
      ["-o", output, "--quality", quality],
      dir,
      RENDER_TIMEOUT_MS,
    );
    if (result.ok) {
      result.stdout += `\n\nFichier attendu : video/${project}/${output}`;
    }
    return asToolResult(`Rendu de « ${project} » (${quality})`, result);
  },
);

server.registerTool(
  "preview_start",
  {
    title: "Ouvrir le studio d'aperçu",
    description:
      "Démarre le studio HyperFrames sur la composition et renvoie son adresse. C'est l'écran où l'utilisateur voit sa vidéo avant rendu, et peut la parcourir image par image. Le serveur reste en marche jusqu'à server_stop.",
    inputSchema: {
      project: z.string().describe("Nom du projet"),
    },
  },
  async ({ project }) => {
    const dir = projectDir(project);
    const result = await startServer(
      `aperçu ${project}`,
      "npx",
      ["--yes", HYPERFRAMES_PACKAGE, "preview"],
      dir,
    );
    return { content: [{ type: "text", text: result.text }], isError: !result.ok };
  },
);

server.registerTool(
  "server_stop",
  {
    title: "Arrêter le serveur d'aperçu",
    description: "Arrête le studio d'aperçu démarré par preview_start.",
    inputSchema: {},
  },
  async () => ({ content: [{ type: "text", text: stopRunningServer() }] }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
