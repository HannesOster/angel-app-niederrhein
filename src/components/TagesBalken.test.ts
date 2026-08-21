import { describe, it, expect } from 'vitest'
import { wochentagKurz, balkenHoehe } from './tagesBalkenLogik'

describe('wochentagKurz', () => {
  it('kürzt deutsche Wochentage auf zwei Buchstaben', () => {
    expect(wochentagKurz(new Date('2026-08-21T00:00:00Z'))).toBe('Fr')
    expect(wochentagKurz(new Date('2026-08-22T00:00:00Z'))).toBe('Sa')
  })
})

describe('balkenHoehe', () => {
  it('gibt volle Höhe bei 10', () => {
    expect(balkenHoehe(10)).toBe(100)
  })
  it('gibt eine Mindesthöhe bei 0, damit der Balken sichtbar bleibt', () => {
    expect(balkenHoehe(0)).toBeGreaterThan(0)
  })
  it('gibt Mindesthöhe bei null', () => {
    expect(balkenHoehe(null)).toBeGreaterThan(0)
    expect(balkenHoehe(null)).toBeLessThan(20)
  })
})
