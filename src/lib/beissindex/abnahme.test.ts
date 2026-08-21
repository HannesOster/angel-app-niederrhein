import { describe, it, expect } from 'vitest'
import { berechneIndex, STANDARD_GEWICHTE, type Bedingungen } from './index'

function bedingungen(ueberschreibung: Partial<Bedingungen> = {}): Bedingungen {
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

describe('Abnahme: Spec §10', () => {
  it('Zander, gleiches Pegelniveau, 13 Uhr — steigendes (trübes) Wasser schlägt fallendes (klares) Wasser NUR wegen der Trübungsregel', () => {
    // Pegelniveau ist in beiden Fällen identisch (0,9) und der Betrag der
    // Änderung ebenfalls (20 cm) — damit sind pegelNiveau-Faktor und die
    // Änderungsbremse (Schwelle 30 cm) in beiden Fällen gleich. Nur die
    // RICHTUNG der Änderung unterscheidet sich: steigend trübt ein (über der
    // Trübungsschwelle 0,6), fallend klart auf (darunter). Der truebung-Faktor
    // selbst begünstigt sogar den klaren Fall (Zander-Optimum liegt bei 0,45,
    // näher an "klar") — gewinnt der trübe Fall trotzdem, kann das nur an der
    // Trübungsregel liegen, die die Tageszeit für den Zander anhebt.
    const gemeinsam = {
      zeit: new Date('2026-08-21T13:00:00Z'),
      pegelNiveauRelativ: 0.9,
      bewoelkungProzent: 90,
    }
    const steigendTrueb = bedingungen({ ...gemeinsam, pegelAenderung24hCm: 20 })
    const fallendKlar = bedingungen({ ...gemeinsam, pegelAenderung24hCm: -20 })

    const trueb = berechneIndex(steigendTrueb, 'zander')
    const klar = berechneIndex(fallendKlar, 'zander')

    expect(trueb.regeln.map((r) => r.name)).toContain('truebungsRegel')
    expect(klar.regeln.map((r) => r.name)).not.toContain('truebungsRegel')
    expect(trueb.wert!).toBeGreaterThan(klar.wert!)

    // Diskriminierungsnachweis: Die Regel gilt nur für Zander, nicht für
    // Hecht. Bei sonst identischen (trüben) Bedingungen muss der
    // tageszeit-Beitrag beim Zander deshalb höher liegen als beim Hecht.
    const hecht = berechneIndex(steigendTrueb, 'hecht')
    const tageszeitZander = trueb.beitraege.find((b) => b.key === 'tageszeit')
    const tageszeitHecht = hecht.beitraege.find((b) => b.key === 'tageszeit')
    expect(tageszeitZander).toBeDefined()
    expect(tageszeitHecht).toBeDefined()
    expect(tageszeitZander!.roh).toBeGreaterThan(tageszeitHecht!.roh)
  })

  it('Pegel fällt 60 cm am Tag — schlechter als ruhiger Pegel, für jede Art', () => {
    for (const fisch of ['hecht', 'zander', 'aal', 'karpfen'] as const) {
      const ruhig = berechneIndex(bedingungen({ pegelAenderung24hCm: 0 }), fisch)
      const sturz = berechneIndex(bedingungen({ pegelAenderung24hCm: -60 }), fisch)
      expect(sturz.wert!, fisch).toBeLessThan(ruhig.wert!)
      expect(sturz.regeln.map((r) => r.name), fisch).toContain('aenderungsBremse')
    }
  })

  it('Aal, 3 Uhr nachts, warm, hohes ruhiges Wasser — Spitzenwert', () => {
    const ideal = bedingungen({
      zeit: new Date('2026-08-21T01:00:00Z'),
      wassertemperaturC: 19,
      pegelNiveauRelativ: 0.8,
      pegelAenderung24hCm: 5,
      luftdruckTrend24hHpa: -3,
      solunarStaerke: 1,
      bewoelkungProzent: 90,
    })
    expect(berechneIndex(ideal, 'aal').wert!).toBeGreaterThan(7.5)
  })

  it('Karpfen, 3 Uhr nachts — schlecht', () => {
    const nachts = bedingungen({
      zeit: new Date('2026-08-21T01:00:00Z'),
      wassertemperaturC: 8,
      luftdruckTrend24hHpa: -6,
    })
    expect(berechneIndex(nachts, 'karpfen').wert!).toBeLessThan(4)
  })

  it('Daten 8 Stunden alt — kein Wert, sondern unsicher', () => {
    const alt = bedingungen({ datenAlterMinuten: 8 * 60 })
    const ergebnis = berechneIndex(alt, 'hecht')
    expect(ergebnis.wert).toBeNull()
    expect(ergebnis.unsicher).toBe(true)
  })

  it('Mondgewicht auf 0 — Mondphase ändert nichts mehr', () => {
    const ohneMond = { ...STANDARD_GEWICHTE.zander, solunar: 0 }
    const werte = [0, 0.25, 0.5, 0.75, 1].map(
      (s) => berechneIndex(bedingungen({ solunarStaerke: s }), 'zander', ohneMond).wert,
    )
    expect(new Set(werte).size).toBe(1)
  })

  it('Karpfen im Sommer bei Sonne schlägt Karpfen im Winter bei Sturm', () => {
    const sommer = bedingungen({
      zeit: new Date('2026-08-21T08:00:00Z'),
      wassertemperaturC: 21,
      luftdruckHpa: 1022,
      luftdruckTrend24hHpa: 0,
      bewoelkungProzent: 10,
      windKmh: 4,
    })
    const winter = bedingungen({
      zeit: new Date('2026-08-21T08:00:00Z'),
      wassertemperaturC: 4,
      luftdruckHpa: 995,
      luftdruckTrend24hHpa: -8,
      bewoelkungProzent: 100,
      windKmh: 45,
    })
    expect(berechneIndex(sommer, 'karpfen').wert!).toBeGreaterThan(
      berechneIndex(winter, 'karpfen').wert!,
    )
  })

  it('Jeder Beitrag trägt einen Klartext für die Detailansicht', () => {
    const { beitraege } = berechneIndex(bedingungen(), 'hecht')
    for (const b of beitraege) {
      expect(b.text.trim().length, b.key).toBeGreaterThan(0)
      expect(b.label.trim().length, b.key).toBeGreaterThan(0)
    }
  })
})
