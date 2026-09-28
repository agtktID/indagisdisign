---
description: "Liste de tâches — Atelier narratif vidéo"
---

# Tasks: Atelier narratif vidéo

**Input** : documents de conception de `/specs/001-atelier-narratif-video/`
**Prérequis** : [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/actions.md](./contracts/actions.md), [quickstart.md](./quickstart.md)

**Tests** : le plan déclare Vitest et `pnpm test` comme porte de vérification. Les tâches
de test ci-dessous sont donc **ciblées sur les règles que le code peut trahir
silencieusement** (couverture FR-006, échappement CSV, ordre narratif, seuil de blocage),
pas une couverture exhaustive. Ce n'est pas un mandat TDD.

**Organisation** : par user story, pour que chacune soit implémentable et testable seule.

## Format : `[ID] [P?] [Story] Description`

- **[P]** : parallélisable — fichiers différents, aucune dépendance en cours
- **[Story]** : US1 à US5, selon spec.md
- Chemins de fichiers relatifs à la racine du dépôt

---

## Phase 1 : Setup (infrastructure partagée)

**But** : obtenir une application Agent-Native qui démarre, dans un dépôt qui contient
déjà Spec Kit et BMAD.

- [X] T001 Générer le scaffold hors du dépôt avec `npx --yes @agent-native/core@latest create indagis-studio-scaffold --standalone --template chat` (research.md, décision 1)
- [X] T002 Fusionner le scaffold à la racine du dépôt fichier par fichier, sans écraser `AGENTS.md`, `specs/`, `.specify/`, `_bmad/`, `.claude/` — reprendre du `AGENTS.md` du scaffold uniquement les sections absentes du nôtre
- [X] T003 Ajouter `minimumReleaseAgeExclude: ["@agent-native/*"]` à la configuration pnpm, puis `corepack enable && pnpm install` (piège `ERR_PNPM_NO_MATURE_MATCHING_VERSION` documenté dans quickstart.md)
- [X] T004 Vérifier que `pnpm dev` démarre et que « Continue as local dev » donne accès sans compte (FR-019)
- [X] T005 [P] Ajouter `data/pglite` et les artefacts de build au `.gitignore`
- [X] T006 [P] Créer `.claude/launch.json` pointant le serveur de développement, pour piloter l'aperçu navigateur

**Checkpoint** : l'application de base tourne, les outils Spec Kit et BMAD sont intacts.

---

## Phase 2 : Foundational (prérequis bloquants)

**⚠️ Aucune user story ne peut démarrer avant la fin de cette phase.**

### Référentiel de la méthode

- [X] T007 Créer `shared/hero-journey.ts` avec `ACTS` — les 3 actes, leur libellé, les numéros d'étapes couverts, leur couleur (teal / orange / violet)
- [X] T008 Compléter `shared/hero-journey.ts` avec `JOURNEY_STEPS` — les 12 étapes transcrites **verbatim** de la méthode source : numéro, titre, définition, conseil de montage, exercice, films cités, intensité de référence. Ne pas reformuler
- [X] T009 [P] Compléter `shared/hero-journey.ts` avec `PREP_QUESTIONS` (5 questions, clés stables), `DIAGNOSTIC_SYMPTOMS` (5 symptômes, clés stables), `FINAL_REVIEW` (4 points)
- [X] T010 [P] Ajouter les accesseurs `actForStep(step)` et `stepByNumber(n)` dans `shared/hero-journey.ts`, avec rejet explicite hors de 1–12
- [X] T011 [P] Créer `shared/coverage.ts` avec la règle FR-006 : « une étape ne compte comme couverte que si `note` est non vide après trim ; une `intensity` seule ne suffit pas ». Une seule implémentation, partagée par l'écran, l'agent et l'export
- [X] T012 [P] Créer `shared/constants.ts` avec `BLOCKED_THRESHOLD_DAYS = 14` (research.md, décision 5) et `CSV_MAX_ROWS = 5000`
- [X] T013 [P] Test unitaire de `shared/coverage.ts` dans `tests/unit/coverage.test.ts` : note vide → non couverte ; note d'espaces → non couverte ; intensité seule → non couverte ; note non vide → couverte

