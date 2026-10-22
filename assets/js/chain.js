// chain.exe: every mine's chain, block by block, and a verify button that recomputes each hash in your browser.
import { sha256hex, headerOf } from './rig.js?v=1';

export function installChain(X) {
  const { $, $$, esc, api, fsol, ago, short, solscan, SOUND } = X;
  const A = {};
  const C = { mint: '', data: null, rows: [], q: '', el: null, busy: false };
  const zeros = hex => { let n = 0; while (n < hex.length && hex[n] === '0') n++; return n; };
  const hl = (hex, n = 16) => { const s = String(hex || '').slice(0, n); const z = Math.min(zeros(s), s.length); return `<i>${esc(s.slice(0, z))}</i>${esc(s.slice(z))}`; };
  const big = n => X.big ? X.big(n) : String(n);
  const genesis = mint => sha256hex('mine genesis ' + mint);

  A.chain = {
    title: 'chain.exe — every block, checkable', short: 'chain.exe', icon: 'chain', w: 900, h: 600, minW: 480, minH: 360,
    build(el) {
      C.el = el;
      el.innerHTML = `<div class="ch">
        <aside class="ch-side"><input class="blq ch-q" placeholder="find a $ticker" spellcheck="false"><div class="ch-list scroll"></div></aside>
        <main class="ch-main"><header class="ch-head"></header><div class="ch-sum"></div><div class="ch-blocks scroll"></div></main></div>`;
      $('.ch-q', el).oninput = e => { C.q = e.target.value.trim().toLowerCase().replace(/^\$/, ''); side(); };
      $('.ch-list', el).addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) pick(b.dataset.m); });
      $('.ch-blocks', el).addEventListener('click', e => {
        const v = e.target.closest('[data-v]'); if (v) return verifyOne(+v.dataset.v);
        const mo = e.target.closest('.ch-more'); if (mo) return more();
        const m = e.target.closest('[data-open]'); if (m) return X.openMine(m.dataset.open);
      });
      X.on('mines', side);
      X.on('feed', it => { if (it.kind !== 'block') return; if (C.mint === '' || it.mint === C.mint) { clearTimeout(C.soon); C.soon = setTimeout(() => load(true), 900); } });
      side(); pick(C.mint || '');
    },
    open(arg) { if (arg && arg.mint !== undefined) pick(arg.mint); },
  };

  function side() {
    const box = C.el && $('.ch-list', C.el); if (!box) return;
    let list = (X.MINES || []).filter(m => m.state === 'live');
    if (C.q) list = list.filter(m => m.symbol.toLowerCase().includes(C.q) || m.name.toLowerCase().includes(C.q));
    box.innerHTML = `<button type="button" class="ch-it ${C.mint === '' ? 'on' : ''}" data-m=""><b>every chain</b><small>latest blocks, all mines</small></button>` +
      list.map(m => `<button type="button" class="ch-it ${C.mint === m.mint ? 'on' : ''}" data-m="${esc(m.mint)}"><img src="${esc(m.img)}" alt="" loading="lazy"><b>$${esc(m.symbol)}</b><small>#${m.height} · ${m.blocks} blocks</small></button>`).join('');
  }
  function pick(mint) { C.mint = mint || ''; C.rows = []; C.data = null; side(); load(true); }

  async function load(reset) {
    const el = C.el; if (!el) return;
    try {
      const j = C.mint ? await api('blocks', { params: { mint: C.mint, limit: 30 } }) : await api('blocks', { params: { all: 1, limit: 40 } });
      C.data = j; C.rows = j.blocks || []; C.checked = {};
      head(); render(reset);
    } catch (e) { $('.ch-blocks', el).innerHTML = `<p class="empty bad">${esc(e.message)}</p>`; }
  }
  async function more() {
    if (!C.mint || !C.rows.length) return;
    const before = C.rows[C.rows.length - 1].height; if (before <= 0) return;
    try { const j = await api('blocks', { params: { mint: C.mint, before, limit: 30 } }); C.rows.push(...(j.blocks || [])); render(false); } catch (e) { X.toast(e.message); }
  }
  function head() {
    const el = C.el, d = C.data || {};
    if (!C.mint) {
      $('.ch-head', el).innerHTML = `<div><b class="h3">every chain</b><small class="dim">each coin runs its own chain. a block is a line of text whose SHA-256 starts under the target.</small></div>`;
    } else {
      const m = (X.MINES || []).find(x => x.mint === C.mint) || {};
      $('.ch-head', el).innerHTML = `<img src="${esc(m.img || '')}" alt=""><div><b class="h3">$${esc(d.symbol || m.symbol || '')} chain</b><small class="dim">height #${d.height} · genesis ${esc(String(d.genesis || '').slice(0, 16))}…</small></div>
        <div class="ch-hb"><button type="button" class="btn go" data-x="all">verify this chain</button><button type="button" class="btn" data-open="${esc(C.mint)}">the mine</button><button type="button" class="btn ghost" data-x="rig">⛏ mine it</button></div>`;
      $('[data-x=all]', el).onclick = verifyAll; $('[data-x=rig]', el).onclick = () => X.open('rig', { mint: C.mint }); $('.ch-head [data-open]', el).onclick = () => X.openMine(C.mint);
    }
    $('.ch-sum', el).innerHTML = '';
  }
  function card(b, i) {
    const sym = b.symbol || (C.data && C.data.symbol) || '', reward = Number(b.reward || 0);
    const pay = reward > 0 ? (b.sig ? `<a class="tx gold" href="${esc(solscan(b.sig))}" target="_blank" rel="noopener noreferrer">+${fsol(reward)} SOL · tx ↗</a>` : `<span class="gold">+${fsol(reward)} SOL</span> <span class="mute">sending…</span>`) : `<span class="mute">dry: the pool was still filling</span>`;
    return `<article class="cb" data-i="${i}">
      <div class="cb-h"><span class="cb-n">${C.mint ? '' : `<a class="budl" data-open="${esc(b.mint)}">$${esc(sym)}</a> `}#${b.height}</span><code class="cb-hash">${hl(b.hash, 64)}</code></div>
      <div class="cb-g">
        <span>prev</span><code>${hl(b.prev, 24)}…</code>
        <span>miner</span><code>${esc(short(b.miner))}</code>
        <span>nonce</span><code>${esc(b.nonce)}</code>
        <span>target</span><code>${hl(BigInt(b.target).toString(16).padStart(16, '0'))}</code>
        <span>found in</span><code>${b.secs != null ? Number(b.secs).toFixed(1) + ' s' : '—'} · ${esc(ago(b.at))} ago</code>
        <span>paid</span><span>${pay}</span>
      </div>
      <div class="cb-v"><button type="button" class="chip" data-v="${i}">verify</button><span class="cb-res"></span></div>
    </article>`;
  }
  function render(anim) {
    const box = $('.ch-blocks', C.el);
    if (!C.rows.length) { box.innerHTML = `<div class="empty">${C.mint ? 'no blocks on this chain yet. block #0 is waiting to be found.' : 'no blocks yet anywhere. the first miner in takes block #0.'}<br><br><button type="button" class="btn go" data-x="mine">⛏ start mining</button></div>`; $('[data-x=mine]', box).onclick = () => X.open('rig', C.mint ? { mint: C.mint } : undefined); return; }
    box.innerHTML = C.rows.map(card).join('') + (C.mint && C.rows[C.rows.length - 1].height > 0 ? `<button type="button" class="btn ghost ch-more">load older blocks</button>` : C.mint ? `<div class="cb-gen"><code>genesis</code> sha256("mine genesis ${esc(C.mint)}")</div>` : '');
    if (anim && X.fx) X.fx.stagger($$('.cb', box), 'in', 30, 40);
  }

  // ---------------------------------------------------------------- verify: recompute in the browser, no trust needed
  async function check(i) {
    const b = C.rows[i]; const mint = b.mint || C.mint;
    const line = headerOf(mint, b.height, b.prev, b.miner, b.nonce);
    const h = await sha256hex(line);
    const hashOk = h === b.hash;
    const under = BigInt('0x' + h.slice(0, 16)) < BigInt(b.target);
    let linkOk = null, linkWhy = '';
    if (b.height === 0) { linkOk = b.prev === await genesis(mint); linkWhy = 'block #0 points at the genesis hash'; }
    else { const older = C.rows.find(r => (r.mint || C.mint) === mint && r.height === b.height - 1); if (older) { linkOk = b.prev === older.hash; linkWhy = `prev is block #${b.height - 1}’s hash`; } }
    return { line, h, hashOk, under, linkOk, linkWhy, ok: hashOk && under && linkOk !== false };
  }
  async function verifyOne(i) {
    const cardEl = $(`.cb[data-i="${i}"]`, C.el); if (!cardEl) return;
    const res = $('.cb-res', cardEl); res.innerHTML = '<span class="dim">hashing…</span>';
    const r = await check(i);
    const ln = (ok, t) => `<div class="${ok === null ? 'dim' : ok ? 'ok' : 'bad'}">${ok === null ? '·' : ok ? '✓' : '✗'} ${esc(t)}</div>`;
    res.innerHTML = `<div class="cb-line"><span class="dim">sha256(</span><code>${esc(r.line)}</code><span class="dim">)</span></div><div class="cb-line"><span class="dim">=</span> <code>${hl(r.h, 64)}</code></div>` +
      ln(r.hashOk, 'the hash matches the line above') + ln(r.under, 'its first 8 bytes are under the target') + ln(r.linkOk, r.linkOk === null ? 'load the block before it to check the link' : r.linkWhy);
    cardEl.classList.remove('good', 'badv'); void cardEl.offsetWidth; cardEl.classList.add(r.ok ? 'good' : 'badv');
    SOUND.sfx(r.ok ? 'tick' : 'hurt');
    return r;
  }
  async function verifyAll() {
    if (C.busy || !C.rows.length) return; C.busy = true;
    const sum = $('.ch-sum', C.el); let good = 0, bad = 0;
    for (let i = 0; i < C.rows.length; i++) {
      const r = await check(i); r.ok ? good++ : bad++;
      const cardEl = $(`.cb[data-i="${i}"]`, C.el); if (cardEl) { cardEl.classList.remove('good', 'badv'); void cardEl.offsetWidth; cardEl.classList.add(r.ok ? 'good' : 'badv'); const res = $('.cb-res', cardEl); res.innerHTML = `<div class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓ hash, target and link check out' : '✗ this block fails a check'}</div>`; }
      sum.innerHTML = `<span class="dim">checking block ${i + 1} of ${C.rows.length}…</span>`;
      if (i % 3 === 0) { SOUND.sfx('tick'); await new Promise(r2 => setTimeout(r2, 40)); }
    }
    sum.innerHTML = bad ? `<span class="bad">✗ ${bad} of ${C.rows.length} blocks failed a check.</span>` : `<span class="ok">✓ ${good} blocks checked in your browser: every hash matches its line, every hash is under its target, every block points at the one before it.</span>`;
    if (!bad) SOUND.sfx('ding');
    C.busy = false;
  }
  return A;
}
