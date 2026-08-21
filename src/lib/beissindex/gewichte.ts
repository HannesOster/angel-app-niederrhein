import type { Fisch, Gewichte } from './typen'

/**
 * Startwerte aus dem Design (Spec §5.3). Ausdrücklich ein Vorschlag, kein
 * Naturgesetz — der Nutzer verstellt sie in den Einstellungen.
 */
export const STANDARD_GEWICHTE: Record<Fisch, Gewichte> = {
  hecht: {
    luftdruckTrend: 3,
    pegelNiveau: 1,
    truebung: 2,
    wassertemperatur: 2,
    licht: 2,
    tageszeit: 2,
    wind: 2,
    solunar: 3,
  },
  zander: {
    luftdruckTrend: 2,
    pegelNiveau: 3,
    truebung: 2,
    wassertemperatur: 2,
    licht: 3,
    tageszeit: 3,
    wind: 1,
    solunar: 3,
  },
  aal: {
    luftdruckTrend: 2,
    pegelNiveau: 3,
    truebung: 3,
    wassertemperatur: 3,
    licht: 1,
    tageszeit: 3,
    wind: 0,
    solunar: 3,
  },
  karpfen: {
    luftdruckTrend: 3,
    pegelNiveau: 1,
    truebung: 2,
    wassertemperatur: 3,
    licht: 2,
    tageszeit: 1,
    wind: 1,
    solunar: 2,
  },
}
