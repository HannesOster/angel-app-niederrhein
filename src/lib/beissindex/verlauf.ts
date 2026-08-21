import { berechneIndex } from './berechne'
import type { Bedingungen, Fisch, Gewichte, IndexErgebnis } from './typen'

export interface StundenWert {
  zeit: Date
  ergebnis: IndexErgebnis
}

export interface TagesWert {
  tag: Date
  besteStunde: Date | null
  wert: number | null
  unsicher: boolean
}

function tagesSchluessel(zeit: Date): string {
  return zeit.toISOString().slice(0, 10)
}

export function berechneStunden(
  bedingungen: Bedingungen[],
  fisch: Fisch,
  gewichte?: Gewichte,
): StundenWert[] {
  return bedingungen.map((b) => ({
    zeit: b.zeit,
    ergebnis: berechneIndex(b, fisch, gewichte),
  }))
}

/**
 * Der Tageswert ist die BESTE Stunde des Tages, nicht der Durchschnitt
 * (Spec §5.4) — sonst wäre der Aal immer mittelmäßig, obwohl nachts alles
 * passiert.
 */
export function fasseZuTagenZusammen(stunden: StundenWert[]): TagesWert[] {
  const gruppen = new Map<string, StundenWert[]>()

  for (const s of stunden) {
    const key = tagesSchluessel(s.zeit)
    const vorhanden = gruppen.get(key)
    if (vorhanden) vorhanden.push(s)
    else gruppen.set(key, [s])
  }

  const tage: TagesWert[] = []

  for (const [key, gruppe] of [...gruppen.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const gueltige = gruppe.filter((s) => s.ergebnis.wert !== null)

    if (gueltige.length === 0) {
      tage.push({
        tag: new Date(`${key}T00:00:00Z`),
        besteStunde: null,
        wert: null,
        unsicher: true,
      })
      continue
    }

    let beste = gueltige[0]
    for (const s of gueltige) {
      if ((s.ergebnis.wert ?? 0) > (beste.ergebnis.wert ?? 0)) beste = s
    }

    tage.push({
      tag: new Date(`${key}T00:00:00Z`),
      besteStunde: beste.zeit,
      wert: beste.ergebnis.wert,
      unsicher: false,
    })
  }

  return tage
}

/**
 * Zusammenhängende Spanne um die beste Stunde: alle direkt angrenzenden
 * Stunden, die mindestens 85 % des Tagesbestwerts erreichen. Daraus wird
 * der Satz „am besten heute Abend zwischen 18 und 21 Uhr".
 */
export function besteZeitspanne(
  stunden: StundenWert[],
  tag: Date,
): { von: Date; bis: Date } | null {
  const key = tagesSchluessel(tag)
  const desTages = stunden
    .filter((s) => tagesSchluessel(s.zeit) === key && s.ergebnis.wert !== null)
    .sort((a, b) => a.zeit.getTime() - b.zeit.getTime())

  if (desTages.length === 0) return null

  let besterIndex = 0
  for (let i = 1; i < desTages.length; i++) {
    if ((desTages[i].ergebnis.wert ?? 0) > (desTages[besterIndex].ergebnis.wert ?? 0)) {
      besterIndex = i
    }
  }

  const schwelle = (desTages[besterIndex].ergebnis.wert ?? 0) * 0.85

  let von = besterIndex
  while (von > 0 && (desTages[von - 1].ergebnis.wert ?? 0) >= schwelle) von--

  let bis = besterIndex
  while (bis < desTages.length - 1 && (desTages[bis + 1].ergebnis.wert ?? 0) >= schwelle) bis++

  return {
    von: desTages[von].zeit,
    bis: new Date(desTages[bis].zeit.getTime() + 3_600_000),
  }
}
