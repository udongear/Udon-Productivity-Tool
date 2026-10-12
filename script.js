import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, addDoc, setDoc, updateDoc, deleteDoc, getDocs, onSnapshot,
  query, orderBy, limit, writeBatch, Bytes,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

/* =========================================================================
   Constants
   ========================================================================= */
const VIEWS = ["projects", "stopwatch", "heatmap", "revenue", "history", "settings"];
// Which data collections each view depends on (used to avoid needless re-renders).
const DEPS = {
  projects: ["projects", "docs", "sessions", "settings"],
  stopwatch: ["projects", "sessions", "settings"],
  heatmap: ["sessions", "projects", "settings"],
  revenue: ["revenue", "projects", "settings"],
  history: ["history"],
  settings: ["settings"],
};
const MAX_FILE = 15 * 1024 * 1024;
const CHUNK = 900 * 1024; // Firestore docs cap at 1 MiB, so files are split into chunks
const DOC_EXTS = ["pdf", "docx", "doc", "odt"];
const ACCEPT = ".pdf,.docx,.doc,.odt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text";
const MIME = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  odt: "application/vnd.oasis.opendocument.text",
};
const LIBS = {
  mammoth: "https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js",
  jszip: "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
};
const REQ = '<b class="req" aria-hidden="true">*</b>'; // red asterisk for required form fields
const APP_TITLE ="Udon Productivity Tool";
const VIEW_TITLES = { projects: "Projects", stopwatch: "Stopwatch", heatmap: "Heatmap", revenue: "Revenue", history: "History", settings: "Settings" };
const PHASE_LABEL ={ work: "Focus", short: "Short break", long: "Long break" };
const CATS = {
  project: { label: "Projects", color: "#8db36f", icon: "folder" },
  doc: { label: "Documents", color: "#c9a45c", icon: "file" },
  timer: { label: "Timer", color: "#6fa39a", icon: "timer" },
  revenue: { label: "Revenue", color: "#c07a5c", icon: "dollar" },
  settings: { label: "Settings", color: "#a19f82", icon: "sliders" },
};
const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "PHP", "MXN", "BRL", "INR", "CHF", "SEK", "NZD", "SGD", "KRW"];

const defaultSettings = () => ({
  statuses: [
    { id: "idea", name: "Idea", color: "#a19f82" },
    { id: "active", name: "In progress", color: "#8db36f" },
    { id: "review", name: "Review", color: "#c9a45c" },
    { id: "paused", name: "Paused", color: "#c07a5c" },
    { id: "done", name: "Done", color: "#6fa39a" },
  ],
  pomodoro: { work: 25, short: 5, long: 15, longEvery: 4, autoStart: false, sound: true },
  currency: "USD",
});

/* =========================================================================
   Icons
   ========================================================================= */
const ICONS = {
  folder: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 10v3.5l2.2 2.2M9.5 2.5h5M19 6l1.5-1.5"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  dollar: '<path d="M12 2.5v19M16.5 6H10a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6H7"/>',
  history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5"/><path d="M3.5 3.5v5h5M12 7.5V12l3 2"/>',
  sliders: '<path d="M4 20v-6M4 10V4M12 20v-8M12 8V4M20 20v-4M20 12V4M2 14h4M10 8h4M18 16h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2l1-12M9 7V4.5h6V7"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  eye: '<path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z"/><circle cx="12" cy="12" r="3"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 16V5M7 10l5-5 5 5M5 20h14"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
  play: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/>',
  stop: '<rect x="5.5" y="5.5" width="13" height="13" rx="2"/>',
  skip: '<path d="M5 5v14l10-7zM19 5v14"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  chevR: '<path d="m9 18 6-6-6-6"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5M12 16h.01"/>',
};
const icon = (name, size = 18) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;

/* =========================================================================
   Helpers
   ========================================================================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const shiftMonth = (mk, n) => { const [y, m] = mk.split("-").map(Number); return monthKey(new Date(y, m - 1 + n, 1)); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const safeColor = (c) => (/^#[0-9a-f]{3,8}$/i.test(c || "") ? c : "#8e9183");
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const extOf = (name) => (String(name).split(".").pop() || "").toLowerCase();

function fmtDur(sec) {
  sec = Math.round(sec || 0);
  if (sec <= 0) return "0m";
  if (sec < 60) return "<1m";
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}
function fmtClock(ms, forceHours = false) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return h || forceHours ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
const fmtDate = (ts, opts = { month: "short", day: "numeric", year: "numeric" }) => new Date(ts).toLocaleDateString(undefined, opts);
const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
function fmtSize(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
function fmtMoney(n, opts = {}) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: S.settings.currency, ...opts }).format(n || 0);
  } catch {
    return (n || 0).toFixed(2);
  }
}
function currencySymbol() {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: S.settings.currency })
      .formatToParts(0).find((p) => p.type === "currency")?.value || "$";
  } catch { return "$"; }
}
// e.g. "USD ($) — US Dollar", "EUR (€) — Euro"
function currencyLabel(code) {
  let sym = code, name = "";
  try {
    sym = new Intl.NumberFormat("en-US", { style: "currency", currency: code, currencyDisplay: "narrowSymbol" })
      .formatToParts(0).find((p) => p.type === "currency")?.value || code;
  } catch { /* keep code */ }
  try { name = new Intl.DisplayNames(["en"], { type: "currency" }).of(code) || ""; } catch { /* no names */ }
  return `${code}${sym !== code ? ` (${sym})` : ""}${name ? ` — ${name}` : ""}`;
}
function hostOf(url) {
  try { return new URL(url).host.replace(/^www\./, "") + new URL(url).pathname.replace(/\/$/, ""); } catch { return url; }
}
function normalizeLink(v) {
  v = (v || "").trim();
  if (!v) return "";
  if (!/^https?:\/\//i.test(v)) v = "https://" + v;
  try { return new URL(v).href; } catch { return ""; }
}
function loadScript(src) {
  loadScript.cache ||= {};
  return (loadScript.cache[src] ||= new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = () => { delete loadScript.cache[src]; rej(new Error("Failed to load " + src)); };
    document.head.appendChild(s);
  }));
}

/* =========================================================================
   State
   ========================================================================= */
const S = {
  user: null,
  settings: defaultSettings(),
  projects: [], docs: [], sessions: [], revenue: [], history: [],
  loaded: new Set(),
  unsub: [],
  view: "projects",
  projFilter: "all", projSearch: "",
  heatRange: "last", heatProject: "all",
  revMonth: monthKey(new Date()), revProject: "",
  histFilter: "all",
  statusDraft: null,
};
let app, auth, db;

const userRef = () => doc(db, "users", S.user.uid);
const col = (...path) => collection(db, "users", S.user.uid, ...path);
const dref = (...path) => doc(db, "users", S.user.uid, ...path);

const statusOf = (id) => S.settings.statuses.find((s) => s.id === id) || S.settings.statuses[0] || { id: "", name: "—", color: "#8e9183" };
// <option>s for a status dropdown, each tinted with its color from Settings.
const statusOptions = (selectedId) => S.settings.statuses.map((x) =>
  `<option value="${esc(x.id)}" style="color:${safeColor(x.color)}" ${x.id === selectedId ? "selected" : ""}>● ${esc(x.name)}</option>`).join("");
const projectById = (id) => S.projects.find((p) => p.id === id);
const projName = (rec) => projectById(rec.projectId)?.name || (rec.projectName ? `${rec.projectName} (deleted)` : "Deleted project");
const projColor = (id) => safeColor(projectById(id) ? statusOf(projectById(id).status).color : "#5b5f55");

function normalizeSettings(raw = {}) {
  const d = defaultSettings();
  const statuses = Array.isArray(raw.statuses) && raw.statuses.length ? raw.statuses : d.statuses;
  return {
    statuses: statuses.map((s) => ({ id: String(s.id), name: String(s.name || "Untitled"), color: safeColor(s.color) })),
    pomodoro: { ...d.pomodoro, ...(raw.pomodoro || {}) },
    currency: CURRENCIES.includes(raw.currency) ? raw.currency : d.currency,
  };
}

/* =========================================================================
   Boot & auth
   ========================================================================= */
async function boot() {
  $$("[data-icon]").forEach((el) => el.insertAdjacentHTML("afterbegin", icon(el.dataset.icon, 20)));

  let cfg = firebaseConfig;
  if (!cfg?.apiKey || cfg.apiKey.startsWith("YOUR_")) {
    // On Firebase Hosting the config is served automatically.
    try {
      const r = await fetch("/__/firebase/init.json");
      cfg = r.ok ? await r.json() : null;
    } catch { cfg = null; }
  }
  if (!cfg?.apiKey) {
    $("#boot").hidden = true;
    $("#auth-screen").hidden = false;
    $("#google-btn").disabled = true;
    showAuthError(`Firebase isn't configured yet. Paste your web app config into <code>firebase-config.js</code>, or deploy with <code>firebase deploy</code> so it loads automatically. See README.md.`);
    return;
  }

  app = initializeApp(cfg);
  auth = getAuth(app);
  db = getFirestore(app);

  $("#google-btn").addEventListener("click", signIn);
  onAuthStateChanged(auth, (user) => (user ? startSession(user) : endSession()));
}

function showAuthError(html) {
  const el = $("#auth-error");
  el.innerHTML = html;
  el.hidden = false;
}

async function signIn() {
  $("#auth-error").hidden = true;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    if (err.code === "auth/popup-blocked") return signInWithRedirect(auth, provider);
    if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") return;
    const hint = err.code === "auth/unauthorized-domain"
      ? ` Add <code>${esc(location.hostname)}</code> to Authentication → Settings → Authorized domains.`
      : "";
    showAuthError(`Sign-in failed: ${esc(err.code || err.message)}.${hint}`);
  }
}

function startSession(user) {
  if (S.user?.uid === user.uid) return;
  if (S.user) endSession();
  S.user = user;
  $("#boot").hidden = true;
  $("#auth-screen").hidden = true;
  $("#app").hidden = false;
  renderSidebarUser();
  loadTimer();
  subscribe();
  route();
  clearInterval(startSession.ticker);
  startSession.ticker = setInterval(tick, 250);
}

