# Angel-App Niederrhein — Design

**Datum:** 2026-08-21
**Beteiligte:** Daniel (Nutzer, Angler), Johannes (Entwicklung)
**Status:** Design abgestimmt, bereit für den Implementierungsplan

---

## 1. Zweck

Die App beantwortet eine Frage: **Wo und wann lohnt sich das Angeln in den
nächsten drei Tagen?**

Sie zeigt die Gewässer rund um Kalkar, Rees, Grieth, Griethausen und Kleve auf
einer Karte, färbt sie nach einem Beißindex für den gewählten Zielfisch und
begründet jede Bewertung. Dazu kommt ein Fangbuch, das die Bedingungen jedes
Fangs automatisch mitschreibt.

Sie ist ausdrücklich **kein** Pegelportal und **kein** Erlaubnisschein.

### Nicht-Ziele für Version 1

Push-Nachrichten, Fotos im Fangbuch, mehrere Nutzer, native App im Store,
automatische Kalibrierung der Gewichte aus dem Fangbuch, Gewässer außerhalb der
Region.

---

## 2. Nutzer und Zugang

Ein einziges Konto: `danielschoeber@mail.de`.

- Passwort ausschließlich als Hash in der Datenbank (argon2 oder bcrypt).
- Klartext-Passwort steht nur in der gitignorierten `.env`, um das Konto einmalig
  anzulegen. Es gehört **nicht** in den Code und **nicht** ins Repository.
- Dauerhafte Sitzung über Cookie.
- **Kein** „Passwort vergessen" per Mail. Zurücksetzen per Kommandozeile.
  Begründung: Mailversand ist aufwendiger als die gesamte Anmeldung und bringt
  bei einem Konto keinen Gegenwert.

Die Datenstruktur ist von Anfang an mehrbenutzerfähig (alle persönlichen Daten
hängen an einer Nutzer-ID), es ist nur zunächst ein Nutzer eingetragen.

---

## 3. Bausteine

| Baustein | Aufgabe |
|---|---|
| **Gewässer-Register** | Stammdaten: Name, Koordinaten, Typ, zugeordneter Pegel, Verzögerung, Dämpfung, Vereine |
| **Datenholer** | Fragt PEGELONLINE und Open-Meteo ab, schreibt Zeitreihen in die Datenbank |
| **Index-Rechner** | Reine Funktion: Bedingungen + Zielfisch + Gewichte → Zahl und Begründung |
| **Oberfläche** | Karte mit Rangliste, Detailseite, Fangbuch, Einstellungen |
| **Zugangs-Verwaltung** | Vereinsmitgliedschaften und Tageskarten, Filter „nur wo ich darf" |

Der Index-Rechner ist die **einzige** Stelle, die die Formel kennt. Er hat keine
Datenbank- und keine Netzabhängigkeit — dadurch ist er vollständig testbar und
austauschbar, ohne den Rest anzufassen.

---

## 4. Datenquellen

### 4.1 Pegel (Rhein)

- **PEGELONLINE** (WSV), frei, ohne Schlüssel.
- Stationen: **Rees** und **Emmerich**. Werte im 15-Minuten-Takt.
- Abruf alle 15 Minuten, Verlauf wird gespeichert.
- Abgeleitet: Änderungsrate in cm/24 h, Niveau relativ zum Mittelwasser.
- Jedes Rhein-Gewässer hängt am **nächstgelegenen** Pegel, nicht an einem
  Mittelwert.

### 4.2 Wetter

- **Open-Meteo**, frei, ohne Schlüssel.
- Stündlich, sieben Tage voraus, pro Gewässer-Koordinate.
- Felder: Luftdruck (+ Trend über 24 h), Bewölkung, Wind, Lufttemperatur,
  Niederschlag.

### 4.3 Mond / Solunar

Lokal berechnet aus Datum und Koordinate — Mondauf- und -untergang,
Mondhöchststand und -tiefststand. Daraus tägliche Haupt- und Nebenbeißzeiten.
Keine Schnittstelle, kein Ausfallrisiko.

### 4.4 Seen und Altrheine — abgeleitete Wasserstände

Baggerseen und Altrheine haben keinen eigenen Pegel. Sie sind laut Ortskenntnis
(von Daniel bestätigt) über das Grundwasser an den Rhein gekoppelt und folgen
ihm zeitversetzt und gedämpft.

Jedes solche Gewässer trägt drei Werte:

- `referenzPegel` — Rees oder Emmerich
- `verzoegerungTage` — wie viele Tage es hinterherhinkt
- `daempfung` — Faktor 0–1, wie viel der Rheinbewegung ankommt

