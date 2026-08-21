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
