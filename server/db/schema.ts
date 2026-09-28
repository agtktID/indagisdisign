/**
 * Schéma Indagis Studio — 9 tables.
 *
 * Conventions reprises des schémas first-party du framework
 * (`@agent-native/core/dist/dashboard-storage/schema.js`) :
 * - les horodatages sont des colonnes `text` avec `.default(now())` ;
 *   l'application écrit toujours des chaînes ISO-8601 UTC (`new Date().toISOString()`),
 *   qui sont lexicographiquement ordonnées, donc comparables et triables ;
 * - `ownableColumns()` fournit `owner_email`, `org_id` et `visibility` ;
 * - aucun binaire en base : seules des URL ou des références externes sont persistées.
 *
 * Les timecodes sont des entiers en millisecondes.
 * Les étapes narratives sont des entiers 1–12, validés contre `shared/hero-journey.ts`.
 */

import {
  boolean,
  createSharesTable,
  index,
  integer,
  now,
  ownableColumns,
  table,
  text,
  uniqueIndex,
} from "@agent-native/core/db/schema";

/** Séquence fixe des étapes de production. */
export const STAGES = ["idea", "script", "shoot", "edit", "published"] as const;
export type Stage = (typeof STAGES)[number];

export const BEAT_STATUSES = ["drafted", "locked"] as const;
export type BeatStatus = (typeof BEAT_STATUSES)[number];

export const EXPERIMENT_SOURCES = ["diagnostic", "roasting", "self"] as const;
export type ExperimentSource = (typeof EXPERIMENT_SOURCES)[number];

export const EXPERIMENT_STATUSES = ["todo", "testing", "kept", "discarded"] as const;
export type ExperimentStatus = (typeof EXPERIMENT_STATUSES)[number];

export const PUBLICATION_STATUSES = ["planned", "published"] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export const VIDEO_KINDS = ["long", "short"] as const;
export type VideoKind = (typeof VIDEO_KINDS)[number];

/** 1 — Le projet vidéo. Entité racine : tout le reste s'y rattache. */
export const videos = table(
  "videos",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    kind: text("kind", { enum: VIDEO_KINDS }).notNull().default("long"),
    /** Renseigné pour un dérivé court issu d'une vidéo longue. */
    parentVideoId: text("parent_video_id"),
    stage: text("stage", { enum: STAGES }).notNull().default("idea"),
    /** Base du calcul de blocage (FR-016). Mis à jour par `move-stage` uniquement. */
    stageChangedAt: text("stage_changed_at").notNull().default(now()),
    dueAt: text("due_at"),
    /** Non nul = archivée. Archivage logique réversible, jamais de suppression. */
    archivedAt: text("archived_at"),
    createdAt: text("created_at").notNull().default(now()),
    updatedAt: text("updated_at").notNull().default(now()),
    ...ownableColumns(),
  },
  (video) => ({
    ownerIdx: index("videos_owner_idx").on(video.ownerEmail),
    orgArchivedIdx: index("videos_org_archived_idx").on(video.orgId, video.archivedAt),
    dueIdx: index("videos_due_idx").on(video.dueAt),
    parentIdx: index("videos_parent_idx").on(video.parentVideoId),
  }),
);

/** 2 — Les partages. Seule ressource partageable du produit : on partage un récit. */
export const videoShares = createSharesTable("video_shares");

/** 3 — L'historique de production. Append-only : jamais modifié, jamais supprimé. */
export const stageEvents = table(
  "stage_events",
  {
    id: text("id").primaryKey(),
    videoId: text("video_id").notNull(),
    /** Nul à la création de la vidéo. */
    fromStage: text("from_stage", { enum: STAGES }),
    toStage: text("to_stage", { enum: STAGES }).notNull(),
    note: text("note"),
    occurredAt: text("occurred_at").notNull().default(now()),
    /**
     * Portée locataire. L'accès applicatif passe par la vidéo parente, mais les outils
     * SQL bruts (`db-query`, `db-exec`, `db-patch`) filtrent table par table : sans ces
     * colonnes, ils franchiraient la frontière entre utilisateurs.
     */
    ...ownableColumns(),
  },
  (event) => ({
    videoOccurredIdx: index("stage_events_video_occurred_idx").on(
      event.videoId,
      event.occurredAt,
    ),
  }),
);

