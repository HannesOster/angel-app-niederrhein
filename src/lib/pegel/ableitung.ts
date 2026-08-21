import type { PegelMesswert } from '@/lib/quellen/pegelonline'

export interface PegelLage {
  wasserstandCm: number | null
  /** -1 sehr niedrig, 0 mittel, +1 sehr hoch */
  niveauRelativ: number | null
  aenderung24hCm: number | null
  /** true = geschätzt aus dem Rheinpegel, nicht gemessen (Spec §4.4) */
  abgeleitet: boolean
  /** true = in die Zukunft fortgeschrieben, keine Messung (Spec §12.3) */
  vorhergesagt: boolean
  quelle: string
}

const STUNDE = 3_600_000
/** Ein Messwert gilt für höchstens so lange als gültig */
const MAX_ABSTAND_MS = 6 * STUNDE
/** Trendfenster für die Fortschreibung */
const TREND_FENSTER_MS = 48 * STUNDE
/** Ab hier verliert die Fortschreibung ihre Kraft */
const DAEMPFUNG_HALBWERT_MS = 36 * STUNDE

/**
 * Schreibt den Pegel über den letzten Messwert hinaus fort: linearer Trend
 * der letzten 48 h, mit wachsendem Abstand exponentiell gedämpft. Ergibt für
 * die Vorschau brauchbare Werte, ohne nach einer Woche Unsinn zu behaupten.
 * Immer als Schätzung gekennzeichnet.
 */
export function fortschreiben(
  messwerte: PegelMesswert[],
  zeitpunkt: Date,
): { wasserstandCm: number; geschaetzt: boolean } | null {
  if (messwerte.length === 0) return null

  const sortiert = [...messwerte].sort((a, b) => a.zeit.getTime() - b.zeit.getTime())
  const letzter = sortiert[sortiert.length - 1]

  const abstandMs = zeitpunkt.getTime() - letzter.zeit.getTime()
  if (abstandMs <= 0) return null

  const fensterStart = letzter.zeit.getTime() - TREND_FENSTER_MS
  const imFenster = sortiert.filter((m) => m.zeit.getTime() >= fensterStart)
  const erster = imFenster[0]

  const spanneMs = letzter.zeit.getTime() - erster.zeit.getTime()
  const steigungProMs =
    spanneMs <= 0 ? 0 : (letzter.wasserstandCm - erster.wasserstandCm) / spanneMs

  // Gedämpfte Fortschreibung: die wirksame Zeit läuft gegen einen Grenzwert.
  const wirksameMs = DAEMPFUNG_HALBWERT_MS * (1 - Math.exp(-abstandMs / DAEMPFUNG_HALBWERT_MS))

  return {
    wasserstandCm: Math.round(letzter.wasserstandCm + steigungProMs * wirksameMs),
    geschaetzt: true,
  }
}

export function statistik(messwerte: PegelMesswert[]): { mittel: number; spanne: number } {
  if (messwerte.length === 0) return { mittel: 0, spanne: 1 }

  const werte = messwerte.map((m) => m.wasserstandCm)
  const mittel = werte.reduce((a, b) => a + b, 0) / werte.length
  const spanne = Math.max(1, Math.max(...werte) - Math.min(...werte))

  return { mittel, spanne }
}

function wertBei(
  messwerte: PegelMesswert[],
  zeitpunkt: Date,
): { cm: number; vorhergesagt: boolean } | null {
  let bester: PegelMesswert | null = null
  let besterAbstand = Infinity

  for (const m of messwerte) {
    const abstand = Math.abs(m.zeit.getTime() - zeitpunkt.getTime())
    if (abstand < besterAbstand) {
      besterAbstand = abstand
      bester = m
    }
  }

  if (bester && besterAbstand <= MAX_ABSTAND_MS) {
    return { cm: bester.wasserstandCm, vorhergesagt: false }
  }

  const geschaetzt = fortschreiben(messwerte, zeitpunkt)
  if (geschaetzt) return { cm: geschaetzt.wasserstandCm, vorhergesagt: true }

  return null
}

function lage(
  messwerte: PegelMesswert[],
  zeitpunkt: Date,
  daempfung: number,
): {
  wasserstandCm: number | null
  niveauRelativ: number | null
  aenderung24hCm: number | null
  vorhergesagt: boolean
} {
  const jetzt = wertBei(messwerte, zeitpunkt)
  if (jetzt === null) {
    return { wasserstandCm: null, niveauRelativ: null, aenderung24hCm: null, vorhergesagt: false }
  }

  const vor24h = wertBei(messwerte, new Date(zeitpunkt.getTime() - 24 * STUNDE))
  const { mittel, spanne } = statistik(messwerte)

  const niveauRoh = ((jetzt.cm - mittel) / (spanne / 2)) * daempfung
  const niveauRelativ = Math.min(1, Math.max(-1, niveauRoh))
  const aenderung24hCm = vor24h === null ? null : (jetzt.cm - vor24h.cm) * daempfung

  return { wasserstandCm: jetzt.cm, niveauRelativ, aenderung24hCm, vorhergesagt: jetzt.vorhergesagt }
}

export function pegelLageFuerRhein(
  messwerte: PegelMesswert[],
  zeitpunkt: Date,
  station: string,
): PegelLage {
  const ergebnis = lage(messwerte, zeitpunkt, 1)
  return {
    ...ergebnis,
    abgeleitet: false,
    quelle: ergebnis.vorhergesagt ? `Pegel ${station} (Trend fortgeschrieben)` : `Pegel ${station}`,
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
  const ergebnis = lage(messwerte, verschoben, daempfung)

  return {
    ...ergebnis,
    abgeleitet: true,
    quelle: ergebnis.vorhergesagt
      ? `geschätzt, abgeleitet von Pegel ${station} (Trend fortgeschrieben)`
      : `geschätzt, abgeleitet von Pegel ${station}`,
  }
}
