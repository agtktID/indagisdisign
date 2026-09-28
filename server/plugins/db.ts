/**
 * Migrations Indagis Studio.
 *
 * Un seul propriétaire de schéma : ces entrées manuscrites. Pas de `pnpm db:generate`
 * ni de `runDrizzleMigrations()` — la documentation du framework interdit de donner à un
 * même schéma deux propriétaires de migrations indépendants, et le chargeur Drizzle lit
 * ses fichiers sur disque, ce qui le rend indisponible sur les runtimes edge sans système
 * de fichiers. Le chemin manuscrit garde ouvertes toutes les cibles Nitro.
 *
 * Règles appliquées à chaque entrée :
 * - un `name:` unique en plus du `version:` — le numéro seul n'est pas une identité sûre
 *   entre branches parallèles ;
 * - rétrocompatible, pas seulement additive : jamais de `DROP`, de renommage de colonne,
 *   ni de `NOT NULL` sans `DEFAULT`.
 */

import { runMigrations } from "@agent-native/core/db";

export default runMigrations(
  [
    {
      version: 1,
      name: "studio-videos-table",
      sql: `CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'long',
        parent_video_id TEXT,
        stage TEXT NOT NULL DEFAULT 'idea',
        stage_changed_at TEXT NOT NULL DEFAULT now(),
        due_at TEXT,
        archived_at TEXT,
        created_at TEXT NOT NULL DEFAULT now(),
        updated_at TEXT NOT NULL DEFAULT now(),
        owner_email TEXT NOT NULL DEFAULT 'local@localhost',
        org_id TEXT,
        visibility TEXT NOT NULL DEFAULT 'private'
      )`,
    },
    {
      version: 2,
      name: "studio-videos-indexes",
      sql: `CREATE INDEX IF NOT EXISTS videos_owner_idx ON videos (owner_email);
        CREATE INDEX IF NOT EXISTS videos_org_archived_idx ON videos (org_id, archived_at);
        CREATE INDEX IF NOT EXISTS videos_due_idx ON videos (due_at);
        CREATE INDEX IF NOT EXISTS videos_parent_idx ON videos (parent_video_id)`,
    },
    {
      version: 3,
      name: "studio-video-shares-table",
      sql: `CREATE TABLE IF NOT EXISTS video_shares (
        id TEXT PRIMARY KEY,
        resource_id TEXT NOT NULL,
        principal_type TEXT NOT NULL,
        principal_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'viewer',
        created_by TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT now(),
        notified_at TEXT
      );
        CREATE INDEX IF NOT EXISTS video_shares_resource_idx ON video_shares (resource_id)`,
    },
    {
      version: 4,
      name: "studio-stage-events-table",
      sql: `CREATE TABLE IF NOT EXISTS stage_events (
        id TEXT PRIMARY KEY,
        video_id TEXT NOT NULL,
        from_stage TEXT,
        to_stage TEXT NOT NULL,
        note TEXT,
        occurred_at TEXT NOT NULL DEFAULT now()
      );
        CREATE INDEX IF NOT EXISTS stage_events_video_occurred_idx ON stage_events (video_id, occurred_at)`,
    },
    {
      version: 5,
      name: "studio-story-beats-table",
      sql: `CREATE TABLE IF NOT EXISTS story_beats (
        id TEXT PRIMARY KEY,
        video_id TEXT NOT NULL,
        step INTEGER NOT NULL,
        note TEXT,
        intensity INTEGER,
        status TEXT NOT NULL DEFAULT 'drafted',
        created_at TEXT NOT NULL DEFAULT now(),
        updated_at TEXT NOT NULL DEFAULT now()
      );
        CREATE INDEX IF NOT EXISTS story_beats_video_idx ON story_beats (video_id);
        CREATE UNIQUE INDEX IF NOT EXISTS story_beats_video_step_unique ON story_beats (video_id, step)`,
    },
    {
      version: 6,
      name: "studio-markers-table",
      sql: `CREATE TABLE IF NOT EXISTS markers (
        id TEXT PRIMARY KEY,
        video_id TEXT NOT NULL,
        label TEXT NOT NULL,
        rush_name TEXT,
        start_ms INTEGER NOT NULL,
        end_ms INTEGER,
        step INTEGER,
        intended_feeling TEXT,
        edit_attempt TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        external_ref TEXT,
        created_at TEXT NOT NULL DEFAULT now(),
        updated_at TEXT NOT NULL DEFAULT now()
      );
        CREATE INDEX IF NOT EXISTS markers_video_idx ON markers (video_id);
        CREATE INDEX IF NOT EXISTS markers_video_step_idx ON markers (video_id, step);
        CREATE INDEX IF NOT EXISTS markers_video_order_idx ON markers (video_id, sort_order)`,
    },
    {
      version: 7,
      name: "studio-prep-answers-table",
      sql: `CREATE TABLE IF NOT EXISTS prep_answers (
        id TEXT PRIMARY KEY,
        video_id TEXT NOT NULL,
        question_key TEXT NOT NULL,
        answer TEXT,
        created_at TEXT NOT NULL DEFAULT now(),
        updated_at TEXT NOT NULL DEFAULT now()
      );
        CREATE UNIQUE INDEX IF NOT EXISTS prep_answers_video_question_unique ON prep_answers (video_id, question_key)`,
    },
    {
      version: 8,
      name: "studio-experiments-table",
      sql: `CREATE TABLE IF NOT EXISTS experiments (
        id TEXT PRIMARY KEY,
        video_id TEXT NOT NULL,
        step INTEGER,
        source TEXT NOT NULL,
        symptom_key TEXT,
        observation TEXT NOT NULL,
        hypothesis TEXT,
        attempt TEXT,
        status TEXT NOT NULL DEFAULT 'todo',
        verdict_note TEXT,
        created_at TEXT NOT NULL DEFAULT now(),
        updated_at TEXT NOT NULL DEFAULT now()
      );
        CREATE INDEX IF NOT EXISTS experiments_video_idx ON experiments (video_id);
        CREATE INDEX IF NOT EXISTS experiments_video_status_idx ON experiments (video_id, status)`,
    },
    {
      version: 9,
      name: "studio-publications-table",
      sql: `CREATE TABLE IF NOT EXISTS publications (
        id TEXT PRIMARY KEY,
        video_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        seo_title TEXT,
        seo_description TEXT,
        keywords TEXT,
        url TEXT,
        status TEXT NOT NULL DEFAULT 'planned',
        published_at TEXT,
        created_at TEXT NOT NULL DEFAULT now(),
        updated_at TEXT NOT NULL DEFAULT now()
      );
        CREATE INDEX IF NOT EXISTS publications_video_idx ON publications (video_id);
        CREATE INDEX IF NOT EXISTS publications_video_platform_idx ON publications (video_id, platform)`,
    },
    {
      version: 10,
      name: "studio-metrics-table",
      sql: `CREATE TABLE IF NOT EXISTS metrics (
        id TEXT PRIMARY KEY,
        publication_id TEXT NOT NULL,
        video_id TEXT NOT NULL,
        measured_on TEXT NOT NULL,
        views INTEGER,
        likes INTEGER,
        comments INTEGER,
        retention_pct INTEGER,
        created_at TEXT NOT NULL DEFAULT now()
      );
        CREATE INDEX IF NOT EXISTS metrics_video_idx ON metrics (video_id);
        CREATE UNIQUE INDEX IF NOT EXISTS metrics_publication_date_unique ON metrics (publication_id, measured_on)`,
    },
    {
      version: 11,
      name: "studio-tenant-scope-on-child-tables",
      sql: `ALTER TABLE stage_events ADD COLUMN IF NOT EXISTS owner_email TEXT NOT NULL DEFAULT 'local@localhost';
        ALTER TABLE stage_events ADD COLUMN IF NOT EXISTS org_id TEXT;
        ALTER TABLE stage_events ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private';
        ALTER TABLE story_beats ADD COLUMN IF NOT EXISTS owner_email TEXT NOT NULL DEFAULT 'local@localhost';
        ALTER TABLE story_beats ADD COLUMN IF NOT EXISTS org_id TEXT;
        ALTER TABLE story_beats ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private';
        ALTER TABLE markers ADD COLUMN IF NOT EXISTS owner_email TEXT NOT NULL DEFAULT 'local@localhost';
        ALTER TABLE markers ADD COLUMN IF NOT EXISTS org_id TEXT;
        ALTER TABLE markers ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private';
        ALTER TABLE prep_answers ADD COLUMN IF NOT EXISTS owner_email TEXT NOT NULL DEFAULT 'local@localhost';
        ALTER TABLE prep_answers ADD COLUMN IF NOT EXISTS org_id TEXT;
        ALTER TABLE prep_answers ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private';
        ALTER TABLE experiments ADD COLUMN IF NOT EXISTS owner_email TEXT NOT NULL DEFAULT 'local@localhost';
        ALTER TABLE experiments ADD COLUMN IF NOT EXISTS org_id TEXT;
        ALTER TABLE experiments ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private';
        ALTER TABLE publications ADD COLUMN IF NOT EXISTS owner_email TEXT NOT NULL DEFAULT 'local@localhost';
        ALTER TABLE publications ADD COLUMN IF NOT EXISTS org_id TEXT;
        ALTER TABLE publications ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private';
        ALTER TABLE metrics ADD COLUMN IF NOT EXISTS owner_email TEXT NOT NULL DEFAULT 'local@localhost';
        ALTER TABLE metrics ADD COLUMN IF NOT EXISTS org_id TEXT;
        ALTER TABLE metrics ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'`,
    },
    {
      version: 12,
      name: "studio-asset-library-tables",
      sql: `CREATE TABLE IF NOT EXISTS brand_kits (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        style_description TEXT,
        custom_instructions TEXT,
        palette TEXT,
        canonical_logo_url TEXT,
        created_at TEXT NOT NULL DEFAULT now(),
        updated_at TEXT NOT NULL DEFAULT now(),
        owner_email TEXT NOT NULL DEFAULT 'local@localhost',
        org_id TEXT,
        visibility TEXT NOT NULL DEFAULT 'private'
      );
        CREATE INDEX IF NOT EXISTS brand_kits_owner_idx ON brand_kits (owner_email);

        CREATE TABLE IF NOT EXISTS asset_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL DEFAULT 'social',
        format TEXT NOT NULL DEFAULT '1:1',
        prompt_template TEXT,
        text_policy TEXT,
        reference_policy TEXT NOT NULL DEFAULT 'auto',
        brand_kit_id TEXT,
        model TEXT,
        image_size TEXT NOT NULL DEFAULT '2K',
        compose_canonical_logo BOOLEAN NOT NULL DEFAULT false,
        use_skeleton BOOLEAN NOT NULL DEFAULT false,
        skeleton_url TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT now(),
        updated_at TEXT NOT NULL DEFAULT now(),
        owner_email TEXT NOT NULL DEFAULT 'local@localhost',
        org_id TEXT,
        visibility TEXT NOT NULL DEFAULT 'private'
      );
        CREATE INDEX IF NOT EXISTS asset_templates_owner_idx ON asset_templates (owner_email);
        CREATE INDEX IF NOT EXISTS asset_templates_kit_idx ON asset_templates (brand_kit_id);
        CREATE INDEX IF NOT EXISTS asset_templates_sort_idx ON asset_templates (sort_order);

        CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        kind TEXT NOT NULL DEFAULT 'image',
        category TEXT NOT NULL DEFAULT 'other',
        format TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        url TEXT,
        thumbnail_url TEXT,
        tags TEXT,
        brand_kit_id TEXT,
        template_id TEXT,
        video_id TEXT,
        prompt TEXT,
        created_at TEXT NOT NULL DEFAULT now(),
        updated_at TEXT NOT NULL DEFAULT now(),
        owner_email TEXT NOT NULL DEFAULT 'local@localhost',
        org_id TEXT,
        visibility TEXT NOT NULL DEFAULT 'private'
      );
        CREATE INDEX IF NOT EXISTS assets_owner_idx ON assets (owner_email);
        CREATE INDEX IF NOT EXISTS assets_status_idx ON assets (status);
        CREATE INDEX IF NOT EXISTS assets_kind_idx ON assets (kind);
        CREATE INDEX IF NOT EXISTS assets_category_idx ON assets (category);
        CREATE INDEX IF NOT EXISTS assets_kit_idx ON assets (brand_kit_id);
        CREATE INDEX IF NOT EXISTS assets_video_idx ON assets (video_id)`,
    },
    {
      version: 13,
      name: "studio-prompts-table",
      sql: `CREATE TABLE IF NOT EXISTS prompts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        kind TEXT NOT NULL DEFAULT 'image',
        category TEXT NOT NULL DEFAULT 'other',
        format TEXT,
        body TEXT NOT NULL,
        tags TEXT,
        source_key TEXT,
        created_at TEXT NOT NULL DEFAULT now(),
        updated_at TEXT NOT NULL DEFAULT now(),
        owner_email TEXT NOT NULL DEFAULT 'local@localhost',
        org_id TEXT,
        visibility TEXT NOT NULL DEFAULT 'private'
      );
        CREATE INDEX IF NOT EXISTS prompts_owner_idx ON prompts (owner_email);
        CREATE INDEX IF NOT EXISTS prompts_kind_idx ON prompts (kind)`,
    },
  ],
  { table: "indagis_studio_migrations" },
);
