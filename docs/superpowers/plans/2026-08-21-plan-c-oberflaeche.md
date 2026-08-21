# Plan C — Oberfläche Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die App, die Daniel benutzt — Karte mit Rangliste, Detailseite mit Begründung, Fangbuch, Einstellungen mit Reglern, offlinefähig, auf Coolify deployt.

**Architecture:** Next.js App Router. Datenbeschaffung in Server Components über `ladeUebersicht` aus Plan B; interaktive Teile (Karte, Regler, Formulare) als Client Components. Schreibvorgänge über Server Actions. Die Karte wird dynamisch ohne SSR geladen, weil Leaflet ein `window` braucht.

**Tech Stack:** Next.js 15, shadcn/ui mit eigenem tweakcn-Theme, Leaflet + react-leaflet, Recharts (Pegelkurve), next-pwa oder eigener Service Worker

**Spec:** `docs/superpowers/specs/2026-08-21-angelapp-design.md`

**Voraussetzung:** Plan A und Plan B sind abgeschlossen. `ladeUebersicht`, `bestimmeZugang`, `auth` stehen bereit.

## Global Constraints

- **Handy zuerst.** Jede Seite wird bei 390 px Breite entworfen und geprüft; Desktop ist der Nebenfall.
- **Eigenes tweakcn-Theme** in Wasser-, Kies- und Grüntönen — ausdrücklich **nicht** das shadcn-Standard-Neutral (Spec §7.4).
- **Abgeleitete Werte tragen immer ihre Beschriftung.** Jede Anzeige eines geschätzten Wasserstands zeigt sichtbar „geschätzt, abgeleitet von Pegel …". Ein abgeleiteter Wert darf nirgends wie eine Messung aussehen (Spec §4.4).
- **Unsichere Werte zeigen keine Zahl.** Bei `unsicher: true` erscheint „unsicher" plus Zeitstempel, niemals ein Zahlenwert (Spec §4.6).
- **Fortgeschriebene Pegel sind als solche kenntlich.** Werte in der Vorschau beruhen auf einem fortgeschriebenen Trend, nicht auf Messungen (Plan B, Task 4b). Wo ein solcher Wert die Anzeige trägt — Tagesbalken für morgen und übermorgen, Detailseite jenseits von heute — steht „Trend fortgeschrieben" dabei. Dieselbe Regel wie bei abgeleiteten Seepegeln: Eine Schätzung darf nie wie eine Messung aussehen.
- **Der Filter „nur wo ich darf" ist standardmäßig an** (Spec §6).
- Die Regler liegen **in den Einstellungen**, nicht auf der Detailseite (Spec §7.3).
- Farbskala durchgängig: ab 7,0 grün, ab 4,5 gelb, darunter rot. Grau für unsicher.
- Commits: englisch, kleingeschrieben, `feat:` / `fix:` / `test:` / `chore:`. **Kein** `Co-Authored-By`.

---

### Task 1: Theme und Grundlayout

**Files:**
- Create: `src/app/globals.css` (ersetzen)
- Create: `src/lib/ui/farben.ts`
- Modify: `src/app/layout.tsx`
- Test: `src/lib/ui/farben.test.ts`

**Interfaces:**
- Consumes: nichts
- Produces: `indexFarbe(wert: number | null): 'gruen' | 'gelb' | 'rot' | 'grau'`, `INDEX_HEX: Record<..., string>`, CSS-Variablen des Themes

- [ ] **Step 1: shadcn/ui einrichten**

```bash
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button card badge slider switch input label tabs sheet dialog select
```

- [ ] **Step 2: Test für die Farbskala schreiben**

`src/lib/ui/farben.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { indexFarbe, INDEX_HEX } from './farben'

describe('indexFarbe', () => {
  it('gibt grau für unsichere Werte', () => {
    expect(indexFarbe(null)).toBe('grau')
  })
  it('gibt grün ab 7,0', () => {
    expect(indexFarbe(7)).toBe('gruen')
    expect(indexFarbe(9.9)).toBe('gruen')
  })
  it('gibt gelb ab 4,5 bis unter 7,0', () => {
    expect(indexFarbe(4.5)).toBe('gelb')
    expect(indexFarbe(6.9)).toBe('gelb')
  })
  it('gibt rot unter 4,5', () => {
    expect(indexFarbe(4.4)).toBe('rot')
    expect(indexFarbe(0)).toBe('rot')
  })
  it('hält für jede Stufe einen Hex-Wert bereit', () => {
    for (const stufe of ['gruen', 'gelb', 'rot', 'grau'] as const) {
      expect(INDEX_HEX[stufe]).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run src/lib/ui/farben.test.ts`
Expected: FAIL — `Cannot find module './farben'`

- [ ] **Step 4: Farbskala implementieren**

`src/lib/ui/farben.ts`:

```ts
export type IndexStufe = 'gruen' | 'gelb' | 'rot' | 'grau'

export const INDEX_HEX: Record<IndexStufe, string> = {
  gruen: '#3ddc84',
  gelb: '#f5c542',
  rot: '#f2564b',
  grau: '#6c6c7a',
}

export function indexFarbe(wert: number | null): IndexStufe {
  if (wert === null) return 'grau'
  if (wert >= 7) return 'gruen'
  if (wert >= 4.5) return 'gelb'
  return 'rot'
}
```

- [ ] **Step 5: Eigenes tweakcn-Theme setzen**

`src/app/globals.css` — die von shadcn erzeugten Farbvariablen **ersetzen** (nicht ergänzen) durch eine Palette aus Wasser, Kies und Schilfgrün:

```css
@import "tailwindcss";
@import "tw-animate-css";

:root {
  --background: oklch(0.98 0.008 220);
  --foreground: oklch(0.22 0.02 235);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.22 0.02 235);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.22 0.02 235);
  --primary: oklch(0.48 0.09 225);          /* Rheinwasser */
  --primary-foreground: oklch(0.99 0.005 220);
  --secondary: oklch(0.93 0.015 95);        /* Kies */
  --secondary-foreground: oklch(0.28 0.02 95);
  --muted: oklch(0.94 0.01 220);
  --muted-foreground: oklch(0.5 0.02 230);
  --accent: oklch(0.62 0.12 150);           /* Schilfgrün */
  --accent-foreground: oklch(0.15 0.02 150);
  --destructive: oklch(0.58 0.19 27);
  --border: oklch(0.89 0.012 220);
  --input: oklch(0.89 0.012 220);
  --ring: oklch(0.48 0.09 225);
  --radius: 0.7rem;
}

.dark {
  --background: oklch(0.17 0.015 235);
  --foreground: oklch(0.95 0.008 220);
  --card: oklch(0.21 0.018 235);
  --card-foreground: oklch(0.95 0.008 220);
  --popover: oklch(0.21 0.018 235);
  --popover-foreground: oklch(0.95 0.008 220);
  --primary: oklch(0.68 0.11 225);
  --primary-foreground: oklch(0.15 0.02 235);
  --secondary: oklch(0.28 0.015 95);
  --secondary-foreground: oklch(0.93 0.01 95);
  --muted: oklch(0.26 0.015 235);
  --muted-foreground: oklch(0.68 0.015 230);
  --accent: oklch(0.62 0.12 150);
  --accent-foreground: oklch(0.12 0.02 150);
  --destructive: oklch(0.62 0.18 27);
  --border: oklch(0.3 0.015 235);
  --input: oklch(0.3 0.015 235);
  --ring: oklch(0.68 0.11 225);
}
```

- [ ] **Step 6: Layout auf Handy auslegen**

`src/app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Angel-App Niederrhein',
  description: 'Pegel, Wetter und Beißindex für die Gewässer um Kalkar, Rees und Kleve',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1f3b52',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="bg-background text-foreground antialiased">
        <div className="mx-auto min-h-dvh w-full max-w-md">{children}</div>
      </body>
    </html>
  )
}
```

- [ ] **Step 7: Test und Build**

