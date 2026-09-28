---
name: remotion
description: >-
  Écrire une composition vidéo Remotion (vidéo en React) à partir d'une carte narrative
  Studio. À lire quand l'utilisateur travaille en React pour la vidéo, ou demande du code
  de composition plutôt qu'un rendu. Remotion n'a pas de serveur MCP : l'agent produit du
  code, il ne rend rien.
---

# Remotion depuis la carte narrative

## Le cadre, d'abord

Remotion est une bibliothèque de **vidéo en React** : une composition est du code.

Indagis Studio embarque un pont local, `tools/remotion-bridge`, qui te donne huit outils
sous `mcp__remotion__*`. Vérifie avec `tool-search` qu'ils sont bien dans ton registre :
s'ils y sont, le pont tourne et tu peux aller jusqu'au rendu ; sinon, tu écris la
composition et tu la rends à l'utilisateur, sans prétendre qu'un rendu démarre.

### La licence, avant tout

**Remotion n'est pas open source.** Gratuit pour les particuliers, les organisations à but
non lucratif et les entreprises de trois salariés au plus ; licence d'entreprise requise
au-delà. Appelle `mcp__remotion__license_notice` et montre-le à l'utilisateur **avant** de
créer son premier projet Remotion.

HyperFrames est en Apache-2.0 : si l'utilisateur n'a pas de préférence, c'est l'option
sans contrainte.

## Les outils du pont

| Outil | Rôle |
| --- | --- |
| `license_notice` | les conditions — à montrer avant le premier projet |
| `doctor` | vérifier Node et la version de Remotion du projet |
| `list_projects` | lister les projets de `video/` |
| `init` | créer un projet **et installer ses dépendances** — plusieurs minutes |
| `write_composition` | écrire un fichier sous `src/` |
| `read_composition` | le relire, pour vérifier avant de conclure |
| `compositions` | lister les compositions et leurs identifiants |
| `render` | rendre en MP4, WebM ou GIF, dans `out/` |
| `studio_start` | ouvrir Remotion Studio, renvoie l'adresse à donner à l'utilisateur |
| `server_stop` | arrêter le studio |

Ordre normal : `license_notice` → `init` → `write_composition` → `compositions` →
`render`. L'identifiant passé à `render` vient de `compositions`, jamais d'une supposition.

## Ce que Studio apporte

Mêmes données que pour HyperFrames — voir la skill `hyperframes` pour le tableau de
correspondance. En Remotion, elles se traduisent ainsi :

- une étape couverte → un `<Sequence>` avec son `from` et sa `durationInFrames`
- `intensity` → l'amplitude des interpolations (`interpolate`, `spring`)
- la couleur d'acte → le thème du segment
- les marqueurs en ordre narratif → l'ordre des `<Sequence>`, pas leur timecode d'origine

## Règles Remotion à respecter

- Tout ce qui bouge dérive de `useCurrentFrame()`, jamais d'un `setInterval` ni d'une
  animation CSS : le rendu est image par image, une animation hors frame ne sort pas.
- Les durées sont en **images**, pas en secondes : convertir avec `fps`.
- Les ressources externes passent par `staticFile()` et doivent être préchargées, sinon
  elles manquent sur certaines images.
- `<Sequence>` décale le temps local : à l'intérieur, `useCurrentFrame()` repart de 0.
- Pas d'aléatoire non déterministe : utiliser `random()` de Remotion avec une graine, sinon
  deux rendus divergent.

## Comment procéder

1. `get-story-map` et `list-markers` (ordre narratif) — les vraies données.
2. Proposer la structure en séquences **avant** d'écrire le code, et la faire valider.
3. Écrire la composition, commentée, en français comme le reste du projet.
4. Rendre avec `render`, après avoir lu l'identifiant exact dans `compositions`.
   Un rendu prend plusieurs minutes : prévenir plutôt que laisser attendre en silence.

## À ne pas faire

- Ne pas annoncer un rendu réussi sans le chemin de fichier renvoyé par `render`.
- Ne pas créer un projet Remotion sans avoir montré les conditions de licence.
- Ne pas inventer de scènes absentes de la carte.
- Ne pas mélanger l'ordre chronologique et l'ordre narratif.
