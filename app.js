/* Profiles — static PWA (web conversion of a SwiftUI settings panel).
 *
 * IMPORTANT: Everything in this panel is COSMETIC ONLY.
 * Toggles/fields persist in localStorage but have NO real device effect.
 * No network calls (CSP connect-src 'none'), no analytics, no tracking.
 */

// ===== PASSCODE (change here) =====
const PASSCODE = "6767";
// ==================================

const STORAGE_KEY = "profiles.list.v1";

/* COSMETIC ONLY — no real Android user profiles are created/locked. */
const SEED = [
  { id: "daily", name: "Daily", active: true },
  { id: "work", name: "Work", active: false },
  { id: "anon", name: "Anon", active: false },
];

function loadProfiles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) { saveProfiles(SEED); return SEED.map((p) => ({ ...p })); }
    return JSON.parse(raw) || [];
  } catch { return SEED.map((p) => ({ ...p })); }
}
function saveProfiles(l) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(l)); } catch {} }

function renderPanel() {
  const list = loadProfiles();
  const host = document.getElementById("profileList");
  host.textContent = "";
  if (!list.length) {
    const e = document.createElement("div"); e.className = "empty"; e.textContent = "No profiles"; host.appendChild(e);
  }
  for (const p of list) {
    const row = document.createElement("div"); row.className = "row static"; row.dataset.id = p.id;
    const txt = document.createElement("div"); txt.className = "row-text";
    const nm = document.createElement("span"); nm.className = "row-title"; nm.textContent = p.name;
    const st = document.createElement("span"); st.className = "status " + (p.active ? "active" : "locked");
    st.textContent = p.active ? "Active" : "Locked";
    txt.append(nm, st);
    const acts = document.createElement("div"); acts.className = "row-actions";
    const t = document.createElement("input"); t.type = "checkbox"; t.className = "toggle"; t.checked = !!p.active;
    t.setAttribute("aria-label", "Active " + p.name);
    t.addEventListener("change", () => {
      const l = loadProfiles(); const x = l.find((q) => q.id === p.id);
      if (x) { x.active = t.checked; saveProfiles(l); } renderPanel();
    });
    const del = document.createElement("button"); del.type = "button"; del.className = "del-btn";
    del.textContent = "✕"; del.setAttribute("aria-label", "Delete " + p.name);
    del.addEventListener("click", () => { saveProfiles(loadProfiles().filter((q) => q.id !== p.id)); renderPanel(); });
    acts.append(t, del);
    row.append(txt, acts);
    host.appendChild(row);
  }
}

function initPanel() {
  const input = document.getElementById("newProfile");
  const add = () => {
    const name = input.value.trim();
    if (!name) return;
    const l = loadProfiles();
    l.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, active: false });
    saveProfiles(l); input.value = ""; renderPanel();
  };
  document.getElementById("addBtn").addEventListener("click", add);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });
}

const decoyEl = document.getElementById("decoy");
const lockEl = document.getElementById("lock");
const panelEl = document.getElementById("panel");
const dotsEl = document.getElementById("dots");
const errorEl = document.getElementById("lockError");
const keypadEl = document.getElementById("keypad");
const lockPanelBtn = document.getElementById("lockPanelBtn");
const decoyTimeEl = document.getElementById("decoyTime");
const decoyDateEl = document.getElementById("decoyDate");

let entered = "";
let view = "decoy"; // decoy | lock | panel

/* ---------- SettingsStore (UserDefaults → localStorage) ---------- */
function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings(settings) {
  // Cosmetic only — persisted for UI state, no real device effect.
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore quota / private mode */
  }
}

function applyTogglesToUI(settings) {
  for (const id of TOGGLE_IDS) {
    const el = document.getElementById(id);
    if (el) el.checked = !!settings[id];
  }
}

function bindToggles() {
  for (const id of TOGGLE_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.addEventListener("change", () => {
      const settings = loadSettings();
      settings[id] = el.checked;
      saveSettings(settings);
    });
  }
}

/* ---------- Views ---------- */
function show(name) {
  view = name;
  decoyEl.hidden = name !== "decoy";
  lockEl.hidden = name !== "lock";
  panelEl.hidden = name !== "panel";
  decoyEl.setAttribute("aria-hidden", name === "decoy" ? "false" : "true");
  if (name === "lock") {
    entered = "";
    updateDots();
    errorEl.hidden = true;
  }
  if (name === "panel") {
    renderPanel();
  }
}

function updateDots() {
  const dots = dotsEl.querySelectorAll(".dot");
  dots.forEach((d, i) => {
    d.classList.toggle("filled", i < entered.length);
  });
}

function onDigit(d) {
  if (view !== "lock" || entered.length >= 4) return;
  errorEl.hidden = true;
  entered += d;
  updateDots();
  if (entered.length === 4) {
    if (entered === PASSCODE) {
      show("panel");
    } else {
      errorEl.hidden = false;
      entered = "";
      setTimeout(updateDots, 180);
    }
  }
}

function onDelete() {
  if (view !== "lock" || !entered.length) return;
  entered = entered.slice(0, -1);
  errorEl.hidden = true;
  updateDots();
}

keypadEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-k]");
  if (!btn) return;
  const k = btn.getAttribute("data-k");
  if (k === "del") onDelete();
  else onDigit(k);
});

lockPanelBtn.addEventListener("click", () => {
  show("decoy");
});

/* ---------- Hidden gesture: double-tap in top ~15% strip ---------- */
const TOP_STRIP_RATIO = 0.15;
const DOUBLE_TAP_MS = 350;
let lastTopTapAt = 0;

function isTopStrip(clientY) {
  const h = window.innerHeight || document.documentElement.clientHeight;
  return clientY <= h * TOP_STRIP_RATIO;
}

function onPointerDown(e) {
  if (view !== "decoy") return;
  // Prefer primary pointer; ignore multi-touch extras.
  if (typeof e.button === "number" && e.button !== 0) return;
  const y = e.clientY;
  if (!isTopStrip(y)) {
    lastTopTapAt = 0;
    return;
  }
  const now = performance.now();
  if (lastTopTapAt && now - lastTopTapAt <= DOUBLE_TAP_MS) {
    lastTopTapAt = 0;
    show("lock");
  } else {
    lastTopTapAt = now;
  }
}

// Use pointerdown so it works for mouse (headless) and touch.
decoyEl.addEventListener("pointerdown", onPointerDown, { passive: true });

/* ---------- Decoy clock ---------- */
const FR_DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const FR_MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function pad2(n) { return String(n).padStart(2, "0"); }

function tickClock() {
  const now = new Date();
  decoyTimeEl.textContent = pad2(now.getHours()) + ":" + pad2(now.getMinutes());
  decoyDateEl.textContent =
    FR_DAYS[now.getDay()] + " " + now.getDate() + " " + FR_MONTHS[now.getMonth()];
}

tickClock();
setInterval(tickClock, 15000);

/* ---------- Boot ---------- */
initPanel();
show("decoy");

/* PWA service worker (app-shell only, same-origin) */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  });
}
