import { describe, it, expect } from 'vitest'
import { statistik, pegelLageFuerRhein, pegelLageAbgeleitet } from './ableitung'
import type { PegelMesswert } from '@/lib/quellen/pegelonline'

/** 10 Tage stündliche Messwerte, die linear von 300 auf 540 cm steigen */
function steigend(): PegelMesswert[] {
  const start = new Date('2026-08-12T00:00:00Z').getTime()
  const werte: PegelMesswert[] = []
  for (let h = 0; h < 240; h++) {
    werte.push({
      zeit: new Date(start + h * 3_600_000),
      wasserstandCm: 300 + h,
    })
  }
  return werte
}

const JETZT = new Date('2026-08-21T00:00:00Z')

describe('statistik', () => {
  it('berechnet Mittel und Spanne', () => {
    const { mittel, spanne } = statistik(steigend())
    expect(mittel).toBeCloseTo(419.5, 0)
    expect(spanne).toBe(239)
  })

  it('kommt mit einem einzigen Messwert klar', () => {
    const { spanne } = statistik([{ zeit: JETZT, wasserstandCm: 400 }])
    expect(spanne).toBeGreaterThan(0)
  })
})

describe('pegelLageFuerRhein', () => {
  it('liefert den Wert zum Zeitpunkt', () => {
    const lage = pegelLageFuerRhein(steigend(), JETZT, 'REES')
    expect(lage.wasserstandCm).toBeGreaterThan(500)
    expect(lage.abgeleitet).toBe(false)
  })

  it('erkennt steigendes Wasser', () => {
    const lage = pegelLageFuerRhein(steigend(), JETZT, 'REES')
    expect(lage.aenderung24hCm).toBeCloseTo(24, 0)
  })

  it('normiert das Niveau auf -1 bis 1', () => {
    const lage = pegelLageFuerRhein(steigend(), JETZT, 'REES')
    expect(lage.niveauRelativ!).toBeGreaterThanOrEqual(-1)
    expect(lage.niveauRelativ!).toBeLessThanOrEqual(1)
  })

  it('meldet null bei leerer Messreihe', () => {
    const lage = pegelLageFuerRhein([], JETZT, 'REES')
    expect(lage.wasserstandCm).toBeNull()
    expect(lage.niveauRelativ).toBeNull()
    expect(lage.aenderung24hCm).toBeNull()
  })

  it('schreibt fort statt null zu melden, wenn der letzte Wert zu weit zurückliegt', () => {
    const alt = steigend().filter((m) => m.zeit < new Date('2026-08-15T00:00:00Z'))
    expect(pegelLageFuerRhein(alt, JETZT, 'REES').vorhergesagt).toBe(true)
  })
})

describe('pegelLageAbgeleitet', () => {
  it('markiert den Wert als abgeleitet und nennt die Quelle', () => {
    const lage = pegelLageAbgeleitet(steigend(), JETZT, 'REES', 3, 0.2)
    expect(lage.abgeleitet).toBe(true)
    expect(lage.quelle).toContain('REES')
  })

  it('greift auf den Rheinstand von vor N Tagen zurück', () => {
    const ohne = pegelLageAbgeleitet(steigend(), JETZT, 'REES', 0, 1)
    const mit = pegelLageAbgeleitet(steigend(), JETZT, 'REES', 3, 1)
    // Der Pegel steigt, also muss der verzögerte Wert niedriger sein.
    expect(mit.wasserstandCm!).toBeLessThan(ohne.wasserstandCm!)
  })

  it('dämpft die Bewegung', () => {
    const ungedaempft = pegelLageAbgeleitet(steigend(), JETZT, 'REES', 0, 1)
    const gedaempft = pegelLageAbgeleitet(steigend(), JETZT, 'REES', 0, 0.2)
    expect(Math.abs(gedaempft.aenderung24hCm!)).toBeLessThan(
      Math.abs(ungedaempft.aenderung24hCm!),
    )
    expect(gedaempft.aenderung24hCm!).toBeCloseTo(ungedaempft.aenderung24hCm! * 0.2, 5)
  })

  it('dämpft auch das Niveau', () => {
    const ungedaempft = pegelLageAbgeleitet(steigend(), JETZT, 'REES', 0, 1)
    const gedaempft = pegelLageAbgeleitet(steigend(), JETZT, 'REES', 0, 0.2)
    expect(Math.abs(gedaempft.niveauRelativ!)).toBeLessThan(
      Math.abs(ungedaempft.niveauRelativ!),
    )
  })

  it('meldet null, wenn für den verzögerten Zeitpunkt nichts vorliegt', () => {
    const lage = pegelLageAbgeleitet(steigend(), JETZT, 'REES', 30, 0.2)
    expect(lage.wasserstandCm).toBeNull()
  })
})
