# État du projet — 7 octobre 2026

Ce document dit **où en est Indagis Studio**, avec un critère vérifiable par ligne.
Il n'a de valeur que tenu à jour : une case cochée doit pouvoir être reprouvée par la
commande qui figure en face.

Pour l'historique de ce qui a changé, voir [`CHANGELOG.md`](../CHANGELOG.md).

## Le problème utilisateur

Un monteur a ses rushes, et il a une intuition. Entre les deux, il lui manque la
réponse à une seule question : **qu'est-ce qui manque à mon histoire ?**

Les logiciels de montage savent couper. Les gestionnaires de tâches savent suivre une
production. Aucun des deux ne dit que l'acte II est sous-couvert, que le climax n'a pas
d'enjeu lisible en amont, ou que la fin ne se raccroche à aucun début.

C'est le trou qu'Indagis Studio remplit, et rien d'autre. Il **ne monte pas**, il **ne
rend aucune vidéo depuis son serveur**, il **ne publie sur rien**. Il structure le récit.

### À qui il s'adresse

Un créateur qui monte ses propres vidéos, travaille seul, et installe l'application
**sur sa machine**. Pas de déploiement en ligne, pas de compte, pas d'abonnement. La
base est un PGlite local.

### Le parcours principal

1. Créer une vidéo
2. Remplir les 12 étapes de la carte narrative — une note par étape, une intensité
3. Rattacher les passages des rushes aux étapes, avec leurs timecodes
4. Demander un diagnostic
5. En tirer des essais, un seul changement à la fois

Tout ce qui ne sert pas ce parcours est secondaire.

## Ce qui est vrai aujourd'hui

| | Comment le reprouver |
| --- | --- |
| 43 actions métier, plus les 2 standard | `ls actions/*.ts \| wc -l` → 45 |
| **Aucune action métier sans bouton** | critère du vérificateur, 4 exceptions nommées |
| 13 tables, toutes à portée par propriétaire | `grep -c "ownableColumns()" server/db/schema.ts` → 13 |
| 4 écrans Studio, sur 17 routes — les 13 autres viennent du gabarit | `ls app/routes/*.tsx` |
| 12 règles de diagnostic | `grep -oE 'rule: "[a-z-]+"' shared/diagnosis.ts \| sort -u \| wc -l` → 12 |
| 550 prompts livrés, hors du bundle client | garde CI « Le catalogue ne part pas au navigateur » |
| **157 tests** | `pnpm test` |
| **10 écrans Studio sur 10 passent par `useT()`** | ligne INFO du vérificateur |
| **Les 21 écrans suivent la langue** — 10 Studio, 4 routes, 7 vues de bibliothèque | `pnpm action set-localization-preference --locale ja-JP` |
| **11 langues aux clés strictement identiques** | `tests/unit/i18n-catalog.test.ts`, 41 cas |
| **Les captures du README sont reproductibles** — leur contenu est du code, pas une base locale | `node tools/captures/seed-demo.mjs <chromium> <url>` |
| Export CSV, EDL d'assemblage et chapitres YouTube, **les trois depuis l'écran** | onglet Marqueurs, trois boutons |
| **Import CSV, EDL et lignes collées**, avec lecture à blanc | onglet Marqueurs, bouton « Importer » |
| **Le diagnostic se lance depuis la carte**, remarques cliquables | en-tête de l'onglet Carte |
| Typecheck, build et doctor verts | `pnpm typecheck && pnpm build && pnpm agent-native:doctor` |
| **24 critères du vérificateur au vert** | `bash scripts/verifier.sh` |
| **Le premier démarrage fonctionne** — clone neuf, base vierge | joué le 7 octobre : install 6,5 s, 1034 migrations, réponse en 8 s |

### Les cinq règles d'architecture, contrôlées

| Règle | Critère mesurable | État |
| --- | --- | --- |
| Aucune route `/api/*` qui double une action | `find app -path "*api*"` → vide | ✅ |
| `fs` / `child_process` interdits côté serveur | `grep -rn "node:fs\|node:child_process" server/ actions/` → vide | ✅ |
| Portée par propriétaire sur chaque table | garde `no-unscoped-queries` du doctor | ✅ |
| Imports relatifs en `.ts`, jamais `.js` | `grep -rn 'from "\./.*\.js"' actions/ server/ shared/` → vide | ✅ |
| `move-stage` seul chemin vers `videos.stage` | `update-video` lève une erreur sur `stage` | ✅ |

