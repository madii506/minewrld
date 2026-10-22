// The way in: rain on a mountain at night, and a mine going into it. The lanterns clunk on one by one down the tunnel,
// the little miners on the crates turn to watch you, eyes blink in the cracks of the walls. At the far end an old amber
// terminal boots. Type on it, or press enter, and you go through the screen into minewrld.
import * as THREE from './vendor/three.module.min.js';
import { EffectComposer } from './vendor/EffectComposer.js';
import { RenderPass } from './vendor/RenderPass.js';
import { UnrealBloomPass } from './vendor/UnrealBloomPass.js';
import { OutputPass } from './vendor/OutputPass.js';
import { build, V } from './mine.js?v=1';

const clamp01 = k => Math.max(0, Math.min(1, k));
const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const easeIn = k => k * k * k;
const sine = k => .5 - Math.cos(Math.PI * k) / 2;
const C = { ink: '#ffe6c2', ok: '#ffb347', dim: '#9a7748', red: '#ff6b5a', white: '#ffffff', mag: '#ff8a5c' };
const JOBS = [['claim', 'creator fees, every minute'], ['pool', 'the fees wait for a block'], ['hash', 'browsers search for it'],
  ['find', 'one hash under the target'], ['pay', 'the finder takes the pool'], ['write', 'the block goes on solana']];

// ---------------------------------------------------------------- sprites: the miner, its eyes kept apart so they can move
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
function splitSprite(img) {
  const w = img.width, h = img.height, mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const body = mk(), eyes = mk(), bg = body.getContext('2d'), eg = eyes.getContext('2d');
  bg.drawImage(img, 0, 0); const d = bg.getImageData(0, 0, w, h), e = eg.createImageData(w, h);
  for (let i = 0; i < d.data.length; i += 4) {
    const r = d.data[i], g = d.data[i + 1], b = d.data[i + 2];
    if (d.data[i + 3] && r > 220 && g > 245 && b > 230) { e.data.set([r, g, b, 255], i); d.data.set([16, 19, 17, 255], i); }
  }
  bg.putImageData(d, 0, 0); eg.putImageData(e, 0, 0); return { body, eyes, w, h };
}

