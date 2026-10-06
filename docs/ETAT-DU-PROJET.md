# État du projet — 6 octobre 2026

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
| 41 actions métier, plus les 2 standard | `ls actions/*.ts \| wc -l` → 43 |
| 13 tables, toutes à portée par propriétaire | `grep -c "ownableColumns()" server/db/schema.ts` → 13 |
| 4 écrans | `ls app/routes/*.tsx` |
| 12 règles de diagnostic | `grep -oE 'rule: "[a-z-]+"' shared/diagnosis.ts \| sort -u \| wc -l` → 12 |
| 550 prompts livrés, hors du bundle client | garde CI « Le catalogue ne part pas au navigateur » |
| 76 tests | `pnpm test` |
| Export CSV, EDL d'assemblage et chapitres YouTube | `pnpm action export-markers --videoId <id> --format edl` |
| Typecheck, build et doctor verts | `pnpm typecheck && pnpm build && pnpm agent-native:doctor` |

### Les cinq règles d'architecture, contrôlées

| Règle | Critère mesurable | État |
| --- | --- | --- |
| Aucune route `/api/*` qui double une action | `find app -path "*api*"` → vide | ✅ |
| `fs` / `child_process` interdits côté serveur | `grep -rn "node:fs\|node:child_process" server/ actions/` → vide | ✅ |
| Portée par propriétaire sur chaque table | garde `no-unscoped-queries` du doctor | ✅ |
| Imports relatifs en `.ts`, jamais `.js` | `grep -rn 'from "\./.*\.js"' actions/ server/ shared/` → vide | ✅ |
| `move-stage` seul chemin vers `videos.stage` | `update-video` lève une erreur sur `stage` | ✅ |

## Ce qui reste, par valeur décroissante

### 1. L'interface n'est pas traduite

**Problème** : 12 locales dans `app/i18n/`, un sélecteur de langue dans les réglages, et
**aucun `useT()`** dans les écrans Studio. Passer l'application en anglais donne une
coquille anglaise autour d'un produit entièrement français. C'est le plafond de diffusion
le plus bas du dépôt, pour un projet destiné à faire connaître son auteur.

**Fait quand** : soit les écrans Studio passent par `useT()`, soit le README annonce dès
sa première ligne que l'application est en français. Les deux sont des réponses
honnêtes ; l'ambiguïté actuelle ne l'est pas.

### 2. Les alertes de dépendances

**Problème** : 9 alertes ouvertes, **toutes transitives** de `@agent-native/core` et
`@agent-native/agentkit` (`xlsx`, `pdfjs-dist`, `@tiptap/core`, `@anthropic-ai/sdk`,
`uuid`, `braces`). Aucune prise directe : la montée en 0.200.0 ne les a pas effacées.

**Fait quand** : une version du framework les résout, ou le dépôt documente pourquoi
elles sont acceptables pour une application qui ne tourne qu'en local.

### 3. Brancher l'écran « Créer » sur la carte narrative

**Problème** : `CreateView` assemble modèle + kit de marque + demande, mais **les 12
étapes, la courbe et les marqueurs n'y entrent jamais**. La bibliothèque est un produit
posé à côté du produit.

**Fait quand** : « fais-moi un teaser de l'acte III depuis ma carte » produit un brief
contenant les vrais beats et timecodes. C'est une phrase qu'aucun autre outil ne peut
exécuter.

## Traité depuis la première version de ce document

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
