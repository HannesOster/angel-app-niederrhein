export type IndexStufe = 'gruen' | 'gelb' | 'rot' | 'grau'

export const INDEX_HEX: Record<IndexStufe, string> = {
  gruen: '#3ddc84',
  gelb: '#f5c542',
  rot: '#f2564b',
  grau: '#6c6c7a',
}

export function indexFarbe(wert: number | null): IndexStufe {
  if (wert === null) return 'grau'
  if (wert >= 7) return 'gruen'
  if (wert >= 4.5) return 'gelb'
  return 'rot'
}