## Ce qui reste, par valeur décroissante

### 1. L'agent n'a jamais tourné de bout en bout

**Problème** : l'agent est la colonne vertébrale du produit — c'est lui qui lit la carte,
diagnostique, et compose depuis le brief. **Aucune conversation complète n'a jamais eu
lieu depuis ce dépôt.** La chaîne est prouvée jusqu'à la facturation : la clé xAI était
valide, les 44 actions chargées, la requête partie, et xAI a répondu
`403 permission-denied … has either used all available credits or reached its monthly
spending limit`.

**Fait quand** : une vraie conversation lit une carte, pose un diagnostic et compose un
brief. Compter vingt minutes une fois le crédit en place. C'est le seul point bloquant
qui ne dépend pas du code.

### 2. La page de chat plein écran — corrigée le 7 octobre 2026

**Le symptôme** : cliquer « Nouveau chat » menait à `/chat/:threadId`, qui levait
**« AgentKit hooks require an AgentKitProvider. »** et n'affichait qu'un écran d'erreur.
Le panneau agent de la barre latérale, lui, fonctionnait — et cet écart était l'indice.

**La cause, et comment elle a été établie.** La pile d'appel, capturée au protocole
DevTools, donne le fil :

```
at useAgentKit    (…/toolkit/dist/app/agentkit/react/context.js?v=96daa319:228)
at useAgentThread (…/toolkit/dist/app/agentkit/react/context.js?v=96daa319:382)
at ChatLifecycleTracking (app/components/chat/ChatRouteContent.tsx:291)
```

Une sonde temporaire posée en **premier enfant** de `CoreAgentKitRoot` ne voyait déjà
aucun contexte — alors que les deux garde-fous de `AgentKitRoot` *lèvent* une erreur
plutôt que de rendre les enfants sans fournisseur. Le fournisseur n'était donc pas
au-dessus, bien que le JSX dise le contraire.

La même sonde a imprimé le composant tel qu'il existe à l'exécution :

```
function CoreAgentKitRoot(props) { return (0, import_jsx_runtime.jsx)(AgentKitRoot, …
```

`(0, import_jsx_runtime.jsx)` est de l'**esbuild** : ce composant venait d'un paquet
**pré-bundlé** par Vite. Le consommateur, lui, était servi **brut** depuis
`node_modules`. Les deux moitiés d'AgentKit vivaient de part et d'autre de la frontière
de pré-bundling, donc dans **deux instances du même module** — et `AgentKitContext` est
un simple `createContext(null)`, sans le garde `globalThis` dont le contexte de *locale*
du framework se protège, lui. Deux instances, deux contextes : le fournisseur en
remplissait un, les hooks lisaient l'autre.

**Le correctif** : déclarer les deux spécificateurs dans `optimizeDeps.include`
(`vite.config.ts`), ce qui les fait passer par la même passe et leur fait partager un
unique module de contexte. Aucun fichier de `@agent-native/*` n'est touché.

**Vérifié** — même boucle, profil neuf, cache Vite vidé :

```
VERT — l'erreur a disparu
page : Indagis Studio | Vidéos | Échéances | Bibliothèque | Nouveau chat | Comment puis-je aider ?
```

**Ce qui reste à faire en amont** : `AgentKitContext` mériterait le même garde
`globalThis` que `__AGENT_NATIVE_LOCALE_CONTEXT__`. Sans lui, toute application qui coupe
autrement la frontière de pré-bundling retombera dans le même piège. **Une issue reste à
ouvrir** — les preuves ci-dessus suffisent à la rédiger.

**Une leçon de méthode, puisqu'elle a coûté cher.** La régression avait été localisée au
commit `8beeae7` (codemod 0.195.0 → 0.200.0) par `git bisect run`, et le mécanisme
*deviné* à partir de là : « deux sous-chemins différents, donc deux modules ». C'était
faux dans le détail — les deux sous-chemins mènent au **même fichier**, et Vite leur sert
la **même URL**. Cinq correctifs ont été essayés contre cette fausse cause, et aucun n'a
tenu. Ce qui a débloqué, c'est d'arrêter de raisonner sur les fichiers et de lire la pile.

### 3. Huit alertes de dépendances, dont quatre hautes

**Problème** : plus aucune critique, et quatre de moins qu'au relevé précédent. Restent,
au 7 octobre 2026 — `gh api repos/agtktID/indagisdisign/dependabot/alerts` :

