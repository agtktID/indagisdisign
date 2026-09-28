import { defineAction } from "@agent-native/core/action";
import { eq } from "@agent-native/core/db/schema";
import { z } from "zod";

import { getDb, newId, nowIso, schema } from "../server/db/index.ts";
import { loadVideoForWrite, ownerStamp } from "../server/studio.ts";

export default defineAction({
  description:
    "Créer ou modifier une cible de publication pour une vidéo : plateforme, titre et description de référencement, mots-clés, URL. La plateforme est du texte libre — Studio ne publie sur rien, il note ce qui est prévu.",
  schema: z.object({
    videoId: z.string().describe("Identifiant de la vidéo"),
    publicationId: z.string().optional().describe("Publication à modifier ; absent = création"),
    platform: z.string().min(1).describe("Nom de la plateforme, texte libre"),
    seoTitle: z.string().optional().describe("Titre de référencement"),
    seoDescription: z.string().optional().describe("Description de référencement"),
    keywords: z.string().optional().describe("Mots-clés séparés par des virgules"),
    url: z.string().optional().describe("URL une fois publiée"),
    status: z.enum(["planned", "published"]).optional().describe("Prévue ou publiée"),
    publishedAt: z.string().optional().describe("Date de publication, ISO-8601"),
  }),
  run: async (args) => {
    const { videoId, publicationId, platform, seoTitle, seoDescription, keywords, url, status, publishedAt } =
      args;

    await loadVideoForWrite(videoId);
    const db = getDb();
    const timestamp = nowIso();

    if (publicationId) {
      const patch: Record<string, unknown> = { platform: platform.trim(), updatedAt: timestamp };
      if (seoTitle !== undefined) patch.seoTitle = seoTitle;
      if (seoDescription !== undefined) patch.seoDescription = seoDescription;
      if (keywords !== undefined) patch.keywords = keywords;
      if (url !== undefined) patch.url = url;
      if (status !== undefined) patch.status = status;
      if (publishedAt !== undefined) patch.publishedAt = publishedAt;

      const [publication] = await db
        .update(schema.publications)
        .set(patch)
        .where(eq(schema.publications.id, publicationId))
        .returning();

      if (!publication) {
        throw new Error(`Publication « ${publicationId} » introuvable.`);
      }
      return { publication, created: false };
    }

    const [publication] = await db
      .insert(schema.publications)
      .values({
        id: newId(),
        videoId,
        platform: platform.trim(),
        seoTitle: seoTitle ?? null,
        seoDescription: seoDescription ?? null,
        keywords: keywords ?? null,
        url: url ?? null,
        status: status ?? "planned",
        publishedAt: publishedAt ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...ownerStamp(),
      })
      .returning();

    return { publication, created: true };
  },
});
