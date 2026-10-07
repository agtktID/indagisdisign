#!/usr/bin/env node
/**
 * Enregistre la démonstration animée du README.
 *
 *   node tools/captures/demo.mjs <binaire-chromium> <chemin-ffmpeg> [url] [sortie] [id-video]
 *
 * Exemple, avec les binaires que Playwright installe déjà :
 *
 *   pnpm dev   # dans un autre terminal, et laisser Vite finir de pré-bundler
 *   node tools/captures/demo.mjs \
 *     ~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome \
 *     ~/.cache/ms-playwright/ffmpeg-1011/ffmpeg-linux \
 *     http://localhost:8080 docs/captures/demo.gif <uuid-d-une-video-a-la-carte-complete>
 *
 * Même principe que `shoot.mjs`, et les mêmes deux pièges traités de la même façon : le
 * mur de connexion, et le démarrage à froid de Vite. La différence est qu'ici on **joue
 * un parcours** au lieu de visiter des URL : c'est la seule façon de montrer que les
 * boutons agissent. Une capture fixe ne prouve jamais qu'un bouton fait quelque chose.
 *
 * Le parcours montre ce qu'aucun autre outil ne sait faire : partir de la carte
 * narrative et en tirer un brief de composition pour un acte précis.
 *
 * Aucune dépendance ajoutée au projet — protocole DevTools sur le WebSocket natif de
 * Node, puis ffmpeg pour l'assemblage. Le GIF est volontairement court et en 12 images
 * par seconde : au-delà, le fichier dépasse ce qu'on met raisonnablement dans un README.
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const [
  chrome,
  ffmpeg,
  base = "http://localhost:8080",
  out = "docs/captures/demo.gif",
  demoVideo,
] = process.argv.slice(2);

if (!chrome || !ffmpeg || !demoVideo) {
  console.error(
    "Usage : node tools/captures/demo.mjs <chromium> <ffmpeg> [url] [sortie] <id-video>\n" +
      "L'identifiant de vidéo est obligatoire : sans carte remplie, la démonstration ne\n" +
      "montrerait qu'un écran vide.",
  );
  process.exit(1);
}

const DEBUG_PORT = 9334;
const WIDTH = 1280;
const HEIGHT = 800;
const FPS = 12;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const frameDir = mkdtempSync(join(tmpdir(), "indagis-demo-"));
mkdirSync(dirname(out), { recursive: true });

const browser = spawn(
  chrome,
  [
    "--headless=new",
    `--remote-debugging-port=${DEBUG_PORT}`,
    "--no-sandbox",
    "--hide-scrollbars",
    `--window-size=${WIDTH},${HEIGHT}`,
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

const { result: targets } = await send("Target.getTargets");
const page = targets.targetInfos.find((target) => target.type === "page");
const { result: attached } = await send("Target.attachToTarget", {
  targetId: page.targetId,
  flatten: true,
});
const session = attached.sessionId;

await send("Page.enable", {}, session);
await send("Runtime.enable", {}, session);
await send(
  "Emulation.setDeviceMetricsOverride",
  { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false },
  session,
);

const evaluate = async (expression) => {
  const { result } = await send(
    "Runtime.evaluate",
    { expression, awaitPromise: true, returnByValue: true },
    session,
  );
  return result?.result?.value;
};

const goto = async (path) => {
  await send("Page.navigate", { url: `${base}${path}` }, session);
  await sleep(4500);
};

let frameNumber = 0;
/** Une pause à l'écran vaut plusieurs images identiques : c'est ce qui rend lisible. */
async function hold(seconds) {
  const frames = Math.max(1, Math.round(seconds * FPS));
  for (let index = 0; index < frames; index += 1) {
    const { result } = await send("Page.captureScreenshot", { format: "png" }, session);
    writeFileSync(
      join(frameDir, `${String(frameNumber).padStart(4, "0")}.png`),
      Buffer.from(result.data, "base64"),
    );
    frameNumber += 1;
    await sleep(1000 / FPS);
  }
}

/** Clique le premier bouton dont le texte correspond, et dit s'il a été trouvé. */
const clickByText = (pattern) =>
  evaluate(`(() => {
    const target = [...document.querySelectorAll('button, a')]
      .find((node) => ${pattern}.test(node.textContent || ''));
    if (!target) return false;
    target.click();
    return true;
  })()`);

console.log(`  images dans ${frameDir}`);

// Le mur de connexion : un navigateur neuf n'a pas de session.
await goto("/");
if (await clickByText(/Continuer comme|Continue as/)) {
  console.log("  connexion développeur cliquée");
  await sleep(4000);
}

const steps = [
  {
    label: "la liste des vidéos",
    run: async () => {
      await goto("/videos");
      await hold(2.2);
    },
  },
  {
    label: "la carte narrative",
    run: async () => {
      await goto(`/video/${demoVideo}`);
      await hold(3);
    },
  },
  {
    label: "une étape dépliée",
    run: async () => {
      if (!(await clickByText(/Le climax/))) {
        throw new Error("l'étape « Le climax » est introuvable");
      }
      await sleep(900);
      await hold(2.8);
    },
  },
  {
    label: "le brief de l'acte III",
    run: async () => {
      if (!(await clickByText(/III · Le retour|III · The return/))) {
        throw new Error("le bouton de brief « III » est introuvable");
      }
      await sleep(2600);
      await hold(3.4);
    },
  },
];

for (const step of steps) {
  await step.run();
  console.log(`  ${step.label}`);
}

socket.close();
browser.kill();
await sleep(500);

// `palettegen`/`paletteuse` : sans palette dédiée, les aplats de couleur des trois actes
// se délavent en bandes. Le filtre coûte une passe de plus et change tout.
const assemble = spawn(
  ffmpeg,
  [
    "-y",
    "-framerate",
    String(FPS),
    "-i",
    join(frameDir, "%04d.png"),
    "-filter_complex",
    `[0:v] fps=${FPS},scale=960:-1:flags=lanczos,split [a][b];` +
      `[a] palettegen=max_colors=192 [p];[b][p] paletteuse=dither=bayer:bayer_scale=3`,
    "-loop",
    "0",
    out,
  ],
  { stdio: "inherit" },
);

await new Promise((resolve, reject) => {
  assemble.on("exit", (code) =>
    code === 0 ? resolve() : reject(new Error(`ffmpeg a rendu ${code}`)),
  );
});

rmSync(frameDir, { recursive: true, force: true });
console.log(`\n  ${out} — ${frameNumber} images`);
