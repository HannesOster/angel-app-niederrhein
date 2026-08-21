export interface WetterStundeRoh {
  zeit: Date
  luftdruckHpa: number
  bewoelkung: number
  windKmh: number
  lufttemperaturC: number
  niederschlagMm: number
  sonnenaufgang: Date
  sonnenuntergang: Date
}

interface OpenMeteoAntwort {
  hourly?: {
    time?: string[]
    pressure_msl?: number[]
    cloud_cover?: number[]
    wind_speed_10m?: number[]
    temperature_2m?: number[]
    precipitation?: number[]
  }
  daily?: {
    time?: string[]
    sunrise?: string[]
    sunset?: string[]
  }
}

const BASIS = 'https://api.open-meteo.com/v1/forecast'

export function parseWetterAntwort(rohdaten: unknown): WetterStundeRoh[] {
  const antwort = rohdaten as OpenMeteoAntwort
  const h = antwort?.hourly
  const d = antwort?.daily

  if (!h?.time || !h.pressure_msl || !h.cloud_cover || !h.wind_speed_10m ||
      !h.temperature_2m || !h.precipitation) {
    throw new Error('Open-Meteo: unvollständiger hourly-Block')
  }
  if (!d?.time || !d.sunrise || !d.sunset) {
    throw new Error('Open-Meteo: unvollständiger daily-Block')
  }

  const sonne = new Map<string, { auf: Date; unter: Date }>()
  for (let i = 0; i < d.time.length; i++) {
    sonne.set(d.time[i], {
      auf: new Date(`${d.sunrise[i]}Z`),
      unter: new Date(`${d.sunset[i]}Z`),
    })
  }

  const stunden: WetterStundeRoh[] = []

  for (let i = 0; i < h.time.length; i++) {
    const zeit = new Date(`${h.time[i]}Z`)
    if (Number.isNaN(zeit.getTime())) continue

    const tagesSonne = sonne.get(h.time[i].slice(0, 10))
    if (!tagesSonne) continue

    stunden.push({
      zeit,
      luftdruckHpa: h.pressure_msl[i],
      bewoelkung: h.cloud_cover[i],
      windKmh: h.wind_speed_10m[i],
      lufttemperaturC: h.temperature_2m[i],
      niederschlagMm: h.precipitation[i],
      sonnenaufgang: tagesSonne.auf,
      sonnenuntergang: tagesSonne.unter,
    })
  }

  return stunden.sort((a, b) => a.zeit.getTime() - b.zeit.getTime())
}

export async function holeWetter(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch = fetch,
): Promise<WetterStundeRoh[]> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: 'pressure_msl,cloud_cover,wind_speed_10m,temperature_2m,precipitation',
    daily: 'sunrise,sunset',
    timezone: 'UTC',
    forecast_days: '7',
    past_days: '2',
  })

  const antwort = await fetchImpl(`${BASIS}?${params}`)
  if (!antwort.ok) {
    throw new Error(`Open-Meteo (${lat},${lon}): HTTP ${antwort.status}`)
  }

  return parseWetterAntwort(await antwort.json())
}