| Gravité | Paquet |
| --- | --- |
| haute | `xlsx` (deux alertes), `pdfjs-dist`, `@modelcontextprotocol/client` |
| moyenne | `@anthropic-ai/sdk`, `postcss-selector-parser`, `sprintf-js`, `uuid` |

**Toutes transitives** : aucune n'est déclarée dans notre `package.json`, et
`git grep "xlsx\|pdfjs"` dans `actions/`, `server/`, `shared/` et `app/` ne rend rien.

Une seule est prouvée atteignable côté serveur : **`xlsx`**, deux alertes hautes, et il
n'existe aucun correctif accessible — SheetJS a quitté npm, les versions saines ne vivent
que sur son propre CDN. Le déclencheur est de joindre un classeur au chat.

**Fait quand** : une version du framework les résout, ou le dépôt documente formellement
pourquoi elles sont acceptables pour une application qui ne tourne qu'en local. Pour
`xlsx`, la seule parade réelle serait de refuser l'ingestion de classeurs.

### 4. L'EDL n'a jamais été ré-importé dans Resolve

**Problème** : la structure est testée — en-tête `FCM: NON-DROP FRAME`, noms de bobine à
8 caractères, timecodes source et record. Mais **personne n'a ouvert le fichier dans
Resolve ou Premiere depuis ce dépôt.** Un EDL subtilement faux s'importe sans message.

**Fait quand** : un fichier exporté s'ouvre dans Resolve et montre les bons passages.
Vérifiable par vous seul, puisqu'il faut le logiciel.

## Le premier démarrage, joué pour de vrai

Le 7 octobre, depuis un clone neuf du dépôt public, sur une base vierge — le parcours
qu'un visiteur rencontre en premier, et que la CI ne joue jamais puisqu'elle ne lance pas
l'interface.

| | |
| --- | --- |
| `git clone` → `pnpm install` | **6,5 s**, exit 0 |
| premier `pnpm dev` | base créée, **1034 migrations** appliquées, répond en **8 s** |
| liste vide | « Aucune vidéo pour l'instant — Créez un projet, puis ouvrez sa carte narrative » |
| brief sur carte vide | « Rien n'est encore écrit dans ce périmètre. Posez d'abord une note sur une étape. » |
| diagnostic sur carte vide | « Commencez par le monde ordinaire (étape 1) et le climax (étape 8) » — les deux étapes cliquables |
| bibliothèque | les 550 prompts présents dès l'installation, classés sur leurs trois axes |

Le diagnostic sur carte vide se révèle être un bon guide de démarrage. Ce n'était pas
prévu pour ça.

**Un seul défaut trouvé, et corrigé** : la page de connexion vendait le modèle « chat » du
framework, en anglais, avec un lien vers une autre application.

### Le motif qui a servi trois fois

| Fichier | Commits | Ce qu'il figeait |
| --- | --- | --- |
| `pnpm-workspace.yaml` | 1 | 41 pins tiptap, neutralisant chaque montée du framework |
| `app/i18n/index.ts` | 1 | le catalogue du cœur au lieu de celui du toolkit — des noms de clés à l'écran |
| `server/plugins/auth.ts` | 1 | l'argumentaire d'une autre application |

Le signe commun n'était pas le nombre de commits — presque tout le projet est né dans
`e1577cc` — mais **du contenu appartenant à un autre produit**. Un balayage du dépôt sur
ce critère ne trouve plus rien : seuls les skills du framework mentionnent encore
`agent-native.com`, ce qui est normal.

Reste une broutille : `app/lib/app-config.ts` garde la logique de substitution du
générateur de gabarit, dont les deux branches rendent aujourd'hui la même valeur.

## Les trois recommandations, faites

Elles avaient été trouvées en auditant les 44 actions contre l'interface. Aucune n'était
un bug : c'étaient des gestes que le monteur ne pouvait pas faire.

### A. Importer des marqueurs — fait

`import-markers` lit trois formats, reconnus tout seuls : le CSV (le nôtre, et tout autre
à colonnes nommées), l'EDL CMX3600 de Resolve ou Premiere, et les lignes collées d'un
dérushage. L'aller-retour export → import est ancré par un test.

Deux décisions qui engagent, et qu'il faut connaître avant de toucher à ce code :

- **Les timecodes SOURCE de l'EDL, jamais les record.** Le record dit où le passage tombe
  dans l'assemblage — une information qui n'existe pas dans le carnet et qui changera dès
  la première coupe. Un test l'ancre : deux événements commençant à 0 dans leurs rushes
  respectifs doivent tous deux relire 0.
