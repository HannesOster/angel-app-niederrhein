# Plan B — Daten und Anmeldung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Echte Pegel- und Wetterdaten in der Datenbank, daraus für alle zwölf Gewässer stündliche Beißindex-Werte über sieben Tage — plus Anmeldung mit einem Konto und die Zugangslogik (Vereine, Tageskarten).

**Architecture:** Zwei schmale Client-Module holen Fremddaten und geben getypte Ergebnisse zurück; sie kennen die Datenbank nicht. Ein Ingest-Modul schreibt sie idempotent weg. Ein Zusammenbau-Modul übersetzt Datenbankzeilen in `Bedingungen` für den Rechenkern aus Plan A. Der Rechenkern bleibt unverändert und ohne Netz.

**Tech Stack:** Prisma, PostgreSQL, Auth.js v5 (next-auth), argon2, zod, Vitest

**Spec:** `docs/superpowers/specs/2026-08-21-angelapp-design.md`

**Voraussetzung:** Plan A ist abgeschlossen, `src/lib/beissindex/index.ts` exportiert `berechneIndex` und `berechneStunden`.

## Global Constraints

- Fremdschnittstellen werden in Tests **niemals** echt aufgerufen. Es gilt: aufgezeichnete Antworten (Fixtures) statt Live-Requests.
- Abgeleitete Wasserstände tragen im Datenmodell **immer** ein Kennzeichen `abgeleitet: true` samt `quellePegel` — die Oberfläche muss sie beschriften können (Spec §4.4).
- Kein Klartext-Passwort in Code, Test, Fixture oder Repository. Nur `.env` (gitignored) und Hash in der Datenbank.
- Alle Zeitstempel in der Datenbank in **UTC**. Umrechnung erst in der Oberfläche.
- Schwellen aus Plan A werden **nicht** dupliziert — sie werden aus `@/lib/beissindex` importiert.
- Commits: englisch, kleingeschrieben, `feat:` / `fix:` / `test:` / `chore:`. **Kein** `Co-Authored-By`.

---

### Task 1: Datenbankschema

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`
- Modify: `.env.example`
- Test: `src/lib/db.test.ts`

**Interfaces:**
- Consumes: nichts
- Produces: Prisma-Client mit den Modellen `User`, `Gewaesser`, `Verein`, `GewaesserVerein`, `Mitgliedschaft`, `Tageskarte`, `PegelMessung`, `WetterStunde`, `GewichtsProfil`, `Fang`; Singleton-Export `prisma` aus `@/lib/db`

- [ ] **Step 1: Prisma installieren**

```bash
pnpm add -D prisma
pnpm add @prisma/client
pnpm exec prisma init --datasource-provider postgresql
```

- [ ] **Step 2: Schema schreiben**

`prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum GewaesserTyp {
  RHEIN
  ALTRHEIN
  BAGGERSEE
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwortHash String
  erstelltAm   DateTime @default(now())

  mitgliedschaften Mitgliedschaft[]
  tageskarten      Tageskarte[]
  gewichtsProfile  GewichtsProfil[]
  faenge           Fang[]
}

model Gewaesser {
  id   String       @id @default(cuid())
  slug String       @unique
  name String
  typ  GewaesserTyp
  lat  Float
  lon  Float

  /// Pegelstation, an der dieses Gewässer hängt: "REES" oder "EMMERICH"
  referenzPegel String
  /// Nur für ALTRHEIN und BAGGERSEE: Verzögerung gegenüber dem Rhein
  verzoegerungTage Int   @default(0)
  /// Nur für ALTRHEIN und BAGGERSEE: Anteil der Rheinbewegung, 0–1
  daempfung        Float @default(1)
  /// true bei ALTRHEIN und BAGGERSEE — Wasserstand ist geschätzt, nicht gemessen
  abgeleitet       Boolean @default(false)

  vereine     GewaesserVerein[]
  tageskarten Tageskarte[]
  wetter      WetterStunde[]
  faenge      Fang[]
}

model Verein {
  id   String @id @default(cuid())
  slug String @unique
  name String

  gewaesser        GewaesserVerein[]
  mitgliedschaften Mitgliedschaft[]
}

model GewaesserVerein {
  gewaesserId String
  vereinId    String

  gewaesser Gewaesser @relation(fields: [gewaesserId], references: [id], onDelete: Cascade)
  verein    Verein    @relation(fields: [vereinId], references: [id], onDelete: Cascade)

  @@id([gewaesserId, vereinId])
}

model Mitgliedschaft {
  userId   String
  vereinId String

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  verein Verein @relation(fields: [vereinId], references: [id], onDelete: Cascade)

  @@id([userId, vereinId])
}

model Tageskarte {
  id          String   @id @default(cuid())
  userId      String
  gewaesserId String
  von         DateTime
  bis         DateTime

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  gewaesser Gewaesser @relation(fields: [gewaesserId], references: [id], onDelete: Cascade)

  @@index([userId, bis])
}

model PegelMessung {
  id                String   @id @default(cuid())
  station           String
  zeit              DateTime
  wasserstandCm     Int
  wassertemperaturC Float?

  @@unique([station, zeit])
  @@index([station, zeit])
}

model WetterStunde {
  id              String   @id @default(cuid())
  gewaesserId     String
  zeit            DateTime
  luftdruckHpa    Float
  bewoelkung      Float
  windKmh         Float
  lufttemperaturC Float
  niederschlagMm  Float
  sonnenaufgang   DateTime
  sonnenuntergang DateTime
  abgerufenAm     DateTime @default(now())

  gewaesser Gewaesser @relation(fields: [gewaesserId], references: [id], onDelete: Cascade)

  @@unique([gewaesserId, zeit])
  @@index([gewaesserId, zeit])
}

model GewichtsProfil {
  id       String @id @default(cuid())
  userId   String
  fisch    String
  gewichte Json

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, fisch])
}

model Fang {
  id          String   @id @default(cuid())
  userId      String
  gewaesserId String
  zeit        DateTime
  fischart    String
  laengeCm    Int?
  koeder      String?
  notiz       String?
  /// Vollständige Kopie der Bedingungen und Beiträge zum Zeitpunkt des Fangs.
  /// BEWUSST eine Kopie, kein Verweis — spätere Gewichtsänderungen dürfen die
  /// Vergangenheit nicht umschreiben (Spec §8).
  schnappschuss Json

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  gewaesser Gewaesser @relation(fields: [gewaesserId], references: [id], onDelete: Cascade)

  @@index([userId, zeit])
}
```

- [ ] **Step 3: Prisma-Singleton schreiben**

`src/lib/db.ts`:

```ts
import { PrismaClient } from '@prisma/client'

const global_ = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = global_.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') global_.prisma = prisma
```

- [ ] **Step 4: `.env.example` anlegen**

```bash
cat > .env.example <<'EOF'
DATABASE_URL="postgresql://angel:angel@localhost:5432/angel?schema=public"
AUTH_SECRET="hier-ein-langes-zufaelliges-geheimnis"
SEED_USER_EMAIL="daniels-adresse@example.invalid"
SEED_USER_PASSWORT="nur-lokal-niemals-committen"
EOF
```

`.env` selbst wird **nicht** angelegt und **nicht** committet — sie steht bereits in `.gitignore`.

- [ ] **Step 5: Datenbank starten und migrieren**

```bash
docker run -d --name angel-postgres -e POSTGRES_USER=angel -e POSTGRES_PASSWORD=angel -e POSTGRES_DB=angel -p 5432:5432 postgres:16
cp .env.example .env   # danach DATABASE_URL und AUTH_SECRET lokal setzen
pnpm exec prisma migrate dev --name init
```

- [ ] **Step 6: Schema-Test schreiben**

`src/lib/db.test.ts`:

```ts
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
```

- [ ] **Step 7: Test laufen lassen**

Run: `pnpm vitest run src/lib/db.test.ts`
Expected: PASS, 4 Tests

- [ ] **Step 8: Commit**

```bash
git add prisma src/lib/db.ts src/lib/db.test.ts .env.example
git commit -m "feat: add prisma schema for waters, readings and catches"
```

---

### Task 2: PEGELONLINE-Client

**Files:**
- Create: `src/lib/quellen/pegelonline.ts`
- Create: `src/lib/quellen/__fixtures__/pegelonline-rees.json`
- Test: `src/lib/quellen/pegelonline.test.ts`

**Interfaces:**
- Consumes: nichts
- Produces:
  - `interface PegelMesswert { zeit: Date; wasserstandCm: number }`
  - `holePegel(station: string, tage?: number, fetchImpl?: typeof fetch): Promise<PegelMesswert[]>`
  - `parsePegelAntwort(rohdaten: unknown): PegelMesswert[]`
  - `PEGEL_STATIONEN = { REES: 'REES', EMMERICH: 'EMMERICH' } as const`

**Vor dem Schreiben zu prüfen:** Die genaue Pfadform der PEGELONLINE-REST-API. Erwartet wird
`https://pegelonline.wsv.de/webservices/rest-api/v2/stations/{station}/W/measurements.json?start=P7D`.
**Erst mit `curl` gegen die echte API verifizieren**, dann die Antwort als Fixture speichern. Weicht das Format ab, richtet sich der Parser nach der echten Antwort, nicht nach dieser Annahme.

- [ ] **Step 1: Echte Antwort aufzeichnen**

```bash
mkdir -p src/lib/quellen/__fixtures__
curl -s "https://pegelonline.wsv.de/webservices/rest-api/v2/stations/REES/W/measurements.json?start=P3D" \
  -o src/lib/quellen/__fixtures__/pegelonline-rees.json
head -c 400 src/lib/quellen/__fixtures__/pegelonline-rees.json
```

