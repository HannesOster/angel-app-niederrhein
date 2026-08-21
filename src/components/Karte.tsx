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
                {g.unsicher || g.jetztWert === null
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
