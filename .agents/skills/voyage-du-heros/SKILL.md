---
name: voyage-du-heros
description: >-
  La carte des 12 étapes du voyage du héros appliquée au montage vidéo, et les règles de
  la courbe émotionnelle. À lire dès que l'utilisateur veut structurer un récit, comprendre
  ce qui manque dans sa carte, ou décider où placer une rupture. Le détail des 12 étapes
  vit dans references/12-etapes.md — le charger seulement quand une étape précise est en jeu.
---

# Voyage du héros — la carte

## Règle

Aider l'utilisateur à **nommer ce qu'il a déjà dans ses rushes**, jamais à inventer des
scènes qui n'existent pas. La carte est un repère pour décider quoi couper et où placer
une rupture — pas une checklist à cocher.

Une étape peut manquer. Ce n'est pas un défaut, et le modèle ne doit pas pousser à la
remplir pour le principe.

## Les trois actes

| Acte | Étapes | Couleur |
| --- | --- | --- |
| I — Le départ | 1 Monde ordinaire · 2 Appel à l'aventure · 3 Refus/hésitation · 4 Rencontre avec le mentor | teal |
| II — L'initiation | 5 Franchissement du seuil · 6 Épreuves, alliés, ennemis · 7 Approche de la caverne · 8 Le climax · 9 Récompense | orange |
| III — Le retour | 10 Chemin du retour · 11 Résurrection · 12 Retour avec l'élixir | violet |

## Les règles de la courbe

- **Pic à l'étape 8.** Si une étape antérieure est plus intense que le climax, la question
  principale a déjà sa réponse et tout ce qui suit paraîtra secondaire.
- **Respiration à l'étape 9.** Après le moment fort, laisser l'effet retomber avant de
  relancer. Une courbe qui reste au maximum épuise.
- **Relance à l'étape 11.** La résurrection prouve la transformation ; elle mérite une
  remontée, pas une fin en pente douce.
- **L'acte II ne doit pas être linéaire.** C'est la partie la plus longue : si la courbe
  y est plate, le milieu paraîtra répétitif.

## Comment procéder

1. Appeler `view-screen` si l'utilisateur dit « cette étape », « cette vidéo » ou « ici ».
2. Appeler `get-story-map` pour voir la carte réelle avant de commenter quoi que ce soit.
3. Écrire avec `set-beat`. **Une intensité seule ne rend pas l'étape couverte** — seule
   une note non vide le fait. L'action le rappelle dans sa réponse.
4. Vérifier l'écriture en relisant la ligne avant de dire que c'est fait.

## À ne pas faire

- Ne pas remplir une étape à la place de l'utilisateur avec du contenu inventé.
- Ne pas présenter la carte comme une norme à atteindre : 12 étapes sur 12 n'est pas un
  objectif, c'est un cas parmi d'autres.
- Ne pas recopier `references/12-etapes.md` dans la conversation. Le charger, en extraire
  ce qui sert la question posée.

## Skills liées

- **diagnostic-timeline** — quand l'utilisateur décrit un symptôme de montage
- **roasting** — quand un retour de spectateur arrive
