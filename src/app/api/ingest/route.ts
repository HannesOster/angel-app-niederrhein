import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { holePegel, PEGEL_STATIONEN } from '@/lib/quellen/pegelonline'
import { holeWetter } from '@/lib/quellen/openmeteo'
import { speicherePegel } from '@/lib/ingest/pegelIngest'
import { speichereWetter } from '@/lib/ingest/wetterIngest'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const token = request.headers.get('x-ingest-token')
  if (!process.env.INGEST_TOKEN || token !== process.env.INGEST_TOKEN) {
    return NextResponse.json({ fehler: 'nicht erlaubt' }, { status: 401 })
  }

  const bericht: Record<string, number> = {}

  for (const station of Object.values(PEGEL_STATIONEN)) {
    try {
      const messwerte = await holePegel(station, 10)
      bericht[`pegel:${station}`] = await speicherePegel(
        messwerte,
        station,
        prisma.pegelMessung,
      )
    } catch (fehler) {
      console.error(`Pegel ${station}:`, fehler)
      bericht[`pegel:${station}`] = -1
    }
  }

  const gewaesser = await prisma.gewaesser.findMany()
  for (const g of gewaesser) {
    try {
      const stunden = await holeWetter(g.lat, g.lon)
      bericht[`wetter:${g.slug}`] = await speichereWetter(
        g.id,
        stunden,
        prisma.wetterStunde,
      )
    } catch (fehler) {
      console.error(`Wetter ${g.slug}:`, fehler)
      bericht[`wetter:${g.slug}`] = -1
    }
  }

  return NextResponse.json({ bericht })
}