Run: `pnpm vitest run src/lib/ui/farben.test.ts && pnpm build`
Expected: 5 Tests PASS, Build grün

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add bespoke tweakcn theme and index color scale"
```

---

### Task 2: Anmeldeseite

**Files:**
- Create: `src/app/anmelden/page.tsx`
- Create: `src/app/anmelden/aktionen.ts`
- Create: `src/middleware.ts`

**Interfaces:**
- Consumes: `signIn`, `auth` aus `@/lib/auth`
- Produces: geschützte App — alles außer `/anmelden` und `/api/*` verlangt eine Sitzung

- [ ] **Step 1: Server Action schreiben**

`src/app/anmelden/aktionen.ts`:

```ts
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
```

- [ ] **Step 2: Seite schreiben**

`src/app/anmelden/page.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { anmelden } from './aktionen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function AnmeldenSeite() {
  const [fehler, aktion, laeuft] = useActionState(anmelden, undefined)

  return (
    <main className="flex min-h-dvh flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-bold">Angel-App</h1>
        <p className="text-sm text-muted-foreground">Niederrhein</p>
      </div>

      <form action={aktion} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">E-Mail</Label>
          <Input id="email" name="email" type="email" autoComplete="username" required />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="passwort">Passwort</Label>
          <Input
            id="passwort"
            name="passwort"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        {fehler && <p className="text-sm text-destructive">{fehler}</p>}

        <Button type="submit" disabled={laeuft} className="mt-2">
          {laeuft ? 'Moment …' : 'Anmelden'}
        </Button>
      </form>
    </main>
  )
}
```

- [ ] **Step 3: Middleware schreiben**

`src/middleware.ts`:

```ts
export { auth as middleware } from '@/lib/auth'

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|manifest.json|icons).*)'],
}
```

- [ ] **Step 4: Von Hand prüfen**

```bash
pnpm dev
```

- `/` ohne Sitzung leitet nach `/anmelden` um
- Falsche Daten zeigen „E-Mail oder Passwort stimmt nicht."
- Richtige Daten führen auf `/`
- Nach Neuladen bleibt man angemeldet

- [ ] **Step 5: Commit**

```bash
git add src/app/anmelden src/middleware.ts
git commit -m "feat: add sign-in page and route protection"
```

---

### Task 3: Hauptbildschirm — Zielfisch-Umschalter und Rangliste

**Files:**
- Create: `src/app/page.tsx`
- Create: `src/components/ZielfischUmschalter.tsx`
- Create: `src/components/GewaesserZeile.tsx`
- Create: `src/components/TagesBalken.tsx`
- Test: `src/components/TagesBalken.test.ts`

**Interfaces:**
- Consumes: `ladeUebersicht`, `auth`, `indexFarbe`
- Produces: Startseite mit `?fisch=`- und `?alle=`-Parametern

- [ ] **Step 1: Test für die Balkenlogik schreiben**

`src/components/TagesBalken.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { wochentagKurz, balkenHoehe } from './tagesBalkenLogik'

describe('wochentagKurz', () => {
  it('kürzt deutsche Wochentage auf zwei Buchstaben', () => {
    expect(wochentagKurz(new Date('2026-08-21T00:00:00Z'))).toBe('Fr')
    expect(wochentagKurz(new Date('2026-08-22T00:00:00Z'))).toBe('Sa')
  })
})

describe('balkenHoehe', () => {
  it('gibt volle Höhe bei 10', () => {
    expect(balkenHoehe(10)).toBe(100)
  })
  it('gibt eine Mindesthöhe bei 0, damit der Balken sichtbar bleibt', () => {
    expect(balkenHoehe(0)).toBeGreaterThan(0)
  })
  it('gibt Mindesthöhe bei null', () => {
    expect(balkenHoehe(null)).toBeGreaterThan(0)
    expect(balkenHoehe(null)).toBeLessThan(20)
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run src/components/TagesBalken.test.ts`
Expected: FAIL — `Cannot find module './tagesBalkenLogik'`

- [ ] **Step 3: Balkenlogik implementieren**

`src/components/tagesBalkenLogik.ts`:

```ts
export function wochentagKurz(tag: Date): string {
  return new Intl.DateTimeFormat('de-DE', { weekday: 'short', timeZone: 'UTC' })
    .format(tag)
    .slice(0, 2)
}

/** Höhe in Prozent; null und 0 behalten einen sichtbaren Stummel */
export function balkenHoehe(wert: number | null): number {
  if (wert === null) return 12
  return Math.max(12, (wert / 10) * 100)
}
```

- [ ] **Step 4: Balken-Komponente schreiben**

`src/components/TagesBalken.tsx`:

```tsx
import { INDEX_HEX, indexFarbe } from '@/lib/ui/farben'
import { balkenHoehe, wochentagKurz } from './tagesBalkenLogik'

export function TagesBalken({ tag, wert }: { tag: Date; wert: number | null }) {
  return (
    <div className="flex w-6 flex-col items-center gap-1">
      <div className="flex h-8 w-full items-end">
        <div
          className="w-full rounded-sm"
          style={{
            height: `${balkenHoehe(wert)}%`,
            backgroundColor: INDEX_HEX[indexFarbe(wert)],
          }}
        />
      </div>
      <span className="text-[9px] text-muted-foreground">{wochentagKurz(tag)}</span>
    </div>
  )
}
```

- [ ] **Step 5: Zielfisch-Umschalter schreiben**

`src/components/ZielfischUmschalter.tsx`:

```tsx
'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

const FISCHE = [
  { key: 'hecht', name: 'Hecht' },
  { key: 'zander', name: 'Zander' },
  { key: 'aal', name: 'Aal' },
  { key: 'karpfen', name: 'Karpfen' },
] as const

