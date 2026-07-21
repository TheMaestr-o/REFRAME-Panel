# REFRAME — Installation (Photoshop 2025/2026)

## Option A: Permanent install (.ccx) — recommended

1. Download `com.maestro.reframe_x.y.z.ccx` from [Releases](../../releases).
2. Double-click the file → Creative Cloud installs the plugin.
3. In Photoshop: **Plugins → REFRAME by Maestro → REFRAME** — the panel opens and can be docked like any other.

## Option B: Development (UXP Developer Tool)

1. Creative Cloud Desktop → **Marketplace** tab → search **UXP Developer Tools** → install.
2. Open UDT. Photoshop must be running.
3. UDT: **Add Plugin** → select `manifest.json` from this folder.
4. Next to the plugin click **••• → Load**.
5. **••• → Watch** — the panel auto-reloads when files change (handy for tweaks).

## Option C: System plugins folder (no UDT, macOS)

Copy the plugin folder to:

```
/Library/Application Support/Adobe/UXP/Plugins/External/com.maestro.reframe
```

and restart Photoshop. It loads automatically at every start.

## Usage

- **D-pad** — pick the side the margin is measured from (▲ ▼ ◀ ▶), or **◎ Center** to center on Path 1.
- **px field** — distance from the canvas edge to the object.
- **− / +** change the value in steps of 5; presets 30/50/60/100 are one click away.
- **Apply** (or Enter) — run it. Arrow keys pick the side, C = Center.
- Canvas size never changes, pixels outside the canvas are kept (crop with `delete: false`), all in one History step.
