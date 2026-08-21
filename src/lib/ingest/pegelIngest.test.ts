import { describe, it, expect, vi } from 'vitest'
import { speicherePegel } from './pegelIngest'
import type { PegelMesswert } from '@/lib/quellen/pegelonline'

const messwerte: PegelMesswert[] = [
  { zeit: new Date('2026-08-21T10:00:00Z'), wasserstandCm: 412 },
  { zeit: new Date('2026-08-21T10:15:00Z'), wasserstandCm: 413 },
]

describe('speicherePegel', () => {
  it('schreibt jeden Messwert genau einmal', async () => {
    const upsert = vi.fn().mockResolvedValue({})
    const anzahl = await speicherePegel(messwerte, 'REES', { upsert })
    expect(upsert).toHaveBeenCalledTimes(2)
    expect(anzahl).toBe(2)
  })

  it('nutzt station und zeit als Schlüssel, damit nichts doppelt landet', async () => {
    const upsert = vi.fn().mockResolvedValue({})
    await speicherePegel(messwerte, 'REES', { upsert })
    const ersterAufruf = upsert.mock.calls[0][0]
    expect(ersterAufruf.where.station_zeit).toEqual({
      station: 'REES',
      zeit: messwerte[0].zeit,
    })
  })

  it('bricht nicht ab, wenn ein einzelner Schreibvorgang scheitert', async () => {
    const upsert = vi
      .fn()
      .mockRejectedValueOnce(new Error('kaputt'))
      .mockResolvedValue({})
    const anzahl = await speicherePegel(messwerte, 'REES', { upsert })
    expect(anzahl).toBe(1)
  })

  it('schreibt bei leerer Liste nichts', async () => {
    const upsert = vi.fn()
    expect(await speicherePegel([], 'REES', { upsert })).toBe(0)
    expect(upsert).not.toHaveBeenCalled()
  })
})
