<div align="center">

<img src="assets/icon.png" alt="Agri Nexus Logo" width="110" />

# Agri Nexus v1.0.5-beta

**Free, open-source management tool, mod manager, and companion app for Farming Simulator 25.**

![Downloads](https://img.shields.io/github/downloads/AgrarJulian/LS-Launcher/total?style=for-the-badge&color=84cc16)
![Release](https://img.shields.io/github/v/release/AgrarJulian/LS-Launcher?include_prereleases&style=for-the-badge&color=65a30d)
![License](https://img.shields.io/github/license/AgrarJulian/LS-Launcher?style=for-the-badge&color=3f6212)
![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-blue?style=for-the-badge)

</div>

---

## 📥 Download & Installation

1. Download the latest version (`Agri-Nexus-1.0.4-beta-x64.exe`) from **[Releases](https://github.com/AgrarJulian/LS-Launcher/releases)**.
2. Run the setup and follow the installation steps.
3. Select your FS25 game path and your desired mod folder in **Settings**.
4. Later versions download from GitHub and can be installed from the green in-app update banner.

> **Windows SmartScreen Note:** Because the `.exe` is currently not digitally signed, Windows may display a security warning on first launch. Simply click **"More info"** and then **"Run anyway"**.

---

## ✨ Features

### 🚀 Launcher & Profiles
- **Launch:** Instant game launch with your active profile and quick toggles (*Dev Mode*, *Clear Shader Cache*, *Skip Intro*, *Auto-Backup before launch*).
- **Farm Profiles:** Dedicated mod folder per profile (automatically written to `gameSettings.xml`), assigned savegame, custom mod selection, and launch options.
- **Discord Rich Presence:** Displays your active farm profile, live game status, and loaded mod count on Discord.

### 📦 Mods & Assets
- **Mod Shelf:** Overview showing icon, name, version, author, and error status per mod (mod folder path is read directly from `gameSettings.xml`).
- **P2P Mod Sync:** Sync private `.zip` mods directly via room code with SHA-256 verification and progress tracking (individual mods or all missing mods at once).
- **Analysis & Management:** Conflict checker (script overlaps & duplicates), storage overview with warnings for oversized files, ModHub version check *(experimental)*, drag-and-drop installer for `.zip` mods, and 1-click deactivation via `.bak`.

### 💾 Saves, Backups & Tools
- **Saves & Backups:** Manual and automatic savegame backups with timestamps, 1-click restore (with safety copy), plus a **Savegame Editor** for numeric XML values with full pre-edit backups and XML structure diagnostics.
- **Live & Workshop:** Local Wi-Fi companion webpage displaying live savegame/farm data and an optional telemetry POST endpoint. Includes a Dev Macro Deck, controller binding snapshots, named graphics presets (`gameSettings.xml`), mod bloat scanner, load-time analysis (`log.txt`), and modpack manifest export.
- **Log Analyzer:** Reads `log.txt` (optionally live), translates errors and warnings into plain language, and links them directly to the responsible mods.
- **FS Calculators:** Built-in calculators for yield & profit, feed requirements, Total Mixed Ration (TMR), and field work time.
- **Screenshots:** Gallery for images from your game profile folder, including copy/share options, context tags, and before/after comparison.

### 🌐 Multiplayer, Server & RP Network
- **Server Status:** Status monitor for GIANTS services and custom dedicated servers including player count, active map, and player names.
- **RP & Party Network:** WebRTC lobbies with whitelist/rule confirmation, farms & roles, virtual accounts, fleet rentals, contractor rates, field notes, delivery notes, and event/shift management.
- **Admin Savegame Sync:** Polls a configured HTTPS source every minute while the RP view is open.
- **Partner Directory:** Displays partner logos, descriptions, and links. The list is fetched from the public GitHub `partners.json` file and refreshes automatically without an app update. The app is read-only; only people with repository write access can change the shared directory.
- **Preferences:** Choose German or English, and select a light, dark, or system-matched theme.

---

## ⚙️ Launch Options

| Option | Launch Parameter / Action |
| :--- | :--- |
| **Dev Mode** | `-cheats -console` |
| **Skip Intro** | `-skipStartVideos` |
| **Clear Shader Cache** | Deletes `shader_cache` in the profile folder before launch |
| **Direct Savegame Load** | `-autoStartSavegameId <No>` *(experimental)* |

---

## 🛠️ Development & Build

**Prerequisite:** [Node.js](https://nodejs.org) 20 or newer.

```bash
# Install dependencies
npm install

# Start the launcher in development mode
npm start
```

`npm run build` creates the Windows NSIS setup. `npm run build:portable` creates an optional portable build, which does not support in-app self-updates. To publish an update, bump `package.json`, commit the change, and push a matching `v<version>` tag (for example `v1.0.5-beta`). The GitHub Actions workflow builds the installer and publishes it with `latest.yml`, which the updater needs. The repository's Actions setting must allow workflows to create releases.

## Updating the Partner Directory

The shared directory is stored in [`partners.json`](https://github.com/AgrarJulian/LS-Launcher/edit/main/partners.json). Add entries to the `partners` array and commit the change to `main`. Only repository collaborators with write permission can edit it; the app itself has no partner-add form. The app refreshes the list when opening the tab and every two minutes, with a manual refresh option and a local cache for offline use.

Example entry:

```json
{
  "id": "partner-id",
  "title": "Partner name",
  "description": "Short description",
  "url": "https://example.com/",
  "logo": "https://example.com/logo.png"
}
```

Logo is optional; provided links must use HTTPS.
