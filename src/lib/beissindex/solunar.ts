import * as SunCalc from 'suncalc'

export interface SolunarFenster {
  von: Date
  bis: Date
  art: 'haupt' | 'neben'
}

const MINUTE = 60_000
const STUNDE = 60 * MINUTE

/** Halbe Länge der Hauptzeit (Mondhöchst-/-tiefststand): ±60 min */
const HAUPT_HALBBREITE = 60 * MINUTE
/** Halbe Länge der Nebenzeit (Mondauf-/-untergang): ±30 min */
const NEBEN_HALBBREITE = 30 * MINUTE

function tagesBeginn(tag: Date): Date {
  const d = new Date(tag)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Sucht Mondhöchst- und -tiefststand, indem der Tag in 10-Minuten-Schritten
 * abgefahren und die Mondhöhe verglichen wird. Genauer als nötig — der
 * Fehler liegt weit unter der Breite eines Beißfensters.
 */
function durchgaenge(tag: Date, lat: number, lon: number): { hoch: Date; tief: Date } {
  const start = tagesBeginn(tag)
  let hoch = start
  let tief = start
  let maxAlt = -Infinity
  let minAlt = Infinity

  for (let m = 0; m < 24 * 60; m += 10) {
    const zeit = new Date(start.getTime() + m * MINUTE)
    const { altitude } = SunCalc.getMoonPosition(zeit, lat, lon)
    if (altitude > maxAlt) {
      maxAlt = altitude
      hoch = zeit
    }
    if (altitude < minAlt) {
      minAlt = altitude
      tief = zeit
    }
  }

  return { hoch, tief }
}

export function solunarFenster(tag: Date, lat: number, lon: number): SolunarFenster[] {
  const fenster: SolunarFenster[] = []
  const { hoch, tief } = durchgaenge(tag, lat, lon)

  for (const zeitpunkt of [hoch, tief]) {
    fenster.push({
      von: new Date(zeitpunkt.getTime() - HAUPT_HALBBREITE),
      bis: new Date(zeitpunkt.getTime() + HAUPT_HALBBREITE),
      art: 'haupt',
    })
  }

  const mondzeiten = SunCalc.getMoonTimes(tagesBeginn(tag), lat, lon)
  for (const zeitpunkt of [mondzeiten.rise, mondzeiten.set]) {
    if (!zeitpunkt) continue
    fenster.push({
      von: new Date(zeitpunkt.getTime() - NEBEN_HALBBREITE),
      bis: new Date(zeitpunkt.getTime() + NEBEN_HALBBREITE),
      art: 'neben',
    })
  }

  return fenster.sort((a, b) => a.von.getTime() - b.von.getTime())
}

/**
 * Solunar-Stärke 0–1 für einen Zeitpunkt.
 *
 * Innerhalb einer Hauptzeit steigt der Wert dreieckig bis 1,0 in der Mitte,
 * innerhalb einer Nebenzeit bis 0,6. Außerhalb bleibt eine Grundlinie von 0,2,
 * damit der Faktor nicht die halbe Zeit hart auf null steht.
 */
export function solunarStaerke(zeit: Date, lat: number, lon: number): number {
  const GRUNDLINIE = 0.2
  const fenster = [
    ...solunarFenster(new Date(zeit.getTime() - 24 * STUNDE), lat, lon),
    ...solunarFenster(zeit, lat, lon),
    ...solunarFenster(new Date(zeit.getTime() + 24 * STUNDE), lat, lon),
  ]

  let staerke = GRUNDLINIE

  for (const f of fenster) {
    const mitte = (f.von.getTime() + f.bis.getTime()) / 2
    const halbbreite = (f.bis.getTime() - f.von.getTime()) / 2
    const abstand = Math.abs(zeit.getTime() - mitte)
    if (abstand >= halbbreite) continue

    const naehe = 1 - abstand / halbbreite
    const spitze = f.art === 'haupt' ? 1 : 0.6
    staerke = Math.max(staerke, GRUNDLINIE + (spitze - GRUNDLINIE) * naehe)
  }

  return Math.min(1, Math.max(0, staerke))
}
