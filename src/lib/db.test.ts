import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const schema = readFileSync('prisma/schema.prisma', 'utf8')

describe('prisma-schema', () => {
  it('kennzeichnet abgeleitete Wasserstände', () => {
    expect(schema).toContain('abgeleitet')
  })

  it('verhindert doppelte Pegelmessungen je Station und Zeit', () => {
    expect(schema).toContain('@@unique([station, zeit])')
  })

  it('verhindert doppelte Wetterstunden je Gewässer und Zeit', () => {
    expect(schema).toContain('@@unique([gewaesserId, zeit])')
  })

  it('speichert den Fang-Schnappschuss als Json-Kopie', () => {
    expect(schema).toMatch(/schnappschuss\s+Json/)
  })
})
