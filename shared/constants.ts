/**
 * Constantes de produit. Isolées ici pour qu'un ajustement après usage réel soit un
 * changement d'une ligne, et non une chasse aux occurrences.
 */

/**
 * Nombre de jours sans changement d'étape de production au-delà duquel une vidéo est
 * signalée comme bloquée (FR-016).
 *
 * Quatorze jours, soit deux semaines pleines : assez long pour ne pas alerter sur une
 * pause normale de week-end ou de tournage, assez court pour que le signal arrive avant
 * qu'un projet soit oublié. C'est une hypothèse produit, pas une valeur tirée de la
 * méthode source — à réviser quand il y aura de l'historique réel à observer.
 */
export const BLOCKED_THRESHOLD_DAYS = 14;

/** Plafond de lignes d'un export CSV, repris de `export-audit-events` du framework. */
export const CSV_MAX_ROWS = 5000;

/** Bornes de l'intensité émotionnelle d'une étape. */
export const MIN_INTENSITY = 0;
export const MAX_INTENSITY = 100;
