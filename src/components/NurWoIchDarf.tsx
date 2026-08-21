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
    // Immer explizit setzen (nie löschen), sonst fällt der Zustand nach dem
    // Umschalten wieder auf den Default zurück statt beim gewählten Wert zu bleiben.
    neu.set('alle', an ? '0' : '1')
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
