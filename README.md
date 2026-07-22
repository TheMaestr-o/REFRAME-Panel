<div align="center">

# R E F R A M E

**Non-destructive canvas reposition around `Path 1` — for Adobe Photoshop 2025 / 2026**

<sub>D e s i g n e d&nbsp;&nbsp;b y&nbsp;&nbsp;S e r g i o</sub>

<br>

![Version](https://img.shields.io/badge/version-2.4.0-f5b942?style=flat-square)
![Photoshop](https://img.shields.io/badge/Photoshop-2025%20%7C%202026-2d2d2d?style=flat-square)
![Platform](https://img.shields.io/badge/platform-UXP-2d2d2d?style=flat-square)
![License](https://img.shields.io/badge/license-All%20rights%20reserved-8a8a8a?style=flat-square)

<br>

<table>
<tr>
<td align="center"><img src="screenshots/screen-1.png" width="260" alt="Side mode with three presets"></td>
<td align="center"><img src="screenshots/screen-2.png" width="260" alt="Center mode"></td>
<td align="center"><img src="screenshots/screen-3.png" width="260" alt="Side mode, clean"></td>
</tr>
<tr>
<td align="center"><sub>Side mode · presets ready</sub></td>
<td align="center"><sub>◎ Center · one click, nothing moves</sub></td>
<td align="center"><sub>Side mode · clean</sub></td>
</tr>
</table>

</div>

<br>

## What it does

Repositions the canvas around **"Path 1"** with a single click. The canvas size always stays exactly **W × H** — the crop runs with `delete: false`, so pixels outside the canvas survive, and the whole operation lands in **one History step**.

## How it works

| | |
|---|---|
| **D-pad** | Pick the side the margin is measured from (▲ ▼ ◀ ▶), or **◎ Center**. The layout never shifts between modes — controls stay exactly where they are |
| **Value** | Shown dead-center as `500 px`. Click (or Tab) to type — an amber caret blinks, every keystroke echoes centered. Clamped to 0–99999 on every path (typing, paste, − / +) |
| **Presets** | 3 slots, empty by default. **Right-click the value** — or **drag it down** — to save. Click to load, right-click to move / delete, drag to reorder. Duplicates are impossible |
| **APPLY** | Pinned to the bottom. **Enter** applies from anywhere. Success is silent — the canvas is the feedback |

**Keyboard flow:** arrows pick the side → `Tab` lands in the field → type → `Enter` focuses APPLY → `Enter` applies. `C` = Center, `Esc` cancels an edit.

## Install

**The easy way** — grab `com.maestro.reframe_x.y.z.ccx` from [**Releases**](../../releases), double-click it, Creative Cloud does the rest. The panel appears under **Plugins → REFRAME by Maestro → REFRAME**.

Developer options (UXP Developer Tool / system plugins folder) — see [INSTALL.md](INSTALL.md).

## Engineering notes

- **Dual engine.** Apply generates the proven original ExtendScript core (pixel-forced rulers, path selection, non-destructive Crop) with your side/margin baked in and runs it through Photoshop's script automation; a native UXP `batchPlay` implementation kicks in automatically as fallback.
- **UXP-safe UI, learned the hard way:** no native `<button>` (its internal layout truncates labels), no `flex-wrap`, no `gap`, no `calc()`. Everything sits on one **3 × 46 px grid**.
- **UXP inputs are native C++ widgets** — `text-align` is impossible on the real control. The visible value is a styled display; an offscreen input captures keystrokes and echoes them centered, with a blinking caret.
- **Fixed-size panel** (`minimumSize == maximumSize`) — no host resize grabber, no scrollbar artifacts, constant geometry in every mode.

## License

**© 2026 Sergio (Maestro). All rights reserved.**

The source is published for review; copying, redistribution or commercial use requires the author's written permission — see [LICENSE](LICENSE).
