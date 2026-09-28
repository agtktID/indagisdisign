---
name: hyperframes
description: >-
  Transformer une carte narrative Studio en composition vidéo HyperFrames. À lire quand
  l'utilisateur veut produire une vidéo, un teaser, un chapitrage animé ou une courbe
  émotionnelle animée à partir de sa carte. Décrit aussi ce que l'agent peut et ne peut
  PAS faire ici — le rendu n'a pas lieu dans cette application.
---

# HyperFrames depuis la carte narrative

## Ce que tu peux faire, et ce que tu ne peux pas

Cette application **ne rend aucune vidéo**. Rendre demande FFmpeg, un navigateur sans
interface et l'exécution de commandes — trois choses que le serveur Studio n'a pas, par
construction (la constitution interdit `fs` et `child_process` côté serveur pour que
l'app reste déployable partout).

| Situation | Ce que tu fais |
| --- | --- |
| Des outils `mcp__hyperframes__*` sont dans ton registre | Le pont local est démarré. Enchaîne : `doctor` → `init` → `write_composition` → `lint` → `preview_start` (l'utilisateur regarde) → `render`. Le rendu se fait sur la machine de l'utilisateur, dans `video/<projet>/`. |
| Aucun outil MCP HyperFrames n'est branché | Tu **produis le brief de composition** et tu le rends à l'utilisateur en texte. Tu dis clairement que le rendu se fera de son côté. Tu n'inventes pas une URL de vidéo. |

Vérifie avec `tool-search` avant d'annoncer ce que tu peux faire. Ne prétends jamais
avoir lancé un rendu sans un identifiant de tâche renvoyé par un vrai outil.

## Ce que la carte narrative donne à une composition

C'est le pont : Studio a déjà la matière dont une composition a besoin.

| Donnée Studio | Ce qu'elle devient |
| --- | --- |
| Les 12 étapes couvertes (`get-story-map`) | la structure en scènes ; une étape = un bloc narratif |
| Les 3 actes et leurs couleurs | l'identité visuelle par partie : teal / orange / violet |
| `intensity` de chaque étape | le rythme : coupes serrées au pic (étape 8), respiration à la 9 |
| Les marqueurs (`list-markers`) avec `startMs`/`endMs` | les points de montage réels, en millisecondes — directement exploitables |
| `sortOrder` des marqueurs | **l'ordre narratif**, qui peut différer du chronologique. C'est lui qui fait foi pour la composition, pas le timecode. |
| Le titre et la fiche de préparation | le texte à l'écran, les cartons, la promesse à tenir |

## Comment procéder

1. `get-story-map` pour la structure, jamais de mémoire.
2. `list-markers` en `order: "narrative"` — c'est l'ordre voulu par l'utilisateur.
3. Construire le brief : une scène par étape **couverte** (une étape sans note n'a rien à
   montrer), sa durée déduite de ses marqueurs, son intensité, sa couleur d'acte.
4. Si les outils MCP existent : `doctor` d'abord (Chrome et ffmpeg présents ?), puis
   `init`, `write_composition`, `lint`, et seulement ensuite `render`. Rendre en
   `quality: "draft"` tant qu'on itère, `delivery` pour la version finale. Un rendu prend
   plusieurs minutes — prévenir l'utilisateur plutôt que de le laisser attendre en silence.
5. Sinon, rendre le brief en texte structuré et dire où le porter.

## À ne pas faire

- Ne pas inventer de contenu narratif absent de la carte. Les étapes vides restent vides.
- Ne pas trier les marqueurs par timecode quand l'utilisateur a posé un ordre narratif.
- Ne pas annoncer un rendu terminé sans identifiant renvoyé par un outil.
- Ne pas proposer d'installer HyperFrames « dans l'app » : ce n'est pas une option.

## Où est la référence complète

Le détail du CLI, du catalogue de primitives et des modes de rendu (local, cloud HeyGen,
AWS Lambda, Google Cloud Run) vit dans le plugin HyperFrames de l'environnement de
développement, pas ici. Cette skill couvre uniquement le pont Studio → composition.