Rechnung: Rheinstand von vor `verzoegerungTage` Tagen, multipliziert mit
`daempfung`.

**Zwingend:** Solche Werte werden in der Oberfläche **immer** als
*„geschätzt, abgeleitet von Pegel Rees"* beschriftet. Die App stellt einen
abgeleiteten Wert niemals als Messung dar.

### 4.5 Wassertemperatur

Am Rhein teilweise gemessen und dann verwendet. Für Seen **nicht verfügbar und
nicht geschätzt** — ein Baggersee erwärmt sich anders als ein Fluss. Stattdessen
geht dort die Lufttemperatur der letzten Tage in den Index ein, offen so benannt.

### 4.6 Ausfall und Veralterung

- Schnittstelle nicht erreichbar → letzter bekannter Wert **mit Zeitstempel**
  („Stand: vor 3 Stunden").
- Daten älter als **6 Stunden** → kein Index, sondern „unsicher".
- Kein Netz auf dem Handy → zuletzt geladener Stand aus dem lokalen Zwischen-
  speicher, deutlich als offline markiert.

Die App zeigt niemals alte Daten so, als wären sie aktuell.

---

## 5. Der Beißindex

### 5.1 Grundhaltung

Der Index ist **kodiertes Anglerwissen, keine Wissenschaft**. Manche Faktoren
sind gut belegt (Luftdruck, Wassertemperatur, Pegeldynamik), andere sind weich
(Mond). Deshalb gilt:

1. Jeder Beitrag ist einzeln sichtbar — die App begründet, statt zu orakeln.
2. Alle Gewichte sind vom Nutzer verstellbar (Einstellungen, pro Zielfisch).
3. Die Startwerte sind ein Vorschlag, keine Wahrheit.

### 5.2 Zielfische

**Hecht, Zander, Aal, Karpfen.** Vier deutlich verschiedene Wetterprofile.
Barsch bewusst weggelassen — er beißt nahezu immer und würde den Index
nivellieren. Nachrüstbar.

### 5.3 Faktoren

| Faktor | Hecht | Zander | Aal | Karpfen |
|---|---|---|---|---|
| Luftdruck-Trend | stark, fallend gut | mittel, fallend gut | mittel, fallend gut | stark, stabil hoch gut |
| **Pegel-Niveau (hoch & ruhig)** | schwach | stark | stark | schwach |
| Trübung | mittel, klarend gut | mittel, leicht trüb gut | stark, trüb gut | mittel, stabil gut |
| Wassertemperatur | 8–16 °C | 10–20 °C | über 12 °C | 18–24 °C |
| Licht / Bewölkung | mittel, bedeckt gut | stark, dunkel gut | schwach | mittel, Sonne gut |
| Tageszeit | mittel, Dämmerung | stark, Dämmerung/Nacht | stark, Nacht | schwach, früh/abends |
| Wind | mittel, mäßig gut | schwach, mäßig gut | aus | schwach, ruhig gut |
| Solunar / Mond | **stark** | **stark** | **stark** | mittel |

Der Mond ist auf Daniels ausdrücklichen Wunsch hoch gewichtet und als
Solunar-Modell umgesetzt.

**Trübung** wird nicht gemessen, sondern aus der Pegeldynamik abgeleitet:
steigendes Wasser trübt ein, fallendes klart auf. Sie ist damit ein
abgeleiteter Faktor und in der Begründung als solcher benannt.

**Die Pegel-Änderungsrate ist bewusst kein gewichteter Faktor**, sondern
ausschließlich die Bremse aus 5.5 — sonst würde derselbe Effekt zweimal in den
Wert einfließen.

### 5.4 Rechenweg

Jeder Faktor liefert einen Wert von −1 bis +1. Multiplikation mit dem Gewicht
des Zielfischs, Summe, Abbildung auf 0–10.

- Berechnung **stündlich für 7 Tage**.
- Der Tageswert ist die **beste Stunde des Tages**, nicht der Durchschnitt.
  Begründung: Beim Aal wäre ein Mittelwert immer mittelmäßig, obwohl nachts
  alles passiert.
- Rückgabe ist immer Zahl **plus** Liste der Einzelbeiträge.

### 5.5 Wechselwirkungen — genau zwei

Die Summe ist das Grundgerüst. Erlaubt sind zwei benannte Ausnahmen, die in der
Begründung namentlich erscheinen:

1. **Trübungs-Regel (Zander).** Bei starker Trübung durch Hochwasser verschiebt
   sich das Zeitfenster des Zanders in den Tag hinein.
   Anzeige: *„Wasser stark getrübt — Zander beißt heute auch am Tag."*
2. **Änderungsraten-Bremse (alle).** Ändert sich der Pegel um mehr als etwa
   30 cm pro Tag, sinkt der Index für alle Arten — unabhängig von der Richtung.
   Anzeige: *„Pegel fällt schnell (−60 cm/Tag) — Fische stehen um."*

Mehr Sonderregeln werden nicht aufgenommen. Ab einer Handvoll versteht niemand
mehr, was die App tut.

**Recherche-Grundlage:** Die Quellen sind sich einig, dass nicht die Richtung
der Pegeländerung entscheidet, sondern deren Geschwindigkeit. Hohes, ruhiges,
trübes Wasser gilt für Zander, Aal und Wels als sehr gut; schnell steigendes
Wasser für alle als schlecht.

---

## 6. Zugang: Vereine und Tageskarten

**Vereine.** In den Einstellungen kreuzt Daniel seine Mitgliedschaften an. Jedes
Gewässer trägt die Vereine, die dort Fischereirecht haben.

**Tageskarten.** Über die Detailseite eines Gewässers eintragbar, mit Datum oder
Zeitraum. Läuft automatisch ab.

**Drei Zustände pro Gewässer:** `frei` (über Mitgliedschaft) ·
`tageskarte bis TT.MM.` · `keine erlaubnis` (ausgegraut).

**Filter „nur zeigen, wo ich darf"** über der Rangliste, standardmäßig **an**.
Sonst könnte ein Gewässer auf Platz 1 stehen, an dem Daniel nicht sitzen darf.
Abschaltbar, um zu sehen, wo es sich lohnen *würde*.

**Zwei Einschränkungen, ausdrücklich festgehalten:**

1. Die Zuordnung Verein → Gewässer ist **nirgends maschinenlesbar**. Sie wird
   einmalig von Hand kuratiert und muss in den Einstellungen änderbar sein.
2. Die App ist ein **Merkzettel, kein Erlaubnisschein**. Ein entsprechender
   Hinweis steht klein, aber sichtbar in den Einstellungen. Eine App, die
   fälschlich „du darfst" sagt, wäre schlimmer als keine App.

---

## 7. Oberfläche

Handy zuerst, als installierbare Web-App (Startbildschirm-Symbol, Vollbild).

### 7.1 Hauptbildschirm (Entwurf B)

- Oben: Umschalter für den Zielfisch (Hecht / Zander / Aal / Karpfen)
- Darunter: Karte (Leaflet, OpenStreetMap-Kacheln) mit farbigen Punkten
  — grün gut, gelb mittel, rot schlecht
- Darunter: Rangliste aller erlaubten Gewässer, sortiert nach Index, je mit
  drei Balken für die nächsten drei Tage
- Filter-Schalter „nur wo ich darf"

### 7.2 Detailseite (Entwurf B)

- Großer Indexwert, dazu die beste Zeit des Tages
- **Beitrag jedes Faktors** (+2,4 / −1,1 …) — sichtbar, aber nicht bedienbar
- Aktive Wechselwirkungen im Klartext
- Pegelkurve der letzten sieben Tage
- Knöpfe: „Fang eintragen", „Tageskarte eintragen"

### 7.3 Einstellungen

- Regler für die Gewichte, **pro Zielfisch**
- Vereinsmitgliedschaften
- Verzögerung und Dämpfung je Gewässer
- Hinweis zum Erlaubnisschein

Bewusst getrennt: Die Regler liegen in den Einstellungen, nicht auf der
Detailseite — sonst wird der alltägliche Blick zu unruhig.

### 7.4 Gestaltung

shadcn/ui mit **eigenem tweakcn-Theme** in Wasser-, Kies- und Grüntönen. Nicht
das Standard-Neutral.

---

## 8. Fangbuch

**Eingabe:** Gewässer, Fischart, Uhrzeit. Optional Länge, Köder, Notiz.

**Automatisch mitgeschrieben:** Pegel und Trend, Luftdruck, Wetter,
Solunar-Fenster, Indexwert und **jeder einzelne Faktor-Beitrag**.

**Zwingend:** Dieser Schnappschuss wird als **eigene Kopie** gespeichert, nicht
als Verweis auf die aktuelle Formel. Sonst würde jede spätere Regler-Änderung
die Vergangenheit rückwirkend umschreiben — und genau diese Historie ist die
Grundlage dafür, dass die App später Daniels eigene Gewichtung lernen kann.

---

## 9. Technik

- **Next.js**, TypeScript
- **shadcn/ui** + eigenes tweakcn-Theme
- **PostgreSQL**
- **Auth.js**, Anmeldung per Passwort
- **Leaflet** + OpenStreetMap-Kacheln (kein Schlüssel, keine Kosten)
- Installierbare Web-App mit lokalem Zwischenspeicher für den Offline-Fall
- Deploy über **Coolify**
- Hintergrundjob: Pegel alle 15 Minuten, Wetter alle 30 Minuten

---

## 10. Testen

Der Index-Rechner ist eine reine Funktion und wird mit festgeschriebenen
Beispielfällen geprüft:

- Hochwasser, stark getrübt, Zander, 13 Uhr → muss trotz Tageslicht gut sein
  (Trübungs-Regel greift)
- Pegel fällt 60 cm/Tag → muss für alle Arten schlecht sein (Bremse greift)
- Aal, 3 Uhr nachts, warm, hohes ruhiges Wasser → muss Spitzenwert liefern
- Karpfen, 3 Uhr nachts → muss schlecht sein
- Daten 8 Stunden alt → kein Wert, sondern „unsicher"
- Mondgewicht auf 0 → Ergebnis darf sich mit der Mondphase nicht mehr ändern

Der Datenholer wird gegen **aufgezeichnete Antworten** getestet, nicht gegen die
echten Server. Begründung: Fehler im Index stürzen nicht ab, sie sehen nur falsch
aus — das ist die teuerste Fehlerart in diesem Projekt.

---

## 11. Gewässer (Vorschlag, von Daniel noch zu bestätigen)

Verzögerung und Dämpfung sind **geschätzt** und werden im Betrieb korrigiert.

### Am Rhein — echter Pegel

| Gewässer | Pegel |
|---|---|
| Rhein bei Grieth | Rees |
| Rhein bei Rees | Rees |
| Rhein bei Griethausen / Emmerich | Emmerich |

### Altrheine — schnelle, starke Kopplung

| Gewässer | Pegel | Verzögerung | Dämpfung |
|---|---|---|---|
| Reeser Altrhein | Rees | 0–1 Tag | hoch |
| Grietherorter Altrhein (Grietherbusch) | Rees | 0–1 Tag | hoch |
| Bienener Altrhein (Bienen) | Rees | ~1 Tag | mittel |
| Griethausener Altrhein | Emmerich | ~1 Tag | mittel |

### Baggerseen — träge

| Gewässer | Pegel | Verzögerung | Dämpfung |
|---|---|---|---|
| Wisseler See (Kalkar-Wissel) | Rees | 2–4 Tage | gering |
| Reeser Meer | Rees | 2–4 Tage | gering |
| Mahnensee (Rees) | Rees | 2–4 Tage | gering |
| Grindsee (Rees) | Rees | 2–4 Tage | gering |
| Roosenhofsee (Rees) | Rees | 2–4 Tage | gering |

### Zurückgestellt

**Niers (Goch)** hängt nicht am Rhein, sondern ist ein eigener Fluss mit eigenem
Pegel beim Land NRW. Ob dieser frei abrufbar ist, ist ungeklärt — erst aufnehmen,
wenn die Daten gesichert sind. **Kermisdahl und Spoykanal (Kleve)** sind
gestaut; der Rheinpegel sagt dort wenig aus.

---

## 12. Offene Punkte

1. **Gewässerliste bestätigen** — an welchen darf Daniel tatsächlich? Gewässer
   ohne Erlaubnis fliegen raus statt als Deko zu bleiben.
2. **Vereinszuordnung kuratieren** — von Hand aus den Vereinsseiten,
   anschließend von Daniel geprüft.
3. **Pegel-Vorhersage prüfen** — gibt es eine frei abrufbare Vorhersage für den
   Rhein? Falls nein: Trend fortschreiben und **als Schätzung beschriften**.
   Für Seen mit Tagen Verzögerung ohnehin ausreichend genau.
4. **Niers-Pegel prüfen** (siehe oben).
5. **Startwerte für Verzögerung und Dämpfung** je See von Daniel grob schätzen
   lassen.

---

## 13. Ausblick (nicht Version 1)

- Gewichte automatisch aus dem Fangbuch nachjustieren. Braucht mindestens eine
  Saison Daten — vorher wäre es Statistik-Theater.
- Weitere Nutzer freischalten (Struktur ist vorbereitet).
- Push-Nachricht bei besonders guten Bedingungen.
- Fotos im Fangbuch.
