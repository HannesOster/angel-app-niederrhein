export type ZugangStatus =
  | { art: 'frei' }
  | { art: 'tageskarte'; bis: Date }
  | { art: 'keine' }

export function bestimmeZugang(
  gewaesserVereine: string[],
  mitgliedschaften: string[],
  tageskarten: { gewaesserId: string; bis: Date }[],
  gewaesserId: string,
  jetzt: Date,
): ZugangStatus {
  const mitglied = gewaesserVereine.some((v) => mitgliedschaften.includes(v))
  if (mitglied) return { art: 'frei' }

  const gueltige = tageskarten
    .filter((k) => k.gewaesserId === gewaesserId && k.bis.getTime() >= jetzt.getTime())
    .sort((a, b) => b.bis.getTime() - a.bis.getTime())

  if (gueltige.length > 0) return { art: 'tageskarte', bis: gueltige[0].bis }

  return { art: 'keine' }
}
