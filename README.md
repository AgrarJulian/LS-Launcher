# LS25 Launcher

Freies Open-Source-Verwaltungstool für den Landwirtschafts-Simulator 25.

![Logo](assets/icon.png)

## Funktionen

- **Starten** – Start-Button, aktives Profil, Schnelleinstellungen (Dev Mode, Shader Cache leeren, Intro überspringen)
- **Hof Profile** – mehrere Profile mit eigenen Startoptionen
- **Mods & Assets** – Mod-Ordner durchsuchen, Mods in den Papierkorb verschieben
- **Saves & Backups** – Spielstände als ZIP sichern und wiederherstellen (mit automatischer Sicherheitskopie)
- **Server Status** – Erreichbarkeit der GIANTS-Dienste und eigener Server
- **Einstellungen** – Pfade und Verhalten
- **Über uns** – Lizenz, Haftungsausschluss, Links

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

## Lizenz

[MIT](LICENSE) · Datenschutz: [PRIVACY.md](PRIVACY.md)

LS25 Launcher ist ein inoffizielles Community-Projekt und steht in keinerlei Verbindung mit der GIANTS Software GmbH. „Landwirtschafts-Simulator“ und „GIANTS Software“ sind eingetragene Marken der GIANTS Software GmbH.
