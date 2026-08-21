import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseWetterAntwort, holeWetter } from './openmeteo'

const fixture = JSON.parse(
  readFileSync('src/lib/quellen/__fixtures__/openmeteo-kalkar.json', 'utf8'),
)

describe('parseWetterAntwort', () => {
  it('liefert mindestens 7 Tage Stunden', () => {
    expect(parseWetterAntwort(fixture).length).toBeGreaterThanOrEqual(7 * 24)
  })

  it('liefert plausible Werte', () => {
    for (const s of parseWetterAntwort(fixture)) {
      expect(s.luftdruckHpa).toBeGreaterThan(900)
      expect(s.luftdruckHpa).toBeLessThan(1100)
      expect(s.bewoelkung).toBeGreaterThanOrEqual(0)
      expect(s.bewoelkung).toBeLessThanOrEqual(100)
      expect(s.windKmh).toBeGreaterThanOrEqual(0)
      expect(s.lufttemperaturC).toBeGreaterThan(-40)
      expect(s.lufttemperaturC).toBeLessThan(50)
    }
  })

  it('hängt an jede Stunde Sonnenauf- und -untergang ihres Tages', () => {
    for (const s of parseWetterAntwort(fixture)) {
      expect(s.sonnenaufgang.getTime()).toBeLessThan(s.sonnenuntergang.getTime())
      expect(s.sonnenaufgang.toISOString().slice(0, 10)).toBe(s.zeit.toISOString().slice(0, 10))
    }
  })

  it('sortiert aufsteigend nach Zeit', () => {
    const stunden = parseWetterAntwort(fixture)
    for (let i = 1; i < stunden.length; i++) {
      expect(stunden[i].zeit.getTime()).toBeGreaterThan(stunden[i - 1].zeit.getTime())
    }
  })

  it('wirft bei fehlendem hourly-Block', () => {
    expect(() => parseWetterAntwort({ daily: {} })).toThrow()
  })
})

describe('holeWetter', () => {
  it('übergibt Koordinaten an die URL', async () => {
    let url = ''
    const fakeFetch = (async (u: string | URL) => {
      url = String(u)
      return new Response(JSON.stringify(fixture), { status: 200 })
    }) as unknown as typeof fetch

    await holeWetter(51.7386, 6.2911, fakeFetch)
    expect(url).toContain('latitude=51.7386')
    expect(url).toContain('longitude=6.2911')
  })

  it('wirft bei einem Fehlerstatus', async () => {
    const fakeFetch = (async () =>
      new Response('kaputt', { status: 429 })) as unknown as typeof fetch
    await expect(holeWetter(51.7, 6.3, fakeFetch)).rejects.toThrow(/429/)
  })
})