function endSession() {
  S.unsub.forEach((fn) => fn());
  S.unsub = [];
  clearInterval(startSession.ticker);
  modals.slice().forEach((m) => m.close());
  Object.assign(S, { user: null, projects: [], docs: [], sessions: [], revenue: [], history: [], loaded: new Set(), settings: defaultSettings() });
  T = null;
  updateTitle();
  $("#boot").hidden = true;
  $("#app").hidden = true;
  $("#auth-screen").hidden = false;
}

function renderSidebarUser() {
  const u = S.user;
  $("#sidebar-user").innerHTML = `${avatarHTML(u)}<div><b>${esc(u.displayName || "You")}</b><span>${esc(u.email || "")}</span></div>`;
}
function avatarHTML(u, cls = "") {
  return u.photoURL
    ? `<img class="avatar ${cls}" src="${esc(u.photoURL)}" alt="" referrerpolicy="no-referrer">`
    : `<div class="avatar ${cls}">${esc((u.displayName || u.email || "?")[0].toUpperCase())}</div>`;
}

/* =========================================================================
   Data sync
   ========================================================================= */
function subscribe() {
  const u = S.user;
  setDoc(userRef(), {
    profile: { name: u.displayName || "", email: u.email || "", photo: u.photoURL || "", lastLogin: Date.now() },
  }, { merge: true }).catch(console.error);

  const onErr = (what) => (err) => { console.error(what, err); toast(`Couldn't load ${what}: ${err.code || err.message}`, "error"); };
  const listen = (key, ref, map) => S.unsub.push(onSnapshot(ref, (snap) => {
    S[key] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (map) S[key] = map(S[key]);
    S.loaded.add(key);
    changed(key);
  }, onErr(key)));

  S.unsub.push(onSnapshot(userRef(), (snap) => {
    const data = snap.data();
    if (!data?.settings) {
      setDoc(userRef(), { settings: defaultSettings() }, { merge: true }).catch(console.error);
    }
    S.settings = normalizeSettings(data?.settings);
    S.loaded.add("settings");
    changed("settings");
  }, onErr("settings")));

  listen("projects", query(col("projects"), orderBy("createdAt", "desc")));
  listen("docs", col("docs"));
  listen("sessions", query(col("sessions"), orderBy("start", "desc")));
  listen("revenue", col("revenue"));
  listen("history", query(col("history"), orderBy("ts", "desc"), limit(400)));
}

let pendingKeys = new Set(), rafId = 0;
function changed(key) {
  pendingKeys.add(key);
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    const keys = pendingKeys;
    pendingKeys = new Set();
    if (!S.user) return;
    if (DEPS[S.view].some((k) => keys.has(k))) renderView(S.view);
    if (keys.has("docs") || keys.has("settings") || keys.has("projects")) modals.forEach((m) => m.refresh?.());
  });
}

function logHistory(cat, text) {
  addDoc(col("history"), { cat, text, ts: Date.now() }).catch(console.error);
}

/* =========================================================================
   Routing
   ========================================================================= */
function route() {
  if (!S.user) return;
  const v = location.hash.slice(1);
  S.view = VIEWS.includes(v) ? v : "projects";
  $$(".nav-item").forEach((a) => a.classList.toggle("active", a.dataset.view === S.view));
  $$(".view").forEach((s) => (s.hidden = s.id !== `view-${S.view}`));
  hideTip();
  if (!T?.running) updateTitle();
  renderView(S.view);
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);

function renderView(v) {
  const el = $(`#view-${v}`);
  if (!DEPS[v].every((k) => S.loaded.has(k))) {
    el.innerHTML = `<div class="viewer-msg" style="margin:80px auto"><span class="spinner"></span></div>`;
    return;
  }
  ({ projects: renderProjects, stopwatch: renderStopwatch, heatmap: renderHeatmap, revenue: renderRevenue, history: renderHistory, settings: renderSettings })[v]();
}

const emptyState = (ic, title, text, extra = "") =>
  `<div class="empty"><div class="empty-ico">${icon(ic, 24)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${extra}</div>`;

/* =========================================================================
   UI primitives: modal, confirm, toast, tooltip
   ========================================================================= */
const modals = [];
function openModal({ title, body, size = "", actions = "", onClose }) {
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop";
  wrap.innerHTML = `
    <div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="modal-head"><h2>${esc(title)}</h2><div class="modal-actions">${actions}</div>
        <button class="icon-btn" data-role="close" aria-label="Close">${icon("x")}</button></header>
      <div class="modal-body">${body}</div>
    </div>`;
  document.body.appendChild(wrap);
  let closed = false;
  const prevFocus = document.activeElement;
  const m = {
    el: wrap,
    refresh: null,
    close() {
      if (closed) return;
      closed = true;
      modals.splice(modals.indexOf(m), 1);
      wrap.classList.remove("open");
      setTimeout(() => wrap.remove(), 180);
      onClose?.();
      prevFocus?.focus?.();
    },
    // User-initiated close (Esc, backdrop, ✕, Cancel): asks first if `guard` reports unsaved changes.
    guard: null,
    async dismiss() {
      if (m.guard?.() && !(await confirmDialog("You have unsaved changes. Close without saving?", { title: "Discard changes", ok: "Discard", danger: true }))) return;
      m.close();
    },
  };
  wrap.addEventListener("mousedown", (e) => { if (e.target === wrap) m.dismiss(); });
  $$("[data-role=close],[data-role=cancel]", wrap).forEach((b) => b.addEventListener("click", m.dismiss));
  modals.push(m);
  requestAnimationFrame(() => {
    wrap.classList.add("open");
    ($("input:not([type=hidden]):not([type=file]), select, textarea", wrap.querySelector(".modal-body")) || $("[data-role=close]", wrap)).focus();
  });
  return m;
}

function confirmDialog(message, { title = "Are you sure?", ok = "Confirm", danger = false } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const m = openModal({
      title, size: "sm",
      body: `<p class="confirm-text">${esc(message)}</p>
        <div class="form-foot"><div class="spacer"></div>
        <button class="btn ghost" data-role="cancel">Cancel</button>
        <button class="btn ${danger ? "danger solid" : "primary"}" data-role="ok">${esc(ok)}</button></div>`,
      onClose: () => { if (!answered) resolve(false); },
    });
    const okBtn = $("[data-role=ok]", m.el);
    okBtn.addEventListener("click", () => { answered = true; resolve(true); m.close(); });
    requestAnimationFrame(() => okBtn.focus());
  });
}

function toast(msg, type = "ok") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  $("#toasts").appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 300); }, type === "error" ? 5000 : 2800);
}

const tip = () => $("#tooltip");
function showTip(target, html) {
  const t = tip();
  t.innerHTML = html;
  t.hidden = false;
  const r = target.getBoundingClientRect();
  const tw = t.offsetWidth, th = t.offsetHeight;
  let x = r.left + r.width / 2 - tw / 2;
  let y = r.top - th - 8;
  x = Math.max(8, Math.min(x, innerWidth - tw - 8));
  if (y < 8) y = r.bottom + 8;
  t.style.left = `${x}px`;
  t.style.top = `${y}px`;
}
function hideTip() { const t = tip(); if (t) t.hidden = true; }

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modals.length) modals[modals.length - 1].dismiss();
});

/* =========================================================================
   Global event delegation
   ========================================================================= */
const actions = {};
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el || !S.user) return;
  if (el.dataset.action === "open-project" && e.target.closest("a, select, button")) return;
  const fn = actions[el.dataset.action];
  if (fn) { e.preventDefault(); fn(el, e); }
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.matches(".status-select")) changeStatus(t.dataset.pid, t.value);
  else if (t.id === "timer-project") { T.projectId = t.value; saveTimer(); updateTimerDisplay(); }
  else if (t.id === "heat-range") { S.heatRange = t.value; renderHeatmap(); }
  else if (t.id === "heat-project") { S.heatProject = t.value; renderHeatmap(); }
  else if (t.id === "rev-project") S.revProject = t.value;
  else if (t.id === "currency") saveSetting("currency", t.value, `Currency set to ${t.value}`);
});
document.addEventListener("input", (e) => {
  if (e.target.id === "proj-search") { S.projSearch = e.target.value; renderProjectGrid(); }
});
document.addEventListener("keydown", (e) => {
  const card = e.target.closest?.(".project[data-action=open-project]");
  if (card && e.target === card && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openProjectModal(card.dataset.id); }
});

/* =========================================================================
   PROJECTS
   ========================================================================= */
function totalsByProject() {
  const t = {};
  for (const s of S.sessions) t[s.projectId] = (t[s.projectId] || 0) + (s.seconds || 0);
  return t;
}

function renderProjects() {
  const v = $("#view-projects");
  const counts = {};
  S.projects.forEach((p) => (counts[p.status] = (counts[p.status] || 0) + 1));
  if (S.projFilter !== "all" && !S.settings.statuses.some((s) => s.id === S.projFilter)) S.projFilter = "all";
  const n = S.projects.length;
  v.innerHTML = `
    <header class="view-head">
      <div><h1>Projects</h1><p class="muted">${n} project${n === 1 ? "" : "s"}</p></div>
      <button class="btn primary" data-action="new-project">${icon("plus")}New project</button>
    </header>
    ${n ? `<div class="toolbar">
      <div class="search">${icon("search", 16)}<input id="proj-search" type="search" placeholder="Search projects" value="${esc(S.projSearch)}" aria-label="Search projects"></div>
      <div class="chips">
        <button class="chip ${S.projFilter === "all" ? "on" : ""}" data-action="proj-filter" data-id="all">All <span>${n}</span></button>
        ${S.settings.statuses.map((s) => `<button class="chip ${S.projFilter === s.id ? "on" : ""}" data-action="proj-filter" data-id="${esc(s.id)}"><i class="dot" style="--c:${safeColor(s.color)}"></i>${esc(s.name)} <span>${counts[s.id] || 0}</span></button>`).join("")}
      </div>
    </div>` : ""}
    <div id="proj-grid" class="proj-grid"></div>`;
  renderProjectGrid();
}

