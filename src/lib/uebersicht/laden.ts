import { prisma } from '@/lib/db'
import {
  berechneStunden,
  besteZeitspanne,
  fasseZuTagenZusammen,
  STANDARD_GEWICHTE,
  type Fisch,
  type Gewichte,
  type TagesWert,
} from '@/lib/beissindex'
import { baueBedingungen } from '@/lib/bedingungen/bauen'
import { bestimmeZugang, type ZugangStatus } from './zugang'

export interface GewaesserUebersicht {
  id: string
  slug: string
  name: string
  typ: 'RHEIN' | 'ALTRHEIN' | 'BAGGERSEE'
  lat: number
  lon: number
  abgeleitet: boolean
  quelle: string
  zugang: ZugangStatus
  jetztWert: number | null
  unsicher: boolean
  tage: TagesWert[]
  besteSpanne: { von: Date; bis: Date } | null
}

const TAG = 24 * 3_600_000

export async function ladeUebersicht(
  userId: string,
  fisch: Fisch,
  jetzt: Date,
): Promise<GewaesserUebersicht[]> {
  const [gewaesser, mitgliedschaften, tageskarten, profil] = await Promise.all([
    prisma.gewaesser.findMany({ include: { vereine: { include: { verein: true } } } }),
    prisma.mitgliedschaft.findMany({ where: { userId }, include: { verein: true } }),
    prisma.tageskarte.findMany({ where: { userId, bis: { gte: jetzt } } }),
    prisma.gewichtsProfil.findUnique({ where: { userId_fisch: { userId, fisch } } }),
  ])

  const eigeneVereine = mitgliedschaften.map((m) => m.verein.slug)
  const gewichte = (profil?.gewichte as Gewichte | undefined) ?? STANDARD_GEWICHTE[fisch]

  const von = new Date(jetzt.getTime() - 2 * TAG)
  const bis = new Date(jetzt.getTime() + 7 * TAG)

  const uebersicht: GewaesserUebersicht[] = []

  for (const g of gewaesser) {
    const [wetterZeilen, pegelZeilen] = await Promise.all([
      prisma.wetterStunde.findMany({
        where: { gewaesserId: g.id, zeit: { gte: von, lte: bis } },
        orderBy: { zeit: 'asc' },
      }),
      prisma.pegelMessung.findMany({
        where: { station: g.referenzPegel, zeit: { gte: new Date(jetzt.getTime() - 14 * TAG) } },
        orderBy: { zeit: 'asc' },
      }),
    ])

    const bedingungen = baueBedingungen(
      {
        lat: g.lat,
        lon: g.lon,
        typ: g.typ,
        referenzPegel: g.referenzPegel,
        verzoegerungTage: g.verzoegerungTage,
        daempfung: g.daempfung,
      },
      wetterZeilen.map((w) => ({
        zeit: w.zeit,
        luftdruckHpa: w.luftdruckHpa,
        bewoelkung: w.bewoelkung,
        windKmh: w.windKmh,
        lufttemperaturC: w.lufttemperaturC,
        niederschlagMm: w.niederschlagMm,
        sonnenaufgang: w.sonnenaufgang,
        sonnenuntergang: w.sonnenuntergang,
      })),
      pegelZeilen.map((p) => ({ zeit: p.zeit, wasserstandCm: p.wasserstandCm })),
      jetzt,
    )

    const stunden = berechneStunden(bedingungen, fisch, gewichte)
    const tage = fasseZuTagenZusammen(stunden).filter(
      (t) => t.tag.getTime() >= new Date(jetzt.toISOString().slice(0, 10)).getTime(),
    )

    const aktuell = stunden
      .filter((s) => Math.abs(s.zeit.getTime() - jetzt.getTime()) <= 3_600_000)
      .at(0)

    uebersicht.push({
      id: g.id,
      slug: g.slug,
      name: g.name,
      typ: g.typ,
      lat: g.lat,
      lon: g.lon,
      abgeleitet: g.abgeleitet,
      quelle: g.abgeleitet
        ? `geschätzt, abgeleitet von Pegel ${g.referenzPegel}`
        : `Pegel ${g.referenzPegel}`,
      zugang: bestimmeZugang(
        g.vereine.map((v) => v.verein.slug),
        eigeneVereine,
        tageskarten.map((k) => ({ gewaesserId: k.gewaesserId, bis: k.bis })),
        g.id,
        jetzt,
      ),
      jetztWert: aktuell?.ergebnis.wert ?? null,
      unsicher: aktuell?.ergebnis.unsicher ?? true,
      tage: tage.slice(0, 3),
      besteSpanne: besteZeitspanne(stunden, jetzt),
    })
  }

  return uebersicht.sort((a, b) => (b.jetztWert ?? -1) - (a.jetztWert ?? -1))
}
