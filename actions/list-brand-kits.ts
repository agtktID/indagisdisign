import { defineAction } from "@agent-native/core/action";
import { asc } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.ts";
import { ownedByCurrentUser } from "../server/studio.ts";

export default defineAction({
  description:
    "Lister les kits de marque : les directions visuelles auxquelles les modèles et les ressources se rattachent.",
  schema: z.object({}),
  http: { method: "GET" },
  run: async () => {
    const brandKits = await getDb()
      .select()
      .from(schema.brandKits)
      .where(ownedByCurrentUser(schema.brandKits))
      .orderBy(asc(schema.brandKits.name));
    return { brandKits, count: brandKits.length };
  },
});
