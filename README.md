# REFRAME v2.0 — UXP Panel for Photoshop

Панель для Photoshop 2025/2026 (UXP): переставляет холст вокруг «Path 1» без разрушения пикселей.
Размер холста всегда остаётся ровно W × H.

## Возможности

- **Крестовина** — выбор стороны отступа (▲ ▼ ◀ ▶) или **◎ Center** для центрирования по Path 1
- Отступ в px от края холста до объекта, шаг ±5, пресеты 30/50/60/100
- Клавиатура: стрелки = сторона, **C** = центр, **Enter** = применить
- Crop с `delete: false` — пиксели за холстом не удаляются, всё в одном шаге History
- Настройки сохраняются между сессиями (localStorage)

## Установка

См. [INSTALL.md](INSTALL.md). Кратко:

- **Вариант A (разработка):** UXP Developer Tools → Add Plugin → `manifest.json` → Load
- **Вариант B (постоянно):** собрать `.ccx` (UDT → Package) → двойной клик → Creative Cloud установит

## Структура

| Файл | Назначение |
|---|---|
| `manifest.json` | UXP-манифест (manifestVersion 5, apiVersion 2) |
| `index.html` / `styles.css` | UI панели |
| `index.js` | Логика: batchPlay crop вокруг Path 1 |

Порт ExtendScript-версии v1.1.0 → UXP (CEP в PS 2025+ больше не работает).

© 2026 MAESTRO
