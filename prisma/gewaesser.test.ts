import { describe, it, expect } from 'vitest'
import { GEWAESSER, VEREINE } from './gewaesser'

describe('GEWAESSER', () => {
  it('enthält die zwölf Gewässer aus der Spec', () => {
    expect(GEWAESSER.length).toBe(12)
  })

  it('vergibt eindeutige Slugs', () => {
    expect(new Set(GEWAESSER.map((g) => g.slug)).size).toBe(GEWAESSER.length)
  })

  it('liegt mit allen Koordinaten am Niederrhein', () => {
    for (const g of GEWAESSER) {
      expect(g.lat, g.slug).toBeGreaterThan(51.5)
      expect(g.lat, g.slug).toBeLessThan(52.0)
      expect(g.lon, g.slug).toBeGreaterThan(5.9)
      expect(g.lon, g.slug).toBeLessThan(6.6)
    }
  })

  it('hängt jedes Gewässer an Rees oder Emmerich', () => {
    for (const g of GEWAESSER) {
      expect(['REES', 'EMMERICH']).toContain(g.referenzPegel)
    }
  })

  it('markiert genau die Nicht-Rhein-Gewässer als abgeleitet', () => {
    for (const g of GEWAESSER) {
      expect(g.abgeleitet, g.slug).toBe(g.typ !== 'RHEIN')
    }
  })

  it('gibt Rhein-Gewässern keine Verzögerung und keine Dämpfung', () => {
    for (const g of GEWAESSER.filter((x) => x.typ === 'RHEIN')) {
      expect(g.verzoegerungTage).toBe(0)
      expect(g.daempfung).toBe(1)
    }
  })

  it('gibt Baggerseen mehr Verzögerung als Altrheinen', () => {
    const altrhein = GEWAESSER.filter((g) => g.typ === 'ALTRHEIN')
    const seen = GEWAESSER.filter((g) => g.typ === 'BAGGERSEE')
    const maxAltrhein = Math.max(...altrhein.map((g) => g.verzoegerungTage))
    const minSee = Math.min(...seen.map((g) => g.verzoegerungTage))
    expect(minSee).toBeGreaterThan(maxAltrhein)
  })

  it('hält alle Dämpfungen zwischen 0 und 1', () => {
    for (const g of GEWAESSER) {
      expect(g.daempfung).toBeGreaterThan(0)
      expect(g.daempfung).toBeLessThanOrEqual(1)
    }
  })

  it('verweist nur auf existierende Vereins-Slugs', () => {
    const bekannt = new Set(VEREINE.map((v) => v.slug))
    for (const g of GEWAESSER) {
      for (const slug of g.vereine) {
        expect(bekannt, `${g.slug} → ${slug}`).toContain(slug)
      }
    }
  })
})
