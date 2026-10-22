// Mine OS: the mine at night, the dive into the foreman's terminal, a short boot, then an amber desktop where every
// window works and the miners live on the taskbar. The windows, the terminal, the rig and the pets all read the same live engine.
import { createSound } from './sound.js?v=2';
import * as WAL from './wallet.js?v=2';
import { ICONS, SPR, avatarURL, hueOf, tinted, walkFrames } from './sprites.js?v=2';
import { installApps } from './mwapps.js?v=2';
import { installTerm } from './term.js?v=2';
import { installPets } from './pets.js?v=2';
import * as FX from './fx.js?v=2';

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBILE = matchMedia('(max-width: 760px)').matches || matchMedia('(hover: none)').matches;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ss = { get(k) { try { return sessionStorage.getItem(k); } catch { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch {} }, del(k) { try { sessionStorage.removeItem(k); } catch {} } };
const ls = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const SOUND = createSound(ls);
SOUND.unlock();
// browsers only let sound start after a click, a tap or a key; the music starts on the very first one
const UNLOCK = ['pointerdown', 'mousedown', 'pointerup', 'click', 'keydown', 'touchend'];
const unlockOnce = () => { SOUND.unlock(); if (SOUND.on) UNLOCK.forEach(t => removeEventListener(t, unlockOnce, true)); };
UNLOCK.forEach(t => addEventListener(t, unlockOnce, true));

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const short = a => a ? a.slice(0, 4) + '…' + a.slice(-4) : '';
const ago = t => { if (!t) return '—'; const s = Math.max(1, (Date.now() - new Date(t).getTime()) / 1000); return s < 60 ? `${s | 0}s` : s < 3600 ? `${s / 60 | 0}m` : s < 86400 ? `${s / 3600 | 0}h` : `${s / 86400 | 0}d`; };
const fsol = n => { n = Number(n || 0); return n === 0 ? '0' : n < .001 ? n.toFixed(5) : n < 1 ? n.toFixed(4) : n < 100 ? n.toFixed(3) : n.toFixed(1); };
const ftok = (raw, dec = 6) => { const ui = Number(raw || 0) / 10 ** dec; return ui >= 1e9 ? (ui / 1e9).toFixed(2) + 'B' : ui >= 1e6 ? (ui / 1e6).toFixed(2) + 'M' : ui >= 1e3 ? (ui / 1e3).toFixed(1) + 'K' : ui.toFixed(0); };
async function api(op, { method = 'GET', body, params } = {}) {
  const u = '/api/' + op + (params ? '?' + new URLSearchParams(params) : '');
  let r; try { r = await fetch(u, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined }); }
  catch { throw new Error('No connection. Check your internet and try again.'); }
  let j = {}; try { j = await r.json(); } catch {}
  if (!r.ok || j.ok === false) throw new Error(j.error || `Request failed (${r.status}).`);
  return j;
}
async function copy(t) { try { await navigator.clipboard.writeText(t); toast('copied'); } catch { toast('select it and copy'); } }
const solscan = s => `https://solscan.io/tx/${s}`, acct = a => `https://solscan.io/account/${a}`, pumpfun = m => `https://pump.fun/coin/${m}`;

// ---------------------------------------------------------------- the shared context every app gets
const BUS = new Map();
const X = {
  $, $$, esc, short, ago, fsol, ftok, api, copy, sleep, ls, ss, SOUND, WAL, ICONS, SPR, avatarURL, hueOf, tinted, walkFrames, MOBILE, RM, solscan, acct, pumpfun,
  BUDS: [], TOTALS: {}, TICK: null, CFG: null, FEEDLAST: 0, RECENT: [], fx: FX,
  on(ev, fn) { if (!BUS.has(ev)) BUS.set(ev, new Set()); BUS.get(ev).add(fn); return () => BUS.get(ev).delete(fn); },
  emit(ev, d) { (BUS.get(ev) || []).forEach(fn => { try { fn(d); } catch (e) { console.error(e); } }); },
};
const APPS = {};
X.APPS = APPS; X.define = (id, def) => { APPS[id] = def; return def; };

// ---------------------------------------------------------------- toasts
function toast(text, opt = {}) {
  const box = $('#toasts'); if (!box) return;
  const ms = opt.ms || 4600, t = document.createElement('div'); t.className = 'toast' + (opt.kind ? ' ' + opt.kind : ''); t.style.setProperty('--ms', ms + 'ms');
  t.innerHTML = (opt.icon ? `<img src="${opt.icon}" alt="">` : '') + `<span>${esc(text)}</span><i class="tbar"></i>`;
  if (opt.onclick) { t.classList.add('click'); t.onclick = () => { opt.onclick(); out(); }; }
  box.appendChild(t); requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('in')));
  while (box.children.length > 3) box.firstChild.remove();
  const out = () => { if (t._out) return; t._out = 1; t.classList.remove('in'); t.classList.add('out'); setTimeout(() => t.remove(), 380); };
  setTimeout(out, ms);
}
X.toast = toast;

