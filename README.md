<div align="center">

<img src="assets/icon.png" alt="Agri Nexus Logo" width="110" />

# Agri Nexus v1.0.0-beta

**Freies Open-Source-Verwaltungstool, Mod-Manager und Companion für den Landwirtschafts-Simulator 25.**

![Downloads](https://img.shields.io/github/downloads/AgrarJulian/LS-Launcher/total?style=for-the-badge&color=84cc16)
![Release](https://img.shields.io/github/v/release/AgrarJulian/LS-Launcher?include_prereleases&style=for-the-badge&color=65a30d)
![License](https://img.shields.io/github/license/AgrarJulian/LS-Launcher?style=for-the-badge&color=3f6212)
![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-blue?style=for-the-badge)

</div>

---

## 📥 Download & Installation

1. Lade die neueste Version (`Agri-Nexus-1.0.0-beta-x64.exe`) unter **[Releases](https://github.com/AgrarJulian/LS-Launcher/releases)** herunter.
2. Starte die `.exe`-Datei (portable Version – keine Installation erforderlich).
3. Wähle in den **Einstellungen** deinen LS25-Spielpfad sowie deinen gewünschten Mod-Ordner aus.

> **Hinweis zu Windows SmartScreen:** Da die `.exe` aktuell nicht digital signiert ist, zeigt Windows beim ersten Start eventuell eine Schutzmeldung an. Klicke dort einfach auf **„Weitere Informationen“** und anschließend auf **„Trotzdem ausführen“**.

---

## ✨ Funktionen

### 🚀 Launcher & Profile
- **Starten:** Direkter Spielstart mit aktivem Profil und Schnelleinstellungen (*Dev Mode*, *Shader Cache leeren*, *Intro überspringen*, *Auto-Backup vor dem Start*).
- **Hof-Profile:** Eigener Mod-Ordner pro Profil (wird automatisch in die `gameSettings.xml` eingetragen), fest zugeordnetes Savegame, individuelle Mod-Auswahl und Startoptionen.
- **Discord Rich Presence:** Zeigt live auf Discord dein aktives Hof-Profil, den Spielstatus und die Anzahl geladener Mods an.

### 📦 Mods & Assets
- **Mod-Regal:** Übersicht mit Icon, Name, Version, Modder und Fehlerstatus je Mod (Ordner wird direkt aus der `gameSettings.xml` gelesen).
- **P2P-Mod-Sync:** Synchronisiere private `.zip`-Mods direkt per Raumcode inklusive SHA-256-Abgleich und Fortschrittsanzeige (einzeln oder alle fehlenden Mods auf einmal).
- **Analyse & Verwaltung:** Konflikt-Checker (Skript-Überschneidungen & Duplikate), Speicherübersicht mit Warnung bei übergroßen Dateien, ModHub-Versionsabgleich *(experimentell)*, Drag-&-Drop-Installer für `.zip`-Dateien sowie 1-Klick-Deaktivierung per `.bak`.

### 💾 Saves, Backups & Werkzeuge
- **Saves & Backups:** Manuelle und automatische Spielstand-Sicherungen mit Zeitstempel, 1-Klick-Wiederherstellung (inkl. Sicherheitskopie) sowie einem **Savegame-Editor** für numerische XML-Werte mit Vorher-Backup und Strukturdiagnose.
- **Live & Werkstatt:** Lokale WLAN-Companion-Webseite mit Live-Savegame-/Hofdaten und optionalem Telemetrie-POST-Endpunkt. Dazu Dev-Makro-Deck, Controllerbelegungs-Snapshots, benannte Grafik-Presets (`gameSettings.xml`), Mod-Bloat-Scanner, Ladezeit-Analyse (`log.txt`) und Modpack-Manifest-Export.
- **Log-Analyse:** Liest die `log.txt` (optional live), übersetzt Fehler und Warnungen verständlich und ordnet sie direkt den verursachenden Mods zu.
- **LS-Rechner:** Integrierte Rechner für Ertrag & Gewinn, Futterbedarf, Mischration (TMR) und Feld-Arbeitszeit.
- **Screenshots:** Galerie für Bilder aus dem Spiel-Profilordner mit Kopier-/Teilen-Funktion, Kontext-Tags und Vorher/Nachher-Vergleich.

### 🌐 Multiplayer, Server & RP-Network
- **Server Status:** Statusabfrage für GIANTS-Dienste und eigene Dedicated Server inklusive Spieleranzahl, aktiver Map und Spielernamen.
- **RP & Party Network:** WebRTC-Lobbys mit Whitelist/Regelbestätigung, Höfen & Rollen, virtuellen Konten, Fuhrparkmiete, Lohnunternehmer-Preisen, Feldnotizen, Lieferscheinen sowie Event- und Schichtverwaltung.
- **Admin-Savegame-Sync:** Ruft eine konfigurierte HTTPS-Quelle minütlich ab, solange die RP-Ansicht geöffnet ist.

---

## ⚙️ Startoptionen

| Option | Startparameter / Aktion |
| :--- | :--- |
| **Dev Mode** | `-cheats -console` |
| **Intro überspringen** | `-skipStartVideos` |
| **Shader Cache leeren** | Löscht `shader_cache` im Profil-Ordner vor dem Spielstart |
| **Savegame direkt laden** | `-autoStartSavegameId <Nr>` *(experimentell)* |

---

## 🛠️ Entwicklung & Build

**Voraussetzung:** [Node.js](https://nodejs.org) 20 oder neuer.

```bash
# Abhängigkeiten installieren
npm install

# Launcher im Entwicklungsmodus starten
npm start
