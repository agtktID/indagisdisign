#!/usr/bin/env node
/**
 * Pose le jeu de démonstration que les captures du README montrent.
 *
 *   pnpm dev   # dans un autre terminal
 *   node tools/captures/seed-demo.mjs \
 *     ~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome \
 *     http://localhost:8080
 *
 * Le binaire du navigateur est un **argument**, jamais une variable d'environnement :
 * le garde-fou `no-env-credentials` interdit `process.env` dans ce dépôt, et
 * `shoot.mjs` suit déjà cette convention pour la même raison.
 *
 * **Pourquoi ce script existe.** Les captures du README étaient prises contre la base
 * locale de développement, celle où s'accumulent les essais : une vidéo « Essai import »
 * restée d'un test d'import, des fils de discussion sans titre laissés par une séance de
 * débogage, une bibliothèque vide parce que personne n'avait pensé à la remplir. Le
 * dépôt publiait donc des images de débris, et personne d'autre ne pouvait les
 * reproduire. Le contenu de démonstration est maintenant du code : il est relu, versionné
 * et rejouable par quiconque clone le dépôt.
 *
 * **Le garde-fou.** Le script refuse de tourner sur une base qui contient déjà des
 * vidéos. Une base de démonstration se pose sur une base vierge ; écraser le travail de
 * quelqu'un pour fabriquer une capture serait un très mauvais échange. `--force` lève le
 * refus, et c'est un geste délibéré.
 *
 * **Comment il écrit.** Par les actions, en HTTP, exactement comme l'interface —
 * `POST /_agent-native/actions/<nom>`. Aucun accès direct à la base : les règles
 * métier (le premier `stage_event`, le refus d'une fin antérieure au début, la règle de
 * couverture) s'appliquent donc au jeu de démonstration comme à n'importe quelle saisie.
 * Le navigateur sert à franchir le mur de connexion et à porter le cookie de session.
 *
 * Aucune dépendance ajoutée : le protocole DevTools passe par le WebSocket natif de Node.
 */
import { spawn } from "node:child_process";

const [CHROME, BASE = "http://localhost:8080"] = process.argv
  .slice(2)
  .filter((argument) => argument !== "--force");
const FORCE = process.argv.includes("--force");
const DEBUG_PORT = 9352;

