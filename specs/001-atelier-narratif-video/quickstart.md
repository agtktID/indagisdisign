# Phase 1 — Démarrage rapide : Atelier narratif vidéo

**Branche** : `001-atelier-narratif-video` | **Date** : 2026-09-28
**Sources** : [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/actions.md](./contracts/actions.md)

De zéro à une carte narrative qui se met à jour quand l'agent écrit.

---

## Prérequis

- **Node.js 22.22 ou plus** — exigence du framework, vérifiée par `node --version`
- **pnpm** sur le `PATH` — sinon `corepack enable` dans l'app générée
- Une connexion LLM pour l'agent : Builder.io (crédits gratuits), une clé Anthropic ou
  OpenAI, ou un modèle Ollama local

Aucun compte externe n'est nécessaire pour *utiliser* l'application une fois lancée
(FR-019) — la connexion LLM sert à l'agent, pas aux fonctionnalités de structuration.

---

## 1. Générer l'application

Le dépôt contient déjà `AGENTS.md`, `specs/`, `.specify/`, `_bmad/` et `.claude/`. On
génère donc **à côté**, puis on fusionne, pour qu'aucun de ces fichiers ne soit écrasé :

```bash
npx --yes @agent-native/core@latest create indagis-studio-scaffold --standalone --template chat
```

Puis déplacer le contenu de `indagis-studio-scaffold/` à la racine du dépôt, en
**vérifiant fichier par fichier** qu'aucune collision n'existe. Le seul conflit attendu
est `AGENTS.md` : celui du dépôt fait autorité, celui du scaffold sert de référence pour
en reprendre les sections manquantes.

```bash
corepack enable
pnpm install
```

### Piège connu : `ERR_PNPM_NO_MATURE_MATCHING_VERSION`

Si un `minimumReleaseAge` est configuré (globalement ou dans le projet), `pnpm install`
échoue sur les paquets `@agent-native/*` publiés récemment — le framework publie des
versions plusieurs fois par jour. Corriger avec un motif générique, pas en listant les
paquets un par un :

```yaml
# pnpm-workspace.yaml ou .npmrc selon la configuration en place
minimumReleaseAgeExclude:
  - "@agent-native/*"
```

---

## 2. Poser le référentiel avant le code

`shared/hero-journey.ts` en premier, avant toute table et toute action. C'est le contenu
figé de la méthode, et tout le reste s'y réfère :

- `ACTS` — les 3 actes, leur libellé, les numéros d'étapes qu'ils couvrent, leur couleur
- `JOURNEY_STEPS` — les 12 étapes : numéro, titre, définition, conseil de montage,
  exercice, films cités, intensité de référence
- `PREP_QUESTIONS` — les 5 questions de la fiche de préparation, avec leur clé stable
- `DIAGNOSTIC_SYMPTOMS` — les 5 symptômes, avec leur clé stable
- `FINAL_REVIEW` — les 4 points de relecture finale
- `actForStep(step)`, `stepByNumber(n)` — les deux accesseurs

Les textes sont transcrits **verbatim** depuis la méthode source. Les reformuler
introduirait un écart silencieux entre ce que l'utilisateur a lu et ce que l'outil lui
dit.

---

## 3. Le schéma et les migrations

`server/db/schema.ts` — les 9 tables de [data-model.md](./data-model.md), avec les
helpers de `@agent-native/core/db/schema`.

`server/db/index.ts` — `createGetDb(schema)` et l'inscription du partage :

```ts
registerShareableResource({
  type: "studio-video",
  resourceTable: schema.videos,
  sharesTable: schema.videoShares,
  displayName: "Vidéo",
  titleColumn: "title",
  getResourcePath: (video) => `/video/${video.id}`,
  getDb,
});
```

`server/plugins/db.ts` — `runMigrations([...], { table: "indagis_studio_migrations" })`.
Chaque entrée porte un `name:` unique en plus de son `version:`.

### Piège connu : verrou PGlite

PGlite ne supporte **qu'un seul processus**. Un second serveur de développement lancé en
parallèle échoue avec :

```text
[db] Migration failed: PGlite database directory "./data/pglite" is already owned by process <pid>
```

Vérifier qu'aucun serveur n'est déjà lancé avant d'en démarrer un, et tuer le processus
orphelin le cas échéant.

### Vérification

```bash
pnpm typecheck
```

Les opérateurs Drizzle (`eq`, `and`, `desc`, `inArray`…) s'importent de
`@agent-native/core/db/schema`, comme le prescrit la skill `storing-data` du framework —
un import direct depuis `drizzle-orm` échoue à la compilation, malgré ce que montre
l'exemple de `context-awareness.mdx`. C'est le premier point que ce `typecheck` tranche.

---

## 4. Les actions, dans l'ordre utile

Trois d'abord, pour avoir une boucle complète avant d'élargir :

```bash
pnpm action create-video --title "Test"
pnpm action get-story-map --videoId <id>
pnpm action set-beat --videoId <id> --step 1 --note "Le quotidien avant le déclic"
```

Une action qui répond en CLI répond aussi dans l'UI, dans le chat et en HTTP — c'est la
promesse du Principe II, et la CLI est le moyen le plus rapide de la vérifier.

---

## 5. Les écrans

