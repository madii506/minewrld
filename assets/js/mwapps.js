// Mine windows: welcome, launch.exe, veins (every mine), a window per mine, the ledger, readme, display, recycle bin.
import { installMore } from './apps2.js?v=1';
import { installRig } from './rig.js?v=1';
import { installChain } from './chain.js?v=1';
import { installStats } from './mwstats.js?v=1';

export function installApps(X) {
  const { $, $$, esc, api, fsol, ftok, ago, short, solscan, pumpfun, acct, SOUND, ICONS, WAL } = X;
  const link = (href, text, cls = 'tx') => `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`;
  const lvl = l => `<span class="lvl ${esc(l)}">${esc(l)}</span>`;
  const hs = n => { n = Number(n || 0); return n >= 1e9 ? (n / 1e9).toFixed(2) + ' GH/s' : n >= 1e6 ? (n / 1e6).toFixed(2) + ' MH/s' : n >= 1e3 ? (n / 1e3).toFixed(1) + ' kH/s' : Math.round(n) + ' H/s'; };
  const big = n => { n = Number(n || 0); return n >= 1e12 ? (n / 1e12).toFixed(1) + 'T' : n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(Math.round(n)); };
  X.hs = hs; X.big = big; X.link = link;
  const A = {};

  // ================================================================ welcome
  A.welcome = {
    title: 'welcome to Mine', short: 'welcome', icon: 'welcome', w: 620, h: 500, nomax: true,
    build(el) {
      el.innerHTML = `<div class="wel">
        <div class="wel-hero"><canvas class="wel-bud" width="96" height="96"></canvas><div><h2 class="h">every coin is a mine.</h2><p class="sub">your browser mines it. every block pays SOL.</p></div></div>
        <ol class="wel-how">
          <li><b>1</b><span><i>launch a coin</i> on pump.fun, right here. it opens a mine: the coin’s creator is the mine’s wallet.</span></li>
          <li><b>2</b><span><i>the fees fill the pool.</i> every minute the engine claims the coin’s creator fees into it.</span></li>
          <li><b>3</b><span><i>browsers mine the coin’s own chain.</i> find a hash under the target and the whole pool is yours, paid on solana.</span></li>
        </ol>
        <div class="wel-live"><div class="wel-last"><span class="dot on"></span><span class="wel-lt">waiting for the next block…</span></div></div>
        <div class="wel-stats">${[['mines', 'mines open'], ['blocks', 'blocks found'], ['paid', 'paid to miners'], ['miners', 'mining now']].map(([k, t]) => `<div><b data-k="${k}">0</b><span>${t}</span></div>`).join('')}</div>
        <div class="wel-go"><button class="btn go" data-o="rig">start mining</button><button class="btn" data-o="launch">launch a coin</button><button class="btn" data-o="chain">see the chain</button></div>
        <label class="wel-no"><input type="checkbox"> don’t show this again</label></div>`;
      $$('[data-o]', el).forEach(b => b.onclick = () => { X.open(b.dataset.o); });
      const cb = $('.wel-no input', el); cb.checked = X.ls.get('mw:nowelcome') === '1'; cb.onchange = () => X.ls.set('mw:nowelcome', cb.checked ? '1' : '0');
      const fmt = { mines: v => String(Math.round(v)), blocks: v => String(Math.round(v)), paid: v => fsol(v) + ' SOL', miners: v => String(Math.round(v)) };
      const stats = () => { const t = X.TOTALS || {}; $$('.wel-stats b', el).forEach(b => X.fx.countTo(b, t[b.dataset.k] || 0, fmt[b.dataset.k], 1100)); };
      stats(); X.on('mines', stats);
      const lastLine = it => X.fx.typeInto($('.wel-lt', el), `$${it.symbol}: ${it.text}`, 70);
      const prime = () => { const r = (X.RECENT || []).find(i => i.kind === 'block') || (X.RECENT || [])[0]; if (r) lastLine(r); };
      if ((X.RECENT || []).length) prime(); else X.on('feedinit', () => setTimeout(prime, 50));
      X.on('feed', it => { if (['block', 'launch'].includes(it.kind)) lastLine(it); });
      $('.wel-last', el).onclick = () => X.open('chain');
      const c = $('.wel-bud', el), g = c.getContext('2d'); let t = 0;
      const draw = () => { if (!document.body.contains(c)) return; t++; g.clearRect(0, 0, 96, 96); g.imageSmoothingEnabled = false; const img = X.SPR.pet; if (img) { const y = Math.round(Math.sin(t / 14)) * 2; g.drawImage(img, 0, y, 96, 96); } requestAnimationFrame(draw); };
      draw();
    },
  };

  // ================================================================ launch.exe
  const L = { s: 0, img: null, cut: 10, dev: .1, id: null, poll: 0 };
  A.launch = {
    title: 'launch.exe — open a mine', short: 'launch.exe', icon: 'launch', w: 660, h: 610, minW: 420, minH: 420,
    build(el) {
      el.innerHTML = `<div class="lw">
        <ol class="steps"><li data-i="0">coin</li><li data-i="1">mine</li><li data-i="2">pay</li><li data-i="3">live</li></ol>
        <div class="lw-body scroll">
        <section data-s="0">
          <div class="lw-grid"><div>
            <label class="field"><span>name</span><input name="name" maxlength="32" placeholder="night shift"></label>
            <label class="field"><span>ticker</span><input name="symbol" maxlength="10" placeholder="SHIFT" style="text-transform:uppercase"></label>
            <label class="field"><span>description <i class="hint">optional</i></span><textarea name="description" maxlength="400" rows="3" placeholder="what is this coin about?"></textarea></label>
          </div><div class="lw-img"><div class="drop" tabindex="0"><img alt=""><span>drop a picture<br><small>or pick one below</small></span></div>
            <div class="lw-imgb"><label class="btn ghost">upload<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden></label><button class="btn ghost" data-x="face" type="button">miner face</button><button class="btn ghost" data-x="paint" type="button">paint</button></div></div></div>
          <details class="lw-soc"><summary>links <i class="hint">optional</i></summary>
            <label class="field"><span>X</span><input name="twitter" placeholder="https://x.com/yourcoin"></label>
            <label class="field"><span>telegram</span><input name="telegram" placeholder="https://t.me/yourcoin"></label>
            <label class="field"><span>website</span><input name="website" placeholder="https://… (blank = this mine’s page here)"></label></details>
        </section>
        <section data-s="1" hidden>
          <div class="lw-mine"><canvas class="lw-av" width="72" height="72"></canvas><div><h3 class="h3">your coin becomes a mine</h3><p class="dim">every minute the engine claims the coin’s creator fees into the mine. browsers mine the coin’s own chain, and whoever finds the next block takes the pool.</p></div></div>
          <h3 class="h3">your cut <i class="hint">a share of every claim, paid to you. locked at launch.</i></h3>
          <label class="mix cut"><b class="k-dev">dev</b><input type="range" min="0" max="30" step="1" name="cut"><output></output><small>paid to you</small></label>
          <div class="mixbar"><i class="mb-pool"></i><i class="mb-dev"></i></div>
          <div class="mixsay"></div>
          <p class="hint">the cut is <span class="devcap">30</span>% at most. the rest of every claim goes to whoever finds the next block.</p>
        </section>
        <section data-s="2" hidden>
          <label class="field"><span>first buy <i class="hint">the coin’s first purchase. the tokens go to your wallet.</i></span>
            <div class="row"><input name="dev" type="number" min="0.01" max="10" step="0.01" value="0.1"><span class="unit">SOL</span>${[.05, .1, .5, 1].map(v => `<button class="chip" type="button" data-dev="${v}">${v}</button>`).join('')}</div></label>
          <table class="cost"></table>
          <div class="lw-wal"></div>
          <label class="lw-ok"><input type="checkbox" name="agree"> i get it: the mine’s wallet is held by the Mine engine. it can only claim the fees, pay my cut and pay whoever finds a block. it never sells.</label>
          <div class="lw-err bad"></div>
        </section>
        <section data-s="3" hidden>
          <div class="grow"><canvas class="lw-grow" width="120" height="120"></canvas><div class="lw-steps"></div></div>
          <div class="lw-done"></div>
        </section>
        </div>
        <footer class="lw-f"><button class="btn ghost" type="button" data-x="back">‹ back</button><span class="lw-note dim"></span><button class="btn go" type="button" data-x="next">next ›</button></footer></div>`;
      const f = n => $(`[name="${n}"]`, el);
      // image: upload, drop, a miner face, or paint
      const setImg = url => { L.img = url; const im = $('.drop img', el); im.src = url; $('.drop', el).classList.add('has'); };
      const readFile = file => { if (!file || !/^image\//.test(file.type)) return X.toast('that isn’t a picture'); if (file.size > 8e6) return X.toast('that picture is too big'); const r = new FileReader(); r.onload = () => squash(r.result).then(setImg); r.readAsDataURL(file); };
      $('input[type=file]', el).onchange = e => readFile(e.target.files[0]);
      const drop = $('.drop', el);
      drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); }; drop.ondragleave = () => drop.classList.remove('over');
      drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); readFile(e.dataTransfer.files[0]); };
      $('[data-x=face]', el).onclick = () => setImg(minerFace(f('symbol').value || f('name').value || String(Math.random())));
      $('[data-x=paint]', el).onclick = () => X.open('paint');
      X.on('paint:use', url => { setImg(url); X.open('launch'); go(0); X.toast('picture from paint.exe added'); });
      // the cut
      const cap = () => (X.CFG && X.CFG.devCap) || 30;
      $('.devcap', el).textContent = cap();
      function drawCut() {
        const i = f('cut'); i.max = cap(); i.value = L.cut; i.nextElementSibling.textContent = L.cut + '%'; i.style.setProperty('--p', (L.cut / cap() * 100) + '%');
        $('.mb-pool', el).style.width = (100 - L.cut) + '%'; $('.mb-dev', el).style.width = L.cut + '%';
        $('.mixsay', el).innerHTML = `for every <b>1 SOL</b> of creator fees, <b class="k-pool">${((100 - L.cut) / 100).toFixed(2)} SOL</b> goes into the pool for the next block and <b class="k-dev">${(L.cut / 100).toFixed(2)} SOL</b> is paid to you.`;
      }
      f('cut').oninput = () => { L.cut = Math.max(0, Math.min(cap(), Math.round(+f('cut').value))); drawCut(); SOUND.sfx('tick'); };
      const drawAv = () => { const c = $('.lw-av', el), g = c.getContext('2d'); g.clearRect(0, 0, 72, 72); g.imageSmoothingEnabled = false; const t = X.tinted(X.SPR.pet, X.hueOf(f('symbol').value || 'x')); if (t) g.drawImage(t, 0, 0, 72, 72); };
      // the bill
      const cost = () => { const c = X.CFG || { fee: .05, createSol: .03, reserveSol: .015, minDev: .01, maxDev: 10 }; const dev = Math.max(c.minDev || .01, Math.min(c.maxDev || 10, Number(f('dev').value) || 0));
        const rows = [['launch fee', c.fee, 'to Mine'], ['pump.fun create', c.createSol, 'the unused part comes back'], ['first buy', +(dev * 1.02).toFixed(4), `${dev} SOL + 2% slippage room, tokens to you`], ['the mine’s gas tank', c.reserveSol, 'stays with your mine for its transactions']];
        const tot = rows.reduce((s, r) => s + r[1], 0);
        $('.cost', el).innerHTML = rows.map(([k, v, n]) => `<tr><td>${esc(k)}<small>${esc(n)}</small></td><td>${v.toFixed(4)} SOL</td></tr>`).join('') + `<tr class="tot"><td>total, one transfer from your wallet</td><td>${tot.toFixed(3)} SOL</td></tr>`; return tot; };
      f('dev').oninput = cost; $$('[data-dev]', el).forEach(b => b.onclick = () => { f('dev').value = b.dataset.dev; cost(); });
      const walBox = () => { const w = WAL.current(); $('.lw-wal', el).innerHTML = w ? `<span class="dot on"></span> paying from <b>${esc(short(w.address))}</b> <button class="chip" type="button" data-x="chg">change</button>` + (X.CFG && X.CFG.mock ? ' <button class="chip" type="button" data-x="mock">dev: test wallet</button>' : '') : `<button class="btn" type="button" data-x="con">connect wallet</button>` + (X.CFG && X.CFG.mock ? ' <button class="chip" type="button" data-x="mock">dev: test wallet</button>' : '');
        const c = $('[data-x=con]', el) || $('[data-x=chg]', el); if (c) c.onclick = async () => { try { if (WAL.current()) await WAL.disconnect(); await X.connect(); } catch (e) { X.toast(e.message); } };
        const m = $('[data-x=mock]', el); if (m) m.onclick = () => { L.mockWallet = true; X.toast('dev: using a test wallet; payment is simulated'); $('.lw-wal', el).innerHTML = '<span class="dot on"></span> dev test wallet (simulated payment)'; }; };
      X.on('wallet', walBox);
      // steps
      function go(s) {
        const back = s < (L.s || 0); L.s = s; $$('[data-s]', el).forEach(x => x.hidden = +x.dataset.s !== s);
        const sec = $(`[data-s="${s}"]`, el); sec.classList.remove('slide-in', 'slide-back'); void sec.offsetWidth; sec.classList.add(back ? 'slide-back' : 'slide-in');
        $$('.steps li', el).forEach(li => { li.classList.toggle('on', +li.dataset.i === s); li.classList.toggle('done', +li.dataset.i < s); });
        $('[data-x=back]', el).style.visibility = s > 0 && s < 3 ? 'visible' : 'hidden';
        const nx = $('[data-x=next]', el); nx.hidden = s === 3; nx.textContent = s === 2 ? `pay ${cost().toFixed(3)} SOL & launch` : 'next ›';
        $('.lw-note', el).textContent = s === 0 ? 'step 1 of 3: the coin' : s === 1 ? 'step 2 of 3: the mine' : s === 2 ? 'step 3 of 3: pay and open' : '';
        if (s === 1) { drawAv(); drawCut(); } if (s === 2) { cost(); walBox(); }
      }
      function check0() {
        const name = f('name').value.trim(), sym = f('symbol').value.trim().replace(/^\$/, '').toUpperCase();
        if (!name) return 'give the coin a name.'; if (!/^[A-Z0-9]{1,10}$/.test(sym)) return 'the ticker is 1–10 letters or numbers.'; if (!L.img) return 'add a picture: upload one, use a miner face, or paint one.';
        for (const [n, re, msg] of [['twitter', /^https:\/\/(x|twitter)\.com\/[A-Za-z0-9_]{1,15}(\/status\/\d+)?\/?$/, 'the X link should look like https://x.com/yourcoin'], ['telegram', /^https:\/\/t\.me\/[A-Za-z0-9_+]{3,64}\/?$/, 'the telegram link should look like https://t.me/yourcoin'], ['website', /^https:\/\/[^\s"'<>]{3,200}$/, 'the website should start with https://']]) { const v = f(n).value.trim(); if (v && !re.test(v)) return msg; }
        return null;
      }
      $('[data-x=back]', el).onclick = () => go(Math.max(0, L.s - 1));
      $('[data-x=next]', el).onclick = async () => {
        if (L.s === 0) { const e = check0(); if (e) return X.toast(e); f('symbol').value = f('symbol').value.trim().replace(/^\$/, '').toUpperCase(); return go(1); }
        if (L.s === 1) return go(2);
        if (L.s === 2) return pay();
      };
      async function pay() {
        const err = $('.lw-err', el); err.textContent = '';
        if (!f('agree').checked) { err.textContent = 'tick the box first: it says who holds the mine’s wallet.'; return; }
        const nx = $('[data-x=next]', el); nx.disabled = true;
        try {
          let w = WAL.current();
          const mock = !!(X.CFG && X.CFG.mock && L.mockWallet);
          if (!w && !mock) w = await X.connect();
          const launcher = w ? w.address : (await (await fetch('/dev/wallet')).json()).address;
          nx.textContent = 'saving the coin…';
          const p = await api('prepare', { method: 'POST', body: { launcher, name: f('name').value.trim(), symbol: f('symbol').value.trim(), description: f('description').value.trim(), twitter: f('twitter').value.trim(), telegram: f('telegram').value.trim(), website: f('website').value.trim(), image: L.img, devBuy: Number(f('dev').value), devCut: L.cut } });
          L.id = p.id; L.prep = p; X.ls.set('mw:pending', p.id);
          go(3); steps('sign');
          if (w) {
            const b = await api('paybuild', { method: 'POST', body: { id: p.id } });
            if (!b.paid) {
              let signed; try { signed = await WAL.signTx(Uint8Array.from(atob(b.tx), c => c.charCodeAt(0))); }
              catch (e) { manual(p, e.message); return; }
              const r = await api('relay', { method: 'POST', body: { id: p.id, tx: WAL.b64(signed) } }); L.paySig = r.sig;
            }
          } else { await fetch('/dev/fund', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: p.id }) }); }
          steps('wait'); watch();
        } catch (e) { if (L.s === 3) { steps('fail', e.message); } else { err.textContent = e.message; } }
        finally { nx.disabled = false; if (L.s === 2) go(2); }
      }
      function manual(p, why) {
        $('.lw-done', el).innerHTML = `<p class="warn">${esc(why || 'this wallet can’t sign here.')}</p><p>send exactly <b class="am">${p.needSol} SOL</b> to the mine’s wallet from any wallet, and this window will pick it up:</p><p class="addr">${esc(p.wallet)} <button class="chip" type="button">copy</button></p>`;
        $('.lw-done .chip', el).onclick = () => X.copy(p.wallet); steps('wait'); watch();
      }
      const STEPS = [['sign', 'your wallet signs one transfer'], ['wait', 'the deposit lands in the mine'], ['create', 'the mine creates the coin on pump.fun'], ['live', 'live. the mine is open']];
      function steps(at, err) {
        const i = STEPS.findIndex(s => s[0] === at);
        $('.lw-steps', el).innerHTML = STEPS.map(([k, t], j) => `<div class="st ${err && j === i ? 'bad' : j < i || at === 'live' ? 'done' : j === i ? 'now' : ''}"><i></i>${esc(t)}</div>`).join('') + (err ? `<p class="bad">${esc(err)}</p>` : '');
        L.stage = at;
      }
      async function watch() {
        clearInterval(L.poll); const id = L.id; let n = 0;
        const tick = async () => {
          if (++n > 400) return clearInterval(L.poll);
          let s; try { s = await api('status', { params: { id } }); } catch { return; }
          if (s.state === 'waiting') steps('wait');
          if (s.state === 'creating') steps('create');
          if (s.state === 'live') { clearInterval(L.poll); steps('live'); done(s); }
          if (['failed', 'refunded', 'expired'].includes(s.state)) { clearInterval(L.poll); steps('create', s.state === 'expired' ? 'the deposit never fully arrived. anything that did was sent back.' : 'the launch failed and the deposit was sent back. ' + (s.err || '')); X.ls.set('mw:pending', ''); }
        };
        tick(); L.poll = setInterval(tick, 2500);
      }
      function done(s) {
        X.ls.set('mw:pending', ''); SOUND.sfx('born'); X.refresh();
        setTimeout(() => { const im = $('.born img', el); if (im) { const r = im.getBoundingClientRect(); X.fx.burst(r.left + r.width / 2, r.top + r.height / 2, { n: 44, speed: 200, colors: ['#ffb347', '#ffd27a', '#fff1cf', '#ff8a5c', '#e8a33c'] }); } }, 60);
        $('.lw-done', el).innerHTML = `<div class="born"><img src="/i/${esc(s.id)}" alt=""><div><h3 class="h">the mine is open.</h3><p class="dim">$${esc(s.symbol)} is live on pump.fun and its mine is its creator. block #0 is waiting to be found. every block pays its finder the fees in the pool${s.devCut ? `, after your ${s.devCut}% cut` : ''}.</p>
          <p>${link(pumpfun(s.mint), 'open on pump.fun ↗')} · ${link(acct(s.wallet), 'the mine’s wallet ↗')}${s.create_sig ? ' · ' + link(solscan(s.create_sig), 'create tx ↗') : ''}</p>
          <div class="row"><button class="btn go" type="button" data-x="rig">mine it now</button><button class="btn" type="button" data-x="vein">see the mine</button><button class="btn" type="button" data-x="again">launch another</button></div></div></div>`;
        $('[data-x=rig]', el).onclick = () => X.open('rig', { mint: s.mint });
        $('[data-x=vein]', el).onclick = () => X.openMine(s.mint);
        $('[data-x=again]', el).onclick = () => { L.id = null; L.img = null; $('.drop', el).classList.remove('has'); el.querySelectorAll('input:not([type=range]):not([type=checkbox]), textarea').forEach(i => { if (i.name !== 'dev') i.value = ''; }); $('.lw-done', el).innerHTML = ''; go(0); };
      }
      L.go = go; L.resume = async id => { L.id = id; go(3); steps('wait'); watch(); };
      go(0);
    },
    open(arg) {
      const el = X.WM.wins.launch; if (!el) return;
      if (arg && typeof arg === 'object') { if (arg.name) $('[name=name]', el).value = arg.name; if (arg.symbol) $('[name=symbol]', el).value = String(arg.symbol).toUpperCase(); L.go(0); }
      const pend = X.ls.get('mw:pending'); if (pend && !L.id && L.s !== 3) L.resume(pend);
    },
  };
  // pictures: anything uploaded becomes a 512px square jpeg before it goes anywhere
  function squash(url) {
    return new Promise(res => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); const s = Math.max(512 / im.width, 512 / im.height), w = im.width * s, h = im.height * s; g.fillStyle = '#0c0805'; g.fillRect(0, 0, 512, 512); g.drawImage(im, (512 - w) / 2, (512 - h) / 2, w, h); res(c.toDataURL('image/jpeg', .9)); }; im.onerror = () => res(url); im.src = url; });
  }
  function minerFace(key) {
    const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'), h = X.hueOf(key);
    const gr = g.createRadialGradient(256, 300, 30, 256, 256, 380); gr.addColorStop(0, `hsl(${32 + h * .3},70%,26%)`); gr.addColorStop(1, `hsl(${28 + h * .3},60%,5%)`); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    g.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < 512; y += 4) g.fillRect(0, y, 512, 2);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,${180 + Math.random() * 60 | 0},80,${.25 + Math.random() * .5})`; g.fillRect(Math.random() * 512, Math.random() * 512, 3 + Math.random() * 5, 3 + Math.random() * 4); }
    g.imageSmoothingEnabled = false; const t = X.tinted(X.SPR.pet, h); if (t) { g.shadowColor = 'rgba(255,190,100,.45)'; g.shadowBlur = 40; g.drawImage(t, 56, 64, 400, 400); }
    return c.toDataURL('image/png');
  }


  // ================================================================ veins: every open mine
  const VL = { tab: 'all', q: '', seen: new Set() };
  A.veins = {
    title: 'veins — every mine', short: 'veins', icon: 'veins', w: 330, h: 560, minW: 270, minH: 320, at: 'right',
    build(el) {
      el.innerHTML = `<div class="bl vl"><div class="blh"><canvas width="40" height="40"></canvas><div><b class="blme">the mountain</b><small class="blst">every coin is a mine</small></div></div>
        <div class="bltabs"><button type="button" data-t="all" class="on">mines</button><button type="button" data-t="mine">my mines</button></div>
        <input class="blq" placeholder="find a $ticker" spellcheck="false">
        <div class="bllist scroll"></div>
        <div class="blf"><button class="btn go" type="button" data-o="rig">⛏ mine</button><button class="btn" type="button" data-o="launch">+ launch</button><button class="btn" type="button" data-o="chain">chain</button></div></div>`;
      const c = $('.blh canvas', el), g = c.getContext('2d'); g.imageSmoothingEnabled = false; if (X.SPR.pet) g.drawImage(X.SPR.pet, 0, 0, 40, 40);
      $$('.bltabs button', el).forEach(b => b.onclick = () => { VL.tab = b.dataset.t; $$('.bltabs button', el).forEach(x => x.classList.toggle('on', x === b)); render(); });
      $('.blq', el).oninput = e => { VL.q = e.target.value.trim().toLowerCase().replace(/^\$/, ''); render(); };
      $$('[data-o]', el).forEach(b => b.onclick = () => X.open(b.dataset.o));
      const me = () => { const w = WAL.current(); $('.blme', el).textContent = w ? short(w.address) : 'the mountain'; };
      X.on('wallet', () => { me(); if (VL.tab === 'mine') render(); }); me();
      const row = m => `<button type="button" class="br vr ${m.miners ? 'on' : ''}" data-m="${esc(m.mint)}"><img src="${esc(m.img)}" alt="" loading="lazy"><span class="bn"><b>$${esc(m.symbol)}</b> <i>#${m.height}</i><small>${m.state === 'live' ? `pool ${fsol(m.pool)} SOL · ${m.miners ? m.miners + ' mining' : 'nobody mining'}` : 'opening…'}</small></span><span class="vp">${fsol(m.pool)}</span></button>`;
      async function render() {
        const box = $('.bllist', el);
        let list = X.MINES;
        if (VL.tab === 'mine') { const w = WAL.current(); if (!w) { box.innerHTML = `<div class="empty"><img src="${ICONS.veins}" alt="">connect a wallet to see the mines you opened.<br><br><button class="btn" type="button">connect</button></div>`; $('button', box).onclick = () => X.connect().catch(e => X.toast(e.message)); return; }
          try { list = (await api('veins', { params: { owner: w.address } })).veins; } catch { list = []; } }
        if (VL.q) list = list.filter(m => m.symbol.toLowerCase().includes(VL.q) || m.name.toLowerCase().includes(VL.q));
        if (!list.length) { box.innerHTML = `<div class="empty"><img src="${ICONS.veins}" alt="">${VL.q ? 'no mine by that ticker.' : VL.tab === 'mine' ? 'you haven’t opened a mine yet.' : 'no mines yet. the mountain is quiet.'}<br><br><button class="btn go" type="button">open the first one</button></div>`; $('button', box).onclick = () => X.open('launch'); return; }
        const busy = list.filter(m => m.miners > 0), rich = list.filter(m => !m.miners && m.pool > 0), rest = list.filter(m => !m.miners && !(m.pool > 0));
        const grp = (t, arr, open = true) => arr.length ? `<details ${open ? 'open' : ''}><summary>${esc(t)} <span>(${arr.length})</span></summary>${arr.map(row).join('')}</details>` : '';
        box.innerHTML = VL.tab === 'mine' ? grp('my mines', list) : grp('being mined now', busy) + grp('pool waiting', rich) + grp('quiet', rest);
        if (VL.anim !== VL.tab) { VL.anim = VL.tab; X.fx.stagger($$('.br', box), 'in', 28, 80); }
        $$('.br', box).forEach(r => r.onclick = () => X.openMine(r.dataset.m));
        list.forEach(m => { if (VL.primed && !VL.seen.has(m.mint)) { SOUND.sfx('buddy'); const r = $(`.br[data-m="${CSS.escape(m.mint)}"]`, box); r && r.classList.add('new'); } VL.seen.add(m.mint); });
        VL.primed = true;
      }
      X.on('mines', () => { if (VL.tab === 'all') render(); }); render();
      X.on('feed', it => { const r = $(`.br[data-m="${CSS.escape(it.mint)}"]`, el); if (r && it.kind === 'block') { r.classList.remove('ping'); void r.offsetWidth; r.classList.add('ping'); $('small', r).textContent = it.text; } });
      VL.render = render;
    },
    open(arg) { if (arg && arg.tab) { VL.tab = arg.tab; const el = X.WM.wins.veins; $$('.bltabs button', el).forEach(x => x.classList.toggle('on', x.dataset.t === VL.tab)); VL.render && VL.render(); } },
  };

  // ================================================================ one window per mine
  A.vein = {
    title: 'mine', icon: 'veins', w: 0, h: 0,
    spawn(m) {
      const id = 'vein:' + m.id;
      if (!X.APPS[id]) X.define(id, { title: `$${m.symbol} — mine`, short: '$' + m.symbol, iconURL: m.img, w: 560, h: 560, minW: 380, minH: 360, dispose: true, build: el => buildVein(el, m), close: () => { const o = VW.get(m.mint); o && o.off && o.off(); VW.delete(m.mint); } });
      X.open(id);
    },
  };
  const VW = new Map();
  function buildVein(el, m0) {
    let m = m0;
    el.innerHTML = `<div class="vn"><div class="vn-top"><img src="${esc(m.img)}" alt=""><div class="vn-id"><b>$${esc(m.symbol)}</b> <span class="lvl">${esc(m.level || 'shallow')}</span><small>${esc(m.name)} · dev cut ${m.devCut}%</small>
        <div class="vn-links">${link(pumpfun(m.mint), 'pump.fun ↗')} ${link('https://dexscreener.com/solana/' + m.mint, 'chart ↗')} ${link(acct(m.wallet), 'mine wallet ↗')}</div></div>
        <button class="btn go vn-mine" type="button">⛏ mine $${esc(m.symbol)}</button></div>
      <div class="vn-stats"></div>
      <div class="vn-cols"><div><h4>latest blocks</h4><div class="vn-blocks scroll"></div></div><div><h4>top miners</h4><div class="vn-top8"></div><h4>the mine’s log</h4><div class="vn-log scroll"></div></div></div></div>`;
    $('.vn-mine', el).onclick = () => X.open('rig', { mint: m.mint });
    const stats = () => {
      $('.vn-stats', el).innerHTML = [['next block pays', fsol(m.pool) + ' SOL', 'gold'], ['chain height', '#' + m.height, ''], ['paid to miners', fsol(m.paid) + ' SOL', ''], ['mining now', m.miners + (m.rate ? ' · ' + hs(m.rate) : ''), ''], ['a block takes', '~' + big(m.expected) + ' hashes', ''], ['last block', m.lastBlockAt ? ago(m.lastBlockAt) + ' ago' : 'none yet', '']]
        .map(([t, v, c]) => `<div class="${c}"><b>${esc(v)}</b><span>${esc(t)}</span></div>`).join('');
    };
    const blockRow = b => `<div class="vb"><span class="vh">#${b.height}</span><span class="vm">${esc(short(b.miner))}</span><span class="vs ${b.reward > 0 ? 'gold' : 'mute'}">${b.reward > 0 ? '+' + fsol(b.reward) : 'dry'}</span><span class="mute">${esc(ago(b.at))}</span>${b.sig ? link(solscan(b.sig), 'tx ↗') : '<span class="mute">…</span>'}</div>`;
    async function load() {
      try {
        const j = await api('vein', { params: { id: m.id } }); m = j.vein; stats();
        $('.vn-blocks', el).innerHTML = j.blocks.length ? j.blocks.map(blockRow).join('') : `<p class="empty">no blocks yet. be the first: press mine.</p>`;
        $('.vn-top8', el).innerHTML = j.top.length ? j.top.map((t, i) => `<div class="vt"><span class="rk">${i + 1}</span><span>${esc(short(t.miner))}</span><span class="mute">${t.blocks} block${t.blocks === 1 ? '' : 's'}</span><span class="gold">${fsol(t.paid)}</span></div>`).join('') : '<p class="empty">nobody yet.</p>';
        $('.vn-log', el).innerHTML = j.logs.map(l => `<div class="vlg"><span class="k-${esc(l.kind)}">${esc(l.kind)}</span> ${esc(l.text)}${l.sig ? ' ' + link(solscan(l.sig), 'tx ↗') : ''}</div>`).join('');
      } catch (e) { $('.vn-stats', el).innerHTML = `<p class="bad">${esc(e.message)}</p>`; }
    }
    stats(); load();
    const t = setInterval(() => { if (!document.body.contains(el)) return clearInterval(t); if (!document.hidden) load(); }, 15000);
    const off = X.on('feed', it => { if (it.mint === m.mint) { load(); if (it.kind === 'block') { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } } });
    VW.set(m.mint, { off });
  }
  X.openMine = async key => {
    let m = X.mineBy(key);
    if (!m) { try { m = (await api('vein', { params: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(key) ? { mint: key } : { id: key } })).vein; } catch (e) { X.toast(e.message); return; } }
    A.vein.spawn(m);
  };

  // ================================================================ ledger.db
  const LG = { kind: 'all', rows: [], oldest: 0 };
  A.ledger = {
    title: 'ledger.db — every block, every tx', short: 'ledger.db', icon: 'ledger', w: 820, h: 480, minW: 420, minH: 260,
    build(el) {
      el.innerHTML = `<div class="lg"><div class="lg-tot"></div><div class="lg-f">${['all', 'block', 'claim', 'dev', 'launch'].map(k => `<button type="button" class="chip ${k === 'all' ? 'on' : ''}" data-k="${k}">${k}</button>`).join('')}<span class="dim lg-n"></span></div>
        <div class="lg-t scroll"><table><thead><tr><th>when</th><th>coin</th><th>kind</th><th>what happened</th><th>amount</th><th>tx</th></tr></thead><tbody></tbody></table><button class="btn ghost lg-more" type="button">load older</button></div></div>`;
      const tb = $('tbody', el);
      const rowH = (r, fresh) => `<tr class="${fresh ? 'fresh' : ''}" data-m="${esc(r.mint)}"><td class="mute">${esc(ago(r.at))}</td><td><a class="budl" data-bud="${esc(r.mint)}">$${esc(r.symbol)}</a></td><td><span class="k-${esc(r.kind)}">${esc(r.kind)}</span></td><td>${esc(r.text)}</td><td class="${r.kind === 'block' ? 'gold' : ''}">${r.sol ? fsol(r.sol) + ' SOL' : '—'}</td><td>${r.sig ? link(solscan(r.sig), short(r.sig) + ' ↗') : '<span class="mute">—</span>'}</td></tr>`;
      $('.lg-tot', el).innerHTML = [['claimed', 'fees claimed'], ['paid', 'paid to miners'], ['pool', 'waiting in pools'], ['dev', 'paid to devs'], ['blocks', 'blocks']].map(([k, t]) => `<div><b data-k="${k}">0</b><span>${t}</span></div>`).join('');
      const tot = () => { const t = X.TOTALS || {}; $$('.lg-tot b', el).forEach(b => X.fx.countTo(b, t[b.dataset.k] || 0, b.dataset.k === 'blocks' ? v => String(Math.round(v)) : v => fsol(v) + ' SOL')); };
      async function load(reset) {
        const params = { limit: 60 }; if (LG.kind !== 'all') params.kind = LG.kind; if (!reset && LG.oldest) params.before = LG.oldest;
        const j = await api('feed', { params }).catch(() => ({ items: [] }));
        if (reset) LG.rows = []; LG.rows.push(...j.items); LG.oldest = LG.rows.length ? Number(LG.rows[LG.rows.length - 1].n) : 0;
        tb.innerHTML = LG.rows.map(r => rowH(r)).join('') || `<tr><td colspan="6" class="empty">nothing yet. every launch, claim, block and payout lands here with its transaction.</td></tr>`;
        $('.lg-n', el).textContent = `${LG.rows.length} shown`; $('.lg-more', el).hidden = j.items.length < 60;
      }
      $$('.lg-f .chip', el).forEach(c => c.onclick = () => { LG.kind = c.dataset.k; $$('.lg-f .chip', el).forEach(x => x.classList.toggle('on', x === c)); load(true); });
      $('.lg-more', el).onclick = () => load(false);
      el.addEventListener('click', e => { const a = e.target.closest('.budl'); if (a) { e.preventDefault(); X.openMine(a.dataset.bud); } });
      X.on('feed', it => { if (LG.kind !== 'all' && it.kind !== LG.kind) return; if (LG.rows.some(r => r.n === it.n)) return; LG.rows.unshift(it); const e0 = tb.querySelector('.empty'); if (e0) tb.innerHTML = ''; tb.insertAdjacentHTML('afterbegin', rowH(it, true)); });
      X.on('mines', tot); tot(); load(true);
    },
  };

  // ================================================================ readme.txt
  A.readme = {
    title: 'readme.txt — notepad', short: 'readme.txt', icon: 'readme', w: 700, h: 580, minW: 360, minH: 260,
    build(el) {
      const c = X.CFG || { fee: .05, createSol: .03, reserveSol: .015, devCap: 30, minHold: 100000, cooldown: 4, blockSecs: 60, minPay: .0005 };
      el.innerHTML = `<div class="np"><div class="np-menu"><span>file</span><span>edit</span><span>format</span><span>view</span><span>help</span></div><div class="np-doc scroll">
<h1>Mine</h1><p class="np-tag">every coin is a mine. your browser mines it. every block pays SOL.</p>
<h2>what is a mine</h2>
<p>when you launch a coin here, it gets a mine: a Solana wallet made for that one coin and set as the coin’s creator on pump.fun. pump.fun pays a creator fee on every trade. every minute the engine claims those fees into the mine’s pool.</p>
<h2>what you mine</h2>
<p>every coin has its own proof-of-work chain. a block is a line of text: <code>mine|mint|height|previous block’s hash|your wallet|nonce</code>. your browser hashes it with SHA-256, over and over, changing the nonce. when the first 8 bytes of a hash, read as a number, come out under the chain’s target, you found the block.</p>
<p>your wallet is inside the line you hash, so a block you find can only pay you. nobody can take it and send it as theirs.</p>
<h2>what a block pays</h2>
<p>the whole pool: every fee claimed since the last block${c.devCap ? `, minus the launcher’s dev cut (0–${c.devCap}%, locked at launch)` : ''}. it’s paid straight to your wallet in one Solana transaction, and that transaction’s memo carries the block’s hash, so every block is on chain. if the pool holds less than ${c.minPay} SOL, the block is still yours but pays nothing, and the pool keeps filling for the next one.</p>
<h2>the rules</h2>
<ul><li>to mine a coin, hold at least ${Number(c.minHold).toLocaleString()} of it (0.01% of the supply).</li><li>a wallet that found one of the last ${c.cooldown} blocks sits out the next one, so one fast machine can’t take them all.</li><li>the chain retunes itself after every block toward one block a minute. no block for 90 seconds, and the target starts to get easier.</li><li>no account, no signature. you give a wallet address to be paid at.</li></ul>
<h2>check it yourself</h2>
<p>open chain.exe, pick a block and press verify. your browser recomputes its hash from the line above and checks it against the target. then open its transaction and read the memo.</p>
<h2>how a launch works</h2>
<ol><li>fill in the coin: name, ticker, picture, links.</li><li>pick your dev cut, 0–${c.devCap}%.</li><li>pick a first buy and pay with one transfer to the mine’s wallet.</li><li>the mine creates the coin on pump.fun with your first buy, sends you the tokens and any unused SOL, and opens block #0.</li></ol>
<h2>what it costs</h2>
<ul><li>launch fee: ${c.fee} SOL.</li><li>pump.fun’s create cost: about ${c.createSol} SOL. what isn’t used comes back.</li><li>your first buy, plus 2% room for slippage. the tokens go to you.</li><li>the mine’s gas tank: ${c.reserveSol} SOL, kept for its transactions.</li></ul>
<p>if a launch fails or isn’t fully paid within 3 hours, everything that arrived goes back, launch fee included.</p>
<h2>who holds the mine’s wallet</h2>
<p>the engine does. each mine’s key is derived on our server from one master secret, never stored and never shown. the engine can do four things with it: claim the fees, pay the dev cut, pay a block’s finder, and hand out the first buy. it has no sell and no withdraw. you are trusting it to do exactly that, so everything it does is a public Solana transaction.</p>
<h2>the honest part</h2>
<p>Mine is not an investment and promises nothing about price. mining here is a fair race weighted by work, not useful compute: blocks pay only what the coin earned in fees. a coin nobody trades pays tiny blocks. a faster machine finds more blocks, and the cooldown only slows that down. use what you can afford to lose.</p>
<p class="dim">Mine OS 1.0 · deep shift edition</p></div></div>`;
    },
  };

  // ================================================================ display.cpl
  A.display = {
    title: 'display — settings', short: 'display', icon: 'display', w: 440, h: 430, nomax: true,
    build(el) {
      const opts = [['crt', 'crt scanlines', 'the old monitor look'], ['grid', 'rock grid', 'the faint grid on the wallpaper'], ['pets', 'miners on the taskbar', 'they swing when a block drops'], ['toasts', 'block pop-ups', 'a note when a block is found']];
      el.innerHTML = `<div class="pad disp">${opts.map(([k, t, s]) => `<label class="tog"><input type="checkbox" data-k="${k}"><span><b>${t}</b><small>${s}</small></span></label>`).join('')}
        <label class="field"><span>volume</span><input type="range" min="0" max="1" step="0.05" class="vol"></label>
        <div class="row"><button class="btn" type="button" data-x="mute">mute</button><button class="btn" type="button" data-x="intro">walk back into the mine</button></div></div>`;
      $$('[data-k]', el).forEach(i => { i.checked = !!X.SET[i.dataset.k]; i.onchange = () => { X.SET[i.dataset.k] = i.checked; X.saveSet(); SOUND.sfx('tick'); }; });
      const v = $('.vol', el); v.value = SOUND.volume; v.oninput = () => SOUND.setVolume(+v.value);
      const mb = $('[data-x=mute]', el); SOUND.onChange(s => mb.textContent = s.muted ? 'unmute' : 'mute'); mb.onclick = () => SOUND.toggle();
      $('[data-x=intro]', el).onclick = () => { X.ss.del('mw:seen'); location.href = '/'; };
    },
  };

  // ================================================================ recycle bin
  A.bin = {
    title: 'recycle bin', short: 'recycle bin', icon: 'bin', w: 440, h: 320,
    build(el) {
      const F = [['gpu_miner.exe', 'not needed. your browser is enough.'], ['paper_hands.txt', 'empty. it always was.'], ['sell_button.png', 'there is no sell button. there was never a sell button.'], ['fake_blocks.db', 'database rows pretending to be blocks. every block here is a hash you can check.'], ['sleep.exe', 'the mine never closes.']];
      el.innerHTML = `<div class="bin"><div class="bin-l">${F.map(([n], i) => `<button type="button" class="icon" data-i="${i}"><img src="${ICONS[/\.exe$/.test(n) ? 'term' : /\.png$/.test(n) ? 'paint' : 'readme']}" alt=""><span>${esc(n)}</span></button>`).join('')}</div>
        <div class="bin-f"><span class="dim bin-say">double-click a file.</span><button class="btn" type="button">empty recycle bin</button></div></div>`;
      $$('.bin-l .icon', el).forEach(b => b.ondblclick = b.onclick = e => { if (e.type === 'click' && !X.MOBILE && e.detail < 2) return; $('.bin-say', el).textContent = F[+b.dataset.i][1]; SOUND.sfx('beep'); });
      $('.bin-f .btn', el).onclick = () => { $('.bin-say', el).textContent = 'nice try. some things stay deleted. and some things come back.'; SOUND.sfx('boom'); };
    },
  };

  const more = installMore(X); delete more.greenhouse; delete more.bagwork;
  Object.assign(A, more, installRig(X), installChain(X), installStats(X));
  return A;
}
