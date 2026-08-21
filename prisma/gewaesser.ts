export interface VereinSeed {
  slug: string
  name: string
}

export interface GewaesserSeed {
  slug: string
  name: string
  typ: 'RHEIN' | 'ALTRHEIN' | 'BAGGERSEE'
  lat: number
  lon: number
  referenzPegel: 'REES' | 'EMMERICH'
  verzoegerungTage: number
  daempfung: number
  abgeleitet: boolean
  /** UNBESTÄTIGT — von Hand kuratiert, in den Einstellungen korrigierbar (Spec §6) */
  vereine: string[]
}

export const VEREINE: VereinSeed[] = [
  { slug: 'asv-gut-bitt-wissel', name: 'ASV Gut Bitt Wissel e. V.' },
  { slug: 'asv-rees', name: 'ASV Rees' },
  { slug: 'tageskarte-frei', name: 'Nur mit Tageskarte' },
]

export const GEWAESSER: GewaesserSeed[] = [
  // ---- Rhein: echter Pegel, keine Ableitung ----
  {
    slug: 'rhein-grieth', name: 'Rhein bei Grieth', typ: 'RHEIN',
    lat: 51.7735, lon: 6.2905, referenzPegel: 'REES',
    verzoegerungTage: 0, daempfung: 1, abgeleitet: false,
    vereine: ['tageskarte-frei'],
  },
  {
    slug: 'rhein-rees', name: 'Rhein bei Rees', typ: 'RHEIN',
    lat: 51.7614, lon: 6.3969, referenzPegel: 'REES',
    verzoegerungTage: 0, daempfung: 1, abgeleitet: false,
    vereine: ['asv-rees', 'tageskarte-frei'],
  },
  {
    slug: 'rhein-griethausen', name: 'Rhein bei Griethausen', typ: 'RHEIN',
    lat: 51.8213, lon: 6.1522, referenzPegel: 'EMMERICH',
    verzoegerungTage: 0, daempfung: 1, abgeleitet: false,
    vereine: ['tageskarte-frei'],
  },

  // ---- Altrheine: schnelle, starke Kopplung ----
  {
    slug: 'reeser-altrhein', name: 'Reeser Altrhein', typ: 'ALTRHEIN',
    lat: 51.7549, lon: 6.3806, referenzPegel: 'REES',
    verzoegerungTage: 1, daempfung: 0.7, abgeleitet: true,
    vereine: ['asv-rees'],
  },
  {
    slug: 'grietherorter-altrhein', name: 'Grietherorter Altrhein', typ: 'ALTRHEIN',
    lat: 51.7887, lon: 6.3244, referenzPegel: 'REES',
    verzoegerungTage: 1, daempfung: 0.7, abgeleitet: true,
    vereine: ['asv-rees'],
  },
  {
    slug: 'bienener-altrhein', name: 'Bienener Altrhein', typ: 'ALTRHEIN',
    lat: 51.7817, lon: 6.4498, referenzPegel: 'REES',
    verzoegerungTage: 1, daempfung: 0.5, abgeleitet: true,
    vereine: ['asv-rees'],
  },
  {
    slug: 'griethausener-altrhein', name: 'Griethausener Altrhein', typ: 'ALTRHEIN',
    lat: 51.8156, lon: 6.1361, referenzPegel: 'EMMERICH',
    verzoegerungTage: 1, daempfung: 0.5, abgeleitet: true,
    vereine: ['asv-gut-bitt-wissel'],
  },

  // ---- Baggerseen: träge ----
  {
    slug: 'wisseler-see', name: 'Wisseler See', typ: 'BAGGERSEE',
    lat: 51.7639, lon: 6.2472, referenzPegel: 'REES',
    verzoegerungTage: 3, daempfung: 0.2, abgeleitet: true,
    vereine: ['asv-gut-bitt-wissel'],
  },
  {
    slug: 'reeser-meer', name: 'Reeser Meer', typ: 'BAGGERSEE',
    lat: 51.7458, lon: 6.4147, referenzPegel: 'REES',
    verzoegerungTage: 3, daempfung: 0.2, abgeleitet: true,
    vereine: ['asv-rees'],
  },
  {
    slug: 'mahnensee', name: 'Mahnensee', typ: 'BAGGERSEE',
    lat: 51.7392, lon: 6.4022, referenzPegel: 'REES',
    verzoegerungTage: 3, daempfung: 0.2, abgeleitet: true,
    vereine: ['asv-rees'],
  },
  {
    slug: 'grindsee', name: 'Grindsee', typ: 'BAGGERSEE',
    lat: 51.7521, lon: 6.4310, referenzPegel: 'REES',
    verzoegerungTage: 3, daempfung: 0.2, abgeleitet: true,
    vereine: ['asv-rees'],
  },
  {
    slug: 'roosenhofsee', name: 'Roosenhofsee', typ: 'BAGGERSEE',
    lat: 51.7686, lon: 6.4411, referenzPegel: 'REES',
    verzoegerungTage: 4, daempfung: 0.15, abgeleitet: true,
    vereine: ['asv-rees'],
  },
]
