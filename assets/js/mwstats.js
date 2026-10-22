// stats.exe: the mountain in numbers. Fees claimed into pools, blocks found, SOL paid to finders, who is mining.
export function installStats(X) {
  const { $, $$, esc, api, fsol, ago, short, WM } = X;
  const A = {};
  const COL = { paid: '#f2c14e', claimed: '#8a5a24', dev: '#e07a4a', pool: '#ffe1b0' };
  const VT = s => `${s}px VT, 'VT323', monospace`;
  const lvl = l => `<span class="lvl ${esc(l)}">${esc(l)}</span>`;
  const trim = v => v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v >= 1 ? v.toFixed(2) : v >= .01 ? v.toFixed(3) : v.toFixed(4);
  const nice = v => { const p = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1e-9)))), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; };
  const visible = app => { const w = WM.wins[app]; return !!(w && w.classList.contains('open') && !document.hidden); };
  const hs = n => X.hs ? X.hs(n) : String(n);
  const ST = { d: null, view: 'hours', hover: -1, t0: 0, timer: 0, soon: 0 };

  A.stats = {
    title: 'stats.exe — the mountain in numbers', short: 'stats.exe', icon: 'stats', w: 860, h: 680, minW: 440, minH: 380,
    build(el) {
      const TILES = [['mines', 'mines open', ''], ['blocks', 'blocks found', ''], ['paid', 'paid to finders', 'SOL'], ['claimed', 'fees claimed', 'SOL'], ['pool', 'waiting in pools', 'SOL'], ['rate', 'hashing now', '']];
      el.innerHTML = `<div class="dash">
        <div class="st-top">${TILES.map(([k, t, u]) => `<div class="st-n st-${k}"><b data-k="${k}">0</b>${u ? `<small>${u}</small>` : ''}<span>${t}</span></div>`).join('')}</div>
        <div class="st-grid">
          <section class="st-card st-act"><header><span class="st-t">blocks and payouts</span><span class="st-span dim"></span><span class="st-leg"><i class="k-claim">claimed</i><i class="k-block">paid</i><i class="k-dot">● a block</i></span></header><div class="st-cvw"><canvas class="st-cv"></canvas><div class="st-tip" hidden></div></div></section>
          <section class="st-card st-where"><header><span class="st-t">where the fees went</span></header><div class="st-ringw"><canvas class="st-ring" width="48" height="48"></canvas><div class="st-rc"><b data-k="claimedc">0</b><span>SOL claimed</span></div></div><ul class="st-split"></ul></section>
          <section class="st-card st-lead"><header><span class="st-t">richest mines</span><span class="dim">by SOL paid out</span></header><ol class="st-board"></ol>
            <header><span class="st-t">top miners</span><span class="dim">by SOL earned</span></header><ol class="st-miners"></ol></section>
          <section class="st-card st-side"><header><span class="st-t">last 24 hours</span></header><dl class="st-day"></dl>
            <header><span class="st-t">engine</span></header><div class="st-eng off"><svg viewBox="0 0 120 22" class="st-ecg" aria-hidden="true"><polyline points="0,13 34,13 40,13 44,3 48,20 52,9 56,13 120,13"/></svg><span class="st-et dim">—</span></div>
            <header><span class="st-t">newest mines</span></header><ul class="st-new"></ul></section>
        </div></div>`;
      const cv = $('.st-cv', el), g = cv.getContext('2d'), tip = $('.st-tip', el); let W = 0, H = 0;
      const fit = () => { const r = cv.parentElement.getBoundingClientRect(), D = Math.min(2, devicePixelRatio || 1); W = Math.max(200, Math.round(r.width)); H = Math.max(110, Math.round(r.height)); cv.width = W * D; cv.height = H * D; cv.style.width = W + 'px'; cv.style.height = H + 'px'; g.setTransform(D, 0, 0, D, 0, 0); draw(); };
      const series = () => { const d = ST.d; if (!d || !d.hours) return []; const quiet = d.hours.slice(1).every(b => !b.blocks && !b.claimed); ST.view = quiet ? 'mins' : 'hours'; return (quiet ? d.mins : d.hours).slice().reverse(); };
      const M = { L: 44, R: 8, T: 12, B: 22 };
      function draw() {
        if (!W) return; const now = performance.now(), arr = series(), n = arr.length || 24;
        g.clearRect(0, 0, W, H);
        const cw = W - M.L - M.R, ch = H - M.T - M.B, max = Math.max(0, ...arr.map(b => Math.max(b.claimed, b.paid)));
        const stp = nice(Math.max(max, .003) / 3), top = Math.max(stp, Math.ceil(Math.max(max, .003) / stp) * stp);
        g.font = VT(14); g.textAlign = 'right';
        for (let k = 0; k <= 3; k++) { const v = top * k / 3, y = Math.round(M.T + ch - ch * v / top) + .5; g.strokeStyle = k ? 'rgba(255,179,71,.08)' : 'rgba(255,179,71,.3)'; g.beginPath(); g.moveTo(M.L, y); g.lineTo(W - M.R, y); g.stroke(); g.fillStyle = '#8a6a44'; g.fillText(v ? trim(v) : '0', M.L - 6, y + 4); }
        const bw = cw / n, gap = Math.max(1, Math.round(bw * .2)); let moving = false;
        arr.forEach((b, i) => {
          const k = Math.min(1, Math.max(0, (now - ST.t0 - i * 16) / 520)), e = 1 - Math.pow(1 - k, 3); if (k < 1) moving = true;
          const x = Math.round(M.L + i * bw + gap / 2), w = Math.max(2, Math.round(bw - gap)), half = Math.max(1, Math.floor(w / 2));
          if (i === ST.hover) { g.fillStyle = 'rgba(255,241,207,.06)'; g.fillRect(Math.round(M.L + i * bw), M.T, Math.ceil(bw), ch); }
          const hc = Math.round(ch * b.claimed / top * e), hp = Math.round(ch * b.paid / top * e);
          if (hc) { g.fillStyle = COL.claimed; g.fillRect(x, M.T + ch - hc, half, hc); }
          if (hp) { g.fillStyle = COL.paid; g.fillRect(x + half, M.T + ch - hp, w - half, hp); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + half, M.T + ch - hp, w - half, 1); }
          for (let j = 0; j < Math.min(b.blocks, 6); j++) { g.fillStyle = '#ffd27a'; g.fillRect(x + Math.floor(w / 2) - 1, M.T + ch + 4 + j * 0, 3, 3); }
        });
        g.font = VT(14); g.fillStyle = '#8a6a44'; g.textAlign = 'left'; g.fillText(ST.view === 'mins' ? '60 min ago' : '24 h ago', M.L, H - 5); g.textAlign = 'center'; g.fillText(ST.view === 'mins' ? '30 min' : '12 h', M.L + cw / 2, H - 5); g.textAlign = 'right'; g.fillText('now', W - M.R, H - 5);
        $('.st-span', el).textContent = ST.view === 'mins' ? 'last hour · SOL per 2 min' : 'last 24 hours · SOL per hour';
        if (moving) requestAnimationFrame(draw);
      }
      cv.addEventListener('pointermove', e => {
        const r = cv.getBoundingClientRect(), x = e.clientX - r.left, arr = series(), n = arr.length || 24, i = Math.floor((x - M.L) / ((W - M.L - M.R) / n));
        const h = i >= 0 && i < n ? i : -1; if (h !== ST.hover) { ST.hover = h; draw(); }
        if (h < 0) { tip.hidden = true; return; } const b = arr[h], back = n - 1 - h;
        const when = ST.view === 'mins' ? (back ? `${back * 2}–${back * 2 + 2} min ago` : 'the last 2 minutes') : (back ? `${back}–${back + 1} h ago` : 'this hour');
        tip.innerHTML = `<b>${when}</b><div><span class="k-claim">claimed</span><span>${fsol(b.claimed)} SOL</span></div><div><span class="k-block">paid</span><span>${fsol(b.paid)} SOL</span></div><div class="dim"><span>blocks</span><span>${b.blocks}</span></div>`;
        tip.hidden = false; tip.style.left = Math.min(W - 170, Math.max(0, x + 12)) + 'px'; tip.style.top = '8px';
      });
      cv.addEventListener('pointerleave', () => { ST.hover = -1; tip.hidden = true; draw(); });
      const rc = $('.st-ring', el), rg = rc.getContext('2d');
      function ring(k = 1) {
        const t = (ST.d && ST.d.totals) || {}, parts = [['paid', t.paid || 0, 'paid to finders'], ['pool', t.pool || 0, 'waiting in pools'], ['dev', t.dev || 0, 'dev cuts']], sum = parts.reduce((s, p) => s + p[1], 0), N = 48, c = N / 2;
        const img = rg.createImageData(N, N), hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          const dx = x + .5 - c, dy = y + .5 - c, r = Math.hypot(dx, dy); if (r < 14 || r > 22) continue;
          let a = (Math.atan2(dx, -dy) / (Math.PI * 2) + 1) % 1, col = [46, 30, 16];
          if (sum > 0 && a <= k) { let acc = 0; for (const [kind, v] of parts) { acc += v / sum; if (a <= acc + 1e-9) { col = hex(COL[kind]); break; } } }
          img.data.set([...col, 255], (y * N + x) * 4);
        }
        rg.putImageData(img, 0, 0);
        $('.st-split', el).innerHTML = parts.map(([kind, v, t]) => `<li><i style="background:${COL[kind]}"></i><b>${t}</b><span>${fsol(v)} SOL</span><em>${sum ? Math.round(v / sum * 100) : 0}%</em></li>`).join('');
      }
      function ringAnim() { const t0 = performance.now(); const st = now => { const k = Math.min(1, (now - t0) / 800); ring(1 - Math.pow(1 - k, 3)); if (k < 1) requestAnimationFrame(st); }; requestAnimationFrame(st); }
      function render(first) {
        const d = ST.d; if (!d) return; const t = d.totals || {};
        const fmt = { mines: v => String(Math.round(v)), blocks: v => String(Math.round(v)), paid: fsol, claimed: fsol, pool: fsol, rate: v => hs(v) };
        $$('.st-top b[data-k]', el).forEach(b => X.fx.countTo(b, t[b.dataset.k] || 0, fmt[b.dataset.k]));
        X.fx.countTo($('[data-k=claimedc]', el), t.claimed || 0, fsol);
        if (first) { ST.t0 = performance.now(); ringAnim(); } else ring(1);
        draw();
        const top = d.top || [], mx = Math.max(.000001, ...top.map(b => b.paid));
        $('.st-board', el).innerHTML = top.length ? top.map((b, i) => `<li data-m="${esc(b.mint)}" style="--i:${i}"><span class="rk">${i + 1}</span><img src="${esc(b.img)}" alt=""><span class="nm"><b>$${esc(b.symbol)}</b><i>#${b.height}</i></span>${lvl(b.level)}<span class="bar"><i style="width:${Math.max(2, b.paid / mx * 100).toFixed(1)}%"></i></span><b class="am">${fsol(b.paid)}</b></li>`).join('')
          : `<li class="empty">no mines yet. the first one opened is on top.</li>`;
        const ms = d.miners || [], mm = Math.max(.000001, ...ms.map(m => m.paid));
        $('.st-miners', el).innerHTML = ms.length ? ms.map((m, i) => `<li style="--i:${i}"><span class="rk">${i + 1}</span><span class="nm"><b>${esc(short(m.miner))}</b><i>${m.blocks} block${m.blocks === 1 ? '' : 's'}</i></span><span class="bar"><i style="width:${Math.max(2, m.paid / mm * 100).toFixed(1)}%"></i></span><b class="am">${fsol(m.paid)}</b></li>`).join('')
          : `<li class="empty">nobody has found a block yet.</li>`;
        if (first) X.fx.stagger($$('.st-board li, .st-miners li', el), 'in', 45, 150);
        const dd = d.day || {};
        $('.st-day', el).innerHTML = [['blocks found', dd.blocks || 0], ['paid to finders', `${fsol(dd.paid || 0)} SOL`], ['wallets that found one', dd.finders || 0], ['mining right now', `${t.miners || 0} · ${hs(t.rate || 0)}`], ['dev cuts paid, all time', `${fsol(t.dev || 0)} SOL`]].map(([k, v]) => `<dt>${k}</dt><dd>${esc(String(v))}</dd>`).join('');
        const tk = d.tickAt || X.TICK, age = tk ? (Date.now() - tk) / 1000 : null, eng = $('.st-eng', el);
        eng.className = 'st-eng ' + (age == null ? 'off' : age < 180 ? 'ok' : 'late'); $('.st-et', el).textContent = age == null ? 'no pass yet' : `last pass ${ago(tk)} ago`;
        $('.st-new', el).innerHTML = (d.fresh || []).map(b => `<li data-m="${esc(b.mint)}"><img src="${esc(b.img)}" alt=""><b>$${esc(b.symbol)}</b><i>#${b.height}</i><span class="mute">${esc(ago(b.liveAt))}</span></li>`).join('') || '<li class="mute">none yet</li>';
      }
      async function load(first) { try { ST.d = await api('stats'); render(first); } catch (e) { if (first) $('.st-board', el).innerHTML = `<li class="empty">${esc(e.message)}</li>`; } }
      el.addEventListener('click', e => { const li = e.target.closest('li[data-m]'); if (li) X.openMine(li.dataset.m); });
      new ResizeObserver(fit).observe(cv.parentElement);
      X.on('feed', () => { clearTimeout(ST.soon); ST.soon = setTimeout(() => { if (visible('stats')) load(false); }, 3500); });
      ST.load = load; load(true);
      clearInterval(ST.timer); ST.timer = setInterval(() => { if (visible('stats')) load(false); }, 20000);
    },
    open(arg, w) { if (ST.load && w && w.dataset.seen) { ST.t0 = performance.now(); ST.load(true); } if (w) w.dataset.seen = '1'; },
  };
  return A;
}
