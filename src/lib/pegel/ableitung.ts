import type { PegelMesswert } from '@/lib/quellen/pegelonline'

export interface PegelLage {
  wasserstandCm: number | null
  /** -1 sehr niedrig, 0 mittel, +1 sehr hoch */
  niveauRelativ: number | null
  aenderung24hCm: number | null
  /** true = geschätzt aus dem Rheinpegel, nicht gemessen (Spec §4.4) */
  abgeleitet: boolean
  quelle: string
}

const STUNDE = 3_600_000
/** Ein Messwert gilt für höchstens so lange als gültig */
const MAX_ABSTAND_MS = 6 * STUNDE

export function statistik(messwerte: PegelMesswert[]): { mittel: number; spanne: number } {
  if (messwerte.length === 0) return { mittel: 0, spanne: 1 }

  const werte = messwerte.map((m) => m.wasserstandCm)
  const mittel = werte.reduce((a, b) => a + b, 0) / werte.length
  const spanne = Math.max(1, Math.max(...werte) - Math.min(...werte))

  return { mittel, spanne }
}

function wertBei(messwerte: PegelMesswert[], zeitpunkt: Date): number | null {
  let bester: PegelMesswert | null = null
  let besterAbstand = Infinity

  for (const m of messwerte) {
    const abstand = Math.abs(m.zeit.getTime() - zeitpunkt.getTime())
    if (abstand < besterAbstand) {
      besterAbstand = abstand
      bester = m
    }
  }

  if (!bester || besterAbstand > MAX_ABSTAND_MS) return null
  return bester.wasserstandCm
}

function lage(
  messwerte: PegelMesswert[],
  zeitpunkt: Date,
  daempfung: number,
): { wasserstandCm: number | null; niveauRelativ: number | null; aenderung24hCm: number | null } {
  const jetzt = wertBei(messwerte, zeitpunkt)
  if (jetzt === null) {
    return { wasserstandCm: null, niveauRelativ: null, aenderung24hCm: null }
  }

  const vor24h = wertBei(messwerte, new Date(zeitpunkt.getTime() - 24 * STUNDE))
  const { mittel, spanne } = statistik(messwerte)

  const niveauRoh = ((jetzt - mittel) / (spanne / 2)) * daempfung
  const niveauRelativ = Math.min(1, Math.max(-1, niveauRoh))
  const aenderung24hCm = vor24h === null ? null : (jetzt - vor24h) * daempfung

  return { wasserstandCm: jetzt, niveauRelativ, aenderung24hCm }
}

export function pegelLageFuerRhein(
  messwerte: PegelMesswert[],
  zeitpunkt: Date,
  station: string,
): PegelLage {
  return {
    ...lage(messwerte, zeitpunkt, 1),
    abgeleitet: false,
    quelle: `Pegel ${station}`,
  }
}

/**
 * Wasserstand eines Sees oder Altrheins: der Rheinstand von vor
 * `verzoegerungTage` Tagen, gedämpft um `daempfung` (Spec §4.4).
 * Immer als abgeleitet gekennzeichnet.
 */
export function pegelLageAbgeleitet(
  messwerte: PegelMesswert[],
  zeitpunkt: Date,
  station: string,
  verzoegerungTage: number,
  daempfung: number,
): PegelLage {
  const verschoben = new Date(zeitpunkt.getTime() - verzoegerungTage * 24 * STUNDE)

  return {
    ...lage(messwerte, verschoben, daempfung),
    abgeleitet: true,
    quelle: `geschätzt, abgeleitet von Pegel ${station}`,
  }
}
