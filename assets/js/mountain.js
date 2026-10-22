// mountain.exe: the whole range in cross-section, live. Every coin is a shaft sunk as deep as its chain has gone
// (shallow, deep, deeper, bedrock), with side galleries cut as its blocks add up. Miners swing at the face where people
// are mining right now, the pool glows at the bottom of each shaft, and every block found bursts up out of the rock.
// Drawn in small "pixels" at a whole-number scale, so the art stays chunky and the words stay sharp.
export function installMountain(X) {
  const { $, esc, fsol, ago } = X;
  const A = {};
  let W0 = 384, S = 2; const H0 = 216;
  const LV = [{ name: 'shallow', from: 0, y1: 104, col: [62, 46, 33] }, { name: 'deep', from: 25, y1: 140, col: [52, 37, 27] }, { name: 'deeper', from: 250, y1: 176, col: [44, 30, 21] }, { name: 'bedrock', from: 2500, y1: H0, col: [34, 23, 17] }];
  const M = { el: null, cv: null, g: null, bg: null, bgFor: '', raf: 0, last: 0, cam: 0, camT: 0, drag: null, hover: -1, parts: [], texts: [], flash: {}, lay: [], width: 384, t0: performance.now() };
  const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  // the range: a few peaks with rolling saddles between them
  const ridge = x => 66 - 24 * (Math.max(0, Math.sin(x * .0165 + .9)) ** 1.6) - 9 * (Math.sin(x * .047 + 2.1) * .5 + .5) - 2.2 * Math.sin(x * .19 + .3);
  const top = x => Math.round(ridge(x));
  const levelOf = b => { let i = 0; while (i < 3 && b >= LV[i + 1].from) i++; return i; };
  const depthOf = m => {   // the shaft reaches the band of its level, deeper inside the band as blocks add up
    const b = Number(m.blocks || 0), i = levelOf(b), lo = LV[i].from, hi = i < 3 ? LV[i + 1].from : 25000;
    const f = Math.min(1, Math.log10(1 + b - lo) / Math.log10(1 + hi - lo)), y0 = i ? LV[i - 1].y1 : 80;
    return Math.round(y0 + 8 + (LV[i].y1 - y0 - 16) * f);
  };
  function layout() {
    const list = (X.MINES || []).filter(m => m.state === 'live').slice().sort((a, b) => (b.miners - a.miners) || (b.pool - a.pool) || (b.blocks - a.blocks)).slice(0, 40);
    const gap = Math.max(25, Math.min(36, Math.floor((W0 - 84) / Math.max(1, list.length)))), span = (list.length - 1) * gap, room = W0 - 70, x0 = span < room - 40 ? Math.round((room - span) / 2) + 6 : 30;
    M.gap = gap; M.lay = list.map((m, i) => { const x = x0 + i * gap; return { m, x, y0: top(x), y1: depthOf(m), row: 0, h: hash(m.mint) }; });
    // tickers that would touch their neighbour go up a row
    M.lay.forEach((L, i) => { const p = M.lay[i - 1]; L.row = p && p.row === 0 && Math.abs(p.y0 - L.y0) < 12 && (String(p.m.symbol).length + String(L.m.symbol).length) * 2.3 + 6 > gap ? 1 : 0; });
    M.width = Math.max(W0, x0 + list.length * gap + 70);
  }
  // everything that doesn't move, drawn once per layout
  function buildBg() {
    const w = M.width, c = document.createElement('canvas'); c.width = w; c.height = H0; const g = c.getContext('2d');
    let sd = 7; const rnd = () => (sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0) / 4294967296;
    const sky = g.createLinearGradient(0, 0, 0, 70); sky.addColorStop(0, '#04050b'); sky.addColorStop(1, '#141420'); g.fillStyle = sky; g.fillRect(0, 0, w, 72);
    for (let i = 0; i < w / 4; i++) { g.fillStyle = `rgba(220,225,255,${.15 + rnd() * .55})`; g.fillRect(rnd() * w | 0, rnd() * 46 | 0, 1, 1); }
    // the far range and its village lights
    g.fillStyle = '#0c0d15'; g.beginPath(); g.moveTo(0, 72); for (let x = 0; x <= w; x += 3) g.lineTo(x, 50 - Math.abs(Math.sin(x * .011 + 2)) * 18 - Math.sin(x * .037) * 4); g.lineTo(w, 72); g.fill();
    for (let i = 0; i < w / 30; i++) { const x = rnd() * w | 0, y = 52 + (rnd() * 10 | 0); g.fillStyle = rnd() < .7 ? 'rgba(255,190,110,.75)' : 'rgba(255,232,190,.5)'; g.fillRect(x, y, 1, 1); }
    // the rock, column by column: each band its own colour, speckled
    const img = g.getImageData(0, 0, w, H0), d = img.data;
    for (let x = 0; x < w; x++) { const t0 = top(x);
      for (let y = t0; y < H0; y++) { const i = (y * w + x) * 4, b = LV[y < LV[0].y1 ? 0 : y < LV[1].y1 ? 1 : y < LV[2].y1 ? 2 : 3].col, n = rnd(), k = n < .07 ? .55 : n > .965 ? 1.4 : .84 + rnd() * .3, edge = y - t0 < 2 ? .6 : 1; d[i] = b[0] * k * edge; d[i + 1] = b[1] * k * edge; d[i + 2] = b[2] * k * edge; d[i + 3] = 255; } }
    g.putImageData(img, 0, 0);
    // the seams between levels
    for (let k = 0; k < 3; k++) { const y = LV[k].y1; for (let x = 0; x < w; x++) { const yy = y + Math.round(Math.sin(x * .09 + k * 2) * 1.4); if (yy > top(x) + 2) { g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x, yy, 1, 1); g.fillStyle = 'rgba(255,220,170,.06)'; g.fillRect(x, yy + 1, 1, 1); } } }
    // gold in the rock, more of it deeper down
    for (let i = 0; i < w * .9; i++) { const x = rnd() * w | 0, y = top(x) + 6 + Math.pow(rnd(), .6) * (H0 - top(x) - 6) | 0; if (rnd() < (y - 60) / (H0 - 60)) { g.fillStyle = rnd() < .3 ? '#ffd27a' : rnd() < .6 ? '#c98a2c' : '#8a5a1c'; g.fillRect(x, y, 1 + (rnd() < .25), 1); } }
    // what waits further down: fossils, an underground stream, crystals, the heat of bedrock
    const bone = 'rgba(222,206,176,.55)';
    for (let i = 0; i < w / 150; i++) { const x = 16 + rnd() * (w - 32) | 0, y = 108 + rnd() * 26 | 0; g.fillStyle = bone; ['.xxx.', 'x...x', 'x.x.x', 'x..xx', '.xx..'].forEach((r, j) => [...r].forEach((ch, k) => { if (ch === 'x') g.fillRect(x + k, y + j, 1, 1); })); }
    for (let i = 0; i < w / 190; i++) { const x = 16 + rnd() * (w - 40) | 0, y = 112 + rnd() * 22 | 0; g.fillStyle = bone; g.fillRect(x, y, 7, 1); g.fillRect(x - 1, y - 1, 2, 1); g.fillRect(x + 6, y - 1, 2, 1); g.fillRect(x - 1, y + 1, 2, 1); g.fillRect(x + 6, y + 1, 2, 1); }
    M.stream = []; for (let x = 0; x < w; x++) { const y = Math.round(128 + Math.sin(x * .021 + 1) * 4 + Math.sin(x * .07) * 1.5); M.stream.push(y); g.fillStyle = '#081a26'; g.fillRect(x, y, 1, 3); g.fillStyle = '#1d4a66'; g.fillRect(x, y, 1, 1); }
    for (let i = 0; i < w / 70; i++) { const x = 10 + rnd() * (w - 20) | 0, y = 150 + rnd() * 20 | 0, n = 2 + (rnd() * 3 | 0), cc = rnd() < .5 ? ['#7fd0ff', '#c8f0ff'] : ['#b58af0', '#e6d0ff']; for (let k = 0; k < n; k++) { const hh = 2 + (rnd() * 4 | 0); g.fillStyle = cc[0]; g.fillRect(x + k * 2, y - hh, 1, hh); g.fillStyle = cc[1]; g.fillRect(x + k * 2, y - hh, 1, 1); } }
    const mg = g.createLinearGradient(0, H0 - 22, 0, H0); mg.addColorStop(0, 'rgba(255,90,30,0)'); mg.addColorStop(1, 'rgba(255,90,30,.38)'); g.fillStyle = mg; g.fillRect(0, H0 - 22, w, 22);
    for (let x = 0; x < w; x++) { const y = H0 - 3 - Math.round((Math.sin(x * .05) * .5 + .5) * 3); g.fillStyle = 'rgba(255,120,40,.55)'; g.fillRect(x, y, 1, H0 - y); }
    // the crust and pines along the ridge, clear of the shafts
    for (let x = 0; x < w; x++) { g.fillStyle = '#20180f'; g.fillRect(x, top(x), 1, 1); }
    const taken = M.lay.map(l => l.x);
    for (let x = 4; x < w - 4; x += 4 + (rnd() * 6 | 0)) { if (taken.some(t => Math.abs(t - x) < 11)) continue; const y = top(x), h = 4 + (rnd() * 6 | 0); g.fillStyle = rnd() < .5 ? '#0a110c' : '#0f1911'; for (let k = 0; k < h; k++) { const hw = Math.round((k / h) * 2.4); g.fillRect(x - hw, y - h + k, hw * 2 + 1, 1); } }
    // the workings of every shaft: galleries cut as its blocks add up, rails, a lamp at each end
    for (const L of M.lay) {
      const { x, y0, y1, m, h } = L, b = Number(m.blocks || 0), n = Math.min(9, Math.floor(Math.log2(1 + b) * 1.4));
      for (let k = 0; k < n; k++) { const y = y0 + 9 + k * 11; if (y > y1 - 7) break; const side = (k + h) % 2 ? 1 : -1, len = 6 + ((h >> (k * 3)) & 7);
        g.fillStyle = '#0d0906'; for (let j = 0; j < len; j++) g.fillRect(x + side * (4 + j), y - 2 - (j % 5 === 2 ? 1 : 0), 1, 4);
        g.fillStyle = '#5a4430'; for (let j = 0; j < len; j += 2) g.fillRect(x + side * (4 + j), y + 1, 1, 1);
        g.fillStyle = '#ffcf7a'; g.fillRect(x + side * (3 + len), y - 1, 1, 1); }
    }
    M.bg = c; M.bgFor = key();
  }
  const key = () => M.width + ':' + M.lay.map(l => l.x + '.' + l.y1 + '.' + l.m.blocks).join(',');
  const font = px => `${px}px PX, 'Pixelify Sans', monospace`;
  const sol = n => { n = Number(n || 0); return n >= 10 ? n.toFixed(1) : n >= .01 ? n.toFixed(2) : n > 0 ? n.toFixed(3) : '0'; };
  function draw(now) {
    const g = M.g, t = (now - M.t0) / 1000, dt = Math.min(.05, (now - (M.last || now)) / 1000); M.last = now;
    if (!M.bg || M.bgFor !== key()) buildBg();
    const maxCam = Math.max(0, M.width - W0); if (!M.drag) M.cam += (Math.max(0, Math.min(maxCam, M.camT)) - M.cam) * .12; const cx = M.cam;
    g.imageSmoothingEnabled = false;
    g.setTransform(S, 0, 0, S, -Math.round(cx * S), 0); g.drawImage(M.bg, 0, 0);
    // moon, rain (fixed to the view)
    g.setTransform(S, 0, 0, S, 0, 0);
    g.fillStyle = 'rgba(225,230,255,.9)'; g.beginPath(); g.arc(W0 - 40, 17, 6, 0, 7); g.fill(); g.fillStyle = '#05060c'; g.beginPath(); g.arc(W0 - 37, 15, 6, 0, 7); g.fill();
    g.fillStyle = 'rgba(160,170,210,.28)'; for (let i = 0; i < 70; i++) { const x = ((i * 53 + t * 26 + i * i * 3) % (W0 + 20)) - 10, y = ((i * 37 + t * 120) % 70); if (y < top(x + cx) - 2) g.fillRect(x | 0, y | 0, 1, 3); }
    g.setTransform(S, 0, 0, S, -Math.round(cx * S), 0);
    if (M.stream) { g.fillStyle = 'rgba(160,220,255,.7)'; for (let k = 0; k < 26; k++) { const x = Math.round(((k * 97 + t * 14) % M.width)); if (x - cx > -2 && x - cx < W0 + 2) g.fillRect(x, M.stream[x] || 0, 2, 1); } }
    const heat = .25 + Math.sin(t * 1.3) * .08; g.fillStyle = `rgba(255,110,40,${heat.toFixed(3)})`; g.fillRect(Math.floor(cx), H0 - 8, W0 + 2, 8);
    for (let k = 0; k < 6; k++) { const ph = (t * .5 + k * .37) % 1, x = Math.round(cx + ((k * 151 + Math.floor(t * .5 + k * .37) * 67) % W0)); g.fillStyle = `rgba(255,170,80,${(1 - ph) * .8})`; g.fillRect(x, H0 - 4 - Math.round(ph * 7), 1, 1); }
    M.lay.forEach((L, i) => {
      const { m, x, y0, y1, h } = L, active = m.miners > 0, hov = i === M.hover, fl = M.flash[m.mint] ? Math.max(0, 1 - (now - M.flash[m.mint]) / 1800) : 0;
      if (x - cx < -40 || x - cx > W0 + 40) return;
      // the shaft, with timber sets, lit warm while people work it
      g.fillStyle = hov ? '#2a1d10' : '#0b0805'; g.fillRect(x - 3, y0, 7, y1 - y0);
      g.fillStyle = '#5a3e22'; for (let y = y0 + 3; y < y1 - 2; y += 5) g.fillRect(x - 3, y, 7, 1);
      g.fillStyle = '#3a2814'; g.fillRect(x - 4, y0, 1, y1 - y0); g.fillRect(x + 4, y0, 1, y1 - y0);
      if (active || fl) { g.fillStyle = `rgba(255,190,90,${.1 + fl * .35})`; g.fillRect(x - 3, y0, 7, y1 - y0); }
      // lamps in the galleries breathe
      if (active) { const lit = (Math.sin(t * 2.3 + h % 7) * .5 + .5) * .5; g.fillStyle = `rgba(255,190,90,${lit * .35})`; g.fillRect(x - 12, y0 + 6, 24, y1 - y0 - 6); }
      // the cage rides up and down while people are mining
      if (active) { const cy = Math.round(y0 + 3 + (Math.sin(t * .7 + i * 1.3) * .5 + .5) * Math.max(0, y1 - y0 - 12)); g.fillStyle = '#9aa0a4'; g.fillRect(x - 2, cy, 5, 5); g.fillStyle = '#2a2a2e'; g.fillRect(x - 1, cy + 1, 3, 3); g.fillStyle = '#ffd27a'; g.fillRect(x, cy + 2, 1, 1); g.fillStyle = 'rgba(200,200,210,.5)'; g.fillRect(x, y0 - 6, 1, cy - y0 + 6); }
      // the face at the bottom: a chamber, the pool piled in it, glowing with its size
      const pr = Math.max(1.5, Math.min(7, 1.5 + Math.sqrt(Math.max(0, m.pool)) * 6));
      const gl = g.createRadialGradient(x, y1, 0, x, y1, 8 + pr * 2.4 + fl * 18); gl.addColorStop(0, `rgba(255,200,100,${.5 + fl * .45})`); gl.addColorStop(1, 'rgba(255,170,60,0)'); g.fillStyle = gl; g.fillRect(x - 40, y1 - 40, 80, 80);
      g.fillStyle = '#0b0805'; g.fillRect(x - 11, y1 - 7, 23, 8); g.fillRect(x - 9, y1 - 8, 19, 1);
      g.fillStyle = '#c98a2c'; g.beginPath(); g.ellipse(x + 5, y1 + 1, pr + 1, pr * .7 + .5, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#f2c14e'; g.beginPath(); g.ellipse(x + 5, y1 + 1, pr, pr * .6, 0, Math.PI, 0); g.fill(); g.fillStyle = '#fff1cf'; g.fillRect(x + 4, y1 - Math.round(pr * .5), 1, 1);
      // miners at the face, one per person mining, up to four, swinging
      const img = X.SPR && X.SPR.pet, n = Math.min(4, m.miners || 0);
      for (let k = 0; k < n; k++) { const mx = x - 10 + k * 5 - (k % 2) * 9, sw = Math.sin(t * 6.5 + k * 1.9 + i), my = y1 - 9 + (sw > .55 ? 1 : 0);
        if (img) g.drawImage(img, mx, my, 9, 9);
        if (sw > .94 && Math.random() < .55) for (let q = 0; q < 3; q++) M.parts.push({ x: x + 7, y: y1 - 3, vx: 8 + Math.random() * 34, vy: -18 - Math.random() * 34, life: .35 + Math.random() * .2, c: Math.random() < .5 ? '#ffd27a' : '#fff1cf' }); }
      // the headframe: two legs, a sheave wheel, a lamp
      g.fillStyle = '#6a4a28'; g.fillRect(x - 4, y0 - 9, 1, 9); g.fillRect(x + 4, y0 - 9, 1, 9); g.fillRect(x - 4, y0 - 10, 9, 1); g.fillRect(x - 3, y0 - 5, 7, 1);
      g.fillStyle = '#8a6a40'; const wa = t * (active ? 3 : .3); g.fillRect(x - 1, y0 - 13, 3, 3); g.fillStyle = '#2a1d10'; g.fillRect(x + Math.round(Math.cos(wa)), y0 - 12 + Math.round(Math.sin(wa)), 1, 1);
      g.fillStyle = (active || Math.sin(t * 2.6 + i) > .2) ? '#ffb347' : '#6a4a20'; g.fillRect(x + 5, y0 - 7, 1, 1);
      // the ticker over it, and the pool under the face
      const ly = y0 - 16 - L.row * 9;
      if (L.row) { g.fillStyle = 'rgba(255,214,150,.25)'; g.fillRect(x, ly + 2, 1, 4); }
      g.font = font(7); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      g.fillStyle = 'rgba(0,0,0,.65)'; g.fillText('$' + String(m.symbol).slice(0, 8), x + .5, ly + .5);
      g.fillStyle = hov ? '#fff1cf' : active ? '#ffb347' : '#c9ad88'; g.fillText('$' + String(m.symbol).slice(0, 8), x, ly);
      g.font = font(6); g.fillStyle = 'rgba(255,214,122,.9)'; g.fillText(sol(m.pool) + (M.gap >= 32 ? ' SOL' : ''), x + 3, y1 + 9);
      if (hov) { g.strokeStyle = '#ffd27a'; g.lineWidth = 1 / S * 2; g.strokeRect(x - 5, y0 - 1, 11, y1 - y0 + 2); }
      if (X.RIG && X.RIG.on && X.RIG.mint === m.mint) { const b = Math.round(Math.sin(t * 4)); g.fillStyle = '#ffd27a'; g.fillRect(x + 8, y0 - 20 + b, 1, 12); g.fillStyle = '#ff6b6b'; g.fillRect(x + 9, y0 - 20 + b, 6, 4); g.font = font(6); g.textAlign = 'left'; g.fillStyle = '#fff1cf'; g.fillText('you', x + 9, y0 - 22 + b); g.strokeStyle = `rgba(255,210,122,${.4 + Math.sin(t * 4) * .3})`; g.lineWidth = 1 / S * 2; g.strokeRect(x - 5, y0 - 1, 11, y1 - y0 + 2); }
    });
    if (!M.lay.length) {   // nothing open yet: a ghost shaft that asks for the first coin
      const x = Math.round(W0 / 2), y0 = top(x + cx); g.setLineDash([2, 2]); g.strokeStyle = 'rgba(255,179,71,.6)'; g.lineWidth = 1 / S * 2; g.strokeRect(x - 3.5 + cx, y0 + .5, 7, 40); g.setLineDash([]);
      g.font = font(8); g.textAlign = 'center'; g.fillStyle = '#ffb347'; g.fillText('no mines yet. launch the first coin.', x + cx, y0 + 56);
    }
    // sparks, bursts, floating amounts
    for (const p of M.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 110 * dt; g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
    M.parts = M.parts.filter(p => p.life > 0 && p.y < H0);
    g.font = font(8); g.textAlign = 'center';
    for (const q of M.texts) { q.life -= dt; q.y -= dt * 8; g.fillStyle = `rgba(0,0,0,${Math.min(.7, q.life)})`; g.fillText(q.s, q.x + .5, Math.round(q.y) + .5); g.fillStyle = `rgba(255,241,207,${Math.min(1, q.life)})`; g.fillText(q.s, q.x, Math.round(q.y)); }
    M.texts = M.texts.filter(q => q.life > 0);
    // the level names stay pinned to the right edge, with the blocks it takes to get there
    g.setTransform(S, 0, 0, S, 0, 0); g.textAlign = 'right';
    LV.forEach((l, k) => { const y0 = k ? LV[k - 1].y1 : 66, yc = Math.round((y0 + l.y1) / 2); g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(W0 - 62, yc - 8, 60, 15); g.font = font(7); g.fillStyle = 'rgba(255,214,150,.9)'; g.fillText(l.name, W0 - 6, yc); g.font = font(5); g.fillStyle = 'rgba(255,214,150,.5)'; g.fillText(l.from ? `${l.from.toLocaleString()}+ blocks` : 'every new mine', W0 - 6, yc + 6); });
  }
  function burst(it) {
    const L = M.lay.find(l => l.m.mint === it.mint); if (!L) return;
    M.flash[it.mint] = performance.now();
    for (let i = 0; i < 60; i++) M.parts.push({ x: L.x + (Math.random() - .5) * 6, y: L.y1 - 2, vx: (Math.random() - .5) * 46, vy: -50 - Math.random() * 110, life: .9 + Math.random() * 1.1, c: Math.random() < .7 ? '#f2c14e' : '#fff1cf' });
    M.texts.push({ x: L.x, y: L.y0 - 26, s: Number(it.sol) > 0 ? `+${fsol(it.sol)} SOL` : `block #${it.height}`, life: 2.8 });
    const want = L.x - W0 / 2; if (L.x < M.camT + 30 || L.x > M.camT + W0 - 80) M.camT = want;
  }
  function loop(now) {
    M.raf = 0; if (!M.el || !document.body.contains(M.el)) return;
    const win = M.el.closest('.win'); if (!win || !win.classList.contains('open') || document.hidden) return;
    M.raf = requestAnimationFrame(loop);
    if (now - (M.drawn || 0) < 33) return; M.drawn = now; draw(now);
  }
  const kick = () => { if (!M.raf) M.raf = requestAnimationFrame(loop); };
  function status() {
    if (!M.el) return;
    const t = X.TOTALS || {}, list = (X.MINES || []).filter(m => m.state === 'live'), lastB = (X.BLOCKS || [])[0];
    $('.mt-st', M.el).innerHTML = `<span><b>${list.length}</b> mines</span><span><b>${t.miners || 0}</b> mining now${t.rate ? ' · ' + esc(X.hs ? X.hs(t.rate) : t.rate) : ''}</span><span><b>${fsol(t.pool || 0)}</b> SOL waiting in pools</span><span>${lastB ? `last block <b>${esc(ago(lastB.at))}</b> ago · $${esc(lastB.symbol)} #${esc(lastB.height)}` : 'no block yet'}</span>`;
  }
  function pick(ev) {
    const r = M.cv.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * W0 + M.cam, y = (ev.clientY - r.top) / r.height * H0;
    let best = -1, bd = 14; M.lay.forEach((L, i) => { const d = Math.abs(L.x - x); if (d < bd && y > L.y0 - 26 - L.row * 9 && y < L.y1 + 12) { bd = d; best = i; } });
    return best;
  }
  A.mountain = {
    title: 'mountain.exe — every mine, live', short: 'mountain.exe', icon: 'mountain', w: 940, h: 600, minW: 460, minH: 320, at: 'right',
    build(el) {
      M.el = el;
      el.innerHTML = `<div class="mt"><div class="mt-cvw"><canvas class="mt-cv" width="${W0 * S}" height="${H0 * S}"></canvas><div class="mt-tip" hidden></div></div>
        <div class="mt-st"></div><div class="mt-help dim">every coin is a shaft, sunk as deep as its chain has gone. miners swing where people are mining right now. drag to look along the range. click a shaft to open it.</div></div>`;
      M.cv = $('.mt-cv', el); M.g = M.cv.getContext('2d'); const tip = $('.mt-tip', el), cvw = $('.mt-cvw', el);
      // the height is fixed at 216 small pixels; the width follows the window, and each small pixel is a whole number of real ones
      const fit = () => { const narrow = el.clientWidth < 560, hh = narrow ? Math.round(el.clientWidth * H0 / 220) + 'px' : ''; if (cvw.style.height !== hh) { cvw.style.flex = narrow ? '0 0 auto' : ''; cvw.style.height = hh; }
        const r = cvw.getBoundingClientRect(); if (!r.width || !r.height) return; const k = r.height / H0, nS = Math.max(1, Math.min(4, Math.round(k * (devicePixelRatio || 1)))), nw = Math.max(200, Math.min(1600, Math.round(r.width / k)));
        if (nw !== W0 || nS !== S || M.cv.width !== nw * nS) { W0 = nw; S = nS; M.cv.width = W0 * S; M.cv.height = H0 * S; M.g = M.cv.getContext('2d'); layout(); M.drawn = 0; kick(); } };
      if (window.ResizeObserver) new ResizeObserver(fit).observe(cvw); requestAnimationFrame(fit);
      M.cv.addEventListener('pointerdown', e => { M.drag = { x: e.clientX, cam: M.cam, moved: false }; M.cv.setPointerCapture(e.pointerId); });
      M.cv.addEventListener('pointermove', e => {
        if (M.drag) { const r = M.cv.getBoundingClientRect(), dx = (e.clientX - M.drag.x) / r.width * W0; if (Math.abs(dx) > 2) M.drag.moved = true; M.cam = M.camT = Math.max(0, Math.min(Math.max(0, M.width - W0), M.drag.cam - dx)); }
        const i = pick(e); M.hover = i;
        if (i < 0) { tip.hidden = true; M.cv.style.cursor = M.drag ? 'grabbing' : (M.width > W0 ? 'grab' : 'default'); return; }
        const m = M.lay[i].m, r = M.cv.getBoundingClientRect(); M.cv.style.cursor = 'pointer';
        tip.innerHTML = `<b>$${esc(m.symbol)}</b> <span class="lvl">${esc(m.level || LV[levelOf(m.blocks)].name)}</span><div>block <b>#${m.height}</b> next · ${m.blocks} found</div><div>pool <b class="gold">${fsol(m.pool)} SOL</b></div><div>${m.miners ? `${m.miners} mining · ${esc(X.hs ? X.hs(m.rate) : m.rate)}` : 'nobody mining right now'}</div><div class="dim">click to open</div>`;
        tip.hidden = false; tip.style.left = Math.min(r.width - 190, Math.max(0, e.clientX - r.left + 14)) + 'px'; tip.style.top = Math.max(0, Math.min(r.height - 110, e.clientY - r.top - 10)) + 'px';
      });
      M.cv.addEventListener('pointerup', e => { const d = M.drag; M.drag = null; if (d && !d.moved) { const i = pick(e); if (i >= 0) X.openMine(M.lay[i].m.mint); else if (!M.lay.length) X.open('launch'); } });
      M.cv.addEventListener('pointerleave', () => { M.hover = -1; tip.hidden = true; });
      M.cv.addEventListener('wheel', e => { if (M.width <= W0) return; e.preventDefault(); M.camT = Math.max(0, Math.min(M.width - W0, M.camT + (e.deltaX || e.deltaY) * .3)); }, { passive: false });
      X.on('mines', () => { layout(); status(); });
      X.on('feed', it => { if (it.kind === 'block') burst(it); });
      X.on('blocks', status);
      layout(); status(); kick();
      clearInterval(M.st); M.st = setInterval(() => { if (X.WM.isOpen('mountain')) status(); }, 15000);
    },
    open() { kick(); }, focus() { kick(); }, resized() { kick(); },
  };
  return A;
}
