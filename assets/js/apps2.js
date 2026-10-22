// more windows: the greenhouse (every bud in a pot, sized by its level), bagwork.exe (a small game) and paint.exe.
export function installMore(X) {
  const { $, $$, esc, fsol, SOUND, ICONS } = X;
  const A = {};

  // ================================================================ greenhouse: every bud in a pot on the shelves, sized by its level.
  // rain runs down the glass, the bars hum, a watering can makes its rounds, and the last pot is always empty, waiting for yours.
  A.greenhouse = {
    title: 'greenhouse — watch them grow', short: 'greenhouse', icon: 'greenhouse', w: 800, h: 540, minW: 360, minH: 300,
    build(el) {
      el.innerHTML = `<div class="gh"><canvas></canvas><div class="gh-tip" hidden></div></div>`;
      const wrap = $('.gh', el), cv = $('canvas', el), g = cv.getContext('2d'), tip = $('.gh-tip', el);
      let W = 0, H = 0, VH = 0, D = 1, slots = [], hover = null, mx = -1, my = -1, rowH = 160, per = 4, can = { i: -1, t0: 0 };
      const SC = { rookie: 1, grinder: 1.22, workhorse: 1.45, legend: 1.75 }, TOP = 46, PADX = 46;
      const rain = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), v: .25 + Math.random() * .5, l: 6 + Math.random() * 14 }));
      const spores = Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random(), v: .01 + Math.random() * .02, p: Math.random() * 6 }));
      function layout() {
        const r = wrap.getBoundingClientRect(); D = Math.min(2, devicePixelRatio || 1); W = Math.max(240, Math.round(r.width)); VH = Math.max(200, Math.round(r.height));
        const buds = X.BUDS.filter(b => b.state === 'live').sort((a, b) => b.claimed - a.claimed);
        per = Math.max(2, Math.floor((W - PADX * 2) / 104)); const n = buds.length + 1, rows = Math.max(1, Math.ceil(n / per));
        rowH = Math.max(150, Math.min(210, (VH - TOP - 8) / Math.min(rows, 2))); H = Math.max(VH, Math.round(TOP + rows * rowH + 10));
        cv.width = W * D; cv.height = H * D; cv.style.width = W + 'px'; cv.style.height = H + 'px'; g.setTransform(D, 0, 0, D, 0, 0);
        const sw = (W - PADX * 2) / per;
        slots = [...buds, null].map((b, i) => ({ b, x: Math.round(PADX + sw * (i % per) + sw / 2), y: Math.round(TOP + (Math.floor(i / per) + 1) * rowH - 26), s: b ? SC[b.level] || 1 : 1, ph: (i * 1.7) % 6, sw }));
      }
      function draw(now) {
        requestAnimationFrame(draw); if (!document.body.contains(cv) || !X.WM.isOpen('greenhouse') || document.hidden) return;
        const t = now / 1000;
        // the glass house at night
        const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#020806'); bg.addColorStop(1, '#06160d'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(120,200,150,.035)'; for (let x = 60; x < W; x += 120) g.fillRect(x, 0, 3, H);
        g.fillStyle = 'rgba(150,220,180,.18)'; for (const d of rain) { d.y += d.v * .016; if (d.y > 1.05) { d.y = -.05; d.x = Math.random(); } g.fillRect(Math.round(d.x * W), Math.round(d.y * H), 1, d.l); }
        // header
        const live = slots.filter(s => s.b), working = live.filter(s => s.b.workedAt && Date.now() - new Date(s.b.workedAt) < 30 * 60e3).length;
        g.fillStyle = '#0a2414'; g.fillRect(0, 0, W, 30); g.fillStyle = '#173d25'; g.fillRect(0, 30, W, 2);
        g.font = '16px PX, monospace'; g.textAlign = 'left'; g.fillStyle = '#5cf08a'; g.fillText('GREENHOUSE', 12, 21);
        g.font = '16px VT, monospace'; g.fillStyle = '#7fa98b'; g.fillText(`${live.length} buds · ${working} working now · bigger pot, bigger level`, 128, 21);
        // shelves, bars and light
        const rows = Math.ceil(slots.length / per);
        for (let r = 0; r < rows; r++) {
          const y = TOP + (r + 1) * rowH - 26, top = y - rowH + 34, fl = .9 + Math.sin(t * 3 + r) * .05 + (Math.random() < .004 ? -.5 : 0);
          const gr = g.createLinearGradient(0, top, 0, y); gr.addColorStop(0, `rgba(92,240,138,${.16 * fl})`); gr.addColorStop(1, 'rgba(92,240,138,0)'); g.fillStyle = gr;
          g.beginPath(); g.moveTo(PADX + 10, top); g.lineTo(W - PADX - 10, top); g.lineTo(W - PADX + 14, y); g.lineTo(PADX - 14, y); g.closePath(); g.fill();
          g.fillStyle = '#1a1b1c'; g.fillRect(PADX, top - 8, W - PADX * 2, 6); g.save(); g.shadowColor = '#5cf08a'; g.shadowBlur = 14; g.fillStyle = `rgba(214,255,226,${fl})`; g.fillRect(PADX + 8, top - 3, W - PADX * 2 - 16, 3); g.restore();
          g.fillStyle = '#2b2116'; g.fillRect(PADX - 18, y, W - PADX * 2 + 36, 9); g.fillStyle = '#3d2f1f'; g.fillRect(PADX - 18, y, W - PADX * 2 + 36, 3); g.fillStyle = '#130e09'; g.fillRect(PADX - 18, y + 9, W - PADX * 2 + 36, 4);
          g.fillStyle = '#1d1610'; g.fillRect(PADX - 14, y + 13, 6, 18); g.fillRect(W - PADX + 8, y + 13, 6, 18);
        }
        g.imageSmoothingEnabled = false; hover = null;
        slots.forEach((sl, i) => {
          const size = Math.round(40 * sl.s), bob = sl.b ? Math.round(Math.sin(t * 1.7 + sl.ph) * 1.5) : 0, x = sl.x - size / 2, y = sl.y - size - 13 + bob;
          // the pot
          g.fillStyle = '#7a3f22'; g.fillRect(sl.x - 19, sl.y - 17, 38, 5); g.fillStyle = '#a85a32'; g.fillRect(sl.x - 16, sl.y - 12, 32, 12); g.fillStyle = '#8c4a28'; g.fillRect(sl.x - 16, sl.y - 3, 32, 3); g.fillStyle = '#2a1d14'; g.fillRect(sl.x - 15, sl.y - 17, 30, 2);
          if (!sl.b) {
            // the empty pot: a sprout, and an invitation
            const sw = Math.sin(t * 2) * 1; g.fillStyle = '#3fbf6a'; g.fillRect(sl.x - 1, sl.y - 27, 2, 10); g.fillRect(sl.x - 6 + sw, sl.y - 29, 5, 3); g.fillRect(sl.x + 1 + sw, sl.y - 31, 5, 3);
            const over = Math.abs(mx - sl.x) < 40 && my > sl.y - 70 && my < sl.y + 24; if (over) hover = sl;
            g.font = '12px PX, monospace'; g.textAlign = 'center'; g.fillStyle = over ? '#eafff0' : (t * 1.2 | 0) % 2 ? '#5cf08a' : '#2f8a52'; g.fillText('+ plant one', sl.x, sl.y + 24); return;
          }
          const b = sl.b, working = b.workedAt && Date.now() - new Date(b.workedAt) < 30 * 60e3;
          if (b.level === 'legend') { g.save(); g.shadowColor = 'rgba(242,193,78,.85)'; g.shadowBlur = 20; }
          const spr = X.tinted(working && (t * 1.1 | 0) % 5 === 0 ? X.SPR.bag : X.SPR.pet, X.hueOf(b.mint)) || X.SPR.pet;
          g.drawImage(spr, Math.round(x), Math.round(y), size, size); if (b.level === 'legend') g.restore();
          const over = mx > x - 6 && mx < x + size + 6 && my > y && my < sl.y + 24; if (over) hover = sl;
          if (working && (t * 2.2 + sl.ph | 0) % 4 === 0) { g.fillStyle = '#f2c14e'; g.fillRect(Math.round(x + size * .8), Math.round(y + 4 - (t * 30 % 12)), 3, 3); }
          g.font = '12px PX, monospace'; g.textAlign = 'center'; g.fillStyle = over ? '#eafff0' : 'rgba(180,230,195,.8)';
          let nm = b.budName; while (g.measureText(nm).width > sl.sw - 8 && nm.length > 3) nm = nm.slice(0, -1); g.fillText(nm === b.budName ? nm : nm + '…', sl.x, sl.y + 24);
        });
        // the watering can makes its rounds
        const live2 = slots.filter(s => s.b);
        if (live2.length) {
          if (can.i < 0 || now - can.t0 > 5200) { can.i = Math.floor(Math.random() * live2.length); can.t0 = now; }
          const tg = live2[can.i % live2.length], k = Math.min(1, (now - can.t0) / 900), cx = Math.round((can.x ?? tg.x) + (tg.x + 18 - (can.x ?? tg.x)) * k), cy = Math.round(tg.y - 40 * tg.s - 52);
          if (k >= 1) can.x = tg.x + 18;
          g.fillStyle = '#5b6b63'; g.fillRect(cx, cy, 16, 11); g.fillStyle = '#7f908a'; g.fillRect(cx + 2, cy + 2, 12, 2); g.fillRect(cx - 9, cy + 2, 9, 3); g.fillRect(cx + 16, cy - 3, 3, 9); g.fillStyle = '#3b4a42'; g.fillRect(cx + 3, cy - 5, 9, 2);
          const pour = now - can.t0 > 1000 && now - can.t0 < 3400;
          if (pour) { g.fillStyle = 'rgba(127,227,196,.85)'; for (let k2 = 0; k2 < 5; k2++) { const dy = ((now / 6 + k2 * 13) % 46); g.fillRect(cx - 10 + (k2 % 2) * 3, cy + 6 + dy, 2, 4); } }
        }
        // spores drifting in the light
        for (const p of spores) { p.y -= p.v * .016; p.x += Math.sin(t / 2 + p.p) * .0004; if (p.y < 0) { p.y = 1; p.x = Math.random(); } g.fillStyle = 'rgba(170,255,200,.35)'; g.fillRect(Math.round(p.x * W), Math.round(p.y * H), 2, 2); }
        cv.style.cursor = hover ? 'pointer' : 'default';
        if (hover && hover.b) { tip.hidden = false; const b = hover.b; tip.innerHTML = `<b>${esc(b.budName)}</b> <span class="lvl ${esc(b.level)}">${esc(b.level)}</span><br><span class="ok">$${esc(b.symbol)}</span> · worked <b class="am">${fsol(b.claimed)} SOL</b><br><small class="dim">${esc(b.last || 'waiting for fees')}</small>`;
          tip.style.left = Math.min(W - 230, Math.max(4, hover.x - 110)) + 'px'; tip.style.top = Math.max(36, hover.y - 40 * hover.s - 104) + 'px'; }
        else tip.hidden = true;
      }
      cv.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; });
      cv.addEventListener('pointerleave', () => { mx = my = -1; });
      cv.addEventListener('click', () => { if (hover) hover.b ? X.openBud(hover.b.mint) : X.open('launch'); });
      X.on('buds', layout); new ResizeObserver(layout).observe(wrap); layout(); requestAnimationFrame(draw);
    },
  };

  // ================================================================ bagwork.exe: catch the bags, dodge the red candles
  A.bagwork = {
    title: 'catch.exe — catch the bags', short: 'catch.exe', icon: 'bagwork', w: 460, h: 470, nomax: true, noresize: true,
    build(el) {
      el.innerHTML = `<div class="game"><div class="g-hud"><span>score <b class="g-s">0</b></span><span>best <b class="g-b">0</b></span><span class="g-l"></span></div><canvas width="420" height="360"></canvas><p class="hint">← → or drag to move. coins +1, bags +5. red candles cost a life.</p></div>`;
      const cv = $('canvas', el), g = cv.getContext('2d'), W = 420, H = 360;
      let st = 'title', px = W / 2, score = 0, best = +(X.ls.get('bud:best') || 0), lives = 3, items = [], t0 = 0, last = 0, keys = {}, spawnT = 0, raf = 0, hurtT = 0, fx = [];
      $('.g-b', el).textContent = best;
      const lifeH = () => { $('.g-l', el).innerHTML = '♥'.repeat(lives).replace(/♥/g, '<b class="bad">♥</b>') + '<span class="mute">' + '♥'.repeat(3 - lives) + '</span>'; };
      const start = () => { st = 'play'; score = 0; lives = 3; items = []; t0 = performance.now(); spawnT = 0; lifeH(); $('.g-s', el).textContent = 0; SOUND.sfx('beep'); };
      const key = (e, v) => { const w = X.WM.wins.bagwork; if (!w || !w.classList.contains('active') || !w.classList.contains('open')) return; if (['ArrowLeft', 'ArrowRight', 'a', 'd', ' '].includes(e.key)) { e.preventDefault(); keys[e.key] = v; if (v && e.key === ' ' && st !== 'play') start(); } };
      addEventListener('keydown', e => key(e, true)); addEventListener('keyup', e => key(e, false));
      cv.addEventListener('pointerdown', e => { if (st !== 'play') start(); cv.setPointerCapture(e.pointerId); });
      cv.addEventListener('pointermove', e => { if (e.buttons || e.pointerType !== 'mouse') { const r = cv.getBoundingClientRect(); px = (e.clientX - r.left) / r.width * W; } });
      function spawn(el2) { const k = Math.random(), lvl = Math.min(1, el2 / 60); items.push({ x: 20 + Math.random() * (W - 40), y: -20, v: 70 + lvl * 110 + Math.random() * 40, t: k < .62 ? 'coin' : k < .72 ? 'bag' : 'candle' }); }
      function draw(now) {
        raf = requestAnimationFrame(draw); if (!document.body.contains(cv)) return cancelAnimationFrame(raf);
        const dt = Math.max(0, Math.min(.05, (now - (last || now)) / 1000)); last = now;
        g.fillStyle = '#030a06'; g.fillRect(0, 0, W, H);
        g.strokeStyle = 'rgba(92,240,138,.06)'; for (let x = 0; x < W; x += 20) { g.beginPath(); g.moveTo(x + .5, 0); g.lineTo(x + .5, H); g.stroke(); }
        g.fillStyle = '#0e2416'; g.fillRect(0, H - 22, W, 22); g.fillStyle = '#2a6e42'; g.fillRect(0, H - 22, W, 2);
        if (st === 'play') {
          const el2 = (now - t0) / 1000; if ((keys.ArrowLeft || keys.a)) px -= 260 * dt; if ((keys.ArrowRight || keys.d)) px += 260 * dt; px = Math.max(22, Math.min(W - 22, px));
          spawnT -= dt; if (spawnT <= 0) { spawn(el2); spawnT = Math.max(.28, .9 - el2 / 90); }
          for (const it of items) it.y += it.v * dt;
          items = items.filter(it => {
            if (it.y > H - 52 && it.y < H - 18 && Math.abs(it.x - px) < 26) {
              if (it.t === 'candle') { lives--; lifeH(); SOUND.sfx('hurt'); hurtT = now; if (lives <= 0) { st = 'over'; if (score > best) { best = score; X.ls.set('bud:best', best); $('.g-b', el).textContent = best; SOUND.sfx('chime'); } } }
              else { const p = it.t === 'bag' ? 5 : 1; score += p; $('.g-s', el).textContent = score; SOUND.sfx('coin'); fx.push({ x: it.x, y: it.y, t: now, p }); }
              return false;
            }
            return it.y < H;
          });
        }
        g.imageSmoothingEnabled = false;
        for (const it of items) {
          if (it.t === 'coin') { g.fillStyle = '#8f5a17'; g.fillRect(it.x - 7, it.y - 7, 14, 14); g.fillStyle = '#f2c14e'; g.fillRect(it.x - 6, it.y - 6, 12, 12); g.fillStyle = '#fff1a6'; g.fillRect(it.x - 4, it.y - 4, 3, 3); }
          else if (it.t === 'bag') { g.drawImage(X.SPR.bag, 21, 7, 11, 17, it.x - 11, it.y - 17, 22, 34); }
          else { g.fillStyle = '#ff6b6b'; g.fillRect(it.x - 5, it.y - 14, 10, 28); g.fillRect(it.x - 1, it.y - 22, 2, 44); }
        }
        const flash = now - hurtT < 300 && (now / 60 | 0) % 2;
        if (!flash) g.drawImage(X.SPR.bag, px - 30, H - 22 - 56, 60, 60);
        fx = fx.filter(f => now - f.t < 600); for (const f of fx) { g.fillStyle = `rgba(242,193,78,${1 - (now - f.t) / 600})`; g.font = '16px PX, monospace'; g.textAlign = 'center'; g.fillText('+' + f.p, f.x, f.y - (now - f.t) / 20); }
        if (st !== 'play') {
          g.fillStyle = 'rgba(2,8,4,.72)'; g.fillRect(0, 0, W, H); g.textAlign = 'center'; g.fillStyle = '#5cf08a'; g.font = '30px PX, monospace';
          g.fillText(st === 'title' ? 'catch.exe' : 'the bag dropped.', W / 2, H / 2 - 30);
          g.font = '15px PX, monospace'; g.fillStyle = '#c6ffd6'; g.fillText(st === 'title' ? 'catch the bags. dodge the red candles.' : `score ${score} · best ${best}`, W / 2, H / 2 + 2);
          g.fillStyle = '#7fa98b'; g.fillText((now / 500 | 0) % 2 ? 'press space or tap to start' : '', W / 2, H / 2 + 34);
        }
      }
      lifeH(); raf = requestAnimationFrame(draw);
    },
  };

  // ================================================================ paint.exe: a 32×32 coin picture
  A.paint = {
    title: 'paint.exe — untitled.ore', short: 'paint.exe', icon: 'paint', w: 600, h: 500, minW: 420, minH: 420,
    build(el) {
      const PAL = ['#000000', '#2a211b', '#6b5d52', '#ece2d0', '#ffffff', '#3a1f0c', '#a8641c', '#ffb347', '#ffe1b0', '#f2c14e', '#ffd27a', '#7fe3c4', '#5cb4f0', '#ff6b6b', '#b5653a', '#6e3a1f'];
      const N = 32; let grid = Array(N * N).fill(null), col = '#ffb347', tool = 'pen', down = false;
      el.innerHTML = `<div class="paint"><div class="pt-tools">${[['pen', 'pencil'], ['fill', 'fill'], ['erase', 'eraser']].map(([k, t]) => `<button type="button" class="chip ${k === 'pen' ? 'on' : ''}" data-t="${k}">${t}</button>`).join('')}<button type="button" class="chip" data-x="bud">start from a miner</button><button type="button" class="chip" data-x="clear">clear</button></div>
        <div class="pt-main"><canvas class="pt-c" width="512" height="512"></canvas><div class="pt-pal">${PAL.map(c => `<button type="button" style="background:${c}" data-c="${c}" title="${c}"></button>`).join('')}</div></div>
        <div class="pt-f"><span class="dim">draw a coin picture, then send it to launch.exe</span><button class="btn go" type="button" data-x="use">use as coin picture</button></div></div>`;
      const cv = $('.pt-c', el), g = cv.getContext('2d');
      const paint = () => { g.fillStyle = '#0c0805'; g.fillRect(0, 0, 512, 512); for (let i = 0; i < N * N; i++) if (grid[i]) { g.fillStyle = grid[i]; g.fillRect((i % N) * 16, (i / N | 0) * 16, 16, 16); }
        g.strokeStyle = 'rgba(255,179,71,.07)'; g.beginPath(); for (let k = 0; k <= N; k++) { g.moveTo(k * 16 + .5, 0); g.lineTo(k * 16 + .5, 512); g.moveTo(0, k * 16 + .5); g.lineTo(512, k * 16 + .5); } g.stroke(); };
      const at = e => { const r = cv.getBoundingClientRect(); const x = Math.floor((e.clientX - r.left) / r.width * N), y = Math.floor((e.clientY - r.top) / r.height * N); return x >= 0 && y >= 0 && x < N && y < N ? y * N + x : -1; };
      const fill = (i, from, to) => { if (from === to) return; const st = [i]; while (st.length) { const k = st.pop(); if (k < 0 || k >= N * N || grid[k] !== from) continue; grid[k] = to; const x = k % N; st.push(k - N, k + N); if (x > 0) st.push(k - 1); if (x < N - 1) st.push(k + 1); } };
      const act = e => { const i = at(e); if (i < 0) return; if (tool === 'fill') { fill(i, grid[i], col); down = false; } else grid[i] = tool === 'erase' ? null : col; paint(); };
      cv.addEventListener('pointerdown', e => { down = true; cv.setPointerCapture(e.pointerId); act(e); SOUND.sfx('tick'); });
      cv.addEventListener('pointermove', e => { if (down && tool !== 'fill') act(e); });
      cv.addEventListener('pointerup', () => down = false);
      $$('[data-t]', el).forEach(b => b.onclick = () => { tool = b.dataset.t; $$('[data-t]', el).forEach(x => x.classList.toggle('on', x === b)); });
      $$('[data-c]', el).forEach(b => b.onclick = () => { col = b.dataset.c; $$('[data-c]', el).forEach(x => x.classList.toggle('on', x === b)); if (tool === 'erase') { tool = 'pen'; $$('[data-t]', el).forEach(x => x.classList.toggle('on', x.dataset.t === 'pen')); } });
      $('[data-x=clear]', el).onclick = () => { grid.fill(null); paint(); };
      $('[data-x=bud]', el).onclick = () => { const c = document.createElement('canvas'); c.width = c.height = N; const q = c.getContext('2d'); q.drawImage(X.SPR.pet, 0, 0, N, N); const d = q.getImageData(0, 0, N, N).data; for (let i = 0; i < N * N; i++) grid[i] = d[i * 4 + 3] > 100 ? `rgb(${d[i * 4]},${d[i * 4 + 1]},${d[i * 4 + 2]})` : grid[i]; paint(); };
      $('[data-x=use]', el).onclick = () => { const c = document.createElement('canvas'); c.width = c.height = 512; const q = c.getContext('2d'); q.fillStyle = '#0c0805'; q.fillRect(0, 0, 512, 512); for (let i = 0; i < N * N; i++) if (grid[i]) { q.fillStyle = grid[i]; q.fillRect((i % N) * 16, (i / N | 0) * 16, 16, 16); } X.emit('paint:use', c.toDataURL('image/png')); };
      paint(); $(`[data-c="${col}"]`, el).classList.add('on');
    },
  };
  return A;
}
