import { describe, it, expect } from 'vitest'
import { begrenze, optimumsKurve, naeheZu, truebungAus } from './hilfen'

describe('begrenze', () => {
  it('lässt Werte im Bereich unverändert', () => {
    expect(begrenze(0.5, -1, 1)).toBe(0.5)
  })
  it('kappt nach oben und unten', () => {
    expect(begrenze(9, -1, 1)).toBe(1)
    expect(begrenze(-9, -1, 1)).toBe(-1)
  })
})

describe('optimumsKurve', () => {
  it('gibt 1 innerhalb des Optimums', () => {
    expect(optimumsKurve(12, 8, 16, 6)).toBe(1)
    expect(optimumsKurve(8, 8, 16, 6)).toBe(1)
    expect(optimumsKurve(16, 8, 16, 6)).toBe(1)
  })
  it('fällt außerhalb linear ab', () => {
    expect(optimumsKurve(19, 8, 16, 6)).toBeCloseTo(0, 5)
    expect(optimumsKurve(5, 8, 16, 6)).toBeCloseTo(0, 5)
  })
  it('erreicht -1 am Rand der Toleranz und bleibt dort', () => {
    expect(optimumsKurve(22, 8, 16, 6)).toBe(-1)
    expect(optimumsKurve(60, 8, 16, 6)).toBe(-1)
  })
  it('behandelt nicht-positive Toleranz korrekt', () => {
    expect(optimumsKurve(12, 8, 16, 0)).toBe(1)
    expect(optimumsKurve(20, 8, 16, 0)).toBe(-1)
  })
})

describe('naeheZu', () => {
  it('gibt 1 bei Gleichheit', () => {
    expect(naeheZu(15, 15, 25)).toBe(1)
  })
  it('gibt -1 bei vollem Abstand', () => {
    expect(naeheZu(40, 15, 25)).toBe(-1)
  })
  it('gibt 0 bei halbem Abstand', () => {
    expect(naeheZu(27.5, 15, 25)).toBeCloseTo(0, 5)
  })
  it('behandelt nicht-positive Spanne korrekt', () => {
    expect(naeheZu(15, 15, 0)).toBe(1)
    expect(naeheZu(20, 15, 0)).toBe(-1)
  })
})

describe('truebungAus', () => {
  it('meldet klares Wasser bei fallendem Pegel auf niedrigem Niveau', () => {
    expect(truebungAus(-30, -0.5)).toBeLessThan(0.3)
  })
  it('meldet starke Trübung bei schnell steigendem Hochwasser', () => {
    expect(truebungAus(50, 0.9)).toBeGreaterThan(0.8)
  })
  it('bleibt immer zwischen 0 und 1', () => {
    for (const aenderung of [-200, -30, 0, 30, 200]) {
      for (const niveau of [-1, 0, 1]) {
        const t = truebungAus(aenderung, niveau)
        expect(t).toBeGreaterThanOrEqual(0)
        expect(t).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('no NaN in any function', () => {
  it('garantiert, dass keine Funktion jemals NaN liefert', () => {
    const testValues = [-1000, -100, -30, -1, 0, 1, 30, 100, 1000]
    for (const wert of testValues) {
      for (const ziel of testValues) {
        for (const param3 of [-1, 0, 1, 10]) {
          // begrenze
          expect(Number.isNaN(begrenze(wert, -100, 100))).toBe(false)
          // optimumsKurve
          expect(Number.isNaN(optimumsKurve(wert, ziel, param3, param3))).toBe(false)
          // naeheZu
          expect(Number.isNaN(naeheZu(wert, ziel, param3))).toBe(false)
          // truebungAus
          expect(Number.isNaN(truebungAus(wert, ziel))).toBe(false)
        }
      }
    }
  })
})