1. `app/routes/_index.tsx` — la liste, avec la couverture narrative par carte
2. `app/routes/video.$id.tsx` — la fiche, cinq onglets, *Carte* par défaut
3. `app/routes/calendar.tsx` — les échéances

`app/hooks/use-navigation-state.ts` est **étendu**, pas remplacé : `videoId`, `tab`,
`step`, plus les cas correspondants dans `viewForPath` et `pathForView`.

La courbe émotionnelle utilise Recharts, déjà dépendance de `@agent-native/core` — ne pas
ajouter de bibliothèque de graphiques.

---

## 6. Instructions agent et skills

`AGENTS.md` du dépôt est déjà écrit ; y ajouter le tableau des 25 actions, les clés
d'état applicatif, et l'index des trois skills métier :

| Skill | Se déclenche quand | Contient |
| --- | --- | --- |
| `voyage-du-heros` | structurer ou diagnostiquer un récit | les 12 étapes, les 3 actes, les règles de courbe. Le détail des étapes va dans `references/`, pas dans `SKILL.md` |
| `diagnostic-timeline` | un symptôme de montage est décrit | les 5 symptômes → essais, et la règle « une seule chose à la fois » |
| `roasting` | un retour de spectateur arrive | transformer une observation en hypothèse testable ; ne jamais prendre une solution proposée pour un diagnostic |

Les 28 skills du framework couvrent le reste — ne pas les réécrire.

---

## 7. Lancer et vérifier

```bash
pnpm dev
```

Sur l'écran d'accueil, choisir **Continue as local dev** : aucun email ni mot de passe
n'est nécessaire en développement.

```bash
pnpm agent-native:doctor
```

---

## Scénarios de validation

Chacun correspond à une user story de la spec. Un scénario n'est validé qu'après
**relecture** de ce qui a été écrit — l'affichage optimiste n'est pas une preuve
(Principe IV).

### V1 — la carte narrative (P1, SC-001, SC-002)
Créer une vidéo, renseigner trois étapes réparties sur deux actes.
**Attendu** : la couverture par acte change, la courbe se trace sur les points renseignés.
**Vérifier** : recharger la page — les trois notes sont toujours là.

### V2 — la règle de couverture (FR-006)
Poser une `intensity` sur une étape **sans** note.
**Attendu** : le point apparaît sur la courbe, et l'étape reste **non couverte**. Le
compteur d'acte ne bouge pas.

### V3 — l'ordre narratif (P2, SC-003)
Poser cinq marqueurs, dont un sans étape. Les réordonner contre l'ordre chronologique.
**Attendu** : l'ordre narratif tient au rechargement, et le tri par timecode affiche
toujours l'ordre chronologique. Le marqueur sans étape reste visible et compté comme non
rattaché.

### V4 — l'export (FR-009, SC-005)
Exporter le carnet.
**Attendu** : un CSV téléchargé sans qu'aucun stockage externe n'ait été demandé. Un
marqueur dont l'intitulé commence par `=` sort préfixé d'une apostrophe.

### V5 — la fiche de préparation (P3, SC-004)
Répondre aux cinq questions.
**Attendu** : les cinq clés du référentiel sont présentes. Une clé inventée est rejetée
avec la liste des clés valides.

### V6 — le diagnostic (P4)
Sur une vidéo dont l'acte II est vide, demander un diagnostic à l'agent.
**Attendu** : il identifie l'acte sous-couvert **en citant la règle**, et propose de créer
un essai — sans inventer de contenu narratif à la place de l'utilisateur.

### V7 — la boucle d'essais (FR-013, FR-014)
Ouvrir deux essais et passer les deux en `testing`.
**Attendu** : un avertissement rappelle la règle « une seule chose à la fois », sans
bloquer. Clore un essai sans `verdictNote` est refusé.

### V8 — la production (P5, SC-007)
Faire avancer une vidéo d'étape, puis reculer le `stage_changed_at` au-delà de 14 jours.
**Attendu** : `list-blocked` la signale ; une vidéo archivée ou publiée n'y apparaît pas.
Tenter de changer `stage` via `update-video` est refusé avec renvoi vers `move-stage`.

### V9 — la synchronisation vive (le critère qui compte)
Écran ouvert sur l'onglet *Carte*. Demander à l'agent dans le chat :
> Écris une note pour l'étape 8 de cette vidéo.

**Attendu** : la case de l'étape 8 se met à jour **sans rafraîchissement manuel**, via
`useDbSync`. Si elle ne bouge pas, le contrat des quatre zones est rompu quelque part —
c'est le test qui le révèle.

### V10 — le parcours complet (SC-006)
Créer une vidéo, remplir la fiche de préparation, poser trois marqueurs dont un sans
étape, obtenir un diagnostic, créer un essai, le clore, avancer d'une étape de production.
**Attendu** : aucun blocage, aucune erreur, aucune donnée perdue au rechargement.

---

## Portes de vérification avant de considérer la fonctionnalité livrée

| Porte | Commande |
| --- | --- |
| Types | `pnpm typecheck` |
| Tests | `pnpm test` |
| Santé du framework | `pnpm agent-native:doctor` |
| Les 9 tables répondent | `pnpm action db-query --sql "SELECT count(*) FROM story_beats"` (et les huit autres) |
| Chaque action répond | `pnpm action <nom> [...]` pour les 23 actions métier |
| Les 10 scénarios | passés à l'écran, pas seulement en CLI |
