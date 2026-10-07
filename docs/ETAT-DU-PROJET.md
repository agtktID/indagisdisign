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
| 42 actions métier, plus les 2 standard | `ls actions/*.ts \| wc -l` → 44 |
| **Aucune action métier sans bouton** | critère du vérificateur, 4 exceptions nommées |
| 13 tables, toutes à portée par propriétaire | `grep -c "ownableColumns()" server/db/schema.ts` → 13 |
| 4 écrans Studio, sur 17 routes — les 13 autres viennent du gabarit | `ls app/routes/*.tsx` |
| 12 règles de diagnostic | `grep -oE 'rule: "[a-z-]+"' shared/diagnosis.ts \| sort -u \| wc -l` → 12 |
| 550 prompts livrés, hors du bundle client | garde CI « Le catalogue ne part pas au navigateur » |
| **130 tests** | `pnpm test` |
| **8 écrans Studio sur 8 passent par `useT()`** | ligne INFO du vérificateur |
| **11 langues aux clés strictement identiques** | `tests/unit/i18n-catalog.test.ts`, 41 cas |
| Export CSV, EDL d'assemblage et chapitres YouTube, **les trois depuis l'écran** | onglet Marqueurs, trois boutons |
| Typecheck, build et doctor verts | `pnpm typecheck && pnpm build && pnpm agent-native:doctor` |
| **24 critères du vérificateur au vert** | `bash scripts/verifier.sh` |

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

### 2. Les routes et la bibliothèque ne sont pas traduites

**Problème** : les 8 écrans Studio suivent la langue, mais `app/routes/*.tsx` et
`app/components/library/*.tsx` — environ 3000 lignes — restent français en dur. En
anglais, l'interface est donc **mixte** : « Story map » suivi de « Toutes les vidéos » et
des onglets « Carte / Marqueurs ».

**Fait quand** : ces fichiers passent par `useT()`. Le test de parité imposera
mécaniquement les onze langues — c'est la partie facile. Le volume est la difficulté.

### 3. Douze alertes de dépendances, dont sept hautes

**Problème** : plus aucune critique — les deux `tinypool` et les deux `@tiptap/core` sont
traitées. Restent `xlsx`, `pdfjs-dist`, `@anthropic-ai/sdk`, `uuid`, `braces`,
`sprintf-js`, `postcss-selector-parser`, `@modelcontextprotocol/*`, `@eslint/plugin-kit`.
**Toutes transitives.**

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

## Recommandations — ce que je ferais ensuite, et pourquoi

Trois manques de produit, trouvés en auditant les 44 actions contre l'interface. Aucun
n'est un bug : ce sont des gestes que le monteur ne peut pas faire.

### A. Importer des marqueurs, pas seulement les exporter

**Aucune action d'import n'existe** (`ls actions/ | grep import` → vide). L'échange est à
sens unique : Studio produit un EDL, il n'en lit aucun.

Or le monteur pose déjà des marqueurs dans Resolve pendant qu'il dérushe. Les retaper un
par un dans Studio est le prix d'entrée du produit, et c'est le plus cher. Lire un CSV ou
un EDL ferait tomber ce prix à zéro, et rendrait l'aller-retour possible : repérer dans
Resolve, structurer dans Studio, ré-assembler dans Resolve.

**C'est à mon avis le plus gros gain disponible**, devant toute nouvelle règle de
diagnostic.

### B. Coller une liste de timecodes d'un coup

Le carnet ne saisit qu'un marqueur à la fois (`grep -ci "bulk\|paste" MarkersTab.tsx` →
0). Un dérushage produit vingt à cinquante repères. Vingt formulaires, c'est un abandon.

Un champ qui accepte un bloc collé — une ligne par passage, `rush-01.mp4 1:30 1:45
Ouverture` — tiendrait en une action et un parseur. Moins ambitieux que l'import de
fichier, et livrable en une fraction du temps.

### C. Montrer le diagnostic sur la carte

Le diagnostic vit dans l'onglet **Essais** ; la carte ne le mentionne jamais
(`grep -c diagnose StoryMap.tsx` → 0). Or la carte est l'écran où l'on passe son temps,
et le diagnostic est la réponse à la question qui fonde le produit : *qu'est-ce qui manque
à mon histoire ?*

Un badge « 3 remarques » dans l'en-tête de la carte, qui déplie la liste, mettrait la
valeur du produit là où le regard est déjà. C'est le changement le moins coûteux des
trois.

### Deux choses que je ne recommande pas

**Ajouter des règles de diagnostic.** Douze suffisent tant que personne ne les a vues
tourner sur un vrai montage. En écrire une treizième avant ce retour, c'est deviner.

**Déployer en ligne.** Le produit tient parce qu'il est local : pas de compte, pas de
données qui sortent, PGlite sur la machine. Un déploiement exigerait un Postgres
persistant, un secret d'authentification, et ferait tomber l'argument de confidentialité
qui est aujourd'hui gratuit.

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
