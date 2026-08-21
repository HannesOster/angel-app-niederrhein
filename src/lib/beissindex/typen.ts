export type Fisch = 'hecht' | 'zander' | 'aal' | 'karpfen'

export const FISCHE: readonly Fisch[] = ['hecht', 'zander', 'aal', 'karpfen'] as const

export type FaktorKey =
  | 'luftdruckTrend'
  | 'pegelNiveau'
  | 'truebung'
  | 'wassertemperatur'
  | 'licht'
  | 'tageszeit'
  | 'wind'
  | 'solunar'

export const FAKTOR_KEYS: readonly FaktorKey[] = [
  'luftdruckTrend',
  'pegelNiveau',
  'truebung',
  'wassertemperatur',
  'licht',
  'tageszeit',
  'wind',
  'solunar',
] as const

export const FAKTOR_LABEL: Record<FaktorKey, string> = {
  luftdruckTrend: 'Luftdruck-Trend',
  pegelNiveau: 'Pegel-Niveau',
  truebung: 'Trübung',
  wassertemperatur: 'Wassertemperatur',
  licht: 'Licht und Bewölkung',
  tageszeit: 'Tageszeit',
  wind: 'Wind',
  solunar: 'Solunar',
}

/**
 * Alle Eingaben des Rechenkerns für EINE Stunde an EINEM Gewässer.
 * `null` bedeutet: Wert liegt nicht vor. Der zugehörige Faktor fällt dann
 * aus der Rechnung heraus, statt geraten zu werden.
 */
export interface Bedingungen {
  zeit: Date
  /** Luftdruck auf Meereshöhe in hPa */
  luftdruckHpa: number
  /** Änderung des Luftdrucks über die letzten 24 h in hPa (negativ = fallend) */
  luftdruckTrend24hHpa: number
  /** Pegel relativ zum Mittelwasser: -1 sehr niedrig, 0 mittel, +1 sehr hoch */
  pegelNiveauRelativ: number | null
  /** Pegeländerung über 24 h in cm (negativ = fallend) */
  pegelAenderung24hCm: number | null
  /** Wassertemperatur in °C, oder null wenn nicht gemessen */
  wassertemperaturC: number | null
  /** Bewölkungsgrad 0–100 */
  bewoelkungProzent: number
  /** Windgeschwindigkeit in km/h */
  windKmh: number
  sonnenaufgang: Date
  sonnenuntergang: Date
  /** Solunar-Stärke 0–1, aus dem Mondstand berechnet */
  solunarStaerke: number
  /** Alter der zugrunde liegenden Messdaten in Minuten */
  datenAlterMinuten: number
}

export interface Beitrag {
  key: FaktorKey
  label: string
  /** Rohwert des Faktors, -1 bis +1 */
  roh: number
  /** Gewicht des Faktors, 0 bis 3 */
  gewicht: number
  /** roh * gewicht */
  beitrag: number
  /** Klartext für die Detailansicht, z. B. "Luftdruck fällt (−3,2 hPa/24 h)" */
  text: string
  /** true, wenn der Faktor mangels Daten nicht gerechnet werden konnte */
  fehlend: boolean
}

export interface AngewandteRegel {
  name: 'truebungsRegel' | 'aenderungsBremse'
  text: string
}

export interface IndexErgebnis {
  /** 0–10, oder null wenn die Daten zu alt sind */
  wert: number | null
  unsicher: boolean
  /** Grund, falls unsicher */
  unsicherGrund: string | null
  beitraege: Beitrag[]
  regeln: AngewandteRegel[]
}

export type Gewichte = Record<FaktorKey, number>