/**
 * 4 — Les 12 étapes, par vidéo. Le cœur du produit.
 *
 * Une ligne par étape *renseignée* : l'absence de ligne signifie « étape vide », ce qui
 * évite de créer douze lignes creuses à chaque nouvelle vidéo.
 */
export const storyBeats = table(
  "story_beats",
  {
    id: text("id").primaryKey(),
    videoId: text("video_id").notNull(),
    /** 1–12, validé côté action contre `shared/hero-journey.ts`. */
    step: integer("step").notNull(),
    note: text("note"),
    /** 0–100, alimente la courbe émotionnelle (FR-004). */
    intensity: integer("intensity"),
    status: text("status", { enum: BEAT_STATUSES }).notNull().default("drafted"),
    createdAt: text("created_at").notNull().default(now()),
    updatedAt: text("updated_at").notNull().default(now()),
    /**
     * Portée locataire. L'accès applicatif passe par la vidéo parente, mais les outils
     * SQL bruts (`db-query`, `db-exec`, `db-patch`) filtrent table par table : sans ces
     * colonnes, ils franchiraient la frontière entre utilisateurs.
     */
    ...ownableColumns(),
  },
  (beat) => ({
    videoIdx: index("story_beats_video_idx").on(beat.videoId),
    videoStepUnique: uniqueIndex("story_beats_video_step_unique").on(
      beat.videoId,
      beat.step,
    ),
  }),
);

/** 5 — Le carnet de marqueurs. */
export const markers = table(
  "markers",
  {
    id: text("id").primaryKey(),
    videoId: text("video_id").notNull(),
    label: text("label").notNull(),
    rushName: text("rush_name"),
    /** Millisecondes. */
    startMs: integer("start_ms").notNull(),
    /** Millisecondes. Nul = le marqueur est un point, pas un segment. */
    endMs: integer("end_ms"),
    /**
     * 1–12, **nullable** : la méthode admet explicitement qu'une étape manque.
     * Forcer un rattachement obligerait l'utilisateur à mentir sur son matériel.
     */
    step: integer("step"),
    intendedFeeling: text("intended_feeling"),
    editAttempt: text("edit_attempt"),
    /**
     * L'ordre narratif, distinct de l'ordre chronologique — c'est l'objet même d'un
     * remontage (FR-008). Un tri par timecode seul rendrait la fonctionnalité
     * impossible à exprimer.
     */
    sortOrder: integer("sort_order").notNull().default(0),
    /** Identifiant dans un outil tiers. Réservé, non utilisé au périmètre actuel. */
    externalRef: text("external_ref"),
    createdAt: text("created_at").notNull().default(now()),
    updatedAt: text("updated_at").notNull().default(now()),
    /**
     * Portée locataire. L'accès applicatif passe par la vidéo parente, mais les outils
     * SQL bruts (`db-query`, `db-exec`, `db-patch`) filtrent table par table : sans ces
     * colonnes, ils franchiraient la frontière entre utilisateurs.
     */
    ...ownableColumns(),
  },
  (marker) => ({
    videoIdx: index("markers_video_idx").on(marker.videoId),
    videoStepIdx: index("markers_video_step_idx").on(marker.videoId, marker.step),
    videoOrderIdx: index("markers_video_order_idx").on(marker.videoId, marker.sortOrder),
  }),
);

/** 6 — La fiche de préparation. Les clés vivent dans `shared/hero-journey.ts`. */
export const prepAnswers = table(
  "prep_answers",
  {
    id: text("id").primaryKey(),
    videoId: text("video_id").notNull(),
    /** Une des 5 clés du référentiel. Une clé inconnue est rejetée par l'action. */
    questionKey: text("question_key").notNull(),
    answer: text("answer"),
    createdAt: text("created_at").notNull().default(now()),
    updatedAt: text("updated_at").notNull().default(now()),
    /**
     * Portée locataire. L'accès applicatif passe par la vidéo parente, mais les outils
     * SQL bruts (`db-query`, `db-exec`, `db-patch`) filtrent table par table : sans ces
     * colonnes, ils franchiraient la frontière entre utilisateurs.
     */
    ...ownableColumns(),
  },
  (answer) => ({
    videoQuestionUnique: uniqueIndex("prep_answers_video_question_unique").on(
      answer.videoId,
      answer.questionKey,
    ),
  }),
);

