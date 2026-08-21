import { PrismaClient } from '@prisma/client'
import { GEWAESSER, VEREINE } from './gewaesser'

const prisma = new PrismaClient()

async function main() {
  for (const v of VEREINE) {
    await prisma.verein.upsert({
      where: { slug: v.slug },
      update: { name: v.name },
      create: v,
    })
  }

  for (const g of GEWAESSER) {
    const { vereine, ...stamm } = g
    const gewaesser = await prisma.gewaesser.upsert({
      where: { slug: g.slug },
      update: stamm,
      create: stamm,
    })

    for (const vereinSlug of vereine) {
      const verein = await prisma.verein.findUniqueOrThrow({ where: { slug: vereinSlug } })
      await prisma.gewaesserVerein.upsert({
        where: { gewaesserId_vereinId: { gewaesserId: gewaesser.id, vereinId: verein.id } },
        update: {},
        create: { gewaesserId: gewaesser.id, vereinId: verein.id },
      })
    }
  }

  console.log(`${GEWAESSER.length} Gewässer und ${VEREINE.length} Vereine eingespielt.`)
}

main()
  .catch((fehler) => {
    console.error(fehler)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
