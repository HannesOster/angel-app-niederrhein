'use client'

import dynamic from 'next/dynamic'
import type { GewaesserUebersicht } from '@/lib/uebersicht/laden'

// Leaflet greift auf `window` zu, daher darf die Karte nicht serverseitig
// gerendert werden. `ssr: false` ist in Server Components seit Next.js 16
// nicht mehr erlaubt — deshalb der dynamische Import in dieser eigenen
// Client Component statt direkt in src/app/page.tsx.
const Karte = dynamic(() => import('./Karte').then((m) => m.Karte), {
  ssr: false,
  loading: () => <div className="h-52 animate-pulse bg-muted" />,
})

export function KarteClient({
  gewaesser,
  fisch,
}: {
  gewaesser: GewaesserUebersicht[]
  fisch: string
}) {
  return <Karte gewaesser={gewaesser} fisch={fisch} />
}
