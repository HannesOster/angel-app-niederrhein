import { describe, it, expect } from 'vitest'
import { pruefeTruebungsRegel, pruefeAenderungsBremse } from './regeln'
import type { Bedingungen } from './typen'

function basis(ueberschreibung: Partial<Bedingungen> = {}): Bedingungen {
  return {
    zeit: new Date('2026-08-21T12:00:00Z'),
    luftdruckHpa: 1013,
    luftdruckTrend24hHpa: 0,
    pegelNiveauRelativ: 0,
    pegelAenderung24hCm: 0,
    wassertemperaturC: 14,
    bewoelkungProzent: 50,
    windKmh: 10,
    sonnenaufgang: new Date('2026-08-21T04:30:00Z'),
    sonnenuntergang: new Date('2026-08-21T18:45:00Z'),
    solunarStaerke: 0.2,
    datenAlterMinuten: 5,
    ...ueberschreibung,
  }
}

const HOCHWASSER_TRUEB = { pegelNiveauRelativ: 0.95, pegelAenderung24hCm: 45 }

describe('pruefeTruebungsRegel', () => {
  it('hebt den Zander tagsüber bei starker Trübung an', () => {
    const ergebnis = pruefeTruebungsRegel(basis(HOCHWASSER_TRUEB), 'zander')
    expect(ergebnis.tageszeitUeberschreibung).toBeGreaterThan(0)
    expect(ergebnis.regel?.name).toBe('truebungsRegel')
  })

  it('greift nicht beim Hecht', () => {
    expect(pruefeTruebungsRegel(basis(HOCHWASSER_TRUEB), 'hecht').regel).toBeUndefined()
  })

  it('greift nachts nicht', () => {
    const nachts = basis({ ...HOCHWASSER_TRUEB, zeit: new Date('2026-08-21T01:00:00Z') })
    expect(pruefeTruebungsRegel(nachts, 'zander').regel).toBeUndefined()
  })

  it('greift bei klarem Wasser nicht', () => {
    const klar = basis({ pegelNiveauRelativ: -0.6, pegelAenderung24hCm: -25 })
    expect(pruefeTruebungsRegel(klar, 'zander').regel).toBeUndefined()
  })

  it('greift ohne Pegeldaten nicht', () => {
    const ohne = basis({ pegelNiveauRelativ: null, pegelAenderung24hCm: null })
    expect(pruefeTruebungsRegel(ohne, 'zander').regel).toBeUndefined()
  })
})

describe('pruefeAenderungsBremse', () => {
  it('bremst nicht bei ruhigem Pegel', () => {
    const { faktor, regel } = pruefeAenderungsBremse(basis({ pegelAenderung24hCm: 10 }))
    expect(faktor).toBe(1)
    expect(regel).toBeUndefined()
  })

  it('bremst bei schnell steigendem Wasser', () => {
    const { faktor, regel } = pruefeAenderungsBremse(basis({ pegelAenderung24hCm: 70 }))
    expect(faktor).toBeLessThan(1)
    expect(regel?.name).toBe('aenderungsBremse')
  })

  it('bremst auch bei schnell fallendem Wasser', () => {
    const { faktor } = pruefeAenderungsBremse(basis({ pegelAenderung24hCm: -70 }))
    expect(faktor).toBeLessThan(1)
  })

  it('bremst symmetrisch — Richtung ist egal', () => {
    const rauf = pruefeAenderungsBremse(basis({ pegelAenderung24hCm: 80 })).faktor
    const runter = pruefeAenderungsBremse(basis({ pegelAenderung24hCm: -80 })).faktor
    expect(rauf).toBeCloseTo(runter, 10)
  })

  it('bremst nie unter 0,5', () => {
    const { faktor } = pruefeAenderungsBremse(basis({ pegelAenderung24hCm: 500 }))
    expect(faktor).toBeGreaterThanOrEqual(0.5)
  })

  it('bremst ohne Pegeldaten nicht', () => {
    const { faktor } = pruefeAenderungsBremse(basis({ pegelAenderung24hCm: null }))
    expect(faktor).toBe(1)
  })
})
