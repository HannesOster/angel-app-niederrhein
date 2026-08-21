import { describe, it, expect } from 'vitest'
import { berechneIndex, DATEN_MAX_ALTER_MINUTEN } from './berechne'
import { STANDARD_GEWICHTE } from './gewichte'
import { FISCHE, type Bedingungen } from './typen'

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

describe('berechneIndex — Grundverhalten', () => {
  it('liefert für jeden Fisch einen Wert zwischen 0 und 10', () => {
    for (const fisch of FISCHE) {
      const { wert } = berechneIndex(basis(), fisch)
      expect(wert).not.toBeNull()
      expect(wert!).toBeGreaterThanOrEqual(0)
      expect(wert!).toBeLessThanOrEqual(10)
    }
  })

  it('liefert zu jedem Faktor einen Beitrag', () => {
    const { beitraege } = berechneIndex(basis(), 'hecht')
    expect(beitraege).toHaveLength(8)
  })

  it('rechnet beitrag als roh mal gewicht', () => {
    const { beitraege } = berechneIndex(basis(), 'hecht')
    for (const b of beitraege) {
      if (b.fehlend) continue
      expect(b.beitrag).toBeCloseTo(b.roh * b.gewicht, 10)
    }
  })

  it('ist deterministisch — gleiche Eingabe, gleiches Ergebnis', () => {
    const a = berechneIndex(basis(), 'zander')
    const b = berechneIndex(basis(), 'zander')
    expect(a.wert).toBe(b.wert)
  })
})

describe('berechneIndex — Veralterung', () => {
  it('meldet unsicher, wenn die Daten zu alt sind', () => {
    const alt = basis({ datenAlterMinuten: DATEN_MAX_ALTER_MINUTEN + 1 })
    const ergebnis = berechneIndex(alt, 'hecht')
    expect(ergebnis.wert).toBeNull()
    expect(ergebnis.unsicher).toBe(true)
    expect(ergebnis.unsicherGrund).toContain('alt')
  })

  it('rechnet noch, wenn die Daten genau an der Grenze liegen', () => {
    const grenzwertig = basis({ datenAlterMinuten: DATEN_MAX_ALTER_MINUTEN })
    expect(berechneIndex(grenzwertig, 'hecht').wert).not.toBeNull()
  })
})

describe('berechneIndex — fehlende Daten', () => {
  it('rechnet ohne Pegeldaten weiter und markiert die Lücken', () => {
    const ohnePegel = basis({
      pegelNiveauRelativ: null,
      pegelAenderung24hCm: null,
      wassertemperaturC: null,
    })
    const ergebnis = berechneIndex(ohnePegel, 'hecht')
    expect(ergebnis.wert).not.toBeNull()
    const fehlende = ergebnis.beitraege.filter((b) => b.fehlend).map((b) => b.key)
    expect(fehlende).toContain('pegelNiveau')
    expect(fehlende).toContain('truebung')
    expect(fehlende).toContain('wassertemperatur')
  })

  it('zählt fehlende Faktoren nicht in die Summe', () => {
    const ohnePegel = basis({ pegelNiveauRelativ: null, pegelAenderung24hCm: null })
    const { beitraege } = berechneIndex(ohnePegel, 'hecht')
    for (const b of beitraege.filter((x) => x.fehlend)) {
      expect(b.beitrag).toBe(0)
    }
  })
})

describe('berechneIndex — Regeln', () => {
  it('führt die Trübungs-Regel in der Begründung auf', () => {
    const hochwasser = basis({ pegelNiveauRelativ: 0.95, pegelAenderung24hCm: 25 })
    const { regeln } = berechneIndex(hochwasser, 'zander')
    expect(regeln.map((r) => r.name)).toContain('truebungsRegel')
  })

  it('führt die Änderungs-Bremse in der Begründung auf und senkt den Wert', () => {
    const ruhig = basis({ pegelNiveauRelativ: 0.5, pegelAenderung24hCm: 5 })
    const hektisch = basis({ pegelNiveauRelativ: 0.5, pegelAenderung24hCm: 90 })
    const a = berechneIndex(ruhig, 'aal')
    const b = berechneIndex(hektisch, 'aal')
    expect(b.regeln.map((r) => r.name)).toContain('aenderungsBremse')
    expect(b.wert!).toBeLessThan(a.wert!)
  })
})

describe('berechneIndex — eigene Gewichte', () => {
  it('ignoriert einen Faktor, dessen Gewicht auf 0 steht', () => {
    const ohneMond = { ...STANDARD_GEWICHTE.hecht, solunar: 0 }
    const schwach = basis({ solunarStaerke: 0 })
    const stark = basis({ solunarStaerke: 1 })
    expect(berechneIndex(schwach, 'hecht', ohneMond).wert).toBe(
      berechneIndex(stark, 'hecht', ohneMond).wert,
    )
  })

  it('lässt den Mond durchschlagen, wenn er gewichtet ist', () => {
    const schwach = basis({ solunarStaerke: 0 })
    const stark = basis({ solunarStaerke: 1 })
    expect(berechneIndex(stark, 'hecht').wert!).toBeGreaterThan(
      berechneIndex(schwach, 'hecht').wert!,
    )
  })
})

