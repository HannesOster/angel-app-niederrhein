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
          {g.quelle}
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