export function ZielfischUmschalter({ aktiv }: { aktiv: string }) {
  const router = useRouter()
  const pfad = usePathname()
  const params = useSearchParams()

  function wechsle(fisch: string) {
    const neu = new URLSearchParams(params)
    neu.set('fisch', fisch)
    router.push(`${pfad}?${neu}`)
  }

  return (
    <div className="flex gap-1">
      {FISCHE.map((f) => (
        <button
          key={f.key}
          onClick={() => wechsle(f.key)}
          aria-pressed={aktiv === f.key}
          className={`flex-1 rounded-full py-1.5 text-xs transition ${
            aktiv === f.key
              ? 'bg-primary font-bold text-primary-foreground'
              : 'bg-secondary text-secondary-foreground'
          }`}
        >
          {f.name}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Gewässerzeile schreiben**

`src/components/GewaesserZeile.tsx`:

```tsx
import Link from 'next/link'
import { INDEX_HEX, indexFarbe } from '@/lib/ui/farben'
import { TagesBalken } from './TagesBalken'
import type { GewaesserUebersicht } from '@/lib/uebersicht/laden'

export function GewaesserZeile({ g, fisch }: { g: GewaesserUebersicht; fisch: string }) {
  const gesperrt = g.zugang.art === 'keine'

  return (
    <Link
      href={`/gewaesser/${g.slug}?fisch=${fisch}`}
      className={`flex items-center gap-3 border-b border-border py-3 ${gesperrt ? 'opacity-40' : ''}`}
    >
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-extrabold text-black"
        style={{ backgroundColor: INDEX_HEX[indexFarbe(g.jetztWert)] }}
      >
        {g.unsicher || g.jetztWert === null ? '?' : g.jetztWert.toFixed(1).replace('.', ',')}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{g.name}</div>
        <div className="truncate text-[10px] text-muted-foreground">
          {g.abgeleitet ? g.quelle : g.quelle}
          {g.zugang.art === 'tageskarte' && (
            <> · Tageskarte bis {g.zugang.bis.toLocaleDateString('de-DE')}</>
          )}
          {gesperrt && <> · keine Erlaubnis</>}
        </div>
      </div>

      <div className="flex shrink-0 gap-1">
        {g.tage.map((t) => (
          <TagesBalken key={t.tag.toISOString()} tag={t.tag} wert={t.wert} />
        ))}
      </div>
    </Link>
  )
}
```

- [ ] **Step 7: Startseite schreiben**

`src/app/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import dynamic from 'next/dynamic'
import { auth } from '@/lib/auth'
import { ladeUebersicht } from '@/lib/uebersicht/laden'
import { FISCHE, type Fisch } from '@/lib/beissindex'
import { ZielfischUmschalter } from '@/components/ZielfischUmschalter'
import { GewaesserZeile } from '@/components/GewaesserZeile'
import { NurWoIchDarf } from '@/components/NurWoIchDarf'

const Karte = dynamic(() => import('@/components/Karte').then((m) => m.Karte), {
  ssr: false,
  loading: () => <div className="h-52 animate-pulse bg-muted" />,
})

export default async function Startseite({
  searchParams,
}: {
  searchParams: Promise<{ fisch?: string; alle?: string }>
}) {
  const sitzung = await auth()
  if (!sitzung?.user?.id) redirect('/anmelden')

  const params = await searchParams
  const fisch = (FISCHE.includes(params.fisch as Fisch) ? params.fisch : 'hecht') as Fisch
  const nurErlaubte = params.alle !== '1'

  const alle = await ladeUebersicht(sitzung.user.id, fisch, new Date())
  const sichtbar = nurErlaubte ? alle.filter((g) => g.zugang.art !== 'keine') : alle

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 bg-card px-3 py-2 shadow-sm">
        <ZielfischUmschalter aktiv={fisch} />
      </header>

      <Karte gewaesser={sichtbar} fisch={fisch} />

      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs text-muted-foreground">
          {sichtbar.length} Gewässer
        </span>
        <NurWoIchDarf aktiv={nurErlaubte} />
      </div>

      <section className="px-3 pb-24">
        {sichtbar.map((g) => (
          <GewaesserZeile key={g.id} g={g} fisch={fisch} />
        ))}
        {sichtbar.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Keine Gewässer mit Erlaubnis. Vereine in den Einstellungen eintragen
            oder den Filter ausschalten.
          </p>
        )}
      </section>
    </main>
  )
}
```

`src/components/NurWoIchDarf.tsx`:

```tsx
'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

export function NurWoIchDarf({ aktiv }: { aktiv: boolean }) {
  const router = useRouter()
  const pfad = usePathname()
  const params = useSearchParams()

  function umschalten(an: boolean) {
    const neu = new URLSearchParams(params)
    if (an) neu.delete('alle')
    else neu.set('alle', '1')
    router.push(`${pfad}?${neu}`)
  }

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="nur-erlaubte" className="text-xs text-muted-foreground">
        nur wo ich darf
      </Label>
      <Switch id="nur-erlaubte" checked={aktiv} onCheckedChange={umschalten} />
    </div>
  )
}
```

- [ ] **Step 8: Tests laufen lassen**

Run: `pnpm vitest run src/components/TagesBalken.test.ts`
Expected: PASS, 5 Tests

- [ ] **Step 9: Commit**

```bash
git add src/app/page.tsx src/components
git commit -m "feat: add home screen with fish switcher and ranked water list"
```

---

### Task 4: Karte

**Files:**
- Create: `src/components/Karte.tsx`
- Modify: `src/app/globals.css` (Leaflet-Stile)

**Interfaces:**
- Consumes: `GewaesserUebersicht`, `INDEX_HEX`, `indexFarbe`
- Produces: `Karte({ gewaesser, fisch })` — Client Component, ohne SSR zu laden

- [ ] **Step 1: Leaflet installieren**

```bash
pnpm add leaflet react-leaflet
pnpm add -D @types/leaflet
```

- [ ] **Step 2: Leaflet-Stile einbinden**

In `src/app/globals.css` ganz oben ergänzen:

```css
@import "leaflet/dist/leaflet.css";
```

- [ ] **Step 3: Karte schreiben**

`src/components/Karte.tsx`:

```tsx
'use client'

import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import Link from 'next/link'
import { INDEX_HEX, indexFarbe } from '@/lib/ui/farben'
import type { GewaesserUebersicht } from '@/lib/uebersicht/laden'

/** Kalkar, ungefähr in der Mitte des Reviers */
const MITTE: [number, number] = [51.7639, 6.3]

export function Karte({
  gewaesser,
  fisch,
}: {
  gewaesser: GewaesserUebersicht[]
  fisch: string
}) {
  return (
    <div className="h-52 w-full">
      <MapContainer
        center={MITTE}
        zoom={11}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {gewaesser.map((g) => (
          <CircleMarker
            key={g.id}
            center={[g.lat, g.lon]}
            radius={9}
            pathOptions={{
              color: '#ffffff',
              weight: 2,
              fillColor: INDEX_HEX[indexFarbe(g.jetztWert)],
              fillOpacity: g.zugang.art === 'keine' ? 0.35 : 0.95,
            }}
          >
            <Popup>
              <Link href={`/gewaesser/${g.slug}?fisch=${fisch}`} className="font-semibold">
                {g.name}
              </Link>
              <div className="text-xs">
                {g.jetztWert === null
                  ? 'unsicher'
                  : `${g.jetztWert.toFixed(1).replace('.', ',')} / 10`}
              </div>
              <div className="text-[10px] opacity-70">{g.quelle}</div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}
```

- [ ] **Step 4: Von Hand prüfen**

```bash
pnpm dev
```

- Karte lädt, zeigt zwölf farbige Punkte am Niederrhein
- Antippen öffnet ein Popup mit Namen, Wert und Quellenangabe
- Gewässer ohne Erlaubnis erscheinen blass
- Kein Hydration-Fehler in der Browser-Konsole

- [ ] **Step 5: Commit**

```bash
git add src/components/Karte.tsx src/app/globals.css package.json
git commit -m "feat: add leaflet map with index-colored water markers"
```

---

### Task 5: Detailseite

**Files:**
- Create: `src/app/gewaesser/[slug]/page.tsx`
- Create: `src/components/BeitragsListe.tsx`
- Create: `src/components/PegelKurve.tsx`
- Create: `src/lib/uebersicht/detail.ts`
- Create: `src/lib/uebersicht/detailFormat.ts`
- Test: `src/lib/uebersicht/detail.test.ts`

**Interfaces:**
- Consumes: `prisma`, Rechenkern, `baueBedingungen`
- Produces:
  - `ladeDetail(userId, slug, fisch, jetzt): Promise<GewaesserDetail | null>`
  - `interface GewaesserDetail { …Uebersicht, aktuellesErgebnis: IndexErgebnis, pegelVerlauf: {zeit, cm}[] }`
  - `formatiereSpanne(spanne): string` — „18 bis 21 Uhr"

- [ ] **Step 1: Test für die Formatierung schreiben**

`src/lib/uebersicht/detail.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatiereSpanne } from './detailFormat'

describe('formatiereSpanne', () => {
  it('formatiert eine Spanne als Uhrzeitbereich', () => {
    const text = formatiereSpanne({
      von: new Date('2026-08-21T16:00:00Z'),
      bis: new Date('2026-08-21T19:00:00Z'),
    })
    expect(text).toMatch(/\d{1,2}/)
    expect(text).toContain('bis')
  })

  it('meldet Klartext, wenn keine Spanne vorliegt', () => {
    expect(formatiereSpanne(null)).toContain('keine')
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run src/lib/uebersicht/detail.test.ts`
Expected: FAIL — `Cannot find module './detailFormat'`

- [ ] **Step 3: Formatierung implementieren**

`src/lib/uebersicht/detailFormat.ts`:

```ts
const UHRZEIT = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Berlin',
})

export function formatiereSpanne(spanne: { von: Date; bis: Date } | null): string {
  if (!spanne) return 'Heute keine ausgeprägte Beißzeit'
  return `${UHRZEIT.format(spanne.von)} bis ${UHRZEIT.format(spanne.bis)} Uhr`
}
```

- [ ] **Step 4: Detail-Ladefunktion schreiben**

`src/lib/uebersicht/detail.ts`:

```ts
import { prisma } from '@/lib/db'
import {
  berechneStunden,
  besteZeitspanne,
  fasseZuTagenZusammen,
  STANDARD_GEWICHTE,
  type Fisch,
  type Gewichte,
  type IndexErgebnis,
  type TagesWert,
} from '@/lib/beissindex'
import { baueBedingungen } from '@/lib/bedingungen/bauen'
import { bestimmeZugang, type ZugangStatus } from './zugang'

export interface GewaesserDetail {
  id: string
  slug: string
  name: string
  typ: 'RHEIN' | 'ALTRHEIN' | 'BAGGERSEE'
  abgeleitet: boolean
  quelle: string
  zugang: ZugangStatus
  aktuellesErgebnis: IndexErgebnis | null
  besteSpanne: { von: Date; bis: Date } | null
  tage: TagesWert[]
  pegelVerlauf: { zeit: Date; cm: number }[]
}

const TAG = 24 * 3_600_000

export async function ladeDetail(
  userId: string,
  slug: string,
  fisch: Fisch,
  jetzt: Date,
): Promise<GewaesserDetail | null> {
  const g = await prisma.gewaesser.findUnique({
    where: { slug },
    include: { vereine: { include: { verein: true } } },
  })
  if (!g) return null

  const [mitgliedschaften, tageskarten, profil, wetterZeilen, pegelZeilen] = await Promise.all([
    prisma.mitgliedschaft.findMany({ where: { userId }, include: { verein: true } }),
    prisma.tageskarte.findMany({ where: { userId, bis: { gte: jetzt } } }),
    prisma.gewichtsProfil.findUnique({ where: { userId_fisch: { userId, fisch } } }),
    prisma.wetterStunde.findMany({
      where: {
        gewaesserId: g.id,
        zeit: { gte: new Date(jetzt.getTime() - 2 * TAG), lte: new Date(jetzt.getTime() + 7 * TAG) },
      },
      orderBy: { zeit: 'asc' },
    }),
    prisma.pegelMessung.findMany({
      where: { station: g.referenzPegel, zeit: { gte: new Date(jetzt.getTime() - 14 * TAG) } },
      orderBy: { zeit: 'asc' },
    }),
  ])

  const gewichte = (profil?.gewichte as Gewichte | undefined) ?? STANDARD_GEWICHTE[fisch]

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
  const aktuell = stunden.find(
    (s) => Math.abs(s.zeit.getTime() - jetzt.getTime()) <= 3_600_000,
  )

  // Pegelverlauf der letzten sieben Tage, auf einen Wert je Stunde ausgedünnt
  const sieben = new Date(jetzt.getTime() - 7 * TAG)
  const gesehen = new Set<string>()
  const pegelVerlauf: { zeit: Date; cm: number }[] = []
  for (const p of pegelZeilen) {
    if (p.zeit < sieben) continue
    const key = p.zeit.toISOString().slice(0, 13)
    if (gesehen.has(key)) continue
    gesehen.add(key)
    pegelVerlauf.push({ zeit: p.zeit, cm: p.wasserstandCm })
  }

  return {
    id: g.id,
    slug: g.slug,
    name: g.name,
    typ: g.typ,
    abgeleitet: g.abgeleitet,
    quelle: g.abgeleitet
      ? `geschätzt, abgeleitet von Pegel ${g.referenzPegel}`
      : `Pegel ${g.referenzPegel}`,
    zugang: bestimmeZugang(
      g.vereine.map((v) => v.verein.slug),
      mitgliedschaften.map((m) => m.verein.slug),
      tageskarten.map((k) => ({ gewaesserId: k.gewaesserId, bis: k.bis })),
      g.id,
      jetzt,
    ),
    aktuellesErgebnis: aktuell?.ergebnis ?? null,
    besteSpanne: besteZeitspanne(stunden, jetzt),
    tage: fasseZuTagenZusammen(stunden).slice(0, 7),
    pegelVerlauf,
  }
}
```

- [ ] **Step 5: Beitragsliste schreiben**

`src/components/BeitragsListe.tsx`:

```tsx
import type { Beitrag } from '@/lib/beissindex'

function balken(beitrag: number, maximum: number) {
  const anteil = maximum === 0 ? 0 : Math.abs(beitrag) / maximum
  return `${Math.round(anteil * 50)}%`
}

export function BeitragsListe({ beitraege }: { beitraege: Beitrag[] }) {
  const maximum = Math.max(1, ...beitraege.map((b) => Math.abs(b.beitrag)))

  return (
    <ul className="flex flex-col gap-2">
      {beitraege.map((b) => (
        <li key={b.key} className="flex items-center gap-2 text-xs">
          <div className="w-24 shrink-0 font-medium">{b.label}</div>

          <div className="relative h-1.5 flex-1 rounded-full bg-muted">
            {!b.fehlend && (
              <div
                className="absolute top-0 h-full rounded-full"
                style={{
                  width: balken(b.beitrag, maximum),
                  left: b.beitrag >= 0 ? '50%' : undefined,
                  right: b.beitrag < 0 ? '50%' : undefined,
                  backgroundColor: b.beitrag >= 0 ? '#3ddc84' : '#f2564b',
                }}
              />
            )}
          </div>

          <div
            className={`w-10 shrink-0 text-right font-semibold ${
              b.fehlend ? 'text-muted-foreground' : b.beitrag >= 0 ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {b.fehlend
              ? '—'
              : `${b.beitrag >= 0 ? '+' : '−'}${Math.abs(b.beitrag).toFixed(1).replace('.', ',')}`}
          </div>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 6: Pegelkurve schreiben**

```bash
pnpm add recharts
```

`src/components/PegelKurve.tsx`:

```tsx
'use client'

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export function PegelKurve({
  verlauf,
  abgeleitet,
}: {
  verlauf: { zeit: Date; cm: number }[]
  abgeleitet: boolean
}) {
  const daten = verlauf.map((p) => ({
    label: new Intl.DateTimeFormat('de-DE', { weekday: 'short', timeZone: 'Europe/Berlin' }).format(p.zeit),
    cm: p.cm,
  }))

  if (daten.length === 0) {
    return <p className="text-xs text-muted-foreground">Kein Pegelverlauf verfügbar.</p>
  }

  return (
    <div className="h-32 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={daten}>
          <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
          <YAxis width={34} tick={{ fontSize: 9 }} domain={['dataMin - 10', 'dataMax + 10']} />
          <Tooltip formatter={(v) => [`${v} cm`, abgeleitet ? 'geschätzt' : 'gemessen']} />
          <Area type="monotone" dataKey="cm" stroke="#4aa3ff" fill="#4aa3ff" fillOpacity={0.25} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 7: Detailseite schreiben**

`src/app/gewaesser/[slug]/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { ladeDetail } from '@/lib/uebersicht/detail'
import { formatiereSpanne } from '@/lib/uebersicht/detailFormat'
import { FISCHE, type Fisch } from '@/lib/beissindex'
import { INDEX_HEX, indexFarbe } from '@/lib/ui/farben'
import { BeitragsListe } from '@/components/BeitragsListe'
import { PegelKurve } from '@/components/PegelKurve'
import { Button } from '@/components/ui/button'

export default async function DetailSeite({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ fisch?: string }>
}) {
  const sitzung = await auth()
  if (!sitzung?.user?.id) redirect('/anmelden')

  const { slug } = await params
  const sp = await searchParams
  const fisch = (FISCHE.includes(sp.fisch as Fisch) ? sp.fisch : 'hecht') as Fisch

  const g = await ladeDetail(sitzung.user.id, slug, fisch, new Date())
  if (!g) notFound()

  const wert = g.aktuellesErgebnis?.wert ?? null
  const unsicher = g.aktuellesErgebnis?.unsicher ?? true

  return (
    <main className="flex min-h-dvh flex-col pb-24">
      <header className="bg-card px-4 py-3 shadow-sm">
        <Link href={`/?fisch=${fisch}`} className="text-xs text-muted-foreground">
          ‹ Zurück
        </Link>
        <h1 className="mt-1 text-lg font-bold">{g.name}</h1>
        <p className="text-[11px] text-muted-foreground">{g.quelle}</p>
      </header>

      <section className="flex items-center gap-4 px-4 py-4">
        <div
          className="flex size-16 shrink-0 items-center justify-center rounded-full text-2xl font-extrabold text-black"
          style={{ backgroundColor: INDEX_HEX[indexFarbe(wert)] }}
        >
          {unsicher || wert === null ? '?' : wert.toFixed(1).replace('.', ',')}
        </div>

        <div className="text-sm">
          {unsicher ? (
            <>
              <strong>Unsicher.</strong>
              <br />
              <span className="text-muted-foreground">
                {g.aktuellesErgebnis?.unsicherGrund ?? 'Keine aktuellen Daten.'}
              </span>
            </>
          ) : (
            <>
              <strong>
                {wert! >= 7 ? 'Gute Bedingungen.' : wert! >= 4.5 ? 'Mittelmäßig.' : 'Eher schlecht.'}
              </strong>
              <br />
              <span className="text-muted-foreground">{formatiereSpanne(g.besteSpanne)}</span>
            </>
          )}
        </div>
      </section>

      {g.aktuellesErgebnis?.regeln.map((r) => (
        <p key={r.name} className="mx-4 mb-2 rounded-md bg-secondary px-3 py-2 text-xs">
          {r.text}
        </p>
      ))}

      {g.aktuellesErgebnis && !unsicher && (
        <section className="px-4 py-2">
          <h2 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Was den Wert ausmacht
          </h2>
          <BeitragsListe beitraege={g.aktuellesErgebnis.beitraege} />
        </section>
      )}

      <section className="px-4 py-4">
        <h2 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Pegel, letzte 7 Tage{g.abgeleitet && ' (geschätzt)'}
        </h2>
        <PegelKurve verlauf={g.pegelVerlauf} abgeleitet={g.abgeleitet} />
      </section>

      <div className="flex gap-2 px-4">
        <Button asChild className="flex-1">
          <Link href={`/fang/neu?gewaesser=${g.slug}&fisch=${fisch}`}>Fang eintragen</Link>
        </Button>
        <Button asChild variant="secondary" className="flex-1">
          <Link href={`/tageskarte/neu?gewaesser=${g.slug}`}>Tageskarte</Link>
        </Button>
      </div>
    </main>
  )
}
```

- [ ] **Step 8: Test laufen lassen und von Hand prüfen**

Run: `pnpm vitest run src/lib/uebersicht/detail.test.ts`
Expected: PASS, 2 Tests

Von Hand: Detailseite eines Rhein-Gewässers und eines Baggersees öffnen. Beim See muss „geschätzt, abgeleitet von Pegel REES" **sowohl** im Kopf **als auch** an der Pegelkurve stehen.

- [ ] **Step 9: Commit**

```bash
git add src/app/gewaesser src/components/BeitragsListe.tsx src/components/PegelKurve.tsx src/lib/uebersicht
git commit -m "feat: add water detail page with factor contributions and gauge chart"
```

---

### Task 6: Fangbuch

**Files:**
- Create: `src/app/fang/neu/page.tsx`
- Create: `src/app/fang/aktionen.ts`
- Create: `src/app/fangbuch/page.tsx`
- Test: `src/app/fang/schnappschuss.test.ts`

**Interfaces:**
- Consumes: `ladeDetail`, `prisma`, `auth`
- Produces:
  - `baueSchnappschuss(detail, fisch, zeit): Schnappschuss` — **Kopie**, kein Verweis
  - Server Action `fangEintragen(formular: FormData)`

**Kernpunkt (Spec §8):** Der Schnappschuss ist eine vollständige, eigenständige Kopie der Bedingungen und Beiträge. Spätere Änderungen an Gewichten dürfen ihn nicht verändern.

- [ ] **Step 1: Test schreiben**

`src/app/fang/schnappschuss.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { baueSchnappschuss } from './schnappschuss'
import type { IndexErgebnis } from '@/lib/beissindex'

const ergebnis: IndexErgebnis = {
  wert: 7.4,
  unsicher: false,
  unsicherGrund: null,
  beitraege: [
    {
      key: 'solunar',
      label: 'Solunar',
      roh: 0.8,
      gewicht: 3,
      beitrag: 2.4,
      text: 'Solunar: Hauptbeißzeit',
      fehlend: false,
    },
  ],
  regeln: [{ name: 'aenderungsBremse', text: 'Pegel fällt schnell' }],
}

describe('baueSchnappschuss', () => {
  it('übernimmt Wert, Beiträge und Regeln', () => {
    const s = baueSchnappschuss(ergebnis, 'hecht', new Date('2026-08-21T18:00:00Z'), 'Pegel REES')
    expect(s.wert).toBe(7.4)
    expect(s.beitraege).toHaveLength(1)
    expect(s.regeln).toHaveLength(1)
    expect(s.quelle).toBe('Pegel REES')
  })

  it('ist eine echte Kopie — spätere Änderungen am Original wirken nicht nach', () => {
    const s = baueSchnappschuss(ergebnis, 'hecht', new Date(), 'Pegel REES')
    ergebnis.beitraege[0].gewicht = 0
    ergebnis.beitraege[0].beitrag = 0
    expect(s.beitraege[0].gewicht).toBe(3)
    expect(s.beitraege[0].beitrag).toBe(2.4)
  })

  it('hält den Zielfisch fest, für den gerechnet wurde', () => {
    expect(baueSchnappschuss(ergebnis, 'aal', new Date(), 'x').fisch).toBe('aal')
  })

  it('lässt sich als JSON speichern und wieder einlesen', () => {
    const s = baueSchnappschuss(ergebnis, 'hecht', new Date('2026-08-21T18:00:00Z'), 'x')
    const zurueck = JSON.parse(JSON.stringify(s))
    expect(zurueck.wert).toBe(7.4)
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run src/app/fang/schnappschuss.test.ts`
Expected: FAIL — `Cannot find module './schnappschuss'`

- [ ] **Step 3: Schnappschuss implementieren**

`src/app/fang/schnappschuss.ts`:

```ts
import type { Beitrag, AngewandteRegel, IndexErgebnis } from '@/lib/beissindex'

export interface Schnappschuss {
  gerechnetAm: string
  fisch: string
  wert: number | null
  unsicher: boolean
  quelle: string
  beitraege: Beitrag[]
  regeln: AngewandteRegel[]
}

/**
 * Vollständige, eigenständige Kopie (Spec §8). Bewusst kein Verweis auf die
 * Formel — spätere Regler-Änderungen dürfen die Vergangenheit nicht
 * umschreiben, sonst kann man aus ihr nichts lernen.
 */
export function baueSchnappschuss(
  ergebnis: IndexErgebnis,
  fisch: string,
  zeit: Date,
  quelle: string,
): Schnappschuss {
  return {
    gerechnetAm: zeit.toISOString(),
    fisch,
    wert: ergebnis.wert,
    unsicher: ergebnis.unsicher,
    quelle,
    beitraege: ergebnis.beitraege.map((b) => ({ ...b })),
    regeln: ergebnis.regeln.map((r) => ({ ...r })),
  }
}
```

- [ ] **Step 4: Server Action schreiben**

`src/app/fang/aktionen.ts`:

```ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ladeDetail } from '@/lib/uebersicht/detail'
import { FISCHE, type Fisch } from '@/lib/beissindex'
import { baueSchnappschuss } from './schnappschuss'

const FangEingabe = z.object({
  gewaesserSlug: z.string().min(1),
  fischart: z.string().min(1),
  zeit: z.string().min(1),
  laengeCm: z.string().optional(),
  koeder: z.string().optional(),
  notiz: z.string().optional(),
})

export async function fangEintragen(formular: FormData) {
  const sitzung = await auth()
  if (!sitzung?.user?.id) redirect('/anmelden')

  const eingabe = FangEingabe.parse(Object.fromEntries(formular))
  const zeit = new Date(eingabe.zeit)

  const fisch = (FISCHE.includes(eingabe.fischart as Fisch)
    ? eingabe.fischart
    : 'hecht') as Fisch

  const detail = await ladeDetail(sitzung.user.id, eingabe.gewaesserSlug, fisch, zeit)
  if (!detail) throw new Error('Gewässer nicht gefunden')

  const schnappschuss = detail.aktuellesErgebnis
    ? baueSchnappschuss(detail.aktuellesErgebnis, fisch, zeit, detail.quelle)
    : { gerechnetAm: zeit.toISOString(), fisch, wert: null, unsicher: true, quelle: detail.quelle, beitraege: [], regeln: [] }

  await prisma.fang.create({
    data: {
      userId: sitzung.user.id,
      gewaesserId: detail.id,
      zeit,
      fischart: eingabe.fischart,
      laengeCm: eingabe.laengeCm ? Number(eingabe.laengeCm) : null,
      koeder: eingabe.koeder || null,
      notiz: eingabe.notiz || null,
      schnappschuss: JSON.parse(JSON.stringify(schnappschuss)),
    },
  })

  revalidatePath('/fangbuch')
  redirect('/fangbuch')
}
```

- [ ] **Step 5: Eingabeseite schreiben**

`src/app/fang/neu/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { fangEintragen } from '../aktionen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default async function NeuerFang({
  searchParams,
}: {
  searchParams: Promise<{ gewaesser?: string; fisch?: string }>
}) {
  const sitzung = await auth()
  if (!sitzung?.user?.id) redirect('/anmelden')

  const sp = await searchParams
  const gewaesser = await prisma.gewaesser.findMany({ orderBy: { name: 'asc' } })
  const jetzt = new Date().toISOString().slice(0, 16)

  return (
    <main className="flex min-h-dvh flex-col gap-4 px-4 py-5">
      <h1 className="text-xl font-bold">Fang eintragen</h1>

      <form action={fangEintragen} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gewaesserSlug">Gewässer</Label>
          <select
            id="gewaesserSlug"
            name="gewaesserSlug"
            defaultValue={sp.gewaesser}
            required
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {gewaesser.map((g) => (
              <option key={g.slug} value={g.slug}>{g.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fischart">Fisch</Label>
          <select
            id="fischart"
            name="fischart"
            defaultValue={sp.fisch ?? 'hecht'}
            required
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="hecht">Hecht</option>
            <option value="zander">Zander</option>
            <option value="aal">Aal</option>
            <option value="karpfen">Karpfen</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="zeit">Wann</Label>
          <Input id="zeit" name="zeit" type="datetime-local" defaultValue={jetzt} required />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="laengeCm">Länge in cm (optional)</Label>
          <Input id="laengeCm" name="laengeCm" type="number" min="1" max="300" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="koeder">Köder (optional)</Label>
          <Input id="koeder" name="koeder" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notiz">Notiz (optional)</Label>
          <Input id="notiz" name="notiz" />
        </div>

        <p className="text-[11px] text-muted-foreground">
          Pegel, Wetter und Beißindex werden automatisch mitgespeichert.
        </p>

        <Button type="submit">Speichern</Button>
      </form>
    </main>
  )
}
```

- [ ] **Step 6: Fangbuch-Liste schreiben**

`src/app/fangbuch/page.tsx`:

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import type { Schnappschuss } from '../fang/schnappschuss'

export default async function Fangbuch() {
  const sitzung = await auth()
  if (!sitzung?.user?.id) redirect('/anmelden')

  const faenge = await prisma.fang.findMany({
    where: { userId: sitzung.user.id },
    include: { gewaesser: true },
    orderBy: { zeit: 'desc' },
  })

  return (
    <main className="flex min-h-dvh flex-col px-4 py-5 pb-24">
      <h1 className="mb-4 text-xl font-bold">Fangbuch</h1>

      {faenge.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Noch nichts eingetragen. <Link href="/" className="underline">Zur Karte</Link>
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {faenge.map((f) => {
          const s = f.schnappschuss as unknown as Schnappschuss
          return (
            <li key={f.id} className="rounded-lg bg-card p-3 shadow-sm">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold capitalize">{f.fischart}</span>
                <span className="text-xs text-muted-foreground">
                  {f.zeit.toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">{f.gewaesser.name}</div>
              {f.laengeCm && <div className="text-xs">{f.laengeCm} cm</div>}
              {f.koeder && <div className="text-xs">Köder: {f.koeder}</div>}
              <div className="mt-1 text-[11px] text-muted-foreground">
                Beißindex damals:{' '}
                {s?.wert === null || s?.wert === undefined
                  ? 'unbekannt'
                  : `${s.wert.toFixed(1).replace('.', ',')} / 10`}
              </div>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
```

- [ ] **Step 7: Test laufen lassen und von Hand prüfen**

Run: `pnpm vitest run src/app/fang/schnappschuss.test.ts`
Expected: PASS, 4 Tests

Von Hand: Fang eintragen, im Fangbuch erscheint er mit dem damaligen Indexwert. Danach in den Einstellungen ein Gewicht ändern und prüfen, dass der Wert **im Fangbuch unverändert** bleibt.

- [ ] **Step 8: Commit**

```bash
git add src/app/fang src/app/fangbuch
git commit -m "feat: add catch log with immutable condition snapshot"
```

---

### Task 7: Tageskarten

**Files:**
- Create: `src/app/tageskarte/neu/page.tsx`
- Create: `src/app/tageskarte/aktionen.ts`

**Interfaces:**
- Consumes: `prisma`, `auth`
- Produces: Server Action `tageskarteEintragen(formular: FormData)`

- [ ] **Step 1: Server Action schreiben**

`src/app/tageskarte/aktionen.ts`:

```ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const Eingabe = z.object({
  gewaesserSlug: z.string().min(1),
  von: z.string().min(1),
  bis: z.string().min(1),
})

export async function tageskarteEintragen(formular: FormData) {
  const sitzung = await auth()
  if (!sitzung?.user?.id) redirect('/anmelden')

  const eingabe = Eingabe.parse(Object.fromEntries(formular))
  const gewaesser = await prisma.gewaesser.findUniqueOrThrow({
    where: { slug: eingabe.gewaesserSlug },
  })

  const von = new Date(`${eingabe.von}T00:00:00Z`)
  // Gültigkeit bis zum Ende des gewählten Tages
  const bis = new Date(`${eingabe.bis}T23:59:59Z`)

  if (bis < von) throw new Error('Das Enddatum liegt vor dem Startdatum')

  await prisma.tageskarte.create({
    data: { userId: sitzung.user.id, gewaesserId: gewaesser.id, von, bis },
  })

  revalidatePath('/')
  redirect('/')
}
```

- [ ] **Step 2: Seite schreiben**

`src/app/tageskarte/neu/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { tageskarteEintragen } from '../aktionen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default async function NeueTageskarte({
  searchParams,
}: {
  searchParams: Promise<{ gewaesser?: string }>
}) {
  const sitzung = await auth()
  if (!sitzung?.user?.id) redirect('/anmelden')

  const sp = await searchParams
  const gewaesser = await prisma.gewaesser.findMany({ orderBy: { name: 'asc' } })
  const heute = new Date().toISOString().slice(0, 10)

  return (
    <main className="flex min-h-dvh flex-col gap-4 px-4 py-5">
      <h1 className="text-xl font-bold">Tageskarte eintragen</h1>

      <form action={tageskarteEintragen} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gewaesserSlug">Gewässer</Label>
          <select
            id="gewaesserSlug"
            name="gewaesserSlug"
            defaultValue={sp.gewaesser}
            required
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {gewaesser.map((g) => (
              <option key={g.slug} value={g.slug}>{g.name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="von">Von</Label>
            <Input id="von" name="von" type="date" defaultValue={heute} required />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="bis">Bis</Label>
            <Input id="bis" name="bis" type="date" defaultValue={heute} required />
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Die Karte läuft danach automatisch ab. Sie ersetzt keinen Erlaubnisschein —
          das Papier gehört weiterhin in die Tasche.
        </p>

        <Button type="submit">Speichern</Button>
      </form>
    </main>
  )
}
```

- [ ] **Step 3: Von Hand prüfen**

- Tageskarte für ein Gewässer ohne Erlaubnis eintragen → erscheint auf der Startseite mit „Tageskarte bis …"
- Tageskarte mit Enddatum in der Vergangenheit → Gewässer bleibt gesperrt

- [ ] **Step 4: Commit**

```bash
git add src/app/tageskarte
git commit -m "feat: add day ticket entry with automatic expiry"
```

---

### Task 8: Einstellungen

**Files:**
- Create: `src/app/einstellungen/page.tsx`
- Create: `src/app/einstellungen/aktionen.ts`
- Create: `src/components/GewichtsRegler.tsx`
- Create: `src/components/Navigation.tsx`
- Modify: `src/app/layout.tsx` (Navigation einhängen)

**Interfaces:**
- Consumes: `STANDARD_GEWICHTE`, `FAKTOR_KEYS`, `FAKTOR_LABEL`, `prisma`
- Produces: Server Actions `gewichteSpeichern`, `mitgliedschaftenSpeichern`, `gewaesserAnpassen`

- [ ] **Step 1: Server Actions schreiben**

`src/app/einstellungen/aktionen.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { FAKTOR_KEYS, FISCHE, type Fisch, type Gewichte } from '@/lib/beissindex'

async function angemeldeterBenutzer(): Promise<string> {
  const sitzung = await auth()
  if (!sitzung?.user?.id) redirect('/anmelden')
  return sitzung.user.id
}

export async function gewichteSpeichern(formular: FormData) {
  const userId = await angemeldeterBenutzer()
  const fisch = String(formular.get('fisch'))
  if (!FISCHE.includes(fisch as Fisch)) throw new Error('Unbekannter Zielfisch')

  const gewichte = {} as Gewichte
  for (const key of FAKTOR_KEYS) {
    const roh = Number(formular.get(key))
    if (Number.isNaN(roh) || roh < 0 || roh > 3) {
      throw new Error(`Gewicht für ${key} liegt außerhalb von 0 bis 3`)
    }
    gewichte[key] = roh
  }

  await prisma.gewichtsProfil.upsert({
    where: { userId_fisch: { userId, fisch } },
    update: { gewichte },
    create: { userId, fisch, gewichte },
  })

  revalidatePath('/')
  revalidatePath('/einstellungen')
}

export async function mitgliedschaftenSpeichern(formular: FormData) {
  const userId = await angemeldeterBenutzer()
  const gewaehlt = formular.getAll('verein').map(String)

  await prisma.mitgliedschaft.deleteMany({ where: { userId } })

  for (const slug of gewaehlt) {
    const verein = await prisma.verein.findUnique({ where: { slug } })
    if (verein) {
      await prisma.mitgliedschaft.create({ data: { userId, vereinId: verein.id } })
    }
  }

  revalidatePath('/')
  revalidatePath('/einstellungen')
}

const GewaesserAnpassung = z.object({
  slug: z.string().min(1),
  verzoegerungTage: z.coerce.number().int().min(0).max(14),
  daempfung: z.coerce.number().min(0.01).max(1),
})

export async function gewaesserAnpassen(formular: FormData) {
  await angemeldeterBenutzer()
  const eingabe = GewaesserAnpassung.parse(Object.fromEntries(formular))

  await prisma.gewaesser.update({
    where: { slug: eingabe.slug },
    data: {
      verzoegerungTage: eingabe.verzoegerungTage,
      daempfung: eingabe.daempfung,
    },
  })

  revalidatePath('/')
  revalidatePath('/einstellungen')
}
```

- [ ] **Step 2: Regler-Komponente schreiben**

`src/components/GewichtsRegler.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { FAKTOR_KEYS, FAKTOR_LABEL, type Gewichte } from '@/lib/beissindex'
import { gewichteSpeichern } from '@/app/einstellungen/aktionen'

export function GewichtsRegler({ fisch, start }: { fisch: string; start: Gewichte }) {
  const [werte, setWerte] = useState<Gewichte>(start)

  return (
    <form action={gewichteSpeichern} className="flex flex-col gap-3">
      <input type="hidden" name="fisch" value={fisch} />

      {FAKTOR_KEYS.map((key) => (
        <div key={key} className="flex items-center gap-3">
          <span className="w-28 shrink-0 text-xs">{FAKTOR_LABEL[key]}</span>
          <Slider
            className="flex-1"
            min={0}
            max={3}
            step={0.5}
            value={[werte[key]]}
            onValueChange={([v]) => setWerte({ ...werte, [key]: v })}
          />
          <span className="w-6 text-right text-xs tabular-nums">
            {werte[key].toString().replace('.', ',')}
          </span>
          <input type="hidden" name={key} value={werte[key]} />
        </div>
      ))}

      <Button type="submit" size="sm" className="self-start">
        Für {fisch} speichern
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: Einstellungsseite schreiben**

`src/app/einstellungen/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { FISCHE, STANDARD_GEWICHTE, type Gewichte } from '@/lib/beissindex'
import { GewichtsRegler } from '@/components/GewichtsRegler'
import { mitgliedschaftenSpeichern, gewaesserAnpassen } from './aktionen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default async function Einstellungen() {
  const sitzung = await auth()
  if (!sitzung?.user?.id) redirect('/anmelden')
  const userId = sitzung.user.id

  const [vereine, meine, profile, gewaesser] = await Promise.all([
    prisma.verein.findMany({ orderBy: { name: 'asc' } }),
    prisma.mitgliedschaft.findMany({ where: { userId } }),
    prisma.gewichtsProfil.findMany({ where: { userId } }),
    prisma.gewaesser.findMany({ where: { abgeleitet: true }, orderBy: { name: 'asc' } }),
  ])

  const meineIds = new Set(meine.map((m) => m.vereinId))

  return (
    <main className="flex min-h-dvh flex-col gap-8 px-4 py-5 pb-28">
      <h1 className="text-xl font-bold">Einstellungen</h1>

      <section>
        <h2 className="mb-2 text-sm font-bold">Meine Vereine</h2>
        <form action={mitgliedschaftenSpeichern} className="flex flex-col gap-2">
          {vereine.map((v) => (
            <label key={v.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="verein"
                value={v.slug}
                defaultChecked={meineIds.has(v.id)}
                className="size-4"
              />
              {v.name}
            </label>
          ))}
          <Button type="submit" size="sm" className="mt-1 self-start">Speichern</Button>
        </form>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Die Zuordnung von Vereinen zu Gewässern ist von Hand gepflegt und
          ungeprüft. Stimmt etwas nicht, sag Bescheid — sie lässt sich ändern.
        </p>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-bold">Was zählt wie viel</h2>
        <p className="mb-3 text-[11px] text-muted-foreground">
          Die Startwerte sind ein Vorschlag, keine Wahrheit. Glaubst du nicht an
          den Mond, dreh ihn auf 0.
        </p>

        <div className="flex flex-col gap-6">
          {FISCHE.map((fisch) => {
            const eigenes = profile.find((p) => p.fisch === fisch)
            const start = (eigenes?.gewichte as Gewichte | undefined) ?? STANDARD_GEWICHTE[fisch]
            return (
              <div key={fisch}>
                <h3 className="mb-2 text-xs font-bold capitalize">{fisch}</h3>
                <GewichtsRegler fisch={fisch} start={start} />
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-bold">Seen und Altrheine</h2>
        <p className="mb-3 text-[11px] text-muted-foreground">
          Wie viele Tage hängt das Gewässer dem Rhein hinterher, und wie viel
          von dessen Bewegung kommt an? Grobe Schätzung genügt.
        </p>

        <div className="flex flex-col gap-3">
          {gewaesser.map((g) => (
            <form key={g.id} action={gewaesserAnpassen} className="flex items-end gap-2">
              <input type="hidden" name="slug" value={g.slug} />
              <div className="min-w-0 flex-1 truncate text-xs">{g.name}</div>
              <Input
                name="verzoegerungTage"
                type="number"
                min="0"
                max="14"
                defaultValue={g.verzoegerungTage}
                className="w-16"
                aria-label={`Verzögerung ${g.name} in Tagen`}
              />
              <Input
                name="daempfung"
                type="number"
                min="0.01"
                max="1"
                step="0.05"
                defaultValue={g.daempfung}
                className="w-20"
                aria-label={`Dämpfung ${g.name}`}
              />
              <Button type="submit" size="sm" variant="secondary">OK</Button>
            </form>
          ))}
        </div>
      </section>

      <section className="rounded-lg bg-secondary p-3">
        <p className="text-[11px] leading-relaxed text-secondary-foreground">
          <strong>Diese App ist ein Merkzettel, kein Erlaubnisschein.</strong> Wenn
          die Fischereiaufsicht kommt, zählt das Papier in deiner Tasche, nicht der
          grüne Haken im Handy. Die Beißindex-Werte sind gesammeltes Anglerwissen,
          keine Wissenschaft. Wasserstände an Seen und Altrheinen sind geschätzt
          und nicht gemessen.
        </p>
      </section>
    </main>
  )
}
```

- [ ] **Step 4: Navigation schreiben und einhängen**

`src/components/Navigation.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const PUNKTE = [
  { pfad: '/', name: 'Karte' },
  { pfad: '/fangbuch', name: 'Fangbuch' },
  { pfad: '/einstellungen', name: 'Einstellungen' },
]

export function Navigation() {
  const pfad = usePathname()
  if (pfad === '/anmelden') return null

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md border-t border-border bg-card">
      {PUNKTE.map((p) => {
        const aktiv = pfad === p.pfad
        return (
          <Link
            key={p.pfad}
            href={p.pfad}
            className={`flex-1 py-3 text-center text-xs ${
              aktiv ? 'font-bold text-primary' : 'text-muted-foreground'
            }`}
          >
            {p.name}
          </Link>
        )
      })}
    </nav>
  )
}
```

In `src/app/layout.tsx` innerhalb des `div` ergänzen: `<Navigation />` direkt nach `{children}`.

- [ ] **Step 5: Von Hand prüfen**

- Mondgewicht beim Hecht auf 0 stellen, speichern → Werte auf der Startseite ändern sich
- Verein abwählen → Gewässer verschwinden aus der gefilterten Liste
- Verzögerung eines Sees ändern → dessen Wert ändert sich

- [ ] **Step 6: Build und Commit**

Run: `pnpm test && pnpm build`

```bash
git add src/app/einstellungen src/components/GewichtsRegler.tsx src/components/Navigation.tsx src/app/layout.tsx
git commit -m "feat: add settings for weights, clubs and lake coupling"
```

---

### Task 9: Offline und Veralterung

**Files:**
- Create: `public/manifest.json`
- Create: `public/sw.js`
- Create: `src/components/ServiceWorkerAnmeldung.tsx`
- Create: `src/components/OfflineHinweis.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: nichts
- Produces: installierbare Web-App mit Offline-Anzeige des zuletzt geladenen Stands

**Ziel (Spec §4.6):** Am Baggerloch ohne Netz zeigt die App den letzten geladenen Stand — deutlich als offline markiert. Kein weißer Bildschirm, kein ewiger Ladekringel.

- [ ] **Step 1: Manifest schreiben**

`public/manifest.json`:

```json
{
  "name": "Angel-App Niederrhein",
  "short_name": "Angel-App",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f1a22",
  "theme_color": "#1f3b52",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Symbole erzeugen: ein schlichtes Quadrat in `--primary` mit einem hellen Fisch-Umriss, als PNG in 192 und 512 px unter `public/icons/`.

- [ ] **Step 2: Service Worker schreiben**

`public/sw.js`:

```js
const CACHE = 'angel-app-v1'

// Netz zuerst, Zwischenspeicher als Rückfallebene. Für diese App richtig
// herum: frische Daten schlagen alte, aber alte schlagen gar nichts.
self.addEventListener('fetch', (ereignis) => {
  const anfrage = ereignis.request
  if (anfrage.method !== 'GET') return
  if (new URL(anfrage.url).origin !== self.location.origin) return

  ereignis.respondWith(
    fetch(anfrage)
      .then((antwort) => {
        const kopie = antwort.clone()
        caches.open(CACHE).then((c) => c.put(anfrage, kopie))
        return antwort
      })
      .catch(() => caches.match(anfrage)),
  )
})

self.addEventListener('activate', (ereignis) => {
  ereignis.waitUntil(
    caches.keys().then((namen) =>
      Promise.all(namen.filter((n) => n !== CACHE).map((n) => caches.delete(n))),
    ),
  )
})
```

- [ ] **Step 3: Anmeldung und Offline-Hinweis schreiben**

`src/components/ServiceWorkerAnmeldung.tsx`:

```tsx
'use client'

import { useEffect } from 'react'

export function ServiceWorkerAnmeldung() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Kein Service Worker — die App funktioniert dann eben nur online.
      })
    }
  }, [])

  return null
}
```

`src/components/OfflineHinweis.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'

export function OfflineHinweis({ geladenAm }: { geladenAm: string }) {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const auf = () => setOffline(false)
    const ab = () => setOffline(true)
    setOffline(!navigator.onLine)
    window.addEventListener('online', auf)
    window.addEventListener('offline', ab)
    return () => {
      window.removeEventListener('online', auf)
      window.removeEventListener('offline', ab)
    }
  }, [])

  if (!offline) return null

  const zeit = new Date(geladenAm).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  })

  return (
    <div className="bg-destructive px-3 py-1.5 text-center text-[11px] font-medium text-white">
      Offline — Stand von heute {zeit}
    </div>
  )
}
```

- [ ] **Step 4: In Layout und Startseite einhängen**

In `src/app/layout.tsx`: `<link rel="manifest" href="/manifest.json" />` über `metadata.manifest = '/manifest.json'` setzen und `<ServiceWorkerAnmeldung />` im `body` rendern.

In `src/app/page.tsx` direkt unter dem `header`:

```tsx
<OfflineHinweis geladenAm={new Date().toISOString()} />
```

- [ ] **Step 5: Von Hand prüfen**

```bash
pnpm build && pnpm start
```

- Seite laden, dann in den Entwicklerwerkzeugen „Offline" schalten und neu laden
- Erwartet: Die Seite erscheint weiterhin, oben steht der rote Balken „Offline — Stand von heute HH:MM"
- Auf dem Handy: „Zum Startbildschirm hinzufügen" ergibt ein eigenes Symbol und startet ohne Browserleiste

- [ ] **Step 6: Commit**

```bash
git add public src/components/ServiceWorkerAnmeldung.tsx src/components/OfflineHinweis.tsx src/app/layout.tsx src/app/page.tsx
git commit -m "feat: make app installable and usable offline"
```

---

### Task 10: Deploy auf Coolify

**Files:**
- Create: `README.md`
- Create: `scripts/ingest-cron.sh`

**Interfaces:**
- Consumes: fertige App
- Produces: laufende Instanz mit Datenbank und regelmäßigem Datenabruf

- [ ] **Step 1: README schreiben**

`README.md` mit: Zweck, lokales Setup (Postgres per Docker, `.env`, `prisma migrate dev`, `db seed`, `benutzer-anlegen`), Testbefehle, Deploy-Hinweise, und einem **deutlichen Abschnitt** mit den Ehrlichkeits-Vorbehalten aus der Spec: geschätzte Wasserstände, kodiertes Anglerwissen statt Wissenschaft, kein Erlaubnisschein.

- [ ] **Step 2: In Coolify anlegen**

- Neues Projekt, Quelle GitHub `HannesOster/angel-app-niederrhein`, Buildpack **nixpacks**, Port **3000**
- PostgreSQL-Dienst im selben Projekt anlegen
- Umgebungsvariablen setzen: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST=true`, `NEXTAUTH_URL`, `INGEST_TOKEN`
- Pre-Deploy-Befehl: `pnpm exec prisma migrate deploy`

- [ ] **Step 3: Erstes Deploy und Grundbefüllung**

```bash
# nach erfolgreichem Deploy, im Coolify-Terminal des Containers:
pnpm exec prisma db seed
SEED_USER_EMAIL=... SEED_USER_PASSWORT=... pnpm exec tsx scripts/benutzer-anlegen.ts
```

- [ ] **Step 4: Datenabruf einrichten**

`scripts/ingest-cron.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
curl -fsS -X POST "${APP_URL}/api/ingest" -H "x-ingest-token: ${INGEST_TOKEN}" >/dev/null
```

In Coolify als Scheduled Task alle 15 Minuten eintragen.

- [ ] **Step 5: Live prüfen**

- Anmeldung funktioniert
- Karte zeigt zwölf Punkte mit Werten (keine Fragezeichen)
- Detailseite eines Sees zeigt „geschätzt, abgeleitet von Pegel REES"
- Nach 30 Minuten: Werte haben sich aktualisiert (Ingest läuft)
- Auf Daniels Handy zum Startbildschirm hinzufügen und offline testen

- [ ] **Step 6: Commit**

```bash
git add README.md scripts/ingest-cron.sh
git commit -m "docs: add readme and ingest cron script"
git push
```

---

## Definition of Done für Plan C

- [ ] `pnpm test`, `pnpm exec tsc --noEmit` und `pnpm build` grün
- [ ] Startseite zeigt Karte, Zielfisch-Umschalter, Rangliste mit drei Tagesbalken und den Filter „nur wo ich darf" (standardmäßig an)
- [ ] Detailseite zeigt Wert, aktive Regeln im Klartext, Beitrag jedes Faktors und die Pegelkurve
- [ ] Abgeleitete Wasserstände sind **überall** als geschätzt beschriftet, mit Nennung des Referenzpegels
- [ ] Unsichere Werte zeigen niemals eine Zahl
- [ ] Fangbuch speichert einen unveränderlichen Schnappschuss — nachweislich per Handprobe (Gewicht ändern, alter Eintrag bleibt gleich)
- [ ] Einstellungen erlauben Gewichte je Zielfisch, Vereine und Verzögerung/Dämpfung je Gewässer
- [ ] Der Hinweis „Merkzettel, kein Erlaubnisschein" steht sichtbar in den Einstellungen
- [ ] App ist auf dem Handy installierbar und zeigt offline den letzten Stand mit Zeitstempel
- [ ] Live auf Coolify erreichbar, Ingest läuft alle 15 Minuten