Erwartet: JSON-Array mit Objekten, die `timestamp` und `value` enthalten. Falls nicht: Struktur notieren und Parser daran ausrichten.

- [ ] **Step 2: Test schreiben**

`src/lib/quellen/pegelonline.test.ts`:

```ts
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
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run src/lib/quellen/pegelonline.test.ts`
Expected: FAIL — `Cannot find module './pegelonline'`

- [ ] **Step 4: Client implementieren**

`src/lib/quellen/pegelonline.ts`:

```ts
export const PEGEL_STATIONEN = { REES: 'REES', EMMERICH: 'EMMERICH' } as const
export type PegelStation = (typeof PEGEL_STATIONEN)[keyof typeof PEGEL_STATIONEN]

export interface PegelMesswert {
  zeit: Date
  wasserstandCm: number
}

const BASIS = 'https://pegelonline.wsv.de/webservices/rest-api/v2/stations'

export function parsePegelAntwort(rohdaten: unknown): PegelMesswert[] {
  if (!Array.isArray(rohdaten)) {
    throw new Error('PEGELONLINE: unerwartetes Antwortformat, Array erwartet')
  }

  const werte: PegelMesswert[] = []

  for (const eintrag of rohdaten) {
    if (typeof eintrag !== 'object' || eintrag === null) continue
    const { timestamp, value } = eintrag as { timestamp?: unknown; value?: unknown }
    if (typeof timestamp !== 'string' || typeof value !== 'number') continue

    const zeit = new Date(timestamp)
    if (Number.isNaN(zeit.getTime())) continue

    werte.push({ zeit, wasserstandCm: Math.round(value) })
  }

  return werte.sort((a, b) => a.zeit.getTime() - b.zeit.getTime())
}

export async function holePegel(
  station: string,
  tage = 7,
  fetchImpl: typeof fetch = fetch,
): Promise<PegelMesswert[]> {
  const url = `${BASIS}/${encodeURIComponent(station)}/W/measurements.json?start=P${tage}D`
  const antwort = await fetchImpl(url)

  if (!antwort.ok) {
    throw new Error(`PEGELONLINE ${station}: HTTP ${antwort.status}`)
  }

  return parsePegelAntwort(await antwort.json())
}
```

- [ ] **Step 5: Test laufen lassen**

Run: `pnpm vitest run src/lib/quellen/pegelonline.test.ts`
Expected: PASS, 8 Tests

- [ ] **Step 6: Commit**

```bash
git add src/lib/quellen/pegelonline.ts src/lib/quellen/pegelonline.test.ts src/lib/quellen/__fixtures__
git commit -m "feat: add pegelonline client with recorded fixture"
```

---

### Task 3: Open-Meteo-Client

**Files:**
- Create: `src/lib/quellen/openmeteo.ts`
- Create: `src/lib/quellen/__fixtures__/openmeteo-kalkar.json`
- Test: `src/lib/quellen/openmeteo.test.ts`

**Interfaces:**
- Consumes: nichts
- Produces:
  - `interface WetterStundeRoh { zeit: Date; luftdruckHpa: number; bewoelkung: number; windKmh: number; lufttemperaturC: number; niederschlagMm: number; sonnenaufgang: Date; sonnenuntergang: Date }`
  - `holeWetter(lat: number, lon: number, fetchImpl?: typeof fetch): Promise<WetterStundeRoh[]>`
  - `parseWetterAntwort(rohdaten: unknown): WetterStundeRoh[]`

- [ ] **Step 1: Echte Antwort aufzeichnen**

```bash
curl -s "https://api.open-meteo.com/v1/forecast?latitude=51.7386&longitude=6.2911&hourly=pressure_msl,cloud_cover,wind_speed_10m,temperature_2m,precipitation&daily=sunrise,sunset&timezone=UTC&forecast_days=7&past_days=2" \
  -o src/lib/quellen/__fixtures__/openmeteo-kalkar.json
head -c 400 src/lib/quellen/__fixtures__/openmeteo-kalkar.json
```

- [ ] **Step 2: Test schreiben**

`src/lib/quellen/openmeteo.test.ts`:

```ts
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
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run src/lib/quellen/openmeteo.test.ts`
Expected: FAIL — `Cannot find module './openmeteo'`

- [ ] **Step 4: Client implementieren**

`src/lib/quellen/openmeteo.ts`:

```ts
export interface WetterStundeRoh {
  zeit: Date
  luftdruckHpa: number
  bewoelkung: number
  windKmh: number
  lufttemperaturC: number
  niederschlagMm: number
  sonnenaufgang: Date
  sonnenuntergang: Date
}

interface OpenMeteoAntwort {
  hourly?: {
    time?: string[]
    pressure_msl?: number[]
    cloud_cover?: number[]
    wind_speed_10m?: number[]
    temperature_2m?: number[]
    precipitation?: number[]
  }
  daily?: {
    time?: string[]
    sunrise?: string[]
    sunset?: string[]
  }
}

const BASIS = 'https://api.open-meteo.com/v1/forecast'

export function parseWetterAntwort(rohdaten: unknown): WetterStundeRoh[] {
  const antwort = rohdaten as OpenMeteoAntwort
  const h = antwort?.hourly
  const d = antwort?.daily

  if (!h?.time || !h.pressure_msl || !h.cloud_cover || !h.wind_speed_10m ||
      !h.temperature_2m || !h.precipitation) {
    throw new Error('Open-Meteo: unvollständiger hourly-Block')
  }
  if (!d?.time || !d.sunrise || !d.sunset) {
    throw new Error('Open-Meteo: unvollständiger daily-Block')
  }

  const sonne = new Map<string, { auf: Date; unter: Date }>()
  for (let i = 0; i < d.time.length; i++) {
    sonne.set(d.time[i], {
      auf: new Date(`${d.sunrise[i]}Z`),
      unter: new Date(`${d.sunset[i]}Z`),
    })
  }

  const stunden: WetterStundeRoh[] = []

  for (let i = 0; i < h.time.length; i++) {
    const zeit = new Date(`${h.time[i]}Z`)
    if (Number.isNaN(zeit.getTime())) continue

    const tagesSonne = sonne.get(h.time[i].slice(0, 10))
    if (!tagesSonne) continue

    stunden.push({
      zeit,
      luftdruckHpa: h.pressure_msl[i],
      bewoelkung: h.cloud_cover[i],
      windKmh: h.wind_speed_10m[i],
      lufttemperaturC: h.temperature_2m[i],
      niederschlagMm: h.precipitation[i],
      sonnenaufgang: tagesSonne.auf,
      sonnenuntergang: tagesSonne.unter,
    })
  }

  return stunden.sort((a, b) => a.zeit.getTime() - b.zeit.getTime())
}

export async function holeWetter(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch = fetch,
): Promise<WetterStundeRoh[]> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: 'pressure_msl,cloud_cover,wind_speed_10m,temperature_2m,precipitation',
    daily: 'sunrise,sunset',
    timezone: 'UTC',
    forecast_days: '7',
    past_days: '2',
  })

  const antwort = await fetchImpl(`${BASIS}?${params}`)
  if (!antwort.ok) {
    throw new Error(`Open-Meteo (${lat},${lon}): HTTP ${antwort.status}`)
  }

  return parseWetterAntwort(await antwort.json())
}
```

**Hinweis zum Zeitformat:** Open-Meteo liefert bei `timezone=UTC` Zeitstempel ohne Zonensuffix (`2026-08-21T14:00`). Deshalb hängt der Parser ein `Z` an, bevor er `new Date(...)` aufruft. Weicht das Fixture davon ab — etwa weil die API doch ein Suffix mitliefert — ist die Umwandlung entsprechend anzupassen, statt blind `Z` anzuhängen.

- [ ] **Step 5: Test laufen lassen**

Run: `pnpm vitest run src/lib/quellen/openmeteo.test.ts`
Expected: PASS, 7 Tests

- [ ] **Step 6: Commit**

```bash
git add src/lib/quellen/openmeteo.ts src/lib/quellen/openmeteo.test.ts src/lib/quellen/__fixtures__/openmeteo-kalkar.json
git commit -m "feat: add open-meteo client with recorded fixture"
```

---

### Task 4: Pegel-Ableitung für Seen und Altrheine

**Files:**
- Create: `src/lib/pegel/ableitung.ts`
- Test: `src/lib/pegel/ableitung.test.ts`

**Interfaces:**
- Consumes: `PegelMesswert` aus `@/lib/quellen/pegelonline`
- Produces:
  - `interface PegelLage { wasserstandCm: number | null; niveauRelativ: number | null; aenderung24hCm: number | null; abgeleitet: boolean; quelle: string }`
  - `statistik(messwerte: PegelMesswert[]): { mittel: number; spanne: number }`
  - `pegelLageFuerRhein(messwerte: PegelMesswert[], zeitpunkt: Date, station: string): PegelLage`
  - `pegelLageAbgeleitet(messwerte: PegelMesswert[], zeitpunkt: Date, station: string, verzoegerungTage: number, daempfung: number): PegelLage`

- [ ] **Step 1: Test schreiben**