- **La cadence est exigée pour un EDL, jamais supposée.** Un EDL ne la porte pas ; la
  deviner décalerait tous les timecodes en silence. Même règle qu'à l'export.

### B. Coller une liste de timecodes — fait

Deux portes, une seule action derrière : coller un bloc, ou choisir un fichier — lu dans
le navigateur, envoyé à l'action locale, rien ne sort de la machine. Une **lecture à
blanc** montre ce qui serait créé et ce qui serait refusé, ligne par ligne.

Les marqueurs importés s'ajoutent à la suite, **jamais à la place** : un import ne doit
pas pouvoir effacer un carnet.

### C. Montrer le diagnostic sur la carte — fait

Un bouton dans l'en-tête, un compteur de remarques, et surtout : **chaque remarque est
cliquable**. `Finding.steps` nomme les étapes concernées ; un clic déplie la bonne. C'est
ce que l'onglet Essais ne sait pas faire, et c'est la raison d'être de cette surface — on
constate ici, on agit là-bas.

### Le principe commun

**Rejeter plutôt que deviner.** Une ligne incompréhensible est rendue avec son numéro et
sa raison. Un carnet à moitié faux coûte plus cher qu'un carnet vide, parce qu'on ne sait
pas quelle moitié.

### Deux choses que je ne recommande toujours pas

**Ajouter des règles de diagnostic.** Douze suffisent tant que personne ne les a vues
tourner sur un vrai montage. En écrire une treizième avant ce retour, c'est deviner.

**Déployer en ligne.** Le produit tient parce qu'il est local : pas de compte, pas de
données qui sortent, PGlite sur la machine. Un déploiement exigerait un Postgres
persistant et un secret d'authentification, et ferait tomber l'argument de
confidentialité qui est aujourd'hui gratuit.

## Traité depuis la première version de ce document

- **L'interface suit la langue** — les 8 écrans Studio passent par `useT()`, 11 langues
  aux clés strictement identiques, garanties par 41 cas de test.
- **La coquille du toolkit affichait des noms de clés** — « App fallback name »,
  « Search placeholder », dans les onze langues. `app/i18n/index.ts` venait du gabarit et
  n'avait **qu'un seul commit** ; il appelait le constructeur de catalogue du cœur, qui
  ignore les 2337 clés du toolkit.
- **Le brief narratif a un bouton** — il n'en avait aucun, et le premier clic a révélé un
  405 : `callAction` postait sur une action déclarée en GET.
- **L'EDL et les chapitres YouTube sortent de l'écran** — seul le CSV était atteignable.
- **Un critère contre la récidive** — aucune action métier sans point d'entrée dans
  l'interface, 4 exceptions nommées.
- **Une démonstration animée** — `tools/captures/demo.mjs` joue le parcours et l'assemble
  en GIF. Une capture fixe ne prouve jamais qu'un bouton agit.
- **L'export vers les logiciels de montage** — `--format edl` produit un assemblage
  CMX3600, `--format youtube-chapters` des chapitres collables. Limite assumée : ces
  sorties n'ont pas été ré-importées dans Resolve ou Premiere depuis ce dépôt.
- **`DESIGN.md`** — réécrit pour décrire la direction réelle de Studio. Il n'est pas
  supprimable : deux skills du framework exigent qu'une direction y soit nommée.

## Ce qui a été délibérément écarté

**Une règle de position dans la timeline** — « le climax tombe à 40 % de la durée ».
Elle paraît rigoureuse et elle est fausse : `markers.startMs` est relatif à son rush,
pas à un montage. Un marqueur à 4 s dans `rush-01` et un autre à 4 s dans `rush-07` ne
désignent pas le même instant. La position finale n'est pas dérivable de ces données.

**Compter les marqueurs comme de la couverture** (FR-006) — des rushes rattachés disent
ce qu'on a filmé, pas ce que l'étape fait dans l'histoire. La règle
`matiere-sans-intention` nomme ce cas sans le traiter comme vide.

**Le rendu vidéo depuis le serveur** — `fs` et `child_process` resteront interdits. Le
rendu passe par les ponts MCP locaux, en processus séparé.

**L'export FCPXML** — contrairement à l'EDL, c'est un XML à DTD versionnée dont une
erreur subtile passe à l'import sans message. Sans possibilité de ré-importer dans Final
Cut depuis ce dépôt, le produire serait de la fabrication. À reprendre par qui pourra le
tester.
