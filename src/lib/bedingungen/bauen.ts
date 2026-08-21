import { solunarStaerke, type Bedingungen } from '@/lib/beissindex'
import type { WetterStundeRoh } from '@/lib/quellen/openmeteo'
import type { PegelMesswert } from '@/lib/quellen/pegelonline'
import { pegelLageAbgeleitet, pegelLageFuerRhein } from '@/lib/pegel/ableitung'

export interface GewaesserStamm {
  lat: number
  lon: number
  typ: 'RHEIN' | 'ALTRHEIN' | 'BAGGERSEE'
  referenzPegel: string
  verzoegerungTage: number
  daempfung: number
}

export function luftdruckTrend(wetter: WetterStundeRoh[], index: number): number {
  const vorher = index - 24
  if (vorher < 0) return 0
  return wetter[index].luftdruckHpa - wetter[vorher].luftdruckHpa
}

/**
 * Ersatz-Wassertemperatur für Seen und Altrheine: Mittel der Lufttemperatur
 * der letzten 72 h. Ausdrücklich eine Näherung (Spec §4.5) — die echte
 * Seetemperatur misst niemand.
 */
function wassertemperaturAusLuft(wetter: WetterStundeRoh[], index: number): number {
  const von = Math.max(0, index - 72)
  const fenster = wetter.slice(von, index + 1)
  const summe = fenster.reduce((a, s) => a + s.lufttemperaturC, 0)
  return summe / fenster.length
}

export function baueBedingungen(
  stamm: GewaesserStamm,
  wetter: WetterStundeRoh[],
  pegel: PegelMesswert[],
  jetzt: Date,
): Bedingungen[] {
  return wetter.map((stunde, i) => {
    const lage =
      stamm.typ === 'RHEIN'
        ? pegelLageFuerRhein(pegel, stunde.zeit, stamm.referenzPegel)
        : pegelLageAbgeleitet(
            pegel,
            stunde.zeit,
            stamm.referenzPegel,
            stamm.verzoegerungTage,
            stamm.daempfung,
          )

    // `lage.vorhergesagt` markiert fortgeschriebene (nicht gemessene) Pegelwerte.
    // Der Rechenkern kennt dieses Feld heute nicht — es steckt aber bereits in
    // `lage.quelle` als Klartext, den eine spätere Oberfläche anzeigen kann.
    const wassertemperaturC = stamm.typ === 'RHEIN' ? null : wassertemperaturAusLuft(wetter, i)

    const alterMs = Math.max(0, jetzt.getTime() - stunde.zeit.getTime())

    return {
      zeit: stunde.zeit,
      luftdruckHpa: stunde.luftdruckHpa,
      luftdruckTrend24hHpa: luftdruckTrend(wetter, i),
      pegelNiveauRelativ: lage.niveauRelativ,
      pegelAenderung24hCm: lage.aenderung24hCm,
      wassertemperaturC,
      bewoelkungProzent: stunde.bewoelkung,
      windKmh: stunde.windKmh,
      sonnenaufgang: stunde.sonnenaufgang,
      sonnenuntergang: stunde.sonnenuntergang,
      solunarStaerke: solunarStaerke(stunde.zeit, stamm.lat, stamm.lon),
      datenAlterMinuten: alterMs / 60_000,
    }
  })
}
