import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { ladeUebersicht } from '@/lib/uebersicht/laden'
import { FISCHE, type Fisch } from '@/lib/beissindex'
import { ZielfischUmschalter } from '@/components/ZielfischUmschalter'
import { GewaesserZeile } from '@/components/GewaesserZeile'
import { NurWoIchDarf } from '@/components/NurWoIchDarf'
import { KarteClient } from '@/components/KarteClient'

export default async function Startseite({
  searchParams,
}: {
  searchParams: Promise<{ fisch?: string; alle?: string }>
}) {
  const sitzung = await auth()
  if (!sitzung?.user?.id) redirect('/anmelden')

  const params = await searchParams
  const fisch = (FISCHE.includes(params.fisch as Fisch) ? params.fisch : 'hecht') as Fisch

  const alle = await ladeUebersicht(sitzung.user.id, fisch, new Date())

  // Abweichung vom Brief: Der Filter "nur wo ich darf" ist nur dann
  // vorbelegt an, wenn der Nutzer mindestens eine Vereinsmitgliedschaft oder
  // eine gültige Tageskarte hat. Sonst wären beim ersten Start (Testkonto
  // ohne Mitgliedschaft) alle zwölf Gewässer weggefiltert und die App sähe
  // leer aus — wie ein Fehler, nicht wie ein Filter. Umschalten bleibt
  // jederzeit möglich; `alle=1`/`alle=0` in der URL merkt sich die explizite
  // Wahl des Nutzers und übersteuert den Default.
  const hatZugang = alle.some((g) => g.zugang.art !== 'keine')
  const nurErlaubte = params.alle === '1' ? false : params.alle === '0' ? true : hatZugang

  const sichtbar = nurErlaubte ? alle.filter((g) => g.zugang.art !== 'keine') : alle

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 bg-card px-3 py-2 shadow-sm">
        <ZielfischUmschalter aktiv={fisch} />
      </header>

      <KarteClient gewaesser={sichtbar} fisch={fisch} />

      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs text-muted-foreground">{sichtbar.length} Gewässer</span>
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