function renderProjectGrid() {
  const grid = $("#proj-grid");
  if (!grid) return;
  if (!S.projects.length) {
    grid.innerHTML = emptyState("folder", "No projects yet", "Create your first project to start tracking time, revenue and documentation.",
      `<button class="btn primary" data-action="new-project">${icon("plus")}New project</button>`);
    return;
  }
  const q = S.projSearch.trim().toLowerCase();
  const list = S.projects.filter((p) =>
    (S.projFilter === "all" || statusOf(p.status).id === S.projFilter) &&
    (!q || `${p.name} ${p.subname || ""}`.toLowerCase().includes(q)));
  if (!list.length) { grid.innerHTML = emptyState("search", "Nothing matches", "Try another search or status filter."); return; }
  const time = totalsByProject();
  const docCount = {};
  S.docs.forEach((d) => (docCount[d.projectId] = (docCount[d.projectId] || 0) + 1));
  grid.innerHTML = list.map((p) => projectCard(p, time[p.id] || 0, docCount[p.id] || 0)).join("");
}

function projectCard(p, secs, docs) {
  const s = statusOf(p.status);
  const link = /^https?:\/\//i.test(p.link || "") ? p.link : "";
  return `
  <article class="card project" data-action="open-project" data-id="${p.id}" style="--c:${safeColor(s.color)}" tabindex="0">
    <div class="project-top">
      <select class="status-select" data-pid="${p.id}" aria-label="Status">
        ${statusOptions(s.id)}
      </select>
      <button class="icon-btn" data-action="track-project" data-id="${p.id}" title="Start timer for this project" aria-label="Start timer">${icon("play", 16)}</button>
    </div>
    <h3 class="project-name">${esc(p.name)}</h3>
    ${p.subname ? `<p class="project-sub">${esc(p.subname)}</p>` : ""}
    ${link ? `<a class="project-link" href="${esc(link)}" target="_blank" rel="noopener noreferrer">${icon("link", 14)}<span>${esc(hostOf(link))}</span></a>` : ""}
    <div class="project-meta">
      <span title="Time tracked">${icon("timer", 15)}${fmtDur(secs)}</span>
      <span title="Documents">${icon("file", 15)}${docs} doc${docs === 1 ? "" : "s"}</span>
    </div>
  </article>`;
}

actions["new-project"] = () => openProjectModal(null);
actions["open-project"] = (el) => openProjectModal(el.dataset.id);
actions["proj-filter"] = (el) => { S.projFilter = el.dataset.id; renderProjects(); };
actions["track-project"] = (el) => {
  if (T.running || elapsed() > 0) {
    if (T.projectId !== el.dataset.id) toast("A timer is already running — stop it first", "error");
  } else { T.projectId = el.dataset.id; saveTimer(); }
  location.hash = "stopwatch";
};

async function changeStatus(pid, statusId) {
  const p = projectById(pid);
  if (!p || p.status === statusId) return;
  const from = statusOf(p.status).name, to = statusOf(statusId).name;
  try {
    await updateDoc(dref("projects", pid), { status: statusId, updatedAt: Date.now() });
    logHistory("project", `“${p.name}” status: ${from} → ${to}`);
  } catch (err) { console.error(err); toast("Couldn't update status", "error"); }
}

function openProjectModal(id) {
  const p = id ? projectById(id) : null;
  if (id && !p) return;
  const queued = [];
  const uploading = new Map();
  const m = openModal({
    title: p ? "Edit project" : "New project",
    size: "lg",
    body: `
    <form class="form" autocomplete="off" novalidate>
      <div class="row2">
        <label class="field"><span>Name${REQ}</span>
          <input type="text" name="name" required maxlength="80" value="${esc(p?.name || "")}" placeholder="e.g. Ceramics shop website"></label>
        <label class="field"><span>Subname</span>
          <input type="text" name="subname" maxlength="120" value="${esc(p?.subname || "")}" placeholder="Client, tagline or version"></label>
      </div>
      <div class="row2">
        <label class="field"><span>Status${REQ}</span>
          <select name="status" class="status-field" style="--c:${safeColor(statusOf(p?.status).color)}">${statusOptions(statusOf(p?.status).id)}</select></label>
        <label class="field"><span>Link</span>
          <input type="url" name="link" value="${esc(p?.link || "")}" placeholder="https://"></label>
      </div>
      <label class="field tasks-field"><span>Tasks</span>
        <textarea name="tasks" rows="9" maxlength="20000">${esc(p?.tasks || "")}</textarea></label>
      <section class="docs-block">
        <div class="docs-head"><h4>Documentation</h4>
          <label class="btn small ghost">${icon("upload", 16)}Attach<input type="file" multiple hidden accept="${ACCEPT}"></label></div>
        <div class="doc-list"></div>
        <p class="hint">PDF, Word (.docx / .doc) or OpenDocument (.odt), up to 15 MB each.</p>
      </section>
      <div class="form-foot">
        ${p ? `<button type="button" class="btn danger ghost" data-role="delete">${icon("trash", 16)}Delete</button>` : ""}
        <div class="spacer"></div>
        <button type="button" class="btn ghost" data-role="cancel">Cancel</button>
        <button type="submit" class="btn primary">${p ? "Save changes" : "Create project"}</button>
      </div>
    </form>`,
  });
  const form = $("form", m.el);
  const listEl = $(".doc-list", m.el);
  const fileInput = $("input[type=file]", m.el);

  const draw = () => {
    const docs = p ? S.docs.filter((d) => d.projectId === p.id).sort((a, b) => b.createdAt - a.createdAt) : [];
    const rows = [
      ...[...uploading.values()].map((f) => docRow(f, "uploading")),
      ...queued.map((f, i) => docRow({ name: f.name, size: f.size }, "queued", i)),
      ...docs.map((d) => docRow(d, "saved")),
    ];
    listEl.innerHTML = rows.length ? rows.join("") : `<p class="doc-empty">No documents attached yet.</p>`;
  };
  m.refresh = draw;
  draw();

  let dirty = false;
  form.addEventListener("input", (e) => { if (e.target !== fileInput) dirty = true; });
  m.guard = () => dirty || queued.length > 0;
  const statusSel = form.elements.namedItem("status");
  statusSel.addEventListener("change", () => statusSel.style.setProperty("--c", safeColor(statusOf(statusSel.value).color)));

  fileInput.addEventListener("change", async () => {
    const files = [...fileInput.files];
    fileInput.value = "";
    for (const f of files) {
      if (!DOC_EXTS.includes(extOf(f.name))) { toast(`${f.name}: only PDF, Word or ODT files`, "error"); continue; }
      if (f.size > MAX_FILE) { toast(`${f.name} is over 15 MB`, "error"); continue; }
      if (!p) { queued.push(f); draw(); continue; }
      const key = uid();
      uploading.set(key, { name: f.name, size: f.size });
      draw();
      try { await uploadDoc(p, f); toast(`Attached ${f.name}`); }
      catch (err) { console.error(err); toast(`Upload failed: ${f.name}`, "error"); }
      uploading.delete(key);
      draw();
    }
  });

  listEl.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-doc]");
    if (!b) return;
    if (b.dataset.doc === "unqueue") { queued.splice(+b.dataset.idx, 1); draw(); return; }
    const d = S.docs.find((x) => x.id === b.dataset.id);
    if (!d) return;
    if (b.dataset.doc === "view") viewDoc(d);
    else if (b.dataset.doc === "download") downloadDoc(d);
    else if (b.dataset.doc === "delete") {
      if (await confirmDialog(`Remove “${d.name}” from this project?`, { title: "Remove document", ok: "Remove", danger: true })) {
        try { await deleteDocFile(d); toast("Document removed"); } catch (err) { console.error(err); toast("Couldn't remove document", "error"); }
      }
    }
  });

  $("[data-role=delete]", m.el)?.addEventListener("click", async () => {
    const docs = S.docs.filter((d) => d.projectId === p.id).length;
    const ok = await confirmDialog(
      `Delete “${p.name}”${docs ? ` and its ${docs} document${docs === 1 ? "" : "s"}` : ""}? Logged time and revenue stay in your heatmap and reports.`,
      { title: "Delete project", ok: "Delete project", danger: true });
    if (!ok) return;
    m.close();
    try { await deleteProject(p); toast(`Deleted ${p.name}`); } catch (err) { console.error(err); toast("Couldn't delete project", "error"); }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim();
    if (!name) { form.elements.namedItem("name").focus(); toast("Give the project a name", "error"); return; }
    const rawLink = String(fd.get("link") || "").trim();
    const link = normalizeLink(rawLink);
    if (rawLink && !link) { form.elements.namedItem("link").focus(); toast("That link doesn't look valid", "error"); return; }
    const data = {
      name, subname: String(fd.get("subname") || "").trim(), status: String(fd.get("status")), link,
      tasks: String(fd.get("tasks") || "").replace(/\s+$/, ""),
    };
    const submit = $("button[type=submit]", form);
    submit.disabled = true;
    try {
      if (p) {
        const changes = [];
        if (data.name !== p.name) changes.push(`renamed to “${data.name}”`);
        if (data.subname !== (p.subname || "")) changes.push("subname updated");
        if (data.status !== statusOf(p.status).id) changes.push(`status: ${statusOf(p.status).name} → ${statusOf(data.status).name}`);
        if (data.link !== (p.link || "")) changes.push(data.link ? "link updated" : "link removed");
        if (data.tasks !== (p.tasks || "")) changes.push("tasks updated");
        if (changes.length) {
          await updateDoc(dref("projects", p.id), { ...data, updatedAt: Date.now() });
          logHistory("project", `“${p.name}” ${changes.join(", ")}`);
          toast("Project saved");
        }
        m.close();
      } else {
        const ref = await addDoc(col("projects"), { ...data, createdAt: Date.now(), updatedAt: Date.now() });
        logHistory("project", `Created project “${name}”`);
        m.close();
        toast(`Created ${name}`);
        for (const f of queued) {
          try { await uploadDoc({ id: ref.id, name }, f); } catch (err) { console.error(err); toast(`Upload failed: ${f.name}`, "error"); }
        }
      }
    } catch (err) {
      console.error(err);
      toast("Couldn't save project", "error");
      submit.disabled = false;
    }
  });
}

