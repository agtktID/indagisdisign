# Phase 1 — Contrats d'actions : Atelier narratif vidéo

**Branche** : `001-atelier-narratif-video` | **Date** : 2026-09-28
**Sources** : [spec.md](../spec.md), [data-model.md](../data-model.md), [research.md](../research.md)

Vingt-cinq actions métier, plus les deux actions standard du framework. Chacune est
définie une seule fois avec `defineAction()` et devient simultanément outil d'agent, hook
React typé, route HTTP, commande CLI et outil MCP/A2A (Principe II). **Aucune route
`/api/*` ne double une action**, export CSV compris.

## Conventions

| Règle | Détail |
| --- | --- |
| Lectures | `http: { method: "GET" }`. La doc précise que « GET actions are auto-marked `readOnly` » — on n'ajoute donc pas `readOnly: true` par-dessus, ce serait redondant. |
| Écritures | POST par défaut. Estampillent `owner_email` et `org_id` depuis le contexte d'exécution, jamais depuis l'entrée. |
| Accès | Garanti par `registerShareableResource("studio-video")` : `accessFilter()` sur les lectures, `assertAccess()` sur les écritures. Aucune action ne recode ce filtrage. |
| Validation | Schémas `zod`. Une entrée invalide produit une erreur nommée, pas un écrasement silencieux. |
| Erreurs | Message actionnable en français, indiquant quoi corriger. Jamais un succès simulé (Principe IV). |
| Identité d'étape | Tout `step` est un entier 1–12 validé contre le référentiel de `shared/hero-journey.ts`. |

---

## Vidéos — 5 actions

### `list-videos` · lecture
**Entrée** : `{ includeArchived?: boolean, stage?: Stage, blockedOnly?: boolean }`
**Sortie** : `{ videos: Array<{ id, title, kind, stage, stageChangedAt, dueAt, coverage: { covered: number, total: 12, byAct: Record<ActId, number> }, isBlocked: boolean }> }`
La couverture est calculée par la fonction partagée de FR-006 — une étape ne compte que si
sa note est non vide. `isBlocked` est dérivé à la lecture, jamais lu depuis une colonne.

### `get-video` · lecture
**Entrée** : `{ videoId: string }`
**Sortie** : la vidéo, sa couverture, son échéance, son dernier `stage_event`, et le
nombre de marqueurs, d'essais ouverts et de réponses de préparation renseignées.
Erreur nommée si la vidéo est introuvable ou hors accès — pas un objet vide.

### `create-video` · écriture
**Entrée** : `{ title: string, kind?: "long" | "short", parentVideoId?: string, dueAt?: string }`
**Sortie** : `{ video }`
Écrit aussi le `stage_event` initial (`from_stage: null`, `to_stage: "idea"`), pour que
l'historique soit complet dès la première ligne.

### `update-video` · écriture
**Entrée** : `{ videoId, title?, kind?, dueAt?: string | null }`
**Ne touche pas à `stage`.** Une tentative de passer `stage` est rejetée avec un message
renvoyant vers `move-stage` — c'est ce qui garantit qu'aucun changement d'étape n'échappe
à l'historique (FR-015).

### `archive-video` · écriture
**Entrée** : `{ videoId, archived?: boolean }`
Archivage logique réversible. Aucune suppression physique : le travail narratif d'un
utilisateur ne disparaît pas sur un clic.

---

## Production — 3 actions

