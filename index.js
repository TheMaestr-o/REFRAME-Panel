/* ==========================================================================
   REFRAME v2.2.6  (UXP Panel)
   AUTHOR: Sergio (Maestro)
   © 2026 Sergio (Maestro). All rights reserved. See LICENSE.
   No copying, redistribution or derivative works without written permission.
   --------------------------------------------------------------------------
   Repositions the canvas around "Path 1" — non-destructively.
   Canvas size always stays exactly W × H.
   --------------------------------------------------------------------------
   Ported from ExtendScript v1.1.0. Keeps all v1.1.0 fixes:
   - Center does NOT overwrite the saved margin value
   - crop coordinates rounded, canvas size exact
   - safe when no document is open
   New in 2.0.0:
   - UXP panel (PS 2025/2026 compatible — CEP no longer loads there)
   - settings persist via localStorage
   - keyboard: arrows = side, C = center, Enter = apply
   New in 2.1.0/2.1.1:
   - UI rebuilt on UXP-safe CSS; all strings English; centered value display
   New in 2.1.2:
   - Buttons are <div role="button">, not <button> — UXP's native button
     truncates/pads labels unpredictably (root cause of earlier layout bugs)
   - Fixed presets replaced by 3 user slots (empty by default): right-click
     or drag the value to save, click to load, right-click / drag to
     reorder or delete; persisted in localStorage
   - Tab ring: value field → presets → APPLY; Enter in the field jumps
     focus to APPLY so the next Enter applies
   New in 2.2.0:
   - APPLY label centered (the div conversion had lost the free centering)
   - presets are unique (dedupe on save/drop + self-heal stored state)
   - empty slots hidden at rest, appear as drop-zones only while dragging;
     filled chips render as a centered group
   - transient status: nothing under APPLY at rest, messages fade after 2.5s
   - header is just the authorship line
   New in 2.2.1:
   - Center mode hides the whole Margin block (label + field + presets)
   - 3 presets align to an edge-to-edge grid; compact vertical metrics
   ========================================================================== */

const { app, core, action } = require("photoshop");
const batchPlay = action.batchPlay;

/* ---------------- state ---------------- */

const SIDES = ["top", "bottom", "left", "right", "center"];
const MAX_PRESETS = 3;
let currentSide = localStorage.getItem("reframe.side") || "top";
let savedMargin = localStorage.getItem("reframe.margin") || "50";
let presets = loadPresets();
let busy = false;          // guards Apply while a crop is running
let dragPayload = null;    // "value" | {slot: i} — dataTransfer is flaky in UXP

/* ---------------- dom ---------------- */

const $ = (id) => document.getElementById(id);
const marginInput = $("margin");
const valueBox = $("value-box");
const valueNum = $("value-num");
const statusEl = $("status");
const applyBtn = $("apply");
const stepperEl = $("stepper");
const panelEl = document.querySelector(".panel");
const presetsEl = $("presets");
const slots = Array.prototype.slice.call(
    document.querySelectorAll(".preset-slot")
);

/* ---------------- ui helpers ---------------- */

let statusTimer = null;

/* Transient: nothing under APPLY at rest. A message shows, then fades.
   sticky=true (e.g. "Applying…") stays until the next message replaces it. */
function setStatus(msg, cls, sticky) {
    if (statusTimer) {
        clearTimeout(statusTimer);
        statusTimer = null;
    }
    statusEl.textContent = msg;
    statusEl.className = "status" + (cls ? " " + cls : "") + (msg ? "" : " hidden");
    if (msg && !sticky) {
        statusTimer = setTimeout(() => {
            statusEl.textContent = "";
            statusEl.className = "status hidden";
        }, 2500);
    }
}

function selectSide(side) {
    currentSide = side;
    localStorage.setItem("reframe.side", side);

    document.querySelectorAll(".dpad-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.side === side);
    });

    // Center ignores the margin — the whole block disappears (CSS
    // .center-mode); the saved value itself is untouched
    const isCenter = side === "center";
    panelEl.classList.toggle("center-mode", isCenter);
    stepperEl.classList.toggle("disabled", isCenter);
    marginInput.disabled = isCenter;

    updatePresetHighlight();
}

