/* ==========================================================================
   REFRAME v2.1.0  (UXP Panel)
   AUTHOR: MAESTRO | © 2026
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
   New in 2.1.0:
   - UI rebuilt on UXP-safe CSS (no flex-wrap, no stretched inputs)
   - all UI strings in English
   ========================================================================== */

const { app, core, action } = require("photoshop");
const batchPlay = action.batchPlay;

/* ---------------- state ---------------- */

const SIDES = ["top", "bottom", "left", "right", "center"];
let currentSide = localStorage.getItem("reframe.side") || "top";
let savedMargin = localStorage.getItem("reframe.margin") || "50";

/* ---------------- dom ---------------- */

const $ = (id) => document.getElementById(id);
const marginInput = $("margin");
const statusEl = $("status");
const applyBtn = $("apply");
const stepperEl = $("stepper");

/* ---------------- ui helpers ---------------- */

function setStatus(msg, cls) {
    statusEl.textContent = msg;
    statusEl.className = "status" + (cls ? " " + cls : "");
}

function selectSide(side) {
    currentSide = side;
    localStorage.setItem("reframe.side", side);

    document.querySelectorAll(".dpad-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.side === side);
    });

    // Center ignores the margin — grey the field out, but DO NOT change
    // its value (v1.1.0 fix: saved margin survives Center clicks)
    const isCenter = side === "center";
    stepperEl.classList.toggle("disabled", isCenter);
    marginInput.disabled = isCenter;
    $("margin-label").textContent = isCenter
        ? "Margin (px) — ignored for Center"
        : "Margin (px)";

    updatePresetHighlight();
}

function getMargin() {
    const v = parseInt(marginInput.value, 10);
    return isNaN(v) || v < 0 ? 0 : v;
}

function setMargin(v) {
    marginInput.value = String(v);
    savedMargin = String(v);
    localStorage.setItem("reframe.margin", savedMargin);
    updatePresetHighlight();
}

function updatePresetHighlight() {
    const v = marginInput.value;
    document.querySelectorAll(".preset-btn").forEach((b) => {
        b.classList.toggle(
            "active",
            b.dataset.val === v && currentSide !== "center"
        );
    });
}

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

    applyBtn.classList.add("busy");
    applyBtn.disabled = true;
    setStatus("Applying…");

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
        applyBtn.classList.remove("busy");
        applyBtn.disabled = false;
    }
}

/* ---------------- events ---------------- */

document.querySelectorAll(".dpad-btn").forEach((btn) => {
    btn.addEventListener("click", () => selectSide(btn.dataset.side));
});

document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        if (currentSide === "center") return;
        setMargin(parseInt(btn.dataset.val, 10));
    });
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

applyBtn.addEventListener("click", performReframe);

// Keyboard: arrows = side, C = center, Enter = apply
document.addEventListener("keydown", (e) => {
    if (e.target === marginInput && e.key !== "Enter") return;
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
selectSide(SIDES.includes(currentSide) ? currentSide : "top");
setStatus("Ready");
