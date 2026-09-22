# Build Assets

This directory holds application icons required by electron-builder for packaging.

## Required Icon Files

| File        | Platform | Format / Size                      |
| ----------- | -------- | ---------------------------------- |
| `icon.ico`  | Windows  | ICO, 256x256 minimum (multi-size)  |
| `icon.icns` | macOS    | ICNS, 512x512 + 1024x1024 (Retina) |
| `icon.png`  | Linux    | PNG, 512x512                       |

## Notes

- electron-builder will look for these files automatically during packaging.
- A single high-resolution source PNG (1024x1024) can be converted to all three formats using tools such as `png2icons` or the `electron-icon-builder` npm package.
- These placeholder entries must be replaced with actual icon files before building distributable installers.
