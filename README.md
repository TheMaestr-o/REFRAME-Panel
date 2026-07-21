# REFRAME — UXP Panel for Photoshop

Repositions the canvas around **"Path 1"** — non-destructively. Canvas size always stays exactly W × H, pixels outside the canvas are never deleted.

For Photoshop 2025/2026 (UXP — CEP panels no longer load there).

## Features

- **D-pad** — pick which side the margin is measured from (▲ ▼ ◀ ▶), or **◎ Center** to center the canvas on Path 1
- Margin in px from the canvas edge to the object, ±5 stepper, presets 30 / 50 / 60 / 100
- Keyboard: arrows = side, **C** = center, **Enter** = apply
- Crop with `delete: false` — pixels outside the canvas survive, everything in a single History step
- Settings persist between sessions (localStorage)

## Install

See [INSTALL.md](INSTALL.md). Short version:

- **Permanent:** download `com.maestro.reframe_x.y.z.ccx` from [Releases](../../releases) → double-click → Creative Cloud installs it
- **Development:** UXP Developer Tools → Add Plugin → `manifest.json` → Load

## Structure

| File | Purpose |
|---|---|
| `manifest.json` | UXP manifest (manifestVersion 5, apiVersion 2) |
| `index.html` / `styles.css` | Panel UI (UXP-safe CSS: no flex-wrap, no gap, no stretched inputs) |
| `index.js` | Logic: batchPlay crop around Path 1 |

Ported from the ExtendScript v1.1.0 version.

© 2026 MAESTRO