function getMargin() {
    const v = parseInt(marginInput.value, 10);
    return isNaN(v) || v < 0 ? 0 : v;
}

function setMargin(v) {
    marginInput.value = String(v);
    valueNum.textContent = String(v);
    savedMargin = String(v);
    localStorage.setItem("reframe.margin", savedMargin);
    updatePresetHighlight();
}

/* ---------------- presets (3 user slots) ---------------- */

function loadPresets() {
    try {
        const a = JSON.parse(localStorage.getItem("reframe.presets") || "[]");
        if (!Array.isArray(a)) return [];
        const clean = a
            .filter((n) => typeof n === "number" && isFinite(n) && n >= 0)
            .map((n) => Math.round(n));
        // unique values only — self-heals older duplicated state
        const unique = [];
        clean.forEach((n) => {
            if (unique.indexOf(n) === -1) unique.push(n);
        });
        return unique.slice(0, MAX_PRESETS);
    } catch (e) {
        return [];
    }
}

function persistPresets() {
    localStorage.setItem("reframe.presets", JSON.stringify(presets));
    renderPresets();
}

function renderPresets() {
    presetsEl.classList.toggle("none", presets.length === 0);
    presetsEl.classList.toggle("grid3", presets.length === 3);
    slots.forEach((el, i) => {
        const val = presets[i];
        const filled = val !== undefined;
        el.textContent = filled ? String(val) : "+";
        el.classList.toggle("filled", filled);
        el.classList.toggle("empty", !filled);
        if (filled) {
            el.setAttribute("role", "button");
            el.setAttribute("tabindex", "0");
            el.setAttribute("draggable", "true");
            el.setAttribute("title", val + " px — click to load · right-click / drag to manage");
        } else {
            el.removeAttribute("role");
            el.removeAttribute("tabindex");
            el.removeAttribute("draggable");
            el.setAttribute("title", "Empty slot — right-click the value above (or drag it here) to save");
        }
    });
    updatePresetHighlight();
}

function updatePresetHighlight() {
    slots.forEach((el, i) => {
        el.classList.toggle(
            "active",
            presets[i] !== undefined &&
                String(presets[i]) === marginInput.value &&
                currentSide !== "center"
        );
    });
}

function savePreset(value) {
    if (presets.indexOf(value) !== -1) {
        setStatus("Preset " + value + " px already saved");
        return;
    }
    if (presets.length >= MAX_PRESETS) return;
    presets.push(value);
    persistPresets();
    setStatus("Preset " + value + " px saved", "ok");
}

function deletePreset(i) {
    const val = presets[i];
    presets.splice(i, 1);
    persistPresets();
    setStatus("Preset " + val + " px deleted");
}

function movePreset(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= presets.length) return;
    const t = presets[i];
    presets[i] = presets[j];
    presets[j] = t;
    persistPresets();
}

/* ---------------- context menu ---------------- */

let menuEl = null;

function closeMenu() {
    if (menuEl && menuEl.parentNode) menuEl.parentNode.removeChild(menuEl);
    menuEl = null;
}

function showMenu(x, y, items) {
    closeMenu();
    menuEl = document.createElement("div");
    menuEl.className = "ctx-menu";
    items.forEach((it) => {
        const row = document.createElement("div");
        row.className = "ctx-item" + (it.disabled ? " disabled" : "");
        row.textContent = it.label;
        if (!it.disabled) {
            row.addEventListener("click", (e) => {
                e.stopPropagation();
                closeMenu();
                it.onClick();
            });
        }
        menuEl.appendChild(row);
    });
    document.body.appendChild(menuEl);
    // keep the menu inside the panel
    const bw = document.body.getBoundingClientRect().width;
    const mw = menuEl.getBoundingClientRect().width;
    menuEl.style.left = Math.max(4, Math.min(x, bw - mw - 4)) + "px";
    menuEl.style.top = y + "px";
}