### Base de données

- [X] T014 Créer `server/db/schema.ts` avec les 9 tables de data-model.md, via les helpers de `@agent-native/core/db/schema` — `ownableColumns()` sur les tables possédées, timecodes en **entiers millisecondes**, `step` en entier 1–12
- [X] T015 Ajouter dans `server/db/schema.ts` les contraintes d'unicité : `uniqueIndex` sur `(video_id, step)` pour `story_beats`, sur `(video_id, question_key)` pour `prep_answers`, sur `(publication_id, measured_on)` pour `metrics`
- [X] T016 Ajouter dans `server/db/schema.ts` les index de lecture : `videos(owner_email)`, `videos(org_id, archived_at)`, `videos(due_at)`, `videos(parent_video_id)`, `stage_events(video_id, occurred_at desc)`, `story_beats(video_id)`, `markers(video_id)`, `markers(video_id, step)`, `markers(video_id, sort_order)`, `experiments(video_id)`, `experiments(video_id, status)`, `publications(video_id)`, `publications(video_id, platform)`
- [X] T017 Créer `server/db/index.ts` avec `createGetDb(schema)` et l'export local de `getDb` — les actions importent **ce** chemin, jamais `@agent-native/core` directement
- [X] T018 Écrire `server/plugins/db.ts` avec `runMigrations([...], { table: "indagis_studio_migrations" })` — une entrée par table, chacune avec un `name:` unique, en `CREATE TABLE IF NOT EXISTS`. Aucun `DROP`, aucun renommage, aucun `NOT NULL` sans `DEFAULT` (research.md, décision 2)
- [X] T019 Inscrire le partage dans `server/db/index.ts` : `registerShareableResource({ type: "studio-video", resourceTable: schema.videos, sharesTable: schema.videoShares, displayName: "Vidéo", titleColumn: "title", getResourcePath: (v) => `/video/${v.id}`, getDb })` (research.md, décision 6)
- [X] T020 Vérifier que les 9 tables répondent sur base vierge : `pnpm action db-query --sql "SELECT count(*) FROM <table>"` pour chacune

### Socle applicatif

- [X] T021 Étendre `app/hooks/use-navigation-state.ts` : `NavigationState` porte `view` (`list` | `video` | `calendar`), `videoId`, `tab` (`map` | `markers` | `prep` | `experiments` | `publication`), `step`. Étendre `viewForPath` et `pathForView` — ne pas les remplacer
- [X] T022 Écrire `actions/view-screen.ts` avec `http: false`, lisant `readAppState("navigation")` et `readAppState("selection")` depuis `@agent-native/core/application-state`, et chargeant la donnée correspondant à l'écran courant
- [X] T023 Écrire `actions/navigate.ts` acceptant `{ view, videoId?, tab?, step? }`
- [X] T024 Faire passer `pnpm typecheck` — **c'est ici que se tranche** l'origine des opérateurs Drizzle : les importer de `@agent-native/core/db/schema` comme le prescrit la skill `storing-data`, et non de `drizzle-orm` (point ouvert n° 1 de research.md)

**Checkpoint** : le socle est prêt ; les user stories peuvent démarrer en parallèle.

---

## Phase 3 : User Story 1 — Structurer le récit sur la carte narrative (P1) 🎯 MVP

**But** : passer d'une vidéo vide à une carte narrative renseignée, avec couverture par
acte et courbe émotionnelle.

**Test indépendant** : créer une vidéo, renseigner trois étapes sur deux actes, recharger
la page — les notes sont là, la couverture par acte a changé, la courbe se trace.

