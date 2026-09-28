/**
 * Sérialisation CSV.
 *
 * Isolée du reste pour être testable seule : la neutralisation d'injection de formule
 * est le genre de règle qu'une refonte casse en silence.
 */

/**
 * Neutralise l'injection de formule.
 *
 * Une cellule commençant par `=`, `+`, `-` ou `@` est exécutée par les tableurs à
 * l'ouverture. Le préfixe apostrophe la désamorce. Même garde-fou que l'export du
 * template Forms du framework, qui note qu'il « protège d'une saisie qui tenterait
 * d'exécuter du code à l'ouverture du fichier ».
 */
export function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** Échappe une valeur pour une cellule CSV, neutralisation de formule comprise. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const raw = neutralizeFormula(String(value));
  return /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

/** Assemble une ligne CSV. */
export function csvRow(values: readonly unknown[]): string {
  return values.map(csvCell).join(",");
}
