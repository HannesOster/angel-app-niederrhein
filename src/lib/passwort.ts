import argon2 from 'argon2'

export async function hashePasswort(klartext: string): Promise<string> {
  return argon2.hash(klartext)
}

export async function pruefePasswort(klartext: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, klartext)
  } catch {
    return false
  }
}
