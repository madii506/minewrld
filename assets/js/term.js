// miner.sh: a real terminal. Every command that shows numbers reads the live engine; nothing here is made up.
import { sha256hex, headerOf } from './rig.js?v=2';
export function installTerm(X) {
  const { esc, api, fsol, ftok, ago, short, solscan, pumpfun, acct, SOUND } = X;
  let out, inp, wrap, hist = [], hi = 0, follow = null, booted = false, busy = false;
  try { hist = JSON.parse(X.ls.get('mw:hist') || '[]'); } catch {}
  const PS = () => `<span class="ps"><b>miner</b>@mine:<i>~</i>$</span> `;
  function print(html, cls) {
    const d = document.createElement('div'); d.className = 'tl' + (cls ? ' ' + cls : ''); d.innerHTML = html; out.appendChild(d);
    while (out.children.length > 600) out.firstChild.remove();
    out.scrollTop = out.scrollHeight; return d;
  }
  const say = (t, cls) => print(esc(t), cls);
  const blank = () => print('&nbsp;');
  async function slow(lines, ms = 14) { for (const l of lines) { typeof l === 'string' ? print(l) : print(l[0], l[1]); if (ms && !X.RM) await X.sleep(ms); } }
  const pad = (s, n) => { s = String(s); return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length); };
  const lpad = (s, n) => { s = String(s); return s.length >= n ? s : ' '.repeat(n - s.length) + s; };
  const link = (href, text) => `<a class="tx" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`;
  const mineLink = m => `<a class="budl" data-bud="${esc(m.mint)}">$${esc(m.symbol)}</a>`;
  const lvl = l => `<span class="lvl ${esc(l)}">${esc(l)}</span>`;
  const bar = (k, w = 20, ch = '█') => ch.repeat(Math.round(k * w)) + '<span class="mute">' + '░'.repeat(w - Math.round(k * w)) + '</span>';
  const stopFollow = () => { if (follow) { follow(); follow = null; say('^C', 'dim'); } };
  const hs = n => X.hs ? X.hs(n) : String(n), big = n => X.big ? X.big(n) : String(n);
  const zl = hex => { let z = 0; while (hex[z] === '0') z++; return `<span class="am">${esc(hex.slice(0, z))}</span>${esc(hex.slice(z))}`; };
  const feedLine = (it, clock) => `<span class="mute">${clock ? new Date(it.at).toTimeString().slice(0, 8) : esc(lpad(ago(it.at), 4))}</span>  <a class="budl" data-bud="${esc(it.mint)}">${esc(pad('$' + it.symbol, 10))}</a> <span class="k-${esc(it.kind)}">${esc(pad(it.kind, 7))}</span>${esc(it.text)}${it.sig ? '  ' + link(solscan(it.sig), 'tx ↗') : ''}`;

  // ---------------------------------------------------------------- commands
  const C = {};
  const add = (names, help, fn, group = 'mines') => names.split(' ').forEach((n, i) => C[n] = { fn, help: i ? null : help, group, name: n });

  add('help ?', 'this list', () => {
    const groups = {};
    for (const k in C) if (C[k].help) (groups[C[k].group] = groups[C[k].group] || []).push(C[k]);
    for (const g of ['mines', 'chain', 'launch', 'wallet', 'system', 'fun']) {
      if (!groups[g]) continue; print(`<span class="hl">${g}</span>`);
      groups[g].forEach(c => print(`  <span class="ok">${esc(pad(c.name + (c.args ? ' ' + c.args : ''), 24))}</span><span class="dim">${esc(c.help)}</span>`));
    }
    print('<span class="dim">tab completes. ↑ ↓ for history. ctrl+c stops a follow. ` toggles this window.</span>');
  }, 'system');

  add('veins mines ls', 'every open mine (try: veins top, veins active)', async a => {
    const sort = ['top', 'active', 'recent', 'pool'].includes(a[0]) ? a[0] : 'pool';
    const j = await api('veins', { params: { sort, limit: 40 } });
    if (!j.veins.length) return print('<span class="dim">no mines yet. the mountain is quiet. type</span> <span class="ok">launch</span> <span class="dim">to open the first one.</span>');
    if (out.clientWidth < 620) { j.veins.forEach(m => print(`${mineLink(m)} <span class="dim">#${m.height}</span> ${lvl(m.level)} <span class="am">${fsol(m.pool)} SOL</span> <span class="dim">${m.miners} mining</span>`)); return; }
    print(`<span class="dim">${esc(pad('coin', 11))}${esc(pad('height', 8))}${esc(pad('level', 10))}${esc(lpad('pool', 10))}${esc(lpad('paid', 10))}  miners</span>`);
    j.veins.forEach(m => print(`${mineLink(m)}${esc(' '.repeat(Math.max(1, 10 - m.symbol.length)))}${esc(pad('#' + m.height, 8))}${lvl(m.level)}${esc(' '.repeat(Math.max(1, 10 - m.level.length - 2)))}<span class="am">${esc(lpad(fsol(m.pool), 10))}</span>${esc(lpad(fsol(m.paid), 10))}  <span class="dim">${m.miners}${m.rate ? ' · ' + hs(m.rate) : ''}</span>`));
    print(`<span class="dim">${j.veins.length} shown · ${j.totals.mines} open · click a ticker to open its mine</span>`);
  });
  C.veins.args = '[top|active]';

  async function findMine(key) {
    if (!key) throw new Error('which mine? try: mine $TICKER');
    const m = X.mineBy(key); if (m) return m;
    const j = await api('vein', { params: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(key) ? { mint: key } : { id: key } }).catch(() => null);
    if (j && j.vein) return j.vein;
    throw new Error(`no mine called "${key}". type veins to see them all.`);
  }
  add('mine info', 'one mine: its pool, its chain, its last blocks', async a => {
    const m0 = await findMine(a[0]); const j = await api('vein', { params: { id: m0.id } }); const m = j.vein;
    print(`<img class="tav" src="${esc(m.img)}" alt=""><span class="hl big">$${esc(m.symbol)}</span>  <span class="dim">${esc(m.name)}</span> ${lvl(m.level)}`);
    print(`<span class="dim">next block pays </span><span class="am">${fsol(m.pool)} SOL</span>   <span class="dim">height</span> #${m.height}   <span class="dim">a block takes</span> ~${big(m.expected)} hashes`);
    print(`<span class="dim">paid to miners  </span><span class="am">${fsol(m.paid)} SOL</span>   <span class="dim">claimed</span> ${fsol(m.claimed)} SOL   <span class="dim">dev cut</span> ${m.devCut}% <span class="mute">(locked)</span>`);
    print(`<span class="dim">mining now      </span>${m.miners}${m.rate ? ' · ' + hs(m.rate) : ''}   <span class="dim">last block</span> ${m.lastBlockAt ? ago(m.lastBlockAt) + ' ago' : '—'}`);
    print(`<span class="dim">links           </span>${link(pumpfun(m.mint), 'pump.fun')} · ${link(acct(m.wallet), 'the mine’s wallet')} · ${link(acct(m.mint), 'the mint')}`);
    if (j.blocks.length) { blank(); print('<span class="hl">last blocks</span>'); j.blocks.slice(0, 6).forEach(b => print(`  <span class="ok">#${esc(lpad(b.height, 4))}</span>  ${zl(b.hash.slice(0, 20))}…  <span class="dim">${esc(short(b.miner))}</span>  ${b.reward > 0 ? `<span class="am">+${fsol(b.reward)}</span>` : '<span class="mute">dry</span>'}${b.sig ? '  ' + link(solscan(b.sig), 'tx ↗') : ''}`)); }
    print(`<span class="dim">type</span> <span class="ok">rig $${esc(m.symbol)}</span> <span class="dim">to mine it.</span>`);
  });
  C.mine.args = '<$TICKER>';
  add('rig dig', 'open rig.exe on a mine and start digging', async a => { const m = a[0] ? await findMine(a[0]) : null; X.open('rig', m ? { mint: m.mint } : undefined); say(m ? `rig.exe is pointed at $${m.symbol}. press start.` : 'opening rig.exe …', 'dim'); });
  C.rig.args = '[$TICKER]';
  add('watch tail', 'follow one mine live (ctrl+c to stop)', async a => {
    const m = await findMine(a[0]); stopFollow();
    print(`<span class="dim">watching</span> ${mineLink(m)} <span class="dim">… blocks and claims appear as they land. ctrl+c stops.</span>`);
    const off = X.on('feed', it => { if (it.mint === m.mint) print(feedLine(it, true)); });
    const t = setInterval(() => X.refresh(), 5000);
    follow = () => { off(); clearInterval(t); };
  });
  C.watch.args = '<$TICKER>';
  add('feed log', 'the latest across every mine (feed -f to follow)', async a => {
    const j = await api('feed');
    if (!j.items.length) return say('nothing yet. the mountain is quiet.', 'dim');
    j.items.slice(0, 16).reverse().forEach(it => print(feedLine(it)));
    if (a[0] === '-f') { stopFollow(); say('following… ctrl+c stops.', 'dim');
      const off = X.on('feed', it => print(feedLine(it, true)));
      const t = setInterval(() => X.refresh(), 5000); follow = () => { off(); clearInterval(t); }; }
  });
  add('stats top', 'the whole mountain in numbers', async () => {
    const j = await api('veins', { params: { limit: 1 } }); const t = j.totals || {};
    const rows = [['mines open', t.mines], ['blocks found', t.blocks], ['paid to finders', fsol(t.paid) + ' SOL'], ['fees claimed', fsol(t.claimed) + ' SOL'], ['waiting in pools', fsol(t.pool) + ' SOL'], ['dev cuts paid', fsol(t.dev) + ' SOL'], ['mining right now', `${t.miners} · ${hs(t.rate || 0)}`]];
    await slow(rows.map(([k, v]) => `<span class="dim">${esc(pad(k, 22))}</span><span class="am">${esc(String(v ?? '—'))}</span>`), 40);
    print(`<span class="dim">${esc(pad('engine', 22))}</span>${j.tickAt ? 'last pass ' + ago(j.tickAt) + ' ago' : 'no pass yet'}`);
  });
  add('dash dashboard', 'open stats.exe', () => X.open('stats'));
  add('mountain map', 'open mountain.exe: every mine, live', () => X.open('mountain'));
  add('share', 'make a picture of a mine to post', (args) => { const m = X.mineBy((args && args[0]) || '') || (X.MINES || [])[0]; if (!m) return say('no mines yet. launch one first.', 'dim'); X.shareBlock({ kind: 'mine', mint: m.mint, id: m.id, symbol: m.symbol, img: m.img, pool: m.pool, blocks: m.blocks, height: m.height }); say(`drew $${m.symbol}. look in share.exe.`, 'ok'); });
  C.share.args = '[$TICKER]';

  add('blocks chain', 'a mine’s chain, newest first', async a => {
    const m = await findMine(a[0]); const j = await api('blocks', { params: { mint: m.mint, limit: 16 } });
    if (!j.blocks.length) return say(`no blocks on $${m.symbol} yet. block #0 is waiting.`, 'dim');
    print(`<span class="dim">$${esc(m.symbol)} · height #${j.height} · genesis</span> ${esc(j.genesis.slice(0, 16))}…`);
    j.blocks.forEach(b => print(`  <span class="ok">#${esc(lpad(b.height, 4))}</span>  ${zl(b.hash.slice(0, 24))}…  <span class="dim">nonce</span> ${esc(b.nonce)}  <span class="dim">${esc(short(b.miner))}</span>  ${b.reward > 0 ? `<span class="am">+${fsol(b.reward)}</span>` : '<span class="mute">dry</span>'}`));
    print(`<span class="dim">check one yourself:</span> <span class="ok">verify $${esc(m.symbol)} ${j.blocks[0].height}</span>`);
  }, 'chain');
  C.blocks.args = '<$TICKER>';
  add('verify check', 'recompute a block’s hash right here', async a => {
    const m = await findMine(a[0]); const j = await api('blocks', { params: { mint: m.mint, limit: 40 } });
    const h = a[1] != null ? Number(String(a[1]).replace('#', '')) : (j.blocks[0] && j.blocks[0].height);
    const b = j.blocks.find(x => x.height === h); if (!b) return say(`block #${a[1]} isn’t in the last 40 of $${m.symbol}.`, 'bad');
    const line = headerOf(m.mint, b.height, b.prev, b.miner, b.nonce);
    print(`<span class="dim">sha256(</span>${esc(line)}<span class="dim">)</span>`);
    const got = await sha256hex(line); await X.sleep(220);
    print(`<span class="dim">=</span> ${zl(got)}`);
    const ok1 = got === b.hash, ok2 = BigInt('0x' + got.slice(0, 16)) < BigInt(b.target);
    print(`${ok1 ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'} matches the hash the chain recorded`);
    print(`${ok2 ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'} first 8 bytes ${got.slice(0, 16)} < target ${BigInt(b.target).toString(16).padStart(16, '0')}`);
    if (b.height === 0) { const g = await sha256hex('mine genesis ' + m.mint); print(`${g === b.prev ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'} prev is the genesis hash`); }
    else { const o = j.blocks.find(x => x.height === b.height - 1); if (o) print(`${o.hash === b.prev ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'} prev is block #${o.height}’s hash`); }
    if (b.sig) print(`<span class="dim">the payout’s memo carries this hash:</span> ${link(solscan(b.sig), 'tx ↗')}`);
  }, 'chain');
  C.verify.args = '<$TICKER> [height]';
  add('hash sha256', 'sha256 of any text: hash hello', async a => { const t = a.join(' '); const h = await sha256hex(t); print(`${zl(h)}`); }, 'chain');
  C.hash.args = '<text>';

  add('launch new', 'open launch.exe (launch NAME TICKER pre-fills it)', a => { X.open('launch', a.length ? { name: a.slice(0, -1).join(' ') || a[0], symbol: a.length > 1 ? a[a.length - 1] : '' } : undefined); say('opening launch.exe …', 'dim'); }, 'launch');
  C.launch.args = '[name ticker]';
  add('cut', 'what a dev cut does with 1 SOL of fees: cut 10', a => {
    const cap = (X.CFG && X.CFG.devCap) || 30; let v = Number(a[0]); if (!Number.isFinite(v)) { v = 10; say('no cut given, showing 10%', 'dim'); }
    if (v < 0 || v > cap) return say(`the dev cut is 0–${cap}%.`, 'bad');
    print('<span class="dim">for every 1 SOL of creator fees the mine claims:</span>');
    print(`  <span class="k-block">pool</span>  ${bar((100 - v) / 100)} <span class="am">${((100 - v) / 100).toFixed(2)} SOL</span> <span class="dim">to whoever finds the next block</span>`);
    print(`  <span class="k-dev">dev </span>  ${bar(v / 100)} <span class="am">${(v / 100).toFixed(2)} SOL</span> <span class="dim">to the launcher</span>`);
  }, 'launch');
  C.cut.args = '<percent>';
  add('fees cost', 'what a launch costs (fees 0.5 shows it with a 0.5 SOL first buy)', a => {
    const c = X.CFG || { fee: .05, createSol: .03, reserveSol: .015 }; const dev = Math.max(c.minDev || .01, Number(a[0]) || .1);
    const rows = [['launch fee', c.fee], ['pump.fun create (unused part comes back)', c.createSol], [`first buy (${dev} SOL + 2% slippage room)`, +(dev * 1.02).toFixed(4)], ['the mine’s gas tank (stays with it)', c.reserveSol]];
    rows.forEach(([k, v]) => print(`<span class="dim">${esc(pad(k, 46))}</span><span class="am">${esc(lpad(v.toFixed(4), 8))} SOL</span>`));
    print(`<span class="hl">${esc(pad('total, one transfer', 46))}${esc(lpad(rows.reduce((s, r) => s + r[1], 0).toFixed(4), 8))} SOL</span>`);
  }, 'launch');
  C.fees.args = '[first buy]';
  add('levels', 'how deep a mine goes', () => {
    const L = (X.CFG && X.CFG.levels) || [['shallow', 0], ['deep', 25], ['deeper', 250], ['bedrock', 2500]];
    L.forEach(([n, m]) => print(`${lvl(n)}  <span class="dim">from</span> <span class="am">${m}</span> <span class="dim">blocks found</span>`));
  }, 'launch');
  add('rules', 'who can mine, and how often', () => {
    const c = X.CFG || {};
    ['to mine a coin, hold 100,000 of it (0.01% of the supply).', `a wallet that found one of the last ${c.cooldown || 4} blocks sits out the next one.`, 'the chain retunes toward one block a minute. no block for 90 s and the target eases.', `a block pays the whole pool when it holds ${c.minPay || .0005} SOL or more.`, 'no account, no signature: you give an address to be paid at.'].forEach(l => say('· ' + l));
  }, 'launch');

  add('connect login', 'connect a wallet', async () => { const w = await X.connect(); say(`connected: ${w.address}`, 'ok'); }, 'wallet');
  add('disconnect logout', 'disconnect the wallet', async () => { await X.WAL.disconnect(); say('disconnected.', 'dim'); }, 'wallet');
  add('whoami', 'your wallet, if connected', () => { const w = X.WAL.current(); say(w ? w.address : 'a miner. (no wallet connected)', w ? 'ok' : 'dim'); }, 'wallet');
  add('mymines', 'the mines you opened', async () => {
    const w = X.WAL.current(); if (!w) return say('connect a wallet first: type connect', 'warn');
    const j = await api('veins', { params: { owner: w.address } });
    if (!j.veins.length) return say('you haven’t opened a mine yet. type launch.', 'dim');
    j.veins.forEach(m => print(`${mineLink(m)}  <span class="dim">${esc(m.state)}</span>  ${lvl(m.level)}  <span class="am">${fsol(m.devPaid)} SOL</span> <span class="dim">paid to you</span>`));
  }, 'wallet');

  add('engine status', 'the engine: when it last ran, what it does', async () => {
    const j = await api('veins', { params: { limit: 1 } });
    print(`<span class="dim">last pass   </span>${j.tickAt ? `<span class="ok">${ago(j.tickAt)} ago</span>` : '<span class="warn">none yet</span>'}`);
    print('<span class="dim">schedule    </span>every minute, around the clock');
    print('<span class="dim">each pass   </span>claim each coin’s creator fees → dev cut to the launcher → the rest into the pool for the next block');
    print('<span class="dim">a block     </span>checked on arrival, then the pool is paid to its finder in one transaction with the hash in the memo');
    print('<span class="dim">custody     </span>each mine is a wallet held by this engine. it can claim, pay the dev and pay finders. it cannot sell.');
  }, 'system');
  const APPMAP = { mountain: 'mountain', 'mountain.exe': 'mountain', share: 'share', terminal: 'term', term: 'term', launch: 'launch', veins: 'veins', mines: 'veins', rig: 'rig', 'rig.exe': 'rig', chain: 'chain', 'chain.exe': 'chain', ledger: 'ledger', readme: 'readme', stats: 'stats', 'stats.exe': 'stats', dash: 'stats', paint: 'paint', display: 'display', bin: 'bin' };
  add('open run', 'open a window: open chain', a => { const m = APPMAP[a[0]]; if (!m) return say('open what? rig, launch, veins, chain, stats, ledger, readme, paint, display', 'dim'); X.open(m); }, 'system');
  C.open.args = '<app>';
  add('dir', 'list files', () => print(['readme.txt', 'rig.exe', 'launch.exe', 'chain.exe', 'stats.exe', 'paint.exe', 'ledger.db', '<span class="mute">sleep.exe (deleted)</span>'].map(f => `<span class="ok">${f}</span>`).join('   ')), 'system');
  add('cat type', 'print a file', a => {
    if (!a[0]) return say('cat what?', 'dim');
    if (/readme/.test(a[0])) { ['every coin is a mine.', 'launch a coin here and its creator wallet is the mine. every minute the engine claims the creator fees into the pool.', 'browsers mine the coin’s own chain: sha256 of a line of text, under a target.', 'find the next block and the whole pool is yours, paid on solana with the hash in the memo.', 'open readme.txt for the long version.'].forEach(l => say(l)); return; }
    if (/sleep/.test(a[0])) return say('cat: sleep.exe: no such file. the mine never closes.', 'bad');
    say(`cat: ${a[0]}: binary file. try opening it.`, 'dim');
  }, 'system');
  add('date time', 'the time', () => say(new Date().toString()), 'system');
  add('echo', 'say it back', a => say(a.join(' ')), 'system');
  add('history', 'what you typed', () => hist.slice(-20).forEach((h, i) => say(`${lpad(i + 1, 3)}  ${h}`, 'dim')), 'system');
  add('clear cls', 'clear the screen', () => { out.innerHTML = ''; }, 'system');
  add('ping', 'how fast the engine answers', async () => { const t0 = performance.now(); await api('config'); say(`pong from the engine in ${Math.round(performance.now() - t0)} ms`, 'ok'); }, 'system');
  add('minefetch neofetch', 'about this machine', () => {
    const t = X.TOTALS || {};
    print(`<img class="tav big" src="${X.avatarURL('minefetch', 96)}" alt=""><div class="fetch">${[['os', 'Mine OS 1.0 (deep shift)'], ['host', 'the mountain'], ['cpu', `sha-256 × ${navigator.hardwareConcurrency || '?'} cores`], ['uptime', 'since the first lantern'], ['mines', String(t.mines ?? '—') + ' open'], ['paid', fsol(t.paid) + ' SOL to finders'], ['sleep', 'not found']].map(([k, v]) => `<div><span class="ok">${k}</span><span class="dim">:</span> ${esc(v)}</div>`).join('')}<div class="sw">${['#1a0f06', '#6e3a1f', '#a8641c', '#ffb347', '#f2c14e', '#fff1cf'].map(c => `<i style="background:${c}"></i>`).join('')}</div></div>`, 'fetchl');
  }, 'system');
  add('exit quit', 'close the terminal', () => X.WM.close('term'), 'system');
  add('pet', 'let a miner out onto the taskbar', a => { X.emit('pet:spawn', a[0] || null); say('a miner climbed onto the taskbar.', 'ok'); }, 'fun');
  add('pickaxe swing', 'swing the pickaxe', async () => {
    const F = ['   ⛏', '    \\', '  ___\\___', ' /  ·  · \\  *tink*', ' \\ gold?  /', '  ‾‾‾‾‾‾‾'];
    for (let i = 0; i < F.length; i++) { print(`<span class="am">${esc(F[i])}</span>`); await X.sleep(220); }
    SOUND.sfx('pick');
  }, 'fun');
  add('matrix rain', 'hex rain', async () => {
    const d = print('', 'rainbox'); const cols = 64; let n = 0;
    const id = setInterval(() => { d.textContent = Array.from({ length: 10 }, () => Array.from({ length: cols }, () => Math.random() < .14 ? '0123456789abcdef⛏'[Math.random() * 17 | 0] : ' ').join('')).join('\n'); if (++n > 40) { clearInterval(id); d.remove(); } }, 80);
  }, 'fun');
  add('sudo', null, () => say('no root here. only rock.', 'dim'), 'fun');
  add('sleep', 'try it', () => say('the mine never closes.', 'bad'), 'fun');
  add('sell', null, () => say('miners don’t sell. they dig.', 'warn'), 'fun');
  add('rug', null, () => say('not in this mine.', 'warn'), 'fun');
  add('gm', null, () => say('gm. the lanterns never went out.', 'ok'), 'fun');
  add('wen', null, () => say('next block.', 'ok'), 'fun');

  // ---------------------------------------------------------------- input
  async function run(raw) {
    const line = raw.trim(); print(PS() + `<span class="cmd">${esc(raw)}</span>`);
    if (!line) return;
    hist.push(line); hist = hist.slice(-80); hi = hist.length; X.ls.set('mw:hist', JSON.stringify(hist));
    const [name, ...args] = line.split(/\s+/); const c = C[name.toLowerCase()];
    if (!c) return say(`${name}: command not found. type help.`, 'bad');
    busy = true; inp.disabled = true;
    try { await c.fn(args); } catch (e) { say(e.message || String(e), 'bad'); }
    busy = false; inp.disabled = false; if (X.WM.isOpen('term')) inp.focus();
  }
  function complete() {
    const v = inp.value, parts = v.split(/\s+/);
    const pool = parts.length > 1 ? (X.MINES || []).map(m => '$' + m.symbol) : Object.keys(C);
    const last = parts[parts.length - 1].toLowerCase(), hits = pool.filter(p => p.toLowerCase().startsWith(last));
    if (hits.length === 1) { parts[parts.length - 1] = hits[0]; inp.value = parts.join(' ') + ' '; }
    else if (hits.length > 1) print(hits.slice(0, 30).map(h => `<span class="ok">${esc(h)}</span>`).join('  '));
  }
  async function bootText() {
    if (booted) return; booted = true;
    await slow([
      `<img class="tav big" src="${X.avatarURL('term', 64)}" alt=""><span class="hl big">miner.sh</span> <span class="dim">· Mine OS terminal · deep shift</span>`,
      '<span class="dim">every coin is a mine. your browser mines it. every block pays SOL.</span>',
      `<span class="dim">type</span> <span class="ok">help</span><span class="dim">, or try</span> <span class="ok">veins</span><span class="dim">,</span> <span class="ok">stats</span><span class="dim">,</span> <span class="ok">feed -f</span><span class="dim">,</span> <span class="ok">blocks $TICKER</span><span class="dim">,</span> <span class="ok">verify $TICKER</span><span class="dim">,</span> <span class="ok">rig</span>`,
      '&nbsp;'], 60);
  }
  return {
    term: {
      title: 'miner.sh — terminal', short: 'miner.sh', icon: 'term', w: 820, h: 500, minW: 360, minH: 220, cls: 'termw',
      build(el) {
        el.innerHTML = `<div class="term"><div class="tout scroll"></div><label class="tin">${PS()}<input type="text" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="command"></label></div>`;
        out = el.querySelector('.tout'); inp = el.querySelector('input'); wrap = el.querySelector('.term');
        wrap.addEventListener('pointerup', () => { if (!getSelection().toString()) inp.focus(); });
        out.addEventListener('click', e => { const a = e.target.closest('.budl'); if (a) { e.preventDefault(); X.openBud(a.dataset.bud); } });
        inp.addEventListener('keydown', e => {
          if (e.key !== 'Tab') SOUND.sfx('key');
          if (e.key === 'Enter') { const v = inp.value; inp.value = ''; run(v); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); hi = Math.max(0, hi - 1); inp.value = hist[hi] || ''; }
          else if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hist.length, hi + 1); inp.value = hist[hi] || ''; }
          else if (e.key === 'Tab') { e.preventDefault(); complete(); }
          else if ((e.key === 'c' || e.key === 'C') && e.ctrlKey && !getSelection().toString()) { e.preventDefault(); stopFollow(); inp.value = ''; }
          else if ((e.key === 'l' || e.key === 'L') && e.ctrlKey) { e.preventDefault(); out.innerHTML = ''; }
        });
      },
      async open(arg) { await bootText(); if (typeof arg === 'string' && arg) run(arg); setTimeout(() => inp && inp.focus(), 60); },
      focus() { setTimeout(() => inp && !busy && inp.focus(), 0); },
      close() { stopFollow(); },
    },
  };
}
