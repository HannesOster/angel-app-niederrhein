import { describe, it, expect } from 'vitest'
import { bestimmeZugang } from './zugang'

const JETZT = new Date('2026-08-21T12:00:00Z')

describe('bestimmeZugang', () => {
  it('meldet frei bei passender Mitgliedschaft', () => {
    const status = bestimmeZugang(['asv-rees'], ['asv-rees'], [], 'g1', JETZT)
    expect(status.art).toBe('frei')
  })

  it('meldet keine Erlaubnis ohne Mitgliedschaft und ohne Karte', () => {
    expect(bestimmeZugang(['asv-rees'], ['asv-gut-bitt-wissel'], [], 'g1', JETZT).art)
      .toBe('keine')
  })

  it('meldet Tageskarte, wenn eine gültige vorliegt', () => {
    const karten = [{ gewaesserId: 'g1', bis: new Date('2026-08-22T00:00:00Z') }]
    const status = bestimmeZugang([], [], karten, 'g1', JETZT)
    expect(status.art).toBe('tageskarte')
  })

  it('ignoriert abgelaufene Tageskarten', () => {
    const karten = [{ gewaesserId: 'g1', bis: new Date('2026-08-20T00:00:00Z') }]
    expect(bestimmeZugang([], [], karten, 'g1', JETZT).art).toBe('keine')
  })

  it('ignoriert Tageskarten für ein anderes Gewässer', () => {
    const karten = [{ gewaesserId: 'g2', bis: new Date('2026-08-25T00:00:00Z') }]
    expect(bestimmeZugang([], [], karten, 'g1', JETZT).art).toBe('keine')
  })

  it('bevorzugt die Mitgliedschaft, wenn beides vorliegt', () => {
    const karten = [{ gewaesserId: 'g1', bis: new Date('2026-08-25T00:00:00Z') }]
    expect(bestimmeZugang(['asv-rees'], ['asv-rees'], karten, 'g1', JETZT).art).toBe('frei')
  })

  it('nennt bei der Tageskarte das Ablaufdatum', () => {
    const bis = new Date('2026-08-22T00:00:00Z')
    const status = bestimmeZugang([], [], [{ gewaesserId: 'g1', bis }], 'g1', JETZT)
    expect(status.art === 'tageskarte' && status.bis).toEqual(bis)
  })
})
