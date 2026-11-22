# Datenschutzbestimmungen – Agri Nexus

Stand: 22. November 2026

Agri Nexus ist ein inoffizielles Open-Source-Community-Werkzeug und steht in keiner Verbindung zur GIANTS Software GmbH.

## Lokal gespeicherte Daten

Einstellungen und Hof-Profile werden lokal im Anwendungsdatenordner gespeichert. Dazu gehören Pfade, Profilnamen, Notizen, Startoptionen, Mod-Zuweisungen und ausgewählte Savegames. Backups und Screenshots bleiben in den von dir festgelegten lokalen Ordnern.

Agri Nexus liest und verändert für seine Funktionen `gameSettings.xml`, Mods, Savegames, Spiel-Logs und Shader-Caches. Vor Änderungen an `gameSettings.xml` legt es eine Sicherungskopie an.
Savegame-Werte können im Live-&-Werkstatt-Tab bearbeitet werden. Vorher wird der komplette Slot als ZIP gesichert. Controller- und Grafik-Snapshots sowie Screenshot-Kontextdateien werden lokal gespeichert.

## Netzwerkverbindungen

- Server- und ModHub-Prüfungen rufen die jeweiligen GIANTS- bzw. Farming Simulator-Dienste auf. Für die ModHub-Suche werden Mod-Titel und Versionen gesendet.
- P2P-Sitzungen und RP-Lobbys verwenden PeerJS zur WebRTC-Signalisierung. Signalisierungsserver und Verbindungspartner können Verbindungsmetadaten und IP-Adressen sehen. Teilnehmer teilen in der Lobby ihren Spielernamen, Farm-/Aufgabenstatus und die vom Host gesetzten Serverdaten. Ausgewählte Mods sowie beim Profiltransfer das aktive Profil und zugeordnete Savegame werden direkt zwischen den Geräten übertragen.
- Im RP-Tab werden virtuelle Kontostände, Arbeitszeiten, Hof-/Maschinenangebote, Lieferscheine, Feldnotizen und Event-Anmeldungen zwischen den Lobbygeräten geteilt. Eine vom Admin eingetragene HTTPS-Quelle für `careerSavegame.xml` wird minütlich abgefragt, solange die RP-Ansicht geöffnet ist; die Antwort wird lokal unter dem Profilordner im Unterordner `agri-nexus-admin` abgelegt.
- Discord Rich Presence sendet den Spielstatus, den aktiven Profilnamen und die Anzahl der aktiven Mods an Discord, wenn Discord läuft und die RPC-Verbindung verfügbar ist.
- Der optionale Live-Begleiter startet nur auf Anforderung einen HTTP-Server im lokalen Netzwerk. Geräte mit dem zufälligen Link können Profil- und Savegame-Informationen sehen. Ein kompatibles Telemetrie-Mod kann zusätzliche JSON-Werte an den angezeigten `/api/telemetry`-Endpunkt senden; diese Werte bleiben nur bis zum Beenden des Launchers im Arbeitsspeicher.

Es gibt keine Launcher-Konten, Werbung oder automatische Übermittlung eigener Telemetrie. Der optionale Companion nimmt Telemetrie ausschließlich lokal entgegen. Netzwerkdienste Dritter verarbeiten Verbindungen gemäß ihren eigenen Datenschutzbestimmungen.

## Kontakt

Quellcode und Feedback: <https://github.com/AgrarJulian/LS-Launcher>