if (!CHROME) {
  console.error(
    "Usage : node tools/captures/seed-demo.mjs <binaire-chromium> [url] [--force]\n" +
      "Le binaire est celui que Playwright installe, sous ~/.cache/ms-playwright/.",
  );
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* --- Le récit de démonstration -------------------------------------------- */

/**
 * Un vrai récit, pas un remplissage.
 *
 * Les douze notes racontent la même histoire du début à la fin — un monteur qui filme en
 * 4K par réflexe et découvre que la résolution compensait ses cadrages. C'est le seul
 * moyen qu'une capture de la carte narrative montre à quoi l'outil sert : une carte
 * remplie de « lorem ipsum » prouve que les cases existent, pas qu'elles servent.
 *
 * Les intensités suivent la courbe de la méthode sans la décalquer : pic à l'étape 8,
 * respiration à la 9, relance à la 11. L'écart avec le pointillé de référence est ce que
 * la capture doit rendre lisible.
 */
const BEATS = [
  [1, "Je filme tout en 4K depuis trois ans. Plan large de mon bureau, disques durs empilés.", 20],
  [2, "Un abonné demande pourquoi mes vidéos mettent si longtemps à sortir. Je n'ai pas de réponse.", 30],
  [3, "Je me justifie : la qualité, le recadrage, l'avenir. Gros plan sur moi qui hésite.", 25],
  [4, "Un monteur pro me montre son export : 1080p, et personne n'a jamais remarqué.", 40],
  [5, "Je décide de refaire ma dernière vidéo entièrement en 1080p. Timer qui démarre.", 50],
  [6, "Rendu trois fois plus rapide. Mais le recadrage que je faisais tout le temps devient impossible.", 60],
  [7, "Je comprends que le 4K ne servait qu'à compenser mes cadrages approximatifs.", 70],
  [8, "Côte à côte, plein écran : personne dans mon panel ne distingue les deux versions.", 95],
  [9, "Soulagement, et un peu de honte. Trois ans de disques durs pour rien.", 45],
  [10, "Je rachète des cartes plus petites. Plan sur l'ancien NAS que je débranche.", 55],
  [11, "Première vidéo tournée en 1080p assumé, cadrée au tournage. Montée en deux jours.", 80],
  [12, "Même plan de bureau qu'au début — mais les disques durs ont disparu.", 35],
];

/**
 * Le carnet. Les timecodes sont **relatifs à leur rush**, jamais à un montage : deux
 * passages à 4 s dans deux fichiers différents ne désignent pas le même instant.
 *
 * Les étapes 5, 7, 9 et 11 n'ont volontairement aucun marqueur : la capture montre ainsi
 * qu'une étape peut être écrite sans être tournée, au lieu d'un carnet trop parfait pour
 * être instructif. Deux marqueurs portent une sensation visée et un essai de montage —
 * sinon ces deux colonnes n'affichent que des tirets, et le lecteur du README ne devine
 * pas à quoi elles servent.
 */
const MARKERS = [
  ["Bureau, disques durs empilés", "rush-01.mp4", 4200, 11800, 1, null, null],
  ["Lecture du commentaire à voix haute", "rush-03.mp4", 52000, 61500, 2, "malaise", null],
  ["Export 4K qui tourne, timer visible", "rush-07.mp4", 118000, 126000, 3, null, null],
  ["Le monteur montre son export 1080p", "interview-02.mp4", 340000, 368000, 4, null, null],
  ["Recadrage impossible, essai raté", "ecran-01.mov", 12000, 19000, 6, null, null],
  [
    "Comparatif plein écran, panel à l'aveugle",
    "comparatif.mp4",
    8000,
    34000,
    8,
    "tension puis bascule",
    "garder le tir lisible, sans musique",
  ],
  ["Débranchement du NAS", "rush-12.mp4", 2000, 9000, 10, null, null],
  ["Même plan de bureau, sans les disques", "rush-14.mp4", 1000, 8000, 12, "boucle refermée", null],
];

/** La fiche de préparation : cinq questions, cinq réponses tenant au même récit. */
const PREP = [
  ["probleme-ouvrant", "Je filme en 4K par réflexe, et je ne sais pas dire pourquoi."],
  ["ce-qui-change", "Passer d'une habitude non questionnée à un choix assumé."],
  ["scene-du-changement", "Le comparatif à l'aveugle : personne ne distingue les deux versions."],
  ["prerequis", "Que mon temps de rendu et mon stockage venaient de ce choix-là."],
  ["premier-essai", "Remonter l'acte II en 1080p seul, sans toucher au reste."],
];

/* --- Mécanique ------------------------------------------------------------- */

const browser = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${DEBUG_PORT}`,
    "--no-sandbox",
    "--disable-gpu",
    "--window-size=1280,900",
    "about:blank",
  ],
  { stdio: "ignore" },
);

let socket;
const stop = (code) => {
  try {
    socket?.close();
  } catch {}
  browser.kill();
  process.exit(code);
};

/** Chrome ouvre son port en un temps variable : on l'attend plutôt que de le deviner. */
async function waitForDevTools(attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (response.ok) return response.json();
    } catch {}
    await sleep(500);
  }
  throw new Error(`DevTools injoignable sur ${DEBUG_PORT}`);
}

try {
  const { webSocketDebuggerUrl } = await waitForDevTools();
  socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
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

  /**
   * Trois façons d'échouer, et chacune doit se voir : une erreur de protocole (`error`
   * au lieu de `result`), une exception dans la page (`exceptionDetails`), et un résultat
   * non sérialisable. La première version ne regardait que la deuxième, et rendait
   * `undefined` — un échec muet, qui coûte une boucle de débogage entière à identifier.
   */
  const evaluate = async (expression) => {
    const message = await send(
      "Runtime.evaluate",
      { expression, awaitPromise: true, returnByValue: true },
      sessionId,
    );
    if (message?.error) {
      throw new Error(`protocole DevTools : ${message.error.message ?? JSON.stringify(message.error)}`);
    }
    const details = message?.result?.exceptionDetails;
    if (details) {
      throw new Error(
        details.exception?.description ?? details.text ?? "exception dans la page",
      );
    }
    return message?.result?.result?.value;
  };

  /**
   * Le mur de connexion est servi **à `/`**, pas à `/sign-in` : se fier au chemin fait
   * conclure à tort qu'on est déjà passé. On se fie donc à ce que la page contient, et
   * on sonde — l'hydratation prend plusieurs secondes et une attente fixe rate un essai
   * sur deux.
   */
  await send("Page.navigate", { url: `${BASE}/` }, sessionId);
  await sleep(1500);
  let connected = false;
  for (let i = 0; i < 40; i += 1) {
    const state = await evaluate(`(() => {
      const dev = [...document.querySelectorAll("button, a")]
        .find((node) => /Continuer comme|développeur local/i.test(node.textContent || ""));
      if (dev) { dev.click(); return "dev"; }
      if (document.querySelector('a[href="/videos"], a[href="/library"]')) return "in";
      return "wait";
    })()`);
    if (state === "dev") {
      await sleep(4000);
      connected = true;
      break;
    }
    if (state === "in") {
      connected = true;
      break;
    }
    await sleep(500);
  }
  if (!connected) {
    console.error("  Connexion impossible — le serveur de développement tourne-t-il ?");
    stop(1);
  }

  /**
   * Quitter l'application avant d'écrire.
   *
   * Studio est synchronisé en direct : créer une vidéo fait naviguer l'interface vers sa
   * fiche. Le contexte d'exécution de la page est alors détruit, et l'appel suivant meurt
   * sur « Inspected target navigated or closed » — au milieu d'une écriture, ce qui est
   * la pire place pour s'arrêter.
   *
   * On se place donc sur une réponse JSON d'action : même origine, donc même cookie de
   * session, mais aucune application React montée — rien qui puisse décider de naviguer
   * pendant qu'on écrit.
   */
  await send(
    "Page.navigate",
    { url: `${BASE}/_agent-native/actions/list-videos` },
    sessionId,
  );
  await sleep(1500);

  /**
   * Un appel d'action, par la même route HTTP que l'interface.
   *
   * Les actions de lecture déclarent `http: { method: "GET" }` et **refusent un POST par
   * 405** — le piège qui avait déjà coûté une PR entière au bouton de composition de
   * brief. La méthode est donc explicite à l'appel, jamais devinée.
   */
  const call = async (name, body = {}, method = "POST") => {
    const payload = JSON.stringify(JSON.stringify(body));
    const query =
      method === "GET"
        ? JSON.stringify(
            `?${new URLSearchParams(
              Object.entries(body).filter(([, value]) => value !== null && value !== undefined),
            ).toString()}`,
          )
        : '""';
    const result = await evaluate(`
      fetch("/_agent-native/actions/${name}" + ${query}, {
        method: "${method}",
        ...(${method === "GET"}
          ? {}
          : { headers: { "content-type": "application/json" }, body: ${payload} }),
      })
        .then(async (response) => ({ ok: response.ok, status: response.status, body: await response.text() }))
        .catch((cause) => ({ ok: false, status: 0, body: String(cause) }))
    `);
    if (!result?.ok) {
      throw new Error(`${name} → ${result?.status} ${String(result?.body).slice(0, 300)}`);
    }
    try {
      const parsed = JSON.parse(result.body);
      return parsed?.result ?? parsed?.data ?? parsed;
    } catch {
      return {};
    }
  };

  /* --- Le garde-fou ------------------------------------------------------- */

  const existing = await call("list-videos", {}, "GET");
  const count = existing?.videos?.length ?? 0;
  if (count > 0 && !FORCE) {
    console.error(
      `  Refus : la base contient déjà ${count} vidéo(s).\n` +
        "  Un jeu de démonstration se pose sur une base vierge — écraser un vrai travail\n" +
        "  pour fabriquer une capture serait un mauvais échange.\n" +
        "  Repartir d'une base neuve, ou assumer le geste avec --force.",
    );
    stop(2);
  }

  /* --- Poser le récit ----------------------------------------------------- */

  const created = await call("create-video", {
    title: "Pourquoi j'ai arrêté de filmer en 4K",
    kind: "long",
  });
  const videoId = created?.video?.id ?? created?.id;
  if (!videoId) throw new Error("create-video n'a pas rendu d'identifiant");
  console.log(`  vidéo ${videoId}`);

  for (const [step, note, intensity] of BEATS) {
    await call("set-beat", { videoId, step, note, intensity });
  }
  console.log(`  ${BEATS.length} étapes notées`);

  for (const [label, rushName, startMs, endMs, step, intendedFeeling, editAttempt] of MARKERS) {
    await call("upsert-marker", {
      videoId,
      label,
      rushName,
      startMs,
      endMs,
      step,
      ...(intendedFeeling ? { intendedFeeling } : {}),
      ...(editAttempt ? { editAttempt } : {}),
    });
  }
  console.log(`  ${MARKERS.length} marqueurs`);

  for (const [questionKey, answer] of PREP) {
    await call("answer-prep-question", { videoId, questionKey, answer });
  }
  console.log(`  ${PREP.length} réponses de préparation`);

  // Un essai clos et un essai ouvert : l'onglet montre les deux états, et l'avertissement
  // « plusieurs essais en cours » ne se déclenche pas sur un seul.
  const closed = await call("create-experiment", {
    videoId,
    source: "diagnostic",
    symptomKey: "milieu-repetitif",
    // `observation` est obligatoire même quand un symptôme du référentiel est cité : le
    // symptôme nomme la famille, l'observation dit ce qu'on a vu dans CE montage.
    observation: "Le milieu se répète — trois séquences de rendu qui disent la même chose.",
    hypothesis: "L'acte II enchaîne trois démonstrations de rendu sans changer de point de vue.",
    attempt: "Couper la deuxième démonstration et garder la réaction du monteur à la place.",
  });
  const closedId = closed?.experiment?.id ?? closed?.id;
  if (closedId) {
    await call("resolve-experiment", {
      experimentId: closedId,
      status: "kept",
      verdictNote: "Trente secondes de moins, et le comparatif arrive pendant qu'on y croit encore.",
    });
  }
  await call("create-experiment", {
    videoId,
    source: "roasting",
    observation: "Un spectateur dit décrocher juste avant le comparatif.",
    hypothesis: "L'enjeu n'est pas reposé avant le test : on ne sait plus ce qu'on compare.",
    attempt: "Remettre une phrase de rappel sur le plan du timer, juste avant le côte à côte.",
  });
  console.log("  2 essais");

  const publication = await call("upsert-publication", {
    videoId,
    platform: "YouTube",
    seoTitle: "J'ai arrêté de filmer en 4K (et personne n'a rien vu)",
    seoDescription:
      "Trois ans de 4K, un comparatif à l'aveugle, et ce que ça a changé à mon montage.",
    keywords: "montage, 4K, 1080p, flux de travail",
    status: "planned",
  });
  const publicationId = publication?.publication?.id ?? publication?.id;
  if (publicationId) {
    await call("record-metrics", {
      publicationId,
      measuredOn: new Date().toISOString().slice(0, 10),
      views: 12840,
      likes: 931,
      comments: 147,
      retentionPct: 54,
    });
  }

  await call("move-stage", {
    videoId,
    toStage: "edit",
    note: "Acte II remonté après le premier essai.",
  });
  console.log("  publication, relevé, étape de production");

  /* --- Remplir la bibliothèque -------------------------------------------- */

  // La capture de la bibliothèque montrait « Aucun brouillon pour l'instant » : une
  // preuve que l'écran se charge, aucune preuve qu'il sert à quelque chose.
  const kit = await call("upsert-brand-kit", {
    name: "Chaîne — fond sombre",
    description: "L'identité de la chaîne : fond sombre, un seul accent, typographie large.",
    styleDescription:
      "Fond anthracite, accent turquoise, typographie sans empattement très lisible en vignette.",
    palette: "#111418, #1DBF9F, #F4F4F5",
  });
  const brandKitId = kit?.brandKit?.id ?? kit?.id;

  const template = await call("upsert-asset-template", {
    name: "Vignette — comparatif",
    description: "Deux images côte à côte, un verdict en travers.",
    category: "social",
    format: "16:9",
    promptTemplate:
      "Vignette {{format}} : deux captures côte à côte séparées par un trait net, " +
      "verdict « {{verdict}} » en travers, palette du kit de marque.",
    ...(brandKitId ? { brandKitId } : {}),
  });
  const templateId = template?.template?.id ?? template?.id;

  // Une ressource par état : les trois onglets de la bibliothèque ont chacun quelque
  // chose à montrer.
  //
  // Aucune `url` n'est posée, et c'est délibéré. La carte affiche l'URL comme vignette :
  // une adresse inventée rend une icône d'image cassée, et une adresse réelle ferait
  // dépendre une capture du README d'un serveur tiers. Sans URL, la carte retombe sur le
  // libellé du type — c'est aussi l'état réel d'un brouillon pas encore produit.
  const ASSETS = [
    ["Vignette — comparatif 4K/1080p", "image", "social", "16:9", "generated"],
    ["Plan de bureau, ouverture", "video", "video", "16:9", "reference"],
    ["Titre de section — acte II", "image", "hero", "16:9", "draft"],
  ];
  for (const [name, kind, category, format, status] of ASSETS) {
    await call("upsert-asset", {
      name,
      kind,
      category,
      format,
      status,
      ...(brandKitId ? { brandKitId } : {}),
      ...(status === "generated" && templateId ? { templateId } : {}),
    });
  }

  await call("upsert-prompt", {
    name: "Ouverture — plan de bureau",
    description: "Le plan large du début, à refaire en fin de montage pour la boucle.",
    kind: "image",
    category: "hero",
    body:
      "Plan large d'un bureau de montage, lumière rasante de fin de journée, " +
      "{{objets}} au premier plan, profondeur de champ courte.",
    tags: "ouverture, boucle",
  });
  console.log("  kit de marque, modèle, 3 ressources, 1 prompt");

  /* --- Deux voisines, pour que la liste enseigne quelque chose -------------- */

  // Une seule carte ne montre qu'un cas : le projet terminé. La couverture narrative
  // n'a de sens qu'en comparaison — c'est tout l'intérêt de l'écran. On pose donc un
  // dérivé court en cours et un projet qui vient de naître.
  const derive = await call("create-video", {
    title: "Les trois cadrages que je ratais encore",
    kind: "short",
    parentVideoId: videoId,
    dueAt: new Date(Date.now() + 12 * 86_400_000).toISOString(),
  });
  const deriveId = derive?.video?.id ?? derive?.id;
  // Son propre récit, pas celui du long : un dérivé reprend de la matière, jamais une
  // carte. Quatre étapes sur douze — l'acte I seul, ce que montre la barre de couverture.
  const BEATS_DERIVE = [
    [1, "Trois extraits de mes anciennes vidéos, recadrés en post à chaque fois.", 25],
    [2, "Un commentaire : « pourquoi tu es toujours décentré ? »", 35],
    [3, "Je réponds que je recadre au montage. Dit à voix haute, ça sonne mal.", 30],
    [4, "Le même monteur me montre son cadre : fait au tournage, jamais retouché.", 45],
  ];
  if (deriveId) {
    for (const [step, note, intensity] of BEATS_DERIVE) {
      await call("set-beat", { videoId: deriveId, step, note, intensity });
    }
  }

  await call("create-video", {
    title: "Le banc de montage que je n'utilise plus",
    kind: "long",
  });
  console.log("  2 vidéos voisines : un dérivé court daté, un projet vierge");

  console.log(`\n  Jeu de démonstration posé.\n  Identifiant à passer à shoot.mjs : ${videoId}`);
  stop(0);
} catch (cause) {
  console.error(`  Échec : ${cause?.message ?? cause}`);
  stop(1);
}
