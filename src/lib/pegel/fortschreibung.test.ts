import { describe, it, expect } from 'vitest'
import { fortschreiben, pegelLageFuerRhein } from './ableitung'
import type { PegelMesswert } from '@/lib/quellen/pegelonline'

const ENDE = new Date('2026-08-21T00:00:00Z')

/** 5 Tage stündliche Werte, die mit 1 cm/h steigen und bei ENDE aufhören */
function steigendBis(): PegelMesswert[] {
  const werte: PegelMesswert[] = []
  for (let h = 120; h > 0; h--) {
    werte.push({
      zeit: new Date(ENDE.getTime() - h * 3_600_000),
      wasserstandCm: 400 - h,
    })
  }
  return werte
}

describe('fortschreiben', () => {
  it('liefert null ohne Messwerte', () => {
    expect(fortschreiben([], ENDE)).toBeNull()
  })

  it('liefert für die Vergangenheit nichts — dafür gibt es echte Messwerte', () => {
    const vorher = new Date(ENDE.getTime() - 5 * 3_600_000)
    expect(fortschreiben(steigendBis(), vorher)).toBeNull()
  })

  it('schreibt einen steigenden Trend nach oben fort', () => {
    const morgen = new Date(ENDE.getTime() + 24 * 3_600_000)
    const geschaetzt = fortschreiben(steigendBis(), morgen)
    expect(geschaetzt).not.toBeNull()
    expect(geschaetzt!.wasserstandCm).toBeGreaterThan(280)
    expect(geschaetzt!.geschaetzt).toBe(true)
  })

  it('dämpft mit wachsendem Abstand — der zweite Tag rückt weniger weit als der erste', () => {
    const basis = steigendBis()
    const start = basis[basis.length - 1].wasserstandCm
    const tag1 = fortschreiben(basis, new Date(ENDE.getTime() + 24 * 3_600_000))!
    const tag2 = fortschreiben(basis, new Date(ENDE.getTime() + 48 * 3_600_000))!

    const sprung1 = tag1.wasserstandCm - start
    const sprung2 = tag2.wasserstandCm - tag1.wasserstandCm
    expect(Math.abs(sprung2)).toBeLessThan(Math.abs(sprung1))
  })

  it('läuft nach vielen Tagen nicht ins Absurde', () => {
    const inZehnTagen = new Date(ENDE.getTime() + 10 * 24 * 3_600_000)
    const geschaetzt = fortschreiben(steigendBis(), inZehnTagen)!
    expect(geschaetzt.wasserstandCm).toBeLessThan(600)
    expect(geschaetzt.wasserstandCm).toBeGreaterThan(200)
  })
})

describe('pegelLageFuerRhein mit Zukunft', () => {
  it('markiert zukünftige Werte als vorhergesagt', () => {
    const morgen = new Date(ENDE.getTime() + 24 * 3_600_000)
    const lage = pegelLageFuerRhein(steigendBis(), morgen, 'REES')
    expect(lage.wasserstandCm).not.toBeNull()
    expect(lage.vorhergesagt).toBe(true)
  })

  it('markiert gegenwärtige Werte nicht als vorhergesagt', () => {
    const lage = pegelLageFuerRhein(steigendBis(), ENDE, 'REES')
    expect(lage.vorhergesagt).toBe(false)
  })

  it('liefert für die Zukunft auch eine Änderungsrate', () => {
    const morgen = new Date(ENDE.getTime() + 24 * 3_600_000)
    expect(pegelLageFuerRhein(steigendBis(), morgen, 'REES').aenderung24hCm).not.toBeNull()
  })
})
