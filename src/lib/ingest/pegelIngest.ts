import type { PegelMesswert } from '@/lib/quellen/pegelonline'

export interface PegelSchreiber {
  upsert(daten: {
    where: { station_zeit: { station: string; zeit: Date } }
    update: { wasserstandCm: number }
    create: { station: string; zeit: Date; wasserstandCm: number }
  }): Promise<unknown>
}

/**
 * Schreibt Messwerte idempotent weg. Ein einzelner Fehlschlag darf den
 * gesamten Lauf nicht kippen — beim nächsten Durchlauf wird ohnehin
 * derselbe Zeitraum erneut geholt.
 */
export async function speicherePegel(
  messwerte: PegelMesswert[],
  station: string,
  db: PegelSchreiber,
): Promise<number> {
  let geschrieben = 0

  for (const m of messwerte) {
    try {
      await db.upsert({
        where: { station_zeit: { station, zeit: m.zeit } },
        update: { wasserstandCm: m.wasserstandCm },
        create: { station, zeit: m.zeit, wasserstandCm: m.wasserstandCm },
      })
      geschrieben++
    } catch (fehler) {
      console.error(`Pegel ${station} ${m.zeit.toISOString()}:`, fehler)
    }
  }

  return geschrieben
}
