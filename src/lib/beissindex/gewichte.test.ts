import { describe, it, expect } from 'vitest'
import { STANDARD_GEWICHTE } from './gewichte'
import { FISCHE, FAKTOR_KEYS } from './typen'

describe('STANDARD_GEWICHTE', () => {
  it('kennt jeden Fisch', () => {
    for (const fisch of FISCHE) {
      expect(STANDARD_GEWICHTE[fisch]).toBeDefined()
    }
  })

  it('setzt für jeden Fisch jeden Faktor', () => {
    for (const fisch of FISCHE) {
      for (const key of FAKTOR_KEYS) {
        expect(typeof STANDARD_GEWICHTE[fisch][key]).toBe('number')
      }
    }
  })

  it('hält alle Gewichte zwischen 0 und 3', () => {
    for (const fisch of FISCHE) {
      for (const key of FAKTOR_KEYS) {
        const g = STANDARD_GEWICHTE[fisch][key]
        expect(g).toBeGreaterThanOrEqual(0)
        expect(g).toBeLessThanOrEqual(3)
      }
    }
  })

  it('gewichtet Solunar hoch, weil Daniel an den Mond glaubt', () => {
    expect(STANDARD_GEWICHTE.hecht.solunar).toBeGreaterThanOrEqual(3)
    expect(STANDARD_GEWICHTE.zander.solunar).toBeGreaterThanOrEqual(3)
    expect(STANDARD_GEWICHTE.aal.solunar).toBeGreaterThanOrEqual(3)
  })

  it('schaltet Wind beim Aal ab', () => {
    expect(STANDARD_GEWICHTE.aal.wind).toBe(0)
  })
})
