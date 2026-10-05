/**
 * Compatibilité avec les arguments de ligne de commande.
 *
 * La CLI du framework passe tous les arguments en chaînes : `--brandKitId null` arrive
 * comme la chaîne « null », et un champ `z.string().nullable()` l'accepte telle quelle.
 * On se retrouve alors avec un identifiant « null » en base, qui ne pointe sur rien.
 *
 * Ce préprocesseur ramène les chaînes vides et « null » à une vraie valeur nulle, pour
 * que l'action réponde pareil depuis la CLI, l'interface et l'agent.
 */

import { z } from "zod";

/**
 * Un entier optionnel qui accepte aussi d'être explicitement vidé.
 *
 * Le framework convertit tout seul les chaînes en nombres pour un `z.number()` nu, mais
 * **plus dès qu'on y ajoute `.nullable()`** : `--endMs 11800` arrive alors comme la
 * chaîne « 11800 » et l'action refuse l'appel. Même piège que pour `nullableId`, sur
 * l'autre type.
 */
export function nullableInteger(description: string) {
  return z
    .preprocess((value) => {
      if (value === "" || value === "null" || value === null) return null;
      if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : value;
      }
      return value;
    }, z.number().int().min(0).nullable())
    .describe(description);
}

/** Un identifiant optionnel qui accepte aussi d'être explicitement vidé. */
export function nullableId(description: string) {
  return z
    .preprocess(
      (value) =>
        value === "" || value === "null" || value === null ? null : value,
      z.string().nullable(),
    )
    .describe(description);
}
