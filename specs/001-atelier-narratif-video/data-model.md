# Phase 1 — Modèle de données : Atelier narratif vidéo

**Branche** : `001-atelier-narratif-video` | **Date** : 2026-09-28
**Sources** : [spec.md](./spec.md) (entités clés, FR-001 à FR-020), [research.md](./research.md) (décisions 2 et 6)

Neuf tables, toutes en PostgreSQL via Drizzle, déclarées dans `server/db/schema.ts` avec
les helpers de `@agent-native/core/db/schema`. Aucune donnée binaire : les visuels et les
rushes sont référencés par URL ou par identifiant externe, jamais stockés.

---

## Ce qui n'est pas en base

Le contenu de la méthode — les 12 étapes du voyage du héros, leur définition, le conseil
de montage, l'exercice, les films cités, les 3 actes, les 5 questions de préparation, les
5 symptômes de diagnostic, les 4 points de relecture finale — est du **référentiel figé**,
pas de la donnée utilisateur. Il vit dans `shared/hero-journey.ts` en constantes
TypeScript.

Conséquence directe : une étape narrative n'a pas de ligne « définition » en base. La
table `story_beats` ne stocke que ce que *l'utilisateur* en fait pour *sa* vidéo. Un
numéro d'étape (1 à 12) est la clé de jointure entre la base et le référentiel.

---

## Conventions communes

| Convention | Détail |
| --- | --- |
| Identifiants | `text`, générés côté serveur, clé primaire |
| Propriété | `ownableColumns()` sur les tables possédées → `owner_email`, `org_id` |
| Horodatage | `created_at`, `updated_at` en **`text`** avec `.default(now())` — convention des schémas first-party du framework ; l'application écrit des chaînes ISO-8601 UTC, lexicographiquement ordonnées donc comparables |
| Timecodes | **entiers en millisecondes**, jamais de chaîne `HH:MM:SS` |
| Étape narrative | entier 1–12, contrainte applicative, jamais de texte libre |
| Suppression | logique (`archived_at`) sur `videos` ; physique sur les tables filles |
| Cascade | toute table fille porte `video_id` et est lue à travers sa vidéo |
| Portée locataire | **toute table** porte `owner_email` / `org_id` / `visibility` via `ownableColumns()` — l'accès applicatif passe par la vidéo parente, mais les outils SQL bruts filtrent table par table |

Les migrations sont manuscrites dans `server/plugins/db.ts` via `runMigrations()`, table
de suivi `indagis_studio_migrations`, chaque entrée portant un `name:` unique
(décision 2). Aucun `DROP`, aucun renommage, aucun `NOT NULL` sans `DEFAULT`.

---

## 1. `videos` — le projet vidéo

L'entité racine. Tout le reste s'y rattache.

| Colonne | Type | Notes |
| --- | --- | --- |
| `id` | text, PK | |
| `title` | text, non nul | |
| `kind` | text, défaut `"long"` | `long` \| `short` — dérivé court |
| `parent_video_id` | text, nullable | renseigné pour un `short` issu d'une vidéo longue |
| `stage` | text, défaut `"idea"` | `idea` → `script` → `shoot` → `edit` → `published` |
| `stage_changed_at` | timestamptz, défaut `now()` | base du calcul de blocage (FR-016) |
| `due_at` | text ISO-8601, nullable | échéance, alimente le calendrier (FR-017) |
| `archived_at` | text ISO-8601, nullable | non nul = archivée, exclue des listes (FR-001) |
| `owner_email`, `org_id` | via `ownableColumns()` | |
| `created_at`, `updated_at` | text ISO-8601 | |

**Règles**
- `stage` ne change **que** par l'action `move-stage`, jamais par `update-video`. C'est ce
  qui garantit qu'un `stage_event` est toujours écrit en regard (FR-015).
- Une vidéo est **bloquée** si `archived_at IS NULL`, `stage <> 'published'`, et
  `stage_changed_at` est antérieur au seuil (14 jours — décision 5). Le calcul est dérivé,
  jamais stocké : un drapeau persisté deviendrait faux au passage du temps.
- `stage_changed_at` est dénormalisé depuis `stage_events` pour que `list-videos` n'ait
  pas à agréger l'historique à chaque appel.

**Index** : `owner_email`, `(org_id, archived_at)`, `due_at`, `parent_video_id`.

---

## 2. `video_shares` — les partages

Créée par `createSharesTable()` du framework, adossée à `videos`. C'est la seule table de
partage du produit (décision 6) : on partage un récit, pas un marqueur.

Inscrite au démarrage via `registerShareableResource({ type: "studio-video", … })`, ce qui
fait passer les lectures par `accessFilter()` et les écritures par `assertAccess()` sans
que chaque action ait à le recoder.

---

## 3. `stage_events` — l'historique de production

Une ligne par changement d'étape. Append-only : jamais modifiée, jamais supprimée.

