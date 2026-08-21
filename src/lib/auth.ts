import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { pruefePasswort } from '@/lib/passwort'

const AnmeldeDaten = z.object({
  email: z.string().email(),
  passwort: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 365 },
  pages: { signIn: '/anmelden' },
  providers: [
    Credentials({
      credentials: { email: {}, passwort: {} },
      async authorize(rohdaten) {
        const geprueft = AnmeldeDaten.safeParse(rohdaten)
        if (!geprueft.success) return null

        const user = await prisma.user.findUnique({
          where: { email: geprueft.data.email },
        })
        if (!user) return null

        const passt = await pruefePasswort(geprueft.data.passwort, user.passwortHash)
        if (!passt) return null

        return { id: user.id, email: user.email }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.sub = user.id
      return token
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub
      return session
    },
  },
})