`src/lib/pegel/ableitung.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { statistik, pegelLageFuerRhein, pegelLageAbgeleitet } from './ableitung'
import type { PegelMesswert } from '@/lib/quellen/pegelonline'

/** 10 Tage stündliche Messwerte, die linear von 300 auf 540 cm steigen */
function steigend(): PegelMesswert[] {
  const start = new Date('2026-08-12T00:00:00Z').getTime()
  const werte: PegelMesswert[] = []
  for (let h = 0; h < 240; h++) {
    werte.push({
      zeit: new Date(start + h * 3_600_000),
      wasserstandCm: 300 + h,
    })
  }
  return werte
}

const JETZT = new Date('2026-08-21T00:00:00Z')

describe('statistik', () => {
  it('berechnet Mittel und Spanne', () => {
    const { mittel, spanne } = statistik(steigend())
    expect(mittel).toBeCloseTo(419.5, 0)
    expect(spanne).toBe(239)
  })

  it('kommt mit einem einzigen Messwert klar', () => {
    const { spanne } = statistik([{ zeit: JETZT, wasserstandCm: 400 }])
    expect(spanne).toBeGreaterThan(0)
  })
})

describe('pegelLageFuerRhein', () => {
  it('liefert den Wert zum Zeitpunkt', () => {
    const lage = pegelLageFuerRhein(steigend(), JETZT, 'REES')
    expect(lage.wasserstandCm).toBeGreaterThan(500)
    expect(lage.abgeleitet).toBe(false)
  })

  it('erkennt steigendes Wasser', () => {
    const lage = pegelLageFuerRhein(steigend(), JETZT, 'REES')
    expect(lage.aenderung24hCm).toBeCloseTo(24, 0)
  })

  it('normiert das Niveau auf -1 bis 1', () => {
    const lage = pegelLageFuerRhein(steigend(), JETZT, 'REES')
    expect(lage.niveauRelativ!).toBeGreaterThanOrEqual(-1)
    expect(lage.niveauRelativ!).toBeLessThanOrEqual(1)
  })

  it('meldet null bei leerer Messreihe', () => {
    const lage = pegelLageFuerRhein([], JETZT, 'REES')
    expect(lage.wasserstandCm).toBeNull()
    expect(lage.niveauRelativ).toBeNull()
    expect(lage.aenderung24hCm).toBeNull()
  })

  it('meldet null, wenn der letzte Wert zu weit zurückliegt', () => {
    const alt = steigend().filter((m) => m.zeit < new Date('2026-08-15T00:00:00Z'))
    expect(pegelLageFuerRhein(alt, JETZT, 'REES').wasserstandCm).toBeNull()
  })
})

describe('pegelLageAbgeleitet', () => {
  it('markiert den Wert als abgeleitet und nennt die Quelle', () => {
    const lage = pegelLageAbgeleitet(steigend(), JETZT, 'REES', 3, 0.2)
    expect(lage.abgeleitet).toBe(true)
    expect(lage.quelle).toContain('REES')
  })

  it('greift auf den Rheinstand von vor N Tagen zurück', () => {
    const ohne = pegelLageAbgeleitet(steigend(), JETZT, 'REES', 0, 1)
    const mit = pegelLageAbgeleitet(steigend(), JETZT, 'REES', 3, 1)
    // Der Pegel steigt, also muss der verzögerte Wert niedriger sein.
    expect(mit.wasserstandCm!).toBeLessThan(ohne.wasserstandCm!)
  })

  it('dämpft die Bewegung', () => {
    const ungedaempft = pegelLageAbgeleitet(steigend(), JETZT, 'REES', 0, 1)
    const gedaempft = pegelLageAbgeleitet(steigend(), JETZT, 'REES', 0, 0.2)
    expect(Math.abs(gedaempft.aenderung24hCm!)).toBeLessThan(
      Math.abs(ungedaempft.aenderung24hCm!),
    )
    expect(gedaempft.aenderung24hCm!).toBeCloseTo(ungedaempft.aenderung24hCm! * 0.2, 5)
  })

  it('dämpft auch das Niveau', () => {
    const ungedaempft = pegelLageAbgeleitet(steigend(), JETZT, 'REES', 0, 1)
    const gedaempft = pegelLageAbgeleitet(steigend(), JETZT, 'REES', 0, 0.2)
    expect(Math.abs(gedaempft.niveauRelativ!)).toBeLessThan(
      Math.abs(ungedaempft.niveauRelativ!),
    )
  })

  it('meldet null, wenn für den verzögerten Zeitpunkt nichts vorliegt', () => {
    const lage = pegelLageAbgeleitet(steigend(), JETZT, 'REES', 30, 0.2)
    expect(lage.wasserstandCm).toBeNull()
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run src/lib/pegel/ableitung.test.ts`
Expected: FAIL — `Cannot find module './ableitung'`

- [ ] **Step 3: Ableitung implementieren**

`src/lib/pegel/ableitung.ts`:

```ts
import type { PegelMesswert } from '@/lib/quellen/pegelonline'

export interface PegelLage {
  wasserstandCm: number | null
  /** -1 sehr niedrig, 0 mittel, +1 sehr hoch */
  niveauRelativ: number | null
  aenderung24hCm: number | null
  /** true = geschätzt aus dem Rheinpegel, nicht gemessen (Spec §4.4) */
  abgeleitet: boolean
  quelle: string
}

const STUNDE = 3_600_000
/** Ein Messwert gilt für höchstens so lange als gültig */
const MAX_ABSTAND_MS = 6 * STUNDE

export function statistik(messwerte: PegelMesswert[]): { mittel: number; spanne: number } {
  if (messwerte.length === 0) return { mittel: 0, spanne: 1 }

  const werte = messwerte.map((m) => m.wasserstandCm)
  const mittel = werte.reduce((a, b) => a + b, 0) / werte.length
  const spanne = Math.max(1, Math.max(...werte) - Math.min(...werte))

  return { mittel, spanne }
}

function wertBei(messwerte: PegelMesswert[], zeitpunkt: Date): number | null {
  let bester: PegelMesswert | null = null
  let besterAbstand = Infinity

  for (const m of messwerte) {
    const abstand = Math.abs(m.zeit.getTime() - zeitpunkt.getTime())
    if (abstand < besterAbstand) {
      besterAbstand = abstand
      bester = m
    }
  }

  if (!bester || besterAbstand > MAX_ABSTAND_MS) return null
  return bester.wasserstandCm
}

function lage(
  messwerte: PegelMesswert[],
  zeitpunkt: Date,
  daempfung: number,
): { wasserstandCm: number | null; niveauRelativ: number | null; aenderung24hCm: number | null } {
  const jetzt = wertBei(messwerte, zeitpunkt)
  if (jetzt === null) {
    return { wasserstandCm: null, niveauRelativ: null, aenderung24hCm: null }
  }

  const vor24h = wertBei(messwerte, new Date(zeitpunkt.getTime() - 24 * STUNDE))
  const { mittel, spanne } = statistik(messwerte)

  const niveauRoh = ((jetzt - mittel) / (spanne / 2)) * daempfung
  const niveauRelativ = Math.min(1, Math.max(-1, niveauRoh))
  const aenderung24hCm = vor24h === null ? null : (jetzt - vor24h) * daempfung

  return { wasserstandCm: jetzt, niveauRelativ, aenderung24hCm }
}

export function pegelLageFuerRhein(
  messwerte: PegelMesswert[],
  zeitpunkt: Date,
  station: string,
): PegelLage {
  return {
    ...lage(messwerte, zeitpunkt, 1),
    abgeleitet: false,
    quelle: `Pegel ${station}`,
  }
}

/**
 * Wasserstand eines Sees oder Altrheins: der Rheinstand von vor
 * `verzoegerungTage` Tagen, gedämpft um `daempfung` (Spec §4.4).
 * Immer als abgeleitet gekennzeichnet.
 */
export function pegelLageAbgeleitet(
  messwerte: PegelMesswert[],
  zeitpunkt: Date,
  station: string,
  verzoegerungTage: number,
  daempfung: number,
): PegelLage {
  const verschoben = new Date(zeitpunkt.getTime() - verzoegerungTage * 24 * STUNDE)

  return {
    ...lage(messwerte, verschoben, daempfung),
    abgeleitet: true,
    quelle: `geschätzt, abgeleitet von Pegel ${station}`,
  }
}
```

- [ ] **Step 4: Test laufen lassen**

Run: `pnpm vitest run src/lib/pegel/ableitung.test.ts`
Expected: PASS, alle Tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/pegel src/lib/pegel/ableitung.test.ts
git commit -m "feat: derive lake water levels from rhine gauge with lag and damping"
```

---

### Task 4b: Pegel in die Zukunft fortschreiben

**Files:**
- Modify: `src/lib/pegel/ableitung.ts`
- Test: `src/lib/pegel/fortschreibung.test.ts`

**Interfaces:**
- Consumes: `PegelMesswert`
- Produces:
  - `fortschreiben(messwerte: PegelMesswert[], zeitpunkt: Date): { wasserstandCm: number; geschaetzt: boolean } | null`
  - `PegelLage` bekommt ein zusätzliches Feld `vorhergesagt: boolean`

**Warum diese Aufgabe existiert:** Wetterdaten reichen sieben Tage in die Zukunft, Pegelmessungen enden bei „jetzt". Ohne Fortschreibung fielen für morgen und übermorgen **alle** Pegel-Faktoren als fehlend aus — und damit genau die Drei-Tage-Vorschau, um die es in dieser App geht. Die Spec (§12, Punkt 3) sieht dafür vor: Trend fortschreiben und **als Schätzung beschriften**.

Das Verfahren: linearer Trend der letzten 48 Stunden, mit zunehmendem Abstand gedämpft, damit die Vorhersage nicht ins Absurde läuft. Für einen Baggersee mit Tagen Verzögerung ist das ohnehin genau genug — dessen heutiger Stand hängt am Rhein von vor drei Tagen, also an gemessenen Werten.

- [ ] **Step 1: Test schreiben**

`src/lib/pegel/fortschreibung.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { fortschreiben, pegelLageFuerRhein } from './ableitung'
import type { PegelMesswert } from '@/lib/quellen/pegelonline'

