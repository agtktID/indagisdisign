#!/usr/bin/env node
/**
 * Régénère les captures d'écran du README.
 *
 *   node tools/captures/shoot.mjs <binaire-chromium> [url] [dossier] [id-video-demo]
 *
 * Exemple, avec le Chromium que Playwright installe :
 *
 *   pnpm dev   # dans un autre terminal, puis laisser Vite finir de pré-bundler
 *   node tools/captures/shoot.mjs \
 *     ~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome \
 *     http://localhost:8080 docs/captures <id-d-une-video-a-la-carte-complete>
 *
 * Aucune dépendance ajoutée au projet : le script parle au navigateur par le protocole
 * DevTools, sur le WebSocket natif de Node.
 *
 * Deux pièges, tous deux rencontrés puis traités ici :
 * - **Le mur de connexion.** Un navigateur neuf n'a pas de session et tombe sur l'écran
 *   d'accueil. Le script clique « Continuer comme développeur local » avant de capturer.
 * - **Le démarrage à froid.** Après un gros changement de dépendances, Vite met une
 *   dizaine de secondes à pré-bundler et renvoie des 504 entre-temps. Lancer le serveur
 *   d'abord, et le laisser se poser.
 *
 * Les captures sont prises en 1440×900 à l'échelle 2, soit 2880×1800.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const [chrome, base = "http://localhost:8080", outDir = "docs/captures", demoVideo] =
  process.argv.slice(2).filter((argument) => !argument.startsWith("--"));

/**
 * Le thème. `--sombre` émule `prefers-color-scheme: dark` au lieu de bricoler le
 * stockage du navigateur : le framework monte `next-themes` avec `defaultTheme: "system"`
 * et `enableSystem: true`, donc la préférence du système **est** le réglage. On
 * photographie ainsi le chemin qu'emprunte un vrai visiteur, pas un état forcé à la main.
 *
 * Les fichiers sombres prennent le suffixe `-sombre`, pour que les deux jeux cohabitent.
 */
const SOMBRE = process.argv.includes("--sombre");
const SUFFIXE = SOMBRE ? "-sombre" : "";

if (!chrome) {
  console.error(
    "Usage : node tools/captures/shoot.mjs <binaire-chromium> [url] [dossier] [id-video] [--sombre]",
  );
  process.exit(1);
}

/**
 * Les écrans qui méritent une image.
 *
 * Le quatrième argument doit pointer sur une vidéo dont la carte est complète, sinon la
 * capture de la carte narrative montre un écran vide. Il est passé en argument plutôt
 * que codé en dur — chaque base locale a ses propres identifiants — et non par
 * variable d'environnement, que le garde-fou `no-env-credentials` interdit à juste
 * titre dans ce dépôt.
 */
const SHOTS = [
  ...(demoVideo
    ? [
        ["carte-narrative", `/video/${demoVideo}`],
        ["marqueurs", `/video/${demoVideo}?tab=markers`],
      ]
    : []),
  ["catalogue-prompts", "/library?section=prompts"],
  ["bibliotheque", "/library?section=library"],
  ["liste-videos", "/videos"],
  // Le chat plein écran. L'identifiant est fixe et arbitraire : la route crée le fil
  // s'il n'existe pas, et une valeur figée rend la capture reproductible à l'identique.
  ["chat", "/chat/8f3a1c92-4d17-4b6e-9a05-71c2e8f4d3b7"],
];

if (!demoVideo) {
  console.warn(
    "  Identifiant de vidéo absent : les écrans de fiche vidéo sont ignorés.\n" +
      "  Exemple : node tools/captures/shoot.mjs <chromium> <url> <dossier> <uuid>",
  );
}

const DEBUG_PORT = 9333;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

mkdirSync(outDir, { recursive: true });

const browser = spawn(
  chrome,
  [
    "--headless=new",
    `--remote-debugging-port=${DEBUG_PORT}`,
    "--no-sandbox",
    "--hide-scrollbars",
    "--window-size=1440,900",
    "about:blank",
  ],
  { stdio: "ignore" },
);

await sleep(3000);

const { webSocketDebuggerUrl } = await fetch(
  `http://127.0.0.1:${DEBUG_PORT}/json/version`,
).then((response) => response.json());

const socket = new WebSocket(webSocketDebuggerUrl);
await new Promise((resolve) => {
  socket.onopen = resolve;
});

let nextId = 0;
const pending = new Map();
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
};

const send = (method, params = {}, sessionId) =>
  new Promise((resolve) => {
    const id = ++nextId;
    pending.set(id, resolve);
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

const {
  result: { targetId },
} = await send("Target.createTarget", { url: "about:blank" });
const {
  result: { sessionId },
} = await send("Target.attachToTarget", { targetId, flatten: true });

await send("Page.enable", {}, sessionId);
await send("Runtime.enable", {}, sessionId);
await send(
  "Emulation.setDeviceMetricsOverride",
  { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false },
  sessionId,
);
if (SOMBRE) {
  await send(
    "Emulation.setEmulatedMedia",
    { features: [{ name: "prefers-color-scheme", value: "dark" }] },
    sessionId,
  );
  console.log("  thème sombre émulé");
}

const evaluate = (expression) =>
  send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);

/* --- Franchir l'écran de connexion ---------------------------------------- */

await send("Page.navigate", { url: `${base}/` }, sessionId);
await sleep(6000);
const login = await evaluate(`
  (() => {
    const button = [...document.querySelectorAll("button, a")]
      .find((element) => /développeur local/i.test(element.textContent || ""));
    if (!button) return "déjà connecté";
    button.click();
    return "connexion développeur cliquée";
  })()
`);
console.log(`  ${login.result?.result?.value ?? "état de connexion inconnu"}`);
await sleep(8000);

/* --- Capturer -------------------------------------------------------------- */

/**
 * Attend que l'écran porte vraiment son contenu, au lieu de parier sur un délai.
 *
 * Les sept secondes d'attente fixe suffisaient d'habitude, et rataient un écran sur six
 * après un redémarrage du serveur : la capture du carnet de marqueurs est partie en
 * **squelette de chargement**, et rien ne l'a signalé — un PNG de 23 Ko au milieu de
 * fichiers de 300 Ko. On sonde donc jusqu'à voir du texte, et on le dit si on n'en voit
 * jamais, plutôt que de publier un écran vide.
 */
async function waitForContent(timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { result } = await evaluate(
      "(document.body.innerText || '').trim().length > 200 && !/Chargement|Loading/.test(document.body.innerText || '')",
    );
    if (result?.result?.value === true) return true;
    await sleep(400);
  }
  return false;
}

for (const [name, path] of SHOTS) {
  await send("Page.navigate", { url: base + path }, sessionId);
  await sleep(1500);
  if (!(await waitForContent())) {
    console.warn(`  attention : ${path} n'a jamais fini de charger — capture suspecte`);
  }
  // Une respiration après le texte : les graphiques Recharts s'animent à l'entrée.
  await sleep(1200);
  const {
    result: { data },
  } = await send("Page.captureScreenshot", { format: "png" }, sessionId);
  writeFileSync(`${outDir}/${name}${SUFFIXE}.png`, Buffer.from(data, "base64"));
  console.log(`  ${outDir}/${name}${SUFFIXE}.png`);
}

socket.close();
browser.kill();