function docRow(d, state, idx) {
  const ext = extOf(d.name);
  const meta = state === "saved" ? `${fmtSize(d.size)} · ${fmtDate(d.createdAt)}`
    : state === "queued" ? `${fmtSize(d.size)} · uploads when you create the project` : `${fmtSize(d.size)} · uploading…`;
  const btns = state === "saved"
    ? `<button type="button" class="icon-btn sm" data-doc="view" data-id="${d.id}" title="View" aria-label="View">${icon("eye", 16)}</button>
       <button type="button" class="icon-btn sm" data-doc="download" data-id="${d.id}" title="Download" aria-label="Download">${icon("download", 16)}</button>
       <button type="button" class="icon-btn sm" data-doc="delete" data-id="${d.id}" title="Remove" aria-label="Remove">${icon("trash", 16)}</button>`
    : state === "queued"
      ? `<button type="button" class="icon-btn sm" data-doc="unqueue" data-idx="${idx}" title="Remove" aria-label="Remove">${icon("x", 16)}</button>`
      : `<span class="spinner sm"></span>`;
  return `<div class="doc-row ${state}">
    <span class="doc-ico ext-${esc(ext)}">${esc(ext.toUpperCase() || "FILE")}</span>
    <div class="doc-info"><b title="${esc(d.name)}">${esc(d.name)}</b><small>${meta}</small></div>${btns}</div>`;
}

async function deleteProject(p) {
  const docs = S.docs.filter((d) => d.projectId === p.id);
  for (const d of docs) await deleteDocFile(d, true);
  await deleteDoc(dref("projects", p.id));
  logHistory("project", `Deleted project “${p.name}”${docs.length ? ` (with ${docs.length} document${docs.length === 1 ? "" : "s"})` : ""}`);
  if (T && T.projectId === p.id && !T.running && elapsed() === 0) { T.projectId = ""; saveTimer(); }
}

/* ---------- Documents (stored as chunked bytes in Firestore) ---------- */
async function uploadDoc(project, file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const metaRef = doc(col("docs"));
  const n = Math.max(1, Math.ceil(bytes.length / CHUNK));
  for (let i = 0; i < n; i++) {
    await setDoc(dref("docs", metaRef.id, "chunks", String(i)), {
      i, data: Bytes.fromUint8Array(bytes.slice(i * CHUNK, (i + 1) * CHUNK)),
    });
  }
  // Metadata is written last so a document only appears once fully uploaded.
  await setDoc(metaRef, {
    projectId: project.id, name: file.name, size: file.size, ext: extOf(file.name), chunks: n, createdAt: Date.now(),
  });
  logHistory("doc", `Attached “${file.name}” to “${project.name}”`);
}

async function deleteDocFile(d, silent = false) {
  const chunks = await getDocs(col("docs", d.id, "chunks"));
  const batch = writeBatch(db);
  chunks.forEach((c) => batch.delete(c.ref));
  batch.delete(dref("docs", d.id));
  await batch.commit();
  bytesCache.delete(d.id);
  if (!silent) logHistory("doc", `Removed “${d.name}” from “${projectById(d.projectId)?.name || "a project"}”`);
}

const bytesCache = new Map();
async function fetchDocBytes(d) {
  if (bytesCache.has(d.id)) return bytesCache.get(d.id);
  const snap = await getDocs(col("docs", d.id, "chunks"));
  const parts = snap.docs.map((c) => c.data()).sort((a, b) => a.i - b.i).map((c) => c.data.toUint8Array());
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  if (bytesCache.size > 6) bytesCache.delete(bytesCache.keys().next().value);
  bytesCache.set(d.id, out);
  return out;
}

