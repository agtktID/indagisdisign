# Catalogue de prompts — import

`shared/prompt-catalog/` est **généré**. Ce dossier contient de quoi le reconstruire.

```bash
node tools/prompt-catalog/build.mjs <dossier-source>
```

Le dossier source doit contenir `image-generation/*.md` et `video-generation/*.md`
au format des dépôts d'origine :

```
## Case 11: <titre>

**Styles:** Illustration

**Scenes:** Travel

**Source:** https://…

**Prompt:**
​```
<le corps du prompt>
​```
```

## Ce que le script fait, et ne fait pas

- **Il recopie les corps de prompt tels quels.** Aucune réécriture, aucune traduction :
  c'est le texte d'origine qui part au modèle, et c'est celui qui a été éprouvé.
- **Il traduit les titres**, depuis `titles-fr.tsv`. Les titres d'origine sont en
  chinois ; sans traduction, 550 entrées seraient impossibles à parcourir. Le titre
  d'origine reste affiché sous le titre français, pour retrouver le prompt à la source.
- **Il refuse une valeur inconnue.** Une catégorie, un style ou une scène absents des
  tables du script arrêtent la génération — mieux vaut un échec qu'une case inventée.
- **Il n'efface que `data/`.** `shared/prompt-catalog/fill.ts` est écrit à la main.

## L'appariement des traductions

`titles-fr.tsv` est indexé par le **rang du titre dans l'ordre de dédoublonnage**, pas
par le titre lui-même. C'est plus court à écrire, mais fragile : si la source change,
le script s'arrête quand les comptes ne correspondent plus, et il faut revoir le
fichier. C'est délibéré — un décalage silencieux mettrait de faux titres partout.

## Provenance et licences

| Partie | Source | Licence |
| --- | --- | --- |
| 541 prompts image | [freestylefly/awesome-gpt-image-2](https://github.com/freestylefly/awesome-gpt-image-2) | MIT |
| 9 cas d'usage vidéo | [ZeroLu/awesome-seedance](https://github.com/ZeroLu/awesome-seedance) | MIT |

Les deux dépôts sont sous licence MIT : la redistribution est permise en conservant
l'avis de licence. Chaque prompt garde en outre le lien vers son auteur d'origine
quand la source en indiquait un — 516 des 541 prompts image.

Les cas vidéo viennent d'un article de 卡尔的AI沃茨 agrégé par `awesome-seedance`.
