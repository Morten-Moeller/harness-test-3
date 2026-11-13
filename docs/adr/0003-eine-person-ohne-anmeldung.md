# 0003: Eine Person ohne Anmeldung, keine Identität und keine Besitzerprüfung

Status: accepted
Datum: 2026-11-13
Spec: docs/specs/0001-grundgeruest.md
Ersetzt Grundregeln: A5.1, A5.2, A2.5

## Kontext

Die App läuft auf dem Rechner einer Person (ADR 0004). Die Grundregeln A5.1 (Rollen aus der
geprüften Identität), A5.2 (Besitzerprüfung im selben Statement) und A2.5 (fremde Ressource
antwortet wie fehlend) setzen eine Identität und mehrere Besitzer voraus. Authentifizierung ist
high risk und braucht Konten oder einen Provider.

## Optionen

### Option A: Keine Anmeldung, ein Besitzer

- Vorteile: kein Konto, kein Passwort, kein Sitzungs-Cookie; keine Angriffsfläche durch Login;
  Welle 1 liefert den Kernfluss.
- Nachteile: die API ist für jeden erreichbar, der den Port erreicht; eine spätere Mehrbenutzer-
  Version braucht eine Spalte `owner_id` an jeder Tabelle und eine Migration.

### Option B: Lokale Konten mit E-Mail und Passwort

- Vorteile: mehrere Personen auf einer Instanz.
- Nachteile: Passwort-Hashing, Sitzungen, Registrierung, Passwort-Reset; nicht gefordert.

### Option C: Externer Identity Provider (OIDC)

- Vorteile: keine Passwörter im System.
- Nachteile: ein Provider muss laufen; für eine lokale Ein-Personen-App ohne Nutzen.

## Entscheidung

Option A. Das Backend prüft keine Identität. Tabellen haben keine Besitzerspalte. Jede Ressource
gehört der einen Person; 404 steht nur für eine fehlende Ressource. Das Backend lauscht nur auf
`127.0.0.1` beziehungsweise im Compose-Netz; der Frontend-Container leitet `/api` weiter.

## Folgen

- A5.1, A5.2 und A2.5 gelten nicht, bis ein ADR eine Anmeldung einführt. A5.3 (fehlende
  Besitzerdaten sind nie Administratorrechte) und A5.4 (Geheimnisse aus der Umgebung) gelten
  weiter.
- `project-rules/backend.md`: Abschnitt Authentifizierung nennt dieses ADR.
- Eine spätere Spec für Anmeldung ersetzt dieses ADR und fügt `owner_id` per Migration hinzu.