/**
 * 7 — La boucle observation → hypothèse → essai.
 *
 * Diagnostic et roasting partagent une seule table : ce sont deux sources d'entrée pour
 * la même boucle, pas deux mécaniques différentes.
 */
export const experiments = table(
  "experiments",
  {
    id: text("id").primaryKey(),
    videoId: text("video_id").notNull(),
    /** 1–12, si l'essai vise une étape précise. */
    step: integer("step"),
    source: text("source", { enum: EXPERIMENT_SOURCES }).notNull(),
    /** Renseigné seulement quand `source = "diagnostic"`. */
    symptomKey: text("symptom_key"),
    observation: text("observation").notNull(),
    hypothesis: text("hypothesis"),
    attempt: text("attempt"),
    status: text("status", { enum: EXPERIMENT_STATUSES }).notNull().default("todo"),
    verdictNote: text("verdict_note"),
    createdAt: text("created_at").notNull().default(now()),
    updatedAt: text("updated_at").notNull().default(now()),
    /**
     * Portée locataire. L'accès applicatif passe par la vidéo parente, mais les outils
     * SQL bruts (`db-query`, `db-exec`, `db-patch`) filtrent table par table : sans ces
     * colonnes, ils franchiraient la frontière entre utilisateurs.
     */
    ...ownableColumns(),
  },
  (experiment) => ({
    videoIdx: index("experiments_video_idx").on(experiment.videoId),
    videoStatusIdx: index("experiments_video_status_idx").on(
      experiment.videoId,
      experiment.status,
    ),
  }),
);

/** 8 — Les cibles de diffusion. `platform` est du texte libre : aucun connecteur. */
export const publications = table(
  "publications",
  {
    id: text("id").primaryKey(),
    videoId: text("video_id").notNull(),
    platform: text("platform").notNull(),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    /** Séparés par des virgules. */
    keywords: text("keywords"),
    url: text("url"),
    status: text("status", { enum: PUBLICATION_STATUSES }).notNull().default("planned"),
    publishedAt: text("published_at"),
    createdAt: text("created_at").notNull().default(now()),
    updatedAt: text("updated_at").notNull().default(now()),
    /**
     * Portée locataire. L'accès applicatif passe par la vidéo parente, mais les outils
     * SQL bruts (`db-query`, `db-exec`, `db-patch`) filtrent table par table : sans ces
     * colonnes, ils franchiraient la frontière entre utilisateurs.
     */
    ...ownableColumns(),
  },
  (publication) => ({
    videoIdx: index("publications_video_idx").on(publication.videoId),
    videoPlatformIdx: index("publications_video_platform_idx").on(
      publication.videoId,
      publication.platform,
    ),
  }),
);

/** 9 — Les relevés de performance. Saisie manuelle : aucun connecteur de plateforme. */
export const metrics = table(
  "metrics",
  {
    id: text("id").primaryKey(),
    publicationId: text("publication_id").notNull(),
    /** Dupliqué depuis la publication pour filtrer sans jointure. */
    videoId: text("video_id").notNull(),
    /** Date ISO `YYYY-MM-DD`. */
    measuredOn: text("measured_on").notNull(),
    views: integer("views"),
    likes: integer("likes"),
    comments: integer("comments"),
    /** 0–100. */
    retentionPct: integer("retention_pct"),
    createdAt: text("created_at").notNull().default(now()),
    /**
     * Portée locataire. L'accès applicatif passe par la vidéo parente, mais les outils
     * SQL bruts (`db-query`, `db-exec`, `db-patch`) filtrent table par table : sans ces
     * colonnes, ils franchiraient la frontière entre utilisateurs.
     */
    ...ownableColumns(),
  },
  (metric) => ({
    videoIdx: index("metrics_video_idx").on(metric.videoId),
    publicationDateUnique: uniqueIndex("metrics_publication_date_unique").on(
      metric.publicationId,
      metric.measuredOn,
    ),
  }),
);


