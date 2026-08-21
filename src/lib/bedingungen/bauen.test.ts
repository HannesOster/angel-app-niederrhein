import { describe, it, expect } from 'vitest'
import { baueBedingungen, luftdruckTrend, type GewaesserStamm } from './bauen'
import type { WetterStundeRoh } from '@/lib/quellen/openmeteo'
import type { PegelMesswert } from '@/lib/quellen/pegelonline'

const START = new Date('2026-08-19T00:00:00Z').getTime()

function wetterreihe(stunden = 216): WetterStundeRoh[] {
  const liste: WetterStundeRoh[] = []
  for (let h = 0; h < stunden; h++) {
    const zeit = new Date(START + h * 3_600_000)
    const tag = zeit.toISOString().slice(0, 10)
    liste.push({
      zeit,
      luftdruckHpa: 1013 - h * 0.05,
      bewoelkung: 50,
      windKmh: 12,
      lufttemperaturC: 18,
      niederschlagMm: 0,
      sonnenaufgang: new Date(`${tag}T04:30:00Z`),
      sonnenuntergang: new Date(`${tag}T18:45:00Z`),
    })
  }
  return liste
}

function pegelreihe(): PegelMesswert[] {
  const liste: PegelMesswert[] = []
  for (let h = 0; h < 216; h++) {
    liste.push({ zeit: new Date(START + h * 3_600_000), wasserstandCm: 400 + h * 0.5 })
  }
  return liste
}

const RHEIN: GewaesserStamm = {
  lat: 51.7386,
  lon: 6.2911,
  typ: 'RHEIN',
  referenzPegel: 'REES',
  verzoegerungTage: 0,
  daempfung: 1,
}

const SEE: GewaesserStamm = { ...RHEIN, typ: 'BAGGERSEE', verzoegerungTage: 3, daempfung: 0.2 }

const JETZT = new Date('2026-08-21T00:00:00Z')

describe('luftdruckTrend', () => {
  it('meldet fallenden Druck negativ', () => {
    const w = wetterreihe()
    expect(luftdruckTrend(w, 100)).toBeLessThan(0)
  })
  it('meldet 0, wenn keine 24 h Vorlauf da sind', () => {
    expect(luftdruckTrend(wetterreihe(), 3)).toBe(0)
  })
})

describe('baueBedingungen', () => {
  it('liefert eine Bedingung je Wetterstunde', () => {
    const b = baueBedingungen(RHEIN, wetterreihe(), pegelreihe(), JETZT)
    expect(b).toHaveLength(216)
  })

  it('übernimmt Wetterwerte unverändert', () => {
    const [erste] = baueBedingungen(RHEIN, wetterreihe(), pegelreihe(), JETZT)
    expect(erste.bewoelkungProzent).toBe(50)
    expect(erste.windKmh).toBe(12)
  })

  it('berechnet eine Solunar-Stärke zwischen 0 und 1', () => {
    for (const b of baueBedingungen(RHEIN, wetterreihe(), pegelreihe(), JETZT)) {
      expect(b.solunarStaerke).toBeGreaterThanOrEqual(0)
      expect(b.solunarStaerke).toBeLessThanOrEqual(1)
    }
  })

  it('dämpft die Pegelbewegung beim See gegenüber dem Rhein', () => {
    const rhein = baueBedingungen(RHEIN, wetterreihe(), pegelreihe(), JETZT)
    const see = baueBedingungen(SEE, wetterreihe(), pegelreihe(), JETZT)

    const rheinBewegung = Math.abs(rhein[100].pegelAenderung24hCm ?? 0)
    const seeBewegung = Math.abs(see[100].pegelAenderung24hCm ?? 0)
    expect(seeBewegung).toBeLessThan(rheinBewegung)
  })

  it('setzt beim See eine aus der Luft abgeleitete Wassertemperatur', () => {
    const see = baueBedingungen(SEE, wetterreihe(), pegelreihe(), JETZT)
    expect(see[100].wassertemperaturC).not.toBeNull()
    expect(see[100].wassertemperaturC!).toBeCloseTo(18, 0)
  })

  it('rechnet das Datenalter aus dem Abstand zu jetzt', () => {
    const b = baueBedingungen(RHEIN, wetterreihe(), pegelreihe(), JETZT)
    for (const eintrag of b) {
      expect(eintrag.datenAlterMinuten).toBeGreaterThanOrEqual(0)
    }
  })

  it('kommt ohne Pegeldaten klar', () => {
    const b = baueBedingungen(RHEIN, wetterreihe(), [], JETZT)
    expect(b[100].pegelNiveauRelativ).toBeNull()
    expect(b[100].pegelAenderung24hCm).toBeNull()
  })
})
