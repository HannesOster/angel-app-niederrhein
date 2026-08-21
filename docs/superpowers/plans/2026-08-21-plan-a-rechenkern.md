# Plan A — Rechenkern (Beißindex) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein vollständig getesteter, netz- und datenbankfreier Rechenkern, der aus Wetter-, Pegel- und Mondbedingungen einen Beißindex von 0–10 samt Begründung für vier Zielfische liefert.

**Architecture:** Reine Funktionen ohne Seiteneffekte. Jeder Faktor ist eine eigene Funktion, die einen Rohwert von −1 bis +1 liefert. Ein Aggregator gewichtet, summiert, normiert und wendet genau zwei benannte Wechselwirkungsregeln an. Alles ist mit Vitest ohne Netzwerk testbar.

**Tech Stack:** Next.js 15 (App Router), TypeScript (strict), Vitest, suncalc, date-fns

**Spec:** `docs/superpowers/specs/2026-08-21-angelapp-design.md`

## Global Constraints

- Sprache im Code: **deutsche Fachbegriffe** für Domänenobjekte (`Bedingungen`, `Fisch`, `Beitrag`), englische für Technik (`test`, `config`). Konsistent durchhalten.
- TypeScript **strict**, kein `any`, keine nicht-null-Assertions (`!`).
- Der Rechenkern hat **keine** Imports aus `next/*`, `@prisma/client` oder `node:fs`. Er ist in einer reinen JS-Umgebung lauffähig.
- Jeder Faktor liefert einen Wert im Intervall **[−1, 1]**. Das ist per Test abzusichern, nicht nur per Konvention.
- Gewichte liegen im Intervall **[0, 3]**.
- Datenalter über **360 Minuten** ⇒ Index ist `null` und `unsicher: true`.
- Schwelle der Änderungsraten-Bremse: **30 cm / 24 h**.
- Schwelle der Trübungs-Regel: **Trübung ≥ 0,6**.
- Commits: englisch, kleingeschrieben, Präfix `feat:` / `fix:` / `test:` / `chore:`. **Kein** `Co-Authored-By`.

---

### Task 1: Projektgerüst und Testlauf

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore` (ergänzen), `src/lib/beissindex/.gitkeep`
- Test: `src/lib/beissindex/smoke.test.ts`

**Interfaces:**
- Consumes: nichts
- Produces: lauffähiges `pnpm test`, `pnpm build`, TypeScript-Pfad-Alias `@/*` → `src/*`

- [ ] **Step 1: Next.js-Projekt anlegen**

Im Projektwurzelverzeichnis (das Verzeichnis enthält bereits `docs/` und `.git`):

```bash
pnpm create next-app@latest . --typescript --app --tailwind --eslint --src-dir --import-alias "@/*" --use-pnpm --no-turbopack
```

Falls der Generator wegen vorhandener Dateien meckert: bestätigen, dass `docs/`, `.git` und `.gitignore` erhalten bleiben.

- [ ] **Step 2: Testwerkzeug installieren**

```bash
pnpm add -D vitest @vitest/coverage-v8
pnpm add suncalc date-fns
pnpm add -D @types/suncalc
```

- [ ] **Step 3: Vitest konfigurieren**

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

In `package.json` unter `"scripts"` ergänzen:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Rauchtest schreiben**

`src/lib/beissindex/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('testaufbau', () => {
  it('führt tests aus', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Tests laufen lassen**

Run: `pnpm test`
Expected: PASS, 1 Test

- [ ] **Step 6: Build prüfen**

Run: `pnpm build`
Expected: erfolgreicher Build ohne TypeScript-Fehler

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold next.js project with vitest"
```

---

### Task 2: Typen und Standardgewichte

**Files:**
- Create: `src/lib/beissindex/typen.ts`
- Create: `src/lib/beissindex/gewichte.ts`
- Test: `src/lib/beissindex/gewichte.test.ts`

**Interfaces:**
- Consumes: nichts
- Produces:
  - `type Fisch = 'hecht' | 'zander' | 'aal' | 'karpfen'`, `FISCHE: readonly Fisch[]`
  - `type FaktorKey`, `FAKTOR_KEYS: readonly FaktorKey[]`, `FAKTOR_LABEL: Record<FaktorKey, string>`
  - `interface Bedingungen`, `interface Beitrag`, `interface AngewandteRegel`, `interface IndexErgebnis`
  - `type Gewichte = Record<FaktorKey, number>`
  - `STANDARD_GEWICHTE: Record<Fisch, Gewichte>`

- [ ] **Step 1: Typen schreiben**

`src/lib/beissindex/typen.ts`:

```ts
export type Fisch = 'hecht' | 'zander' | 'aal' | 'karpfen'

export const FISCHE: readonly Fisch[] = ['hecht', 'zander', 'aal', 'karpfen'] as const

export type FaktorKey =
  | 'luftdruckTrend'
  | 'pegelNiveau'
  | 'truebung'
  | 'wassertemperatur'
  | 'licht'
  | 'tageszeit'
  | 'wind'
  | 'solunar'

export const FAKTOR_KEYS: readonly FaktorKey[] = [
  'luftdruckTrend',
  'pegelNiveau',
  'truebung',
  'wassertemperatur',
  'licht',
  'tageszeit',
  'wind',
  'solunar',
] as const

export const FAKTOR_LABEL: Record<FaktorKey, string> = {
  luftdruckTrend: 'Luftdruck-Trend',
  pegelNiveau: 'Pegel-Niveau',
  truebung: 'Trübung',
  wassertemperatur: 'Wassertemperatur',
  licht: 'Licht und Bewölkung',
  tageszeit: 'Tageszeit',
  wind: 'Wind',
  solunar: 'Solunar',
}

/**
 * Alle Eingaben des Rechenkerns für EINE Stunde an EINEM Gewässer.
 * `null` bedeutet: Wert liegt nicht vor. Der zugehörige Faktor fällt dann
 * aus der Rechnung heraus, statt geraten zu werden.
 */
export interface Bedingungen {
  zeit: Date
  /** Luftdruck auf Meereshöhe in hPa */
  luftdruckHpa: number
  /** Änderung des Luftdrucks über die letzten 24 h in hPa (negativ = fallend) */
  luftdruckTrend24hHpa: number
  /** Pegel relativ zum Mittelwasser: -1 sehr niedrig, 0 mittel, +1 sehr hoch */
  pegelNiveauRelativ: number | null
  /** Pegeländerung über 24 h in cm (negativ = fallend) */
  pegelAenderung24hCm: number | null
  /** Wassertemperatur in °C, oder null wenn nicht gemessen */
  wassertemperaturC: number | null
  /** Bewölkungsgrad 0–100 */
  bewoelkungProzent: number
  /** Windgeschwindigkeit in km/h */
  windKmh: number
  sonnenaufgang: Date
  sonnenuntergang: Date
  /** Solunar-Stärke 0–1, aus dem Mondstand berechnet */
  solunarStaerke: number
  /** Alter der zugrunde liegenden Messdaten in Minuten */
  datenAlterMinuten: number
}

export interface Beitrag {
  key: FaktorKey
  label: string
  /** Rohwert des Faktors, -1 bis +1 */
  roh: number
  /** Gewicht des Faktors, 0 bis 3 */
  gewicht: number
  /** roh * gewicht */
  beitrag: number
  /** Klartext für die Detailansicht, z. B. "Luftdruck fällt (−3,2 hPa/24 h)" */
  text: string
  /** true, wenn der Faktor mangels Daten nicht gerechnet werden konnte */
  fehlend: boolean
}

export interface AngewandteRegel {
  name: 'truebungsRegel' | 'aenderungsBremse'
  text: string
}

export interface IndexErgebnis {
  /** 0–10, oder null wenn die Daten zu alt sind */
  wert: number | null
  unsicher: boolean
  /** Grund, falls unsicher */
  unsicherGrund: string | null
  beitraege: Beitrag[]
  regeln: AngewandteRegel[]
}

export type Gewichte = Record<FaktorKey, number>
```

- [ ] **Step 2: Test für die Gewichte schreiben**

`src/lib/beissindex/gewichte.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { STANDARD_GEWICHTE } from './gewichte'
import { FISCHE, FAKTOR_KEYS } from './typen'

describe('STANDARD_GEWICHTE', () => {
  it('kennt jeden Fisch', () => {
    for (const fisch of FISCHE) {
      expect(STANDARD_GEWICHTE[fisch]).toBeDefined()
    }
  })

  it('setzt für jeden Fisch jeden Faktor', () => {
    for (const fisch of FISCHE) {
      for (const key of FAKTOR_KEYS) {
        expect(typeof STANDARD_GEWICHTE[fisch][key]).toBe('number')
      }
    }
  })

  it('hält alle Gewichte zwischen 0 und 3', () => {
    for (const fisch of FISCHE) {
      for (const key of FAKTOR_KEYS) {
        const g = STANDARD_GEWICHTE[fisch][key]
        expect(g).toBeGreaterThanOrEqual(0)
        expect(g).toBeLessThanOrEqual(3)
      }
    }
  })

  it('gewichtet Solunar hoch, weil Daniel an den Mond glaubt', () => {
    expect(STANDARD_GEWICHTE.hecht.solunar).toBeGreaterThanOrEqual(3)
    expect(STANDARD_GEWICHTE.zander.solunar).toBeGreaterThanOrEqual(3)
    expect(STANDARD_GEWICHTE.aal.solunar).toBeGreaterThanOrEqual(3)
  })

  it('schaltet Wind beim Aal ab', () => {
    expect(STANDARD_GEWICHTE.aal.wind).toBe(0)
  })
})
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run src/lib/beissindex/gewichte.test.ts`
Expected: FAIL — `Cannot find module './gewichte'`

- [ ] **Step 4: Gewichte schreiben**

`src/lib/beissindex/gewichte.ts`:

```ts
import type { Fisch, Gewichte } from './typen'