| Colonne | Type | Notes |
| --- | --- | --- |
| `id` | text, PK | |
| `video_id` | text, non nul | |
| `from_stage` | text, nullable | nul à la création de la vidéo |
| `to_stage` | text, non nul | |
| `note` | text, nullable | |
| `occurred_at` | timestamptz, défaut `now()` | |

**Index** : `(video_id, occurred_at desc)`.

---

## 4. `story_beats` — les 12 étapes, par vidéo

Le cœur du produit. Une ligne par étape *renseignée* — l'absence de ligne signifie
« étape vide », ce qui évite de créer douze lignes creuses à chaque nouvelle vidéo.

| Colonne | Type | Notes |
| --- | --- | --- |
| `id` | text, PK | |
| `video_id` | text, non nul | |
| `step` | integer, non nul | 1–12 |
| `note` | text, nullable | ce que l'utilisateur écrit pour cette étape |
| `intensity` | integer, nullable | 0–100, alimente la courbe émotionnelle (FR-004) |
| `status` | text, défaut `"drafted"` | `drafted` \| `locked` |
| `created_at`, `updated_at` | text ISO-8601 | |

**Règle de couverture (FR-006, non négociable)** : une étape compte comme **couverte**
seulement si `note` est non vide après trim. Une `intensity` seule ne suffit pas —
déplacer un curseur n'est pas structurer un récit. Cette règle vit au même endroit pour
toutes les surfaces, dans une fonction partagée, pour que l'écran, l'agent et l'export ne
puissent pas diverger.

**Contrainte** : `uniqueIndex` sur `(video_id, step)` — une étape, une ligne.
**Index** : `video_id`.

---

## 5. `markers` — le carnet de marqueurs

Le tableau de la page 25 de la méthode.

| Colonne | Type | Notes |
| --- | --- | --- |
| `id` | text, PK | |
| `video_id` | text, non nul | |
| `label` | text, non nul | l'intitulé du passage |
| `rush_name` | text, nullable | le fichier ou la prise d'origine |
| `start_ms` | integer, non nul | |
| `end_ms` | integer, nullable | un marqueur peut être un point, pas un segment |
| `step` | integer, **nullable** | 1–12 ; nul = pas encore rattaché |
| `intended_feeling` | text, nullable | la sensation visée |
| `edit_attempt` | text, nullable | ce qui a été tenté au montage |
| `sort_order` | integer, non nul | **l'ordre narratif** |
| `external_ref` | text, nullable | identifiant d'un outil tiers, réservé |
| `created_at`, `updated_at` | text ISO-8601 | |

**Pourquoi `step` est nullable** : la méthode admet explicitement qu'une étape manque.
Forcer un rattachement obligerait l'utilisateur à mentir sur son propre matériel.

**Pourquoi `sort_order` existe séparément de `start_ms`** : c'est la colonne qui porte
l'ordre *narratif*, lequel diffère de l'ordre chronologique — c'est précisément l'objet
d'un remontage (FR-008). Un tri par timecode seul rendrait la fonctionnalité impossible à
exprimer.

**Contrainte** : `end_ms IS NULL OR end_ms >= start_ms`, vérifiée côté action avec un
message clair plutôt que par une contrainte SQL muette.
**Index** : `video_id`, `(video_id, step)`, `(video_id, sort_order)`.

---

## 6. `prep_answers` — la fiche de préparation

Les cinq questions de la page 24. Les clés sont fixes et définies dans
`shared/hero-journey.ts` ; la base ne stocke que la réponse.

| Colonne | Type | Notes |
| --- | --- | --- |
| `id` | text, PK | |
| `video_id` | text, non nul | |
| `question_key` | text, non nul | une des 5 clés du référentiel |
| `answer` | text, nullable | |
| `updated_at` | text ISO-8601 | |

**Contrainte** : `uniqueIndex` sur `(video_id, question_key)`.
Une `question_key` inconnue est **rejetée** par l'action, pas insérée silencieusement.

---

## 7. `experiments` — la boucle observation → hypothèse → essai

Diagnostic (page 26) et roasting (page 27) partagent une seule table : ce sont deux
sources d'entrée pour la même boucle, pas deux mécaniques différentes.

| Colonne | Type | Notes |
| --- | --- | --- |
| `id` | text, PK | |
| `video_id` | text, non nul | |
| `step` | integer, nullable | 1–12, si l'essai vise une étape précise |
| `source` | text, non nul | `diagnostic` \| `roasting` \| `self` |
| `symptom_key` | text, nullable | renseigné quand `source = diagnostic` |
| `observation` | text, non nul | ce qui a été constaté |
| `hypothesis` | text, nullable | pourquoi, selon l'utilisateur |
| `attempt` | text, nullable | ce qui a été changé |
| `status` | text, défaut `"todo"` | `todo` \| `testing` \| `kept` \| `discarded` |
| `verdict_note` | text, nullable | le résultat observé |
| `created_at`, `updated_at` | text ISO-8601 | |

