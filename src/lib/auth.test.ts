import { describe, it, expect } from 'vitest'
import { hashePasswort, pruefePasswort } from './passwort'

describe('passwort', () => {
  it('erzeugt einen Hash, der nicht das Klartextpasswort enthält', async () => {
    const hash = await hashePasswort('geheim-fuer-den-test')
    expect(hash).not.toContain('geheim-fuer-den-test')
    expect(hash.length).toBeGreaterThan(20)
  })

  it('erzeugt bei gleichem Passwort verschiedene Hashes (Salt)', async () => {
    const a = await hashePasswort('geheim-fuer-den-test')
    const b = await hashePasswort('geheim-fuer-den-test')
    expect(a).not.toBe(b)
  })

  it('erkennt das richtige Passwort', async () => {
    const hash = await hashePasswort('geheim-fuer-den-test')
    expect(await pruefePasswort('geheim-fuer-den-test', hash)).toBe(true)
  })

  it('lehnt ein falsches Passwort ab', async () => {
    const hash = await hashePasswort('geheim-fuer-den-test')
    expect(await pruefePasswort('etwas-anderes', hash)).toBe(false)
  })

  it('wirft nicht bei einem kaputten Hash, sondern gibt false zurück', async () => {
    expect(await pruefePasswort('egal', 'kein-gueltiger-hash')).toBe(false)
  })
})
