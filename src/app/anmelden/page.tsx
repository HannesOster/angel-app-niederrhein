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