describe('berechneIndex — nicht-endliche Rohwerte', () => {
  it('markiert einen Faktor mit NaN-Eingabe als fehlend, rechnet aber weiter', () => {
    const kaputterTrend = basis({ luftdruckTrend24hHpa: NaN })
    const ergebnis = berechneIndex(kaputterTrend, 'hecht')

    const luftdruckBeitrag = ergebnis.beitraege.find((b) => b.key === 'luftdruckTrend')
    expect(luftdruckBeitrag?.fehlend).toBe(true)
    expect(luftdruckBeitrag?.roh).toBe(0)
    expect(luftdruckBeitrag?.beitrag).toBe(0)

    expect(ergebnis.wert).not.toBeNull()
    expect(Number.isFinite(ergebnis.wert!)).toBe(true)
    expect(ergebnis.wert!).toBeGreaterThanOrEqual(0)
    expect(ergebnis.wert!).toBeLessThanOrEqual(10)
  })

  it('liefert nie einen nicht-endlichen wert, egal welche Eingaben kaputt sind', () => {
    const kaputteKombinationen: Partial<Bedingungen>[] = [
      { luftdruckHpa: NaN },
      { luftdruckTrend24hHpa: NaN },
      { luftdruckHpa: NaN, luftdruckTrend24hHpa: NaN },
      { luftdruckHpa: Infinity },
      { luftdruckTrend24hHpa: -Infinity },
      { windKmh: NaN },
      { bewoelkungProzent: NaN },
      { solunarStaerke: NaN },
      {
        luftdruckHpa: NaN,
        luftdruckTrend24hHpa: NaN,
        windKmh: NaN,
        bewoelkungProzent: NaN,
        solunarStaerke: NaN,
      },
    ]

    for (const ueberschreibung of kaputteKombinationen) {
      for (const fisch of FISCHE) {
        const ergebnis = berechneIndex(basis(ueberschreibung), fisch)
        expect(ergebnis.wert === null || Number.isFinite(ergebnis.wert)).toBe(true)
      }
    }
  })
})

describe('berechneIndex — nicht-endliche oder ungültige Gewichte', () => {
  it('behandelt ein Infinity-Gewicht wie das Plan-Maximum, wert bleibt endlich', () => {
    const gewichte = { ...STANDARD_GEWICHTE.hecht, luftdruckTrend: Infinity }
    const ergebnis = berechneIndex(basis(), 'hecht', gewichte)

    expect(ergebnis.wert).not.toBeNull()
    expect(Number.isFinite(ergebnis.wert!)).toBe(true)
    expect(ergebnis.wert!).toBeGreaterThanOrEqual(0)
    expect(ergebnis.wert!).toBeLessThanOrEqual(10)
  })

  it('behandelt ein NaN-Gewicht wie 0, wert bleibt endlich', () => {
    const gewichte = { ...STANDARD_GEWICHTE.hecht, luftdruckTrend: NaN }
    const ergebnis = berechneIndex(basis(), 'hecht', gewichte)

    const beitrag = ergebnis.beitraege.find((b) => b.key === 'luftdruckTrend')
    expect(beitrag?.gewicht).toBe(0)
    expect(beitrag?.beitrag).toBeCloseTo(0, 10)
    expect(ergebnis.wert).not.toBeNull()
    expect(Number.isFinite(ergebnis.wert!)).toBe(true)
  })

  it('wirkt bei einem negativen Gewicht wie 0, nicht invertierend', () => {
    const gewichte = { ...STANDARD_GEWICHTE.hecht, luftdruckTrend: -5 }
    const ergebnis = berechneIndex(basis(), 'hecht', gewichte)

    const beitrag = ergebnis.beitraege.find((b) => b.key === 'luftdruckTrend')
    expect(beitrag?.gewicht).toBe(0)
    expect(beitrag?.beitrag).toBeCloseTo(0, 10)
  })

  it('klemmt ein Gewicht über 3 auf das Plan-Maximum von 3', () => {
    const gewichte = { ...STANDARD_GEWICHTE.hecht, luftdruckTrend: 99 }
    const ergebnis = berechneIndex(basis(), 'hecht', gewichte)

    const beitrag = ergebnis.beitraege.find((b) => b.key === 'luftdruckTrend')
    expect(beitrag?.gewicht).toBe(3)
  })

  it('hält beitrag = roh * gewicht der ausgewiesenen Werte auch bei kaputten Gewichten ein', () => {
    const faelle: Array<{ luftdruckTrend: number }> = [
      { luftdruckTrend: Infinity },
      { luftdruckTrend: NaN },
      { luftdruckTrend: -5 },
      { luftdruckTrend: 99 },
    ]

    for (const fall of faelle) {
      const gewichte = { ...STANDARD_GEWICHTE.hecht, ...fall }
      const { beitraege } = berechneIndex(basis(), 'hecht', gewichte)
      for (const b of beitraege) {
        if (b.fehlend) continue
        expect(b.beitrag).toBeCloseTo(b.roh * b.gewicht, 10)
      }
    }
  })

  it('liefert nie einen nicht-endlichen wert, egal welche Gewichts-Kombinationen kaputt sind', () => {
    const kaputteGewichtsKombinationen: Array<Partial<Record<string, number>>> = [
      { luftdruckTrend: Infinity },
      { luftdruckTrend: -Infinity },
      { luftdruckTrend: NaN },
      { luftdruckTrend: -5 },
      { luftdruckTrend: 99 },
      {
        luftdruckTrend: Infinity,
        pegelNiveau: NaN,
        truebung: -Infinity,
        wassertemperatur: -5,
        licht: 99,
        tageszeit: NaN,
        wind: Infinity,
        solunar: -1,
      },
    ]

    for (const kombination of kaputteGewichtsKombinationen) {
      for (const fisch of FISCHE) {
        const gewichte = { ...STANDARD_GEWICHTE[fisch], ...kombination }
        const ergebnis = berechneIndex(basis(), fisch, gewichte)
        expect(ergebnis.wert === null || Number.isFinite(ergebnis.wert)).toBe(true)
      }
    }
  })
})