**Règle de la méthode (FR-014)** : une seule chose change entre deux essais. Le modèle ne
peut pas l'imposer — c'est une discipline, pas une contrainte d'intégrité. Elle est donc
portée par l'interface (un avertissement quand plus d'un essai est `testing` sur la même
vidéo) et par la skill `diagnostic-timeline`, pas par le schéma.

**Index** : `video_id`, `(video_id, status)`.

---

## 8. `publications` — les cibles de diffusion

| Colonne | Type | Notes |
| --- | --- | --- |
| `id` | text, PK | |
| `video_id` | text, non nul | |
| `platform` | text, non nul | texte libre — aucun connecteur, aucune liste imposée |
| `seo_title`, `seo_description` | text, nullable | |
| `keywords` | text, nullable | séparés par virgules |
| `url` | text, nullable | renseignée après publication |
| `status` | text, défaut `"planned"` | `planned` \| `published` |
| `published_at` | text ISO-8601, nullable | |

**Index** : `video_id`, `(video_id, platform)`.

---

## 9. `metrics` — les relevés de performance

Saisie **manuelle** (FR-018) : aucun connecteur de plateforme n'existe dans le framework,
et FR-019 interdit d'en exiger un.

| Colonne | Type | Notes |
| --- | --- | --- |
| `id` | text, PK | |
| `publication_id` | text, non nul | |
| `video_id` | text, non nul | dupliqué pour filtrer sans jointure |
| `measured_on` | text `AAAA-MM-JJ`, non nul | |
| `views`, `likes`, `comments` | integer, nullable | |
| `retention_pct` | integer, nullable | 0–100 |
| `created_at` | text ISO-8601 | |

**Contrainte** : `uniqueIndex` sur `(publication_id, measured_on)` — un relevé par jour et
par publication ; un second relevé le même jour écrase le précédent plutôt que d'empiler
des doublons.

---

## Relations

```text
videos ─┬─< video_shares
        ├─< stage_events
        ├─< story_beats        (unique: video_id + step)
        ├─< markers            (step nullable → référentiel 1..12)
        ├─< prep_answers       (unique: video_id + question_key)
        ├─< experiments        (step nullable)
        └─< publications ──< metrics
        └─< videos             (parent_video_id, dérivés courts)
```

---

## Transitions d'état

**Étape de production** (`videos.stage`) — séquence fixe, avancement d'un cran à la fois
ou retour en arrière autorisé (un montage peut renvoyer à l'écriture) :

```text
idea → script → shoot → edit → published
```

Chaque transition écrit un `stage_event`, met à jour `stage_changed_at`, et n'est
accessible que par `move-stage`.

**Statut d'un essai** (`experiments.status`) :

```text
todo → testing → kept
            └──→ discarded
```

Un essai `kept` ou `discarded` porte un `verdict_note` ; l'action le demande plutôt que de
clore un essai sans trace de ce qui a été appris.

---

## Ce que le modèle ne couvre pas, sciemment

- **La relecture finale (page 28)** — les quatre points de contrôle sont affichés depuis
  le référentiel en pied de l'onglet *Carte*, mais aucune exigence de la spec ne demande
  d'en persister l'état. Aucune table n'est créée pour l'instant ; l'ajouter plus tard
  reste une migration purement additive.
- **Les ressources et fichiers** — la spec ne définit aucune entité de ce type, et la
  constitution interdit le stockage de binaires. Rien n'est prévu.
- **Le transcript ou les rushes eux-mêmes** — hors périmètre (captation et montage
  exclus par le Principe V). `markers.external_ref` laisse la porte ouverte sans rien
  imposer.


---

## Écarts constatés à l'implémentation

Deux points ont été corrigés par rapport à la première rédaction, après lecture des
schémas first-party du framework et passage de `pnpm agent-native:doctor` :

1. **Les horodatages sont des colonnes `text`, pas `timestamptz`.** C'est la convention
   du framework (`@agent-native/core/dist/dashboard-storage/schema.js` et la table de
   partages générée par `createSharesTable()` utilisent toutes deux
   `text("created_at").notNull().default(now())`). L'application écrit systématiquement
   `new Date().toISOString()` : des chaînes ISO-8601 UTC, lexicographiquement ordonnées,
   donc triables et comparables sans piège.

2. **Toutes les tables filles portent la portée locataire**, pas seulement `videos`. Le
   garde `db-tool-scoping` du doctor signalait que `stage_events`, `story_beats`,
   `markers`, `publications` et `metrics` n'avaient « aucune portée `owner_email` /
   `org_id` ». L'accès applicatif passait bien par la vidéo parente, mais les outils SQL
   bruts (`db-query`, `db-exec`, `db-patch`) filtrent **table par table** : sans ces
   colonnes, ils auraient franchi la frontière entre utilisateurs. `ownableColumns()` a
   donc été ajouté aux sept tables filles (migration `studio-tenant-scope-on-child-tables`,
   purement additive), et chaque insertion estampille le propriétaire depuis le contexte
   de requête. Le modèle de partage ne change pas : une seule ressource partageable, la
   vidéo.
