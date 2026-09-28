#!/usr/bin/env node
/**
 * Pont Remotion — serveur MCP local.
 *
 * Même raison d'être que le pont HyperFrames : le serveur d'Indagis Studio ne lance
 * jamais de commande, or Remotion *est* une commande. Ce programme tourne à côté, sur la
 * machine de l'utilisateur, et expose quelques capacités à l'agent de l'application sous
 * le préfixe `mcp__remotion__*`.
 *
 * Licence — à lire avant de diffuser
 * ----------------------------------
 * Remotion n'est PAS open source : c'est du code source-available. Il est gratuit pour
 * les particuliers, les organisations à but non lucratif et les entreprises de trois
 * salariés au plus ; au-delà, une licence d'entreprise est requise (remotion.pro).
 *
 * C'est pourquoi Remotion n'est **pas** une dépendance d'Indagis Studio : ce pont
 * l'installe à la demande, dans le projet vidéo de l'utilisateur. Chacun reste
 * responsable de son éligibilité. HyperFrames, lui, est en Apache-2.0 et n'a aucune de
 * ces contraintes.
 *
 * Sécurité
 * --------
 * Mêmes garde-fous que le pont HyperFrames : liste blanche de commandes, jamais de
 * shell, chemins confinés sous `video/`, noms contraints, délais maximaux.
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
const WORKSPACE = path.join(REPO_ROOT, "video");

/** Seules ces sous-commandes Remotion peuvent être lancées. */
const ALLOWED_COMMANDS = new Set([
  "render",
  "compositions",
  "versions",
  "benchmark",
  "studio",
]);