/**
 * Startwerte aus dem Design (Spec §5.3). Ausdrücklich ein Vorschlag, kein
 * Naturgesetz — der Nutzer verstellt sie in den Einstellungen.
 */
export const STANDARD_GEWICHTE: Record<Fisch, Gewichte> = {
  hecht: {
    luftdruckTrend: 3,
    pegelNiveau: 1,
    truebung: 2,
    wassertemperatur: 2,
    licht: 2,
    tageszeit: 2,
    wind: 2,
    solunar: 3,
  },
  zander: {
    luftdruckTrend: 2,
    pegelNiveau: 3,
    truebung: 2,
    wassertemperatur: 2,
    licht: 3,
    tageszeit: 3,
    wind: 1,
    solunar: 3,
  },
  aal: {
    luftdruckTrend: 2,
    pegelNiveau: 3,
    truebung: 3,
    wassertemperatur: 3,
    licht: 1,
    tageszeit: 3,
    wind: 0,
    solunar: 3,
  },
  karpfen: {
    luftdruckTrend: 3,
    pegelNiveau: 1,
    truebung: 2,
    wassertemperatur: 3,
    licht: 2,
    tageszeit: 1,
    wind: 1,
    solunar: 2,
  },
}
```

- [ ] **Step 5: Test laufen lassen**

Run: `pnpm vitest run src/lib/beissindex/gewichte.test.ts`
Expected: PASS, 5 Tests

- [ ] **Step 6: Commit**

```bash
git add src/lib/beissindex/typen.ts src/lib/beissindex/gewichte.ts src/lib/beissindex/gewichte.test.ts
git commit -m "feat: add beissindex types and default weights"
```

---

### Task 3: Solunar-Berechnung

**Files:**
- Create: `src/lib/beissindex/solunar.ts`
- Test: `src/lib/beissindex/solunar.test.ts`

**Interfaces:**
- Consumes: `suncalc`
- Produces:
  - `solunarStaerke(zeit: Date, lat: number, lon: number): number` — 0–1
  - `solunarFenster(tag: Date, lat: number, lon: number): SolunarFenster[]`
  - `interface SolunarFenster { von: Date; bis: Date; art: 'haupt' | 'neben' }`

**Fachlicher Hintergrund für den Umsetzenden:** Die Solunar-Theorie nimmt an, dass Fische besonders aktiv sind, wenn der Mond am höchsten (Durchgang) oder tiefsten (Gegendurchgang) steht — das sind die *Hauptzeiten*, jeweils rund zwei Stunden lang. Mondauf- und -untergang gelten als *Nebenzeiten*, rund eine Stunde lang. `suncalc` liefert Mondauf-/-untergang direkt und die Mondposition zu jedem Zeitpunkt; den Höchststand findet man, indem man den Tag in Minutenschritten abfährt und das Maximum der Mondhöhe (`altitude`) sucht.

- [ ] **Step 1: Test schreiben**

`src/lib/beissindex/solunar.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { solunarStaerke, solunarFenster } from './solunar'

// Kalkar, Niederrhein
const LAT = 51.7386
const LON = 6.2911

describe('solunarFenster', () => {
  it('liefert mindestens eine Hauptzeit pro Tag', () => {
    const fenster = solunarFenster(new Date('2026-08-21T12:00:00Z'), LAT, LON)
    const haupt = fenster.filter((f) => f.art === 'haupt')
    expect(haupt.length).toBeGreaterThanOrEqual(1)
  })

  it('legt jedes Fenster mit von < bis an', () => {
    const fenster = solunarFenster(new Date('2026-08-21T12:00:00Z'), LAT, LON)
    for (const f of fenster) {
      expect(f.von.getTime()).toBeLessThan(f.bis.getTime())
    }
  })

  it('hält alle Fenster innerhalb eines Tages um das Datum herum', () => {
    const tag = new Date('2026-08-21T12:00:00Z')
    const fenster = solunarFenster(tag, LAT, LON)
    for (const f of fenster) {
      const abstandStunden = Math.abs(f.von.getTime() - tag.getTime()) / 3_600_000
      expect(abstandStunden).toBeLessThan(26)
    }
  })
})

