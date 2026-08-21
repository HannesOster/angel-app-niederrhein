import { PrismaClient } from '@prisma/client'
import { hashePasswort } from '../src/lib/passwort'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.SEED_USER_EMAIL
  const passwort = process.env.SEED_USER_PASSWORT

  if (!email || !passwort) {
    throw new Error('SEED_USER_EMAIL und SEED_USER_PASSWORT müssen in .env stehen')
  }

  const passwortHash = await hashePasswort(passwort)

  await prisma.user.upsert({
    where: { email },
    update: { passwortHash },
    create: { email, passwortHash },
  })

  console.log(`Konto ${email} angelegt bzw. Passwort neu gesetzt.`)
}

main()
  .catch((fehler) => {
    console.error(fehler)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
