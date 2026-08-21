import type { Bedingungen, FaktorKey, Fisch } from './typen'
import { begrenze, naeheZu, optimumsKurve, truebungAus } from './hilfen'

export type Tagesphase = 'nacht' | 'daemmerung' | 'tag'

export interface FaktorErgebnis {
  /** -1 bis 1, oder null wenn die nötigen Daten fehlen */
  roh: number | null
  text: string
}

const DAEMMERUNG_MINUTEN = 60
const MINUTE = 60_000

export function tagesphase(
  zeit: Date,
  sonnenaufgang: Date,
  sonnenuntergang: Date,
): Tagesphase {
  const t = zeit.getTime()
  const auf = sonnenaufgang.getTime()
  const unter = sonnenuntergang.getTime()
  const spanne = DAEMMERUNG_MINUTEN * MINUTE

  if (Math.abs(t - auf) <= spanne || Math.abs(t - unter) <= spanne) return 'daemmerung'
  return t > auf && t < unter ? 'tag' : 'nacht'
}

/** Wohlfühlfenster der Wassertemperatur je Art, in °C */
const TEMPERATUR_FENSTER: Record<Fisch, { von: number; bis: number }> = {
  hecht: { von: 8, bis: 16 },
  zander: { von: 10, bis: 20 },
  aal: { von: 12, bis: 26 },
  karpfen: { von: 18, bis: 24 },
}

/** Bevorzugte Trübung je Art, 0 = klar, 1 = stark getrübt */
const TRUEBUNG_OPTIMUM: Record<Fisch, number> = {
  hecht: 0.2,
  zander: 0.45,
  aal: 0.8,
  karpfen: 0.3,
}

/** Bevorzugte Dunkelheit je Art, 0 = grell, 1 = stockdunkel */
const DUNKELHEIT_OPTIMUM: Record<Fisch, number> = {
  hecht: 0.6,
  zander: 0.9,
  aal: 0.5,
  karpfen: 0.2,
}

/** Bevorzugte Windgeschwindigkeit je Art, in km/h */
const WIND_OPTIMUM: Record<Fisch, number> = {
  hecht: 15,
  zander: 12,
  aal: 8,
  karpfen: 5,
}

const TAGESZEIT_WERTE: Record<Fisch, Record<Tagesphase, number>> = {
  hecht: { daemmerung: 1, tag: 0.2, nacht: -0.3 },
  zander: { daemmerung: 1, tag: -0.4, nacht: 0.7 },
  aal: { daemmerung: 0.4, tag: -1, nacht: 1 },
  karpfen: { daemmerung: 0.6, tag: 0.3, nacht: -0.2 },
}

function zahl(wert: number, stellen = 1): string {
  return wert.toFixed(stellen).replace('.', ',')
}

