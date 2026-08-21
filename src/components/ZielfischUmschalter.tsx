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
