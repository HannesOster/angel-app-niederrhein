import { describe, it, expect } from 'vitest'
import { solunarStaerke, solunarFenster } from './solunar'

// Kalkar, Niederrhein
const LAT = 51.7386
const LON = 6.2911

describe('solunarFenster', () => {
  it('liefert mindestens eine Hauptzeit pro Tag', () => {
    const fenster = solunarFenster(new Date('2026-08-21T12:00:00Z'), LAT, LON)
    const haupt = fenster.filter((f) => f.art === 'haupt')
    expect(haupt.length).toBeGreaterThanOrEqual(1)
  })

  it('legt jedes Fenster mit von < bis an', () => {
    const fenster = solunarFenster(new Date('2026-08-21T12:00:00Z'), LAT, LON)
    for (const f of fenster) {
      expect(f.von.getTime()).toBeLessThan(f.bis.getTime())
    }
  })

  it('hält alle Fenster innerhalb eines Tages um das Datum herum', () => {
    const tag = new Date('2026-08-21T12:00:00Z')
    const fenster = solunarFenster(tag, LAT, LON)
    for (const f of fenster) {
      const abstandStunden = Math.abs(f.von.getTime() - tag.getTime()) / 3_600_000
      expect(abstandStunden).toBeLessThan(26)
    }
  })
})

describe('solunarStaerke', () => {
  it('bleibt immer zwischen 0 und 1', () => {
    for (let stunde = 0; stunde < 24; stunde++) {
      const zeit = new Date(Date.UTC(2026, 7, 21, stunde))
      const s = solunarStaerke(zeit, LAT, LON)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(1)
    }
  })

  it('ist innerhalb einer Hauptzeit höher als weit davon entfernt', () => {
    const tag = new Date('2026-08-21T12:00:00Z')
    const haupt = solunarFenster(tag, LAT, LON).filter((f) => f.art === 'haupt')[0]
    const mitte = new Date((haupt.von.getTime() + haupt.bis.getTime()) / 2)
    const weitWeg = new Date(mitte.getTime() + 6 * 3_600_000)

    expect(solunarStaerke(mitte, LAT, LON)).toBeGreaterThan(
      solunarStaerke(weitWeg, LAT, LON),
    )
  })

  it('erreicht in der Mitte einer Hauptzeit einen hohen Wert', () => {
    const tag = new Date('2026-08-21T12:00:00Z')
    const haupt = solunarFenster(tag, LAT, LON).filter((f) => f.art === 'haupt')[0]
    const mitte = new Date((haupt.von.getTime() + haupt.bis.getTime()) / 2)
    expect(solunarStaerke(mitte, LAT, LON)).toBeGreaterThan(0.8)
  })
})
