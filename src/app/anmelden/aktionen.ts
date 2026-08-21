'use server'

import { AuthError } from 'next-auth'
import { signIn } from '@/lib/auth'

export async function anmelden(
  _vorherigerZustand: string | undefined,
  formular: FormData,
): Promise<string | undefined> {
  try {
    await signIn('credentials', {
      email: formular.get('email'),
      passwort: formular.get('passwort'),
      redirectTo: '/',
    })
  } catch (fehler) {
    if (fehler instanceof AuthError) {
      return 'E-Mail oder Passwort stimmt nicht.'
    }
    throw fehler
  }
}
