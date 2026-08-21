import {
  FAKTOR_KEYS,
  FAKTOR_LABEL,
  type AngewandteRegel,
  type Bedingungen,
  type Beitrag,
  type Fisch,
  type Gewichte,
  type IndexErgebnis,
} from './typen'
import { STANDARD_GEWICHTE } from './gewichte'
import { berechneFaktor } from './faktoren'
import { pruefeAenderungsBremse, pruefeTruebungsRegel } from './regeln'
import { begrenze } from './hilfen'

/** Ab diesem Datenalter gibt es keinen Wert mehr, sondern „unsicher" (Spec §4.6) */
export const DATEN_MAX_ALTER_MINUTEN = 360

export function berechneIndex(
  b: Bedingungen,
  fisch: Fisch,
  gewichte: Gewichte = STANDARD_GEWICHTE[fisch],
): IndexErgebnis {
  const regeln: AngewandteRegel[] = []

  if (b.datenAlterMinuten > DATEN_MAX_ALTER_MINUTEN) {
    return {
      wert: null,
      unsicher: true,
      unsicherGrund: `Daten sind ${Math.round(b.datenAlterMinuten / 60)} Stunden alt`,
      beitraege: [],
      regeln,
    }
  }

  const truebungsRegel = pruefeTruebungsRegel(b, fisch)
  if (truebungsRegel.regel) regeln.push(truebungsRegel.regel)

  const beitraege: Beitrag[] = []
  let summe = 0
  let maxSumme = 0

  for (const key of FAKTOR_KEYS) {
    const gewicht = gewichte[key]
    const ueberschreibung =
      key === 'tageszeit' ? truebungsRegel.tageszeitUeberschreibung : undefined
    const { roh, text } = berechneFaktor(key, b, fisch, ueberschreibung)

    // Ein nicht-endlicher Rohwert (z. B. NaN aus einer kaputten Eingabe wie
    // luftdruckHpa) ist weder null noch in [-1, 1] — würde er ungeprüft in
    // die Summe wandern, zerstört er still den gesamten Index (NaN * Gewicht
    // = NaN, NaN propagiert durch summe/maxSumme). Deshalb hier wie
    // fehlende Daten behandeln: der Faktor fällt aus der Rechnung heraus.
    if (roh === null || !Number.isFinite(roh)) {
      beitraege.push({
        key,
        label: FAKTOR_LABEL[key],
        roh: 0,
        gewicht,
        beitrag: 0,
        text: roh === null ? text : `${text} (unbrauchbarer Wert, ausgeschlossen)`,
        fehlend: true,
      })
      continue
    }

    const beitrag = roh * gewicht
    summe += beitrag
    maxSumme += gewicht

    beitraege.push({
      key,
      label: FAKTOR_LABEL[key],
      roh,
      gewicht,
      beitrag,
      text,
      fehlend: false,
    })
  }

  // Ohne gewichtete Faktoren gibt es nichts zu sagen.
  if (maxSumme === 0) {
    return {
      wert: null,
      unsicher: true,
      unsicherGrund: 'Alle Faktoren sind abgeschaltet oder ohne Daten',
      beitraege,
      regeln,
    }
  }

  const normiert = begrenze(summe / maxSumme, -1, 1)
  let wert = ((normiert + 1) / 2) * 10

  const bremse = pruefeAenderungsBremse(b)
  if (bremse.regel) regeln.push(bremse.regel)
  wert *= bremse.faktor

  return {
    wert: Math.round(begrenze(wert, 0, 10) * 10) / 10,
    unsicher: false,
    unsicherGrund: null,
    beitraege,
    regeln,
  }
}