// ================================================================ boot: greenhouse → dive → boot screen → desktop
async function boot() {
  const qs = new URLSearchParams(location.search);
  if (ss.get('mw:seen') || RM || qs.has('mine') || qs.has('app') || qs.has('skip')) return desktop(qs.get('app') || '', true);
  const canvas = $('#room');
  let started = false;
  const go = cmd => { if (go.done) return; go.done = true; ss.set('mw:seen', '1'); desktop(cmd); };
  $$('#itouch button').forEach(b => b.onclick = () => { if (window.__bud && window.__bud.go) window.__bud.go(b.dataset.go); else go(b.dataset.go); });
  try {
    const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
    if (!gl) throw new Error('no webgl');
    const { run } = await import('./mintro.js?v=2');
    // the music button: no words, just bars that move with the music. off shows a slash.
    const sb = $('#isound');
    if (sb) {
      const bars = $$('i', sb), fft = new Uint8Array(64);
      SOUND.onChange(st => { const on = !st.muted && st.on; sb.classList.toggle('on', on); sb.classList.toggle('off', !!st.muted); sb.classList.toggle('wait', !st.muted && !st.on); sb.title = st.muted ? 'music off' : 'music on'; if (!on) bars.forEach(b => b.style.height = ''); });
      sb.onclick = e => { e.stopPropagation(); SOUND.toggle(); };
      const eq = () => { if (!document.body.contains(sb)) return; requestAnimationFrame(eq); const an = SOUND.analyser(); if (!an || !sb.classList.contains('on')) return; an.getByteFrequencyData(fft); bars.forEach((b, i) => { b.style.height = (3 + Math.min(1, fft[1 + i * 4] / 200) * 14).toFixed(1) + 'px'; }); };
      requestAnimationFrame(eq);
    }
    window.__bud = await run({ canvas, mobile: MOBILE, onEnter: go, status: null, audio: SOUND, onReady: () => { $('#ihint').classList.add('on'); $('#itouch').classList.add('on'); } });
    started = true;
    requestAnimationFrame(() => canvas.classList.add('on'));
  } catch (e) { console.warn(e); if (!started) fallbackBoot(go); }
}
async function fallbackBoot(go) {
  const pre = $('#ifall'); pre.hidden = false; const r = $('#room'); if (r) r.remove();
  const lines = ['MINE BIOS v1.0  (c) the deep shift', 'cpu: sha-256 @ every core you have', 'memory test: 65536K ok', '', 'detecting lanterns ........... lit', 'detecting rails .............. laid', 'detecting veins .............. gold', 'detecting sleep .............. not found', '', 'every coin is a mine.', 'your browser mines it. every block pays SOL.', '', 'press enter.'];
  for (const l of lines) { pre.textContent += l + '\n'; await sleep(70); }
  $('#itouch').classList.add('on');
  addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') go(''); }, { once: true });
}
// no loading screen: the greenhouse goes dark, then the desktop flickers on like an old CRT
async function desktop(cmd, instant) {
  const intro = $('#intro'); if (intro) intro.remove();
  document.body.classList.remove('booting');
  const d = $('#desk'); d.hidden = false; d.classList.add(instant && !/[?&]crt\b/.test(location.search) ? 'in' : 'crt-on');
  SOUND.scene('desk'); setTimeout(() => SOUND.sfx(instant ? 'click' : 'crton'), instant ? 0 : 60);
  setTimeout(() => d.classList.remove('in', 'crt-on'), 1400);
  await initDesk();
  const qs = new URLSearchParams(location.search);
  const target = qs.get('mine');
  if (target) X.openMine(target);
  const app = { launch: 'launch', veins: 'veins', mines: 'veins', mine: 'rig', rig: 'rig', chain: 'chain', blocks: 'chain', ledger: 'ledger', terminal: 'term', term: 'term', docs: 'readme', readme: 'readme', stats: 'stats', dash: 'stats', paint: 'paint', mountain: 'mountain', map: 'mountain' }[cmd || qs.get('app') || ''];
  if (app) WM.open(app);
  else if (!target) { if (!MOBILE) WM.open('mountain'); if (ls.get('mw:nowelcome') !== '1') setTimeout(() => { WM.open('welcome'); if (!MOBILE) sideBySide(); }, MOBILE ? 0 : 380); }
}
// first visit: the welcome on the left, the live mountain beside it, not under it, when the screen has the room
function sideBySide() {
  const a = WM.wins.welcome, b = WM.wins.mountain, area = $('#wins'); if (!a || !b || !area) return;
  const right = a.offsetLeft + a.offsetWidth + 12, room = area.offsetWidth - right - 14;
  if (room < 560) return;
  b.style.setProperty('--ww', Math.min(940, room) + 'px'); b.style.setProperty('--wh', Math.min(600, area.offsetHeight - 40) + 'px'); b.style.left = right + 'px'; b.style.top = '22px';
}