/* ------------------------------------------------------------------------- */
/* Bibliothèque de ressources                                                 */
/* ------------------------------------------------------------------------- */

export const ASSET_STATUSES = ["draft", "generated", "reference"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const REFERENCE_POLICIES = ["auto", "always", "never"] as const;
export type ReferencePolicy = (typeof REFERENCE_POLICIES)[number];

export const IMAGE_SIZES = ["1K", "2K", "4K"] as const;
export type ImageSize = (typeof IMAGE_SIZES)[number];

/**
 * 10 — Les kits de marque.
 *
 * Un kit regroupe une direction visuelle : palette, description de style, instructions
 * permanentes. Les modèles et les ressources s'y rattachent, ou restent « globaux ».
 */
export const brandKits = table(
  "brand_kits",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    /** Description de style : traits concrets plutôt qu'adjectifs vagues. */
    styleDescription: text("style_description"),
    /** Contraintes que l'agent doit appliquer à chaque génération avec ce kit. */
    customInstructions: text("custom_instructions"),
    /** Couleurs séparées par des virgules, par exemple « #111827, #f8fafc ». */
    palette: text("palette"),
    /** URL du logo canonique. Jamais le binaire lui-même. */
    canonicalLogoUrl: text("canonical_logo_url"),
    createdAt: text("created_at").notNull().default(now()),
    updatedAt: text("updated_at").notNull().default(now()),
    ...ownableColumns(),
  },
  (kit) => ({
    ownerIdx: index("brand_kits_owner_idx").on(kit.ownerEmail),
  }),
);

/**
 * 11 — Les modèles de génération.
 *
 * Un modèle fige une forme de sortie : catégorie, format, gabarit d'invite, politique de
 * texte. Le rattacher à un kit de marque le spécialise ; sans kit, il est global.
 */
export const assetTemplates = table(
  "asset_templates",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    /** Clé de `ASSET_CATEGORIES` dans shared/asset-taxonomy.ts. */
    category: text("category").notNull().default("social"),
    /** Clé de `ASSET_FORMATS` dans shared/asset-taxonomy.ts. */
    format: text("format").notNull().default("1:1"),
    /** Gabarit d'invite ; `{{prompt}}` est remplacé par la demande de l'utilisateur. */
    promptTemplate: text("prompt_template"),
    /** Règle sur le texte incrusté dans l'image. */
    textPolicy: text("text_policy"),
    referencePolicy: text("reference_policy", { enum: REFERENCE_POLICIES })
      .notNull()
      .default("auto"),
    /** Nul = modèle global, visible depuis tous les kits. */
    brandKitId: text("brand_kit_id"),
    /** Nom du modèle de génération, texte libre : aucune liste imposée. */
    model: text("model"),
    imageSize: text("image_size", { enum: IMAGE_SIZES }).notNull().default("2K"),
    composeCanonicalLogo: boolean("compose_canonical_logo").notNull().default(false),
    useSkeleton: boolean("use_skeleton").notNull().default(false),
    /** URL de l'image de fond servant de squelette, le cas échéant. */
    skeletonUrl: text("skeleton_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(now()),
    updatedAt: text("updated_at").notNull().default(now()),
    ...ownableColumns(),
  },
  (tpl) => ({
    ownerIdx: index("asset_templates_owner_idx").on(tpl.ownerEmail),
    kitIdx: index("asset_templates_kit_idx").on(tpl.brandKitId),
    sortIdx: index("asset_templates_sort_idx").on(tpl.sortOrder),
  }),
);

/**
 * 12 — Les ressources.
 *
 * Aucun binaire en base : seule l'URL ou la référence externe est persistée, comme
 * l'impose la constitution. Trois états, qui correspondent aux trois onglets de la
 * bibliothèque : brouillon, généré, référence.
 */
