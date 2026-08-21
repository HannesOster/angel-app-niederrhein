import { describe, it, expect } from 'vitest'
import { berechneStunden, fasseZuTagenZusammen, besteZeitspanne } from './verlauf'
import type { StundenWert } from './verlauf'
import type { Bedingungen } from './typen'

function stunde(datumISO: string, ueberschreibung: Partial<Bedingungen> = {}): Bedingungen {
  return {
    zeit: new Date(datumISO),
    luftdruckHpa: 1013,
    luftdruckTrend24hHpa: 0,
    pegelNiveauRelativ: 0,
    pegelAenderung24hCm: 0,
    wassertemperaturC: 14,
    bewoelkungProzent: 50,
    windKmh: 10,
    sonnenaufgang: new Date(`${datumISO.slice(0, 10)}T04:30:00Z`),
    sonnenuntergang: new Date(`${datumISO.slice(0, 10)}T18:45:00Z`),
    solunarStaerke: 0.2,
    datenAlterMinuten: 5,
    ...ueberschreibung,
  }
}

/**
 * 48 Stunden, die exakt zwei VOLLSTÄNDIGE lokale Kalendertage (Europe/Berlin,
 * hier CEST/UTC+2) abdecken: 2026-08-21 und 2026-08-22. Start ist bewusst
 * UTC 2026-08-20T22:00, das lokal 2026-08-21T00:00 entspricht — sonst würden
 * die letzten zwei UTC-Stunden jedes Tages (22–23 Uhr UTC = 00–01 Uhr Ortszeit
 * des Folgetags) den lokalen Tag verschieben und die Gruppierung auf 3 Tage
 * statt 2 aufsplitten.
 */
function zweiLokaleTage(): Bedingungen[] {
  const start = new Date('2026-08-20T22:00:00Z').getTime()
  const liste: Bedingungen[] = []
  for (let h = 0; h < 48; h++) {
    liste.push(stunde(new Date(start + h * 3_600_000).toISOString()))
  }
  return liste
}

describe('berechneStunden', () => {
  it('liefert genau einen Wert je Eingabestunde', () => {
    const stunden = berechneStunden(zweiLokaleTage(), 'hecht')
    expect(stunden).toHaveLength(48)
  })

  it('behält die Reihenfolge bei', () => {
    const stunden = berechneStunden(zweiLokaleTage(), 'hecht')
    for (let i = 1; i < stunden.length; i++) {
      expect(stunden[i].zeit.getTime()).toBeGreaterThan(stunden[i - 1].zeit.getTime())
    }
  })
})

describe('fasseZuTagenZusammen', () => {
  it('bildet einen Eintrag je Kalendertag', () => {
    const tage = fasseZuTagenZusammen(berechneStunden(zweiLokaleTage(), 'aal'))
    expect(tage).toHaveLength(2)
  })

  it('nimmt die beste Stunde, nicht den Durchschnitt', () => {
    const stunden = berechneStunden(zweiLokaleTage(), 'aal')
    const tage = fasseZuTagenZusammen(stunden)

    // Die ersten 24 Einträge sind exakt der erste lokale Kalendertag
    // (2026-08-21T00:00 bis 23:00 Ortszeit), siehe zweiLokaleTage().
    const ersterTag = stunden.slice(0, 24)
    const werte = ersterTag.map((s) => s.ergebnis.wert).filter((w): w is number => w !== null)
    const maximum = Math.max(...werte)
    const durchschnitt = werte.reduce((a, b) => a + b, 0) / werte.length

    expect(tage[0].wert).toBeCloseTo(maximum, 5)
    expect(tage[0].wert!).toBeGreaterThan(durchschnitt)
  })

  it('nennt die Uhrzeit der besten Stunde', () => {
    const tage = fasseZuTagenZusammen(berechneStunden(zweiLokaleTage(), 'aal'))
    expect(tage[0].besteStunde).not.toBeNull()
  })

  it('meldet unsicher, wenn ein Tag nur unsichere Stunden hat', () => {
    const alt = zweiLokaleTage().map((b) => ({ ...b, datenAlterMinuten: 999 }))
    const tage = fasseZuTagenZusammen(berechneStunden(alt, 'hecht'))
    expect(tage[0].unsicher).toBe(true)
    expect(tage[0].wert).toBeNull()
  })
})

describe('lokale Tagesgrenze (Europe/Berlin statt UTC)', () => {
  it('ordnet 22:30 UTC (00:30 Ortszeit MESZ) dem Folgetag zu', () => {
    const stunden = berechneStunden([stunde('2026-08-21T22:30:00Z')], 'hecht')
    const tage = fasseZuTagenZusammen(stunden)
    expect(tage[0].tag.toISOString().slice(0, 10)).toBe('2026-08-22')
  })

  it('lässt 21:30 UTC (23:30 Ortszeit MESZ) beim selben Tag', () => {
    const stunden = berechneStunden([stunde('2026-08-21T21:30:00Z')], 'hecht')
    const tage = fasseZuTagenZusammen(stunden)
    expect(tage[0].tag.toISOString().slice(0, 10)).toBe('2026-08-21')
  })

  it('behandelt die Winterzeit korrekt: 23:30 UTC (00:30 Ortszeit MEZ) gehört zum Folgetag', () => {
    const stunden = berechneStunden([stunde('2026-01-15T23:30:00Z')], 'hecht')
    const tage = fasseZuTagenZusammen(stunden)
    expect(tage[0].tag.toISOString().slice(0, 10)).toBe('2026-01-16')
  })

  it('besteZeitspanne findet die beste Stunde eines lokalen Tages, auch wenn er in UTC über zwei Kalendertage verteilt liegt', () => {
    const stunden = berechneStunden(zweiLokaleTage(), 'aal')
    const tage = fasseZuTagenZusammen(stunden)
    const zweiterTag = tage.find((t) => t.tag.toISOString().slice(0, 10) === '2026-08-22')
    expect(zweiterTag).toBeDefined()

    const spanne = besteZeitspanne(stunden, zweiterTag!.tag)
    expect(spanne).not.toBeNull()
    expect(spanne!.von.getTime()).toBeLessThan(spanne!.bis.getTime())
  })
})

describe('besteZeitspanne', () => {
  it('liefert eine zusammenhängende Spanne um die beste Stunde', () => {
    const stunden = berechneStunden(zweiLokaleTage(), 'aal')
    const tage = fasseZuTagenZusammen(stunden)
    const spanne = besteZeitspanne(stunden, tage[0].tag)
    expect(spanne).not.toBeNull()
    expect(spanne!.von.getTime()).toBeLessThan(spanne!.bis.getTime())
  })

  it('liefert null, wenn es keine Werte für den Tag gibt', () => {
    const stunden = berechneStunden(zweiLokaleTage(), 'aal')
    expect(besteZeitspanne(stunden, new Date('2030-01-01T00:00:00Z'))).toBeNull()
  })

  it('liefert null, wenn an einem Tag alle Stundenwerte 0 sind (sonst würde die Schwelle 0 * 0.85 = 0 jede Stunde einschließen)', () => {
    const nullStunden: StundenWert[] = [0, 6, 12, 18].map((h) => ({
      zeit: new Date(`2026-08-21T${String(h).padStart(2, '0')}:00:00Z`),
      ergebnis: { wert: 0, unsicher: false, unsicherGrund: null, beitraege: [], regeln: [] },
    }))
    expect(besteZeitspanne(nullStunden, new Date('2026-08-21T00:00:00Z'))).toBeNull()
  })
})
