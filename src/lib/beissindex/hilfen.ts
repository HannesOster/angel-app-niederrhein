export function begrenze(wert: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, wert))
}

/**
 * Wohlfühlfenster: 1 innerhalb von [von, bis], danach linear abfallend
 * bis -1 bei `toleranz` Abstand vom Fensterrand.
 */
export function optimumsKurve(
  wert: number,
  von: number,
  bis: number,
  toleranz: number,
): number {
  if (wert >= von && wert <= bis) return 1
  const abstand = wert < von ? von - wert : wert - bis
  return begrenze(1 - (2 * abstand) / toleranz, -1, 1)
}

/**
 * Nähe zu einem Zielwert: 1 bei Gleichheit, 0 bei halber Spanne,
 * -1 ab voller Spanne Abstand.
 */
export function naeheZu(wert: number, ziel: number, spanne: number): number {
  const abstand = Math.abs(wert - ziel)
  return begrenze(1 - (2 * abstand) / spanne, -1, 1)
}

/**
 * Trübung 0–1, abgeleitet aus der Pegeldynamik (Spec §5.3):
 * steigendes Wasser trübt ein, fallendes klart auf; hohes Niveau bleibt
 * länger trüb. Wird NICHT gemessen und ist entsprechend zu beschriften.
 */
export function truebungAus(
  pegelAenderung24hCm: number,
  pegelNiveauRelativ: number,
): number {
  const ausAenderung = begrenze((pegelAenderung24hCm + 40) / 80, 0, 1)
  const ausNiveau = begrenze((pegelNiveauRelativ + 1) / 2, 0, 1)
  return begrenze(0.6 * ausAenderung + 0.4 * ausNiveau, 0, 1)
}