document.addEventListener("click", closeMenu);

/* ---------------- photoshop ---------------- */

function px(v) {
    return { _unit: "pixelsUnit", _value: v };
}

async function selectionFromPath(pathId) {
    await batchPlay(
        [
            {
                _obj: "set",
                _target: [{ _ref: "channel", _property: "selection" }],
                to: [{ _ref: "path", _id: pathId }],
                version: 1,
                antiAlias: true,
                feather: px(0)
            }
        ],
        {}
    );
}

async function getSelectionBounds() {
    const r = await batchPlay(
        [
            {
                _obj: "get",
                _target: [
                    { _property: "selection" },
                    { _ref: "document", _enum: "ordinal", _value: "targetEnum" }
                ]
            }
        ],
        {}
    );
    const s = r[0] && r[0].selection;
    if (!s) return null;
    return {
        left: s.left._value,
        top: s.top._value,
        right: s.right._value,
        bottom: s.bottom._value
    };
}

async function deselect() {
    await batchPlay(
        [
            {
                _obj: "set",
                _target: [{ _ref: "channel", _property: "selection" }],
                to: { _enum: "ordinal", _value: "none" }
            }
        ],
        {}
    );
}

async function unlockBackground(doc) {
    const bottom = doc.layers[doc.layers.length - 1];
    if (!bottom || !bottom.isBackgroundLayer) return;
    await batchPlay(
        [
            {
                _obj: "set",
                _target: [{ _ref: "layer", _property: "background" }],
                to: {
                    _obj: "layer",
                    opacity: { _unit: "percentUnit", _value: 100 },
                    mode: { _enum: "blendMode", _value: "normal" }
                }
            }
        ],
        {}
    );
}

async function cropTo(cL, cT, cR, cB) {
    await batchPlay(
        [
            {
                _obj: "crop",
                to: {
                    _obj: "rectangle",
                    top: px(cT),
                    left: px(cL),
                    bottom: px(cB),
                    right: px(cR)
                },
                angle: { _unit: "angleUnit", _value: 0 },
                delete: false, // non-destructive: pixels survive outside canvas
                constrainProportions: false
            }
        ],
        {}
    );
}

function findPath(doc) {
    const paths = doc.pathItems;
    if (!paths || paths.length === 0) return null;
    for (let i = 0; i < paths.length; i++) {
        if (paths[i].name === "Path 1" || paths[i].name === "Pfad 1") {
            return paths[i];
        }
    }
    return paths[0]; // fallback: first path
}

/* ---------------- core operation ---------------- */

async function performReframe() {
    if (busy) return;

    const doc = app.activeDocument;
    if (!doc) {
        setStatus("No document open", "error");
        return;
    }

    const path = findPath(doc);
    if (!path) {
        setStatus("Path 1 not found", "error");
        return;
    }

    const side = currentSide;
    const margin = getMargin();

    busy = true;
    applyBtn.classList.add("busy");
    setStatus("Applying…", null, true);

    try {
        await core.executeAsModal(
            async (ctx) => {
                const hist = await ctx.hostControl.suspendHistory({
                    documentID: doc.id,
                    name: "REFRAME"
                });
                try {
                    // Canvas size — stays exactly the same after crop
                    const W = doc.width;
                    const H = doc.height;

                    await unlockBackground(doc);

                    await selectionFromPath(path.id);
                    const b = await getSelectionBounds();
                    await deselect();

                    if (!b) throw new Error("Path gave no selection");

                    const cx = (b.left + b.right) / 2;
                    const cy = (b.top + b.bottom) / 2;

                    // Integer anchor, then build the exact W×H rectangle
                    // from it (v1.1.0 fix: no ±1px canvas drift)
                    let cL, cT;
                    switch (side) {
                        case "top":
                            cT = Math.round(b.top - margin);
                            cL = Math.round(cx - W / 2);
                            break;
                        case "bottom":
                            cT = Math.round(b.bottom + margin - H);
                            cL = Math.round(cx - W / 2);
                            break;
                        case "left":
                            cL = Math.round(b.left - margin);
                            cT = Math.round(cy - H / 2);
                            break;
                        case "right":
                            cL = Math.round(b.right + margin - W);
                            cT = Math.round(cy - H / 2);
                            break;
                        default: // center
                            cL = Math.round(cx - W / 2);
                            cT = Math.round(cy - H / 2);
                    }

                    await cropTo(cL, cT, cL + W, cT + H);
                } finally {
                    await ctx.hostControl.resumeHistory(hist);
                }
            },
            { commandName: "REFRAME" }
        );

        // persist margin only for side modes (Center never touches it)
        if (side !== "center") setMargin(margin);

        setStatus(
            side === "center"
                ? "Centered ✓"
                : "Done ✓ · " + margin + " px " + side,
            "ok"
        );
    } catch (e) {
        setStatus("Error: " + (e.message || e), "error");
    } finally {
        busy = false;
        applyBtn.classList.remove("busy");
    }
}

