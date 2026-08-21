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
