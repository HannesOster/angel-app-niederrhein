import { describe, it, expect } from 'vitest'
import { indexFarbe, INDEX_HEX } from './farben'

describe('indexFarbe', () => {
  it('gibt grau für unsichere Werte', () => {
    expect(indexFarbe(null)).toBe('grau')
  })
  it('gibt grün ab 7,0', () => {
    expect(indexFarbe(7)).toBe('gruen')
    expect(indexFarbe(9.9)).toBe('gruen')
  })
  it('gibt gelb ab 4,5 bis unter 7,0', () => {
    expect(indexFarbe(4.5)).toBe('gelb')
    expect(indexFarbe(6.9)).toBe('gelb')
  })
  it('gibt rot unter 4,5', () => {
    expect(indexFarbe(4.4)).toBe('rot')
    expect(indexFarbe(0)).toBe('rot')
  })
  it('hält für jede Stufe einen Hex-Wert bereit', () => {
    for (const stufe of ['gruen', 'gelb', 'rot', 'grau'] as const) {
      expect(INDEX_HEX[stufe]).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})
