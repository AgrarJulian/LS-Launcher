# LS25 Launcher

Freies Open-Source-Verwaltungstool für den Landwirtschafts-Simulator 25.

![Logo](assets/icon.png)

## Funktionen

- **Starten** – Start-Button, aktives Profil, Schnelleinstellungen (Dev Mode, Shader Cache leeren, Intro überspringen, Auto-Backup vor dem Start)
- **Hof Profile** – pro Profil eigener Mod-Ordner (wird in die `gameSettings.xml` eingetragen), fest zugeordnetes Savegame, Mod-Auswahl und Startoptionen
- **Mods & Assets** – Mod-Regal mit Icon, Name, Version, Modder und Fehlern je Mod; Mod-Ordner wird aus der `gameSettings.xml` gelesen
  - Konflikt-Checker (Skript-Überschneidungen, doppelte Mods)
  - 1-Klick-Deaktivierung per `.bak`
  - ModHub-Versionsabgleich (experimentell)
  - Drag-&-Drop-Installer für `.zip`-Mods
- **Saves & Backups** – manuelle und automatische Backups, Liste mit Datum/Uhrzeit, 1-Klick-Wiederherstellung (mit Sicherheitskopie)
- **Log-Analyse** – liest die Spiel-Log-Datei, übersetzt Fehler/Warnungen und ordnet sie Mods zu, optional live
- **Rechner** – Ertrag & Gewinn, Futterbedarf, Mischration, Arbeitszeit
- **Server Status** – GIANTS-Dienste und eigene Server mit Spieleranzahl, Map und Spielernamen (über die Statistik-Adresse des Dedicated Servers)
- **Einstellungen** und **Über uns**

## Entwicklung

Voraussetzung: [Node.js](https://nodejs.org) 20 oder neuer.

```bash
npm install
npm start          # Launcher im Entwicklungsmodus starten
```

## .exe erzeugen

```bash
npm run build            # portable .exe  ->  dist/LS25-Launcher-1.0.0-x64.exe
npm run build:installer  # Setup-Installer (NSIS)
```

Der Build sollte unter Windows ausgeführt werden. Dort wird auch das Icon in die .exe eingebettet.

## Startoptionen

| Option | Startparameter |
| --- | --- |
| Dev Mode | `-cheats -console` |
| Intro überspringen | `-skipStartVideos` |
| Shader Cache leeren | löscht `shader_cache` im Profil-Ordner vor dem Start |
| Savegame direkt laden | `-autoStartSavegameId <Nr>` (experimentell) |

## Lizenz

[MIT](LICENSE) · Datenschutz: [PRIVACY.md](PRIVACY.md)

LS25 Launcher ist ein inoffizielles Community-Projekt und steht in keinerlei Verbindung mit der GIANTS Software GmbH. „Landwirtschafts-Simulator“ und „GIANTS Software“ sind eingetragene Marken der GIANTS Software GmbH.
