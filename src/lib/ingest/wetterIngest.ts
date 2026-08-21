import type { WetterStundeRoh } from '@/lib/quellen/openmeteo'

export interface WetterFelder {
  luftdruckHpa: number
  bewoelkung: number
  windKmh: number
  lufttemperaturC: number
  niederschlagMm: number
  sonnenaufgang: Date
  sonnenuntergang: Date
  abgerufenAm: Date
}

export interface WetterSchreiber {
  upsert(daten: {
    where: { gewaesserId_zeit: { gewaesserId: string; zeit: Date } }
    update: WetterFelder
    create: WetterFelder & { gewaesserId: string; zeit: Date }
  }): Promise<unknown>
}

export async function speichereWetter(
  gewaesserId: string,
  stunden: WetterStundeRoh[],
  db: WetterSchreiber,
): Promise<number> {
  let geschrieben = 0

  for (const s of stunden) {
    const felder = {
      luftdruckHpa: s.luftdruckHpa,
      bewoelkung: s.bewoelkung,
      windKmh: s.windKmh,
      lufttemperaturC: s.lufttemperaturC,
      niederschlagMm: s.niederschlagMm,
      sonnenaufgang: s.sonnenaufgang,
      sonnenuntergang: s.sonnenuntergang,
      abgerufenAm: new Date(),
    }

    try {
      await db.upsert({
        where: { gewaesserId_zeit: { gewaesserId, zeit: s.zeit } },
        update: felder,
        create: { gewaesserId, zeit: s.zeit, ...felder },
      })
      geschrieben++
    } catch (fehler) {
      console.error(`Wetter ${gewaesserId} ${s.zeit.toISOString()}:`, fehler)
    }
  }

  return geschrieben
}