const ENDE = new Date('2026-08-21T00:00:00Z')

/** 5 Tage stündliche Werte, die mit 1 cm/h steigen und bei ENDE aufhören */
function steigendBis(): PegelMesswert[] {
  const werte: PegelMesswert[] = []
  for (let h = 120; h > 0; h--) {
    werte.push({
      zeit: new Date(ENDE.getTime() - h * 3_600_000),
      wasserstandCm: 400 - h,
    })
  }
  return werte
}

describe('fortschreiben', () => {
  it('liefert null ohne Messwerte', () => {
    expect(fortschreiben([], ENDE)).toBeNull()
  })

  it('liefert für die Vergangenheit nichts — dafür gibt es echte Messwerte', () => {
    const vorher = new Date(ENDE.getTime() - 5 * 3_600_000)
    expect(fortschreiben(steigendBis(), vorher)).toBeNull()
  })

  it('schreibt einen steigenden Trend nach oben fort', () => {
    const morgen = new Date(ENDE.getTime() + 24 * 3_600_000)
    const geschaetzt = fortschreiben(steigendBis(), morgen)
    expect(geschaetzt).not.toBeNull()
    expect(geschaetzt!.wasserstandCm).toBeGreaterThan(280)
    expect(geschaetzt!.geschaetzt).toBe(true)
  })

  it('dämpft mit wachsendem Abstand — der zweite Tag rückt weniger weit als der erste', () => {
    const basis = steigendBis()
    const start = basis[basis.length - 1].wasserstandCm
    const tag1 = fortschreiben(basis, new Date(ENDE.getTime() + 24 * 3_600_000))!
    const tag2 = fortschreiben(basis, new Date(ENDE.getTime() + 48 * 3_600_000))!

    const sprung1 = tag1.wasserstandCm - start
    const sprung2 = tag2.wasserstandCm - tag1.wasserstandCm
    expect(Math.abs(sprung2)).toBeLessThan(Math.abs(sprung1))
  })

  it('läuft nach vielen Tagen nicht ins Absurde', () => {
    const inZehnTagen = new Date(ENDE.getTime() + 10 * 24 * 3_600_000)
    const geschaetzt = fortschreiben(steigendBis(), inZehnTagen)!
    expect(geschaetzt.wasserstandCm).toBeLessThan(600)
    expect(geschaetzt.wasserstandCm).toBeGreaterThan(200)
  })
})