/* ---------------- events: sides + stepper ---------------- */

document.querySelectorAll(".dpad-btn").forEach((btn) => {
    btn.addEventListener("click", () => selectSide(btn.dataset.side));
});

$("step-minus").addEventListener("click", () => {
    if (currentSide !== "center") setMargin(Math.max(0, getMargin() - 5));
});
$("step-plus").addEventListener("click", () => {
    if (currentSide !== "center") setMargin(getMargin() + 5);
});

marginInput.addEventListener("input", () => {
    // digits only
    const clean = marginInput.value.replace(/[^0-9]/g, "");
    if (clean !== marginInput.value) marginInput.value = clean;
    updatePresetHighlight();
});
marginInput.addEventListener("change", () => setMargin(getMargin()));

/* ---------------- events: value box (edit / save preset) ---------------- */

/* Click, Tab-focus → swap in the real input for typing.
   (UXP can't center text inside <input>, so the resting state is a DIV.) */
function enterEdit() {
    if (currentSide === "center") return;
    if (stepperEl.classList.contains("editing")) return;
    stepperEl.classList.add("editing");
    marginInput.value = savedMargin;
    marginInput.focus();
    if (marginInput.select) marginInput.select();
}

function exitEdit() {
    if (!stepperEl.classList.contains("editing")) return;
    stepperEl.classList.remove("editing");
    setMargin(getMargin());
}

valueBox.addEventListener("click", enterEdit);
valueBox.addEventListener("focus", enterEdit);
marginInput.addEventListener("blur", exitEdit);

/* Enter in the field: commit, move focus to APPLY (next Enter applies).
   Escape: cancel the edit, keep the previous value. */
marginInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        exitEdit();
        applyBtn.focus();
    } else if (e.key === "Escape") {
        marginInput.value = savedMargin;
        exitEdit();
    }
});

valueBox.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const v = getMargin();
    showMenu(e.clientX || 20, e.clientY || 20, [
        presets.length < MAX_PRESETS
            ? { label: "Save " + v + " px as preset", onClick: () => savePreset(v) }
            : { label: "Presets full (3/3)", disabled: true }
    ]);
});

valueBox.addEventListener("dragstart", (e) => {
    dragPayload = "value";
    panelEl.classList.add("dragging"); // reveal the drop-zones
    presetsEl.classList.add("grid3");  // all 3 slots visible -> grid layout
    try { e.dataTransfer.setData("text/plain", "reframe-value"); } catch (err) {}
});
valueBox.addEventListener("dragend", () => {
    dragPayload = null;
    panelEl.classList.remove("dragging");
    renderPresets(); // restores grid3 only if 3 presets remain
});

/* ---------------- events: preset slots ---------------- */