### `move-stage` · écriture
**Entrée** : `{ videoId, toStage: Stage, note?: string }`
**Sortie** : `{ video, event }`
Seul chemin vers `videos.stage`. Écrit le `stage_event`, met à jour `stage_changed_at`.
Le retour en arrière est autorisé (un montage peut renvoyer à l'écriture) ; un saut vers
la même étape est rejeté plutôt qu'enregistré comme un faux mouvement.

### `list-blocked` · lecture
**Entrée** : `{ thresholdDays?: number }` — défaut 14 (décision 5)
**Sortie** : `{ blocked: Array<{ video, daysSinceStageChange }> }`
Exclut les vidéos archivées et publiées.

### `list-stage-events` · lecture
**Entrée** : `{ videoId, limit?: number }` — défaut 50, plafond 200
**Sortie** : `{ events: Array<{ id, fromStage, toStage, note, occurredAt }>, count }`
Du plus récent au plus ancien. Ajoutée après la première passe d'implémentation : `move-stage` écrivait l'historique depuis le début, mais rien ne permettait de le relire, donc l'utilisateur cliquait sans retour visible.

---

## Carte narrative — 2 actions

### `get-story-map` · lecture
**Entrée** : `{ videoId }`
**Sortie** :
```ts
{
  video: { id, title },
  acts: Array<{ id, label, steps: number[], covered: number, total: number }>,
  steps: Array<{
    step: number,           // 1..12
    title: string,          // depuis shared/hero-journey.ts
    note: string | null,
    intensity: number | null,
    status: "empty" | "drafted" | "locked",
    isCovered: boolean,     // règle FR-006
    markers: Array<{ id, label, startMs, endMs, sortOrder }>,
  }>,
  curve: Array<{ step: number, intensity: number | null }>,
  coverage: { covered: number, total: 12 },
}
```
Les douze entrées sont **toujours** renvoyées, y compris les étapes sans ligne en base :
l'absence de donnée est une information, pas un trou dans la réponse. Le titre et le
texte de chaque étape viennent du référentiel partagé, pas de la base.

### `set-beat` · écriture
**Entrée** : `{ videoId, step: number, note?: string, intensity?: number, status?: "drafted" | "locked" }`
Upsert sur `(video_id, step)`. `intensity` est bornée 0–100 et rejetée hors bornes.
Écrire une `intensity` sans `note` est autorisé mais **ne rend pas l'étape couverte** —
la réponse renvoie `isCovered` pour que l'appelant, agent compris, le voie directement.

---

## Carnet de marqueurs — 6 actions

### `list-markers` · lecture
**Entrée** : `{ videoId, step?: number, order?: "narrative" | "timecode" }` — défaut `narrative`
**Sortie** : `{ markers: [...], unassignedCount: number }`

### `upsert-marker` · écriture
**Entrée** : `{ videoId, markerId?, label, rushName?, startMs, endMs?, step?, intendedFeeling?, editAttempt? }`
Sans `markerId`, crée et place le marqueur en fin d'ordre narratif. Rejette
`endMs < startMs` avec un message explicite.

### `delete-marker` · écriture
**Entrée** : `{ markerId }` — suppression physique, les marqueurs sont du matériau de
travail, pas un historique à conserver.

### `assign-marker-step` · écriture
**Entrée** : `{ markerId, step: number | null }`
`null` détache explicitement. Existe séparément d'`upsert-marker` parce que rattacher des
marqueurs à la chaîne est un geste distinct de les éditer, et que l'agent doit pouvoir le
faire sans risquer d'écraser le reste de la ligne.

### `reorder-markers` · écriture
**Entrée** : `{ videoId, orderedMarkerIds: string[] }`
Réécrit `sort_order` dans l'ordre fourni. Rejette la liste si elle n'est pas exactement
l'ensemble des marqueurs de la vidéo — une liste partielle produirait un ordre
silencieusement faux.

### `export-markers` · lecture
**Entrée** : `{ videoId, order?: "narrative" | "timecode", maxRows?: number }` — défaut 5000
**Sortie** : `{ content: string, rowCount: number, truncated: boolean, format: "csv" }`
Suit le patron `export-audit-events` du framework (décision 4) : le CSV est renvoyé
**inline**, le navigateur en fait un `Blob`. Aucun fournisseur de stockage requis, donc
FR-019 tenu. Toute cellule commençant par `=`, `+`, `-` ou `@` est préfixée d'une
apostrophe avant sérialisation — neutralisation d'injection de formule, reprise du même
garde-fou que l'export du template Forms.
**Colonnes** : `ordre, etape, titre_etape, intitule, rush, debut_ms, fin_ms, debut_tc, fin_tc, sensation_visee, essai_montage`.

---

## Fiche de préparation — 2 actions

### `get-prep-sheet` · lecture
**Entrée** : `{ videoId }`
**Sortie** : les cinq questions du référentiel, chacune avec sa réponse ou `null`, plus
`answeredCount`. Les libellés viennent de `shared/hero-journey.ts`.

### `answer-prep-question` · écriture
**Entrée** : `{ videoId, questionKey: string, answer: string }`
Upsert sur `(video_id, question_key)`. Une `questionKey` hors des cinq clés connues est
**rejetée** avec la liste des clés valides — jamais insérée.

---

## Essais et diagnostic — 4 actions

### `list-experiments` · lecture
**Entrée** : `{ videoId, status?, source?, step? }`
**Sortie** : `{ experiments: [...], openCount: number, testingCount: number }`

### `create-experiment` · écriture
**Entrée** : `{ videoId, source: "diagnostic" | "roasting" | "self", observation: string, symptomKey?, step?, hypothesis?, attempt? }`
`symptomKey` n'est accepté que si `source = "diagnostic"`, et doit appartenir aux cinq
symptômes du référentiel.

### `resolve-experiment` · écriture
**Entrée** : `{ experimentId, status: "testing" | "kept" | "discarded", verdictNote?, attempt? }`
Passer à `kept` ou `discarded` **exige** un `verdictNote` : clore un essai sans dire ce
qu'on a appris vide la boucle de son intérêt. Si un autre essai de la même vidéo est déjà
`testing`, la réponse porte un avertissement rappelant la règle « une seule chose à la
fois » (FR-014) — avertissement, pas blocage : c'est une discipline, pas une contrainte.

### `diagnose-structure` · lecture
**Entrée** : `{ videoId }`
**Sortie** : `{ findings: Array<{ rule: string, severity: "info" | "warn", message: string, steps: number[] }>, coverage }`
Applique mécaniquement les règles de la méthode à la carte : acte sous-couvert, climax
sans enjeu lisible en amont, fin déconnectée de la question de départ, courbe plate,
marqueurs orphelins en nombre. **Ne propose pas de correctif tout fait** — elle produit
des observations, que l'utilisateur ou l'agent transforme en essais via
`create-experiment`. C'est la règle de la skill `roasting` : une solution proposée n'est
pas un diagnostic.

---

## Publication — 3 actions

### `upsert-publication` · écriture
**Entrée** : `{ videoId, publicationId?, platform, seoTitle?, seoDescription?, keywords?, url?, status?, publishedAt? }`
`platform` est du texte libre : aucun connecteur n'existe et aucune liste fermée n'est
imposée.

### `list-publications` · lecture
**Entrée** : `{ videoId }`
**Sortie** : `{ publications: Array<Publication & { metrics: Metric[] }>, totalMetrics }`
Chaque cible porte ses relevés, du plus récent au plus ancien. Ajoutée pour la même raison que `list-stage-events` : sans elle, une publication créée disparaissait de l'écran.

### `record-metrics` · écriture
**Entrée** : `{ publicationId, measuredOn: string, views?, likes?, comments?, retentionPct? }`
Upsert sur `(publication_id, measured_on)` : un second relevé le même jour corrige le
précédent au lieu d'empiler des doublons. `retentionPct` bornée 0–100.

---

## Actions standard du framework — 2

### `view-screen` · lecture, `http: false`
Lit l'état applicatif via `readAppState("navigation")` et `readAppState("selection")`,
puis charge la donnée correspondante : la liste des vidéos sur `/`, la carte narrative et
l'onglet actif sur `/video/:id`, les échéances sur `/calendar`. C'est ce qui rend l'agent
capable de répondre à « cette étape-là » sans demander laquelle.

### `navigate` · écriture
**Entrée** : `{ view: "list" | "video" | "calendar", videoId?, tab?: Tab, step?: number }`
Permet à l'agent d'amener l'utilisateur sur l'écran dont il parle.

---

## État applicatif

`app/hooks/use-navigation-state.ts` est étendu pour que `NavigationState` porte :

| Clé | Valeurs | Rôle |
| --- | --- | --- |
| `view` | `list` \| `video` \| `calendar` | l'écran courant |
| `videoId` | `string \| null` | la vidéo ouverte |
| `tab` | `map` \| `markers` \| `prep` \| `experiments` \| `publication` | la section ouverte |
| `step` | `number \| null` | l'étape dont le panneau est déplié |

Les fonctions `viewForPath` et `pathForView` du template sont étendues en conséquence
plutôt que remplacées.

---

## Couverture des exigences

| Exigence | Actions |
| --- | --- |
| FR-001 | `create-video`, `update-video`, `archive-video` |
| FR-002, FR-005 | `get-story-map` |
| FR-003 | `set-beat` |
| FR-004 | `get-story-map` (champ `curve`) |
| FR-006 | fonction partagée, appliquée par `get-story-map`, `set-beat`, `list-videos` |
| FR-007 | `upsert-marker`, `assign-marker-step`, `list-markers` |
| FR-008 | `reorder-markers` |
| FR-009 | `export-markers` |
| FR-010 | `get-prep-sheet`, `answer-prep-question` |
| FR-011 | `create-experiment` (`symptomKey`), `diagnose-structure` |
| FR-012, FR-013 | `create-experiment`, `resolve-experiment`, `list-experiments` |
| FR-014 | avertissement de `resolve-experiment` + skill `diagnostic-timeline` |
| FR-015 | `move-stage` (+ refus de `stage` dans `update-video`), `list-stage-events` pour la relecture |
| FR-016 | `list-blocked`, champ `isBlocked` de `list-videos` |
| FR-017 | `update-video` (`dueAt`), champ date dans l'en-tête de la fiche, route `/calendar` |
| FR-018 | `upsert-publication`, `list-publications`, `record-metrics` |
| FR-019 | tenue par la décision 4 (pas de stockage externe) et le mode dev local |
| FR-020 | trois routes, cinq onglets — aucune action n'ouvre un quatrième écran |
