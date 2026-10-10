/**
 * La confirmation avant une suppression définitive.
 *
 * L'application avait exactement **une** confirmation, et elle gardait le seul geste
 * réversible : l'archivage d'une vidéo. Les six suppressions irréversibles — marqueur,
 * ressource, kit de marque, modèle, prompt — partaient au premier clic. L'inversion était
 * exacte, et le cas le plus exposé était un item de menu, entouré de « Dupliquer ».
 *
 * Un seul endroit plutôt que six copies : le texte reste cohérent d'un écran à l'autre,
 * et il ne peut pas dériver dans un coin de la bibliothèque.
 *
 * `window.confirm` et non une boîte maison : le projet n'a pas de dialogue de
 * confirmation, et en inventer un ici demanderait de gérer le focus, la touche Échap et
 * les lecteurs d'écran — ce que le navigateur fait déjà, partout, sans code à maintenir.
 */
export function confirmDelete(
  t: (key: string, options?: Record<string, unknown>) => string,
  name?: string | null,
): boolean {
  // Un élément sans titre existe — un marqueur à peine posé, un prompt en cours d'écriture.
  // « Supprimer «  » ? » ne dirait rien : on nomme alors la catégorie.
  const label = name?.trim() || t("confirm.unnamed");
  return window.confirm(
    `${t("confirm.deleteTitle", { name: label })}\n\n${t("confirm.deleteIrreversible")}`,
  );
}
