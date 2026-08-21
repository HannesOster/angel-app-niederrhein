import { prisma } from '../src/lib/db'
import { ladeUebersicht } from '../src/lib/uebersicht/laden'

async function main() {
  const user = await prisma.user.findFirstOrThrow()

  const start = performance.now()
  const uebersicht = await ladeUebersicht(user.id, 'hecht', new Date())
  const dauerMs = performance.now() - start

  console.table(
    uebersicht.map((g) => ({
      name: g.name,
      jetzt: g.jetztWert,
      zugang: g.zugang.art,
      abgeleitet: g.abgeleitet,
    })),
  )
  console.log(`Anzahl Gewässer: ${uebersicht.length}`)
  console.log(`ladeUebersicht: ${dauerMs.toFixed(0)} ms`)

  await prisma.$disconnect()
}

main().catch((fehler) => {
  console.error(fehler)
  process.exit(1)
})