- [X] T025 [P] [US1] Écrire `actions/create-video.ts` — crée la vidéo **et** le `stage_event` initial (`from_stage: null`, `to_stage: "idea"`), estampille `owner_email` et `org_id` depuis le contexte
- [X] T026 [P] [US1] Écrire `actions/get-video.ts` en `http: { method: "GET" }` — erreur nommée si la vidéo est introuvable ou hors accès, jamais un objet vide (Principe IV)
- [X] T027 [P] [US1] Écrire `actions/update-video.ts` — **rejette** toute tentative de modifier `stage` avec un message renvoyant vers `move-stage`
- [X] T028 [P] [US1] Écrire `actions/archive-video.ts` — archivage logique réversible via `archived_at`, aucune suppression physique
- [X] T029 [US1] Écrire `actions/get-story-map.ts` en GET — renvoie **toujours les 12 étapes**, y compris celles sans ligne en base, avec `acts`, `steps`, `curve`, `coverage`. Titres et textes viennent de `shared/hero-journey.ts`, pas de la base
- [X] T030 [US1] Écrire `actions/set-beat.ts` — upsert sur `(video_id, step)`, `intensity` bornée 0–100 et rejetée hors bornes, renvoie `isCovered` dans sa réponse
- [X] T031 [P] [US1] Test unitaire dans `tests/unit/story-map.test.ts` : une vidéo sans aucun beat renvoie 12 étapes avec `isCovered: false` ; un beat avec intensité seule reste non couvert
- [X] T032 [US1] Écrire `actions/list-videos.ts` en GET — carte par vidéo avec `coverage` calculée par `shared/coverage.ts`
- [X] T033 [US1] Créer la route `app/routes/_index.tsx` — liste des vidéos, chaque carte montrant titre, étape de production et couverture narrative
- [X] T034 [US1] Créer la route `app/routes/video.$id.tsx` avec ses 5 onglets, **`map` par défaut**, câblée sur l'état de navigation de T021
- [X] T035 [US1] Construire l'onglet *Carte* dans `app/components/story-map/` — 3 bandeaux d'actes colorés, 12 cases, panneau d'étape dépliable affichant définition, conseil de montage et exercice depuis le référentiel
- [X] T036 [US1] Tracer la courbe émotionnelle avec **Recharts** (déjà dépendance de `@agent-native/core` — n'ajouter aucune bibliothèque) dans `app/components/story-map/emotion-curve.tsx`
- [X] T037 [US1] Afficher la relecture finale (4 points de `FINAL_REVIEW`) en pied de l'onglet *Carte* — bande d'affichage, sans table ni écran dédié
- [X] T038 [US1] Brancher `useDbSync` pour que l'écriture d'un beat par l'agent mette la case à jour **sans rafraîchissement** (scénario V9 du quickstart)

**Checkpoint** : US1 est complète et testable seule. C'est le MVP.

---

## Phase 4 : User Story 2 — Tenir le carnet de marqueurs (P2)

**But** : consigner les passages des rushes avec timecodes, les rattacher aux étapes, les
réordonner narrativement, les exporter.

**Test indépendant** : poser cinq marqueurs dont un sans étape, les réordonner contre
l'ordre chronologique, recharger — l'ordre narratif tient et le tri par timecode reste
chronologique.

- [X] T039 [P] [US2] Écrire `actions/list-markers.ts` en GET — paramètre `order` (`narrative` par défaut | `timecode`), renvoie `unassignedCount`
- [X] T040 [P] [US2] Écrire `actions/upsert-marker.ts` — sans `markerId`, place le marqueur en fin d'ordre narratif ; rejette `end_ms < start_ms` avec un message explicite (contrainte data-model.md : « `end_ms IS NULL OR end_ms >= start_ms`, vérifiée côté action avec un message clair plutôt que par une contrainte SQL muette »)
- [X] T041 [P] [US2] Écrire `actions/delete-marker.ts` — suppression physique assumée
- [X] T042 [P] [US2] Écrire `actions/assign-marker-step.ts` — accepte `step: number | null`, `null` détachant explicitement ; n'écrase aucun autre champ de la ligne
- [X] T043 [US2] Écrire `actions/reorder-markers.ts` — **rejette** une liste qui n'est pas exactement l'ensemble des marqueurs de la vidéo ; une liste partielle produirait un ordre silencieusement faux
- [X] T044 [US2] Écrire `actions/export-markers.ts` en GET — renvoie `{ content, rowCount, truncated, format: "csv" }` **inline**, sans stockage externe (research.md, décision 4). Colonnes : `ordre, etape, titre_etape, intitule, rush, debut_ms, fin_ms, debut_tc, fin_tc, sensation_visee, essai_montage`. `maxRows` par défaut 5000
- [X] T045 [US2] Dans `actions/export-markers.ts`, neutraliser l'injection de formule : préfixer d'une apostrophe toute cellule commençant par `=`, `+`, `-` ou `@`
- [X] T046 [P] [US2] Tests unitaires dans `tests/unit/export-markers.test.ts` : une cellule commençant par `=` sort préfixée ; les virgules et guillemets dans un intitulé sont correctement échappés ; l'ordre `narrative` diffère de `timecode` sur un jeu volontairement désordonné
- [X] T047 [US2] Construire l'onglet *Marqueurs* dans `app/components/markers/` — tableau éditable, bascule de tri narratif/timecode, réordonnancement, marqueurs sans étape visibles et comptés
- [X] T048 [US2] Câbler le bouton d'export : l'action renvoie le contenu, le client construit un `Blob` et déclenche le téléchargement
- [X] T049 [US2] Afficher les marqueurs rattachés dans le panneau d'étape de l'onglet *Carte* (jonction avec US1, sans casser son indépendance)

**Checkpoint** : US1 et US2 fonctionnent chacune de leur côté.

---

## Phase 5 : User Story 3 — Remplir la fiche de préparation (P3)

**But** : répondre aux cinq questions de préparation avant de monter.

**Test indépendant** : répondre aux cinq questions, recharger — les réponses sont là ; une
clé inventée est rejetée avec la liste des clés valides.

- [X] T050 [P] [US3] Écrire `actions/get-prep-sheet.ts` en GET — renvoie les 5 questions du référentiel avec leur réponse ou `null`, plus `answeredCount`
- [X] T051 [US3] Écrire `actions/answer-prep-question.ts` — upsert sur `(video_id, question_key)` ; une `questionKey` hors des 5 clés connues est **rejetée avec la liste des clés valides**, jamais insérée
- [X] T052 [P] [US3] Test unitaire dans `tests/unit/prep-sheet.test.ts` : clé inconnue rejetée ; deux réponses successives sur la même clé donnent une seule ligne
- [X] T053 [US3] Construire l'onglet *Préparation* dans `app/components/prep/` — les 5 questions avec leur libellé issu du référentiel, saisie longue, indicateur de complétion

**Checkpoint** : US1, US2 et US3 fonctionnent indépendamment.

---

## Phase 6 : User Story 4 — Diagnostiquer la structure et transformer un retour en essai (P4)

**But** : fermer la boucle observation → hypothèse → essai → verdict.

**Test indépendant** : sur une vidéo dont l'acte II est vide, demander un diagnostic —
l'agent identifie l'acte sous-couvert en citant la règle et propose de créer un essai,
sans inventer de contenu narratif.

- [X] T054 [P] [US4] Écrire `actions/list-experiments.ts` en GET — filtres `status`, `source`, `step` ; renvoie `openCount` et `testingCount`
- [X] T055 [P] [US4] Écrire `actions/create-experiment.ts` — `symptomKey` accepté **seulement** si `source === "diagnostic"` et s'il appartient aux 5 symptômes du référentiel
- [X] T056 [US4] Écrire `actions/resolve-experiment.ts` — passer à `kept` ou `discarded` **exige** un `verdictNote` ; si un autre essai de la même vidéo est déjà `testing`, joindre un avertissement rappelant « une seule chose à la fois » (FR-014) — avertissement, pas blocage
- [X] T057 [US4] Écrire `actions/diagnose-structure.ts` en GET — applique les règles de la méthode : acte sous-couvert, climax sans enjeu lisible en amont, fin déconnectée de la question de départ, courbe plate, marqueurs orphelins en nombre. **Renvoie des observations, jamais un correctif tout fait**
- [X] T058 [P] [US4] Test unitaire dans `tests/unit/diagnose.test.ts` : une carte avec l'acte II vide déclenche la règle « acte sous-couvert » ; une carte complète ne déclenche rien ; clore un essai sans verdict est refusé
- [X] T059 [US4] Construire l'onglet *Essais* dans `app/components/experiments/` — les 5 symptômes en boutons créant un essai pré-rempli, saisie libre pour le roasting, liste des essais par statut
- [X] T060 [US4] Afficher l'avertissement « une seule chose à la fois » dans l'interface quand plus d'un essai est `testing` sur la même vidéo

**Checkpoint** : la boucle d'amélioration est fermée.

---

## Phase 7 : User Story 5 — Suivre l'avancement de production et les échéances (P5)

**But** : savoir où en est chaque vidéo et ce qui traîne.

**Test indépendant** : faire avancer une vidéo, reculer son `stage_changed_at` au-delà de
14 jours — elle apparaît comme bloquée ; archivée ou publiée, elle n'y apparaît pas.

- [X] T061 [P] [US5] Écrire `actions/move-stage.ts` — **seul chemin** vers `videos.stage` : écrit le `stage_event`, met à jour `stage_changed_at`, autorise le retour en arrière, rejette un passage vers l'étape déjà courante
- [X] T062 [P] [US5] Écrire `actions/list-blocked.ts` en GET — `thresholdDays` par défaut `BLOCKED_THRESHOLD_DAYS` ; exclut les vidéos archivées et publiées ; `isBlocked` **dérivé à la lecture**, jamais persisté
- [X] T063 [P] [US5] Écrire `actions/upsert-publication.ts` — `platform` en texte libre, aucune liste fermée
- [X] T064 [P] [US5] Écrire `actions/record-metrics.ts` — upsert sur `(publication_id, measured_on)` ; `retention_pct` bornée 0–100
- [X] T065 [P] [US5] Test unitaire dans `tests/unit/blocked.test.ts` : à 13 jours non bloquée, à 15 jours bloquée, publiée jamais bloquée, archivée jamais bloquée
- [X] T066 [US5] Ajouter le badge de blocage et l'étape de production aux cartes de `app/routes/_index.tsx`
- [X] T067 [US5] Créer la route `app/routes/calendar.tsx` — échéances à venir et dépassées
- [X] T068 [US5] Construire l'onglet *Publication* dans `app/components/publication/` — SEO, cibles, relevés manuels de performance

**Checkpoint** : les cinq user stories sont livrées.

---

## Phase 8 : Polish et transverse

- [X] T069 [P] Écrire la skill `.agents/skills/voyage-du-heros/SKILL.md` — court, avec les règles de courbe (pic à l'étape 8, respiration à la 9, relance à la 11). Le détail des 12 étapes va dans `references/`, lu à la demande
- [X] T070 [P] Écrire la skill `.agents/skills/diagnostic-timeline/SKILL.md` — les 5 symptômes → essais, et la règle « change une seule chose à la fois »
- [X] T071 [P] Écrire la skill `.agents/skills/roasting/SKILL.md` — transformer une observation en hypothèse testable ; ne jamais prendre une solution proposée pour un diagnostic
- [X] T072 Compléter `AGENTS.md` : tableau des 25 actions, clés d'état applicatif (`view`, `videoId`, `tab`, `step`), index des 3 skills, règle anti-fabrication
- [X] T073 [P] Vérifier que chacune des 23 actions métier répond en CLI : `pnpm action <nom> [...]`
- [X] T074 Exécuter les 10 scénarios de validation de quickstart.md — **à l'écran**, pas seulement en CLI
- [X] T075 Passer les portes : `pnpm typecheck`, `pnpm test`, `pnpm agent-native:doctor`
- [X] T076 [P] Relire les messages d'erreur utilisateur : chacun doit dire quoi corriger, en français, sans jargon technique
- [X] T077 Vérifier qu'aucune clé d'API, jeton, URL de webhook ou secret n'est codé en dur (contrainte de la constitution)

---

## Dépendances et ordre d'exécution

### Entre phases

- **Phase 1 (Setup)** : aucune dépendance
- **Phase 2 (Foundational)** : dépend de la Phase 1 — **bloque toutes les user stories**
- **Phases 3 à 7 (user stories)** : dépendent de la Phase 2, puis peuvent avancer en parallèle
- **Phase 8 (Polish)** : dépend des stories souhaitées

### Entre user stories

- **US1 (P1)** : indépendante après la Phase 2
- **US2 (P2)** : indépendante. T049 la relie visuellement à US1, mais US2 reste testable seule
- **US3 (P3)** : totalement indépendante
- **US4 (P4)** : `diagnose-structure` **lit** la carte narrative — testable avec une carte créée à la main, mais n'a de sens qu'après US1
- **US5 (P5)** : indépendante

### Dépendances internes notables

- T008 avant T029, T035 (le référentiel avant tout ce qui l'affiche)
- T011 avant T029, T032 (la règle de couverture avant ses trois appelants)
- T014–T018 avant toute action (schéma et migrations avant les lectures)
- T021 avant T033, T034 (l'état de navigation avant les routes)
- T040 avant T043 (des marqueurs avant de les réordonner)
- T044 avant T045, T048 (l'export avant son durcissement et son bouton)

---

## Opportunités de parallélisation

**Phase 2** — T009, T010, T011, T012, T013 en parallèle après T007/T008.

**Phase 3 (US1)** — les quatre actions de vidéo sont dans quatre fichiers distincts :

```bash
pnpm action create-video   # T025
pnpm action get-video      # T026
pnpm action update-video   # T027
pnpm action archive-video  # T028
```

**Phase 4 (US2)** — T039, T040, T041, T042 en parallèle ; T043 et T044 ensuite.

**Phase 7 (US5)** — T061, T062, T063, T064, T065 tous parallélisables.

**Phase 8** — les trois skills (T069, T070, T071) s'écrivent en parallèle.

**Entre équipes** — une fois la Phase 2 finie, cinq personnes peuvent prendre une story
chacune sans se marcher dessus : les fichiers d'actions, de composants et de tests sont
disjoints d'une story à l'autre.

---

## Stratégie de livraison

### MVP d'abord

1. Phase 1 (Setup)
2. Phase 2 (Foundational) — **critique, bloque tout**
3. Phase 3 (US1)
4. **Arrêt et validation** : scénarios V1, V2 et V9 du quickstart
5. À ce stade le produit fait déjà ce que rien d'autre ne fait — structurer un récit

### Livraison incrémentale

| Incrément | Ajoute | Validé par |
| --- | --- | --- |
| MVP | la carte narrative | V1, V2, V9 |
| + US2 | le carnet et l'export | V3, V4 |
| + US3 | la fiche de préparation | V5 |
| + US4 | diagnostic et essais | V6, V7 |
| + US5 | production et échéances | V8 |
| + Polish | skills, doc agent | V10 |

---

## Notes

- `[P]` = fichiers différents, aucune dépendance en cours
- Committer par tâche ou par groupe logique cohérent ; ne pousser vers aucun remote sans autorisation explicite
- Une tâche n'est finie qu'après **relecture** de ce qu'elle a écrit — l'affichage optimiste n'est pas une preuve (Principe IV)
- Avant d'implémenter une capacité du framework, consulter `node_modules/@agent-native/core/docs/` — ne jamais deviner