async function downloadDoc(d) {
  try {
    const bytes = await fetchDocBytes(d);
    const url = URL.createObjectURL(new Blob([bytes], { type: MIME[extOf(d.name)] || "application/octet-stream" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: d.name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (err) { console.error(err); toast("Download failed", "error"); }
}

async function viewDoc(d) {
  const ext = extOf(d.name);
  let objectUrl = null;
  const m = openModal({
    title: d.name, size: "viewer",
    actions: `<button class="btn small ghost" data-role="dl">${icon("download", 16)}Download</button>`,
    body: `<div class="viewer-body"><div class="viewer-msg"><span class="spinner"></span>Loading document…</div></div>`,
    onClose: () => objectUrl && URL.revokeObjectURL(objectUrl),
  });
  $("[data-role=dl]", m.el).addEventListener("click", () => downloadDoc(d));
  const body = $(".viewer-body", m.el);
  try {
    const bytes = await fetchDocBytes(d);
    if (ext === "pdf") {
      objectUrl = URL.createObjectURL(new Blob([bytes], { type: MIME.pdf }));
      body.innerHTML = `<iframe class="pdf-frame" src="${objectUrl}" title="${esc(d.name)}"></iframe>`;
      $(".modal-actions", m.el).insertAdjacentHTML("afterbegin",
        `<a class="btn small ghost" href="${objectUrl}" target="_blank" rel="noopener">${icon("external", 16)}Open</a>`);
    } else if (ext === "docx") {
      await loadScript(LIBS.mammoth);
      const res = await window.mammoth.convertToHtml({ arrayBuffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
      const page = document.createElement("article");
      page.className = "doc-page";
      page.innerHTML = res.value || `<p><em>This document appears to be empty.</em></p>`;
      $$("a[href]", page).forEach((a) => { if (!/^https?:|^mailto:|^#/i.test(a.getAttribute("href"))) a.removeAttribute("href"); else if (!a.getAttribute("href").startsWith("#")) { a.target = "_blank"; a.rel = "noopener noreferrer"; } });
      body.replaceChildren(page);
    } else if (ext === "odt") {
      await loadScript(LIBS.jszip);
      const page = document.createElement("article");
      page.className = "doc-page";
      await renderOdt(bytes, page);
      body.replaceChildren(page);
    } else {
      body.innerHTML = `<div class="viewer-msg">${icon("file", 36)}
        <p>Legacy <b>.doc</b> files can't be previewed in the browser. Download it, or re-save it as .docx or .odt to preview here.</p>
        <button class="btn primary" data-role="dl2">${icon("download", 16)}Download</button></div>`;
      $("[data-role=dl2]", body).addEventListener("click", () => downloadDoc(d));
    }
  } catch (err) {
    console.error(err);
    body.innerHTML = `<div class="viewer-msg">${icon("alert", 36)}<p>Couldn't render this document. You can still download it.</p></div>`;
  }
}

/** Minimal OpenDocument Text renderer: headings, paragraphs, basic formatting, lists, tables, links, images. */
async function renderOdt(bytes, page) {
  const zip = await window.JSZip.loadAsync(bytes);
  const xml = await zip.file("content.xml")?.async("string");
  if (!xml) throw new Error("No content.xml");
  const dom = new DOMParser().parseFromString(xml, "application/xml");
  const OFFICE = "urn:oasis:names:tc:opendocument:xmlns:office:1.0";

  // Collect simple character styles (bold / italic / underline / strike).
  const styles = {};
  const readStyles = (root) => {
    for (const st of root.getElementsByTagNameNS("*", "style")) {
      const name = st.getAttribute("style:name");
      const tp = [...st.children].find((c) => c.localName === "text-properties");
      if (!name || !tp) continue;
      styles[name] = {
        bold: tp.getAttribute("fo:font-weight") === "bold",
        italic: tp.getAttribute("fo:font-style") === "italic",
        underline: (tp.getAttribute("style:text-underline-style") || "none") !== "none",
        strike: (tp.getAttribute("style:text-line-through-style") || "none") !== "none",
      };
    }
  };
  const stylesXml = await zip.file("styles.xml")?.async("string");
  if (stylesXml) readStyles(new DOMParser().parseFromString(stylesXml, "application/xml"));
  readStyles(dom);

  const applyStyle = (src, el) => {
    const st = styles[src.getAttribute("text:style-name")];
    if (!st || el.nodeType !== 1) return;
    if (st.bold) el.style.fontWeight = "bold";
    if (st.italic) el.style.fontStyle = "italic";
    const deco = [st.underline && "underline", st.strike && "line-through"].filter(Boolean).join(" ");
    if (deco) el.style.textDecoration = deco;
  };
  const SKIP = new Set(["sequence-decls", "tracked-changes", "soft-page-break", "bookmark", "bookmark-start", "bookmark-end",
    "table-columns", "table-column", "annotation", "variable-decls", "user-field-decls", "forms", "note-citation", "covered-table-cell"]);

  const conv = (node) => {
    if (node.nodeType === 3) return document.createTextNode(node.nodeValue);
    if (node.nodeType !== 1 || SKIP.has(node.localName)) return null;
    let el;
    switch (node.localName) {
      case "h": el = document.createElement(`h${Math.min(6, Math.max(1, +node.getAttribute("text:outline-level") || 1))}`); break;
      case "p": el = document.createElement("p"); break;
      case "span": el = document.createElement("span"); break;
      case "a": {
        el = document.createElement("a");
        const href = node.getAttribute("xlink:href") || "";
        if (/^(https?:|mailto:)/i.test(href)) { el.href = href; el.target = "_blank"; el.rel = "noopener noreferrer"; }
        break;
      }
      case "list": el = document.createElement("ul"); break;
      case "list-item": case "list-header": el = document.createElement("li"); break;
      case "table": el = document.createElement("table"); break;
      case "table-row": el = document.createElement("tr"); break;
      case "table-cell": {
        el = document.createElement("td");
        const cs = +node.getAttribute("table:number-columns-spanned"), rs = +node.getAttribute("table:number-rows-spanned");
        if (cs > 1) el.colSpan = cs;
        if (rs > 1) el.rowSpan = rs;
        break;
      }
      case "s": return document.createTextNode(" ".repeat(+node.getAttribute("text:c") || 1));
      case "tab": return document.createTextNode(" ");
      case "line-break": return document.createElement("br");
      case "image": {
        const href = node.getAttribute("xlink:href");
        const f = href && zip.file(href.replace(/^\.\//, ""));
        if (!f) return null;
        const img = document.createElement("img");
        img.alt = "";
        f.async("blob").then((b) => (img.src = URL.createObjectURL(b)));
        return img;
      }
      default: el = document.createDocumentFragment();
    }
    applyStyle(node, el);
    for (const c of node.childNodes) { const out = conv(c); if (out) el.appendChild(out); }
    return el;
  };

  const body = dom.getElementsByTagNameNS(OFFICE, "text")[0];
  if (!body) throw new Error("Not a text document");
  for (const c of body.childNodes) { const out = conv(c); if (out) page.appendChild(out); }
  if (!page.textContent.trim() && !page.querySelector("img")) page.innerHTML = `<p><em>This document appears to be empty.</em></p>`;
}

/* =========================================================================
   STOPWATCH & POMODORO
   ========================================================================= */
let T = null;
const timerKey = () => `udon.timer.${S.user.uid}`;
const defaultTimer = () => ({ mode: "stopwatch", projectId: "", running: false, startedAt: 0, acc: 0, segStart: 0, phase: "work", cycle: 0 });
function loadTimer() {
  try { T = { ...defaultTimer(), ...JSON.parse(localStorage.getItem(timerKey()) || "{}") }; } catch { T = defaultTimer(); }
}
function saveTimer() { try { localStorage.setItem(timerKey(), JSON.stringify(T)); } catch { /* storage unavailable */ } }
const elapsed = () => (T ? T.acc + (T.running ? Date.now() - T.startedAt : 0) : 0);
const phaseMs = (p = T.phase) => Math.max(1, Number(S.settings.pomodoro[p]) || 1) * 60000;

function resetTimer(keepCycle = false) {
  Object.assign(T, { running: false, startedAt: 0, acc: 0, segStart: 0 });
  if (!keepCycle) { T.phase = "work"; T.cycle = 0; }
  saveTimer();
}

function tick() {
  if (!T || !S.loaded.has("settings")) return;
  if (T.mode === "pomodoro" && T.running && elapsed() >= phaseMs()) completePhase();
  updateTimerDisplay();
}

function completePhase() {
  const finished = T.phase;
  const P = S.settings.pomodoro;
  if (finished === "work") {
    logSession(T.projectId, T.segStart, phaseMs() / 1000, "pomodoro");
    T.cycle += 1;
    T.phase = T.cycle % P.longEvery === 0 ? "long" : "short";
  } else {
    T.phase = "work";
  }
  const now = Date.now();
  Object.assign(T, { acc: 0, running: !!P.autoStart, startedAt: P.autoStart ? now : 0, segStart: P.autoStart ? now : 0 });
  saveTimer();
  chime();
  notify(finished === "work" ? "Focus session complete" : "Break's over",
    finished === "work" ? `Time for a ${T.phase === "long" ? "long" : "short"} break.` : "Back to focus.");
  if (S.view === "stopwatch") renderStopwatch();
}

function logSession(projectId, start, seconds, kind) {
  seconds = Math.round(seconds);
  const p = projectById(projectId);
  const name = p?.name || "Unknown project";
  addDoc(col("sessions"), {
    projectId, projectName: name, start, end: start + seconds * 1000, seconds,
    date: dateKey(new Date(start)), kind, createdAt: Date.now(),
  }).then(() => logHistory("timer", `Logged ${fmtDur(seconds)} on “${name}”${kind === "pomodoro" ? " (Pomodoro)" : ""}`))
    .catch((err) => { console.error(err); toast("Couldn't save session", "error"); });
  toast(`Logged ${fmtDur(seconds)} to ${name}`);
}

actions["timer-mode"] = (el) => {
  const mode = el.dataset.mode;
  if (mode === T.mode) return;
  if (T.running || elapsed() > 0) { toast("Stop the current timer first", "error"); return; }
  T.mode = mode;
  resetTimer();
  renderStopwatch();
};
actions["timer-start"] = () => {
  if (!T.projectId || !projectById(T.projectId)) {
    toast(S.projects.length ? "Pick a project first" : "Create a project first", "error");
    $("#timer-project")?.focus();
    return;
  }
  const now = Date.now();
  if (!T.segStart) T.segStart = now;
  T.running = true;
  T.startedAt = now;
  saveTimer();
  if (T.mode === "pomodoro" && "Notification" in window && Notification.permission === "default") Notification.requestPermission();
  renderStopwatch();
};
actions["timer-pause"] = () => {
  T.acc += Date.now() - T.startedAt;
  T.running = false;
  saveTimer();
  renderStopwatch();
};
actions["timer-stop"] = () => {
  const secs = elapsed() / 1000;
  const loggable = T.mode === "stopwatch" || T.phase === "work";
  if (loggable && secs >= 60) logSession(T.projectId, T.segStart, secs, T.mode);
  else if (loggable && secs > 0) toast("Under a minute — not logged");
  resetTimer();
  renderStopwatch();
};
actions["timer-skip"] = () => {
  const secs = elapsed() / 1000;
  if (T.phase === "work") {
    if (secs >= 60) logSession(T.projectId, T.segStart, secs, "pomodoro");
    T.phase = "short";
  } else {
    T.phase = "work";
  }
  resetTimer(true);
  renderStopwatch();
};
actions["timer-discard"] = async () => {
  if (!(await confirmDialog("Discard the current timer without logging it?", { title: "Discard timer", ok: "Discard", danger: true }))) return;
  resetTimer(T.mode === "pomodoro");
  renderStopwatch();
};
actions["delete-session"] = async (el) => {
  const s = S.sessions.find((x) => x.id === el.dataset.id);
  if (!s) return;
  if (!(await confirmDialog(`Remove ${fmtDur(s.seconds)} logged on “${projName(s)}”? It will disappear from the heatmap.`, { title: "Remove session", ok: "Remove", danger: true }))) return;
  try {
    await deleteDoc(dref("sessions", s.id));
    logHistory("timer", `Removed ${fmtDur(s.seconds)} session from “${projName(s)}” (${fmtDate(s.start)})`);
  } catch (err) { console.error(err); toast("Couldn't remove session", "error"); }
};

function renderStopwatch() {
  const v = $("#view-stopwatch");
  if (!T) return;
  const pomo = T.mode === "pomodoro";
  const active = T.running || elapsed() > 0;
  if (T.projectId && !projectById(T.projectId) && !active) { T.projectId = ""; saveTimer(); }
  const P = S.settings.pomodoro;
  const today = dateKey(new Date());
  const todays = S.sessions.filter((s) => s.date === today).sort((a, b) => b.start - a.start);
  const total = todays.reduce((a, s) => a + (s.seconds || 0), 0);
  const done = T.cycle % P.longEvery;

  v.innerHTML = `
  <header class="view-head">
    <div><h1>Stopwatch</h1><p class="muted">Pick a project and press start. Sessions log to your heatmap automatically.</p></div>
  </header>
  <div class="timer-layout">
    <section class="card timer-card ${pomo ? "is-pomo" : ""} phase-${T.phase} ${T.running ? "running" : ""}">
      <div class="seg" role="tablist">
        <button class="${!pomo ? "on" : ""}" data-action="timer-mode" data-mode="stopwatch" role="tab" aria-selected="${!pomo}">Stopwatch</button>
        <button class="${pomo ? "on" : ""}" data-action="timer-mode" data-mode="pomodoro" role="tab" aria-selected="${pomo}">Pomodoro</button>
      </div>
      <label class="field project-pick"><span>Project</span>
        <select id="timer-project" ${active ? "disabled" : ""}>
          <option value="">${S.projects.length ? "Select a project…" : "No projects yet"}</option>
          ${S.projects.map((p) => `<option value="${p.id}" ${p.id === T.projectId ? "selected" : ""}>${esc(p.name)}${p.subname ? ` — ${esc(p.subname)}` : ""}</option>`).join("")}
        </select>
      </label>
      <div class="dial">
        <svg class="ring" viewBox="0 0 240 240" aria-hidden="true">
          <circle class="ring-track" cx="120" cy="120" r="108"/>
          <circle class="ring-prog" id="ring-prog" cx="120" cy="120" r="108" pathLength="1000" stroke-dashoffset="1000"/>
        </svg>
        <div class="dial-center">
          <div class="phase" id="timer-phase"></div>
          <div class="time" id="timer-time" role="timer">00:00</div>
          <div class="sub" id="timer-sub"></div>
        </div>
      </div>
      <div class="controls">
        ${T.running
          ? `<button class="btn big" data-action="timer-pause">${icon("pause", 16)}Pause</button>`
          : `<button class="btn primary big" data-action="timer-start">${icon("play", 16)}${active ? "Resume" : "Start"}</button>`}
        <button class="btn ghost big" data-action="timer-stop" ${active ? "" : "disabled"}>${icon("stop", 16)}Stop &amp; log</button>
        ${pomo ? `<button class="btn ghost big" data-action="timer-skip" title="Skip to the next phase">${icon("skip", 16)}Skip</button>` : ""}
        ${active ? `<button class="icon-btn" data-action="timer-discard" title="Discard without logging" aria-label="Discard">${icon("trash")}</button>` : ""}
      </div>
      ${pomo ? `
        <div class="cycle" title="${done} of ${P.longEvery} focus sessions before a long break">${Array.from({ length: P.longEvery }, (_, i) => `<i class="${i < done ? "done" : ""}"></i>`).join("")}</div>
        <p class="hint">Focus ${P.work}m · short break ${P.short}m · long break ${P.long}m after ${P.longEvery} sessions · <a href="#settings">change</a></p>` : ""}
    </section>
    <aside class="card">
      <div class="today-head"><h3>Today</h3><b>${fmtDur(total)}</b></div>
      ${todays.length ? `<ul class="session-list">${todays.map((s) => `
        <li><i class="dot" style="--c:${projColor(s.projectId)}"></i>
          <div><b>${esc(projName(s))}</b><small>${fmtTime(s.start)} · ${s.kind === "pomodoro" ? "Pomodoro" : "Stopwatch"}</small></div>
          <span>${fmtDur(s.seconds)}</span>
          <button class="icon-btn sm" data-action="delete-session" data-id="${s.id}" title="Remove session" aria-label="Remove session">${icon("x", 14)}</button></li>`).join("")}</ul>`
        : `<p class="muted small">Nothing logged yet today.</p>`}
    </aside>
  </div>`;
  updateTimerDisplay();
}

// Tab title: "<timer> · Udon Productivity Tool" while a timer runs, otherwise "<Tab> · Udon Productivity Tool".
function updateTitle(timerText = "") {
  const lead = timerText || (S.user ? VIEW_TITLES[S.view] : "");
  const next = lead ? `${lead} · ${APP_TITLE}` : APP_TITLE;
  if (document.title !== next) document.title = next;
}

function updateTimerDisplay() {
  if (!T) return;
  const e = elapsed();
  const active = T.running || e > 0;
  let text, prog, phase, sub;
  if (T.mode === "pomodoro") {
    const dur = phaseMs();
    text = fmtClock(Math.ceil(Math.max(0, dur - e) / 1000) * 1000);
    prog = Math.min(1, e / dur);
    phase = PHASE_LABEL[T.phase] + (active && !T.running ? " · paused" : "");
    sub = T.phase === "work" ? (projectById(T.projectId)?.name || "") : "Step away for a bit";
  } else {
    text = fmtClock(e, true);
    prog = (e % 60000) / 60000;
    phase = T.running ? "Tracking" : active ? "Paused" : "Ready";
    sub = projectById(T.projectId)?.name || "";
  }
  updateTitle(T.running ? `${text} ${T.mode === "pomodoro" ? PHASE_LABEL[T.phase] : "Tracking"}` : "");
  const dot = $("#live-dot");
  if (dot) dot.hidden = !T.running;
  const el = $("#timer-time");
  if (!el) return;
  el.textContent = text;
  $("#timer-phase").textContent = phase;
  $("#timer-sub").textContent = sub;
  $("#ring-prog").setAttribute("stroke-dashoffset", String(1000 * (1 - prog)));
}

function chime() {
  if (!S.settings.pomodoro.sound) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523, 659, 784].forEach((f, i) => {
      const t = ctx.currentTime + i * 0.18;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g).connect(ctx.destination);
      o.start(t); o.stop(t + 0.65);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch { /* audio unavailable */ }
}
function notify(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted" || document.hasFocus()) return;
  try { new Notification(title, { body, silent: true }); } catch { /* ignore */ }
}

/* =========================================================================
   HEATMAP
   ========================================================================= */
const level = (sec) => (sec <= 0 ? 0 : sec < 1800 ? 1 : sec < 5400 ? 2 : sec < 10800 ? 3 : 4);

function renderHeatmap() {
  const v = $("#view-heatmap");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const years = [...new Set([today.getFullYear(), ...S.sessions.map((s) => +String(s.date).slice(0, 4))])].filter(Boolean).sort((a, b) => b - a);
  if (S.heatRange !== "last" && !years.includes(+S.heatRange)) S.heatRange = "last";
  if (S.heatProject !== "all" && !projectById(S.heatProject) && !S.sessions.some((s) => s.projectId === S.heatProject)) S.heatProject = "all";

  let start, end;
  if (S.heatRange === "last") { end = today; start = addDays(today, -364); }
  else { start = new Date(+S.heatRange, 0, 1); end = new Date(+S.heatRange, 11, 31); }
  const startK = dateKey(start), endK = dateKey(end), todayK = dateKey(today);

  // Aggregate
  const days = {};
  const byProject = {};
  for (const s of S.sessions) {
    if (S.heatProject !== "all" && s.projectId !== S.heatProject) continue;
    if (s.date < startK || s.date > endK) continue;
    const d = (days[s.date] ||= { total: 0, by: {} });
    d.total += s.seconds || 0;
    d.by[s.projectId] = (d.by[s.projectId] || 0) + (s.seconds || 0);
    byProject[s.projectId] = (byProject[s.projectId] || 0) + (s.seconds || 0);
  }
  S.heatDays = days;

  // Grid: one column per week (Sun–Sat), padded before the range start.
  const gridStart = addDays(start, -start.getDay());
  const cells = [];
  for (let d = new Date(gridStart); d <= end; d = addDays(d, 1)) {
    const k = dateKey(d);
    if (d < start) { cells.push(`<i class="cell out"></i>`); continue; }
    const total = days[k]?.total || 0;
    cells.push(`<i class="cell l${level(total)}${k > todayK ? " future" : ""}${k === todayK ? " today" : ""}" data-date="${k}"></i>`);
  }
  const weeks = Math.ceil(cells.length / 7);
  // Month labels sit on the first week column that starts in that month.
  const months = [];
  let lastM = "";
  for (let c = 0; c < weeks; c++) {
    let d = addDays(gridStart, c * 7);
    if (d < start) d = start;
    const m = `${d.getFullYear()}-${d.getMonth()}`;
    if (m === lastM) continue;
    lastM = m;
    const label = d.toLocaleString(undefined, { month: "short" });
    const prev = months[months.length - 1];
    if (prev && c - prev.col < 3) { if (prev.col === 0) months[months.length - 1] = { col: c, label }; continue; }
    months.push({ col: c, label });
  }

  // Stats
  const activeDays = Object.keys(days).filter((k) => days[k].total > 0).sort();
  const totalSec = activeDays.reduce((a, k) => a + days[k].total, 0);
  let longest = 0, run = 0, prev = null;
  for (const k of activeDays) {
    run = prev && dateKey(addDays(parseKey(prev), 1)) === k ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = k;
  }
  // Current streak always measured from today, independent of range.
  const allDays = new Set(S.sessions.filter((s) => S.heatProject === "all" || s.projectId === S.heatProject).map((s) => s.date));
  let cur = 0;
  for (let d = allDays.has(todayK) ? today : addDays(today, -1); allDays.has(dateKey(d)); d = addDays(d, -1)) cur++;
  const best = activeDays.reduce((b, k) => (!b || days[k].total > days[b].total ? k : b), null);
  const top = Object.entries(byProject).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const projOptions = [...new Map([
    ...S.projects.map((p) => [p.id, p.name]),
    ...S.sessions.filter((s) => !projectById(s.projectId)).map((s) => [s.projectId, projName(s)]),
  ])];

  v.innerHTML = `
  <header class="view-head">
    <div><h1>Heatmap</h1><p class="muted">Every logged session, one square per day.</p></div>
    <div class="heat-controls">
      <select id="heat-project" aria-label="Project">
        <option value="all">All projects</option>
        ${projOptions.map(([id, name]) => `<option value="${esc(id)}" ${id === S.heatProject ? "selected" : ""}>${esc(name)}</option>`).join("")}
      </select>
      <select id="heat-range" aria-label="Range">
        <option value="last" ${S.heatRange === "last" ? "selected" : ""}>Last 12 months</option>
        ${years.map((y) => `<option value="${y}" ${String(y) === String(S.heatRange) ? "selected" : ""}>${y}</option>`).join("")}
      </select>
    </div>
  </header>
  <div class="stat-row">
    <div class="stat"><span>Total focus</span><b>${fmtDur(totalSec)}</b><small>${S.heatRange === "last" ? "past 12 months" : S.heatRange}</small></div>
    <div class="stat"><span>Active days</span><b>${activeDays.length}</b><small>${activeDays.length ? `${fmtDur(totalSec / activeDays.length)} avg per day` : "—"}</small></div>
    <div class="stat"><span>Current streak</span><b>${cur} day${cur === 1 ? "" : "s"}</b><small>Longest: ${longest} day${longest === 1 ? "" : "s"}</small></div>
    <div class="stat"><span>Best day</span><b>${best ? fmtDur(days[best].total) : "—"}</b><small>${best ? fmtDate(parseKey(best)) : "No sessions yet"}</small></div>
  </div>
  <section class="card heat-card">
    <div class="heat-scroll">
      <div class="heat-wrap">
        <div class="heat-months" style="grid-template-columns:repeat(${weeks}, var(--cell))">
          ${months.map((m) => `<span style="grid-column:${m.col + 1}">${esc(m.label)}</span>`).join("")}
        </div>
        <div class="heat-days"><span></span><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span></div>
        <div class="heat-grid" id="heat-grid">${cells.join("")}</div>
      </div>
    </div>
    <div class="heat-foot">
      <span>${fmtDur(totalSec)} across ${activeDays.length} day${activeDays.length === 1 ? "" : "s"}</span>
      <div class="legend" title="Less than 30m · 30m–1.5h · 1.5h–3h · 3h+">
        <span>Less</span><i class="cell"></i><i class="cell l1"></i><i class="cell l2"></i><i class="cell l3"></i><i class="cell l4"></i><span>More</span>
      </div>
    </div>
  </section>
  <section class="card">
    <h3>Time by project</h3>
    ${top.length ? `<div class="bar-list">${top.map(([pid, sec]) => `
      <div class="bar-item" style="--c:${projColor(pid)}">
        <span class="name"><i class="dot"></i>${esc(projName({ projectId: pid, projectName: S.sessions.find((s) => s.projectId === pid)?.projectName }))}</span>
        <span class="val">${fmtDur(sec)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(2, (sec / top[0][1]) * 100)}%"></div></div>
      </div>`).join("")}</div>` : `<p class="muted small">No time logged in this range yet. Start a timer on the Stopwatch tab.</p>`}
  </section>`;

  const grid = $("#heat-grid");
  const show = (e) => {
    const c = e.target.closest(".cell[data-date]");
    if (!c) return;
    const k = c.dataset.date;
    const d = S.heatDays[k];
    const date = fmtDate(parseKey(k), { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    const rows = d ? Object.entries(d.by).sort((a, b) => b[1] - a[1]).slice(0, 6) : [];
    showTip(c, `<b>${d ? fmtDur(d.total) : "No activity"}</b> <span class="tt-date">on ${date}</span>
      ${rows.length ? `<ul>${rows.map(([pid, sec]) => `<li><i class="dot" style="--c:${projColor(pid)}"></i><span>${esc(projName({ projectId: pid, projectName: S.sessions.find((s) => s.projectId === pid)?.projectName }))}</span><span>${fmtDur(sec)}</span></li>`).join("")}</ul>` : ""}`);
  };
  grid.addEventListener("mouseover", show);
  grid.addEventListener("click", show);
  grid.addEventListener("mouseleave", hideTip);
  $(".heat-scroll").addEventListener("scroll", hideTip);
  // Scroll the grid so the most recent weeks are visible on narrow screens.
  const sc = $(".heat-scroll");
  sc.scrollLeft = sc.scrollWidth;
}

/* =========================================================================
   REVENUE
   ========================================================================= */
function renderRevenue() {
  const v = $("#view-revenue");
  const mk = S.revMonth;
  const [y, mo] = mk.split("-").map(Number);
  const monthLabel = new Date(y, mo - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
  const shortLabel = new Date(y, mo - 1, 1).toLocaleString(undefined, { month: "short" });
  const entries = S.revenue.filter((r) => r.month === mk).sort((a, b) => b.createdAt - a.createdAt);
  const total = entries.reduce((a, r) => a + (r.amount || 0), 0);
  const prevTotal = S.revenue.filter((r) => r.month === shiftMonth(mk, -1)).reduce((a, r) => a + (r.amount || 0), 0);
  const delta = prevTotal ? ((total - prevTotal) / Math.abs(prevTotal)) * 100 : null;
  const by = {};
  entries.forEach((r) => (by[r.projectId] = (by[r.projectId] || 0) + (r.amount || 0)));
  const ranked = Object.entries(by).sort((a, b) => b[1] - a[1]);
  const maxAbs = Math.max(1, ...ranked.map(([, a]) => Math.abs(a)));
  const isCurrent = mk === monthKey(new Date());
  if (S.revProject && !projectById(S.revProject)) S.revProject = "";
  const nameFor = (pid) => projName({ projectId: pid, projectName: entries.find((r) => r.projectId === pid)?.projectName });
  const sym = currencySymbol();

  v.innerHTML = `
  <header class="view-head">
    <div><h1>Revenue</h1><p class="muted">Monthly totals by project, entered manually.</p></div>
    <div class="month-nav">
      <button class="icon-btn" data-action="rev-month" data-dir="-1" aria-label="Previous month">${icon("chevL")}</button>
      <b>${esc(monthLabel)}</b>
      <button class="icon-btn" data-action="rev-month" data-dir="1" aria-label="Next month">${icon("chevR")}</button>
      ${isCurrent ? "" : `<button class="btn small ghost" data-action="rev-today">This month</button>`}
    </div>
  </header>
  <div class="stat-row">
    <div class="stat"><span>Total for ${esc(shortLabel)}</span><b class="${total < 0 ? "neg" : ""}">${fmtMoney(total)}</b><small>${entries.length} entr${entries.length === 1 ? "y" : "ies"}</small></div>
    <div class="stat"><span>vs. previous month</span>
      <b class="${delta == null ? "" : delta >= 0 ? "up" : "down"}">${delta == null ? "—" : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(0)}%`}</b>
      <small>${fmtMoney(prevTotal)} last month</small></div>
    <div class="stat"><span>Top project</span><b>${ranked.length ? esc(nameFor(ranked[0][0])) : "—"}</b><small>${ranked.length ? fmtMoney(ranked[0][1]) : "No entries yet"}</small></div>
  </div>
  <div class="rev-layout">
    <section class="card">
      <h3>Add entry</h3>
      ${S.projects.length ? `
      <form id="rev-form" class="form" autocomplete="off">
        <label class="field"><span>Project${REQ}</span>
          <select id="rev-project" name="project" required>
            <option value="">Select a project…</option>
            ${S.projects.map((p) => `<option value="${p.id}" ${p.id === S.revProject ? "selected" : ""}>${esc(p.name)}</option>`).join("")}
          </select></label>
        <label class="field"><span>Amount${REQ}</span>
          <div class="money-input" style="--sym-w:${sym.length}ch"><span>${esc(sym)}</span>
          <input type="number" name="amount" step="0.01" inputmode="decimal" required placeholder="0.00"></div></label>
        <label class="field"><span>Description</span>
          <input type="text" name="label" maxlength="80" placeholder="Invoice, sale, payout…"></label>
        <button class="btn primary" type="submit">${icon("plus", 16)}Add to ${esc(monthLabel)}</button>
        <p class="hint">Use a negative amount for refunds or expenses.</p>
      </form>` : `<p class="muted small">Create a project first, then log its revenue here.</p>
        <button class="btn primary" data-action="new-project" style="margin-top:14px">${icon("plus", 16)}New project</button>`}
    </section>
    <section class="card">
      <h3>By project</h3>
      ${ranked.length ? `<div class="bar-list">${ranked.map(([pid, amt]) => `
        <div class="bar-item" style="--c:${amt < 0 ? "var(--clay)" : projColor(pid)}">
          <span class="name"><i class="dot" style="--c:${projColor(pid)}"></i>${esc(nameFor(pid))}</span>
          <span class="val ${amt < 0 ? "neg" : ""}">${fmtMoney(amt)}${total > 0 && amt > 0 ? ` · ${Math.round((amt / total) * 100)}%` : ""}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.max(2, (Math.abs(amt) / maxAbs) * 100)}%"></div></div>
        </div>`).join("")}</div>` : `<p class="muted small">No revenue logged for ${esc(monthLabel)}.</p>`}
    </section>
  </div>
  <section class="card">
    <h3>Entries</h3>
    ${entries.length ? `<div class="table-wrap"><table class="list">
      <thead><tr><th>Project</th><th>Description</th><th>Added</th><th class="num">Amount</th><th></th></tr></thead>
      <tbody>${entries.map((r) => `<tr>
        <td><span class="proj-cell"><i class="dot" style="--c:${projColor(r.projectId)}"></i>${esc(projName(r))}</span></td>
        <td class="muted">${esc(r.label || "—")}</td>
        <td class="muted">${fmtDate(r.createdAt, { month: "short", day: "numeric" })}</td>
        <td class="num ${r.amount < 0 ? "neg" : ""}">${fmtMoney(r.amount)}</td>
        <td class="act"><button class="icon-btn sm" data-action="rev-delete" data-id="${r.id}" title="Delete entry" aria-label="Delete entry">${icon("trash", 15)}</button></td>
      </tr>`).join("")}</tbody></table></div>` : `<p class="muted small">Entries you add for this month will show here.</p>`}
  </section>`;

  $("#rev-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const p = projectById(f.project.value);
    const amount = Math.round(parseFloat(f.amount.value) * 100) / 100;
    if (!p) { toast("Pick a project", "error"); f.project.focus(); return; }
    if (!Number.isFinite(amount) || amount === 0) { toast("Enter an amount", "error"); f.amount.focus(); return; }
    const label = f.label.value.trim();
    S.revProject = p.id;
    $("button[type=submit]", f).disabled = true;
    try {
      await addDoc(col("revenue"), { projectId: p.id, projectName: p.name, month: mk, amount, label, createdAt: Date.now() });
      logHistory("revenue", `Added ${fmtMoney(amount)} to “${p.name}” for ${monthLabel}${label ? ` — ${label}` : ""}`);
      toast(`Added ${fmtMoney(amount)}`);
    } catch (err) {
      console.error(err);
      toast("Couldn't save entry", "error");
      $("button[type=submit]", f).disabled = false;
    }
  });
}

actions["rev-month"] = (el) => { S.revMonth = shiftMonth(S.revMonth, +el.dataset.dir); renderRevenue(); };
actions["rev-today"] = () => { S.revMonth = monthKey(new Date()); renderRevenue(); };
actions["rev-delete"] = async (el) => {
  const r = S.revenue.find((x) => x.id === el.dataset.id);
  if (!r) return;
  if (!(await confirmDialog(`Delete the ${fmtMoney(r.amount)} entry for “${projName(r)}”?`, { title: "Delete entry", ok: "Delete", danger: true }))) return;
  try {
    await deleteDoc(dref("revenue", r.id));
    const [y, m] = r.month.split("-").map(Number);
    logHistory("revenue", `Deleted ${fmtMoney(r.amount)} from “${projName(r)}” (${new Date(y, m - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" })})`);
  } catch (err) { console.error(err); toast("Couldn't delete entry", "error"); }
};

/* =========================================================================
   HISTORY
   ========================================================================= */
function renderHistory() {
  const v = $("#view-history");
  const list = S.history.filter((h) => S.histFilter === "all" || h.cat === S.histFilter);
  const groups = [];
  for (const h of list) {
    const k = dateKey(new Date(h.ts));
    if (!groups.length || groups[groups.length - 1].k !== k) groups.push({ k, items: [] });
    groups[groups.length - 1].items.push(h);
  }
  const todayK = dateKey(new Date()), yestK = dateKey(addDays(new Date(), -1));
  const dayLabel = (k) => (k === todayK ? "Today" : k === yestK ? "Yesterday" : fmtDate(parseKey(k), { weekday: "long", month: "short", day: "numeric", year: "numeric" }));

  v.innerHTML = `
  <header class="view-head"><div><h1>History</h1><p class="muted">Every change you've made, newest first.</p></div></header>
  <div class="toolbar"><div class="chips">
    <button class="chip ${S.histFilter === "all" ? "on" : ""}" data-action="hist-filter" data-id="all">All</button>
    ${Object.entries(CATS).map(([k, c]) => `<button class="chip ${S.histFilter === k ? "on" : ""}" data-action="hist-filter" data-id="${k}"><i class="dot" style="--c:${c.color}"></i>${c.label}</button>`).join("")}
  </div></div>
  ${groups.length ? groups.map((g) => `
    <section class="history-day"><h4>${esc(dayLabel(g.k))}</h4>
      <ul class="card history-list">${g.items.map((h) => {
        const c = CATS[h.cat] || CATS.settings;
        return `<li><span class="h-ico" style="--c:${c.color}">${icon(c.icon, 16)}</span><span class="h-text">${esc(h.text)}</span><time datetime="${new Date(h.ts).toISOString()}">${fmtTime(h.ts)}</time></li>`;
      }).join("")}</ul>
    </section>`).join("") : emptyState("history", "No history yet", S.histFilter === "all" ? "Changes to projects, documents, timers, revenue and settings will appear here." : "Nothing in this category yet.")}
  ${S.history.length >= 400 ? `<p class="hint" style="text-align:center">Showing the most recent 400 changes.</p>` : ""}`;
}
actions["hist-filter"] = (el) => { S.histFilter = el.dataset.id; renderHistory(); };

/* =========================================================================
   SETTINGS
   ========================================================================= */
function renderSettings() {
  const v = $("#view-settings");
  const u = S.user;
  const P = S.settings.pomodoro;
  S.statusDraft = S.settings.statuses.map((s) => ({ ...s }));
  const tracked = S.sessions.reduce((a, s) => a + (s.seconds || 0), 0);
  const rev = S.revenue.reduce((a, r) => a + (r.amount || 0), 0);
  const since = u.metadata?.creationTime ? fmtDate(new Date(u.metadata.creationTime)) : "";

  v.innerHTML = `
  <header class="view-head"><div><h1>Settings</h1><p class="muted">Statuses, timer preferences and your account.</p></div></header>
  <div class="settings-grid">
    <section class="card span2">
      <h3>Account</h3>
      <div class="account">
        ${avatarHTML(u, "lg")}
        <div class="who"><b>${esc(u.displayName || "Signed in")}</b><span>${esc(u.email || "")}</span>${since ? `<small>Member since ${esc(since)} · Google account</small>` : ""}</div>
        <button class="btn ghost" data-action="logout">${icon("logout", 16)}Sign out</button>
      </div>
      <div class="mini-stats">
        <div><b>${S.projects.length}</b><span>Projects</span></div>
        <div><b>${fmtDur(tracked)}</b><span>Time tracked</span></div>
        <div><b>${fmtMoney(rev, { maximumFractionDigits: 0 })}</b><span>Revenue logged</span></div>
        <div><b>${S.docs.length}</b><span>Documents</span></div>
      </div>
    </section>

    <section class="card">
      <div class="card-head"><h3>Project statuses</h3><p>Names and colors shown on project cards.</p></div>
      <div class="status-rows" id="status-rows"></div>
      <div class="row-actions">
        <button class="btn ghost small" data-action="status-add">${icon("plus", 15)}Add status</button>
        <div class="spacer"></div>
        <button class="btn primary small" data-action="status-save">Save statuses</button>
      </div>
    </section>

    <section class="card">
      <div class="card-head"><h3>Pomodoro</h3><p>Focus and break lengths.</p></div>
      <form id="pomo-form" class="form">
        <div class="pomo-grid">
          ${[
            ["work", "Focus", 1, 180, "min"],
            ["short", "Short break", 1, 60, "min"],
            ["long", "Long break", 1, 120, "min"],
            ["longEvery", "Long break after", 2, 12, "sessions"],
          ].map(([name, label, min, max, unit]) => `
          <label class="field"><span>${label}</span>
            <span class="unit-input"><input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" name="${name}" data-min="${min}" data-max="${max}" value="${P[name]}"><span>${unit}</span></span></label>`).join("")}
        </div>
        <div class="pomo-toggles">
          <label class="toggle"><input type="checkbox" name="autoStart" ${P.autoStart ? "checked" : ""}>Auto-start next phase</label>
          <label class="toggle"><input type="checkbox" name="sound" ${P.sound ? "checked" : ""}>Chime when a phase ends</label>
        </div>
        <div class="row-actions"><div class="spacer"></div><button class="btn primary small" type="submit">Save Pomodoro</button></div>
      </form>
    </section>

    <section class="card">
      <h3>Preferences</h3>
      <label class="field"><span>Currency for revenue</span>
        <select id="currency">${CURRENCIES.map((c) => `<option value="${c}" ${c === S.settings.currency ? "selected" : ""}>${esc(currencyLabel(c))}</option>`).join("")}</select></label>
    </section>

    <section class="card">
      <h3>Your data</h3>
      <div class="data-actions">
        <div><div><b>Export</b><p>Download projects, sessions, revenue and history as JSON.</p></div>
          <button class="btn ghost small" data-action="export">${icon("download", 15)}Export JSON</button></div>
        <div><div><b>Clear history</b><p>Removes the change log only. Nothing else is touched.</p></div>
          <button class="btn danger ghost small" data-action="clear-history">${icon("trash", 15)}Clear</button></div>
      </div>
    </section>
  </div>`;

  drawStatusRows();
  const rows = $("#status-rows");
  rows.addEventListener("input", (e) => {
    const row = e.target.closest(".status-row");
    if (!row) return;
    const s = S.statusDraft[+row.dataset.i];
    if (e.target.type === "color") s.color = e.target.value;
    else s.name = e.target.value;
  });
  const pomo = $("#pomo-form");
  pomo.addEventListener("submit", savePomodoro);
  pomo.addEventListener("input", (e) => {
    if (e.target.closest(".unit-input")) e.target.value = e.target.value.replace(/\D/g, "");
  });
}

function drawStatusRows() {
  const counts = {};
  S.projects.forEach((p) => (counts[statusOf(p.status).id] = (counts[statusOf(p.status).id] || 0) + 1));
  const n = S.statusDraft.length;
  $("#status-rows").innerHTML = S.statusDraft.map((s, i) => `
    <div class="status-row" data-i="${i}">
      <input type="color" value="${safeColor(s.color).length === 7 ? safeColor(s.color) : "#8e9183"}" aria-label="Color">
      <input type="text" value="${esc(s.name)}" maxlength="24" aria-label="Status name">
      <span class="uses">${counts[s.id] ? `${counts[s.id]} project${counts[s.id] === 1 ? "" : "s"}` : ""}</span>
      <button class="icon-btn sm" data-action="status-move" data-i="${i}" data-dir="-1" ${i === 0 ? "disabled" : ""} aria-label="Move up">${icon("up", 15)}</button>
      <button class="icon-btn sm" data-action="status-move" data-i="${i}" data-dir="1" ${i === n - 1 ? "disabled" : ""} aria-label="Move down">${icon("down", 15)}</button>
      <button class="icon-btn sm" data-action="status-remove" data-i="${i}" ${n <= 1 ? "disabled" : ""} aria-label="Remove">${icon("trash", 15)}</button>
    </div>`).join("");
}

actions["status-add"] = () => {
  const palette = ["#8db36f", "#c9a45c", "#c07a5c", "#6fa39a", "#a19f82", "#9a8bb5", "#b5a06f"];
  S.statusDraft.push({ id: `s_${uid()}`, name: "New status", color: palette[S.statusDraft.length % palette.length] });
  drawStatusRows();
  const inputs = $$("#status-rows input[type=text]");
  inputs[inputs.length - 1]?.select();
};
actions["status-move"] = (el) => {
  const i = +el.dataset.i, j = i + +el.dataset.dir;
  if (j < 0 || j >= S.statusDraft.length) return;
  [S.statusDraft[i], S.statusDraft[j]] = [S.statusDraft[j], S.statusDraft[i]];
  drawStatusRows();
};
actions["status-remove"] = (el) => {
  if (S.statusDraft.length <= 1) return;
  S.statusDraft.splice(+el.dataset.i, 1);
  drawStatusRows();
};
actions["status-save"] = async () => {
  const draft = S.statusDraft.map((s) => ({ ...s, name: s.name.trim() }));
  if (draft.some((s) => !s.name)) { toast("Every status needs a name", "error"); return; }
  const keep = new Set(draft.map((s) => s.id));
  const affected = S.projects.filter((p) => !keep.has(p.status));
  if (affected.length) {
    const ok = await confirmDialog(`${affected.length} project${affected.length === 1 ? " uses" : "s use"} a status you removed. ${affected.length === 1 ? "It" : "They"} will be moved to “${draft[0].name}”.`,
      { title: "Reassign projects", ok: "Save and reassign" });
    if (!ok) return;
  }
  try {
    const batch = writeBatch(db);
    batch.update(userRef(), { "settings.statuses": draft });
    affected.forEach((p) => batch.update(dref("projects", p.id), { status: draft[0].id, updatedAt: Date.now() }));
    await batch.commit();
    const before = S.settings.statuses;
    const added = draft.filter((s) => !before.some((b) => b.id === s.id)).map((s) => s.name);
    const removed = before.filter((b) => !keep.has(b.id)).map((s) => s.name);
    const parts = [];
    if (added.length) parts.push(`added ${added.join(", ")}`);
    if (removed.length) parts.push(`removed ${removed.join(", ")}`);
    if (!parts.length) parts.push("updated names, colors or order");
    logHistory("settings", `Statuses ${parts.join("; ")}`);
    toast("Statuses saved");
  } catch (err) { console.error(err); toast("Couldn't save statuses", "error"); }
};

async function savePomodoro(e) {
  e.preventDefault();
  const f = e.target;
  const clamp = (v, lo, hi, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
  const P = S.settings.pomodoro;
  const next = {
    work: clamp(f.work.value, 1, 180, P.work),
    short: clamp(f.short.value, 1, 60, P.short),
    long: clamp(f.long.value, 1, 120, P.long),
    longEvery: clamp(f.longEvery.value, 2, 12, P.longEvery),
    autoStart: f.autoStart.checked,
    sound: f.sound.checked,
  };
  await saveSetting("pomodoro", next, `Pomodoro set to ${next.work}/${next.short}/${next.long} min, long break every ${next.longEvery}`);
}

async function saveSetting(key, value, historyText) {
  try {
    await updateDoc(userRef(), { [`settings.${key}`]: value });
    logHistory("settings", historyText);
    toast("Saved");
  } catch (err) { console.error(err); toast("Couldn't save setting", "error"); }
}

actions["logout"] = async () => {
  if (T?.running && !(await confirmDialog("A timer is running. It'll keep counting on this device and you can stop it after signing back in.", { title: "Sign out", ok: "Sign out" }))) return;
  await signOut(auth);
  location.hash = "";
};
actions["export"] = () => {
  const data = {
    exportedAt: new Date().toISOString(),
    account: { name: S.user.displayName, email: S.user.email },
    settings: S.settings,
    projects: S.projects,
    documents: S.docs.map(({ id, projectId, name, size, createdAt }) => ({ id, projectId, name, size, createdAt })),
    sessions: S.sessions,
    revenue: S.revenue,
    history: S.history,
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `udon-export-${dateKey(new Date())}.json` });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};
actions["clear-history"] = async () => {
  if (!(await confirmDialog("Permanently clear your change history? Projects, sessions and revenue are not affected.", { title: "Clear history", ok: "Clear history", danger: true }))) return;
  try {
    const snap = await getDocs(col("history"));
    for (let i = 0; i < snap.docs.length; i += 450) {
      const batch = writeBatch(db);
      snap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    toast("History cleared");
  } catch (err) { console.error(err); toast("Couldn't clear history", "error"); }
};

/* ========================================================================= */
boot();
