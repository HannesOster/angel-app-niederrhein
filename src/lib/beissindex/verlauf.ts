import { berechneIndex } from './berechne'
import type { Bedingungen, Fisch, Gewichte, IndexErgebnis } from './typen'

export interface StundenWert {
  zeit: Date
  ergebnis: IndexErgebnis
}

export interface TagesWert {
  /**
   * Datumsmarker für den LOKALEN Kalendertag (Zeitzone `ZEITZONE`), kein
   * echter Zeitpunkt. Immer `T00:00:00Z`. Die Oberfläche muss ihn mit
   * `timeZone: 'UTC'` formatieren, sonst verschiebt sie ihn erneut.
   */
  tag: Date
  besteStunde: Date | null
  wert: number | null
  unsicher: boolean
}

/**
 * Die App wird am Niederrhein genutzt (MESZ/MEZ). Tagesgrenzen müssen daher
 * in Ortszeit gezogen werden, nicht in UTC — sonst fallen die besten
 * Nachtstunden (u. a. für den Aal) auf den falschen Kalendertag.
 */
const ZEITZONE = 'Europe/Berlin'

const LOKALES_DATUM_FORMAT = new Intl.DateTimeFormat('sv-SE', {
  timeZone: ZEITZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Liefert den lokalen Kalendertag (YYYY-MM-DD) einer Stunde. */
function tagesSchluessel(zeit: Date): string {
  return LOKALES_DATUM_FORMAT.format(zeit)
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

  const bestwert = desTages[besterIndex].ergebnis.wert ?? 0

  // Bei einem Tagesbestwert von 0 (oder darunter) ergäbe 0 * 0.85 = 0 als
  // Schwelle, die JEDE Stunde erfüllt — die Spanne würde fälschlich den
  // ganzen Tag als beste Beißzeit ausweisen. An einem Tag ohne jede Chance
  // ist keine Angabe ehrlicher als eine falsche.
  if (bestwert <= 0) return null

  const schwelle = bestwert * 0.85

  let von = besterIndex
  while (von > 0 && (desTages[von - 1].ergebnis.wert ?? 0) >= schwelle) von--

  let bis = besterIndex
  while (bis < desTages.length - 1 && (desTages[bis + 1].ergebnis.wert ?? 0) >= schwelle) bis++

  return {
    von: desTages[von].zeit,
    bis: new Date(desTages[bis].zeit.getTime() + 3_600_000),
  }
}
