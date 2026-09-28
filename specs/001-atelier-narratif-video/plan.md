# Implementation Plan: Atelier narratif vidéo

**Branch**: `001-atelier-narratif-video` | **Date**: 2026-09-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-atelier-narratif-video/spec.md`

## Summary

Construire Indagis Studio comme **application Agent-Native autonome** dont l'écran
central est la carte narrative des 12 étapes du voyage du héros. L'approche technique
retenue : scaffolder l'app standalone depuis le template `chat` du framework (qui livre
déjà auth, chat agent, live sync et application state), puis ajouter un modèle de
données de 9 tables PostgreSQL, une vingtaine d'actions `defineAction()` et trois
routes React. Le contenu figé de la méthode (12 étapes, 5 questions, 5 symptômes) vit
dans un module TypeScript partagé, pas en base — c'est du référentiel, pas de la donnée
utilisateur.

## Technical Context

**Language/Version**: TypeScript, Node.js 22.22+ (exigence du framework Agent-Native)

**Primary Dependencies**: `@agent-native/core` (runtime : actions, base, auth, live sync,
chat agent), Drizzle ORM (fourni par le core), React 19, React Router v8 (routage par
fichiers), shadcn/ui + `@tabler/icons-react` (stack UI imposée par le framework)

**Storage**: PostgreSQL — PGlite en développement local (`data/pglite`), base persistante
via `DATABASE_URL` en déploiement

**Testing**: Vitest (`pnpm test`), plus les commandes de vérification du framework
`pnpm typecheck` et `pnpm agent-native:doctor`

**Target Platform**: application web servie par Nitro ; aucun usage de `child_process`
ni d'adaptateur CLI n'étant prévu, toutes les cibles Nitro restent ouvertes (Node,
Docker, Vercel, Netlify, Render, Koyeb…). Le choix de l'hôte est différé hors de cette
fonctionnalité.

**Project Type**: application web Agent-Native **standalone** (une seule app, pas de
workspace multi-apps)

**Performance Goals**: retour d'interface visé à 100 ms, jamais au-delà de 400 ms, avec
accusé de réception avant tout travail réseau — convention du framework. Mutations
optimistes par défaut ; les écritures de l'agent apparaissent dans l'UI sans
rafraîchissement manuel via `useDbSync`.

**Constraints**:
- Aucun compte ni clé d'API externe requis pour utiliser l'application (FR-019)
- Migrations additives et rétrocompatibles uniquement, chacune portant un `name:` unique
- Aucun binaire en base : seules des URL ou handles de stockage sont persistés
- Aucun appel LLM en ligne — tout passe par le pont de chat agent
- Trois écrans de premier niveau maximum (FR-020)

**Scale/Scope**: un créateur ou une petite équipe par récit ; 3 routes, 5 onglets dans la
fiche vidéo, 9 tables, 23 actions métier, 5 user stories, 20 exigences fonctionnelles.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Évaluation contre la constitution v1.0.0 :

| Principe | Verdict | Justification |
| --- | --- | --- |
| **I. Structure narrative d'abord** | ✅ PASS | L'onglet *Carte* est l'onglet par défaut de la fiche vidéo ; le suivi de production est relégué à l'onglet *Publication* et à la vue calendrier. Aucune décision du plan ne place la production devant la narration. |
| **II. Une action, toutes les surfaces** | ✅ PASS | Chaque capacité passe par `defineAction()`. Aucune route `/api/*` n'est prévue — y compris pour l'export CSV, résolu côté client à partir de données structurées renvoyées par une action (voir research.md, décision 4). |
| **III. Le contrat des quatre zones** | ✅ PASS | Chaque user story livre UI + action + mise à jour de la documentation agent + clé d'application state. `app/hooks/use-navigation-state.ts` est étendu avec `videoId` et `tab` pour que l'agent sache ce qui est affiché. |
| **IV. Honnêteté et vérification** | ✅ PASS | Inscrit comme règle permanente dans `AGENTS.md` ; `quickstart.md` impose une vérification par relecture après chaque écriture dans les scénarios de validation. |
| **V. Simplicité de l'interface** | ✅ PASS | Exactement 3 routes. Les 5 sections de la fiche vidéo sont des onglets **à l'intérieur d'une seule route**, pas des écrans de premier niveau. Captation, montage, publication automatisée et exports EDL/FCPXML restent hors périmètre. |

**Contraintes techniques** : le plan respecte l'obligation de base PostgreSQL via Drizzle,
l'interdiction des API Node spécifiques côté serveur, l'absence d'appel LLM en ligne, et
l'obligation de consulter `node_modules/@agent-native/core/docs/` avant implémentation.

**Résultat du gate** : passé sans violation. La section *Complexity Tracking* reste donc
vide.

## Project Structure

### Documentation (this feature)

```text
specs/001-atelier-narratif-video/
├── plan.md              # Ce fichier (sortie /speckit-plan)
├── research.md          # Sortie Phase 0
├── data-model.md        # Sortie Phase 1
├── quickstart.md        # Sortie Phase 1
├── contracts/           # Sortie Phase 1
│   └── actions.md
├── checklists/
│   └── requirements.md  # Sortie /speckit-specify
└── tasks.md             # Sortie /speckit-tasks — NON créé par /speckit-plan
```

### Source Code (repository root)

L'application Agent-Native est scaffoldée **directement à la racine du dépôt**, aux côtés
de l'outillage Spec Kit et BMAD qui occupent déjà leurs propres dossiers de premier
niveau. Pas de sous-dossier applicatif ni de double imbrication.

```text
indagis-studio/
├── actions/                          # Une action = une capacité, toutes surfaces
│   ├── list-videos.ts, get-video.ts, create-video.ts, update-video.ts, archive-video.ts
│   ├── move-stage.ts, list-blocked.ts
│   ├── get-story-map.ts, set-beat.ts
│   ├── list-markers.ts, upsert-marker.ts, delete-marker.ts,
│   │   assign-marker-step.ts, reorder-markers.ts, export-markers.ts
│   ├── get-prep-sheet.ts, answer-prep-question.ts
│   ├── list-experiments.ts, create-experiment.ts, resolve-experiment.ts,
│   │   diagnose-structure.ts
│   ├── upsert-publication.ts, record-metrics.ts
│   └── view-screen.ts, navigate.ts   # standards du framework
├── server/
│   ├── db/
│   │   ├── schema.ts                 #  9 tables Drizzle (helpers @agent-native/core/db/schema)
│   │   └── index.ts                  # createGetDb(schema) + registerShareableResource("studio-video")
│   └── plugins/
│       ├── auth.ts, agent-chat.ts    # fournis par le scaffold
│       └── db.ts                     # runMigrations([...]) — additives, nommées
├── shared/
│   └── hero-journey.ts               # 12 étapes, 3 actes, 5 questions, 5 symptômes, relecture finale
├── app/
│   ├── routes/
│   │   ├── _index.tsx                # Route 1 — liste des vidéos + couverture narrative
│   │   ├── video.$id.tsx             # Route 2 — fiche vidéo, 5 onglets
│   │   └── calendar.tsx              # Route 3 — échéances
│   ├── components/                   # primitives shadcn/ui + composants Studio
│   └── hooks/use-navigation-state.ts # étendu : videoId, tab
├── .agents/skills/
│   ├── voyage-du-heros/              # SKILL.md + references/ (détail des 12 étapes)
│   ├── diagnostic-timeline/SKILL.md
│   └── roasting/SKILL.md
├── AGENTS.md                         # déjà écrit — contrat agent du projet
├── specs/ .specify/ _bmad/ .claude/  # outillage Spec Kit + BMAD, déjà en place
└── package.json, agent-native.config.ts, agent-native.json
```

**Structure Decision**: application Agent-Native standalone scaffoldée à la racine du
dépôt (voir research.md, décision 1). Ce choix garde un seul `package.json` applicatif,
évite la double imbrication de dossiers, et laisse coexister au même niveau les dossiers
déjà présents de Spec Kit (`specs/`, `.specify/`) et de BMAD (`_bmad/`), qui n'entrent
pas en conflit avec ceux du framework (`actions/`, `server/`, `app/`, `shared/`).

## Constitution Check — réévaluation après conception

*Deuxième passage du gate, exigé après la Phase 1.*

| Principe | Verdict | Ce que la conception a effectivement produit |
| --- | --- | --- |
| **I. Structure narrative d'abord** | ✅ PASS | `get-story-map` est l'action la plus riche du contrat ; l'onglet *Carte* est l'onglet par défaut. Les deux actions de production (`move-stage`, `list-blocked`) et les deux de publication restent en périphérie. Aucune table de suivi ne conditionne le travail narratif. |
| **II. Une action, toutes les surfaces** | ✅ PASS | 23 actions métier, zéro route `/api/*`. Le point qui aurait pu casser ce principe — l'export CSV — est résolu par la décision 4 : l'action renvoie le contenu, le client fabrique le fichier. |
| **III. Le contrat des quatre zones** | ✅ PASS | Chaque story a son UI (une route ou un onglet), ses actions, sa documentation (`AGENTS.md` + une des trois skills), et son état applicatif (`videoId`, `tab`, `step`). Le scénario V9 du quickstart teste précisément ce contrat de bout en bout. |
| **IV. Honnêteté et vérification** | ✅ PASS | Inscrit dans les contrats : `get-video` échoue nommément sur une vidéo introuvable au lieu de renvoyer un objet vide ; `resolve-experiment` exige un verdict ; `diagnose-structure` observe sans inventer de correctif. Les dix scénarios de validation imposent une relecture, pas un affichage optimiste. |
| **V. Simplicité de l'interface** | ✅ PASS | Trois routes, cinq onglets à l'intérieur d'une seule d'entre elles. La relecture finale est une bande en pied d'onglet, sans table ni écran. Aucune décision de la Phase 1 n'a créé de quatrième écran. |

**Écart relevé et corrigé** : la première rédaction annonçait 10 tables. La spec ne
définit que neuf entités — il n'y a pas d'entité « ressource » ou « fichier », et la
constitution interdit de stocker des binaires. Le compte a été ramené à 9 dans ce
document plutôt que d'inventer une table pour justifier le chiffre.

**Résultat du second gate** : passé sans violation. *Complexity Tracking* reste vide.

## Artefacts produits

| Phase | Fichier | Contenu |
| --- | --- | --- |
| 0 | [research.md](./research.md) | 6 décisions techniques fondées sur la doc locale, chacune avec rationale et alternatives écartées |
| 1 | [data-model.md](./data-model.md) | 9 tables, conventions, relations, transitions d'état, périmètre exclu |
| 1 | [contracts/actions.md](./contracts/actions.md) | 23 actions métier + 2 standard, entrées/sorties, état applicatif, couverture FR-001→FR-020 |
| 1 | [quickstart.md](./quickstart.md) | scaffold, pièges connus, ordre de construction, 10 scénarios de validation, portes de vérification |

## Complexity Tracking

Aucune violation de la constitution à justifier — cette section reste vide.
