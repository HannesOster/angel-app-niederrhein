import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parsePegelAntwort, holePegel } from './pegelonline'

const fixture = JSON.parse(
  readFileSync('src/lib/quellen/__fixtures__/pegelonline-rees.json', 'utf8'),
)

describe('parsePegelAntwort', () => {
  it('liest die aufgezeichnete Antwort ein', () => {
    const werte = parsePegelAntwort(fixture)
    expect(werte.length).toBeGreaterThan(0)
  })

  it('liefert echte Datumsobjekte', () => {
    const [erster] = parsePegelAntwort(fixture)
    expect(erster.zeit instanceof Date).toBe(true)
    expect(Number.isNaN(erster.zeit.getTime())).toBe(false)
  })

  it('liefert plausible Wasserstände für den Niederrhein', () => {
    for (const w of parsePegelAntwort(fixture)) {
      expect(w.wasserstandCm).toBeGreaterThan(-100)
      expect(w.wasserstandCm).toBeLessThan(1500)
    }
  })

  it('sortiert aufsteigend nach Zeit', () => {
    const werte = parsePegelAntwort(fixture)
    for (let i = 1; i < werte.length; i++) {
      expect(werte[i].zeit.getTime()).toBeGreaterThanOrEqual(werte[i - 1].zeit.getTime())
    }
  })

  it('wirft bei unbrauchbaren Daten statt still Unsinn zu liefern', () => {
    expect(() => parsePegelAntwort({ kaputt: true })).toThrow()
    expect(() => parsePegelAntwort(null)).toThrow()
  })

  it('überspringt einzelne fehlerhafte Einträge', () => {
    const gemischt = [
      { timestamp: '2026-08-21T10:00:00+02:00', value: 412 },
      { timestamp: 'unsinn', value: 400 },
      { timestamp: '2026-08-21T10:15:00+02:00', value: null },
      { timestamp: '2026-08-21T10:30:00+02:00', value: 413 },
    ]
    expect(parsePegelAntwort(gemischt)).toHaveLength(2)
  })
})

describe('holePegel', () => {
  it('ruft die erwartete URL auf und gibt geparste Werte zurück', async () => {
    let aufgerufeneUrl = ''
    const fakeFetch = (async (url: string | URL) => {
      aufgerufeneUrl = String(url)
      return new Response(JSON.stringify(fixture), { status: 200 })
    }) as unknown as typeof fetch

    const werte = await holePegel('REES', 3, fakeFetch)
    expect(aufgerufeneUrl).toContain('REES')
    expect(aufgerufeneUrl).toContain('measurements.json')
    expect(werte.length).toBeGreaterThan(0)
  })

  it('wirft bei einem Fehlerstatus', async () => {
    const fakeFetch = (async () =>
      new Response('kaputt', { status: 503 })) as unknown as typeof fetch
    await expect(holePegel('REES', 3, fakeFetch)).rejects.toThrow(/503/)
  })
})
