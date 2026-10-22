// share.exe: a block as a picture. When your rig finds a block (or you pick any block in chain.exe) this draws a
// 1200×630 card from the real block: the coin, the height, the payout, the hash with its zeros, who found it. Save it,
// copy it, or post it.
export function installShare(X) {
  const { $, $$, esc, fsol, short, SOUND } = X;
  const A = {};
  const S = { el: null, d: null, cv: null, blob: null, busy: 0 };
  const W = 1200, H = 630;
  const load = src => new Promise(res => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  const zeros = hex => { let n = 0; while (n < hex.length && hex[n] === '0') n++; return n; };
  const dur = s => s == null ? '' : s < 1 ? 'under a second' : s < 90 ? Math.round(s) + ' s' : s < 5400 ? Math.round(s / 60) + ' min' : (s / 3600).toFixed(1) + ' h';
  const mineOf = d => (X.MINES || []).find(m => m.mint === d.mint) || {};
  const isMe = d => !!d.miner && (d.miner === (X.RIG && X.RIG.miner) || d.miner === ((X.WAL && X.WAL.current && X.WAL.current()) || {}).address);

  // ---------------------------------------------------------------- the card
  async function draw(d) {
    await Promise.all(['112px PX', '64px PX', '26px JB', '20px JB'].map(f => document.fonts.load(f).catch(() => null)));
    const m = mineOf(d), coin = await load(d.img || m.img || ''), spr = X.SPR && X.SPR.pet;
    const c = S.cv || document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    let sd = 0; for (const ch of String(d.hash || d.mint || 'mine')) sd = (Math.imul(sd, 31) + ch.charCodeAt(0)) >>> 0; sd = sd || 1;
    const rnd = () => (sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0) / 4294967296;
    // rock: drawn small, scaled up so the pixels show
    const k = 4, rw = W / k, rh = H / k, r = document.createElement('canvas'); r.width = rw; r.height = rh; const q = r.getContext('2d');
    const img = q.createImageData(rw, rh);
    for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) { const i = (y * rw + x) * 4, n = rnd(), v = 14 + n * 9 + (y / rh) * 9 + (x / rw) * 10; img.data[i] = v + 6; img.data[i + 1] = v * .72; img.data[i + 2] = v * .5; img.data[i + 3] = 255; }
    q.putImageData(img, 0, 0);
    for (let v = 0; v < 6; v++) { let x = rw * (.45 + rnd() * .55), y = rnd() * rh, a = rnd() * 6.3; for (let i = 0; i < 90; i++) { a += (rnd() - .5) * .6; x += Math.cos(a); y += Math.sin(a) * .7; if (x < 0 || x >= rw || y < 0 || y >= rh) break; q.fillStyle = rnd() < .2 ? '#ffe2a0' : rnd() < .5 ? '#c98a2c' : '#8a5a1c'; q.fillRect(x | 0, y | 0, 1, 1); } }
    g.imageSmoothingEnabled = false; g.drawImage(r, 0, 0, W, H);
    // light from the lamp on the right, dark on the left where the words go
    const lg = g.createRadialGradient(930, 250, 10, 930, 250, 520); lg.addColorStop(0, 'rgba(255,190,100,.30)'); lg.addColorStop(.5, 'rgba(255,160,60,.08)'); lg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = lg; g.fillRect(0, 0, W, H);
    const dg = g.createLinearGradient(0, 0, 760, 0); dg.addColorStop(0, 'rgba(6,4,2,.92)'); dg.addColorStop(.75, 'rgba(6,4,2,.55)'); dg.addColorStop(1, 'rgba(6,4,2,0)'); g.fillStyle = dg; g.fillRect(0, 0, W, H);
    // the miner, big, and the gold flying off the face
    if (spr) { g.save(); g.shadowColor = 'rgba(255,190,90,.55)'; g.shadowBlur = 40; g.drawImage(spr, 790, 150, 300, 300); g.restore(); }
    for (let i = 0; i < 70; i++) { const a = -Math.PI / 2 + (rnd() - .5) * 2.4, dd = 60 + rnd() * 260, x = 950 + Math.cos(a) * dd * 1.2, y = 330 + Math.sin(a) * dd, s = rnd() < .2 ? 12 : rnd() < .5 ? 8 : 5; g.fillStyle = rnd() < .7 ? '#f2c14e' : '#fff1cf'; g.globalAlpha = .35 + rnd() * .65; g.fillRect(x | 0, y | 0, s, s); }
    g.globalAlpha = 1;
    // rails along the floor
    g.fillStyle = 'rgba(120,96,70,.6)'; g.fillRect(0, 520, W, 6); g.fillRect(0, 548, W, 6); g.fillStyle = 'rgba(60,40,24,.85)'; for (let x = 10; x < W; x += 54) g.fillRect(x, 514, 18, 46);
    // the coin
    const sym = d.symbol || m.symbol || '', x0 = 70;
    if (coin) { g.fillStyle = '#000'; g.fillRect(x0 - 4, 56, 104, 104); g.drawImage(coin, x0, 60, 96, 96); g.strokeStyle = '#a8641c'; g.lineWidth = 4; g.strokeRect(x0 - 2, 58, 100, 100); }
    const tx = coin ? x0 + 124 : x0;
    g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    g.font = '64px PX, monospace'; g.fillStyle = '#ffd27a'; g.fillText('$' + sym, tx, 122);
    g.font = '24px JB, monospace'; g.fillStyle = 'rgba(246,232,210,.62)'; g.fillText((m.name || '') + (m.level ? ' · ' + m.level + ' level' : ''), tx, 154);
    if (d.kind === 'mine') {   // a mine, not a block: the coin, what the next block pays, an invitation
      const fresh = !Number(m.blocks || d.blocks || 0);
      g.font = '96px PX, monospace'; g.fillStyle = '#3a2210'; g.fillText(fresh ? 'A NEW MINE' : `BLOCK #${m.height ?? d.height ?? 0} NEXT`, x0 + 5, 292); g.fillStyle = '#fff1cf'; g.fillText(fresh ? 'A NEW MINE' : `BLOCK #${m.height ?? d.height ?? 0} NEXT`, x0, 286);
      const pool = Number(m.pool ?? d.pool ?? 0);
      g.font = '54px PX, monospace'; g.fillStyle = '#ffb347'; g.shadowColor = 'rgba(255,170,60,.6)'; g.shadowBlur = 24; g.fillText(fresh && !pool ? 'block #0 is waiting' : `next block pays ${fsol(pool)} SOL`, x0, 372); g.shadowBlur = 0;
      g.font = '24px JB, monospace'; g.fillStyle = 'rgba(246,232,210,.82)'; g.fillText('your browser mines it. every block pays its finder', x0, 428); g.fillText('the creator fees in the pool, in SOL.', x0, 462);
    } else {
    // the block
    g.font = '118px PX, monospace'; g.fillStyle = '#3a2210'; g.fillText('BLOCK #' + d.height, x0 + 5, 302); g.fillStyle = '#fff1cf'; g.fillText('BLOCK #' + d.height, x0, 296);
    const rew = Number(d.reward || 0);
    g.font = '64px PX, monospace'; g.fillStyle = '#ffb347'; g.shadowColor = 'rgba(255,170,60,.6)'; g.shadowBlur = 24; g.fillText(rew > 0 ? `+${fsol(rew)} SOL` : 'found', x0, 380); g.shadowBlur = 0;
    // the hash, zeros lit
    const hx = String(d.hash || ''), z = zeros(hx), show = hx.slice(0, 32);
    g.font = '26px JB, monospace'; let cx = x0;
    for (let i = 0; i < show.length; i++) { g.fillStyle = i < z ? '#ffd27a' : 'rgba(246,232,210,.55)'; g.fillText(show[i], cx, 436); cx += g.measureText(show[i]).width + (i % 4 === 3 ? 7 : 0); }
    g.fillStyle = 'rgba(246,232,210,.55)'; g.fillText('…', cx, 436);
    g.font = '22px JB, monospace'; g.fillStyle = 'rgba(246,232,210,.8)';
    const who = isMe(d) ? 'found by my browser' : `found by ${short(d.miner || '')}`;
    g.fillText(who + (d.secs != null ? ` in ${dur(Number(d.secs))}` : '') + (z ? ` · ${z} leading zeros` : ''), x0, 474);
    }
    // footer
    g.fillStyle = 'rgba(8,5,2,.88)'; g.fillRect(0, H - 64, W, 64); g.fillStyle = '#6e4520'; g.fillRect(0, H - 64, W, 2);
    if (spr) g.drawImage(spr, 40, H - 58, 52, 52);
    g.font = '40px PX, monospace'; g.fillStyle = '#ffb347'; g.fillText('mine', 104, H - 18);
    g.font = '20px JB, monospace'; g.fillStyle = 'rgba(246,232,210,.7)'; g.fillText('every coin is a mine. your browser mines it.', 218, H - 24);
    g.textAlign = 'right'; g.font = '24px PX, monospace'; g.fillStyle = '#ffd27a'; g.fillText('every block pays SOL', W - 40, H - 22);
    return c;
  }

  // ---------------------------------------------------------------- the window
  const link = d => location.origin + '/?mine=' + encodeURIComponent(d.mint);
  const text = d => { const rew = Number(d.reward || 0), sym = d.symbol || mineOf(d).symbol || '';
    if (d.kind === 'mine') return (d.launched ? `I just opened a mine on Mine: $${sym}. block #0 is waiting. your browser mines it and every block pays SOL ⛏` : `$${sym} is a mine on Mine. your browser mines it and every block pays SOL ⛏`) + '\n\n' + link(d);
    return (isMe(d) ? `my browser just mined block #${d.height} of $${sym} on Mine${rew > 0 ? ` and got paid ${fsol(rew)} SOL` : ''} ⛏` : `block #${d.height} of $${sym} was mined in a browser on Mine${rew > 0 ? ` and paid ${fsol(rew)} SOL` : ''} ⛏`) + '\n\n' + link(d); };
  async function render(d) {
    if (!S.el) return; S.d = d; S.blob = null; const my = ++S.busy;
    $('.sh-st', S.el).textContent = 'drawing…';
    const c = await draw(d); if (my !== S.busy) return;
    c.toBlob(b => { if (my !== S.busy) return; S.blob = b; $('.sh-st', S.el).textContent = ''; }, 'image/png');
    const sym = esc(d.symbol || mineOf(d).symbol || '');
    $('.sh-h', S.el).innerHTML = d.kind === 'mine' ? `<b>$${sym} · the mine</b><small class="dim">${d.launched ? 'your new mine. post it so the first miners find it.' : 'a picture of this mine, from its live numbers.'}</small>` : `<b>$${sym} · block #${esc(d.height)}</b><small class="dim">${isMe(d) ? 'your block. post it, the picture is made from the real block.' : 'any block can be a picture. this one is real, checkable in chain.exe.'}</small>`;
    X.WM.retitle('share', d.kind === 'mine' ? `share.exe — $${d.symbol || mineOf(d).symbol || ''}` : `share.exe — block #${d.height}`);
  }
  const blob = () => S.blob ? Promise.resolve(S.blob) : new Promise(res => S.cv.toBlob(res, 'image/png'));
  const fname = () => `mine-${(S.d.symbol || mineOf(S.d).symbol || 'block').toLowerCase()}${S.d.kind === 'mine' ? '' : '-' + S.d.height}.png`;
  async function save() { const b = await blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = fname(); document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); SOUND.sfx('tick'); }
  async function copyImg() { try { const b = await blob(); await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); X.toast('image copied. paste it into your post.'); SOUND.sfx('ding'); } catch { X.toast('your browser won’t copy images. save it instead.'); } }
  function post() { window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(text(S.d)), '_blank', 'noopener,noreferrer'); }
  async function native() { try { const b = await blob(); const f = new File([b], fname(), { type: 'image/png' }); await navigator.share({ files: [f], text: text(S.d) }); } catch (e) { if (e && e.name !== 'AbortError') X.toast('sharing didn’t work here. save the image instead.'); } }
  const canNative = () => { try { return !!(navigator.canShare && navigator.canShare({ files: [new File([new Blob(['x'])], 'x.png', { type: 'image/png' })] })); } catch { return false; } };

  A.share = {
    title: 'share.exe — your block', short: 'share.exe', icon: 'share', w: 700, h: 560, minW: 420, minH: 360,
    build(el) {
      S.el = el;
      el.innerHTML = `<div class="sh">
        <div class="sh-h"></div>
        <div class="sh-cvw"><canvas class="sh-cv" width="${W}" height="${H}"></canvas><span class="sh-st dim"></span></div>
        <div class="sh-row">
          <button type="button" class="btn go" data-x="post">post on 𝕏 ↗</button>
          <button type="button" class="btn" data-x="copy">copy image</button>
          <button type="button" class="btn" data-x="save">save png</button>
          ${canNative() ? '<button type="button" class="btn ghost" data-x="native">share…</button>' : ''}
        </div>
        <p class="sh-tip dim">copy the image (or save it), press post, then paste it into the post.</p></div>`;
      S.cv = $('.sh-cv', el);
      const acts = { post, copy: copyImg, save, native };
      $$('[data-x]', el).forEach(b => b.onclick = () => acts[b.dataset.x]());
    },
    open(arg) { if (arg && (arg.height != null || arg.kind === 'mine')) render(arg); },
  };
  // anything can ask for a card: rig.exe after a find, chain.exe on any block
  X.shareBlock = d => X.open('share', d);
  return A;
}
