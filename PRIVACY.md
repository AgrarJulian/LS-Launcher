# Datenschutzbestimmungen – LS25 Launcher

Stand: 2. November 2026

Der LS25 Launcher ist ein freies Open-Source-Projekt (MIT-Lizenz) und ein inoffizielles Community-Werkzeug. Er steht in keiner Verbindung mit der GIANTS Software GmbH.

## Kurzfassung

**Der LS25 Launcher erhebt, speichert und übermittelt keine personenbezogenen Daten an den Entwickler oder an Dritte.** Es gibt keine Konten, kein Tracking, keine Telemetrie, keine Werbung und keine Absturzberichte.

## Lokal gespeicherte Daten

Alle Daten bleiben auf deinem Computer. Der Launcher speichert lediglich seine Einstellungen in einer Konfigurationsdatei im Anwendungsdaten-Ordner deines Benutzerkontos (`%APPDATA%\ls25-launcher\config.json`):

- Pfade zur Spiel-Installation, zum Profil-Ordner und zum Backup-Ordner
- Hof-Profile (Name, Hofname, Notizen, Startoptionen)
- Eigene Server-Einträge (Name, Host, Port, optionale Statistik-Adresse) für die Statusprüfung
- Einstellungen der Hof-Profile, inkl. Mod-Ordner und zugeordnetem Savegame
- Launcher-Einstellungen

Backups deiner Spielstände werden als ZIP-Dateien in dem Ordner abgelegt, den du in den Einstellungen festlegst. Du kannst alle Daten jederzeit löschen, indem du die genannte Konfigurationsdatei und den Backup-Ordner entfernst.

## Zugriff auf Dateien

Der Launcher liest und verändert nur Dateien, die für seine Funktionen nötig sind: die `gameSettings.xml` (Mod-Ordner-Eintrag; vorher wird eine Kopie `gameSettings.xml.ls25launcher.bak` angelegt), den Mod-Ordner (Mods werden zum Deaktivieren in `.bak` umbenannt), die Savegame-Ordner, die Log-Datei und den Shader-Cache im konfigurierten Profil-Ordner sowie den Backup-Ordner. Gelöschte Mods und Backups werden in den Papierkorb verschoben.

## Netzwerkverbindungen

Der Launcher verbindet sich nur dann mit dem Internet, wenn du die jeweilige Funktion benutzt:

- **Server Status:** per HTTPS mit `www.giants-software.com` und `www.farming-simulator.com`, um deren Erreichbarkeit zu messen.
- **Eigene Server:** Für Server, die du selbst einträgst, wird der Spielport per TCP geprüft und, falls du eine Statistik-Adresse angegeben hast, diese Adresse per HTTP(S) abgerufen (Spieleranzahl, Map, Spielernamen). Die Adresse kann einen Zugangscode enthalten; sie wird nur lokal in deiner Konfigurationsdatei gespeichert.
- **ModHub-Prüfung:** Beim Klick auf „ModHub prüfen“ werden die Titel deiner installierten Mods an `www.farming-simulator.com` gesendet, um nach neueren Versionen zu suchen. Es werden keine Dateien hochgeladen.

Dabei werden keine weiteren Daten über dich oder deinen Computer gesendet. Wie bei jeder Internetverbindung sehen die angefragten Server deine IP-Adresse; für deren Verarbeitung gelten die Datenschutzbestimmungen der jeweiligen Betreiber.

Links zu GitHub werden nur geöffnet, wenn du sie anklickst, und in deinem Standardbrowser angezeigt.

## Weitergabe an Dritte

Es findet keine Weitergabe von Daten statt.

## Deine Rechte

Da der Launcher keine Daten über dich erhebt, die der Entwickler einsehen könnte, gibt es keine Daten, die auf Anfrage ausgekunftet oder gelöscht werden müssten. Alle lokalen Daten kannst du selbst einsehen und löschen.

## Änderungen

Änderungen dieser Datenschutzbestimmungen werden in diesem Repository veröffentlicht: <https://github.com/AgrarJulian/LS-Launcher>

## Kontakt

Fragen und Feedback: <https://github.com/AgrarJulian/LS-Launcher/issues>