export const assets = table(
  "assets",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    /** Clé de `ASSET_KINDS` : vidéo, image, audio, modèle… */
    kind: text("kind").notNull().default("image"),
    /** Clé de `ASSET_CATEGORIES` : à quoi ça sert. */
    category: text("category").notNull().default("other"),
    /** Clé de `ASSET_FORMATS` : quelle forme ça a. Nul pour l'audio et les documents. */
    format: text("format"),
    status: text("status", { enum: ASSET_STATUSES }).notNull().default("draft"),
    /** URL du fichier. Jamais le fichier lui-même. */
    url: text("url"),
    /** Aperçu, si distinct de l'URL principale. */
    thumbnailUrl: text("thumbnail_url"),
    /** Mots-clés séparés par des virgules. */
    tags: text("tags"),
    /** Kit de marque de rattachement ; nul = ressource globale. */
    brandKitId: text("brand_kit_id"),
    /** Modèle ayant produit la ressource, le cas échéant. */
    templateId: text("template_id"),
    /** Vidéo Studio de rattachement ; nul = ressource de bibliothèque seule. */
    videoId: text("video_id"),
    /** Invite ayant servi à la génération, pour pouvoir la rejouer. */
    prompt: text("prompt"),
    createdAt: text("created_at").notNull().default(now()),
    updatedAt: text("updated_at").notNull().default(now()),
    ...ownableColumns(),
  },
  (asset) => ({
    ownerIdx: index("assets_owner_idx").on(asset.ownerEmail),
    statusIdx: index("assets_status_idx").on(asset.status),
    kindIdx: index("assets_kind_idx").on(asset.kind),
    categoryIdx: index("assets_category_idx").on(asset.category),
    kitIdx: index("assets_kit_idx").on(asset.brandKitId),
    videoIdx: index("assets_video_idx").on(asset.videoId),
  }),
);


/**
 * 13 — Les prompts réutilisables.
 *
 * La bibliothèque livrée avec l'application vit dans `shared/prompt-library.ts`, en
 * lecture seule. Cette table ne contient que les prompts de l'utilisateur : ses créations
 * et ses copies modifiées des prompts intégrés.
 */
export const prompts = table(
  "prompts",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    /** `image` ou `video` — l'axe de classement de la section Prompts. */
    kind: text("kind").notNull().default("image"),
    /** Clé de `ASSET_CATEGORIES`. */
    category: text("category").notNull().default("other"),
    /** Clé de `ASSET_FORMATS`. */
    format: text("format"),
    /** Le corps du prompt, avec ses `{{variables}}`. */
    body: text("body").notNull(),
    /** Mots-clés séparés par des virgules. */
    tags: text("tags"),
    /** Clé du prompt intégré dont celui-ci est issu, le cas échéant. */
    sourceKey: text("source_key"),
    createdAt: text("created_at").notNull().default(now()),
    updatedAt: text("updated_at").notNull().default(now()),
    ...ownableColumns(),
  },
  (prompt) => ({
    ownerIdx: index("prompts_owner_idx").on(prompt.ownerEmail),
    kindIdx: index("prompts_kind_idx").on(prompt.kind),
  }),
);

export const schema = {
  videos,
  videoShares,
  stageEvents,
  storyBeats,
  markers,
  prepAnswers,
  experiments,
  publications,
  metrics,
  brandKits,
  assetTemplates,
  assets,
  prompts,
};

export type Video = typeof videos.$inferSelect;
export type StageEvent = typeof stageEvents.$inferSelect;
export type StoryBeat = typeof storyBeats.$inferSelect;
export type Marker = typeof markers.$inferSelect;
export type PrepAnswer = typeof prepAnswers.$inferSelect;
export type Experiment = typeof experiments.$inferSelect;
export type Publication = typeof publications.$inferSelect;
export type Metric = typeof metrics.$inferSelect;
export type BrandKit = typeof brandKits.$inferSelect;
export type AssetTemplate = typeof assetTemplates.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type Prompt = typeof prompts.$inferSelect;