const PROJECT_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
/** Fichiers de composition autorisés à l'écriture, relatifs à la racine du projet. */
const SOURCE_FILE = /^src\/[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*\.(tsx|ts|css)$/;

const DEFAULT_TIMEOUT_MS = 180_000;
const INSTALL_TIMEOUT_MS = 900_000;
const RENDER_TIMEOUT_MS = 900_000;

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

/** Résout un fichier source en garantissant qu'il reste dans le projet. */
function sourceFile(project, relative) {
  if (!SOURCE_FILE.test(relative)) {
    throw new Error(
      `Chemin « ${relative} » refusé. Attendu un fichier sous src/, en .tsx, .ts ou .css.`,
    );
  }
  const dir = projectDir(project);
  const resolved = path.resolve(dir, relative);
  if (!resolved.startsWith(dir + path.sep)) {
    throw new Error("Chemin hors du projet — refusé.");
  }
  return resolved;
}

/** Lance une commande, sans shell, arguments en tableau. */
function run(command, args, cwd, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
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

function runRemotion(command, args, cwd, timeoutMs = DEFAULT_TIMEOUT_MS) {
  if (!ALLOWED_COMMANDS.has(command)) {
    return Promise.reject(
      new Error(
        `Commande « ${command} » non autorisée par le pont. Autorisées : ${[...ALLOWED_COMMANDS].join(", ")}.`,
      ),
    );
  }
  return run("npx", ["--yes", "remotion", command, ...args], cwd, timeoutMs);
}

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

const server = new McpServer({ name: "remotion-bridge", version: "1.0.0" });

server.registerTool(
  "license_notice",
  {
    title: "Rappeler les conditions de licence Remotion",
    description:
      "Renvoie les conditions d'utilisation de Remotion. À montrer à l'utilisateur AVANT de créer son premier projet Remotion : Remotion n'est pas open source.",
    inputSchema: {},
  },
  async () => ({
    content: [
      {
        type: "text",
        text: [
          "Remotion n'est pas open source : c'est du code source-available.",
          "",
          "Gratuit pour : les particuliers, les organisations à but non lucratif, et les",
          "entreprises à but lucratif de trois salariés au plus.",
          "",
          "Licence d'entreprise requise au-delà — voir remotion.pro/license.",
          "",
          "Indagis Studio ne distribue pas Remotion : ce pont l'installe à la demande dans",
          "votre projet vidéo. Vérifiez votre éligibilité avant usage commercial.",
          "",
          "HyperFrames (Apache-2.0) n'a aucune de ces contraintes — c'est l'option libre.",
        ].join("\n"),
      },
    ],
  }),
);

server.registerTool(
  "doctor",
  {
    title: "Vérifier que Remotion peut tourner",
    description:
      "Vérifie la version de Node et celle de Remotion dans un projet existant. À appeler avant d'annoncer qu'un rendu est possible.",
    inputSchema: {
      project: z.string().optional().describe("Projet à inspecter ; absent = Node seul"),
    },
  },
  async ({ project }) => {
    const node = await run("node", ["--version"], REPO_ROOT, 20_000);
    if (!project) {
      return {
        content: [
          { type: "text", text: `Node : ${node.stdout.trim() || "introuvable"}` },
        ],
        isError: !node.ok,
      };
    }
    await mkdir(WORKSPACE, { recursive: true });
    const versions = await runRemotion("versions", [], projectDir(project));
    return asToolResult(`Node ${node.stdout.trim()} — versions Remotion`, versions);
  },
);

server.registerTool(
  "list_projects",
  {
    title: "Lister les projets vidéo",
    description: "Liste les projets présents dans le dossier video/.",
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
    title: "Créer un projet Remotion",
    description:
      "Crée un projet Remotion vierge dans video/<project> et installe ses dépendances. LONG : plusieurs minutes. Montrer license_notice à l'utilisateur avant d'appeler cet outil pour la première fois.",
    inputSchema: {
      project: z.string().describe("Nom du projet, en minuscules et tirets"),
    },
  },
  async ({ project }) => {
    await mkdir(WORKSPACE, { recursive: true });
    const dir = projectDir(project);

    const scaffold = await run(
      "npx",
      ["--yes", "create-video@latest", "--yes", "--blank", "--no-tailwind", project],
      WORKSPACE,
      INSTALL_TIMEOUT_MS,
    );
    if (!scaffold.ok) {
      return asToolResult(`Création du projet Remotion « ${project} »`, scaffold);
    }

    // `create-video` se contente de copier le modèle : il indique lui-même « npm i » en
    // sortie. Sans cette étape, `npx remotion` ne trouve pas d'exécutable et toutes les
    // commandes suivantes échouent.
    const install = await run("npm", ["install"], dir, INSTALL_TIMEOUT_MS);
    if (!install.ok) {
      return asToolResult(
        `Projet « ${project} » créé, mais l'installation des dépendances a échoué`,
        install,
      );
    }

    return asToolResult(`Création du projet Remotion « ${project} » (dépendances installées)`, {
      ok: true,
      code: 0,
      timedOut: false,
      stdout: `${scaffold.stdout.trim()}\n\nDépendances installées dans video/${project}.`,
      stderr: "",
    });
  },
);

server.registerTool(
  "write_composition",
  {
    title: "Écrire un fichier de composition",
    description:
      "Écrit un fichier source du projet, par exemple src/Composition.tsx. Remplace le contenu existant.",
    inputSchema: {
      project: z.string().describe("Nom du projet"),
      file: z
        .string()
        .describe("Chemin relatif sous src/, par exemple src/Composition.tsx"),
      content: z.string().describe("Contenu complet du fichier"),
    },
  },
  async ({ project, file, content }) => {
    const target = sourceFile(project, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
    return {
      content: [
        {
          type: "text",
          text: `Écrit dans video/${project}/${file} (${content.length} caractères). Lancez compositions pour vérifier que Remotion la voit.`,
        },
      ],
    };
  },
);

server.registerTool(
  "read_composition",
  {
    title: "Relire un fichier de composition",
    description:
      "Relit un fichier source du projet. À utiliser pour vérifier une écriture avant de conclure qu'elle a réussi.",
    inputSchema: {
      project: z.string().describe("Nom du projet"),
      file: z.string().describe("Chemin relatif sous src/"),
    },
  },
  async ({ project, file }) => {
    try {
      const content = await readFile(sourceFile(project, file), "utf8");
      return { content: [{ type: "text", text: content.slice(0, 20_000) }] };
    } catch {
      return {
        content: [
          { type: "text", text: `Fichier video/${project}/${file} introuvable.` },
        ],
        isError: true,
      };
    }
  },
);

server.registerTool(
  "compositions",
  {
    title: "Lister les compositions",
    description:
      "Liste les compositions déclarées dans le projet, avec leur identifiant, leur durée et leurs dimensions. C'est l'identifiant qu'il faut passer à render.",
    inputSchema: {
      project: z.string().describe("Nom du projet"),
      entry: z
        .string()
        .regex(/^src\/[A-Za-z0-9_-]+\.tsx?$/)
        .default("src/index.ts")
        .describe("Point d'entrée du projet"),
    },
  },
  async ({ project, entry }) => {
    const result = await runRemotion("compositions", [entry], projectDir(project));
    return asToolResult(`Compositions de « ${project} »`, result);
  },
);

server.registerTool(
  "render",
  {
    title: "Rendre la vidéo",
    description:
      "Rend une composition en fichier vidéo, dans out/. LONG : plusieurs minutes. Utiliser compositions d'abord pour connaître l'identifiant exact.",
    inputSchema: {
      project: z.string().describe("Nom du projet"),
      composition: z
        .string()
        .regex(/^[A-Za-z0-9_-]+$/, "Identifiant de composition attendu")
        .describe("Identifiant de la composition, donné par l'outil compositions"),
      output: z
        .string()
        .regex(
          /^[A-Za-z0-9_-]+\.(mp4|webm|gif)$/,
          "Nom de fichier attendu, par exemple sortie.mp4",
        )
        .default("sortie.mp4")
        .describe("Nom du fichier de sortie, écrit dans out/"),
      entry: z
        .string()
        .regex(/^src\/[A-Za-z0-9_-]+\.tsx?$/)
        .default("src/index.ts")
        .describe("Point d'entrée du projet"),
    },
  },
  async ({ project, composition, output, entry }) => {
    const dir = projectDir(project);
    const result = await runRemotion(
      "render",
      [entry, composition, `out/${output}`],
      dir,
      RENDER_TIMEOUT_MS,
    );
    if (result.ok) {
      result.stdout += `\n\nFichier attendu : video/${project}/out/${output}`;
    }
    return asToolResult(`Rendu de « ${composition} » (${project})`, result);
  },
);

server.registerTool(
  "studio_start",
  {
    title: "Ouvrir Remotion Studio",
    description:
      "Démarre Remotion Studio sur le projet et renvoie son adresse. C'est l'écran où l'utilisateur voit sa composition en direct et la parcourt image par image. Le serveur reste en marche jusqu'à server_stop.",
    inputSchema: {
      project: z.string().describe("Nom du projet"),
    },
  },
  async ({ project }) => {
    const dir = projectDir(project);
    const result = await startServer(
      `studio ${project}`,
      "npx",
      ["--yes", "remotion", "studio"],
      dir,
    );
    return { content: [{ type: "text", text: result.text }], isError: !result.ok };
  },
);

server.registerTool(
  "server_stop",
  {
    title: "Arrêter Remotion Studio",
    description: "Arrête le studio démarré par studio_start.",
    inputSchema: {},
  },
  async () => ({ content: [{ type: "text", text: stopRunningServer() }] }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