describe('pegelLageFuerRhein mit Zukunft', () => {
  it('markiert zukünftige Werte als vorhergesagt', () => {
    const morgen = new Date(ENDE.getTime() + 24 * 3_600_000)
    const lage = pegelLageFuerRhein(steigendBis(), morgen, 'REES')
    expect(lage.wasserstandCm).not.toBeNull()
    expect(lage.vorhergesagt).toBe(true)
  })

  it('markiert gegenwärtige Werte nicht als vorhergesagt', () => {
    const lage = pegelLageFuerRhein(steigendBis(), ENDE, 'REES')
    expect(lage.vorhergesagt).toBe(false)
  })

  it('liefert für die Zukunft auch eine Änderungsrate', () => {
    const morgen = new Date(ENDE.getTime() + 24 * 3_600_000)
    expect(pegelLageFuerRhein(steigendBis(), morgen, 'REES').aenderung24hCm).not.toBeNull()
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run src/lib/pegel/fortschreibung.test.ts`
Expected: FAIL — `fortschreiben` existiert nicht, `vorhergesagt` fehlt im Typ

- [ ] **Step 3: Fortschreibung ergänzen**

In `src/lib/pegel/ableitung.ts` das Feld ergänzen und die Funktionen erweitern:

```ts
export interface PegelLage {
  wasserstandCm: number | null
  niveauRelativ: number | null
  aenderung24hCm: number | null
  abgeleitet: boolean
  /** true = in die Zukunft fortgeschrieben, keine Messung (Spec §12.3) */
  vorhergesagt: boolean
  quelle: string
}

/** Trendfenster für die Fortschreibung */
const TREND_FENSTER_MS = 48 * STUNDE
/** Ab hier verliert die Fortschreibung ihre Kraft */
const DAEMPFUNG_HALBWERT_MS = 36 * STUNDE

/**
 * Schreibt den Pegel über den letzten Messwert hinaus fort: linearer Trend
 * der letzten 48 h, mit wachsendem Abstand exponentiell gedämpft. Ergibt für
 * die Vorschau brauchbare Werte, ohne nach einer Woche Unsinn zu behaupten.
 * Immer als Schätzung gekennzeichnet.
 */
export function fortschreiben(
  messwerte: PegelMesswert[],
  zeitpunkt: Date,
): { wasserstandCm: number; geschaetzt: boolean } | null {
  if (messwerte.length === 0) return null

  const sortiert = [...messwerte].sort((a, b) => a.zeit.getTime() - b.zeit.getTime())
  const letzter = sortiert[sortiert.length - 1]

  const abstandMs = zeitpunkt.getTime() - letzter.zeit.getTime()
  if (abstandMs <= 0) return null

  const fensterStart = letzter.zeit.getTime() - TREND_FENSTER_MS
  const imFenster = sortiert.filter((m) => m.zeit.getTime() >= fensterStart)
  const erster = imFenster[0]

  const spanneMs = letzter.zeit.getTime() - erster.zeit.getTime()
  const steigungProMs =
    spanneMs <= 0 ? 0 : (letzter.wasserstandCm - erster.wasserstandCm) / spanneMs

  // Gedämpfte Fortschreibung: die wirksame Zeit läuft gegen einen Grenzwert.
  const wirksameMs = DAEMPFUNG_HALBWERT_MS * (1 - Math.exp(-abstandMs / DAEMPFUNG_HALBWERT_MS))

  return {
    wasserstandCm: Math.round(letzter.wasserstandCm + steigungProMs * wirksameMs),
    geschaetzt: true,
  }
}
```

Anschließend `wertBei` so erweitern, dass es bei Zeitpunkten nach dem letzten Messwert auf `fortschreiben` zurückfällt, und die Rückgabe um das Kennzeichen ergänzen:

```ts
function wertBei(
  messwerte: PegelMesswert[],
  zeitpunkt: Date,
): { cm: number; vorhergesagt: boolean } | null {
  let bester: PegelMesswert | null = null
  let besterAbstand = Infinity

  for (const m of messwerte) {
    const abstand = Math.abs(m.zeit.getTime() - zeitpunkt.getTime())
    if (abstand < besterAbstand) {
      besterAbstand = abstand
      bester = m
    }
  }

  if (bester && besterAbstand <= MAX_ABSTAND_MS) {
    return { cm: bester.wasserstandCm, vorhergesagt: false }
  }

  const geschaetzt = fortschreiben(messwerte, zeitpunkt)
  if (geschaetzt) return { cm: geschaetzt.wasserstandCm, vorhergesagt: true }

  return null
}
```

Die Funktion `lage` entsprechend anpassen: sie liest jetzt `.cm` statt der nackten Zahl und reicht `vorhergesagt` durch. `pegelLageFuerRhein` und `pegelLageAbgeleitet` ergänzen das Feld in ihrem Rückgabeobjekt; bei einer Vorhersage wird die Quelle um „ (Trend fortgeschrieben)" ergänzt.

- [ ] **Step 4: Bestehende Tests mitziehen**

Die Tests aus Task 4 prüfen `pegelLageFuerRhein([], ...)` und den Fall „letzter Wert liegt zu weit zurück". Letzterer schlägt jetzt fehl, weil fortgeschrieben wird — **das ist richtig so**. Der Test ist anzupassen: statt `wasserstandCm === null` erwartet er nun `vorhergesagt === true`. Der Fall „leere Messreihe → null" bleibt unverändert.

- [ ] **Step 5: Tests laufen lassen**

Run: `pnpm vitest run src/lib/pegel/`
Expected: PASS, alle Tests aus Task 4 und 4b

- [ ] **Step 6: Commit**

```bash
git add src/lib/pegel
git commit -m "feat: extrapolate gauge trend into the forecast window"
```

---

### Task 5: Bedingungen zusammenbauen

**Files:**
- Create: `src/lib/bedingungen/bauen.ts`
- Test: `src/lib/bedingungen/bauen.test.ts`

**Interfaces:**
- Consumes: `Bedingungen` aus `@/lib/beissindex`; `PegelLage` aus `@/lib/pegel/ableitung`; `WetterStundeRoh` aus `@/lib/quellen/openmeteo`; `solunarStaerke` aus `@/lib/beissindex`
- Produces:
  - `interface GewaesserStamm { lat: number; lon: number; typ: 'RHEIN' | 'ALTRHEIN' | 'BAGGERSEE'; referenzPegel: string; verzoegerungTage: number; daempfung: number }`
  - `baueBedingungen(stamm, wetter: WetterStundeRoh[], pegel: PegelMesswert[], jetzt: Date): Bedingungen[]`
  - `luftdruckTrend(wetter: WetterStundeRoh[], index: number): number`

**Fachliche Regel (Spec §4.5):** Bei `RHEIN` wird die gemessene Wassertemperatur verwendet, falls vorhanden. Bei `ALTRHEIN` und `BAGGERSEE` gibt es **keine** Wassertemperatur — dort wird der Mittelwert der Lufttemperatur der letzten 72 Stunden eingesetzt, und der Rechenkern erhält diesen Wert. Er wird in der Oberfläche als abgeleitet beschriftet.

- [ ] **Step 1: Test schreiben**

`src/lib/bedingungen/bauen.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { baueBedingungen, luftdruckTrend, type GewaesserStamm } from './bauen'
import type { WetterStundeRoh } from '@/lib/quellen/openmeteo'
import type { PegelMesswert } from '@/lib/quellen/pegelonline'

const START = new Date('2026-08-19T00:00:00Z').getTime()

function wetterreihe(stunden = 216): WetterStundeRoh[] {
  const liste: WetterStundeRoh[] = []
  for (let h = 0; h < stunden; h++) {
    const zeit = new Date(START + h * 3_600_000)
    const tag = zeit.toISOString().slice(0, 10)
    liste.push({
      zeit,
      luftdruckHpa: 1013 - h * 0.05,
      bewoelkung: 50,
      windKmh: 12,
      lufttemperaturC: 18,
      niederschlagMm: 0,
      sonnenaufgang: new Date(`${tag}T04:30:00Z`),
      sonnenuntergang: new Date(`${tag}T18:45:00Z`),
    })
  }
  return liste
}

function pegelreihe(): PegelMesswert[] {
  const liste: PegelMesswert[] = []
  for (let h = 0; h < 216; h++) {
    liste.push({ zeit: new Date(START + h * 3_600_000), wasserstandCm: 400 + h * 0.5 })
  }
  return liste
}

const RHEIN: GewaesserStamm = {
  lat: 51.7386,
  lon: 6.2911,
  typ: 'RHEIN',
  referenzPegel: 'REES',
  verzoegerungTage: 0,
  daempfung: 1,
}

const SEE: GewaesserStamm = { ...RHEIN, typ: 'BAGGERSEE', verzoegerungTage: 3, daempfung: 0.2 }

const JETZT = new Date('2026-08-21T00:00:00Z')

describe('luftdruckTrend', () => {
  it('meldet fallenden Druck negativ', () => {
    const w = wetterreihe()
    expect(luftdruckTrend(w, 100)).toBeLessThan(0)
  })
  it('meldet 0, wenn keine 24 h Vorlauf da sind', () => {
    expect(luftdruckTrend(wetterreihe(), 3)).toBe(0)
  })
})

describe('baueBedingungen', () => {
  it('liefert eine Bedingung je Wetterstunde', () => {
    const b = baueBedingungen(RHEIN, wetterreihe(), pegelreihe(), JETZT)
    expect(b).toHaveLength(216)
  })

  it('übernimmt Wetterwerte unverändert', () => {
    const [erste] = baueBedingungen(RHEIN, wetterreihe(), pegelreihe(), JETZT)
    expect(erste.bewoelkungProzent).toBe(50)
    expect(erste.windKmh).toBe(12)
  })

  it('berechnet eine Solunar-Stärke zwischen 0 und 1', () => {
    for (const b of baueBedingungen(RHEIN, wetterreihe(), pegelreihe(), JETZT)) {
      expect(b.solunarStaerke).toBeGreaterThanOrEqual(0)
      expect(b.solunarStaerke).toBeLessThanOrEqual(1)
    }
  })

  it('dämpft die Pegelbewegung beim See gegenüber dem Rhein', () => {
    const rhein = baueBedingungen(RHEIN, wetterreihe(), pegelreihe(), JETZT)
    const see = baueBedingungen(SEE, wetterreihe(), pegelreihe(), JETZT)

    const rheinBewegung = Math.abs(rhein[100].pegelAenderung24hCm ?? 0)
    const seeBewegung = Math.abs(see[100].pegelAenderung24hCm ?? 0)
    expect(seeBewegung).toBeLessThan(rheinBewegung)
  })

  it('setzt beim See eine aus der Luft abgeleitete Wassertemperatur', () => {
    const see = baueBedingungen(SEE, wetterreihe(), pegelreihe(), JETZT)
    expect(see[100].wassertemperaturC).not.toBeNull()
    expect(see[100].wassertemperaturC!).toBeCloseTo(18, 0)
  })

  it('rechnet das Datenalter aus dem Abstand zu jetzt', () => {
    const b = baueBedingungen(RHEIN, wetterreihe(), pegelreihe(), JETZT)
    for (const eintrag of b) {
      expect(eintrag.datenAlterMinuten).toBeGreaterThanOrEqual(0)
    }
  })

  it('kommt ohne Pegeldaten klar', () => {
    const b = baueBedingungen(RHEIN, wetterreihe(), [], JETZT)
    expect(b[100].pegelNiveauRelativ).toBeNull()
    expect(b[100].pegelAenderung24hCm).toBeNull()
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run src/lib/bedingungen/bauen.test.ts`
Expected: FAIL — `Cannot find module './bauen'`

- [ ] **Step 3: Zusammenbau implementieren**

`src/lib/bedingungen/bauen.ts`:

```ts
import { solunarStaerke, type Bedingungen } from '@/lib/beissindex'
import type { WetterStundeRoh } from '@/lib/quellen/openmeteo'
import type { PegelMesswert } from '@/lib/quellen/pegelonline'
import { pegelLageAbgeleitet, pegelLageFuerRhein } from '@/lib/pegel/ableitung'

export interface GewaesserStamm {
  lat: number
  lon: number
  typ: 'RHEIN' | 'ALTRHEIN' | 'BAGGERSEE'
  referenzPegel: string
  verzoegerungTage: number
  daempfung: number
}

const STUNDE = 3_600_000

export function luftdruckTrend(wetter: WetterStundeRoh[], index: number): number {
  const vorher = index - 24
  if (vorher < 0) return 0
  return wetter[index].luftdruckHpa - wetter[vorher].luftdruckHpa
}

/**
 * Ersatz-Wassertemperatur für Seen und Altrheine: Mittel der Lufttemperatur
 * der letzten 72 h. Ausdrücklich eine Näherung (Spec §4.5) — die echte
 * Seetemperatur misst niemand.
 */
function wassertemperaturAusLuft(wetter: WetterStundeRoh[], index: number): number {
  const von = Math.max(0, index - 72)
  const fenster = wetter.slice(von, index + 1)
  const summe = fenster.reduce((a, s) => a + s.lufttemperaturC, 0)
  return summe / fenster.length
}

export function baueBedingungen(
  stamm: GewaesserStamm,
  wetter: WetterStundeRoh[],
  pegel: PegelMesswert[],
  jetzt: Date,
): Bedingungen[] {
  return wetter.map((stunde, i) => {
    const lage =
      stamm.typ === 'RHEIN'
        ? pegelLageFuerRhein(pegel, stunde.zeit, stamm.referenzPegel)
        : pegelLageAbgeleitet(
            pegel,
            stunde.zeit,
            stamm.referenzPegel,
            stamm.verzoegerungTage,
            stamm.daempfung,
          )

    const wassertemperaturC =
      stamm.typ === 'RHEIN' ? null : wassertemperaturAusLuft(wetter, i)

    const alterMs = Math.max(0, jetzt.getTime() - stunde.zeit.getTime())

    return {
      zeit: stunde.zeit,
      luftdruckHpa: stunde.luftdruckHpa,
      luftdruckTrend24hHpa: luftdruckTrend(wetter, i),
      pegelNiveauRelativ: lage.niveauRelativ,
      pegelAenderung24hCm: lage.aenderung24hCm,
      wassertemperaturC,
      bewoelkungProzent: stunde.bewoelkung,
      windKmh: stunde.windKmh,
      sonnenaufgang: stunde.sonnenaufgang,
      sonnenuntergang: stunde.sonnenuntergang,
      solunarStaerke: solunarStaerke(stunde.zeit, stamm.lat, stamm.lon),
      datenAlterMinuten: alterMs / 60_000,
    }
  })
}
```

**Hinweis:** Für `RHEIN` steht in diesem Stand `wassertemperaturC: null`, weil PEGELONLINE die Wassertemperatur nur an manchen Stationen führt. Sobald in Task 2 festgestellt wurde, dass Rees oder Emmerich sie liefert, wird sie hier durchgereicht — bis dahin ist `null` das ehrliche Ergebnis, und der Rechenkern behandelt sie als fehlenden Faktor.

- [ ] **Step 4: Test laufen lassen**

Run: `pnpm vitest run src/lib/bedingungen/bauen.test.ts`
Expected: PASS, alle Tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/bedingungen
git commit -m "feat: assemble hourly conditions from weather and gauge data"
```

---

### Task 6: Gewässer- und Vereins-Seed

**Files:**
- Create: `prisma/gewaesser.ts`
- Create: `prisma/seed.ts`
- Modify: `package.json` (prisma.seed-Eintrag)
- Test: `prisma/gewaesser.test.ts`

**Interfaces:**
- Consumes: nichts
- Produces: `GEWAESSER: GewaesserSeed[]`, `VEREINE: VereinSeed[]` aus `prisma/gewaesser.ts`

**Wichtig:** Die Koordinaten sind grobe Ortsmittelpunkte und die Verein-Zuordnung ist **von Hand kuratiert und unbestätigt** (Spec §6, §12). Sie sind Startwerte, die in den Einstellungen korrigierbar sein müssen — nicht als Wahrheit behandeln.

- [ ] **Step 1: Test schreiben**

`prisma/gewaesser.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { GEWAESSER, VEREINE } from './gewaesser'

describe('GEWAESSER', () => {
  it('enthält die zwölf Gewässer aus der Spec', () => {
    expect(GEWAESSER.length).toBe(12)
  })

  it('vergibt eindeutige Slugs', () => {
    expect(new Set(GEWAESSER.map((g) => g.slug)).size).toBe(GEWAESSER.length)
  })

  it('liegt mit allen Koordinaten am Niederrhein', () => {
    for (const g of GEWAESSER) {
      expect(g.lat, g.slug).toBeGreaterThan(51.5)
      expect(g.lat, g.slug).toBeLessThan(52.0)
      expect(g.lon, g.slug).toBeGreaterThan(5.9)
      expect(g.lon, g.slug).toBeLessThan(6.6)
    }
  })

  it('hängt jedes Gewässer an Rees oder Emmerich', () => {
    for (const g of GEWAESSER) {
      expect(['REES', 'EMMERICH']).toContain(g.referenzPegel)
    }
  })

  it('markiert genau die Nicht-Rhein-Gewässer als abgeleitet', () => {
    for (const g of GEWAESSER) {
      expect(g.abgeleitet, g.slug).toBe(g.typ !== 'RHEIN')
    }
  })

  it('gibt Rhein-Gewässern keine Verzögerung und keine Dämpfung', () => {
    for (const g of GEWAESSER.filter((x) => x.typ === 'RHEIN')) {
      expect(g.verzoegerungTage).toBe(0)
      expect(g.daempfung).toBe(1)
    }
  })

  it('gibt Baggerseen mehr Verzögerung als Altrheinen', () => {
    const altrhein = GEWAESSER.filter((g) => g.typ === 'ALTRHEIN')
    const seen = GEWAESSER.filter((g) => g.typ === 'BAGGERSEE')
    const maxAltrhein = Math.max(...altrhein.map((g) => g.verzoegerungTage))
    const minSee = Math.min(...seen.map((g) => g.verzoegerungTage))
    expect(minSee).toBeGreaterThan(maxAltrhein)
  })

  it('hält alle Dämpfungen zwischen 0 und 1', () => {
    for (const g of GEWAESSER) {
      expect(g.daempfung).toBeGreaterThan(0)
      expect(g.daempfung).toBeLessThanOrEqual(1)
    }
  })

  it('verweist nur auf existierende Vereins-Slugs', () => {
    const bekannt = new Set(VEREINE.map((v) => v.slug))
    for (const g of GEWAESSER) {
      for (const slug of g.vereine) {
        expect(bekannt, `${g.slug} → ${slug}`).toContain(slug)
      }
    }
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run prisma/gewaesser.test.ts`
Expected: FAIL — `Cannot find module './gewaesser'`

Hinweis: `vitest.config.ts` muss `prisma/**/*.test.ts` erfassen. Falls nicht: `include` auf `['src/**/*.test.ts', 'prisma/**/*.test.ts']` erweitern.

- [ ] **Step 3: Stammdaten schreiben**

`prisma/gewaesser.ts`:

```ts
export interface VereinSeed {
  slug: string
  name: string
}

export interface GewaesserSeed {
  slug: string
  name: string
  typ: 'RHEIN' | 'ALTRHEIN' | 'BAGGERSEE'
  lat: number
  lon: number
  referenzPegel: 'REES' | 'EMMERICH'
  verzoegerungTage: number
  daempfung: number
  abgeleitet: boolean
  /** UNBESTÄTIGT — von Hand kuratiert, in den Einstellungen korrigierbar (Spec §6) */
  vereine: string[]
}

export const VEREINE: VereinSeed[] = [
  { slug: 'asv-gut-bitt-wissel', name: 'ASV Gut Bitt Wissel e. V.' },
  { slug: 'asv-rees', name: 'ASV Rees' },
  { slug: 'tageskarte-frei', name: 'Nur mit Tageskarte' },
]

export const GEWAESSER: GewaesserSeed[] = [
  // ---- Rhein: echter Pegel, keine Ableitung ----
  {
    slug: 'rhein-grieth', name: 'Rhein bei Grieth', typ: 'RHEIN',
    lat: 51.7735, lon: 6.2905, referenzPegel: 'REES',
    verzoegerungTage: 0, daempfung: 1, abgeleitet: false,
    vereine: ['tageskarte-frei'],
  },
  {
    slug: 'rhein-rees', name: 'Rhein bei Rees', typ: 'RHEIN',
    lat: 51.7614, lon: 6.3969, referenzPegel: 'REES',
    verzoegerungTage: 0, daempfung: 1, abgeleitet: false,
    vereine: ['asv-rees', 'tageskarte-frei'],
  },
  {
    slug: 'rhein-griethausen', name: 'Rhein bei Griethausen', typ: 'RHEIN',
    lat: 51.8213, lon: 6.1522, referenzPegel: 'EMMERICH',
    verzoegerungTage: 0, daempfung: 1, abgeleitet: false,
    vereine: ['tageskarte-frei'],
  },

  // ---- Altrheine: schnelle, starke Kopplung ----
  {
    slug: 'reeser-altrhein', name: 'Reeser Altrhein', typ: 'ALTRHEIN',
    lat: 51.7549, lon: 6.3806, referenzPegel: 'REES',
    verzoegerungTage: 1, daempfung: 0.7, abgeleitet: true,
    vereine: ['asv-rees'],
  },
  {
    slug: 'grietherorter-altrhein', name: 'Grietherorter Altrhein', typ: 'ALTRHEIN',
    lat: 51.7887, lon: 6.3244, referenzPegel: 'REES',
    verzoegerungTage: 1, daempfung: 0.7, abgeleitet: true,
    vereine: ['asv-rees'],
  },
  {
    slug: 'bienener-altrhein', name: 'Bienener Altrhein', typ: 'ALTRHEIN',
    lat: 51.7817, lon: 6.4498, referenzPegel: 'REES',
    verzoegerungTage: 1, daempfung: 0.5, abgeleitet: true,
    vereine: ['asv-rees'],
  },
  {
    slug: 'griethausener-altrhein', name: 'Griethausener Altrhein', typ: 'ALTRHEIN',
    lat: 51.8156, lon: 6.1361, referenzPegel: 'EMMERICH',
    verzoegerungTage: 1, daempfung: 0.5, abgeleitet: true,
    vereine: ['asv-gut-bitt-wissel'],
  },

  // ---- Baggerseen: träge ----
  {
    slug: 'wisseler-see', name: 'Wisseler See', typ: 'BAGGERSEE',
    lat: 51.7639, lon: 6.2472, referenzPegel: 'REES',
    verzoegerungTage: 3, daempfung: 0.2, abgeleitet: true,
    vereine: ['asv-gut-bitt-wissel'],
  },
  {
    slug: 'reeser-meer', name: 'Reeser Meer', typ: 'BAGGERSEE',
    lat: 51.7458, lon: 6.4147, referenzPegel: 'REES',
    verzoegerungTage: 3, daempfung: 0.2, abgeleitet: true,
    vereine: ['asv-rees'],
  },
  {
    slug: 'mahnensee', name: 'Mahnensee', typ: 'BAGGERSEE',
    lat: 51.7392, lon: 6.4022, referenzPegel: 'REES',
    verzoegerungTage: 3, daempfung: 0.2, abgeleitet: true,
    vereine: ['asv-rees'],
  },
  {
    slug: 'grindsee', name: 'Grindsee', typ: 'BAGGERSEE',
    lat: 51.7521, lon: 6.4310, referenzPegel: 'REES',
    verzoegerungTage: 3, daempfung: 0.2, abgeleitet: true,
    vereine: ['asv-rees'],
  },
  {
    slug: 'roosenhofsee', name: 'Roosenhofsee', typ: 'BAGGERSEE',
    lat: 51.7686, lon: 6.4411, referenzPegel: 'REES',
    verzoegerungTage: 4, daempfung: 0.15, abgeleitet: true,
    vereine: ['asv-rees'],
  },
]
```

- [ ] **Step 4: Test laufen lassen**

Run: `pnpm vitest run prisma/gewaesser.test.ts`
Expected: PASS, 9 Tests

- [ ] **Step 5: Seed-Skript schreiben**

`prisma/seed.ts`:

```ts
import { PrismaClient } from '@prisma/client'
import { GEWAESSER, VEREINE } from './gewaesser'

const prisma = new PrismaClient()

async function main() {
  for (const v of VEREINE) {
    await prisma.verein.upsert({
      where: { slug: v.slug },
      update: { name: v.name },
      create: v,
    })
  }

  for (const g of GEWAESSER) {
    const { vereine, ...stamm } = g
    const gewaesser = await prisma.gewaesser.upsert({
      where: { slug: g.slug },
      update: stamm,
      create: stamm,
    })

    for (const vereinSlug of vereine) {
      const verein = await prisma.verein.findUniqueOrThrow({ where: { slug: vereinSlug } })
      await prisma.gewaesserVerein.upsert({
        where: { gewaesserId_vereinId: { gewaesserId: gewaesser.id, vereinId: verein.id } },
        update: {},
        create: { gewaesserId: gewaesser.id, vereinId: verein.id },
      })
    }
  }

  console.log(`${GEWAESSER.length} Gewässer und ${VEREINE.length} Vereine eingespielt.`)
}

main()
  .catch((fehler) => {
    console.error(fehler)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
```

In `package.json` ergänzen:

```json
"prisma": { "seed": "tsx prisma/seed.ts" }
```

Und `pnpm add -D tsx`.

- [ ] **Step 6: Seed ausführen und prüfen**

```bash
pnpm exec prisma db seed
pnpm exec prisma studio  # optional: Sichtprüfung, danach abbrechen
```

Expected: „12 Gewässer und 3 Vereine eingespielt."

- [ ] **Step 7: Commit**

```bash
git add prisma package.json
git commit -m "feat: seed twelve waters and clubs for the lower rhine"
```

---

### Task 7: Ingest — Fremddaten in die Datenbank

**Files:**
- Create: `src/lib/ingest/pegelIngest.ts`
- Create: `src/lib/ingest/wetterIngest.ts`
- Create: `src/app/api/ingest/route.ts`
- Test: `src/lib/ingest/pegelIngest.test.ts`

**Interfaces:**
- Consumes: `holePegel`, `holeWetter`, `prisma`
- Produces:
  - `speicherePegel(messwerte: PegelMesswert[], station: string, db: PegelSchreiber): Promise<number>`
  - `interface PegelSchreiber { upsert(daten): Promise<unknown> }` — schmale Schnittstelle, damit der Test ohne Datenbank läuft
  - `speichereWetter(gewaesserId: string, stunden: WetterStundeRoh[], db): Promise<number>`
  - Route `POST /api/ingest` — geschützt über `INGEST_TOKEN`

- [ ] **Step 1: Test schreiben**

`src/lib/ingest/pegelIngest.test.ts`:

```ts
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
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run src/lib/ingest/pegelIngest.test.ts`
Expected: FAIL — `Cannot find module './pegelIngest'`

- [ ] **Step 3: Ingest implementieren**

`src/lib/ingest/pegelIngest.ts`:

```ts
import type { PegelMesswert } from '@/lib/quellen/pegelonline'

export interface PegelSchreiber {
  upsert(daten: {
    where: { station_zeit: { station: string; zeit: Date } }
    update: { wasserstandCm: number }
    create: { station: string; zeit: Date; wasserstandCm: number }
  }): Promise<unknown>
}

/**
 * Schreibt Messwerte idempotent weg. Ein einzelner Fehlschlag darf den
 * gesamten Lauf nicht kippen — beim nächsten Durchlauf wird ohnehin
 * derselbe Zeitraum erneut geholt.
 */
export async function speicherePegel(
  messwerte: PegelMesswert[],
  station: string,
  db: PegelSchreiber,
): Promise<number> {
  let geschrieben = 0

  for (const m of messwerte) {
    try {
      await db.upsert({
        where: { station_zeit: { station, zeit: m.zeit } },
        update: { wasserstandCm: m.wasserstandCm },
        create: { station, zeit: m.zeit, wasserstandCm: m.wasserstandCm },
      })
      geschrieben++
    } catch (fehler) {
      console.error(`Pegel ${station} ${m.zeit.toISOString()}:`, fehler)
    }
  }

  return geschrieben
}
```

`src/lib/ingest/wetterIngest.ts`:

```ts
import type { WetterStundeRoh } from '@/lib/quellen/openmeteo'

export interface WetterSchreiber {
  upsert(daten: {
    where: { gewaesserId_zeit: { gewaesserId: string; zeit: Date } }
    update: Record<string, unknown>
    create: Record<string, unknown>
  }): Promise<unknown>
}

export async function speichereWetter(
  gewaesserId: string,
  stunden: WetterStundeRoh[],
  db: WetterSchreiber,
): Promise<number> {
  let geschrieben = 0

  for (const s of stunden) {
    const felder = {
      luftdruckHpa: s.luftdruckHpa,
      bewoelkung: s.bewoelkung,
      windKmh: s.windKmh,
      lufttemperaturC: s.lufttemperaturC,
      niederschlagMm: s.niederschlagMm,
      sonnenaufgang: s.sonnenaufgang,
      sonnenuntergang: s.sonnenuntergang,
      abgerufenAm: new Date(),
    }

    try {
      await db.upsert({
        where: { gewaesserId_zeit: { gewaesserId, zeit: s.zeit } },
        update: felder,
        create: { gewaesserId, zeit: s.zeit, ...felder },
      })
      geschrieben++
    } catch (fehler) {
      console.error(`Wetter ${gewaesserId} ${s.zeit.toISOString()}:`, fehler)
    }
  }

  return geschrieben
}
```

`src/app/api/ingest/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { holePegel, PEGEL_STATIONEN } from '@/lib/quellen/pegelonline'
import { holeWetter } from '@/lib/quellen/openmeteo'
import { speicherePegel } from '@/lib/ingest/pegelIngest'
import { speichereWetter } from '@/lib/ingest/wetterIngest'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const token = request.headers.get('x-ingest-token')
  if (!process.env.INGEST_TOKEN || token !== process.env.INGEST_TOKEN) {
    return NextResponse.json({ fehler: 'nicht erlaubt' }, { status: 401 })
  }

  const bericht: Record<string, number> = {}

  for (const station of Object.values(PEGEL_STATIONEN)) {
    try {
      const messwerte = await holePegel(station, 10)
      bericht[`pegel:${station}`] = await speicherePegel(
        messwerte,
        station,
        prisma.pegelMessung,
      )
    } catch (fehler) {
      console.error(`Pegel ${station}:`, fehler)
      bericht[`pegel:${station}`] = -1
    }
  }

  const gewaesser = await prisma.gewaesser.findMany()
  for (const g of gewaesser) {
    try {
      const stunden = await holeWetter(g.lat, g.lon)
      bericht[`wetter:${g.slug}`] = await speichereWetter(
        g.id,
        stunden,
        prisma.wetterStunde,
      )
    } catch (fehler) {
      console.error(`Wetter ${g.slug}:`, fehler)
      bericht[`wetter:${g.slug}`] = -1
    }
  }

  return NextResponse.json({ bericht })
}
```

`.env.example` um `INGEST_TOKEN="..."` ergänzen.

- [ ] **Step 4: Test laufen lassen**

Run: `pnpm vitest run src/lib/ingest/pegelIngest.test.ts`
Expected: PASS, 4 Tests

- [ ] **Step 5: Ingest einmal echt laufen lassen**

```bash
pnpm dev &
curl -s -X POST localhost:3000/api/ingest -H "x-ingest-token: $INGEST_TOKEN" | head -c 500
```

Expected: JSON-Bericht, in dem **keiner** der Werte `-1` ist. Ein `-1` bedeutet, dass die betreffende Quelle nicht erreichbar war oder das Format abweicht — dann Task 2 bzw. 3 nachbessern, nicht weitergehen.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ingest src/app/api/ingest .env.example
git commit -m "feat: add idempotent ingest for gauge and weather data"
```

---

### Task 8: Anmeldung

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `scripts/benutzer-anlegen.ts`
- Test: `src/lib/auth.test.ts`

**Interfaces:**
- Consumes: `prisma`, `argon2`
- Produces: `hashePasswort(klartext): Promise<string>`, `pruefePasswort(klartext, hash): Promise<boolean>`, `auth`, `signIn`, `signOut` aus `@/lib/auth`

- [ ] **Step 1: Abhängigkeiten installieren**

```bash
pnpm add next-auth@beta argon2 zod
```

- [ ] **Step 2: Test schreiben**

`src/lib/auth.test.ts`:

```ts
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
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run src/lib/auth.test.ts`
Expected: FAIL — `Cannot find module './passwort'`

- [ ] **Step 4: Passwortfunktionen implementieren**

`src/lib/passwort.ts`:

```ts
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
```

- [ ] **Step 5: Auth.js einrichten**

`src/lib/auth.ts`:

```ts
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
```

`src/app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from '@/lib/auth'

export const { GET, POST } = handlers
```

- [ ] **Step 6: Anlege-Skript schreiben**

`scripts/benutzer-anlegen.ts`:

```ts
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
```

Dieses Skript ist zugleich das „Passwort vergessen" aus Spec §2: `.env` ändern, Skript erneut laufen lassen.

- [ ] **Step 7: Tests und Anlegen ausführen**

```bash
pnpm vitest run src/lib/auth.test.ts
pnpm exec tsx scripts/benutzer-anlegen.ts
```

Expected: 5 Tests PASS, danach „Konto … angelegt".

- [ ] **Step 8: Commit**

```bash
git add src/lib/auth.ts src/lib/passwort.ts src/lib/auth.test.ts src/app/api/auth scripts
git commit -m "feat: add single-account credentials auth with argon2"
```

---

### Task 9: Übersichts-Abfrage mit Zugangsfilter

**Files:**
- Create: `src/lib/uebersicht/zugang.ts`
- Create: `src/lib/uebersicht/laden.ts`
- Test: `src/lib/uebersicht/zugang.test.ts`

**Interfaces:**
- Consumes: `prisma`, `baueBedingungen`, `berechneStunden`, `fasseZuTagenZusammen`, `besteZeitspanne`
- Produces:
  - `type ZugangStatus = { art: 'frei' } | { art: 'tageskarte'; bis: Date } | { art: 'keine' }`
  - `bestimmeZugang(gewaesserVereine: string[], mitgliedschaften: string[], tageskarten: {gewaesserId, bis}[], gewaesserId: string, jetzt: Date): ZugangStatus`
  - `ladeUebersicht(userId: string, fisch: Fisch, jetzt: Date): Promise<GewaesserUebersicht[]>`
  - `interface GewaesserUebersicht { id, slug, name, typ, lat, lon, abgeleitet, quelle, zugang, jetztWert, tage: TagesWert[], besteSpanne }`

- [ ] **Step 1: Test schreiben**

`src/lib/uebersicht/zugang.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { bestimmeZugang } from './zugang'

const JETZT = new Date('2026-08-21T12:00:00Z')

describe('bestimmeZugang', () => {
  it('meldet frei bei passender Mitgliedschaft', () => {
    const status = bestimmeZugang(['asv-rees'], ['asv-rees'], [], 'g1', JETZT)
    expect(status.art).toBe('frei')
  })

  it('meldet keine Erlaubnis ohne Mitgliedschaft und ohne Karte', () => {
    expect(bestimmeZugang(['asv-rees'], ['asv-gut-bitt-wissel'], [], 'g1', JETZT).art)
      .toBe('keine')
  })

  it('meldet Tageskarte, wenn eine gültige vorliegt', () => {
    const karten = [{ gewaesserId: 'g1', bis: new Date('2026-08-22T00:00:00Z') }]
    const status = bestimmeZugang([], [], karten, 'g1', JETZT)
    expect(status.art).toBe('tageskarte')
  })

  it('ignoriert abgelaufene Tageskarten', () => {
    const karten = [{ gewaesserId: 'g1', bis: new Date('2026-08-20T00:00:00Z') }]
    expect(bestimmeZugang([], [], karten, 'g1', JETZT).art).toBe('keine')
  })

  it('ignoriert Tageskarten für ein anderes Gewässer', () => {
    const karten = [{ gewaesserId: 'g2', bis: new Date('2026-08-25T00:00:00Z') }]
    expect(bestimmeZugang([], [], karten, 'g1', JETZT).art).toBe('keine')
  })

  it('bevorzugt die Mitgliedschaft, wenn beides vorliegt', () => {
    const karten = [{ gewaesserId: 'g1', bis: new Date('2026-08-25T00:00:00Z') }]
    expect(bestimmeZugang(['asv-rees'], ['asv-rees'], karten, 'g1', JETZT).art).toBe('frei')
  })

  it('nennt bei der Tageskarte das Ablaufdatum', () => {
    const bis = new Date('2026-08-22T00:00:00Z')
    const status = bestimmeZugang([], [], [{ gewaesserId: 'g1', bis }], 'g1', JETZT)
    expect(status.art === 'tageskarte' && status.bis).toEqual(bis)
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run src/lib/uebersicht/zugang.test.ts`
Expected: FAIL — `Cannot find module './zugang'`

- [ ] **Step 3: Zugangslogik implementieren**

`src/lib/uebersicht/zugang.ts`:

```ts
export type ZugangStatus =
  | { art: 'frei' }
  | { art: 'tageskarte'; bis: Date }
  | { art: 'keine' }

export function bestimmeZugang(
  gewaesserVereine: string[],
  mitgliedschaften: string[],
  tageskarten: { gewaesserId: string; bis: Date }[],
  gewaesserId: string,
  jetzt: Date,
): ZugangStatus {
  const mitglied = gewaesserVereine.some((v) => mitgliedschaften.includes(v))
  if (mitglied) return { art: 'frei' }

  const gueltige = tageskarten
    .filter((k) => k.gewaesserId === gewaesserId && k.bis.getTime() >= jetzt.getTime())
    .sort((a, b) => b.bis.getTime() - a.bis.getTime())

  if (gueltige.length > 0) return { art: 'tageskarte', bis: gueltige[0].bis }

  return { art: 'keine' }
}
```

- [ ] **Step 4: Übersicht laden implementieren**

`src/lib/uebersicht/laden.ts`:

```ts
import { prisma } from '@/lib/db'
import {
  berechneStunden,
  besteZeitspanne,
  fasseZuTagenZusammen,
  STANDARD_GEWICHTE,
  type Fisch,
  type Gewichte,
  type TagesWert,
} from '@/lib/beissindex'
import { baueBedingungen } from '@/lib/bedingungen/bauen'
import { bestimmeZugang, type ZugangStatus } from './zugang'

export interface GewaesserUebersicht {
  id: string
  slug: string
  name: string
  typ: 'RHEIN' | 'ALTRHEIN' | 'BAGGERSEE'
  lat: number
  lon: number
  abgeleitet: boolean
  quelle: string
  zugang: ZugangStatus
  jetztWert: number | null
  unsicher: boolean
  tage: TagesWert[]
  besteSpanne: { von: Date; bis: Date } | null
}

const TAG = 24 * 3_600_000

export async function ladeUebersicht(
  userId: string,
  fisch: Fisch,
  jetzt: Date,
): Promise<GewaesserUebersicht[]> {
  const [gewaesser, mitgliedschaften, tageskarten, profil] = await Promise.all([
    prisma.gewaesser.findMany({ include: { vereine: { include: { verein: true } } } }),
    prisma.mitgliedschaft.findMany({ where: { userId }, include: { verein: true } }),
    prisma.tageskarte.findMany({ where: { userId, bis: { gte: jetzt } } }),
    prisma.gewichtsProfil.findUnique({ where: { userId_fisch: { userId, fisch } } }),
  ])

  const eigeneVereine = mitgliedschaften.map((m) => m.verein.slug)
  const gewichte = (profil?.gewichte as Gewichte | undefined) ?? STANDARD_GEWICHTE[fisch]

  const von = new Date(jetzt.getTime() - 2 * TAG)
  const bis = new Date(jetzt.getTime() + 7 * TAG)

  const uebersicht: GewaesserUebersicht[] = []

  for (const g of gewaesser) {
    const [wetterZeilen, pegelZeilen] = await Promise.all([
      prisma.wetterStunde.findMany({
        where: { gewaesserId: g.id, zeit: { gte: von, lte: bis } },
        orderBy: { zeit: 'asc' },
      }),
      prisma.pegelMessung.findMany({
        where: { station: g.referenzPegel, zeit: { gte: new Date(jetzt.getTime() - 14 * TAG) } },
        orderBy: { zeit: 'asc' },
      }),
    ])

    const bedingungen = baueBedingungen(
      {
        lat: g.lat,
        lon: g.lon,
        typ: g.typ,
        referenzPegel: g.referenzPegel,
        verzoegerungTage: g.verzoegerungTage,
        daempfung: g.daempfung,
      },
      wetterZeilen.map((w) => ({
        zeit: w.zeit,
        luftdruckHpa: w.luftdruckHpa,
        bewoelkung: w.bewoelkung,
        windKmh: w.windKmh,
        lufttemperaturC: w.lufttemperaturC,
        niederschlagMm: w.niederschlagMm,
        sonnenaufgang: w.sonnenaufgang,
        sonnenuntergang: w.sonnenuntergang,
      })),
      pegelZeilen.map((p) => ({ zeit: p.zeit, wasserstandCm: p.wasserstandCm })),
      jetzt,
    )

    const stunden = berechneStunden(bedingungen, fisch, gewichte)
    const tage = fasseZuTagenZusammen(stunden).filter(
      (t) => t.tag.getTime() >= new Date(jetzt.toISOString().slice(0, 10)).getTime(),
    )

    const aktuell = stunden
      .filter((s) => Math.abs(s.zeit.getTime() - jetzt.getTime()) <= 3_600_000)
      .at(0)

    uebersicht.push({
      id: g.id,
      slug: g.slug,
      name: g.name,
      typ: g.typ,
      lat: g.lat,
      lon: g.lon,
      abgeleitet: g.abgeleitet,
      quelle: g.abgeleitet
        ? `geschätzt, abgeleitet von Pegel ${g.referenzPegel}`
        : `Pegel ${g.referenzPegel}`,
      zugang: bestimmeZugang(
        g.vereine.map((v) => v.verein.slug),
        eigeneVereine,
        tageskarten.map((k) => ({ gewaesserId: k.gewaesserId, bis: k.bis })),
        g.id,
        jetzt,
      ),
      jetztWert: aktuell?.ergebnis.wert ?? null,
      unsicher: aktuell?.ergebnis.unsicher ?? true,
      tage: tage.slice(0, 3),
      besteSpanne: besteZeitspanne(stunden, jetzt),
    })
  }

  return uebersicht.sort((a, b) => (b.jetztWert ?? -1) - (a.jetztWert ?? -1))
}
```

- [ ] **Step 5: Test laufen lassen**

Run: `pnpm vitest run src/lib/uebersicht/zugang.test.ts`
Expected: PASS, 7 Tests

- [ ] **Step 6: Ende-zu-Ende von Hand prüfen**

Kleines Skript `scripts/uebersicht-pruefen.ts` schreiben, das `ladeUebersicht` für den Seed-Benutzer und `hecht` aufruft und das Ergebnis ausgibt:

```bash
pnpm exec tsx -e "
import { prisma } from './src/lib/db'
import { ladeUebersicht } from './src/lib/uebersicht/laden'
const user = await prisma.user.findFirstOrThrow()
const u = await ladeUebersicht(user.id, 'hecht', new Date())
console.table(u.map(g => ({ name: g.name, jetzt: g.jetztWert, zugang: g.zugang.art, abgeleitet: g.abgeleitet })))
process.exit(0)
"
```

Expected: 12 Zeilen, überwiegend gefüllte `jetzt`-Werte. Sind alle `null`, fehlen Wetterdaten — dann Task 7 erneut laufen lassen.

- [ ] **Step 7: Gesamte Testreihe und Build**

Run: `pnpm test && pnpm exec tsc --noEmit && pnpm build`
Expected: alles grün

- [ ] **Step 8: Commit**

```bash
git add src/lib/uebersicht scripts
git commit -m "feat: load water overview with access filter and index values"
```

---

## Definition of Done für Plan B

- [ ] `pnpm test` grün, `pnpm exec tsc --noEmit` ohne Fehler, `pnpm build` erfolgreich
- [ ] `POST /api/ingest` liefert einen Bericht ohne `-1`
- [ ] Die Datenbank enthält 12 Gewässer, 3 Vereine und ein Benutzerkonto
- [ ] `ladeUebersicht` liefert für alle 12 Gewässer Werte, Zugangsstatus und drei Tage
- [ ] Abgeleitete Gewässer tragen `abgeleitet: true` und eine Quellenangabe mit dem Wort „geschätzt"
- [ ] Kein Klartext-Passwort in Repository, Test oder Fixture