describe('solunarStaerke', () => {
  it('bleibt immer zwischen 0 und 1', () => {
    for (let stunde = 0; stunde < 24; stunde++) {
      const zeit = new Date(Date.UTC(2026, 7, 21, stunde))
      const s = solunarStaerke(zeit, LAT, LON)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(1)
    }
  })

  it('ist innerhalb einer Hauptzeit höher als weit davon entfernt', () => {
    const tag = new Date('2026-08-21T12:00:00Z')
    const haupt = solunarFenster(tag, LAT, LON).filter((f) => f.art === 'haupt')[0]
    const mitte = new Date((haupt.von.getTime() + haupt.bis.getTime()) / 2)
    const weitWeg = new Date(mitte.getTime() + 6 * 3_600_000)

    expect(solunarStaerke(mitte, LAT, LON)).toBeGreaterThan(
      solunarStaerke(weitWeg, LAT, LON),
    )
  })

  it('erreicht in der Mitte einer Hauptzeit einen hohen Wert', () => {
    const tag = new Date('2026-08-21T12:00:00Z')
    const haupt = solunarFenster(tag, LAT, LON).filter((f) => f.art === 'haupt')[0]
    const mitte = new Date((haupt.von.getTime() + haupt.bis.getTime()) / 2)
    expect(solunarStaerke(mitte, LAT, LON)).toBeGreaterThan(0.8)
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run src/lib/beissindex/solunar.test.ts`
Expected: FAIL — `Cannot find module './solunar'`

- [ ] **Step 3: Solunar implementieren**

`src/lib/beissindex/solunar.ts`:

```ts
import SunCalc from 'suncalc'

export interface SolunarFenster {
  von: Date
  bis: Date
  art: 'haupt' | 'neben'
}

const MINUTE = 60_000
const STUNDE = 60 * MINUTE

/** Halbe Länge der Hauptzeit (Mondhöchst-/-tiefststand): ±60 min */
const HAUPT_HALBBREITE = 60 * MINUTE
/** Halbe Länge der Nebenzeit (Mondauf-/-untergang): ±30 min */
const NEBEN_HALBBREITE = 30 * MINUTE

function tagesBeginn(tag: Date): Date {
  const d = new Date(tag)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Sucht Mondhöchst- und -tiefststand, indem der Tag in 10-Minuten-Schritten
 * abgefahren und die Mondhöhe verglichen wird. Genauer als nötig — der
 * Fehler liegt weit unter der Breite eines Beißfensters.
 */
function durchgaenge(tag: Date, lat: number, lon: number): { hoch: Date; tief: Date } {
  const start = tagesBeginn(tag)
  let hoch = start
  let tief = start
  let maxAlt = -Infinity
  let minAlt = Infinity

  for (let m = 0; m < 24 * 60; m += 10) {
    const zeit = new Date(start.getTime() + m * MINUTE)
    const { altitude } = SunCalc.getMoonPosition(zeit, lat, lon)
    if (altitude > maxAlt) {
      maxAlt = altitude
      hoch = zeit
    }
    if (altitude < minAlt) {
      minAlt = altitude
      tief = zeit
    }
  }

  return { hoch, tief }
}

export function solunarFenster(tag: Date, lat: number, lon: number): SolunarFenster[] {
  const fenster: SolunarFenster[] = []
  const { hoch, tief } = durchgaenge(tag, lat, lon)

  for (const zeitpunkt of [hoch, tief]) {
    fenster.push({
      von: new Date(zeitpunkt.getTime() - HAUPT_HALBBREITE),
      bis: new Date(zeitpunkt.getTime() + HAUPT_HALBBREITE),
      art: 'haupt',
    })
  }

  const mondzeiten = SunCalc.getMoonTimes(tagesBeginn(tag), lat, lon)
  for (const zeitpunkt of [mondzeiten.rise, mondzeiten.set]) {
    if (!zeitpunkt) continue
    fenster.push({
      von: new Date(zeitpunkt.getTime() - NEBEN_HALBBREITE),
      bis: new Date(zeitpunkt.getTime() + NEBEN_HALBBREITE),
      art: 'neben',
    })
  }

  return fenster.sort((a, b) => a.von.getTime() - b.von.getTime())
}

/**
 * Solunar-Stärke 0–1 für einen Zeitpunkt.
 *
 * Innerhalb einer Hauptzeit steigt der Wert dreieckig bis 1,0 in der Mitte,
 * innerhalb einer Nebenzeit bis 0,6. Außerhalb bleibt eine Grundlinie von 0,2,
 * damit der Faktor nicht die halbe Zeit hart auf null steht.
 */
export function solunarStaerke(zeit: Date, lat: number, lon: number): number {
  const GRUNDLINIE = 0.2
  const fenster = [
    ...solunarFenster(new Date(zeit.getTime() - 24 * STUNDE), lat, lon),
    ...solunarFenster(zeit, lat, lon),
    ...solunarFenster(new Date(zeit.getTime() + 24 * STUNDE), lat, lon),
  ]

  let staerke = GRUNDLINIE

  for (const f of fenster) {
    const mitte = (f.von.getTime() + f.bis.getTime()) / 2
    const halbbreite = (f.bis.getTime() - f.von.getTime()) / 2
    const abstand = Math.abs(zeit.getTime() - mitte)
    if (abstand >= halbbreite) continue

    const naehe = 1 - abstand / halbbreite
    const spitze = f.art === 'haupt' ? 1 : 0.6
    staerke = Math.max(staerke, GRUNDLINIE + (spitze - GRUNDLINIE) * naehe)
  }

  return Math.min(1, Math.max(0, staerke))
}
```

- [ ] **Step 4: Test laufen lassen**

Run: `pnpm vitest run src/lib/beissindex/solunar.test.ts`
Expected: PASS, 6 Tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/beissindex/solunar.ts src/lib/beissindex/solunar.test.ts
git commit -m "feat: add solunar windows and strength calculation"
```

---

### Task 4: Hilfsfunktionen und Trübungs-Ableitung

**Files:**
- Create: `src/lib/beissindex/hilfen.ts`
- Test: `src/lib/beissindex/hilfen.test.ts`

**Interfaces:**
- Consumes: nichts
- Produces:
  - `begrenze(wert: number, min: number, max: number): number`
  - `optimumsKurve(wert: number, von: number, bis: number, toleranz: number): number` — 1 innerhalb [von, bis], linear fallend bis −1 bei `toleranz` Abstand
  - `naeheZu(wert: number, ziel: number, spanne: number): number` — 1 bei Gleichheit, −1 bei `spanne` Abstand
  - `truebungAus(pegelAenderung24hCm: number, pegelNiveauRelativ: number): number` — 0–1

- [ ] **Step 1: Test schreiben**

`src/lib/beissindex/hilfen.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { begrenze, optimumsKurve, naeheZu, truebungAus } from './hilfen'

describe('begrenze', () => {
  it('lässt Werte im Bereich unverändert', () => {
    expect(begrenze(0.5, -1, 1)).toBe(0.5)
  })
  it('kappt nach oben und unten', () => {
    expect(begrenze(9, -1, 1)).toBe(1)
    expect(begrenze(-9, -1, 1)).toBe(-1)
  })
})

describe('optimumsKurve', () => {
  it('gibt 1 innerhalb des Optimums', () => {
    expect(optimumsKurve(12, 8, 16, 6)).toBe(1)
    expect(optimumsKurve(8, 8, 16, 6)).toBe(1)
    expect(optimumsKurve(16, 8, 16, 6)).toBe(1)
  })
  it('fällt außerhalb linear ab', () => {
    expect(optimumsKurve(19, 8, 16, 6)).toBeCloseTo(0, 5)
    expect(optimumsKurve(5, 8, 16, 6)).toBeCloseTo(0, 5)
  })
  it('erreicht -1 am Rand der Toleranz und bleibt dort', () => {
    expect(optimumsKurve(22, 8, 16, 6)).toBe(-1)
    expect(optimumsKurve(60, 8, 16, 6)).toBe(-1)
  })
})

describe('naeheZu', () => {
  it('gibt 1 bei Gleichheit', () => {
    expect(naeheZu(15, 15, 25)).toBe(1)
  })
  it('gibt -1 bei vollem Abstand', () => {
    expect(naeheZu(40, 15, 25)).toBe(-1)
  })
  it('gibt 0 bei halbem Abstand', () => {
    expect(naeheZu(27.5, 15, 25)).toBeCloseTo(0, 5)
  })
})

describe('truebungAus', () => {
  it('meldet klares Wasser bei fallendem Pegel auf niedrigem Niveau', () => {
    expect(truebungAus(-30, -0.5)).toBeLessThan(0.3)
  })
  it('meldet starke Trübung bei schnell steigendem Hochwasser', () => {
    expect(truebungAus(50, 0.9)).toBeGreaterThan(0.8)
  })
  it('bleibt immer zwischen 0 und 1', () => {
    for (const aenderung of [-200, -30, 0, 30, 200]) {
      for (const niveau of [-1, 0, 1]) {
        const t = truebungAus(aenderung, niveau)
        expect(t).toBeGreaterThanOrEqual(0)
        expect(t).toBeLessThanOrEqual(1)
      }
    }
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run src/lib/beissindex/hilfen.test.ts`
Expected: FAIL — `Cannot find module './hilfen'`

- [ ] **Step 3: Hilfen implementieren**

`src/lib/beissindex/hilfen.ts`:

```ts
export function begrenze(wert: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, wert))
}

/**
 * Wohlfühlfenster: 1 innerhalb von [von, bis], danach linear abfallend
 * bis -1 bei `toleranz` Abstand vom Fensterrand.
 */
export function optimumsKurve(
  wert: number,
  von: number,
  bis: number,
  toleranz: number,
): number {
  if (wert >= von && wert <= bis) return 1
  const abstand = wert < von ? von - wert : wert - bis
  return begrenze(1 - (2 * abstand) / toleranz, -1, 1)
}

/**
 * Nähe zu einem Zielwert: 1 bei Gleichheit, 0 bei halber Spanne,
 * -1 ab voller Spanne Abstand.
 */
export function naeheZu(wert: number, ziel: number, spanne: number): number {
  const abstand = Math.abs(wert - ziel)
  return begrenze(1 - (2 * abstand) / spanne, -1, 1)
}

/**
 * Trübung 0–1, abgeleitet aus der Pegeldynamik (Spec §5.3):
 * steigendes Wasser trübt ein, fallendes klart auf; hohes Niveau bleibt
 * länger trüb. Wird NICHT gemessen und ist entsprechend zu beschriften.
 */
export function truebungAus(
  pegelAenderung24hCm: number,
  pegelNiveauRelativ: number,
): number {
  const ausAenderung = begrenze((pegelAenderung24hCm + 40) / 80, 0, 1)
  const ausNiveau = begrenze((pegelNiveauRelativ + 1) / 2, 0, 1)
  return begrenze(0.6 * ausAenderung + 0.4 * ausNiveau, 0, 1)
}
```

- [ ] **Step 4: Test laufen lassen**

Run: `pnpm vitest run src/lib/beissindex/hilfen.test.ts`
Expected: PASS, 11 Tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/beissindex/hilfen.ts src/lib/beissindex/hilfen.test.ts
git commit -m "feat: add scoring helpers and turbidity derivation"
```

---

### Task 5: Die acht Faktoren

**Files:**
- Create: `src/lib/beissindex/faktoren.ts`
- Test: `src/lib/beissindex/faktoren.test.ts`

**Interfaces:**
- Consumes: `Bedingungen`, `Fisch`, `FaktorKey` aus `./typen`; `begrenze`, `optimumsKurve`, `naeheZu`, `truebungAus` aus `./hilfen`
- Produces:
  - `type Tagesphase = 'nacht' | 'daemmerung' | 'tag'`
  - `tagesphase(zeit: Date, sonnenaufgang: Date, sonnenuntergang: Date): Tagesphase`
  - `interface FaktorErgebnis { roh: number | null; text: string }`
  - `berechneFaktor(key: FaktorKey, b: Bedingungen, fisch: Fisch, tageszeitUeberschreibung?: number): FaktorErgebnis`

- [ ] **Step 1: Test schreiben**

`src/lib/beissindex/faktoren.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { berechneFaktor, tagesphase } from './faktoren'
import { FAKTOR_KEYS, FISCHE, type Bedingungen } from './typen'

function basis(ueberschreibung: Partial<Bedingungen> = {}): Bedingungen {
  return {
    zeit: new Date('2026-08-21T12:00:00Z'),
    luftdruckHpa: 1013,
    luftdruckTrend24hHpa: 0,
    pegelNiveauRelativ: 0,
    pegelAenderung24hCm: 0,
    wassertemperaturC: 14,
    bewoelkungProzent: 50,
    windKmh: 10,
    sonnenaufgang: new Date('2026-08-21T04:30:00Z'),
    sonnenuntergang: new Date('2026-08-21T18:45:00Z'),
    solunarStaerke: 0.2,
    datenAlterMinuten: 5,
    ...ueberschreibung,
  }
}

describe('tagesphase', () => {
  const auf = new Date('2026-08-21T04:30:00Z')
  const unter = new Date('2026-08-21T18:45:00Z')

  it('erkennt Nacht', () => {
    expect(tagesphase(new Date('2026-08-21T02:00:00Z'), auf, unter)).toBe('nacht')
  })
  it('erkennt Tag', () => {
    expect(tagesphase(new Date('2026-08-21T12:00:00Z'), auf, unter)).toBe('tag')
  })
  it('erkennt Morgendämmerung', () => {
    expect(tagesphase(new Date('2026-08-21T04:45:00Z'), auf, unter)).toBe('daemmerung')
  })
  it('erkennt Abenddämmerung', () => {
    expect(tagesphase(new Date('2026-08-21T18:30:00Z'), auf, unter)).toBe('daemmerung')
  })
})

describe('berechneFaktor — Wertebereich', () => {
  it('liefert für jeden Faktor und jeden Fisch einen Wert in [-1, 1]', () => {
    for (const key of FAKTOR_KEYS) {
      for (const fisch of FISCHE) {
        for (const b of [
          basis(),
          basis({ luftdruckTrend24hHpa: -20, windKmh: 80, wassertemperaturC: 35 }),
          basis({ luftdruckTrend24hHpa: 20, windKmh: 0, wassertemperaturC: -2 }),
          basis({ pegelNiveauRelativ: 1, pegelAenderung24hCm: 120 }),
          basis({ pegelNiveauRelativ: -1, pegelAenderung24hCm: -120 }),
        ]) {
          const { roh } = berechneFaktor(key, b, fisch)
          if (roh === null) continue
          expect(roh, `${key}/${fisch}`).toBeGreaterThanOrEqual(-1)
          expect(roh, `${key}/${fisch}`).toBeLessThanOrEqual(1)
        }
      }
    }
  })
})

describe('berechneFaktor — fehlende Daten', () => {
  it('meldet null für Pegel-Niveau ohne Pegeldaten', () => {
    const b = basis({ pegelNiveauRelativ: null, pegelAenderung24hCm: null })
    expect(berechneFaktor('pegelNiveau', b, 'hecht').roh).toBeNull()
  })
  it('meldet null für Trübung ohne Pegeldaten', () => {
    const b = basis({ pegelNiveauRelativ: null, pegelAenderung24hCm: null })
    expect(berechneFaktor('truebung', b, 'aal').roh).toBeNull()
  })
  it('meldet null für Wassertemperatur ohne Messwert', () => {
    const b = basis({ wassertemperaturC: null })
    expect(berechneFaktor('wassertemperatur', b, 'karpfen').roh).toBeNull()
  })
})

describe('berechneFaktor — Fachlogik', () => {
  it('belohnt fallenden Luftdruck beim Hecht', () => {
    const fallend = berechneFaktor('luftdruckTrend', basis({ luftdruckTrend24hHpa: -4 }), 'hecht')
    const steigend = berechneFaktor('luftdruckTrend', basis({ luftdruckTrend24hHpa: 4 }), 'hecht')
    expect(fallend.roh!).toBeGreaterThan(steigend.roh!)
  })

  it('belohnt stabilen Hochdruck beim Karpfen', () => {
    const stabilHoch = berechneFaktor(
      'luftdruckTrend',
      basis({ luftdruckHpa: 1024, luftdruckTrend24hHpa: 0 }),
      'karpfen',
    )
    const fallendTief = berechneFaktor(
      'luftdruckTrend',
      basis({ luftdruckHpa: 998, luftdruckTrend24hHpa: -6 }),
      'karpfen',
    )
    expect(stabilHoch.roh!).toBeGreaterThan(fallendTief.roh!)
  })

  it('belohnt hohes ruhiges Wasser beim Zander stärker als niedriges', () => {
    const hochRuhig = berechneFaktor(
      'pegelNiveau',
      basis({ pegelNiveauRelativ: 0.8, pegelAenderung24hCm: 2 }),
      'zander',
    )
    const niedrig = berechneFaktor(
      'pegelNiveau',
      basis({ pegelNiveauRelativ: -0.8, pegelAenderung24hCm: 2 }),
      'zander',
    )
    expect(hochRuhig.roh!).toBeGreaterThan(niedrig.roh!)
  })

  it('entwertet hohes Wasser, wenn es sich schnell bewegt', () => {
    const ruhig = berechneFaktor(
      'pegelNiveau',
      basis({ pegelNiveauRelativ: 0.8, pegelAenderung24hCm: 0 }),
      'zander',
    )
    const hektisch = berechneFaktor(
      'pegelNiveau',
      basis({ pegelNiveauRelativ: 0.8, pegelAenderung24hCm: 60 }),
      'zander',
    )
    expect(hektisch.roh!).toBeLessThan(ruhig.roh!)
  })

  it('mag der Aal trübes Wasser, der Hecht klares', () => {
    const trueb = basis({ pegelNiveauRelativ: 0.9, pegelAenderung24hCm: 40 })
    const klar = basis({ pegelNiveauRelativ: -0.5, pegelAenderung24hCm: -30 })
    expect(berechneFaktor('truebung', trueb, 'aal').roh!).toBeGreaterThan(
      berechneFaktor('truebung', klar, 'aal').roh!,
    )
    expect(berechneFaktor('truebung', klar, 'hecht').roh!).toBeGreaterThan(
      berechneFaktor('truebung', trueb, 'hecht').roh!,
    )
  })

  it('setzt beim Karpfen warmes Wasser über kaltes', () => {
    expect(berechneFaktor('wassertemperatur', basis({ wassertemperaturC: 21 }), 'karpfen').roh!)
      .toBeGreaterThan(
        berechneFaktor('wassertemperatur', basis({ wassertemperaturC: 6 }), 'karpfen').roh!,
      )
  })

  it('schickt den Aal in die Nacht und den Karpfen nicht', () => {
    const nachts = basis({ zeit: new Date('2026-08-21T01:00:00Z') })
    expect(berechneFaktor('tageszeit', nachts, 'aal').roh!).toBeGreaterThan(0.5)
    expect(berechneFaktor('tageszeit', nachts, 'karpfen').roh!).toBeLessThan(0)
  })

  it('nimmt die Tageszeit-Überschreibung an, wenn eine Regel sie setzt', () => {
    const mittags = basis({ zeit: new Date('2026-08-21T12:00:00Z') })
    const ohne = berechneFaktor('tageszeit', mittags, 'zander')
    const mit = berechneFaktor('tageszeit', mittags, 'zander', 0.5)
    expect(ohne.roh!).toBeLessThan(0)
    expect(mit.roh).toBe(0.5)
  })

  it('rechnet Solunar linear auf -1 bis 1 um', () => {
    expect(berechneFaktor('solunar', basis({ solunarStaerke: 1 }), 'hecht').roh).toBe(1)
    expect(berechneFaktor('solunar', basis({ solunarStaerke: 0 }), 'hecht').roh).toBe(-1)
    expect(berechneFaktor('solunar', basis({ solunarStaerke: 0.5 }), 'hecht').roh).toBe(0)
  })

  it('liefert zu jedem Faktor einen nicht-leeren Klartext', () => {
    for (const key of FAKTOR_KEYS) {
      expect(berechneFaktor(key, basis(), 'hecht').text.length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run src/lib/beissindex/faktoren.test.ts`
Expected: FAIL — `Cannot find module './faktoren'`

- [ ] **Step 3: Faktoren implementieren**

`src/lib/beissindex/faktoren.ts`:

```ts
import type { Bedingungen, FaktorKey, Fisch } from './typen'
import { begrenze, naeheZu, optimumsKurve, truebungAus } from './hilfen'

export type Tagesphase = 'nacht' | 'daemmerung' | 'tag'

export interface FaktorErgebnis {
  /** -1 bis 1, oder null wenn die nötigen Daten fehlen */
  roh: number | null
  text: string
}

const DAEMMERUNG_MINUTEN = 60
const MINUTE = 60_000

export function tagesphase(
  zeit: Date,
  sonnenaufgang: Date,
  sonnenuntergang: Date,
): Tagesphase {
  const t = zeit.getTime()
  const auf = sonnenaufgang.getTime()
  const unter = sonnenuntergang.getTime()
  const spanne = DAEMMERUNG_MINUTEN * MINUTE

  if (Math.abs(t - auf) <= spanne || Math.abs(t - unter) <= spanne) return 'daemmerung'
  return t > auf && t < unter ? 'tag' : 'nacht'
}

/** Wohlfühlfenster der Wassertemperatur je Art, in °C */
const TEMPERATUR_FENSTER: Record<Fisch, { von: number; bis: number }> = {
  hecht: { von: 8, bis: 16 },
  zander: { von: 10, bis: 20 },
  aal: { von: 12, bis: 26 },
  karpfen: { von: 18, bis: 24 },
}

/** Bevorzugte Trübung je Art, 0 = klar, 1 = stark getrübt */
const TRUEBUNG_OPTIMUM: Record<Fisch, number> = {
  hecht: 0.2,
  zander: 0.45,
  aal: 0.8,
  karpfen: 0.3,
}

/** Bevorzugte Dunkelheit je Art, 0 = grell, 1 = stockdunkel */
const DUNKELHEIT_OPTIMUM: Record<Fisch, number> = {
  hecht: 0.6,
  zander: 0.9,
  aal: 0.5,
  karpfen: 0.2,
}

/** Bevorzugte Windgeschwindigkeit je Art, in km/h */
const WIND_OPTIMUM: Record<Fisch, number> = {
  hecht: 15,
  zander: 12,
  aal: 8,
  karpfen: 5,
}

const TAGESZEIT_WERTE: Record<Fisch, Record<Tagesphase, number>> = {
  hecht: { daemmerung: 1, tag: 0.2, nacht: -0.3 },
  zander: { daemmerung: 1, tag: -0.4, nacht: 0.7 },
  aal: { daemmerung: 0.4, tag: -1, nacht: 1 },
  karpfen: { daemmerung: 0.6, tag: 0.3, nacht: -0.2 },
}

function zahl(wert: number, stellen = 1): string {
  return wert.toFixed(stellen).replace('.', ',')
}

export function berechneFaktor(
  key: FaktorKey,
  b: Bedingungen,
  fisch: Fisch,
  tageszeitUeberschreibung?: number,
): FaktorErgebnis {
  switch (key) {
    case 'luftdruckTrend': {
      const richtung =
        b.luftdruckTrend24hHpa < -0.5
          ? 'fällt'
          : b.luftdruckTrend24hHpa > 0.5
            ? 'steigt'
            : 'ist stabil'
      const text = `Luftdruck ${richtung} (${zahl(b.luftdruckTrend24hHpa)} hPa/24 h, ${Math.round(b.luftdruckHpa)} hPa)`

      if (fisch === 'karpfen') {
        // Karpfen mag stabiles Hochdruckwetter.
        const stabilitaet = begrenze(1 - Math.abs(b.luftdruckTrend24hHpa) / 3, -1, 1)
        const niveau = begrenze((b.luftdruckHpa - 1010) / 12, -1, 1)
        return { roh: begrenze(0.5 * stabilitaet + 0.5 * niveau, -1, 1), text }
      }
      // Raubfisch reagiert auf fallenden Druck.
      return { roh: begrenze(-b.luftdruckTrend24hHpa / 4, -1, 1), text }
    }

    case 'pegelNiveau': {
      if (b.pegelNiveauRelativ === null || b.pegelAenderung24hCm === null) {
        return { roh: null, text: 'Pegel unbekannt' }
      }
      const ruhe = begrenze(1 - Math.abs(b.pegelAenderung24hCm) / 40, 0, 1)
      const roh = begrenze(b.pegelNiveauRelativ * ruhe, -1, 1)
      const lage =
        b.pegelNiveauRelativ > 0.3 ? 'hoch' : b.pegelNiveauRelativ < -0.3 ? 'niedrig' : 'mittel'
      const bewegung = ruhe > 0.6 ? 'ruhig' : 'in Bewegung'
      return { roh, text: `Pegel ${lage} und ${bewegung} (${zahl(b.pegelAenderung24hCm, 0)} cm/24 h)` }
    }

    case 'truebung': {
      if (b.pegelNiveauRelativ === null || b.pegelAenderung24hCm === null) {
        return { roh: null, text: 'Trübung nicht ableitbar — Pegel unbekannt' }
      }
      const t = truebungAus(b.pegelAenderung24hCm, b.pegelNiveauRelativ)
      const roh = naeheZu(t, TRUEBUNG_OPTIMUM[fisch], 1)
      const beschreibung = t > 0.65 ? 'stark getrübt' : t > 0.35 ? 'leicht trüb' : 'klar'
      return { roh, text: `Wasser ${beschreibung} (aus Pegelbewegung abgeleitet)` }
    }

    case 'wassertemperatur': {
      if (b.wassertemperaturC === null) {
        return { roh: null, text: 'Wassertemperatur liegt nicht vor' }
      }
      const { von, bis } = TEMPERATUR_FENSTER[fisch]
      return {
        roh: optimumsKurve(b.wassertemperaturC, von, bis, 8),
        text: `Wasser ${zahl(b.wassertemperaturC)} °C (gut: ${von}–${bis} °C)`,
      }
    }

    case 'licht': {
      const phase = tagesphase(b.zeit, b.sonnenaufgang, b.sonnenuntergang)
      const helligkeit =
        phase === 'nacht' ? 0 : (1 - b.bewoelkungProzent / 100) * (phase === 'daemmerung' ? 0.4 : 1)
      const dunkelheit = 1 - helligkeit
      return {
        roh: naeheZu(dunkelheit, DUNKELHEIT_OPTIMUM[fisch], 1),
        text: `Bewölkung ${Math.round(b.bewoelkungProzent)} %, ${phase === 'nacht' ? 'dunkel' : phase === 'daemmerung' ? 'Dämmerlicht' : 'Tageslicht'}`,
      }
    }

    case 'tageszeit': {
      const phase = tagesphase(b.zeit, b.sonnenaufgang, b.sonnenuntergang)
      const beschriftung = { nacht: 'Nacht', daemmerung: 'Dämmerung', tag: 'Tag' }[phase]
      if (tageszeitUeberschreibung !== undefined) {
        return {
          roh: begrenze(tageszeitUeberschreibung, -1, 1),
          text: `${beschriftung} — durch Regel angehoben`,
        }
      }
      return { roh: TAGESZEIT_WERTE[fisch][phase], text: beschriftung }
    }

    case 'wind': {
      return {
        roh: naeheZu(b.windKmh, WIND_OPTIMUM[fisch], 25),
        text: `Wind ${Math.round(b.windKmh)} km/h`,
      }
    }

    case 'solunar': {
      const roh = begrenze(2 * b.solunarStaerke - 1, -1, 1)
      const lage =
        b.solunarStaerke > 0.75 ? 'Hauptbeißzeit' : b.solunarStaerke > 0.45 ? 'Nebenbeißzeit' : 'außerhalb der Mondzeiten'
      return { roh, text: `Solunar: ${lage}` }
    }
  }
}
```

- [ ] **Step 4: Test laufen lassen**

Run: `pnpm vitest run src/lib/beissindex/faktoren.test.ts`
Expected: PASS, alle Tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/beissindex/faktoren.ts src/lib/beissindex/faktoren.test.ts
git commit -m "feat: add the eight beissindex factors"
```

---

### Task 6: Die zwei Wechselwirkungsregeln

**Files:**
- Create: `src/lib/beissindex/regeln.ts`
- Test: `src/lib/beissindex/regeln.test.ts`

**Interfaces:**
- Consumes: `Bedingungen`, `Fisch`, `AngewandteRegel` aus `./typen`; `tagesphase` aus `./faktoren`; `truebungAus`, `begrenze` aus `./hilfen`
- Produces:
  - `pruefeTruebungsRegel(b: Bedingungen, fisch: Fisch): { tageszeitUeberschreibung?: number; regel?: AngewandteRegel }`
  - `pruefeAenderungsBremse(b: Bedingungen): { faktor: number; regel?: AngewandteRegel }`

**Zur Erinnerung (Spec §5.5):** Genau diese zwei Regeln — keine weiteren. Beide erscheinen namentlich in der Begründung.

- [ ] **Step 1: Test schreiben**

`src/lib/beissindex/regeln.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { pruefeTruebungsRegel, pruefeAenderungsBremse } from './regeln'
import type { Bedingungen } from './typen'

function basis(ueberschreibung: Partial<Bedingungen> = {}): Bedingungen {
  return {
    zeit: new Date('2026-08-21T12:00:00Z'),
    luftdruckHpa: 1013,
    luftdruckTrend24hHpa: 0,
    pegelNiveauRelativ: 0,
    pegelAenderung24hCm: 0,
    wassertemperaturC: 14,
    bewoelkungProzent: 50,
    windKmh: 10,
    sonnenaufgang: new Date('2026-08-21T04:30:00Z'),
    sonnenuntergang: new Date('2026-08-21T18:45:00Z'),
    solunarStaerke: 0.2,
    datenAlterMinuten: 5,
    ...ueberschreibung,
  }
}

const HOCHWASSER_TRUEB = { pegelNiveauRelativ: 0.95, pegelAenderung24hCm: 45 }

describe('pruefeTruebungsRegel', () => {
  it('hebt den Zander tagsüber bei starker Trübung an', () => {
    const ergebnis = pruefeTruebungsRegel(basis(HOCHWASSER_TRUEB), 'zander')
    expect(ergebnis.tageszeitUeberschreibung).toBeGreaterThan(0)
    expect(ergebnis.regel?.name).toBe('truebungsRegel')
  })

  it('greift nicht beim Hecht', () => {
    expect(pruefeTruebungsRegel(basis(HOCHWASSER_TRUEB), 'hecht').regel).toBeUndefined()
  })

  it('greift nachts nicht', () => {
    const nachts = basis({ ...HOCHWASSER_TRUEB, zeit: new Date('2026-08-21T01:00:00Z') })
    expect(pruefeTruebungsRegel(nachts, 'zander').regel).toBeUndefined()
  })

  it('greift bei klarem Wasser nicht', () => {
    const klar = basis({ pegelNiveauRelativ: -0.6, pegelAenderung24hCm: -25 })
    expect(pruefeTruebungsRegel(klar, 'zander').regel).toBeUndefined()
  })

  it('greift ohne Pegeldaten nicht', () => {
    const ohne = basis({ pegelNiveauRelativ: null, pegelAenderung24hCm: null })
    expect(pruefeTruebungsRegel(ohne, 'zander').regel).toBeUndefined()
  })
})

describe('pruefeAenderungsBremse', () => {
  it('bremst nicht bei ruhigem Pegel', () => {
    const { faktor, regel } = pruefeAenderungsBremse(basis({ pegelAenderung24hCm: 10 }))
    expect(faktor).toBe(1)
    expect(regel).toBeUndefined()
  })

  it('bremst bei schnell steigendem Wasser', () => {
    const { faktor, regel } = pruefeAenderungsBremse(basis({ pegelAenderung24hCm: 70 }))
    expect(faktor).toBeLessThan(1)
    expect(regel?.name).toBe('aenderungsBremse')
  })

  it('bremst auch bei schnell fallendem Wasser', () => {
    const { faktor } = pruefeAenderungsBremse(basis({ pegelAenderung24hCm: -70 }))
    expect(faktor).toBeLessThan(1)
  })

  it('bremst symmetrisch — Richtung ist egal', () => {
    const rauf = pruefeAenderungsBremse(basis({ pegelAenderung24hCm: 80 })).faktor
    const runter = pruefeAenderungsBremse(basis({ pegelAenderung24hCm: -80 })).faktor
    expect(rauf).toBeCloseTo(runter, 10)
  })

  it('bremst nie unter 0,5', () => {
    const { faktor } = pruefeAenderungsBremse(basis({ pegelAenderung24hCm: 500 }))
    expect(faktor).toBeGreaterThanOrEqual(0.5)
  })

  it('bremst ohne Pegeldaten nicht', () => {
    const { faktor } = pruefeAenderungsBremse(basis({ pegelAenderung24hCm: null }))
    expect(faktor).toBe(1)
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run src/lib/beissindex/regeln.test.ts`
Expected: FAIL — `Cannot find module './regeln'`

- [ ] **Step 3: Regeln implementieren**

`src/lib/beissindex/regeln.ts`:

```ts
import type { AngewandteRegel, Bedingungen, Fisch } from './typen'
import { begrenze, truebungAus } from './hilfen'
import { tagesphase } from './faktoren'

/** Ab dieser Trübung beißt der Zander auch tagsüber (Spec §5.5) */
const TRUEBUNG_SCHWELLE = 0.6
/** Wert, auf den die Tageszeit für den Zander dann angehoben wird */
const TAGESZEIT_ANHEBUNG = 0.5

/** Ab dieser Pegeländerung greift die Bremse (Spec §5.5) */
const BREMS_SCHWELLE_CM = 30
/** Stärkste mögliche Bremsung */
const BREMS_MINIMUM = 0.5

export function pruefeTruebungsRegel(
  b: Bedingungen,
  fisch: Fisch,
): { tageszeitUeberschreibung?: number; regel?: AngewandteRegel } {
  if (fisch !== 'zander') return {}
  if (b.pegelNiveauRelativ === null || b.pegelAenderung24hCm === null) return {}

  const t = truebungAus(b.pegelAenderung24hCm, b.pegelNiveauRelativ)
  if (t < TRUEBUNG_SCHWELLE) return {}

  const phase = tagesphase(b.zeit, b.sonnenaufgang, b.sonnenuntergang)
  if (phase !== 'tag') return {}

  return {
    tageszeitUeberschreibung: TAGESZEIT_ANHEBUNG,
    regel: {
      name: 'truebungsRegel',
      text: 'Wasser stark getrübt — Zander beißt heute auch am Tag.',
    },
  }
}

export function pruefeAenderungsBremse(
  b: Bedingungen,
): { faktor: number; regel?: AngewandteRegel } {
  if (b.pegelAenderung24hCm === null) return { faktor: 1 }

  const betrag = Math.abs(b.pegelAenderung24hCm)
  if (betrag <= BREMS_SCHWELLE_CM) return { faktor: 1 }

  const faktor = begrenze(1 - (betrag - BREMS_SCHWELLE_CM) / 100, BREMS_MINIMUM, 1)
  const richtung = b.pegelAenderung24hCm > 0 ? 'steigt' : 'fällt'
  const vorzeichen = b.pegelAenderung24hCm > 0 ? '+' : '−'

  return {
    faktor,
    regel: {
      name: 'aenderungsBremse',
      text: `Pegel ${richtung} schnell (${vorzeichen}${Math.round(betrag)} cm/Tag) — Fische stehen um.`,
    },
  }
}
```

- [ ] **Step 4: Test laufen lassen**

Run: `pnpm vitest run src/lib/beissindex/regeln.test.ts`
Expected: PASS, 11 Tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/beissindex/regeln.ts src/lib/beissindex/regeln.test.ts
git commit -m "feat: add the two named factor interactions"
```

---

### Task 7: Der Index-Rechner

**Files:**
- Create: `src/lib/beissindex/berechne.ts`
- Test: `src/lib/beissindex/berechne.test.ts`

**Interfaces:**
- Consumes: alles aus `./typen`, `./gewichte`, `./faktoren`, `./regeln`
- Produces:
  - `berechneIndex(b: Bedingungen, fisch: Fisch, gewichte?: Gewichte): IndexErgebnis`
  - `DATEN_MAX_ALTER_MINUTEN = 360`

- [ ] **Step 1: Test schreiben**

`src/lib/beissindex/berechne.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { berechneIndex, DATEN_MAX_ALTER_MINUTEN } from './berechne'
import { STANDARD_GEWICHTE } from './gewichte'
import { FISCHE, type Bedingungen } from './typen'

function basis(ueberschreibung: Partial<Bedingungen> = {}): Bedingungen {
  return {
    zeit: new Date('2026-08-21T12:00:00Z'),
    luftdruckHpa: 1013,
    luftdruckTrend24hHpa: 0,
    pegelNiveauRelativ: 0,
    pegelAenderung24hCm: 0,
    wassertemperaturC: 14,
    bewoelkungProzent: 50,
    windKmh: 10,
    sonnenaufgang: new Date('2026-08-21T04:30:00Z'),
    sonnenuntergang: new Date('2026-08-21T18:45:00Z'),
    solunarStaerke: 0.2,
    datenAlterMinuten: 5,
    ...ueberschreibung,
  }
}

describe('berechneIndex — Grundverhalten', () => {
  it('liefert für jeden Fisch einen Wert zwischen 0 und 10', () => {
    for (const fisch of FISCHE) {
      const { wert } = berechneIndex(basis(), fisch)
      expect(wert).not.toBeNull()
      expect(wert!).toBeGreaterThanOrEqual(0)
      expect(wert!).toBeLessThanOrEqual(10)
    }
  })

  it('liefert zu jedem Faktor einen Beitrag', () => {
    const { beitraege } = berechneIndex(basis(), 'hecht')
    expect(beitraege).toHaveLength(8)
  })

  it('rechnet beitrag als roh mal gewicht', () => {
    const { beitraege } = berechneIndex(basis(), 'hecht')
    for (const b of beitraege) {
      if (b.fehlend) continue
      expect(b.beitrag).toBeCloseTo(b.roh * b.gewicht, 10)
    }
  })

  it('ist deterministisch — gleiche Eingabe, gleiches Ergebnis', () => {
    const a = berechneIndex(basis(), 'zander')
    const b = berechneIndex(basis(), 'zander')
    expect(a.wert).toBe(b.wert)
  })
})

describe('berechneIndex — Veralterung', () => {
  it('meldet unsicher, wenn die Daten zu alt sind', () => {
    const alt = basis({ datenAlterMinuten: DATEN_MAX_ALTER_MINUTEN + 1 })
    const ergebnis = berechneIndex(alt, 'hecht')
    expect(ergebnis.wert).toBeNull()
    expect(ergebnis.unsicher).toBe(true)
    expect(ergebnis.unsicherGrund).toContain('alt')
  })

  it('rechnet noch, wenn die Daten genau an der Grenze liegen', () => {
    const grenzwertig = basis({ datenAlterMinuten: DATEN_MAX_ALTER_MINUTEN })
    expect(berechneIndex(grenzwertig, 'hecht').wert).not.toBeNull()
  })
})

describe('berechneIndex — fehlende Daten', () => {
  it('rechnet ohne Pegeldaten weiter und markiert die Lücken', () => {
    const ohnePegel = basis({
      pegelNiveauRelativ: null,
      pegelAenderung24hCm: null,
      wassertemperaturC: null,
    })
    const ergebnis = berechneIndex(ohnePegel, 'hecht')
    expect(ergebnis.wert).not.toBeNull()
    const fehlende = ergebnis.beitraege.filter((b) => b.fehlend).map((b) => b.key)
    expect(fehlende).toContain('pegelNiveau')
    expect(fehlende).toContain('truebung')
    expect(fehlende).toContain('wassertemperatur')
  })

  it('zählt fehlende Faktoren nicht in die Summe', () => {
    const ohnePegel = basis({ pegelNiveauRelativ: null, pegelAenderung24hCm: null })
    const { beitraege } = berechneIndex(ohnePegel, 'hecht')
    for (const b of beitraege.filter((x) => x.fehlend)) {
      expect(b.beitrag).toBe(0)
    }
  })
})

describe('berechneIndex — Regeln', () => {
  it('führt die Trübungs-Regel in der Begründung auf', () => {
    const hochwasser = basis({ pegelNiveauRelativ: 0.95, pegelAenderung24hCm: 25 })
    const { regeln } = berechneIndex(hochwasser, 'zander')
    expect(regeln.map((r) => r.name)).toContain('truebungsRegel')
  })

  it('führt die Änderungs-Bremse in der Begründung auf und senkt den Wert', () => {
    const ruhig = basis({ pegelNiveauRelativ: 0.5, pegelAenderung24hCm: 5 })
    const hektisch = basis({ pegelNiveauRelativ: 0.5, pegelAenderung24hCm: 90 })
    const a = berechneIndex(ruhig, 'aal')
    const b = berechneIndex(hektisch, 'aal')
    expect(b.regeln.map((r) => r.name)).toContain('aenderungsBremse')
    expect(b.wert!).toBeLessThan(a.wert!)
  })
})

describe('berechneIndex — eigene Gewichte', () => {
  it('ignoriert einen Faktor, dessen Gewicht auf 0 steht', () => {
    const ohneMond = { ...STANDARD_GEWICHTE.hecht, solunar: 0 }
    const schwach = basis({ solunarStaerke: 0 })
    const stark = basis({ solunarStaerke: 1 })
    expect(berechneIndex(schwach, 'hecht', ohneMond).wert).toBe(
      berechneIndex(stark, 'hecht', ohneMond).wert,
    )
  })

  it('lässt den Mond durchschlagen, wenn er gewichtet ist', () => {
    const schwach = basis({ solunarStaerke: 0 })
    const stark = basis({ solunarStaerke: 1 })
    expect(berechneIndex(stark, 'hecht').wert!).toBeGreaterThan(
      berechneIndex(schwach, 'hecht').wert!,
    )
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run src/lib/beissindex/berechne.test.ts`
Expected: FAIL — `Cannot find module './berechne'`

- [ ] **Step 3: Rechner implementieren**

`src/lib/beissindex/berechne.ts`:

```ts
import {
  FAKTOR_KEYS,
  FAKTOR_LABEL,
  type AngewandteRegel,
  type Bedingungen,
  type Beitrag,
  type Fisch,
  type Gewichte,
  type IndexErgebnis,
} from './typen'
import { STANDARD_GEWICHTE } from './gewichte'
import { berechneFaktor } from './faktoren'
import { pruefeAenderungsBremse, pruefeTruebungsRegel } from './regeln'
import { begrenze } from './hilfen'

/** Ab diesem Datenalter gibt es keinen Wert mehr, sondern „unsicher" (Spec §4.6) */
export const DATEN_MAX_ALTER_MINUTEN = 360

export function berechneIndex(
  b: Bedingungen,
  fisch: Fisch,
  gewichte: Gewichte = STANDARD_GEWICHTE[fisch],
): IndexErgebnis {
  const regeln: AngewandteRegel[] = []

  if (b.datenAlterMinuten > DATEN_MAX_ALTER_MINUTEN) {
    return {
      wert: null,
      unsicher: true,
      unsicherGrund: `Daten sind ${Math.round(b.datenAlterMinuten / 60)} Stunden alt`,
      beitraege: [],
      regeln,
    }
  }

  const truebungsRegel = pruefeTruebungsRegel(b, fisch)
  if (truebungsRegel.regel) regeln.push(truebungsRegel.regel)

  const beitraege: Beitrag[] = []
  let summe = 0
  let maxSumme = 0

  for (const key of FAKTOR_KEYS) {
    const gewicht = gewichte[key]
    const ueberschreibung =
      key === 'tageszeit' ? truebungsRegel.tageszeitUeberschreibung : undefined
    const { roh, text } = berechneFaktor(key, b, fisch, ueberschreibung)

    if (roh === null) {
      beitraege.push({
        key,
        label: FAKTOR_LABEL[key],
        roh: 0,
        gewicht,
        beitrag: 0,
        text,
        fehlend: true,
      })
      continue
    }

    const beitrag = roh * gewicht
    summe += beitrag
    maxSumme += gewicht

    beitraege.push({
      key,
      label: FAKTOR_LABEL[key],
      roh,
      gewicht,
      beitrag,
      text,
      fehlend: false,
    })
  }

  // Ohne gewichtete Faktoren gibt es nichts zu sagen.
  if (maxSumme === 0) {
    return {
      wert: null,
      unsicher: true,
      unsicherGrund: 'Alle Faktoren sind abgeschaltet oder ohne Daten',
      beitraege,
      regeln,
    }
  }

  const normiert = begrenze(summe / maxSumme, -1, 1)
  let wert = ((normiert + 1) / 2) * 10

  const bremse = pruefeAenderungsBremse(b)
  if (bremse.regel) regeln.push(bremse.regel)
  wert *= bremse.faktor

  return {
    wert: Math.round(begrenze(wert, 0, 10) * 10) / 10,
    unsicher: false,
    unsicherGrund: null,
    beitraege,
    regeln,
  }
}
```

- [ ] **Step 4: Test laufen lassen**

Run: `pnpm vitest run src/lib/beissindex/berechne.test.ts`
Expected: PASS, alle Tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/beissindex/berechne.ts src/lib/beissindex/berechne.test.ts
git commit -m "feat: add beissindex aggregator with rules and staleness"
```

---

### Task 8: Tages- und Wochenauswertung

**Files:**
- Create: `src/lib/beissindex/verlauf.ts`
- Test: `src/lib/beissindex/verlauf.test.ts`

**Interfaces:**
- Consumes: `berechneIndex` aus `./berechne`; Typen aus `./typen`
- Produces:
  - `interface StundenWert { zeit: Date; ergebnis: IndexErgebnis }`
  - `interface TagesWert { tag: Date; besteStunde: Date | null; wert: number | null; unsicher: boolean }`
  - `berechneStunden(bedingungen: Bedingungen[], fisch: Fisch, gewichte?: Gewichte): StundenWert[]`
  - `fasseZuTagenZusammen(stunden: StundenWert[]): TagesWert[]`
  - `besteZeitspanne(stunden: StundenWert[], tag: Date): { von: Date; bis: Date } | null`

**Wichtig (Spec §5.4):** Der Tageswert ist die **beste Stunde**, nicht der Durchschnitt.

- [ ] **Step 1: Test schreiben**

`src/lib/beissindex/verlauf.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { berechneStunden, fasseZuTagenZusammen, besteZeitspanne } from './verlauf'
import type { Bedingungen } from './typen'

function stunde(datumISO: string, ueberschreibung: Partial<Bedingungen> = {}): Bedingungen {
  return {
    zeit: new Date(datumISO),
    luftdruckHpa: 1013,
    luftdruckTrend24hHpa: 0,
    pegelNiveauRelativ: 0,
    pegelAenderung24hCm: 0,
    wassertemperaturC: 14,
    bewoelkungProzent: 50,
    windKmh: 10,
    sonnenaufgang: new Date(`${datumISO.slice(0, 10)}T04:30:00Z`),
    sonnenuntergang: new Date(`${datumISO.slice(0, 10)}T18:45:00Z`),
    solunarStaerke: 0.2,
    datenAlterMinuten: 5,
    ...ueberschreibung,
  }
}

function zweiTage(): Bedingungen[] {
  const liste: Bedingungen[] = []
  for (const tag of ['2026-08-21', '2026-08-22']) {
    for (let h = 0; h < 24; h++) {
      const hh = String(h).padStart(2, '0')
      liste.push(stunde(`${tag}T${hh}:00:00Z`))
    }
  }
  return liste
}

describe('berechneStunden', () => {
  it('liefert genau einen Wert je Eingabestunde', () => {
    const stunden = berechneStunden(zweiTage(), 'hecht')
    expect(stunden).toHaveLength(48)
  })

  it('behält die Reihenfolge bei', () => {
    const stunden = berechneStunden(zweiTage(), 'hecht')
    for (let i = 1; i < stunden.length; i++) {
      expect(stunden[i].zeit.getTime()).toBeGreaterThan(stunden[i - 1].zeit.getTime())
    }
  })
})

describe('fasseZuTagenZusammen', () => {
  it('bildet einen Eintrag je Kalendertag', () => {
    const tage = fasseZuTagenZusammen(berechneStunden(zweiTage(), 'aal'))
    expect(tage).toHaveLength(2)
  })

  it('nimmt die beste Stunde, nicht den Durchschnitt', () => {
    const stunden = berechneStunden(zweiTage(), 'aal')
    const tage = fasseZuTagenZusammen(stunden)

    const ersterTag = stunden.filter((s) => s.zeit.toISOString().startsWith('2026-08-21'))
    const werte = ersterTag.map((s) => s.ergebnis.wert).filter((w): w is number => w !== null)
    const maximum = Math.max(...werte)
    const durchschnitt = werte.reduce((a, b) => a + b, 0) / werte.length

    expect(tage[0].wert).toBeCloseTo(maximum, 5)
    expect(tage[0].wert!).toBeGreaterThan(durchschnitt)
  })

  it('nennt die Uhrzeit der besten Stunde', () => {
    const tage = fasseZuTagenZusammen(berechneStunden(zweiTage(), 'aal'))
    expect(tage[0].besteStunde).not.toBeNull()
  })

  it('meldet unsicher, wenn ein Tag nur unsichere Stunden hat', () => {
    const alt = zweiTage().map((b) => ({ ...b, datenAlterMinuten: 999 }))
    const tage = fasseZuTagenZusammen(berechneStunden(alt, 'hecht'))
    expect(tage[0].unsicher).toBe(true)
    expect(tage[0].wert).toBeNull()
  })
})

describe('besteZeitspanne', () => {
  it('liefert eine zusammenhängende Spanne um die beste Stunde', () => {
    const stunden = berechneStunden(zweiTage(), 'aal')
    const spanne = besteZeitspanne(stunden, new Date('2026-08-21T00:00:00Z'))
    expect(spanne).not.toBeNull()
    expect(spanne!.von.getTime()).toBeLessThan(spanne!.bis.getTime())
  })

  it('liefert null, wenn es keine Werte für den Tag gibt', () => {
    const stunden = berechneStunden(zweiTage(), 'aal')
    expect(besteZeitspanne(stunden, new Date('2030-01-01T00:00:00Z'))).toBeNull()
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run src/lib/beissindex/verlauf.test.ts`
Expected: FAIL — `Cannot find module './verlauf'`

- [ ] **Step 3: Verlauf implementieren**

`src/lib/beissindex/verlauf.ts`:

```ts
import { berechneIndex } from './berechne'
import type { Bedingungen, Fisch, Gewichte, IndexErgebnis } from './typen'

export interface StundenWert {
  zeit: Date
  ergebnis: IndexErgebnis
}

export interface TagesWert {
  tag: Date
  besteStunde: Date | null
  wert: number | null
  unsicher: boolean
}

function tagesSchluessel(zeit: Date): string {
  return zeit.toISOString().slice(0, 10)
}

export function berechneStunden(
  bedingungen: Bedingungen[],
  fisch: Fisch,
  gewichte?: Gewichte,
): StundenWert[] {
  return bedingungen.map((b) => ({
    zeit: b.zeit,
    ergebnis: berechneIndex(b, fisch, gewichte),
  }))
}

/**
 * Der Tageswert ist die BESTE Stunde des Tages, nicht der Durchschnitt
 * (Spec §5.4) — sonst wäre der Aal immer mittelmäßig, obwohl nachts alles
 * passiert.
 */
export function fasseZuTagenZusammen(stunden: StundenWert[]): TagesWert[] {
  const gruppen = new Map<string, StundenWert[]>()

  for (const s of stunden) {
    const key = tagesSchluessel(s.zeit)
    const vorhanden = gruppen.get(key)
    if (vorhanden) vorhanden.push(s)
    else gruppen.set(key, [s])
  }

  const tage: TagesWert[] = []

  for (const [key, gruppe] of [...gruppen.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const gueltige = gruppe.filter((s) => s.ergebnis.wert !== null)

    if (gueltige.length === 0) {
      tage.push({
        tag: new Date(`${key}T00:00:00Z`),
        besteStunde: null,
        wert: null,
        unsicher: true,
      })
      continue
    }

    let beste = gueltige[0]
    for (const s of gueltige) {
      if ((s.ergebnis.wert ?? 0) > (beste.ergebnis.wert ?? 0)) beste = s
    }

    tage.push({
      tag: new Date(`${key}T00:00:00Z`),
      besteStunde: beste.zeit,
      wert: beste.ergebnis.wert,
      unsicher: false,
    })
  }

  return tage
}

/**
 * Zusammenhängende Spanne um die beste Stunde: alle direkt angrenzenden
 * Stunden, die mindestens 85 % des Tagesbestwerts erreichen. Daraus wird
 * der Satz „am besten heute Abend zwischen 18 und 21 Uhr".
 */
export function besteZeitspanne(
  stunden: StundenWert[],
  tag: Date,
): { von: Date; bis: Date } | null {
  const key = tagesSchluessel(tag)
  const desTages = stunden
    .filter((s) => tagesSchluessel(s.zeit) === key && s.ergebnis.wert !== null)
    .sort((a, b) => a.zeit.getTime() - b.zeit.getTime())

  if (desTages.length === 0) return null

  let besterIndex = 0
  for (let i = 1; i < desTages.length; i++) {
    if ((desTages[i].ergebnis.wert ?? 0) > (desTages[besterIndex].ergebnis.wert ?? 0)) {
      besterIndex = i
    }
  }

  const schwelle = (desTages[besterIndex].ergebnis.wert ?? 0) * 0.85

  let von = besterIndex
  while (von > 0 && (desTages[von - 1].ergebnis.wert ?? 0) >= schwelle) von--

  let bis = besterIndex
  while (bis < desTages.length - 1 && (desTages[bis + 1].ergebnis.wert ?? 0) >= schwelle) bis++

  return {
    von: desTages[von].zeit,
    bis: new Date(desTages[bis].zeit.getTime() + 3_600_000),
  }
}
```

- [ ] **Step 4: Test laufen lassen**

Run: `pnpm vitest run src/lib/beissindex/verlauf.test.ts`
Expected: PASS, alle Tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/beissindex/verlauf.ts src/lib/beissindex/verlauf.test.ts
git commit -m "feat: add hourly series and best-hour daily aggregation"
```

---

### Task 9: Abnahmefälle aus der Spec

**Files:**
- Create: `src/lib/beissindex/abnahme.test.ts`
- Create: `src/lib/beissindex/index.ts` (Sammel-Export)
- Delete: `src/lib/beissindex/smoke.test.ts`

**Interfaces:**
- Consumes: alles aus dem Modul
- Produces: `src/lib/beissindex/index.ts` als einzige öffentliche Schnittstelle des Rechenkerns für Plan B und C

Dies sind die Fälle aus Spec §10 — die eigentliche fachliche Abnahme.

- [ ] **Step 1: Sammel-Export schreiben**

`src/lib/beissindex/index.ts`:

```ts
export * from './typen'
export { STANDARD_GEWICHTE } from './gewichte'
export { berechneIndex, DATEN_MAX_ALTER_MINUTEN } from './berechne'
export { berechneStunden, fasseZuTagenZusammen, besteZeitspanne } from './verlauf'
export type { StundenWert, TagesWert } from './verlauf'
export { solunarStaerke, solunarFenster } from './solunar'
export type { SolunarFenster } from './solunar'
export { tagesphase } from './faktoren'
export type { Tagesphase } from './faktoren'
```

- [ ] **Step 2: Abnahmetests schreiben**

`src/lib/beissindex/abnahme.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { berechneIndex, STANDARD_GEWICHTE, type Bedingungen } from './index'

function bedingungen(ueberschreibung: Partial<Bedingungen> = {}): Bedingungen {
  return {
    zeit: new Date('2026-08-21T12:00:00Z'),
    luftdruckHpa: 1013,
    luftdruckTrend24hHpa: 0,
    pegelNiveauRelativ: 0,
    pegelAenderung24hCm: 0,
    wassertemperaturC: 14,
    bewoelkungProzent: 50,
    windKmh: 10,
    sonnenaufgang: new Date('2026-08-21T04:30:00Z'),
    sonnenuntergang: new Date('2026-08-21T18:45:00Z'),
    solunarStaerke: 0.2,
    datenAlterMinuten: 5,
    ...ueberschreibung,
  }
}

describe('Abnahme: Spec §10', () => {
  it('Hochwasser, stark getrübt, Zander, 13 Uhr — trotz Tageslicht besser als bei klarem Wasser', () => {
    const hochwasserTrueb = bedingungen({
      zeit: new Date('2026-08-21T13:00:00Z'),
      pegelNiveauRelativ: 0.9,
      pegelAenderung24hCm: 20,
      bewoelkungProzent: 90,
    })
    const klaresNiedrigwasser = bedingungen({
      zeit: new Date('2026-08-21T13:00:00Z'),
      pegelNiveauRelativ: -0.7,
      pegelAenderung24hCm: -10,
      bewoelkungProzent: 90,
    })

    const trueb = berechneIndex(hochwasserTrueb, 'zander')
    const klar = berechneIndex(klaresNiedrigwasser, 'zander')

    expect(trueb.regeln.map((r) => r.name)).toContain('truebungsRegel')
    expect(trueb.wert!).toBeGreaterThan(klar.wert!)
  })

  it('Pegel fällt 60 cm am Tag — schlechter als ruhiger Pegel, für jede Art', () => {
    for (const fisch of ['hecht', 'zander', 'aal', 'karpfen'] as const) {
      const ruhig = berechneIndex(bedingungen({ pegelAenderung24hCm: 0 }), fisch)
      const sturz = berechneIndex(bedingungen({ pegelAenderung24hCm: -60 }), fisch)
      expect(sturz.wert!, fisch).toBeLessThan(ruhig.wert!)
      expect(sturz.regeln.map((r) => r.name), fisch).toContain('aenderungsBremse')
    }
  })

  it('Aal, 3 Uhr nachts, warm, hohes ruhiges Wasser — Spitzenwert', () => {
    const ideal = bedingungen({
      zeit: new Date('2026-08-21T01:00:00Z'),
      wassertemperaturC: 19,
      pegelNiveauRelativ: 0.8,
      pegelAenderung24hCm: 5,
      luftdruckTrend24hHpa: -3,
      solunarStaerke: 1,
      bewoelkungProzent: 90,
    })
    expect(berechneIndex(ideal, 'aal').wert!).toBeGreaterThan(7.5)
  })

  it('Karpfen, 3 Uhr nachts — schlecht', () => {
    const nachts = bedingungen({
      zeit: new Date('2026-08-21T01:00:00Z'),
      wassertemperaturC: 8,
      luftdruckTrend24hHpa: -6,
    })
    expect(berechneIndex(nachts, 'karpfen').wert!).toBeLessThan(4)
  })

  it('Daten 8 Stunden alt — kein Wert, sondern unsicher', () => {
    const alt = bedingungen({ datenAlterMinuten: 8 * 60 })
    const ergebnis = berechneIndex(alt, 'hecht')
    expect(ergebnis.wert).toBeNull()
    expect(ergebnis.unsicher).toBe(true)
  })

  it('Mondgewicht auf 0 — Mondphase ändert nichts mehr', () => {
    const ohneMond = { ...STANDARD_GEWICHTE.zander, solunar: 0 }
    const werte = [0, 0.25, 0.5, 0.75, 1].map(
      (s) => berechneIndex(bedingungen({ solunarStaerke: s }), 'zander', ohneMond).wert,
    )
    expect(new Set(werte).size).toBe(1)
  })

  it('Karpfen im Sommer bei Sonne schlägt Karpfen im Winter bei Sturm', () => {
    const sommer = bedingungen({
      zeit: new Date('2026-08-21T08:00:00Z'),
      wassertemperaturC: 21,
      luftdruckHpa: 1022,
      luftdruckTrend24hHpa: 0,
      bewoelkungProzent: 10,
      windKmh: 4,
    })
    const winter = bedingungen({
      zeit: new Date('2026-08-21T08:00:00Z'),
      wassertemperaturC: 4,
      luftdruckHpa: 995,
      luftdruckTrend24hHpa: -8,
      bewoelkungProzent: 100,
      windKmh: 45,
    })
    expect(berechneIndex(sommer, 'karpfen').wert!).toBeGreaterThan(
      berechneIndex(winter, 'karpfen').wert!,
    )
  })

  it('Jeder Beitrag trägt einen Klartext für die Detailansicht', () => {
    const { beitraege } = berechneIndex(bedingungen(), 'hecht')
    for (const b of beitraege) {
      expect(b.text.trim().length, b.key).toBeGreaterThan(0)
      expect(b.label.trim().length, b.key).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 3: Rauchtest entfernen**

```bash
rm src/lib/beissindex/smoke.test.ts
```

- [ ] **Step 4: Gesamte Testreihe laufen lassen**

Run: `pnpm test`
Expected: PASS, alle Dateien grün

Falls ein Abnahmetest fehlschlägt, ist **nicht** der Test anzupassen, sondern die Gewichtung oder eine Faktorkurve — die Abnahmefälle sind die fachliche Vorgabe aus der Spec. Ausnahme: Ein Test widerspricht nachweislich der Spec; dann Rückfrage statt stiller Änderung.

- [ ] **Step 5: Typprüfung und Build**

Run: `pnpm exec tsc --noEmit && pnpm build`
Expected: keine Fehler

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: add spec acceptance cases for beissindex"
```

---

## Definition of Done für Plan A

- [ ] `pnpm test` grün, alle Dateien
- [ ] `pnpm exec tsc --noEmit` ohne Fehler
- [ ] `src/lib/beissindex/index.ts` exportiert `berechneIndex`, `berechneStunden`, `fasseZuTagenZusammen`, `besteZeitspanne`, `solunarStaerke`, `STANDARD_GEWICHTE` und alle Typen
- [ ] Kein Import aus `next/*`, `@prisma/client` oder `node:fs` im gesamten Ordner `src/lib/beissindex/`
- [ ] Alle sechs Abnahmefälle aus Spec §10 sind als Test vorhanden und grün