// ---------------------------------------------------------------- the CRT: a real terminal drawn into a texture
const GLYPHS = {
  m: ['......', '......', '......', 'XX.XX.', 'XXXXXX', 'XX.X.X', 'XX.X.X', 'XX...X', 'XX...X'],
  i: ['XX', '..', '..', 'XX', 'XX', 'XX', 'XX', 'XX', 'XX'],
  n: ['.....', '.....', '.....', 'XXXX.', 'XX.XX', 'XX.XX', 'XX.XX', 'XX.XX', 'XX.XX'],
  e: ['.....', '.....', '.....', '.XXX.', 'XX.XX', 'XXXXX', 'XX...', 'XX..X', '.XXX.'],
  w: ['......', '......', '......', 'XX...X', 'XX...X', 'XX.X.X', 'XX.X.X', 'XXXXXX', '.X.XX.'],
  r: ['....', '....', '....', 'XXXX', 'XX.X', 'XX..', 'XX..', 'XX..', 'XX..'],
  l: ['XX', 'XX', 'XX', 'XX', 'XX', 'XX', 'XX', 'XX', '.X'],
  d: ['....XX', '....XX', '....XX', '.XXXXX', 'XX.XXX', 'XX..XX', 'XX..XX', 'XX..XX', '.XXXXX'],
};
class Terminal {
  constructor() {
    this.W = 1024; this.H = 768;
    this.c = document.createElement('canvas'); this.c.width = this.W; this.c.height = this.H; this.g = this.c.getContext('2d');
    this.b = document.createElement('canvas'); this.b.width = this.W; this.b.height = this.H; this.bg = this.b.getContext('2d');
    this.t = new THREE.CanvasTexture(this.c); this.t.colorSpace = THREE.SRGBColorSpace; this.t.anisotropy = 4;
    this.lines = []; this.input = ''; this.prompt = false; this.logo = 0; this.power = 0; this.dirty = true; this.blink = true;
    this.LH = 38; this.X = 58; this.Y = 48; this.max = 18; this.shut = 0; this.mode = 'term'; this.tunnel = 0; this.wobble = 0; this.flick = 0; this.glitch = 0; this.off = true; this.peek = null;
  }
  push(runs) { this.lines.push(runs); while (this.lines.length > this.max) this.lines.shift(); this.dirty = true; return this.lines.length - 1; }
  set(i, runs) { this.lines[i] = runs; this.dirty = true; }
  clear() { this.lines = []; this.dirty = true; this.flick = 1; }
  get busy() { return this.power < 1 || this.wobble > 0 || this.mode === 'tunnel' || (this.logo > 0 && this.logo < 1) || this.flick > 0 || this.glitch > 0 || this.peek; }
  draw(now, dt) {
    const blink = Math.floor(now / 530) % 2 === 0;
    if (!this.dirty && blink === this.blink && !this.busy && !this.first) return;
    this.blink = blink; this.dirty = false; this.first = false;
    const g = this.bg, W = this.W, H = this.H;
    if (this.off) { g.fillStyle = '#030505'; g.fillRect(0, 0, W, H); this.glass(g); return this.compose(0); }
    if (this.power < 1) {
      const k = this.power; g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      const hh = Math.max(2, H * Math.max(0, (k - .3) / .7)), ww = W * Math.min(1, k / .3);
      g.fillStyle = `rgba(255,232,196,${k < .3 ? .4 + k * 2 : 1 - (k - .3) * .7})`; g.shadowColor = '#ffd9a0'; g.shadowBlur = 30;
      g.fillRect(W / 2 - ww / 2, H / 2 - hh / 2, ww, hh); g.shadowBlur = 0;
      return this.compose(dt);
    }
    const r = g.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W * .7); r.addColorStop(0, '#2c1a06'); r.addColorStop(1, '#0a0602');
    g.fillStyle = r; g.fillRect(0, 0, W, H);
    if (this.mode === 'eyes') this.drawFace(g); else if (this.mode === 'tunnel') this.drawTunnel(g); else this.drawText(g, blink, now);
    this.glass(g);
    this.compose(dt);
  }
  drawText(g, blink, now) {
    g.textBaseline = 'top'; g.font = `${this.LH}px VT, monospace`;
    let y = this.Y;
    const run = (runs, x0, yy) => { let x = x0; for (const [s, c] of runs) { g.fillStyle = c || C.ink; g.shadowColor = g.fillStyle; g.shadowBlur = 10; g.fillText(s, x, yy); x += g.measureText(s).width; } g.shadowBlur = 0; return x; };
    if (this.logo) {
      const px = 13, rows = Array(9).fill('');
      for (const ch of 'minewrld') GLYPHS[ch].forEach((row, i) => rows[i] += row + '.');
      const k = Math.min(1, this.logo), x0 = this.X + 6, y0 = y + 6;
      g.shadowColor = C.ok; g.shadowBlur = 24;
      rows.forEach((row, ry) => [...row].forEach((c, rx) => {
        if (c !== 'X') return;
        const on = k >= 1 || Math.random() < k * 1.4 - rx / row.length * .45;
        g.fillStyle = on ? C.ok : 'rgba(255,179,71,.35)';
        if (on) g.fillRect(x0 + rx * px, y0 + ry * px, px - 1, px - 1); else g.fillText('░▒▓#%'[(Math.random() * 5) | 0], x0 + rx * px, y0 + ry * px - 8);
      }));
      // the miner sits next to the name and watches whoever is typing
      if (this.sprite && k >= 1) {
        const s = 5, sx = x0 + rows[0].length * px + 22, sy = y0 - 22, ex = Math.round(this.eyeX || 0);
        g.imageSmoothingEnabled = false; g.shadowColor = 'rgba(255,190,90,.6)'; g.shadowBlur = 20;
        g.drawImage(this.sprite.body, sx, sy, 32 * s, 32 * s); g.shadowColor = '#fff1d6'; g.shadowBlur = 16;
        if (!this.blinking) g.drawImage(this.sprite.eyes, sx + ex * s, sy, 32 * s, 32 * s);
      }
      g.shadowBlur = 0; y += 9 * px + 30;
      if (this.logo < 1) this.dirty = true;
    }
    for (const ln of this.lines) { run(ln, this.X, y); y += this.LH; }
    if (this.prompt) {
      const x = run([['C:\\MINE> ', C.ok], [this.input, C.white]], this.X, y);
      if (blink) { g.fillStyle = C.ink; g.fillRect(x + 2, y + 6, 15, this.LH - 8); }
    }
  }
  drawFace(g) {
    const W = this.W, H = this.H, s = 22, sw = 32 * s; g.fillStyle = '#040201'; g.fillRect(0, 0, W, H);
    if (!this.sprite) return; g.imageSmoothingEnabled = false;
    const x = (W - 22 * s) / 2, y = (H - sw) / 2 + 40;
    g.globalAlpha = .9; g.drawImage(this.sprite.body, x, y, sw, sw); g.globalAlpha = 1;
    if (this.shut < 1) { g.save(); g.shadowColor = '#fff1d6'; g.shadowBlur = 50; g.translate(0, y + 16 * s); g.scale(1, 1 - this.shut); g.drawImage(this.sprite.eyes, x + Math.round(this.eyeX || 0) * s, -16 * s, sw, sw); g.restore(); }
    this.dirty = true;
  }
  drawTunnel(g) {                                          // the mining loop rushing past on the way in
    const W = this.W, H = this.H, k = this.tunnel;
    g.fillStyle = '#060301'; g.fillRect(0, 0, W, H);
    g.textBaseline = 'top';
    for (let i = JOBS.length - 1; i >= 0; i--) {
      const z = 1.1 + i * .62 - k * 4.9; if (z <= .06) continue;
      const s = .3 / z, w = W * s, h = H * s, a = Math.min(1, (4.4 - z) / 2) * Math.min(1, z / .3);
      if (a <= 0) continue;
      const col = i % 2 ? '255,138,92' : '255,179,71';
      g.strokeStyle = `rgba(${col},${a})`; g.lineWidth = Math.max(2, 5 / z); g.shadowColor = `rgb(${col})`; g.shadowBlur = 26;
      g.strokeRect(W / 2 - w, H / 2 - h, w * 2, h * 2);
      g.font = `${Math.round(Math.max(16, 30 / z))}px VT, monospace`; g.fillStyle = `rgba(${col},${a})`;
      g.fillText(`0${i + 1} ${JOBS[i][0]}`, W / 2 - w + 10 / z, H / 2 - h + 8 / z);
    }
    g.shadowBlur = 0;
    if (k > .82) { g.fillStyle = `rgba(255,236,206,${(k - .82) / .18})`; g.fillRect(0, 0, W, H); }
  }
  glass(g) {
    const W = this.W, H = this.H;
    g.fillStyle = 'rgba(0,0,0,.22)'; for (let yy = 0; yy < H; yy += 3) g.fillRect(0, yy, W, 1);
    const v = g.createRadialGradient(W / 2, H / 2, W * .32, W / 2, H / 2, W * .74); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.72)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    const gl = g.createLinearGradient(0, 0, W * .55, H * .7); gl.addColorStop(0, 'rgba(255,255,255,.07)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gl; g.fillRect(0, 0, W, H);
    if (this.flick > 0) { g.fillStyle = `rgba(0,0,0,${this.flick * .7})`; g.fillRect(0, 0, W, H); }
  }
  compose(dt) {
    const g = this.g, W = this.W, H = this.H;
    if (this.wobble > 0 || this.glitch > 0) {
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      const t = performance.now() / 1000, band = 6;
      for (let y = 0; y < H; y += band) {
        let dx = Math.sin(y * .035 + t * 38) * this.wobble * 26;
        if (this.glitch > 0 && Math.random() < .06) dx += (Math.random() - .5) * 90 * this.glitch;
        g.drawImage(this.b, 0, y, W, band, dx, y, W, band);
      }
    } else g.drawImage(this.b, 0, 0);
    this.wobble = Math.max(0, this.wobble - (dt || 0) * 1.5); this.flick = Math.max(0, this.flick - (dt || 0) * 5); this.glitch = Math.max(0, this.glitch - (dt || 0) * 2.2);
    this.t.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- camera: across the yard to the headframe, into the cage, down the shaft, along the tunnel, to the desk
function shots(portrait, P) {
  const SH = P.SH, ZS = P.ZS;
  const A = [[V(-.7, SH + 1.75, ZS + 8.8), V(.4, SH + 3.0, ZS)], [V(-.35, SH + 1.7, ZS + 5.4), V(.1, SH + 2.3, ZS - .2)], [V(-.05, SH + 1.6, ZS + 2.3), V(0, SH + 1.25, ZS - 1.6)], [V(0, SH + 1.5, ZS + .12), V(0, SH + .4, ZS - 2.0)]];
  const E = portrait
    ? [[V(0, 1.5, ZS + .12), V(0, 1.3, ZS - 4)], [V(-.05, 1.5, 6.0), V(.2, 1.15, 1.5)], [V(-.25, 1.5, 3.4), V(.4, 1.0, -.5)], [V(-.3, 1.48, .6), V(.2, 1.0, -3.0)], [V(-.1, 1.5, -2.6), V(0, 1.25, -8.0)], [V(.02, 1.5, -5.15), V(0, 1.22, -7.62)]]
    : [[V(0, 1.5, ZS + .12), V(0, 1.3, ZS - 4)], [V(-.05, 1.5, 6.0), V(.2, 1.15, 1.5)], [V(-.25, 1.5, 3.4), V(.4, 1.0, -.5)], [V(-.3, 1.48, .6), V(.2, 1.0, -3.0)], [V(-.1, 1.5, -2.6), V(0, 1.25, -8.0)], [V(.03, 1.5, -5.3), V(0, 1.18, -7.62)]];
  const curve = L => ({ pos: new THREE.CatmullRomCurve3(L.map(a => a[0]), false, 'centripetal'), look: new THREE.CatmullRomCurve3(L.map(a => a[1]), false, 'centripetal') });
  return { A: curve(A), E: curve(E), top: A[A.length - 1], bottom: E[0], end: E[E.length - 1] };
}
// the film's beats, in seconds: the yard, the cage shuts, the ride down, the landing, the walk to the desk
const TA = 4.6, TB = 5.9, TC = 15.4, TD = 16.6, TE = 26.6;
const FOV = p => p ? [62, 50] : [44, 33];

// ---------------------------------------------------------------- run
export async function run({ canvas, onEnter, onReady, mobile, status, audio }) {
  try { await Promise.race([Promise.all([document.fonts.load('34px VT'), document.fonts.load('40px PX')]), new Promise(r => setTimeout(r, 1500))]); } catch {}
  const $ = s => document.querySelector(s);
  const intro = $('#intro'), skipBtn = $('#iskip');
  let SOLO = null; try { SOLO = splitSprite(await loadImg('/assets/img/miner.png')); } catch {}
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const dpr = Math.min(mobile ? 1.3 : 1.5, devicePixelRatio || 1);
  renderer.setPixelRatio(dpr); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = !mobile; renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x050508); scene.fog = new THREE.FogExp2(0x060403, .07);
  const P = build(scene, mobile);
  const term = new Terminal(); term.first = true; term.sprite = SOLO; P.screenAt(term.t);
  const cam = new THREE.PerspectiveCamera(40, 1, .02, 80);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, cam));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .7, .55, .85); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const portrait = () => innerWidth / innerHeight < .9;
  let S = shots(portrait(), P);
  function resize() {
    const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h);
    bloom.resolution.set(w / 3, h / 3); cam.aspect = w / h; cam.fov = FOV(portrait())[1]; cam.updateProjectionMatrix(); S = shots(portrait(), P);
  }
  resize(); addEventListener('resize', resize);

  const st = { t0: 0, phase: 'film', skip: false, blend: null, diveT: 0, cmd: '', done: false, pending: undefined, crtOn: false, bolt: [], neonT: -1, lightsOff: false,
    px: 0, py: 0, mx: 0, my: 0, pressed: [], look: null, posted: false, freeze: null, status: null, hover: false, lean: 0, hddT: 0, watch: new THREE.Vector3(), pokes: [] };
  const sfx = (n, a) => { try { audio && audio.sfx(n, a); } catch {} };
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(9, 9);
  const onScreen = () => { ray.setFromCamera(ndc, cam); return ray.intersectObject(P.screen, false).length > 0; };
  const budUnder = () => { ray.setFromCamera(ndc, cam); const hits = ray.intersectObjects(P.buds, true); if (!hits.length) return null; let o = hits[0].object; while (o && !P.buds.includes(o)) o = o.parent; return o; };
  let NOW = performance.now();
  Promise.resolve(status).then(s => { st.status = s; }).catch(() => {});
  const say = runs => term.push(Array.isArray(runs[0]) ? runs : [[runs[0], runs[1]]]);
  const hdd = on => { P.hddMat.color.setHex(on ? 0xffb648 : 0x2a1c08); };
  const lightning = (strength = 1) => { st.bolt.push([NOW, strength], [NOW + 150, strength * .6]); sfx('thunder', strength); };
  // the tunnel's lanterns light from the shaft to the desk, in pairs, once the cage lands
  const TUN = P.bars.filter(b => !b.shaft), SHAFT = P.bars.filter(b => b.shaft);
  const order = [...TUN].sort((a, b) => b.z - a.z);

  // ---- the queue: everything happens against one clock, so a skip just plays the rest at once
  const Q = []; let qi = 0;
  const ev = (ms, fn, soft) => Q.push({ ms, fn, soft });
  function flush() { const t = NOW - st.t0; while (qi < Q.length && (st.skip || Q[qi].ms <= t)) { const e = Q[qi++]; if (!(st.skip && e.soft)) e.fn(); } }
  ev(1300, () => lightning(1), true);
  ev(3700, () => lightning(.55), true);
  ev(TA * 1000 + 100, () => sfx('creak'), true);
  ev(TA * 1000 + 480, () => sfx('clunk', 1), true);
  ev(TB * 1000 - 600, () => sfx('ding'), true);
  ev(TB * 1000 - 50, () => sfx('creak'), true);
  ev(9800, () => lightning(.3), true);
  ev(TC * 1000, () => sfx('clunk', 1.2), true);
  ev(TC * 1000 + 160, () => sfx('clunk', .5), true);
  ev(TC * 1000 + 520, () => sfx('creak'), true);
  order.forEach((b, i) => ev(TC * 1000 + 380 + Math.floor(i / 2) * 620 + (i % 2) * 130, () => { b.t0 = NOW; b.want = 1; if (i % 2 === 0) sfx('clunk', .7 + Math.random() * .3); }));
  const PW = 20800;
  ev(PW, () => { sfx('power'); st.crtOn = true; P.ledMat.color.setHex(0xffb347); P.monLed.color.setHex(0xffb648); term.off = false; term.power = 0; term.dirty = true; st.lampT = NOW; });
  for (let i = 1; i <= 20; i++) ev(PW + i * 23, () => { term.power = i / 20; term.dirty = true; });
  ev(PW + 21 * 23, () => { term.power = 1; term.wobble = st.skip ? 0 : 1; term.dirty = true; });
  let T = PW + 900; const at = (d, fn) => { T += d; ev(T, fn); };
  at(0, () => { hdd(true); sfx('beep'); say([['MINEWRLD BIOS v1.0  ', C.ink], ['(c) the deep shift', C.dim]]); });
  at(170, () => say([['cpu: ', C.dim], ['pickaxe-class @ 33 MHz', C.ink]]));
  let mi; at(130, () => { mi = term.push([['memory test: ', C.dim], ['0K', C.ok]]); });
  for (let m = 8192; m <= 65536; m += 8192) at(26, () => term.set(mi, [['memory test: ', C.dim], [m + 'K' + (m === 65536 ? ' ok' : ''), C.ok]]));
  at(60, () => { say(['', C.ink]); hdd(false); });
  for (const [a, b, col] of [['detecting lanterns', 'lit', C.ok], ['detecting veins', 'one per coin', C.ok], ['detecting miners', 'awake', C.ok], ['detecting gpu', 'not needed', C.red]]) {
    const dots = '.'.repeat(Math.max(3, 30 - a.length)) + ' '; let i;
    at(80, () => { i = term.push([[a + ' ', C.ink], [dots, C.dim]]); hdd(true); });
    at(190, () => { term.set(i, [[a + ' ', C.ink], [dots, C.dim], [b, col]]); hdd(false); });
  }
  at(120, () => { say(['', C.ink]); say([['press ', C.dim], ['DEL', C.ink], [' for setup. the miners would rather you didn\'t.', C.dim]]); });
  at(450, () => term.clear());
  at(200, () => say([['waking the miners …', C.ink]]));
  at(380, () => { say(['', C.ink]); say([['C:\\> ', C.ok], ['run minewrld', C.white]]); });
  JOBS.forEach(([name, what], k) => {
    const label = ` 0${k + 1} ${name} `.padEnd(14, '.') + ' ', text = what.padEnd(30, ' '); let i;
    at(200, () => { i = term.push([[label, C.ink], [text, C.dim], ['[    ]', C.dim]]); });
    for (let s = 0; s < 4; s++) at(52, () => { term.set(i, [[label, C.ink], [text, C.dim], ['[ ' + '|/-\\'[s % 4] + '  ]', C.mag]]); hdd(s % 2 === 0); });
    at(58, () => { term.set(i, [[label, C.ink], [text, C.dim], ['[ ', C.dim], ['ok', C.ok], [' ]', C.dim]]); hdd(false); });
    T -= 160;
  });
  at(240, () => { say(['', C.ink]); say([[' 6/6 jobs up.', C.ok], [' the mine never closes.', C.dim]]); });
  at(600, () => { term.clear(); term.glitch = st.skip ? 0 : 1; });
  for (let k = 1; k <= 22; k++) at(k === 1 ? 160 : 22, () => { term.logo = Math.min(1, k / 22); term.dirty = true; });
  at(30, () => { term.logo = 1; term.glitch = st.skip ? 0 : .5; });
  let tag; at(40, () => { tag = term.push([['', C.ink]]); });
  const T1 = 'every coin is a mine.', T2a = 'your browser ', T2b = 'mines', T2c = ' it. every block pays SOL.';
  for (let i = 1; i <= T1.length; i++) at(22, () => term.set(tag, [[T1.slice(0, i), C.ink]]));
  let tag2; at(60, () => { tag2 = term.push([['', C.ink]]); });
  const full2 = T2a + T2b + T2c;
  for (let i = 1; i <= full2.length; i++) at(20, () => { const s = full2.slice(0, i); term.set(tag2, [[s.slice(0, T2a.length), C.ink], [s.slice(T2a.length, T2a.length + T2b.length), C.ok], [s.slice(T2a.length + T2b.length), C.ink]]); });
  at(380, () => {
    say(['', C.ink]);
    say([['type ', C.dim], ['launch', C.ok], [', ', C.dim], ['mine', C.ok], [', ', C.dim], ['help', C.ok], [' or press enter.', C.dim]]);
    say(['', C.ink]);
    term.prompt = true; st.posted = true;
  });
  Q.sort((a, b) => a.ms - b.ms);

  function ready() {
    if (st.phase !== 'film') return;
    st.phase = 'ready'; intro.classList.add('ready');
    onReady && onReady();
    if (st.pending !== undefined) { const c = st.pending; st.pending = undefined; dive(c); }
  }
  function skip() {
    if (st.skip || st.phase !== 'film') return;
    st.skip = true; st.blend = { t: NOW, from: cam.position.clone(), look: (st.look || S.end[1]).clone(), fov: cam.fov };
  }

  // ---- typing presses the 3D keys
  const ROWS = { 1: '`1234567890-=', 2: '\tqwertyuiop[]\\', 3: "\u0000asdfghjkl;'", 4: '\u0000zxcvbnm,./' };
  function keyCell(k) {
    if (k === ' ') return 'space'; if (k === 'Enter') return '3:13'; if (k === 'Backspace') return '1:13'; if (k === 'Escape') return '0:0'; if (k === 'Shift') return '4:0';
    const ch = (k || '').toLowerCase(); if (ch.length !== 1) return null;
    for (const r in ROWS) { const c = ROWS[r].indexOf(ch); if (c >= 0) return r + ':' + c; }
    return null;
  }
  function press(k) { const id = keyCell(k); const i = id && (id === 'space' ? P.kidx.space : P.kidx[id]); if (i != null) st.pressed.push([i, NOW]); sfx('key'); }
  const POKES = ['don\'t touch the miners.', 'it saw that.', 'it remembers you now.', 'they don\'t like being poked.', 'it was sleeping. just kidding. the mine never closes.', 'leave it. it\'s digging.'];
  function poke(b) { b.userData.shake = NOW; sfx('squeak'); if (st.phase === 'ready') say([[POKES[(Math.random() * POKES.length) | 0], C.mag]]); }

  function command(raw) {
    const c = raw.trim().toLowerCase();
    say([['C:\\MINE> ', C.ok], [raw, C.white]]); term.input = '';
    hdd(true); setTimeout(() => hdd(false), 120);
    if (!c || ['enter', 'exit', 'go', 'cd mine', 'win', 'start', 'in', 'minewrld'].includes(c)) return dive('');
    if (['launch', 'veins', 'mine', 'rig', 'chain', 'ledger', 'stats', 'terminal', 'term', 'docs', 'readme'].includes(c)) return dive(c);
    if (c === 'help' || c === '?' || c === 'dir' || c === 'ls') {
      [[['launch    ', C.ok], ['launch a coin. it opens a mine.', C.dim]], [['mine      ', C.ok], ['start mining, right in this tab', C.dim]], [['veins     ', C.ok], ['every mine and its pool', C.dim]], [['chain     ', C.ok], ['every block, check any of them', C.dim]],
       [['lights    ', C.ok], ['the grow lights, on or off', C.dim]], [['storm     ', C.ok], ['you heard it', C.dim]], [['enter     ', C.ok], ['go in', C.dim]]].forEach(h => say(h)); return;
    }
    if (c === 'whoami') { say(['deep shift.', C.ok]); return; }
    if (c === 'ver') { say(['minewrld [version 1.0.0]', C.ink]); return; }
    if (c === 'date' || c === 'time') { say([new Date().toString().slice(0, 24), C.ink]); return; }
    if (c === 'cls' || c === 'clear') { term.clear(); term.logo = 1; return; }
    if (c === 'sleep') { say(['the mine never closes.', C.mag]); return; }
    if (c === 'dig' || c === 'hash') { say(['your browser does the digging. type mine.', C.mag]); return; }
    if (c === 'sudo' || c.startsWith('sudo ')) { say(['no root here. only rock.', C.dim]); return; }
    if (c === 'lights' || c === 'lamp' || c === 'lanterns') { st.lightsOff = !st.lightsOff; P.bars.forEach(b => { b.t0 = NOW; b.want = st.lightsOff ? 0 : 1; }); sfx('clunk', 1); say([st.lightsOff ? 'lanterns out. they can still see you.' : 'lanterns lit.', C.dim]); return; }
    if (c === 'storm' || c === 'thunder') { lightning(1.2); say(['…', C.dim]); return; }
    say(['bad command or file name. type help.', C.dim]);
  }
  function dive(cmd) {
    if (st.phase === 'dive' || st.done) return;
    if (st.phase !== 'ready') { st.pending = cmd; skip(); return; }
    st.freeze = null; st.phase = 'dive'; st.cmd = cmd; st.diveT = NOW; st.diveFrom = cam.position.clone(); st.diveLook = (st.look || S.end[1]).clone(); term.prompt = false;
    say([['lights out', C.ok], [' …', C.dim]]); hdd(true); canvas.style.cursor = 'default';
    intro.classList.add('diving');
    SHAFT.forEach(b => { b.t0 = null; b.want = 0; });
    const far = [...TUN].sort((a, b) => b.g.position.distanceTo(cam.position) - a.g.position.distanceTo(cam.position));
    far.forEach((b, k) => { b.t0 = NOW + 120 + k * 135; b.want = 0; setTimeout(() => sfx('clunk', .5), 120 + k * 135); });
    P.crts.forEach((c, k) => c.offT = NOW + 300 + k * 160);
    setTimeout(() => { term.mode = 'eyes'; term.dirty = true; sfx('beep'); }, 700);
  }
  function key(e) {
    if (st.done) return;
    if (e.key === 'Escape') { e.preventDefault(); if (st.phase === 'film') skip(); else if (st.phase === 'ready') dive(''); return; }
    if (st.phase === 'film') { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); skip(); } return; }
    if (st.phase !== 'ready') return;
    press(e.key);
    if (e.key === 'Enter') { e.preventDefault(); command(term.input); }
    else if (e.key === 'Backspace') { e.preventDefault(); term.input = term.input.slice(0, -1); term.dirty = true; }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && term.input.length < 34) { term.input += e.key; term.dirty = true; }
  }
  addEventListener('keydown', key);
  const pm = e => { st.px = e.clientX / innerWidth * 2 - 1; st.py = e.clientY / innerHeight * 2 - 1; ndc.set(st.px, -st.py); };
  addEventListener('pointermove', pm, { passive: true });
  canvas.addEventListener('click', e => {
    ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight * 2 - 1));
    const b = budUnder(); if (b) return poke(b);
    if (st.phase === 'film') { if (!st.clicked) { st.clicked = true; return; } return skip(); }
    if (st.phase === 'ready' && onScreen()) dive('');
  });
  if (skipBtn) skipBtn.onclick = e => { e.stopPropagation(); skip(); };

  // the small screens on the benches: a bud, its eyes on you, and a status line
  function drawCrt(c, t) {
    const g = c.g, W = 512, H = 384;
    if (c.on <= 0.01) { g.fillStyle = '#040605'; g.fillRect(0, 0, W, H); c.t.needsUpdate = true; return; }
    const r = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W * .62); r.addColorStop(0, '#3a9a5c'); r.addColorStop(1, '#08200f');
    g.globalAlpha = 1; g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.globalAlpha = c.on; g.fillStyle = r; g.fillRect(0, 0, W, H);
    if (SOLO) {
      const s = 8, x0 = 40, y0 = (H - 32 * s) / 2 + 6; g.imageSmoothingEnabled = false;
      g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 14; g.drawImage(SOLO.body, x0, y0, 32 * s, 32 * s);
      g.shadowColor = '#e9fff0'; g.shadowBlur = 16; if (!(c.blinkT > NOW)) g.drawImage(SOLO.eyes, x0 + Math.round(c.eye) * s, y0, 32 * s, 32 * s); g.shadowBlur = 0;
    }
    g.font = '30px VT, monospace'; g.fillStyle = '#c9ffd9'; g.shadowColor = '#5cf08a'; g.shadowBlur = 8; g.textBaseline = 'top';
    const lines = [[`tray 0${c.seed * 2 + 3}`, 1], ['', 0], [['awake', 'watching', 'working', 'awake'][c.seed], 1], [`sleep: never`, .7]];
    lines.forEach(([s, a], i) => { g.globalAlpha = c.on * (a || 1); g.fillText(s, 300, 110 + i * 40); });
    g.shadowBlur = 0; g.globalAlpha = 1;
    g.fillStyle = 'rgba(0,0,0,.28)'; for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
    const v = g.createRadialGradient(W / 2, H / 2, W * .25, W / 2, H / 2, W * .7); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.75)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
    c.t.needsUpdate = true;
  }

  let last = performance.now(), started = false;
  const api = { go: c => dive(c), phase: () => st.phase, skip, seek: (sec, freeze) => { st.t0 = performance.now() - sec * 1000; st.freeze = freeze ? sec : null; }, hold: ms => { st.hold = ms == null ? null : st.diveT + ms; },
    pause: v => { st.paused = !!v; },
    shot: (sec, q = .92) => { if (sec != null) { st.t0 = performance.now() - sec * 1000; st.freeze = sec; } step(performance.now()); return canvas.toDataURL('image/jpeg', q); },
    termShot: (sec, q = .92) => { st.noRender = true; if (sec != null) { st.t0 = performance.now() - sec * 1000; st.freeze = sec; } step(performance.now()); st.noRender = false; return term.c.toDataURL('image/jpeg', q); },
    diveShot: (ms, q = .92) => { st.hold = st.diveT + ms; step(performance.now()); return st.done ? null : canvas.toDataURL('image/jpeg', q); } };
  function frame(now) { if (st.done) return; requestAnimationFrame(frame); if (st.paused) return; step(now); }
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  function step(now) {
    if (!started) { started = true; st.t0 = now; }
    NOW = st.hold != null ? st.hold : st.freeze != null ? st.t0 + st.freeze * 1000 : now;
    const dt = Math.min(.05, Math.max(.001, (now - last) / 1000)); last = now;
    const t = (NOW - st.t0) / 1000;
    flush();
    // camera: the yard, the cage, the ride down, the landing, the walk (or a glide to the desk when skipped)
    const [f0, f1] = FOV(portrait()); const film = st.phase === 'film' && !st.blend;
    const tt = st.skip ? TE + 5 : t;
    let pos, look, fov, walking = 0, cageY = P.SH, gateY = 1.9, ride = 0;
    if (tt < TA) { const k = sine(clamp01(tt / TA)); pos = S.A.pos.getPoint(k); look = S.A.look.getPoint(k); fov = f0 + 4; walking = Math.sin(Math.PI * clamp01(tt / TA)); }
    else if (tt < TC) {
      const u = clamp01((tt - TB) / (TC - TB)), sm = u * u * u * (u * (u * 6 - 15) + 10);
      cageY = P.SH * (1 - sm); ride = u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0;
      gateY = 1.9 * (1 - ease(clamp01((tt - TA - .1) / .4)));
      const pitch = -.5 + .43 * sine(clamp01((u - .05) / .9)), yaw = Math.sin(tt * .42 + 1.2) * .34 * Math.sin(Math.PI * u);
      pos = V(0, cageY + 1.5, P.ZS + .12); look = pos.clone().add(V(Math.sin(yaw) * Math.cos(pitch) * 2, Math.sin(pitch) * 2, -Math.cos(yaw) * Math.cos(pitch) * 2));
      pos.x += Math.sin(tt * 37) * .006 * ride + Math.sin(tt * 11.3) * .004 * ride; pos.z += Math.sin(tt * 29) * .005 * ride;
      fov = f0 + 4 + 6 * ride;
    } else if (tt < TD) {
      const a = tt - TC; cageY = -.06 * Math.sin(a * 13) * Math.exp(-a * 4.5); gateY = 1.9 * ease(clamp01((a - .5) / .6));
      const k = sine(clamp01(a / (TD - TC)));
      pos = V(0, cageY + 1.5, P.ZS + .12); const l0 = pos.clone().add(V(0, Math.sin(-.08) * 2, -Math.cos(-.08) * 2)); look = l0.lerp(S.bottom[1], k);
      fov = f0 + 4 - 4 * k;
    } else {
      cageY = 0; gateY = 1.9; const u = clamp01((tt - TD) / (TE - TD)), k = sine(u);
      pos = S.E.pos.getPoint(k); look = S.E.look.getPoint(k); fov = f0 + (f1 - f0) * k; walking = Math.sin(Math.PI * clamp01((u - .02) / .9));
    }
    if (!film) fov = f1;
    if (st.blend && st.phase === 'film') fov = st.blend.fov + (f1 - st.blend.fov) * ease(clamp01((NOW - st.blend.t) / 900));
    if (Math.abs(cam.fov - fov) > .001) { cam.fov = fov; cam.updateProjectionMatrix(); }
    if (st.blend) { const b = ease(clamp01((NOW - st.blend.t) / 900)); pos = st.blend.from.clone().lerp(S.end[0], b); look = st.blend.look.clone().lerp(S.end[1], b); }
    // the cage, its gate, the cable and the wheel follow the ride
    P.cage.position.y = cageY; P.gate.position.y = gateY;
    const ctop = cageY + 2.2, wtop = P.HT + .85; P.cable.position.y = (ctop + wtop) / 2; P.cable.scale.y = Math.max(.01, wtop - ctop);
    P.wheel.rotation.z = -(P.SH - cageY) / .7;
    P.cageLight.intensity = (mobile ? 18 : 15) * clamp01((tt - TA + .3) / .4) * (1 - clamp01((tt - TD - 1.5) / 2));
    P.moon.intensity = 1.25 * clamp01((cageY + 1.5 - (P.SH - 5)) / 5) * (st.phase === 'dive' ? 0 : 1);
    P.surfLight.intensity = 16 * (cageY > P.SH - 12 ? 1 : 0) * (.9 + Math.random() * .1);
    // the shaft's lanterns: each one clunks on as the cage comes down to it
    for (const b of SHAFT) { const want = (pos.y - b.y < 7.5 || st.skip) && st.phase !== 'dive' ? 1 : 0; if (want !== b.want) { b.want = want; b.t0 = NOW; if (want && !st.skip) sfx('clunk', .45 + Math.random() * .2); } }
    const u = clamp01(tt / TE);
    if (st.phase === 'film' && st.posted && (u >= 1 || (st.blend && NOW - st.blend.t > 900))) ready();
    st.mx += (st.px - st.mx) * .04; st.my += (st.py - st.my) * .04;
    if (!film) walking = 0;
    const settle = st.phase === 'film' && !st.skip ? clamp01((t - TE + 1.5) / 1.5) : 1;
    if (st.phase === 'ready') { const h = onScreen() || !!budUnder(); if (h !== st.hover) { st.hover = h; canvas.style.cursor = h ? 'pointer' : 'default'; } }
    st.lean += ((st.phase === 'ready' && st.hover && onScreen() ? 1 : 0) - st.lean) * .05;
    pos.y += Math.abs(Math.sin(t * 2.7)) * .018 * walking - .009 * walking; pos.x += Math.sin(t * 1.35) * .011 * walking;
    pos.x += Math.sin(t * .35) * .02 * (1 - ride) + st.mx * .06 * settle; pos.y += Math.sin(t * .5) * .01 * (1 - ride) - st.my * .03 * settle;
    if (st.lean > .001) { pos.lerp(P.SCREEN_C, st.lean * .14); look.lerp(P.SCREEN_C, st.lean * .3); }
    if (st.phase === 'dive') {
      const a = (NOW - st.diveT) / 1000, e = ease(clamp01(a / 3));
      pos = st.diveFrom.clone().add(V(0, -.05 * e, .32 * e)); look = st.diveLook.clone().add(V(0, -.02 * e, 0));
      st.dark = clamp01((a - 1.1) / 1.1);
      renderer.toneMappingExposure = 1.1 * (1 - st.dark * .9); bloom.strength = .7 + st.dark * 1.4;
      st.eyeBoost = 1 + st.dark * 2.5; st.shut = clamp01((a - 2.55) / .22);
      if (a >= 3.05 && !st.done) { st.done = true; cleanup(); onEnter(st.cmd); return; }
    }
    st.look = look; cam.position.copy(pos); cam.lookAt(look);
    // what the buds watch: the camera while you walk, the mouse once you're at the desk
    if (st.phase === 'ready') { tmp.set(st.mx, -st.my, .5).unproject(cam).sub(cam.position).normalize(); st.watch.copy(cam.position).addScaledVector(tmp, 1.6); }
    else st.watch.copy(cam.position);
    // grow lights: clunk, stutter, hum; the fourth bar never quite settles
    let lit = 0;
    for (const b of P.bars) {
      let L = b.want;
      if (b.t0 != null) { const a = (NOW - b.t0) / 1000; if (a < 0) L = b.want ? 0 : 1; else if (b.want) L = a < .05 ? 1 : a < .13 ? 0 : a < .18 ? .8 : a < .3 ? .1 : a < .36 ? .9 : 1; else L = a < .06 ? .6 : a < .1 ? .1 : a < .14 ? .3 : 0; }
      if (b.flick && L > .5 && Math.random() < .035) L = .25 + Math.random() * .4;
      b.on += (L - b.on) * .5;
      if (b.spot) b.spot.intensity = b.on * (b.shaft ? 9 : mobile ? 5 : 3.2);
      b.barM.color.copy(b.c).multiplyScalar(.04 + b.on * 3.4); b.cone.material.opacity = b.on * .55;
      lit += b.on / P.bars.length;
    }
    { const sl = P.surfLantern, f = .82 + Math.random() * .18; sl.barM.color.copy(sl.c).multiplyScalar(.04 + f * 3.4); sl.cone.material.opacity = f * .6; }
    P.sporeM.opacity = .15 + lit * .55;
    // lightning through the roof
    let fl = 0; st.bolt = st.bolt.filter(([t1, s]) => { const a = (NOW - t1) / 1000; if (a < 0) return true; if (a > .4) return false; fl = Math.max(fl, s * Math.exp(-a * 12)); return true; });
    if (st.phase === 'ready' && Math.random() < dt / 16) lightning(.35 + Math.random() * .35);
    P.bolt.intensity = fl * 9; P.sky.material.color.setScalar(.85 + fl * 1.4); P.hemi.intensity = .25 + fl * .6;
    // the desk lamp and the main CRT glow
    if (st.lampT > 0) { const a = clamp01((NOW - st.lampT) / 1000 * 3); P.lamp.intensity = a * (mobile ? .9 : 1.5); P.shadeM.emissiveIntensity = a * 1.2; }
    const screenLight = term.off ? 0 : term.power < 1 ? term.power * .6 : .35 + (term.mode === 'tunnel' ? term.tunnel * 3 : 0);
    P.glow.intensity += (screenLight + Math.sin(t * 13) * .02 - P.glow.intensity) * .2;
    if (st.crtOn) P.ledMat.color.setHex(Math.sin(t * 9) > .3 ? 0xffb347 : 0x4a2a0a);
    else P.monLed.color.setRGB(.16 + .5 * Math.max(0, Math.sin(t * 2.4)) ** 3, .1 + .26 * Math.max(0, Math.sin(t * 2.4)) ** 3, .03);
    // rain outside, rain on the roof, spores in the light
    P.rainT.offset.y = (P.rainT.offset.y - dt * .1) % 1;
    const rp = P.rain.geometry.attributes.position;
    for (let i = 0; i < rp.count; i += 2) { let y = rp.getY(i) - dt * 7.5; if (y < 0) y += 6; rp.setY(i, y); rp.setY(i + 1, y - .18); }
    rp.needsUpdate = true;
    P.spores.rotation.y = Math.sin(t * .05) * .05; P.spores.position.y = Math.sin(t * .23) * .05;
    // the bench CRTs wake as you pass; their buds keep their eyes on you
    for (const c of P.crts) {
      const near = (cam.position.z < c.m.position.z + 3.2 || st.phase !== 'film' || st.skip) && !(c.offT && NOW > c.offT);
      const was = c.on; c.on += ((near ? 1 : 0) - c.on) * .08;
      c.m.getWorldPosition(tmp2); tmp.copy(st.watch).sub(tmp2); c.m.worldToLocal(tmp.add(tmp2));
      const want = Math.max(-1, Math.min(1, tmp.x * 1.6)); c.eye += (want - c.eye) * .1;
      if (Math.random() < dt / 4) c.blinkT = NOW + 130;
      c.glow.intensity = c.on * .55;
      if (was < .99 || (NOW - (c.drawn || 0)) > 90) { drawCrt(c, t); c.drawn = NOW; }
    }
    // in the dark only the eyes stay, brighter and brighter, then they all close
    const boost = st.eyeBoost || 1, shut = st.shut || 0;
    P.tinyEyeM.color.setRGB(1.6 * boost, 2.05 * boost, 1.75 * boost); term.shut = shut;
    if (st.phase === 'dive') { P.sporeM.opacity *= 1 - (st.dark || 0); P.lamp.intensity *= 1 - clamp01(((NOW - st.diveT) / 1000 - .9) / .3); P.shadeM.emissiveIntensity *= 1 - (st.dark || 0); P.jarGlow.intensity = .25 * (1 - (st.dark || 0)); P.chartGlow.intensity = .25 * (1 - (st.dark || 0)); P.hemi.intensity *= 1 - (st.dark || 0) * .9; P.moon.intensity *= 1 - (st.dark || 0); }
    // tiny buds in the trays: they turn, a few at a time, once you are close
    for (const g of P.tiny) {
      const u3 = g.userData, dx = st.watch.x - g.position.x, dz = st.watch.z - g.position.z, d2 = dx * dx + dz * dz;
      if (st.phase !== 'film' || st.skip || d2 < u3.wake * u3.wake) { let dy = Math.atan2(dx, dz) - g.rotation.y; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; g.rotation.y += dy * (st.phase === 'dive' ? .12 : u3.lag); }
      if (NOW > u3.nb) { u3.nb = NOW + 2500 + Math.random() * 6000; u3.bl = NOW + 120; }
      u3.blink = (u3.bl > NOW ? .1 : 1) * (1 - shut);
    }
    P.tinyUpdate(t);
    if (st.phase !== 'dive' && cam.position.z < 2.6 && NOW - (st.chartAt || 0) > (mobile ? 200 : 90)) { st.chartAt = NOW; P.chartTick(t); }
    // the potted buds: they face the back wall until you get close, then turn, one after another, to watch
    for (const b of P.buds) {
      const u2 = b.userData; b.getWorldPosition(tmp2);
      const near = st.phase !== 'film' || st.skip || tmp2.distanceTo(cam.position) < 5.2;
      let yaw = Math.PI * .92, pitch = 0;
      if (near) { tmp.copy(st.watch); b.worldToLocal(tmp); tmp.y -= .12; yaw = Math.atan2(tmp.x, tmp.z); pitch = -Math.atan2(tmp.y, Math.hypot(tmp.x, tmp.z)); }
      let dy = yaw - u2.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
      u2.yaw += dy * u2.lag * (near ? 1.4 : .6); u2.pitch += (Math.max(-.5, Math.min(.5, pitch)) - u2.pitch) * u2.lag * 2;
      u2.head.rotation.set(u2.pitch * .6, u2.yaw, 0);
      if (u2.shake && NOW - u2.shake < 600) { const a = (NOW - u2.shake) / 600; u2.head.rotation.z = Math.sin(a * 40) * .25 * (1 - a); u2.eyeM.color.setRGB(3, .5 + a * 2, .8 + a * 1.4); }
      else if (u2.shake) { u2.shake = 0; u2.head.rotation.z = 0; u2.eyeM.color.setRGB(2.2, 2.8, 2.4); }
      if (NOW > u2.blinkT * 1000 + (u2.nb || 0)) { u2.nb = (u2.nb || 0) + 2500 + Math.random() * 5000; u2.blinkUntil = NOW + 120; }
      const bl = (u2.blinkUntil > NOW ? .1 : 1) * (1 - shut); u2.eyes.forEach(e => e.scale.y = Math.max(.001, bl)); if (!u2.shake) u2.eyeM.color.setRGB(2.2 * boost, 2.8 * boost, 2.4 * boost);
      if (u2.floaty) b.position.y = .1 + Math.sin(t * 1.3) * .012;
    }
    // the terminal's own bud watches the mouse too
    term.eyeX = Math.max(-1, Math.min(1, st.mx * 1.5)); if (Math.random() < dt / 5) { term.blinking = true; setTimeout(() => { term.blinking = false; term.dirty = true; }, 140); } if (term.logo >= 1) term.dirty = true;
    // pressed keys sink for a moment
    if (st.pressed.length) {
      st.pressed = st.pressed.filter(([i, t1]) => { const a = (NOW - t1) / 130; const m = P.base[i].clone(); if (a < 1) m.elements[13] -= .008 * Math.sin(a * Math.PI); P.keys.setMatrixAt(i, m); return a < 1; });
      P.keys.instanceMatrix.needsUpdate = true;
    }
    term.draw(NOW, dt);
    if (!st.noRender) composer.render();
  }
  function cleanup() { removeEventListener('keydown', key); removeEventListener('resize', resize); removeEventListener('pointermove', pm); setTimeout(() => { renderer.dispose(); composer.dispose && composer.dispose(); }, 1200); }
  requestAnimationFrame(frame);
  return api;
}
