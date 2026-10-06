# Contribuer

Merci de l'intérêt. Ce projet est petit et a des règles nettes — les lire fait
gagner du temps des deux côtés.

## Démarrer

```bash
pnpm install
pnpm dev
```

Node 22.22 ou plus, pnpm 10. L'application tourne sur `http://localhost:8080`.
La base est un PGlite local dans `data/` : rien à installer, rien à configurer.

## Les trois portes

Une contribution passe par les trois, sans exception :

```bash
pnpm typecheck
pnpm test
pnpm agent-native:doctor
```

`doctor` doit répondre **Clean**. Il vérifie des choses que le typecheck ne voit
pas : requêtes sans portée locataire, migrations vides, identifiants en dur.

## Les règles qui ne se négocient pas

**Une fonctionnalité = quatre zones.** Interface, action, documentation, état
applicatif. Une fonctionnalité qui n'existe que dans l'interface n'est pas finie :
l'agent doit pouvoir la faire aussi.

**Toute écriture passe par une action.** Pas de route `/api/*` qui doublerait une
action, export CSV compris. `defineAction()` produit d'un seul geste l'outil
d'agent, le hook React, la route HTTP et la commande CLI.

**`move-stage` est le seul chemin vers `videos.stage`.** Il journalise dans
`stage_events`, qui sert à détecter les blocages. Écrire la colonne directement
casse la détection.

**Extension `.ts` dans les imports relatifs de `actions/`, `server/` et
`shared/`.** Pas `.js`. Le chargeur d'actions utilise la résolution ESM stricte de
Node : avec `.js` il cherche un fichier qui n'existe pas et **ignore l'action en
silence**. Dans `app/`, laisser `.js` — React Router en dépend.

**Aucun binaire en base.** `assets.url` stocke un lien, jamais un fichier.

**Aucun secret dans le dépôt.** Ni clé, ni jeton, ni URL de webhook. Les jetons MCP
vont dans les réglages de l'application ou dans `MCP_SERVERS`, pas dans
`mcp.config.json`.

**Les migrations sont rétrocompatibles.** Chaque entrée porte un `name:` unique et
ne supprime jamais de colonne. Une base existante doit continuer de fonctionner.

## Ce qui est généré

`shared/prompt-catalog/` est produit par `tools/prompt-catalog/build.mjs`. Ne pas
l'éditer à la main : la prochaine génération écraserait le travail. Seul
`shared/prompt-catalog/fill.ts` est écrit à la main, et le script le préserve.

## Le contenu de la méthode

Les 12 étapes, les 3 actes, les 5 questions de préparation et les 5 symptômes
vivent dans `shared/hero-journey.ts`. C'est du référentiel transcrit, pas de la
donnée utilisateur : les corriger demande de revenir à la source, pas d'improviser.

## Les commits

Un commit par étape logique, en français ou en anglais, au présent. Pas de commit
fourre-tout en fin de session.

## Avant de proposer quelque chose

[`docs/ETAT-DU-PROJET.md`](docs/ETAT-DU-PROJET.md) liste ce qui reste, par valeur
décroissante, et dit pour chaque point **à quoi on reconnaîtra que c'est fait**. Il
documente aussi ce qui a été délibérément écarté, et pourquoi — utile avant de proposer
une idée qui a déjà été pesée.

## Signaler un problème

Une issue utile dit ce que vous attendiez, ce qui s'est passé, et comment le
reproduire. La sortie de `pnpm agent-native:doctor` aide beaucoup.

Pour une faille de sécurité, ne pas ouvrir d'issue : voir [SECURITY.md](SECURITY.md).
