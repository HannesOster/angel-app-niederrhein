import type { AngewandteRegel, Bedingungen, Fisch } from './typen'
import { begrenze, truebungAus } from './hilfen'
import { tagesphase } from './faktoren'

/** Ab dieser Trübung beißt der Zander auch tagsüber (Spec §5.5) */
const TRUEBUNG_SCHWELLE = 0.6
/** Wert, auf den die Tageszeit für den Zander dann angehoben wird */
const TAGESZEIT_ANHEBUNG = 0.5

/** Ab dieser Pegeländerung greift die Bremse (Spec §5.5) */
const BREMS_SCHWELLE_CM = 30
/** Stärkste mögliche Bremsung */
const BREMS_MINIMUM = 0.5

export function pruefeTruebungsRegel(
  b: Bedingungen,
  fisch: Fisch,
): { tageszeitUeberschreibung?: number; regel?: AngewandteRegel } {
  if (fisch !== 'zander') return {}
  // Non-finite values (NaN, Infinity) would propagate silently into the index
  // and appear in the UI. Treat them the same as null.
  if (
    b.pegelNiveauRelativ === null ||
    b.pegelAenderung24hCm === null ||
    !Number.isFinite(b.pegelNiveauRelativ) ||
    !Number.isFinite(b.pegelAenderung24hCm)
  ) {
    return {}
  }

  const t = truebungAus(b.pegelAenderung24hCm, b.pegelNiveauRelativ)
  if (t < TRUEBUNG_SCHWELLE) return {}

  const phase = tagesphase(b.zeit, b.sonnenaufgang, b.sonnenuntergang)
  if (phase !== 'tag') return {}

  return {
    tageszeitUeberschreibung: TAGESZEIT_ANHEBUNG,
    regel: {
      name: 'truebungsRegel',
      text: 'Wasser stark getrübt — Zander beißt heute auch am Tag.',
    },
  }
}

export function pruefeAenderungsBremse(
  b: Bedingungen,
): { faktor: number; regel?: AngewandteRegel } {
  // Non-finite values (NaN, Infinity) would propagate silently into Math.abs()
  // and through begrenze(), producing NaN in the UI. Treat as null.
  if (b.pegelAenderung24hCm === null || !Number.isFinite(b.pegelAenderung24hCm)) {
    return { faktor: 1 }
  }

  const betrag = Math.abs(b.pegelAenderung24hCm)
  if (betrag <= BREMS_SCHWELLE_CM) return { faktor: 1 }

  const faktor = begrenze(1 - (betrag - BREMS_SCHWELLE_CM) / 100, BREMS_MINIMUM, 1)
  const richtung = b.pegelAenderung24hCm > 0 ? 'steigt' : 'fällt'
  const vorzeichen = b.pegelAenderung24hCm > 0 ? '+' : '−'

  return {
    faktor,
    regel: {
      name: 'aenderungsBremse',
      text: `Pegel ${richtung} schnell (${vorzeichen}${Math.round(betrag)} cm/Tag) — Fische stehen um.`,
    },
  }
}
