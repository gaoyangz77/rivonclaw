# Build Assets

Files electron-builder packages, plus the Panel's static root: the Panel's Vite
`publicDir` is this directory, so everything here is also served at `/` there.

## Brand icons

`brand-mark.svg` is the TK mark and the only hand-edited brand file. Everything
in the table below is generated from it:

```bash
cd apps/desktop && node scripts/generate-brand-icons.mjs
```

The script runs on macOS with Google Chrome installed (Playwright drives it)
and uses `iconutil` for the ICNS.

| File           | Used by                                   | Artwork                                              |
| -------------- | ----------------------------------------- | ---------------------------------------------------- |
| `icon.icns`    | macOS app                                 | Mark on the dark tile, Apple icon grid               |
| `icon.png`     | Linux packages, Dock icon in dev runs     | 512px of the macOS artwork                           |
| `icon.ico`     | Windows app and installer, Panel tab icon | Full-bleed dark tile, 16-256px                       |
| `trayIcon.png` | Menu bar / system tray                    | 44px colour mark; the status dot is drawn at runtime |

The Panel sidebar shows `brand-mark.svg` itself.

The website keeps its own copy of the same mark. When the mark changes, update
both.

## Installer artwork

| File                   | Used by                        |
| ---------------------- | ------------------------------ |
| `dmg-background.png`   | macOS DMG window background    |
| `installerSidebar.png` | Windows NSIS installer sidebar |

`office/` is the pixel-office screensaver, staged by `scripts/setup-pixel-agents.sh`.