// ================================================================ window manager
const WM = {
  z: 30, wins: {},
  make(app) {
    const def = APPS[app]; if (!def) return null;
    const w = document.createElement('section'); w.className = 'win'; w.dataset.app = app; w.setAttribute('role', 'dialog'); w.setAttribute('aria-label', def.title);
    w.style.setProperty('--ww', (def.w || 560) + 'px'); w.style.setProperty('--wh', (def.h || 420) + 'px');
    if (def.cls) w.classList.add(...def.cls.split(' '));
    w.innerHTML = `<header class="tb"><img src="${def.iconURL || ICONS[def.icon] || ICONS.folder}" alt=""><span class="tt">${esc(def.title)}</span><div class="tbb"><button type="button" data-min aria-label="minimize">_</button>${def.nomax ? '' : '<button type="button" data-max aria-label="maximize">□</button>'}<button type="button" data-close aria-label="close">×</button></div></header><div class="wb"></div>`;
    $('#wins').appendChild(w); this.wins[app] = w;
    const tb = w.querySelector('.tb');
    tb.addEventListener('pointerdown', e => this.drag(e, w));
    tb.addEventListener('dblclick', e => { if (!e.target.closest('button')) this.max(app); });
    w.addEventListener('pointerdown', () => this.focus(app), true);
    w.querySelector('[data-min]').onclick = e => { e.stopPropagation(); this.min(app); };
    const mx = w.querySelector('[data-max]'); if (mx) mx.onclick = e => { e.stopPropagation(); this.max(app); };
    w.querySelector('[data-close]').onclick = e => { e.stopPropagation(); this.close(app); };
    if (!MOBILE && !def.noresize) { const g = document.createElement('div'); g.className = 'grip'; w.appendChild(g); g.addEventListener('pointerdown', e => this.resize(e, w)); }
    try { def.build && def.build(w.querySelector('.wb'), w); } catch (e) { console.error(app, e); w.querySelector('.wb').innerHTML = `<p class="err">this window crashed: ${esc(e.message)}</p>`; }
    return w;
  },
  place(w, def) {
    const wins = $('#wins'), area = { width: wins.offsetWidth, height: wins.offsetHeight }, n = $$('.win.open').length;   // layout sizes: the desktop may be mid power-on
    const ww = Math.min(w.offsetWidth || def.w || 560, area.width - 16), wh = Math.min(w.offsetHeight || def.h || 420, area.height - 16);
    let x, y;
    if (def.at === 'right') { x = area.width - ww - 18; y = 18; }
    else if (def.at === 'left') { x = Math.min(200, Math.max(12, area.width - ww - 12)); y = 22; }
    else { x = Math.max(120, (area.width - ww) / 2 + (n % 6) * 28 - 60); y = Math.max(12, (area.height - wh) / 2 + (n % 6) * 24 - 40); }
    x = Math.min(x, area.width - ww - 8); y = Math.min(y, area.height - wh - 8);
    w.style.left = Math.max(4, x) + 'px'; w.style.top = Math.max(4, y) + 'px';
  },
  open(app, arg, fromEl) {
    closeMenus();
    let w = this.wins[app] || this.make(app); if (!w) return;
    if (w._anim) { w._anim.onfinish = null; w._anim.cancel(); w._anim = null; if (w.classList.contains('closing')) w.classList.remove('open', 'closing'); }
    const def = APPS[app], was = w.classList.contains('open');
    if (!was) { w.classList.add('open'); if (!w.dataset.placed) { this.place(w, def); w.dataset.placed = '1'; } this.task(app, true); if (MOBILE) w.classList.add('max'); }
    const wasMin = w.classList.contains('minimized'); w.classList.remove('minimized'); this.focus(app);
    if (!was) {
      if (wasMin) this.flyFromTask(app);
      else { this.zoom(fromEl ? fromEl.getBoundingClientRect() : null, w.getBoundingClientRect()); anim(w, 'open'); }
      SOUND.sfx('open');
      if (fromEl) { fromEl.classList.remove('launching'); void fromEl.offsetWidth; fromEl.classList.add('launching'); }
    }
    if (def.open && (!was || arg !== undefined)) { try { def.open(arg, w); } catch (e) { console.error(e); } }
    return w;
  },
  close(app) {
    const w = this.wins[app]; if (!w) return; const def = APPS[app], wasOpen = w.classList.contains('open') && !w.classList.contains('closing');
    const finish = () => { w._anim = null; w.classList.remove('open', 'active', 'max', 'minimized', 'closing'); def && def.close && def.close(w); if (def && def.dispose) { w.remove(); delete this.wins[app]; } };
    this.task(app, false);
    if (wasOpen) { SOUND.sfx('close'); w.classList.add('closing'); w.classList.remove('active'); const a = anim(w, 'close'); if (a) { w._anim = a; a.onfinish = finish; } else finish(); }
    else finish();
    this.focusTop();
  },
  min(app) {
    const w = this.wins[app]; if (!w || !w.classList.contains('open')) return;
    const done = () => { w._anim = null; w.classList.remove('open', 'closing'); w.classList.add('minimized'); this.syncTasks(); };
    w.classList.remove('active'); w.classList.add('closing'); SOUND.sfx('min');
    const a = this.flyToTask(app); if (a) { w._anim = a; a.onfinish = done; } else done();
    this.focusTop();
  },
  restore(app) { this.open(app); },
  max(app) {
    if (MOBILE) return; const w = this.wins[app]; const f = w.getBoundingClientRect(); w.classList.toggle('max'); const t = w.getBoundingClientRect();
    if (!RM && t.width && t.height) { w.style.transformOrigin = '0 0'; const a = w.animate([{ transform: `translate(${f.left - t.left}px, ${f.top - t.top}px) scale(${f.width / t.width}, ${f.height / t.height})` }, { transform: 'none' }], { duration: 210, easing: 'cubic-bezier(.2,.8,.3,1)' }); a.onfinish = a.oncancel = () => { w.style.transformOrigin = ''; }; }
    const def = APPS[app]; def && def.resized && def.resized(w);
  },
  // the window shrinks into its taskbar button, and comes back out of it
  flyToTask(app) {
    const w = this.wins[app], b = $(`#tasks [data-task="${CSS.escape(app)}"]`); if (RM || MOBILE || !b) return null;
    const r = w.getBoundingClientRect(), t = b.getBoundingClientRect(), s = Math.max(.05, t.width / r.width);
    w.style.transformOrigin = '50% 50%';
    return w.animate([{ transform: 'none', opacity: 1, filter: 'none' }, { transform: `translate(${(t.left + t.width / 2) - (r.left + r.width / 2)}px, ${(t.top + t.height / 2) - (r.top + r.height / 2)}px) scale(${s})`, opacity: .15, filter: 'brightness(1.8)' }], { duration: 260, easing: 'cubic-bezier(.55,0,.35,1)' });
  },
  flyFromTask(app) {
    const w = this.wins[app], b = $(`#tasks [data-task="${CSS.escape(app)}"]`); if (RM || MOBILE || !b) return;
    const r = w.getBoundingClientRect(), t = b.getBoundingClientRect(), s = Math.max(.05, t.width / r.width);
    w.style.transformOrigin = '50% 50%';
    w.animate([{ transform: `translate(${(t.left + t.width / 2) - (r.left + r.width / 2)}px, ${(t.top + t.height / 2) - (r.top + r.height / 2)}px) scale(${s})`, opacity: .15, filter: 'brightness(1.8)' }, { transform: 'none', opacity: 1, filter: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.3,1)' });
  },
  retitle(app, title) { const w = this.wins[app]; if (!w) return; const s = w.querySelector('.tb .tt'); if (s) s.textContent = title; const b = $(`#tasks [data-task="${CSS.escape(app)}"] span`); if (b) b.textContent = title; },
  isOpen(app) { const w = this.wins[app]; return !!(w && w.classList.contains('open')); },
  focus(app) {
    const w = this.wins[app]; if (!w || !w.classList.contains('open')) return;
    if (!w.classList.contains('active')) { $$('.win.active').forEach(x => x.classList.remove('active')); w.classList.add('active'); }
    w.style.zIndex = ++this.z; this.syncTasks();
    const def = APPS[app]; def && def.focus && def.focus(w);
  },
  focusTop() { const open = $$('.win.open:not(.closing)').sort((a, b) => (+b.style.zIndex || 0) - (+a.style.zIndex || 0)); if (open[0]) this.focus(open[0].dataset.app); else this.syncTasks(); },
  task(app, on) {
    const box = $('#tasks'); let b = $(`[data-task="${CSS.escape(app)}"]`, box);
    if (on && !b) { const def = APPS[app]; b = document.createElement('button'); b.type = 'button'; b.className = 'task'; b.dataset.task = app;
      b.innerHTML = `<img src="${def.iconURL || ICONS[def.icon] || ICONS.folder}" alt=""><span>${esc(def.short || def.title)}</span>`;
      b.onclick = () => { const w = this.wins[app]; if (w.classList.contains('minimized') || w.classList.contains('closing')) this.restore(app); else if (w.classList.contains('active')) this.min(app); else this.focus(app); };
      box.appendChild(b); }
    if (!on && b) b.remove();
    this.syncTasks();
  },
  syncTasks() { $$('#tasks .task').forEach(b => { const w = this.wins[b.dataset.task]; b.classList.toggle('on', !!(w && w.classList.contains('active') && w.classList.contains('open'))); }); },
  // a glowing outline flies from the icon to where the window opens
  zoom(f, t) {
    if (RM || MOBILE || !f || !t || !f.width || !t.width) return;
    $('#zoomr').animate([{ left: f.left + 'px', top: f.top + 'px', width: f.width + 'px', height: f.height + 'px', opacity: .9 }, { left: t.left + 'px', top: t.top + 'px', width: t.width + 'px', height: t.height + 'px', opacity: .6, offset: .85 }, { left: t.left + 'px', top: t.top + 'px', width: t.width + 'px', height: t.height + 'px', opacity: 0 }], { duration: 260, easing: 'cubic-bezier(.3,.7,.3,1)' });
  },
  drag(e, w) {
    if (e.target.closest('button') || MOBILE || w.classList.contains('max') || e.button !== 0) return;
    e.preventDefault(); const r = w.getBoundingClientRect(), area = $('#wins').getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
    w.classList.add('dragging');
    const mv = ev => { w.style.left = Math.max(-r.width + 80, Math.min(area.width - 60, ev.clientX - area.left - ox)) + 'px'; w.style.top = Math.max(0, Math.min(area.height - 30, ev.clientY - area.top - oy)) + 'px'; };
    const up = () => { w.classList.remove('dragging'); removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  },
  resize(e, w) {
    e.preventDefault(); e.stopPropagation(); const r = w.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY, def = APPS[w.dataset.app] || {};
    const mv = ev => { w.style.setProperty('--ww', Math.max(def.minW || 300, r.width + ev.clientX - x0) + 'px'); w.style.setProperty('--wh', Math.max(def.minH || 180, r.height + ev.clientY - y0) + 'px'); def.resized && def.resized(w); };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  },
};
function anim(w, kind) {
  if (RM) return null; w.getAnimations().forEach(a => a.cancel());
  if (kind === 'open') return w.animate([
    { clipPath: 'inset(49.5% 46% 49.5% 46%)', filter: 'brightness(3) saturate(.3)', transform: 'scale(.99)' },
    { clipPath: 'inset(49.5% 0 49.5% 0)', filter: 'brightness(2.6) saturate(.4)', offset: .32 },
    { clipPath: 'inset(0 0 0 0)', filter: 'brightness(1.35)', transform: 'scale(1)', offset: .72 },
    { clipPath: 'inset(0 0 0 0)', filter: 'none', transform: 'none' }], { duration: 340, easing: 'cubic-bezier(.45,.05,.25,1)' });
  return w.animate([
    { clipPath: 'inset(0 0 0 0)', filter: 'none', opacity: 1 },
    { clipPath: 'inset(49.5% 0 49.5% 0)', filter: 'brightness(2.4) saturate(.4)', opacity: 1, offset: .6 },
    { clipPath: 'inset(49.5% 50% 49.5% 50%)', filter: 'brightness(3)', opacity: 0 }], { duration: 230, easing: 'cubic-bezier(.55,0,.8,.4)' });
}
X.WM = WM; X.open = (app, arg, from) => WM.open(app, arg, from);
window.__mwos = X; window.__budos = X;

// ================================================================ desktop: icons, start menu, tray, wallpaper
const DESK_ICONS = [['rig', 'rig.exe'], ['mountain', 'mountain.exe'], ['launch', 'launch.exe'], ['veins', 'veins'], ['chain', 'chain.exe'], ['stats', 'stats.exe'], ['ledger', 'ledger.db'], ['term', 'miner.sh'], ['readme', 'readme.txt'], ['paint', 'paint.exe'], ['display', 'display'], ['bin', 'recycle bin']];
function closeMenus() { $('#startm').hidden = true; $('#start').classList.remove('on'); const wm = $('#walletm'); if (wm) wm.hidden = true; }
function renderIcons() {
  const box = $('#icons'); box.innerHTML = '';
  DESK_ICONS.forEach(([app, label], i) => {
    if (!APPS[app]) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'icon'; b.dataset.open = app; b.style.setProperty('--d', (RM ? 0 : 560 + i * 42) + 'ms');
    b.innerHTML = `<img src="${ICONS[APPS[app].icon] || ICONS.folder}" alt=""><span>${esc(label)}</span>`;
    b.onclick = e => { $$('.icon.sel').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); if (MOBILE || e.detail === 0) WM.open(app, undefined, b); };
    b.ondblclick = () => WM.open(app, undefined, b);
    b.onkeydown = e => { if (e.key === 'Enter') WM.open(app, undefined, b); };
    box.appendChild(b);
  });
}
function renderStart() {
  const m = $('#startm');
  const items = [['rig', 'mine a coin', 'rig.exe'], ['launch', 'launch a coin', 'launch.exe'], ['mountain', 'mountain.exe', 'every mine, live'], ['veins', 'veins', 'every mine, as a list'], ['chain', 'chain.exe', 'every block, checkable'], ['stats', 'stats.exe', 'the mountain in numbers'], ['ledger', 'ledger', 'every block, every tx'], ['term', 'terminal', 'miner.sh'], ['-'],
    ['paint', 'paint.exe', 'draw a coin'], ['readme', 'readme.txt', 'how it works'], ['display', 'display', 'crt, sound, miners'], ['-'], ['shutdown', 'shut down…', 'back up the tunnel']];
  m.innerHTML = `<div class="sm-side"><span>Mine OS</span></div><div class="sm-list">${items.map(([a, t, s], i) => a === '-' ? '<hr>' : `<button type="button" data-app="${a}" style="--i:${i}"><img src="${a === 'shutdown' ? ICONS.x : ICONS[(APPS[a] || {}).icon] || ICONS.folder}" alt=""><b>${esc(t)}</b><small>${esc(s)}</small></button>`).join('')}</div>`;
  $$('button', m).forEach(b => b.onclick = () => { closeMenus(); if (b.dataset.app === 'shutdown') return shutdown(); WM.open(b.dataset.app); });
}
function shutdown() {
  closeMenus(); SOUND.sfx('crtoff'); ss.del('mw:seen'); if (X.RIG && X.RIG.on) killRig();
  $('#desk').classList.add('crt-off');
  setTimeout(() => { const s = document.createElement('div'); s.id = 'shut'; s.innerHTML = '<p>the mine never closes.</p><p class="d">see you down there.</p>'; document.body.appendChild(s); }, 560);
  setTimeout(() => location.href = '/', 3200);
}

// wallet chip + picker
function renderWallet() {
  const chip = $('#wchip'), cur = WAL.current();
  chip.innerHTML = cur ? `<i class="dot on"></i>${esc(short(cur.address))}` : '<i class="dot"></i>connect';
  chip.classList.toggle('on', !!cur);
}
async function walletMenu(anchor) {
  let m = $('#walletm'); if (!m) { m = document.createElement('div'); m.id = 'walletm'; m.className = 'popm'; document.body.appendChild(m); }
  if (!m.hidden) { m.hidden = true; return; }
  const cur = WAL.current();
  if (cur) m.innerHTML = `<div class="ph">${esc(cur.name)}</div><button type="button" data-x="copy">${esc(short(cur.address))} · copy</button><button type="button" data-x="mine">my mines</button><button type="button" data-x="off">disconnect</button>`;
  else { const ws = WAL.wallets(); m.innerHTML = `<div class="ph">connect a wallet</div>` + (ws.length ? ws.map((w, i) => `<button type="button" data-w="${i}"><img src="${esc(w.icon)}" alt="">${esc(w.name)}</button>`).join('') : '<p class="pm">no Solana wallet found in this browser. install Phantom, Solflare or Backpack, then reload.</p>'); }
  const r = anchor.getBoundingClientRect(); m.style.right = Math.max(8, innerWidth - r.right) + 'px'; m.style.bottom = (innerHeight - r.top + 6) + 'px'; m.hidden = false;
  $$('button', m).forEach(b => b.onclick = async () => {
    m.hidden = true;
    if (b.dataset.x === 'copy') return copy(cur.address);
    if (b.dataset.x === 'off') { await WAL.disconnect(); return; }
    if (b.dataset.x === 'mine') return WM.open('veins', { tab: 'mine' });
    try { await WAL.connect(WAL.wallets()[+b.dataset.w]); toast('wallet connected'); } catch (e) { toast(e.message || 'the wallet said no'); }
  });
}
X.connect = async () => {
  if (WAL.current()) return WAL.current();
  const ws = WAL.wallets();
  if (!ws.length) throw new Error('No Solana wallet found in this browser. Install Phantom, Solflare or Backpack, then reload.');
  if (ws.length === 1) return WAL.connect(ws[0]);
  walletMenu($('#wchip')); throw new Error('Pick a wallet below, then press the button again.');
};

// tray: the engine's heartbeat and a clock
function renderTray() {
  const e = $('#engine'), t = X.TICK, age = t ? (Date.now() - t) / 1000 : null;
  e.className = 'tray-e ' + (age == null ? 'off' : age < 180 ? 'ok' : 'late');
  e.title = age == null ? 'engine: no tick yet' : `engine: last pass ${ago(t)} ago`;
  $('span', e).textContent = age == null ? 'engine' : `engine ${ago(t)}`;
  const d = new Date(); $('#clock').textContent = d.toTimeString().slice(0, 5);
  renderRig();
}
// the rig in the tray: while your browser mines, it shows how fast
function renderRig() {
  const r = $('#rigt'); if (!r) return; const R = X.RIG;
  if (!R || !R.on) { r.hidden = true; return; }
  const m = (X.MINES || []).find(x => x.mint === R.mint);
  r.hidden = false; r.innerHTML = `<i class="pk"></i>${esc(R.cooling ? 'waiting' : X.hs ? X.hs(R.rate) : '')}${m ? ` · $${esc(m.symbol)}` : ''}`;
}
function killRig() { try { X.RIG.on = false; (X.RIG.workers || []).forEach(w => w.terminate()); X.RIG.workers = []; } catch {} }

// ---------------------------------------------------------------- wallpaper: the mine after hours. lanterns on the beams, gold in the rock, dust in the light.
// Everything that doesn't move is drawn once, into a cache.
function wallpaper() {
  const c = $('#wall'), g = c.getContext('2d'); let W = 0, H = 0, D = 1, mx = .5, my = .5, sx = .5, sy = .5, last = 0, bar = 42, top = 0;
  const dust = Array.from({ length: MOBILE ? 26 : 70 }, () => ({ x: Math.random(), y: Math.random(), z: .2 + Math.random() * .8, v: .003 + Math.random() * .01, p: Math.random() * 6 }));
  const LAMPS = [[.14, .9], [.38, 1.1], [.63, 1], [.88, .85]];
  const mk = (w, h) => { const k = document.createElement('canvas'); k.width = Math.max(1, Math.round(w)); k.height = Math.max(1, Math.round(h)); return k; };
  let bg = null, flick = 0, glints = [], quake = 0, flare = 0;
  const carts = [], grit = [];
  X.on('feed', it => {
    if (it.kind !== 'block' || RM) return;
    quake = 1; flare = 1;
    for (let i = 0; i < (MOBILE ? 14 : 30); i++) grit.push({ x: Math.random() * W, y: top + 2 + Math.random() * 8, vy: 10 + Math.random() * 50, s: 1 + Math.random() * 2.2, c: Math.random() < .25 ? '255,214,140' : '120,92,64' });
    if (carts.length < 3) carts.push({ x: -90 - carts.length * 120, sym: it.symbol, sol: Number(it.sol || 0), h: it.height });
  });
  X.mineCart = (sym, sol, h) => carts.push({ x: -90, sym, sol, h });
  function build() {
    const floor = H - bar; bg = mk(W * D, H * D); const q = bg.getContext('2d'); q.scale(D, D);
    const gr = q.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#030201'); gr.addColorStop(.55, '#0b0603'); gr.addColorStop(1, '#1a0f06'); q.fillStyle = gr; q.fillRect(0, 0, W, H);
    // the rock: soft blotches, then gold veins running through it
    let sd = 7; const rnd = () => (sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < 260; i++) { const x = rnd() * W, y = rnd() * H, r = 20 + rnd() * 90; const rg = q.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, `rgba(${60 + rnd() * 30 | 0},${36 + rnd() * 16 | 0},${18 + rnd() * 10 | 0},.10)`); rg.addColorStop(1, 'rgba(0,0,0,0)'); q.fillStyle = rg; q.fillRect(x - r, y - r, r * 2, r * 2); }
    glints = [];
    for (let v = 0; v < 7; v++) { let x = rnd() * W, y = rnd() * floor, a = rnd() * Math.PI * 2; for (let i = 0; i < 160; i++) { a += (rnd() - .5) * .5; x += Math.cos(a) * 3; y += Math.sin(a) * 2; if (x < 0 || x > W || y < 0 || y > floor) break; const hi = rnd() < .14; q.fillStyle = hi ? 'rgba(255,226,150,.30)' : 'rgba(242,178,62,.13)'; q.fillRect(Math.round(x), Math.round(y), 2, 2); if (hi && rnd() < .35) glints.push({ x, y, p: rnd() * 6 }); } }
    for (const [fx, wd] of LAMPS) {
      const x = fx * W, sg = q.createLinearGradient(0, 0, 0, floor); sg.addColorStop(0, 'rgba(255,190,110,.07)'); sg.addColorStop(.6, 'rgba(255,170,80,.022)'); sg.addColorStop(1, 'rgba(255,170,80,0)');
      q.fillStyle = sg; q.beginPath(); q.moveTo(x - 30 * wd, top + 14); q.lineTo(x + 30 * wd, top + 14); q.lineTo(x + 200 * wd, floor); q.lineTo(x - 200 * wd, floor); q.closePath(); q.fill();
      q.fillStyle = 'rgba(60,40,24,.9)'; q.fillRect(x - 1, top, 2, 10); q.fillStyle = 'rgba(255,214,140,.85)'; q.shadowColor = '#ffb347'; q.shadowBlur = 16; q.fillRect(x - 4, top + 10, 8, 8); q.shadowBlur = 0;
    }
    // a beam along the ceiling
    q.fillStyle = 'rgba(42,28,16,.9)'; q.fillRect(0, top, W, 4);
    if (X.SET.grid) { q.strokeStyle = 'rgba(255,179,71,.025)'; q.lineWidth = 1; q.beginPath(); for (let x = 0; x < W; x += 32) { q.moveTo(x + .5, 0); q.lineTo(x + .5, H); } for (let y = 0; y < H; y += 32) { q.moveTo(0, y + .5); q.lineTo(W, y + .5); } q.stroke(); }
    const fg = q.createLinearGradient(0, floor - 90, 0, floor); fg.addColorStop(0, 'rgba(255,179,71,0)'); fg.addColorStop(1, 'rgba(255,179,71,.06)'); q.fillStyle = fg; q.fillRect(0, floor - 90, W, 90);
    // rails along the floor
    q.fillStyle = 'rgba(120,96,70,.35)'; q.fillRect(0, floor - 14, W, 2); q.fillRect(0, floor - 6, W, 2); q.fillStyle = 'rgba(60,40,24,.5)'; for (let x = 6; x < W; x += 22) q.fillRect(x, floor - 16, 6, 12);
  }
  const fit = () => { D = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; c.width = Math.round(W * D); c.height = Math.round(H * D); g.setTransform(D, 0, 0, D, 0, 0); const cs = getComputedStyle(document.documentElement); bar = parseInt(cs.getPropertyValue('--bar')) || 42; top = parseInt(cs.getPropertyValue('--tick')) || 0; bg = null; };
  fit(); addEventListener('resize', fit); X.on('settings', () => { bg = null; });
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth; my = e.clientY / innerHeight; }, { passive: true });
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden || now - last < (MOBILE ? 55 : 40)) return; const dt = Math.max(0, Math.min(.1, (now - last) / 1000)); last = now;
    if (!bg) build();
    sx += (mx - sx) * .05; sy += (my - sy) * .05;
    const qx = quake > 0 ? (Math.random() - .5) * 7 * quake : 0, qy = quake > 0 ? (Math.random() - .5) * 4 * quake : 0; quake = Math.max(0, quake - dt * 1.4);
    g.setTransform(1, 0, 0, 1, 0, 0); if (qx || qy) { g.fillStyle = '#030201'; g.fillRect(0, 0, c.width, c.height); } g.drawImage(bg, Math.round(qx * D), Math.round(qy * D)); g.setTransform(D, 0, 0, D, 0, 0);
    const floor = H - bar;
    // the lamps flare when a block lands
    if (flare > 0) { for (const [fx] of LAMPS) { const x = fx * W, rg = g.createRadialGradient(x, top + 14, 0, x, top + 14, 90); rg.addColorStop(0, `rgba(255,214,140,${(.45 * flare).toFixed(3)})`); rg.addColorStop(1, 'rgba(255,170,60,0)'); g.fillStyle = rg; g.fillRect(x - 90, top - 76, 180, 180); } flare = Math.max(0, flare - dt * .9); }
    // grit shaken off the ceiling
    for (let i = grit.length - 1; i >= 0; i--) { const p = grit[i]; p.vy += 260 * dt; p.y += p.vy * dt; if (p.y > floor - 4) { grit.splice(i, 1); continue; } g.fillStyle = `rgba(${p.c},.8)`; g.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); }
    // a cart of gold rolls along the rails for every block found
    for (let i = carts.length - 1; i >= 0; i--) { const k = carts[i]; k.x += (MOBILE ? 120 : 165) * dt; if (k.x > W + 120) { carts.splice(i, 1); continue; } drawCart(k, floor, now); }
    // one lantern gutters now and then
    if (Math.random() < dt / 9) flick = now;
    if (now - flick < 260 && (now / 40 | 0) % 2) { const x = LAMPS[2][0] * W, wd = LAMPS[2][1]; g.fillStyle = 'rgba(3,2,1,.55)'; g.beginPath(); g.moveTo(x - 30 * wd, top + 14); g.lineTo(x + 30 * wd, top + 14); g.lineTo(x + 200 * wd, floor); g.lineTo(x - 200 * wd, floor); g.closePath(); g.fill(); }
    for (const p of glints) { const a = Math.max(0, Math.sin(now / 900 + p.p * 3)) ** 8; if (a > .02) { g.fillStyle = `rgba(255,240,200,${(a * .8).toFixed(2)})`; g.fillRect(Math.round(p.x) - 1, Math.round(p.y), 4, 1); g.fillRect(Math.round(p.x) + 1, Math.round(p.y) - 1, 1, 4); } }
    for (const p of dust) {
      p.y -= p.v * dt * (1 + p.z) * .6; p.x += Math.sin(now / 1900 + p.p) * .0003; if (p.y < -.02) { p.y = 1.02; p.x = Math.random(); }
      g.fillStyle = `rgba(255,214,160,${(.06 + p.z * .26).toFixed(2)})`; g.fillRect(Math.round(p.x * W + (sx - .5) * -60 * p.z), Math.round(p.y * H + (sy - .5) * -24 * p.z), 1 + p.z * 2, 1 + p.z * 2);
    }
  }
  function drawCart(k, floor, now) {
    const x = Math.round(k.x), y = floor - 7, b = Math.round(Math.sin(now / 60 + x) * .6);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 3, y + 3, 58, 3);
    g.fillStyle = '#4a3320'; g.fillRect(x + 4, y - 18 + b, 56, 16); g.fillStyle = '#a07a48'; g.fillRect(x + 2, y - 20 + b, 60, 3); g.fillStyle = '#6a4a28'; g.fillRect(x + 10, y - 17 + b, 3, 14); g.fillRect(x + 51, y - 17 + b, 3, 14); g.fillStyle = '#2a1d12'; g.fillRect(x + 4, y - 4 + b, 56, 2);
    g.fillStyle = '#c98a2c'; g.beginPath(); g.ellipse(x + 32, y - 20 + b, 26, 9, 0, Math.PI, 0); g.fill(); g.fillStyle = '#f2c14e'; g.beginPath(); g.ellipse(x + 30, y - 21 + b, 21, 7, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#fff1cf'; g.fillRect(x + 22, y - 26 + b, 3, 2); g.fillRect(x + 38, y - 24 + b, 2, 2);
    const sp = (now / 70 | 0) % 2; [[x + 15, y], [x + 49, y]].forEach(([wx, wy]) => { g.fillStyle = '#0f0a06'; g.beginPath(); g.arc(wx, wy - 1, 5, 0, 7); g.fill(); g.fillStyle = '#c9a46a'; g.fillRect(wx - 1 + sp, wy - 2, 2, 2); });
    g.font = '13px PX, monospace'; g.textAlign = 'center'; g.fillStyle = 'rgba(0,0,0,.6)'; const t = `$${k.sym} #${k.h}${k.sol > 0 ? `  +${fsol(k.sol)} SOL` : ''}`; g.fillText(t, x + 33, y - 33 + b); g.fillStyle = '#ffd27a'; g.fillText(t, x + 32, y - 34 + b); g.textAlign = 'left';
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- settings
const SET_DEF = { crt: true, eyes: true, grid: true, pets: true, toasts: true };
X.SET = Object.assign({}, SET_DEF, (() => { try { return JSON.parse(ls.get('mw:set') || '{}'); } catch { return {}; } })());
X.saveSet = () => { ls.set('mw:set', JSON.stringify(X.SET)); applySet(); X.emit('settings', X.SET); };
function applySet() { document.body.classList.toggle('crt', !!X.SET.crt); }

// ---------------------------------------------------------------- live data: the mines, the feed, the config
X.MINES = [];
async function pollMines() {
  try {
    const j = await api('veins', { params: { limit: 150 } });
    X.MINES = j.veins || []; X.TOTALS = j.totals || {}; X.TICK = j.tickAt || null;
    X.BUDS = X.MINES.map(m => Object.assign({}, m, { budName: '$' + m.symbol, workedAt: m.lastBlockAt }));
    X.emit('mines', X.MINES); X.emit('buds', X.BUDS); renderTray();
  } catch {}
}
let feedPrimed = false, lastToast = 0;
async function pollFeed() {
  try {
    const j = await api('feed', { params: { after: X.FEEDLAST } });
    const items = (j.items || []).slice().reverse().filter(i => Number(i.n) > X.FEEDLAST).map(i => Object.assign(i, { bud_name: '$' + i.symbol }));
    if (items.length) X.FEEDLAST = Math.max(X.FEEDLAST, ...items.map(i => Number(i.n)));
    if (!feedPrimed) { feedPrimed = true; X.RECENT = items.slice().reverse().slice(0, 60); X.emit('feedinit', items); return; }
    for (const it of items) {
      X.RECENT.unshift(it); if (X.RECENT.length > 60) X.RECENT.length = 60;
      X.emit('feed', it);
      const mine = X.RIG && X.RIG.on && it.miner && it.miner === X.RIG.miner;
      if ((it.kind === 'block' || (it.kind === 'launch' && / is live\./.test(it.text))) && X.SET.toasts && !mine && Date.now() - lastToast > 2500) {
        lastToast = Date.now(); SOUND.sfx(it.kind === 'block' ? 'coin' : 'buddy');
        toast(`$${it.symbol}: ${it.text}`, { icon: '/i/' + it.id, kind: it.kind === 'block' ? 'gold' : '', onclick: () => X.openMine(it.mint) });
      }
    }
    if (items.length) pollMines();
    if (items.some(i => i.kind === 'block')) setTimeout(pollBlocks, 400);
  } catch {}
}
// the newest blocks across every chain, for the ticker and mountain.exe
X.BLOCKS = [];
async function pollBlocks() { try { const j = await api('blocks', { params: { all: 1, limit: 12 } }); X.BLOCKS = j.blocks || []; X.emit('blocks', X.BLOCKS); } catch {} }
X.refresh = () => { pollMines(); pollFeed(); };
X.mineBy = key => { const k = String(key || '').toLowerCase().replace(/^\$/, ''); return X.MINES.find(m => m.mint === key || m.id === key || m.symbol.toLowerCase() === k || m.name.toLowerCase() === k); };
X.budBy = key => { const m = X.mineBy(key); return m ? X.BUDS.find(b => b.mint === m.mint) : null; };

// ================================================================ init
async function initDesk() {
  await SPR.ready.catch(() => null);
  Object.assign(APPS, installApps(X), installTerm(X));
  renderIcons(); renderStart(); applySet();
  $('#start').onclick = e => { e.stopPropagation(); const m = $('#startm'); const was = !m.hidden; closeMenus(); if (!was) { m.hidden = false; $('#start').classList.add('on'); SOUND.sfx('click'); } };
  $('#wchip').onclick = e => { e.stopPropagation(); walletMenu($('#wchip')); };
  $('#engine').onclick = () => WM.open('term', 'engine');
  const sb = $('#sndb'); SOUND.onChange(st => { sb.textContent = st.muted ? '♪̸' : '♪'; sb.title = st.muted ? 'sound off' : 'sound on'; }); sb.onclick = () => SOUND.toggle();
  addEventListener('pointerdown', e => { if (!e.target.closest('#startm, #start, #walletm, #wchip')) closeMenus(); if (!e.target.closest('.icon')) $$('.icon.sel').forEach(x => x.classList.remove('sel')); });
  addEventListener('keydown', e => {
    if (e.key === 'Escape') closeMenus();
    if (e.key === '`' && !e.target.closest('input, textarea, [contenteditable]')) { e.preventDefault(); if (WM.isOpen('term') && WM.wins.term.classList.contains('active')) WM.min('term'); else WM.open('term'); }
  });
  WAL.onChange(() => { renderWallet(); X.emit('wallet', WAL.current()); });
  wallpaper();
  X.CFG = await api('config').catch(() => null);
  await pollMines(); await pollFeed(); await pollBlocks();
  setInterval(pollMines, 15000); setInterval(pollFeed, 6000); setInterval(pollBlocks, 45000); setInterval(renderTray, 15000); renderTray();
  try { ticker(); } catch (e) { console.error(e); }
  setInterval(() => { if (X.RIG && X.RIG.on) renderRig(); }, 1000); X.on('rig', renderRig);
  const rt = $('#rigt'); if (rt) rt.onclick = () => WM.open('rig');
  try { installPets(X); } catch (e) { console.error(e); }
  // the engine runs on a cron; a visit also gives it a nudge, at most once a minute from here
  if (!ss.get('mw:nudge') || Date.now() - +ss.get('mw:nudge') > 60000) { ss.set('mw:nudge', String(Date.now())); fetch('/api/tick').catch(() => {}); }
}
// ---------------------------------------------------------------- the ticker: the newest blocks and the fullest pools, rolling along the top
function ticker() {
  const box = $('#ticker'); if (!box) return;
  const vp = $('.tk-vp', box), strip = $('.tk-strip', box), sum = $('.tk-sum', box);
  const T = { x: 0, last: 0, hold: false, fresh: [], ring: [], ri: 0, gap: 30 };
  const img = it => it.id ? `<img src="/i/${encodeURIComponent(it.id)}" alt="" loading="lazy">` : '';
  const html = it => {
    if (it.k === 'tag') return `<span class="tk-it tag"${it.app ? ` data-app="${it.app}"` : ''}>${it.t}</span>`;
    const a = `class="tk-it ${it.k}${it.isNew ? ' new' : ''}" data-m="${esc(it.mint)}" type="button"`;
    if (it.k === 'blk') return `<button ${a}>${img(it)}<span class="s">$${esc(it.sym)}</span><b>block #${esc(it.h)}</b>${it.sol > 0 ? `<span class="g">+${fsol(it.sol)} SOL</span>` : '<span class="m">found</span>'}<i>${esc(ago(it.at))} ago</i></button>`;
    if (it.k === 'pool') return `<button ${a}>${img(it)}<span class="s">$${esc(it.sym)}</span><span class="m">pool</span><b class="g">${fsol(it.pool)} SOL</b><i>${it.miners ? `${it.miners} mining` : `block #${it.h} waiting`}</i></button>`;
    if (it.k === 'live') return `<button ${a}>${img(it)}<span class="s">$${esc(it.sym)}</span><b>is live</b><i>a new mine · ${esc(ago(it.at))} ago</i></button>`;
    return '';
  };
  const fromFeed = i => i.kind === 'block' ? { k: 'blk', mint: i.mint, id: i.id, sym: i.symbol, h: i.height, sol: Number(i.sol || 0), at: i.at } : { k: 'live', mint: i.mint, id: i.id, sym: i.symbol, at: i.at };
  function ring() {
    const ms = (X.MINES || []).filter(m => m.state === 'live');
    const blocks = (X.BLOCKS || []).slice(0, 8).map(b => ({ k: 'blk', mint: b.mint, id: b.id, sym: b.symbol, h: b.height, sol: Number(b.reward || 0), at: b.at }));
    const pools = ms.slice().sort((a, b) => (b.miners - a.miners) || (b.pool - a.pool)).slice(0, 8).map(m => ({ k: 'pool', mint: m.mint, id: m.id, sym: m.symbol, pool: m.pool, miners: m.miners, h: m.height }));
    const lives = (X.RECENT || []).filter(i => i.kind === 'launch' && / is live\./.test(i.text)).slice(0, 3).map(fromFeed);
    const out = []; for (let i = 0; i < Math.max(blocks.length, pools.length); i++) { if (blocks[i]) out.push(blocks[i]); if (pools[i]) out.push(pools[i]); }
    out.push(...lives);
    if (!out.length) return [{ k: 'tag', t: 'every coin is a mine' }, { k: 'tag', t: 'your browser mines it' }, { k: 'tag', t: 'every block pays SOL' }, { k: 'tag', t: 'no mines open yet · <b>launch the first coin ›</b>', app: 'launch' }];
    return out;
  }
  const next = () => { if (T.fresh.length) return T.fresh.shift(); if (T.ri >= T.ring.length) { T.ring = ring(); T.ri = 0; } return T.ring[T.ri++]; };
  function fill() { let n = 0; while (strip.offsetWidth - T.x < vp.clientWidth + 260 && n++ < 40) strip.insertAdjacentHTML('beforeend', html(next())); }
  function totals() { const t = X.TOTALS || {}; sum.innerHTML = `<span><b>${t.mines || 0}</b> mines</span><span><b>${t.miners || 0}</b> mining</span><span><b>${fsol(t.pool || 0)}</b> SOL in pools</span>`; }
  // a new block shows up just past the right edge, so it rolls in within a second or two
  X.on('feed', i => {
    if (!(i.kind === 'block' || (i.kind === 'launch' && / is live\./.test(i.text)))) return;
    const it = Object.assign(fromFeed(i), { isNew: true }), edge = vp.clientWidth + T.x;
    const after = [...strip.children].find(c => c.offsetLeft > edge);
    if (after) after.insertAdjacentHTML('beforebegin', html(it)); else T.fresh.unshift(it);
  });
  X.on('mines', () => { totals(); if (T.ring.length === 4 && T.ring[0].k === 'tag' && (X.MINES || []).length) { T.ring = []; T.ri = 0; } });
  strip.addEventListener('click', e => { const b = e.target.closest('[data-m], [data-app]'); if (!b) return; SOUND.sfx('click'); if (b.dataset.m) X.openMine(b.dataset.m); else WM.open(b.dataset.app); });
  vp.addEventListener('pointerenter', () => { T.hold = true; }); vp.addEventListener('pointerleave', () => { T.hold = false; });
  sum.onclick = () => WM.open('stats');
  T.ring = ring(); totals(); fill();
  const speed = MOBILE ? 30 : 40;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.1, (now - (T.last || now)) / 1000); T.last = now;
    if (document.hidden || T.hold || RM) return;
    T.x += speed * dt;
    const f = strip.firstElementChild;
    if (f) { const w = f.offsetWidth + T.gap; if (T.x > w) { T.x -= w; f.remove(); fill(); } } else fill();
    strip.style.transform = `translate3d(${(-T.x).toFixed(2)}px,0,0)`;
  }
  requestAnimationFrame(frame);
}
X.openBud = key => X.openMine(key);

boot();
