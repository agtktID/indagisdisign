import { defineAction } from "@agent-native/core/action";
import { readAppState } from "@agent-native/core/application-state";
import { and, eq, isNull } from "@agent-native/core/db/schema";
import { asc, desc } from "drizzle-orm";
import { z } from "zod";

import { JOURNEY_STEPS } from "../shared/hero-journey.ts";
import { computeCoverage, isBeatCovered } from "../shared/coverage.ts";
import { getDb, schema } from "../server/db/index.ts";
import { ownedByCurrentUser, videoAccessFilter } from "../server/studio.ts";
import {
  ASSET_CATEGORIES,
  ASSET_FORMATS,
  ASSET_KINDS,
} from "../shared/asset-taxonomy.ts";
import { BUILT_IN_PROMPTS } from "../shared/prompt-library.ts";
import {
  CATALOG_CATEGORIES,
  CATALOG_COUNTS,
  CATALOG_SCENES,
  CATALOG_STYLES,
} from "../shared/prompt-catalog/types.ts";
import { STARTER_TEMPLATES } from "../shared/starter-templates.ts";

/**
 * Ce que l'utilisateur regarde, et la donnée correspondante.
 *
 * C'est ce qui rend l'agent capable de répondre à « cette étape-là » sans demander
 * laquelle. À appeler en premier quand le contexte visible compte.
 */
export default defineAction({
  description:
    "Voir ce que l'utilisateur a sous les yeux dans Studio : l'écran courant, la vidéo ouverte, l'onglet actif, l'étape dépliée, et les données correspondantes. À appeler en premier quand l'utilisateur dit « cette vidéo », « cette étape » ou « ici ».",
  schema: z.object({}),
  http: false,
  readOnly: true,
  run: async () => {
    const navigation = (await readAppState("navigation")) as
      | {
          view?: string;
          videoId?: string;
          tab?: string;
          step?: number;
          section?: string;
          templateId?: string;
          path?: string;
        }
      | null;

    if (!navigation) {
      return "Aucun état applicatif trouvé. L'application est-elle ouverte dans un navigateur ?";
    }

    const screen: Record<string, unknown> = { navigation };
    const db = getDb();

    if (navigation.view === "list" || navigation.view === "calendar") {
      const rows = await db
        .select({
          id: schema.videos.id,
          title: schema.videos.title,
          stage: schema.videos.stage,
          dueAt: schema.videos.dueAt,
        })
        .from(schema.videos)
        .where(and(videoAccessFilter(), isNull(schema.videos.archivedAt)))
        .orderBy(
          navigation.view === "calendar"
            ? asc(schema.videos.dueAt)
            : desc(schema.videos.updatedAt),
        )
        .limit(50);
      screen.videos = rows;
    }

    // La bibliothèque : l'agent doit voir ce que l'utilisateur y regarde, sinon
    // « cette ressource » ou « ce modèle » ne veut rien dire pour lui.
    if (navigation.view === "library") {
      const section = navigation.section ?? "library";
      screen.librarySection = section;

      if (section === "library" || section === "journal" || section === "create") {
        screen.assets = await db
          .select()
          .from(schema.assets)
          .where(ownedByCurrentUser(schema.assets))
          .orderBy(desc(schema.assets.updatedAt))
          .limit(50);
      }

      if (section === "templates" || section === "create" || section === "journal") {
        screen.assetTemplates = await db
          .select()
          .from(schema.assetTemplates)
          .where(ownedByCurrentUser(schema.assetTemplates))
          .orderBy(asc(schema.assetTemplates.sortOrder));
      }

      if (section === "prompts") {
        screen.myPrompts = await db
          .select()
          .from(schema.prompts)
          .where(ownedByCurrentUser(schema.prompts))
          .orderBy(asc(schema.prompts.name));
        screen.builtInPrompts = BUILT_IN_PROMPTS.map((prompt) => ({
          key: prompt.key,
          name: prompt.name,
          kind: prompt.kind,
          format: prompt.format,
        }));
        // Le catalogue est trop gros pour être décrit entièrement : l'agent reçoit
        // ses axes de tri et ses volumes, puis appelle `list-prompts` pour le lire.
        screen.promptCatalog = {
          counts: CATALOG_COUNTS,
          categories: CATALOG_CATEGORIES,
          styles: CATALOG_STYLES,
          scenes: CATALOG_SCENES,
          howToRead: "Appeler list-prompts avec kind, category, style, scene ou search.",
        };
      }

      if (section === "starter") {
        screen.starterTemplates = STARTER_TEMPLATES.map((starter) => ({
          key: starter.key,
          name: starter.name,
          category: starter.category,
          format: starter.format,
          useCase: starter.useCase,
        }));
      }

      if (section === "kits" || section === "create") {
        screen.brandKits = await db
          .select()
          .from(schema.brandKits)
          .where(ownedByCurrentUser(schema.brandKits))
          .orderBy(asc(schema.brandKits.name));
      }

      if (navigation.templateId) {
        screen.openTemplate = (
          await db
            .select()
            .from(schema.assetTemplates)
            .where(
              and(
                eq(schema.assetTemplates.id, navigation.templateId),
                ownedByCurrentUser(schema.assetTemplates),
              ),
            )
            .limit(1)
        )[0];
      }

      screen.taxonomy = {
        kinds: ASSET_KINDS,
        categories: ASSET_CATEGORIES,
        formats: ASSET_FORMATS,
      };
    }

    if (navigation.videoId) {
      const video = (
        await db
          .select()
          .from(schema.videos)
          .where(and(eq(schema.videos.id, navigation.videoId), videoAccessFilter()))
          .limit(1)
      )[0];

      if (!video) {
        screen.videoError = `La vidéo ${navigation.videoId} affichée à l'écran n'est pas accessible.`;
        return screen;
      }

      screen.video = video;
      const beats = await db
        .select()
        .from(schema.storyBeats)
        .where(eq(schema.storyBeats.videoId, video.id));
      screen.coverage = computeCoverage(beats);

      if (!navigation.tab || navigation.tab === "map") {
        screen.storyMap = JOURNEY_STEPS.map((reference) => {
          const beat = beats.find((row) => row.step === reference.step);
          return {
            step: reference.step,
            title: reference.title,
            note: beat?.note ?? null,
            intensity: beat?.intensity ?? null,
            isCovered: isBeatCovered(beat),
          };
        });
      }

      if (navigation.tab === "markers") {
        screen.markers = await db
          .select()
          .from(schema.markers)
          .where(eq(schema.markers.videoId, video.id))
          .orderBy(asc(schema.markers.sortOrder));
      }

      if (navigation.tab === "prep") {
        screen.prepAnswers = await db
          .select()
          .from(schema.prepAnswers)
          .where(eq(schema.prepAnswers.videoId, video.id));
      }

      if (navigation.tab === "experiments") {
        screen.experiments = await db
          .select()
          .from(schema.experiments)
          .where(eq(schema.experiments.videoId, video.id))
          .orderBy(desc(schema.experiments.updatedAt));
      }

      if (navigation.tab === "publication") {
        screen.publications = await db
          .select()
          .from(schema.publications)
          .where(eq(schema.publications.videoId, video.id));
      }

      if (navigation.step) {
        const reference = JOURNEY_STEPS[navigation.step - 1];
        const beat = beats.find((row) => row.step === navigation.step);
        screen.openStep = {
          step: navigation.step,
          title: reference?.title,
          definition: reference?.definition,
          editing: reference?.editing,
          note: beat?.note ?? null,
          intensity: beat?.intensity ?? null,
        };
      }
    }

    return screen;
  },
});
