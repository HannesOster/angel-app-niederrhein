import { describe, it, expect } from 'vitest'
import { berechneFaktor, tagesphase } from './faktoren'
import { FAKTOR_KEYS, FISCHE, type Bedingungen } from './typen'

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

describe('tagesphase', () => {
  const auf = new Date('2026-08-21T04:30:00Z')
  const unter = new Date('2026-08-21T18:45:00Z')

  it('erkennt Nacht', () => {
    expect(tagesphase(new Date('2026-08-21T02:00:00Z'), auf, unter)).toBe('nacht')
  })
  it('erkennt Tag', () => {
    expect(tagesphase(new Date('2026-08-21T12:00:00Z'), auf, unter)).toBe('tag')
  })
  it('erkennt Morgendämmerung', () => {
    expect(tagesphase(new Date('2026-08-21T04:45:00Z'), auf, unter)).toBe('daemmerung')
  })
  it('erkennt Abenddämmerung', () => {
    expect(tagesphase(new Date('2026-08-21T18:30:00Z'), auf, unter)).toBe('daemmerung')
  })
})

describe('berechneFaktor — Wertebereich', () => {
  it('liefert für jeden Faktor und jeden Fisch einen Wert in [-1, 1]', () => {
    for (const key of FAKTOR_KEYS) {
      for (const fisch of FISCHE) {
        for (const b of [
          basis(),
          basis({ luftdruckTrend24hHpa: -20, windKmh: 80, wassertemperaturC: 35 }),
          basis({ luftdruckTrend24hHpa: 20, windKmh: 0, wassertemperaturC: -2 }),
          basis({ pegelNiveauRelativ: 1, pegelAenderung24hCm: 120 }),
          basis({ pegelNiveauRelativ: -1, pegelAenderung24hCm: -120 }),
        ]) {
          const { roh } = berechneFaktor(key, b, fisch)
          if (roh === null) continue
          expect(roh, `${key}/${fisch}`).toBeGreaterThanOrEqual(-1)
          expect(roh, `${key}/${fisch}`).toBeLessThanOrEqual(1)
        }
      }
    }
  })
})

describe('berechneFaktor — fehlende Daten', () => {
  it('meldet null für Pegel-Niveau ohne Pegeldaten', () => {
    const b = basis({ pegelNiveauRelativ: null, pegelAenderung24hCm: null })
    expect(berechneFaktor('pegelNiveau', b, 'hecht').roh).toBeNull()
  })
  it('meldet null für Trübung ohne Pegeldaten', () => {
    const b = basis({ pegelNiveauRelativ: null, pegelAenderung24hCm: null })
    expect(berechneFaktor('truebung', b, 'aal').roh).toBeNull()
  })
  it('meldet null für Wassertemperatur ohne Messwert', () => {
    const b = basis({ wassertemperaturC: null })
    expect(berechneFaktor('wassertemperatur', b, 'karpfen').roh).toBeNull()
  })
})

describe('berechneFaktor — Fachlogik', () => {
  it('belohnt fallenden Luftdruck beim Hecht', () => {
    const fallend = berechneFaktor('luftdruckTrend', basis({ luftdruckTrend24hHpa: -4 }), 'hecht')
    const steigend = berechneFaktor('luftdruckTrend', basis({ luftdruckTrend24hHpa: 4 }), 'hecht')
    expect(fallend.roh!).toBeGreaterThan(steigend.roh!)
  })

  it('belohnt stabilen Hochdruck beim Karpfen', () => {
    const stabilHoch = berechneFaktor(
      'luftdruckTrend',
      basis({ luftdruckHpa: 1024, luftdruckTrend24hHpa: 0 }),
      'karpfen',
    )
    const fallendTief = berechneFaktor(
      'luftdruckTrend',
      basis({ luftdruckHpa: 998, luftdruckTrend24hHpa: -6 }),
      'karpfen',
    )
    expect(stabilHoch.roh!).toBeGreaterThan(fallendTief.roh!)
  })

  it('belohnt hohes ruhiges Wasser beim Zander stärker als niedriges', () => {
    const hochRuhig = berechneFaktor(
      'pegelNiveau',
      basis({ pegelNiveauRelativ: 0.8, pegelAenderung24hCm: 2 }),
      'zander',
    )
    const niedrig = berechneFaktor(
      'pegelNiveau',
      basis({ pegelNiveauRelativ: -0.8, pegelAenderung24hCm: 2 }),
      'zander',
    )
    expect(hochRuhig.roh!).toBeGreaterThan(niedrig.roh!)
  })

  it('entwertet hohes Wasser, wenn es sich schnell bewegt', () => {
    const ruhig = berechneFaktor(
      'pegelNiveau',
      basis({ pegelNiveauRelativ: 0.8, pegelAenderung24hCm: 0 }),
      'zander',
    )
    const hektisch = berechneFaktor(
      'pegelNiveau',
      basis({ pegelNiveauRelativ: 0.8, pegelAenderung24hCm: 60 }),
      'zander',
    )
    expect(hektisch.roh!).toBeLessThan(ruhig.roh!)
  })

  it('mag der Aal trübes Wasser, der Hecht klares', () => {
    const trueb = basis({ pegelNiveauRelativ: 0.9, pegelAenderung24hCm: 40 })
    const klar = basis({ pegelNiveauRelativ: -0.5, pegelAenderung24hCm: -30 })
    expect(berechneFaktor('truebung', trueb, 'aal').roh!).toBeGreaterThan(
      berechneFaktor('truebung', klar, 'aal').roh!,
    )
    expect(berechneFaktor('truebung', klar, 'hecht').roh!).toBeGreaterThan(
      berechneFaktor('truebung', trueb, 'hecht').roh!,
    )
  })

  it('setzt beim Karpfen warmes Wasser über kaltes', () => {
    expect(berechneFaktor('wassertemperatur', basis({ wassertemperaturC: 21 }), 'karpfen').roh!)
      .toBeGreaterThan(
        berechneFaktor('wassertemperatur', basis({ wassertemperaturC: 6 }), 'karpfen').roh!,
      )
  })

  it('schickt den Aal in die Nacht und den Karpfen nicht', () => {
    const nachts = basis({ zeit: new Date('2026-08-21T01:00:00Z') })
    expect(berechneFaktor('tageszeit', nachts, 'aal').roh!).toBeGreaterThan(0.5)
    expect(berechneFaktor('tageszeit', nachts, 'karpfen').roh!).toBeLessThan(0)
  })

  it('nimmt die Tageszeit-Überschreibung an, wenn eine Regel sie setzt', () => {
    const mittags = basis({ zeit: new Date('2026-08-21T12:00:00Z') })
    const ohne = berechneFaktor('tageszeit', mittags, 'zander')
    const mit = berechneFaktor('tageszeit', mittags, 'zander', 0.5)
    expect(ohne.roh!).toBeLessThan(0)
    expect(mit.roh).toBe(0.5)
  })

  it('rechnet Solunar linear auf -1 bis 1 um', () => {
    expect(berechneFaktor('solunar', basis({ solunarStaerke: 1 }), 'hecht').roh).toBe(1)
    expect(berechneFaktor('solunar', basis({ solunarStaerke: 0 }), 'hecht').roh).toBe(-1)
    expect(berechneFaktor('solunar', basis({ solunarStaerke: 0.5 }), 'hecht').roh).toBe(0)
  })

  it('liefert zu jedem Faktor einen nicht-leeren Klartext', () => {
    for (const key of FAKTOR_KEYS) {
      expect(berechneFaktor(key, basis(), 'hecht').text.length).toBeGreaterThan(0)
    }
  })
})