slots.forEach((el, i) => {
    // load on click (filled only; ignored in Center mode like before)
    el.addEventListener("click", () => {
        if (presets[i] === undefined || currentSide === "center") return;
        setMargin(presets[i]);
    });

    // right-click: save (empty) / move + delete (filled)
    el.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const x = e.clientX || 20;
        const y = e.clientY || 20;
        if (presets[i] === undefined) {
            const v = getMargin();
            showMenu(x, y, [
                presets.length < MAX_PRESETS
                    ? { label: "Save " + v + " px here", onClick: () => savePreset(v) }
                    : { label: "Presets full (3/3)", disabled: true }
            ]);
            return;
        }
        const items = [];
        if (i > 0) items.push({ label: "◀ Move left", onClick: () => movePreset(i, -1) });
        if (i < presets.length - 1) items.push({ label: "Move right ▶", onClick: () => movePreset(i, 1) });
        items.push({ label: "Delete " + presets[i] + " px", onClick: () => deletePreset(i) });
        showMenu(x, y, items);
    });

    // drag source (reorder)
    el.addEventListener("dragstart", (e) => {
        if (presets[i] === undefined) return;
        dragPayload = { slot: i };
        panelEl.classList.add("dragging");
        presetsEl.classList.add("grid3");
        try { e.dataTransfer.setData("text/plain", "reframe-slot-" + i); } catch (err) {}
    });
    el.addEventListener("dragend", () => {
        dragPayload = null;
        panelEl.classList.remove("dragging");
        renderPresets();
    });

    // drop target (value → save/overwrite, slot → swap)
    el.addEventListener("dragover", (e) => {
        if (!dragPayload) return;
        e.preventDefault();
        el.classList.add("drop-target");
    });
    el.addEventListener("dragleave", () => el.classList.remove("drop-target"));
    el.addEventListener("drop", (e) => {
        e.preventDefault();
        el.classList.remove("drop-target");
        if (!dragPayload) return;
        if (dragPayload === "value") {
            const v = getMargin();
            if (presets.indexOf(v) !== -1) {
                setStatus("Preset " + v + " px already saved");
            } else if (presets[i] !== undefined) {
                presets[i] = v;          // overwrite this slot
                persistPresets();
                setStatus("Preset " + v + " px saved", "ok");
            } else {
                savePreset(v);           // fill the first free slot
            }
        } else if (typeof dragPayload === "object") {
            const j = dragPayload.slot;
            if (presets[i] !== undefined && i !== j) {
                const t = presets[i];    // swap two filled slots
                presets[i] = presets[j];
                presets[j] = t;
                persistPresets();
            } else if (presets[i] === undefined) {
                const v = presets[j];    // move into an empty slot (append)
                presets.splice(j, 1);
                presets.push(v);
                persistPresets();
            }
        }
        dragPayload = null;
        panelEl.classList.remove("dragging");
        renderPresets();
    });
});

/* ---------------- events: apply + keyboard ---------------- */

applyBtn.addEventListener("click", performReframe);

// Arrows = side, C = center, Enter = apply (or activate the focused
// div-button — native <button> did Enter/Space for free, divs don't).
document.addEventListener("keydown", (e) => {
    if (e.target === marginInput) return; // field has its own handler
    if (e.key === "Escape") { closeMenu(); return; }

    if (e.key === "Enter" || e.key === " ") {
        const t = e.target;
        if (t && t.getAttribute && t.getAttribute("role") === "button" && t !== valueBox) {
            e.preventDefault();
            t.click();
            return;
        }
    }

    switch (e.key) {
        case "ArrowUp":    selectSide("top");    e.preventDefault(); break;
        case "ArrowDown":  selectSide("bottom"); e.preventDefault(); break;
        case "ArrowLeft":  selectSide("left");   e.preventDefault(); break;
        case "ArrowRight": selectSide("right");  e.preventDefault(); break;
        case "c":
        case "C":          selectSide("center"); break;
        case "Enter":      performReframe();     break;
    }
});

/* ---------------- init ---------------- */

marginInput.value = savedMargin;
valueNum.textContent = savedMargin;
renderPresets();
selectSide(SIDES.includes(currentSide) ? currentSide : "top");
