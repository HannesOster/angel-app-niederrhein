export const PEGEL_STATIONEN = { REES: 'REES', EMMERICH: 'EMMERICH' } as const
export type PegelStation = (typeof PEGEL_STATIONEN)[keyof typeof PEGEL_STATIONEN]

export interface PegelMesswert {
  zeit: Date
  wasserstandCm: number
}

const BASIS = 'https://pegelonline.wsv.de/webservices/rest-api/v2/stations'

export function parsePegelAntwort(rohdaten: unknown): PegelMesswert[] {
  if (!Array.isArray(rohdaten)) {
    throw new Error('PEGELONLINE: unerwartetes Antwortformat, Array erwartet')
  }

  const werte: PegelMesswert[] = []

  for (const eintrag of rohdaten) {
    if (typeof eintrag !== 'object' || eintrag === null) continue
    const { timestamp, value } = eintrag as { timestamp?: unknown; value?: unknown }
    if (typeof timestamp !== 'string' || typeof value !== 'number') continue

    const zeit = new Date(timestamp)
    if (Number.isNaN(zeit.getTime())) continue

    werte.push({ zeit, wasserstandCm: Math.round(value) })
  }

  return werte.sort((a, b) => a.zeit.getTime() - b.zeit.getTime())
}

export async function holePegel(
  station: string,
  tage = 7,
  fetchImpl: typeof fetch = fetch,
): Promise<PegelMesswert[]> {
  const url = `${BASIS}/${encodeURIComponent(station)}/W/measurements.json?start=P${tage}D`
  const antwort = await fetchImpl(url)

  if (!antwort.ok) {
    throw new Error(`PEGELONLINE ${station}: HTTP ${antwort.status}`)
  }

  return parsePegelAntwort(await antwort.json())
}