export function berechneFaktor(
  key: FaktorKey,
  b: Bedingungen,
  fisch: Fisch,
  tageszeitUeberschreibung?: number,
): FaktorErgebnis {
  switch (key) {
    case 'luftdruckTrend': {
      const richtung =
        b.luftdruckTrend24hHpa < -0.5
          ? 'fällt'
          : b.luftdruckTrend24hHpa > 0.5
            ? 'steigt'
            : 'ist stabil'
      const text = `Luftdruck ${richtung} (${zahl(b.luftdruckTrend24hHpa)} hPa/24 h, ${Math.round(b.luftdruckHpa)} hPa)`

      if (fisch === 'karpfen') {
        // Karpfen mag stabiles Hochdruckwetter.
        const stabilitaet = begrenze(1 - Math.abs(b.luftdruckTrend24hHpa) / 3, -1, 1)
        const niveau = begrenze((b.luftdruckHpa - 1010) / 12, -1, 1)
        return { roh: begrenze(0.5 * stabilitaet + 0.5 * niveau, -1, 1), text }
      }
      // Raubfisch reagiert auf fallenden Druck.
      return { roh: begrenze(-b.luftdruckTrend24hHpa / 4, -1, 1), text }
    }

    case 'pegelNiveau': {
      if (b.pegelNiveauRelativ === null || b.pegelAenderung24hCm === null) {
        return { roh: null, text: 'Pegel unbekannt' }
      }
      const ruhe = begrenze(1 - Math.abs(b.pegelAenderung24hCm) / 40, 0, 1)
      const roh = begrenze(b.pegelNiveauRelativ * ruhe, -1, 1)
      const lage =
        b.pegelNiveauRelativ > 0.3 ? 'hoch' : b.pegelNiveauRelativ < -0.3 ? 'niedrig' : 'mittel'
      const bewegung = ruhe > 0.6 ? 'ruhig' : 'in Bewegung'
      return { roh, text: `Pegel ${lage} und ${bewegung} (${zahl(b.pegelAenderung24hCm, 0)} cm/24 h)` }
    }

    case 'truebung': {
      if (b.pegelNiveauRelativ === null || b.pegelAenderung24hCm === null) {
        return { roh: null, text: 'Trübung nicht ableitbar — Pegel unbekannt' }
      }
      const t = truebungAus(b.pegelAenderung24hCm, b.pegelNiveauRelativ)
      const roh = naeheZu(t, TRUEBUNG_OPTIMUM[fisch], 1)
      const beschreibung = t > 0.65 ? 'stark getrübt' : t > 0.35 ? 'leicht trüb' : 'klar'
      return { roh, text: `Wasser ${beschreibung} (aus Pegelbewegung abgeleitet)` }
    }

    case 'wassertemperatur': {
      if (b.wassertemperaturC === null) {
        return { roh: null, text: 'Wassertemperatur liegt nicht vor' }
      }
      const { von, bis } = TEMPERATUR_FENSTER[fisch]
      return {
        roh: optimumsKurve(b.wassertemperaturC, von, bis, 8),
        text: `Wasser ${zahl(b.wassertemperaturC)} °C (gut: ${von}–${bis} °C)`,
      }
    }

    case 'licht': {
      const phase = tagesphase(b.zeit, b.sonnenaufgang, b.sonnenuntergang)
      const helligkeit =
        phase === 'nacht' ? 0 : (1 - b.bewoelkungProzent / 100) * (phase === 'daemmerung' ? 0.4 : 1)
      const dunkelheit = 1 - helligkeit
      return {
        roh: naeheZu(dunkelheit, DUNKELHEIT_OPTIMUM[fisch], 1),
        text: `Bewölkung ${Math.round(b.bewoelkungProzent)} %, ${phase === 'nacht' ? 'dunkel' : phase === 'daemmerung' ? 'Dämmerlicht' : 'Tageslicht'}`,
      }
    }

    case 'tageszeit': {
      const phase = tagesphase(b.zeit, b.sonnenaufgang, b.sonnenuntergang)
      const beschriftung = { nacht: 'Nacht', daemmerung: 'Dämmerung', tag: 'Tag' }[phase]
      if (tageszeitUeberschreibung !== undefined) {
        return {
          roh: begrenze(tageszeitUeberschreibung, -1, 1),
          text: `${beschriftung} — durch Regel angehoben`,
        }
      }
      return { roh: TAGESZEIT_WERTE[fisch][phase], text: beschriftung }
    }

    case 'wind': {
      return {
        roh: naeheZu(b.windKmh, WIND_OPTIMUM[fisch], 25),
        text: `Wind ${Math.round(b.windKmh)} km/h`,
      }
    }

    case 'solunar': {
      const roh = begrenze(2 * b.solunarStaerke - 1, -1, 1)
      const lage =
        b.solunarStaerke > 0.75 ? 'Hauptbeißzeit' : b.solunarStaerke > 0.45 ? 'Nebenbeißzeit' : 'außerhalb der Mondzeiten'
      return { roh, text: `Solunar: ${lage}` }
    }
  }
}
