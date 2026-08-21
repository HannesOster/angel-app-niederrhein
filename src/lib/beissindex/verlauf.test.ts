import { describe, it, expect } from 'vitest'
import { berechneStunden, fasseZuTagenZusammen, besteZeitspanne } from './verlauf'
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

function zweiTage(): Bedingungen[] {
  const liste: Bedingungen[] = []
  for (const tag of ['2026-08-21', '2026-08-22']) {
    for (let h = 0; h < 24; h++) {
      const hh = String(h).padStart(2, '0')
      liste.push(stunde(`${tag}T${hh}:00:00Z`))
    }
  }
  return liste
}

describe('berechneStunden', () => {
  it('liefert genau einen Wert je Eingabestunde', () => {
    const stunden = berechneStunden(zweiTage(), 'hecht')
    expect(stunden).toHaveLength(48)
  })

  it('behält die Reihenfolge bei', () => {
    const stunden = berechneStunden(zweiTage(), 'hecht')
    for (let i = 1; i < stunden.length; i++) {
      expect(stunden[i].zeit.getTime()).toBeGreaterThan(stunden[i - 1].zeit.getTime())
    }
  })
})

describe('fasseZuTagenZusammen', () => {
  it('bildet einen Eintrag je Kalendertag', () => {
    const tage = fasseZuTagenZusammen(berechneStunden(zweiTage(), 'aal'))
    expect(tage).toHaveLength(2)
  })

  it('nimmt die beste Stunde, nicht den Durchschnitt', () => {
    const stunden = berechneStunden(zweiTage(), 'aal')
    const tage = fasseZuTagenZusammen(stunden)

    const ersterTag = stunden.filter((s) => s.zeit.toISOString().startsWith('2026-08-21'))
    const werte = ersterTag.map((s) => s.ergebnis.wert).filter((w): w is number => w !== null)
    const maximum = Math.max(...werte)
    const durchschnitt = werte.reduce((a, b) => a + b, 0) / werte.length

    expect(tage[0].wert).toBeCloseTo(maximum, 5)
    expect(tage[0].wert!).toBeGreaterThan(durchschnitt)
  })

  it('nennt die Uhrzeit der besten Stunde', () => {
    const tage = fasseZuTagenZusammen(berechneStunden(zweiTage(), 'aal'))
    expect(tage[0].besteStunde).not.toBeNull()
  })

  it('meldet unsicher, wenn ein Tag nur unsichere Stunden hat', () => {
    const alt = zweiTage().map((b) => ({ ...b, datenAlterMinuten: 999 }))
    const tage = fasseZuTagenZusammen(berechneStunden(alt, 'hecht'))
    expect(tage[0].unsicher).toBe(true)
    expect(tage[0].wert).toBeNull()
  })
})

describe('besteZeitspanne', () => {
  it('liefert eine zusammenhängende Spanne um die beste Stunde', () => {
    const stunden = berechneStunden(zweiTage(), 'aal')
    const spanne = besteZeitspanne(stunden, new Date('2026-08-21T00:00:00Z'))
    expect(spanne).not.toBeNull()
    expect(spanne!.von.getTime()).toBeLessThan(spanne!.bis.getTime())
  })

  it('liefert null, wenn es keine Werte für den Tag gibt', () => {
    const stunden = berechneStunden(zweiTage(), 'aal')
    expect(besteZeitspanne(stunden, new Date('2030-01-01T00:00:00Z'))).toBeNull()
  })
})
