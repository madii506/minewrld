// rig.exe: the browser miner. Web Workers hash the mine's next block header with SHA-256 (a midstate over the fixed
// part, so each try is one or two compressions), the main thread double-checks any find with WebCrypto, then submits it.
// Nothing here signs anything: the wallet you type is only where a block you find gets paid.

const WORKER_SRC = `
const K=new Int32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
const IV=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
const W=new Int32Array(64);
function comp(st,m,o){
  for(let i=0;i<16;i++)W[i]=m[o+i];
  for(let i=16;i<64;i++){const a=W[i-15],b=W[i-2];W[i]=(((a>>>7)|(a<<25))^((a>>>18)|(a<<14))^(a>>>3))+(((b>>>17)|(b<<15))^((b>>>19)|(b<<13))^(b>>>10))+W[i-16]+W[i-7]|0;}
  let a=st[0],b=st[1],c=st[2],d=st[3],e=st[4],f=st[5],g=st[6],h=st[7];
  for(let i=0;i<64;i++){const t1=h+(((e>>>6)|(e<<26))^((e>>>11)|(e<<21))^((e>>>25)|(e<<7)))+((e&f)^(~e&g))+K[i]+W[i]|0;const t2=(((a>>>2)|(a<<30))^((a>>>13)|(a<<19))^((a>>>22)|(a<<10)))+((a&b)^(a&c)^(b&c))|0;h=g;g=f;f=e;e=d+t1|0;d=c;c=b;b=a;a=t1+t2|0;}
  st[0]=st[0]+a|0;st[1]=st[1]+b|0;st[2]=st[2]+c|0;st[3]=st[3]+d|0;st[4]=st[4]+e|0;st[5]=st[5]+f|0;st[6]=st[6]+g|0;st[7]=st[7]+h|0;
}
let MID=new Int32Array(8),S=new Int32Array(8),TAIL=null,NB=1,PW=null,PS=null,DG=null,WD=0,THI=0,TLO=0,BHI=-1>>>0,BLO=-1>>>0,job=0,running=false,N=0,last=0,BATCH=2048;
function setup(prefix){
  const enc=new TextEncoder().encode(prefix),p=enc.length,full=Math.floor(p/64),room=64*(full+1)-p-9;
  WD=room>=10?Math.min(room,18):18;
  const L=p+WD,total=Math.ceil((L+9)/64)*64;NB=total/64-full;
  const buf=new Uint8Array(total);buf.set(enc);DG=new Uint8Array(WD);
  for(let i=0;i<WD;i++){DG[i]=(Math.random()*10)|0;buf[p+i]=48+DG[i];}
  buf[L]=0x80;const dv=new DataView(buf.buffer),bits=L*8;dv.setUint32(total-4,bits>>>0);dv.setUint32(total-8,Math.floor(bits/4294967296));
  const words=new Int32Array(total/4);for(let i=0;i<words.length;i++)words[i]=dv.getInt32(i*4);
  MID.set(IV);for(let b=0;b<full;b++)comp(MID,words,b*16);
  TAIL=words.slice(full*16);PW=new Int32Array(WD);PS=new Int32Array(WD);
  for(let i=0;i<WD;i++){const q=p+i-full*64;PW[i]=q>>2;PS[i]=(3-(q&3))*8;}
}
function put(i){const w=PW[i],s=PS[i];TAIL[w]=(TAIL[w]&~(0xff<<s))|((48+DG[i])<<s);}
function inc(){for(let i=WD-1;i>=0;i--){if(DG[i]<9){DG[i]++;put(i);return;}DG[i]=0;put(i);}}
function nonce(){let s='';for(let i=0;i<WD;i++)s+=DG[i];return s;}
const hx=(a,b)=>(a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');
function batch(n){
  for(let k=0;k<n;k++){
    S.set(MID);comp(S,TAIL,0);if(NB===2)comp(S,TAIL,16);
    const h0=S[0]>>>0,h1=S[1]>>>0;
    if(h0<BHI||(h0===BHI&&h1<BLO)){BHI=h0;BLO=h1;}
    if(h0<THI||(h0===THI&&h1<TLO))return k+1;
    inc();
  }
  return 0;
}
const ch=new MessageChannel();
ch.port1.onmessage=()=>{
  if(!running)return;
  const t0=performance.now(),f=batch(BATCH);N+=f||BATCH;const dt=performance.now()-t0;
  if(dt<16&&BATCH<(1<<20))BATCH*=2;else if(dt>50&&BATCH>128)BATCH>>=1;
  if(f){running=false;let h='';for(let i=0;i<8;i++)h+=(S[i]>>>0).toString(16).padStart(8,'0');postMessage({t:'found',job,nonce:nonce(),hash:h,n:N});N=0;return;}
  const now=performance.now();if(now-last>250){postMessage({t:'rate',job,n:N,best:hx(BHI,BLO),sample:hx(S[0],S[1])});N=0;last=now;}
  ch.port2.postMessage(0);
};
onmessage=e=>{const m=e.data;
  if(m.cmd==='job'){job=m.job;setup(m.prefix);THI=parseInt(m.target.slice(0,8),16);TLO=parseInt(m.target.slice(8,16),16);BHI=BLO=-1>>>0;N=0;last=performance.now();if(!running){running=true;ch.port2.postMessage(0);}}
  else if(m.cmd==='target'){THI=parseInt(m.target.slice(0,8),16);TLO=parseInt(m.target.slice(8,16),16);}
  else if(m.cmd==='stop'){running=false;}
};`;

export async function sha256hex(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export const headerOf = (mint, height, prev, miner, nonce) => `mine|${mint}|${height}|${prev}|${miner}|${nonce}`;
const isAddr = a => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(a || ''));
const zeros = hex => { let n = 0; while (n < hex.length && hex[n] === '0') n++; return n; };
const grp = hex => String(hex || '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
const hl = hex => { let z = zeros(hex), out = ''; for (const ch of grp(hex)) { if (ch === ' ') { out += ' '; continue; } if (z > 0) { out += `<i>${ch}</i>`; z--; } else out += ch; } return out; };

export function installRig(X) {
  const { $, $$, esc, api, fsol, ago, short, solscan, pumpfun, SOUND, WAL } = X;
  const A = {};
  const CORES = Math.max(1, Math.min(16, navigator.hardwareConcurrency || 4));
  const R = {
    mint: X.ls.get('mw:rigmine') || '', miner: X.ls.get('mw:miner') || '',
    threads: Math.max(1, Math.min(CORES, +X.ls.get('mw:threads') || Math.max(1, Math.floor(CORES / 2)))),
    on: false, mode: 'live', work: null, job: 0, workers: [], samples: [], rate: 0, best: null, sample: null,
    elig: null, eligFor: '', hashes: 0, el: null, busy: false, pollT: 0, pingT: 0, lastHeight: null, blob: null,
  };
  X.RIG = R;
  const mineOf = () => (X.MINES || []).find(m => m.mint === R.mint) || null;
  const hs = n => X.hs ? X.hs(n) : Math.round(n) + ' H/s';
  const big = n => X.big ? X.big(n) : String(n);
  const dur = s => !isFinite(s) ? '—' : s < 1 ? '<1 s' : s < 90 ? Math.round(s) + ' s' : s < 5400 ? Math.round(s / 60) + ' min' : s < 172800 ? (s / 3600).toFixed(1) + ' h' : Math.round(s / 86400) + ' days';

  // ---------------------------------------------------------------- workers
  function workerURL() { if (!R.blob) R.blob = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' })); return R.blob; }
  function spawn(n) {
    while (R.workers.length < n) {
      const w = new Worker(workerURL());
      w.onmessage = e => onWorker(e.data);
      w.onerror = e => { log(`a worker crashed: ${e.message || 'unknown error'}`, 'bad'); };
      R.workers.push(w);
    }
    while (R.workers.length > n) R.workers.pop().terminate();
  }
  function killAll() { R.workers.forEach(w => w.terminate()); R.workers = []; }
  function post(msg) { R.workers.forEach(w => w.postMessage(msg)); }
  function startJob() {
    const w = R.work; if (!w || !isAddr(R.miner)) return;
    R.job++; R.best = null; R.sample = null;
    spawn(R.threads);
    post({ cmd: 'job', job: R.job, prefix: `mine|${w.mint}|${w.height}|${w.prev}|${R.miner}|`, target: w.targetHex });
  }
  function onWorker(m) {
    if (m.job !== R.job) return;
    if (m.t === 'rate') {
      R.samples.push([performance.now(), m.n]); R.hashes += m.n;
      if (!R.best || m.best < R.best) R.best = m.best;
      R.sample = m.sample;
    }
    if (m.t === 'found') { R.hashes += m.n; found(m.nonce, m.hash, R.job); }
  }
  function rateNow() {
    const now = performance.now(); R.samples = R.samples.filter(s => now - s[0] < 3000);
    if (!R.on || !R.samples.length) return 0;
    const span = Math.max(1000, now - Math.min(...R.samples.map(s => s[0])) + 250);
    return R.samples.reduce((a, s) => a + s[1], 0) / (span / 1000);
  }

  // ---------------------------------------------------------------- the work
  async function pollWork(force) {
    if (!R.mint) return;
    let w; try { w = await api('work', { params: { mint: R.mint } }); } catch (e) { if (force) log(e.message, 'bad'); return; }
    const prev = R.work; R.work = w;
    if (prev && prev.mint === w.mint && prev.height !== w.height && R.on) {
      const it = (X.RECENT || []).find(i => i.kind === 'block' && i.mint === w.mint && Number(i.height) === prev.height);
      log(it ? it.text : `block #${prev.height} was found. on to #${w.height}.`, 'blk');
      shake();
    }
    const cool = isAddr(R.miner) && (w.cooldown || []).includes(R.miner);
    if (R.on) {
      if (cool && R.mode === 'live') { if (!R.cooling) { R.cooling = true; post({ cmd: 'stop' }); log(`you found one of the last ${(X.CFG && X.CFG.cooldown) || 4} blocks. the rig sits this one out and starts again by itself.`, 'dim'); } }
      else if (!prev || prev.height !== w.height || prev.mint !== w.mint || R.cooling) { R.cooling = false; startJob(); }
      else if (prev.targetHex !== w.targetHex) post({ cmd: 'target', target: w.targetHex });
    }
    paint();
  }
  async function checkElig(force) {
    const key = R.mint + ':' + R.miner;
    if (!force && R.eligFor === key && R.elig) return R.elig;
    if (!R.mint || !isAddr(R.miner)) { R.elig = null; R.eligFor = ''; paint(); return null; }
    R.elig = { checking: true }; paint();
    try { R.elig = await api('eligible', { params: { mint: R.mint, miner: R.miner } }); R.eligFor = key; }
    catch (e) { R.elig = { error: e.message }; }
    paint(); return R.elig;
  }
  async function ping() {
    if (!R.on || R.mode !== 'live' || !R.work) return;
    try { const j = await api('ping', { method: 'POST', body: { id: R.work.id, miner: R.miner, rate: Math.round(R.rate) } }); if (j && j.ok) { R.net = j; paint(); } } catch {}
  }

  // ---------------------------------------------------------------- start, stop, a find
  async function start() {
    if (R.on || R.busy) return;
    if (!R.mint) return X.toast('pick a mine first');
    if (!isAddr(R.miner)) { X.toast('enter the wallet a block should pay'); const i = $('.rg-wal', R.el); i && i.focus(); return; }
    R.busy = true; paintBtn();
    try {
      await pollWork(true); if (!R.work) return;
      const el = await checkElig(true);
      R.mode = el && el.eligible ? 'live' : 'test';
      R.on = true; R.samples = []; R.hashes = 0; R.cooling = false; R.started = Date.now();
      X.ls.set('mw:rigmine', R.mint); X.ls.set('mw:miner', R.miner);
      if (R.mode === 'live' && el.cooldown) { R.cooling = true; log(`you found one of the last ${(X.CFG && X.CFG.cooldown) || 4} blocks of $${R.work.symbol}. the rig waits for the next one.`, 'dim'); }
      else startJob();
      log(R.mode === 'live' ? `mining $${R.work.symbol} block #${R.work.height} on ${R.threads} thread${R.threads > 1 ? 's' : ''}. a find pays ${short(R.miner)}.` : `test run: your rig hashes $${R.work.symbol} for real, but this wallet doesn’t hold enough to be paid, so a find won’t be sent.`, R.mode === 'live' ? 'ok' : 'warn');
      SOUND.sfx('power');
      clearInterval(R.pollT); R.pollT = setInterval(() => pollWork(), 4000);
      clearInterval(R.pingT); if (R.mode === 'live') { R.pingT = setInterval(ping, 30000); setTimeout(ping, 1500); }
      X.emit('rig', { on: true, mint: R.mint });
    } finally { R.busy = false; paint(); }
  }
  function stop(why) {
    if (!R.on) return;
    R.on = false; R.cooling = false; killAll(); clearInterval(R.pollT); clearInterval(R.pingT);
    log(why || `stopped. ${big(R.hashes)} hashes this run.`, 'dim');
    R.rate = 0; X.emit('rig', { on: false, mint: R.mint }); paint();
  }
  async function found(nonce, hash, job) {
    post({ cmd: 'stop' });
    const w = R.work; if (!w) return;
    const line = headerOf(w.mint, w.height, w.prev, R.miner, nonce);
    const check = await sha256hex(line);
    if (check !== hash || BigInt('0x' + check.slice(0, 16)) >= BigInt('0x' + w.targetHex)) { log('a worker reported a hash that didn’t check out. carrying on.', 'bad'); if (R.on && job === R.job) startJob(); return; }
    if (R.mode !== 'live') {
      log(`test run: you found a hash under the target for block #${w.height} (${grp(hash)}…). hold 100,000 $${w.symbol} and a find like this pays ${w.reward ? fsol(w.reward) + ' SOL' : 'the pool'}.`, 'gold');
      celebrate(w.reward, w.height, true); if (R.on) setTimeout(() => R.on && startJob(), 1600); return;
    }
    log(`found a hash for block #${w.height}: ${grp(hash)}… sending it in.`, 'gold');
    let r; try { r = await api('submit', { method: 'POST', body: { id: w.id, height: w.height, nonce, miner: R.miner } }); }
    catch (e) { r = { ok: false, error: e.message }; }
    if (r.ok) {
      const b = r.block || {};
      celebrate(b.reward, b.height, false);
      if (r.paid) log(`BLOCK #${b.height} IS YOURS. paid ${fsol(b.reward)} SOL to ${short(R.miner)}.`, 'gold', b.sig);
      else if (r.pending) log(`BLOCK #${b.height} IS YOURS. the ${fsol(b.reward)} SOL payout is on its way; the engine keeps sending it until it lands.`, 'gold', b.sig);
      else log(`BLOCK #${b.height} IS YOURS. the pool was still filling, so this one paid nothing. the fees keep coming.`, 'gold');
      X.refresh && X.refresh();
      const card = { mint: w.mint, symbol: w.symbol, height: b.height, hash: b.hash || hash, reward: b.reward, secs: b.secs, miner: R.miner, sig: b.sig };
      R.lastFind = card; paintShare();
      X.toast(r.paid || r.pending ? `you found $${w.symbol} block #${b.height}: +${fsol(b.reward)} SOL` : `you found $${w.symbol} block #${b.height}`, { kind: 'gold', ms: 7000, onclick: () => X.shareBlock ? X.shareBlock(card) : X.open('chain', { mint: w.mint }) });
      // once the gold has settled, the picture of the block opens by itself
      if (X.shareBlock) setTimeout(() => X.shareBlock(card), 3400);
    } else if (r.stale) log(r.error || 'someone found it first.', 'dim');
    else if (r.need) { log(r.error, 'bad'); R.elig = null; R.eligFor = ''; checkElig(true); stop('stopped: this wallet doesn’t hold enough to mine.'); return; }
    else if (r.cooldown) log(r.error, 'dim');
    else log(r.error || 'the block was refused.', 'bad');
    await pollWork(true);
  }

  // ---------------------------------------------------------------- the picture: a miner at the rock face
  const V = { W: 160, H: 104, rock: null, rockFor: '', sparks: [], chips: [], nug: [], swing: 0, nextHit: 0, flash: 0, shake: 0, raf: 0, last: 0, txt: [] };
  function seedOf(s) { let h = 2166136261; for (const c of String(s || 'x')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function makeRock(key) {
    const c = document.createElement('canvas'); c.width = V.W; c.height = V.H; const g = c.getContext('2d');
    let s = seedOf(key) || 1; const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
    const img = g.createImageData(V.W, V.H), d = img.data, set = (x, y, r, gg, b) => { if (x < 0 || y < 0 || x >= V.W || y >= V.H) return; const i = (y * V.W + x) * 4; d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255; };
    const edge = []; for (let y = 0; y < V.H; y++) edge[y] = 96 + Math.round(Math.sin(y * .21 + (s % 7)) * 4 + Math.sin(y * .07) * 5 + rnd() * 2);
    for (let y = 0; y < V.H; y++) for (let x = 0; x < V.W; x++) {
      const floor = y >= 90, n = rnd();
      if (floor) { const v = 20 + n * 10 - (y - 90) * .4; set(x, y, v + 8, v * .8, v * .62); continue; }
      if (x >= edge[y]) { const near = x - edge[y] < 2, v = 42 + n * 20 + (near ? 22 : 0) - (x - edge[y]) * .08; set(x, y, v + 12, v * .8, v * .62); }
      else { const v = 9 + n * 6 + (y / V.H) * 10; set(x, y, v + 4, v * .74, v * .55); }
    }
    // gold veins through the face
    for (let k = 0; k < 3; k++) { let x = edge[20 + k * 22] + 6 + rnd() * 30, y = 10 + k * 26 + rnd() * 10; for (let i = 0; i < 70; i++) { x += 1 + (rnd() < .3 ? 1 : 0); y += rnd() < .5 ? (rnd() < .5 ? -1 : 1) : 0; if (x < edge[Math.max(0, Math.min(V.H - 1, y | 0))] + 1 || y > 88) continue; const hi = rnd() < .25; set(x | 0, y | 0, hi ? 255 : 242, hi ? 226 : 178, hi ? 140 : 62); if (rnd() < .4) set(x | 0, (y | 0) + 1, 168, 114, 28); } }
    for (let k = 0; k < 14; k++) { const y = 4 + rnd() * 82 | 0, x = edge[y] + 4 + rnd() * 50 | 0; set(x, y, 255, 214, 120); }
    // rails on the floor
    for (let x = 0; x < V.W; x++) { set(x, 95, 92, 74, 58); set(x, 100, 92, 74, 58); if (x % 7 === 0) for (let y = 94; y < 102; y++) set(x, y, 52, 36, 24); }
    g.putImageData(img, 0, 0);
    return { c, edge };
  }
  function shake() { V.shake = 1; }
  function celebrate(reward, height, test) {
    V.flash = 1; SOUND.sfx(test ? 'ding' : 'born'); setTimeout(() => SOUND.sfx('coin'), 220);
    for (let i = 0; i < 46; i++) V.nug.push({ x: 104, y: 60, vx: -60 + Math.random() * 130, vy: -150 - Math.random() * 110, life: 1.8 + Math.random(), c: Math.random() < .7 ? '#f2c14e' : '#fff1cf' });
    V.txt.push({ t: test ? 'a find (test)' : `block #${height}`, s: reward ? `+${fsol(reward)} SOL` : '', until: performance.now() + 3200 });
    const cv = R.el && $('.rg-cv', R.el); if (cv && X.fx && X.fx.burst) { const r = cv.getBoundingClientRect(); X.fx.burst(r.left + r.width * .65, r.top + r.height * .55, { n: 40, speed: 220, colors: ['#ffb347', '#ffd27a', '#fff1cf', '#f2c14e', '#e8a33c'] }); }
    if (R.el) { const w = R.el.closest('.win'); if (w) { w.classList.remove('flash'); void w.offsetWidth; w.classList.add('flash'); } }
  }
  function frame(now) {
    V.raf = 0;
    if (!R.el || !document.body.contains(R.el)) return;
    const win = R.el.closest('.win'); if (!win || !win.classList.contains('open')) return;
    V.raf = requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - (V.last || now)) / 1000); V.last = now;
    const cv = $('.rg-cv', R.el); if (!cv) return; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    const key = R.mint || 'none'; if (V.rockFor !== key) { V.rock = makeRock(key); V.rockFor = key; }
    const sx = V.shake > 0 ? Math.round((Math.random() - .5) * 4 * V.shake) : 0; V.shake = Math.max(0, V.shake - dt * 2.5);
    g.setTransform(1, 0, 0, 1, sx, 0); g.drawImage(V.rock.c, 0, 0);
    // the lamp on the wall
    const fl = .75 + Math.sin(now / 130) * .08 + Math.random() * .06;
    const lg = g.createRadialGradient(18, 18, 1, 18, 18, 46); lg.addColorStop(0, `rgba(255,190,90,${.42 * fl})`); lg.addColorStop(1, 'rgba(255,170,60,0)'); g.fillStyle = lg; g.fillRect(0, 0, 70, 70);
    g.fillStyle = '#3a2a1c'; g.fillRect(17, 6, 2, 8); g.fillStyle = '#ffd27a'; g.fillRect(15, 13, 6, 6); g.fillStyle = '#fff1cf'; g.fillRect(17, 15, 2, 2);
    // the miner swings: faster when the rig is faster
    const rate = R.rate, mining = R.on && !R.cooling && rate > 0;
    const period = mining ? Math.max(170, 700 - Math.log10(1 + rate) * 70) : 0;
    if (mining && now >= V.nextHit) { V.nextHit = now + period; V.swing = 1; hit(rate); }
    V.swing = Math.max(0, V.swing - dt * (mining ? 1000 / period * 1.4 : 3));
    const img = X.SPR && X.SPR.pet, mx = 58, my = 58, lean = mining ? Math.sin(V.swing * Math.PI) * .32 : Math.sin(now / 700) * .03;
    if (img) {
      g.save(); g.translate(mx + 16, my + 31); g.rotate(lean); g.drawImage(img, -16 + (V.swing > .5 ? 2 : 0), -31 + (R.on ? 0 : Math.round(Math.sin(now / 500))), 32, 32); g.restore();
      // the hat lamp's beam toward the rock
      const bg2 = g.createLinearGradient(mx + 20, my + 10, mx + 60, my + 20); bg2.addColorStop(0, `rgba(255,236,170,${R.on ? .22 : .08})`); bg2.addColorStop(1, 'rgba(255,236,170,0)'); g.fillStyle = bg2;
      g.beginPath(); g.moveTo(mx + 20, my + 7); g.lineTo(mx + 70, my - 6); g.lineTo(mx + 70, my + 30); g.closePath(); g.fill();
    }
    // sparks and chips
    for (const p of V.sparks) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; g.fillStyle = p.life > .15 ? p.c : '#a8641c'; g.fillRect(p.x | 0, p.y | 0, 1, 1); }
    V.sparks = V.sparks.filter(p => p.life > 0 && p.y < 92);
    for (const p of V.chips) { p.life -= dt; p.x += p.vx * dt; p.y = Math.min(91, p.y + p.vy * dt); p.vy += 300 * dt; g.fillStyle = p.c; g.fillRect(p.x | 0, p.y | 0, 2, 2); }
    V.chips = V.chips.filter(p => p.life > 0);
    for (const p of V.nug) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 320 * dt; if (p.y > 90) { p.y = 90; p.vy *= -.35; p.vx *= .7; } g.fillStyle = p.c; g.fillRect(p.x | 0, p.y | 0, 2, 2); }
    V.nug = V.nug.filter(p => p.life > 0);
    if (V.flash > 0) { g.fillStyle = `rgba(255,214,120,${V.flash * .45})`; g.fillRect(0, 0, V.W, V.H); V.flash = Math.max(0, V.flash - dt * 1.3); }
    g.setTransform(1, 0, 0, 1, 0, 0);
    // big text on a find, drawn into the hud
    const t = V.txt[0]; const hud = $('.rg-win', R.el);
    if (t) { if (!hud.dataset.on) { hud.innerHTML = `<b>${esc(t.t)}</b>${t.s ? `<span>${esc(t.s)}</span>` : ''}`; hud.dataset.on = '1'; hud.classList.add('on'); } if (now > t.until) { V.txt.shift(); hud.classList.remove('on'); delete hud.dataset.on; } }
  }
  function hit(rate) {
    const x = (V.rock ? V.rock.edge[60] : 96) - 1, y = 60 + Math.random() * 10, n = Math.min(14, 3 + Math.round(Math.log10(1 + rate)));
    for (let i = 0; i < n; i++) V.sparks.push({ x, y, vx: -30 - Math.random() * 90, vy: -60 - Math.random() * 80, life: .25 + Math.random() * .35, c: Math.random() < .5 ? '#ffd27a' : '#fff1cf' });
    if (Math.random() < .5) V.chips.push({ x, y: y + 2, vx: -10 - Math.random() * 30, vy: -20, life: .8, c: '#5a4430' });
    if (Math.random() < .35) SOUND.sfx('pick');
  }
  function loop() { if (!V.raf) V.raf = requestAnimationFrame(frame); }

  // ---------------------------------------------------------------- the window
  function log(text, cls = '', sig) {
    const box = R.el && $('.rg-log', R.el); if (!box) return;
    const d = document.createElement('div'); d.className = 'rl ' + cls;
    d.innerHTML = `<span class="mute">${new Date().toTimeString().slice(0, 8)}</span> ${esc(text)}${sig ? ` <a class="tx" href="${esc(solscan(sig))}" target="_blank" rel="noopener noreferrer">tx ↗</a>` : ''}`;
    box.prepend(d); while (box.children.length > 60) box.lastChild.remove();
  }
  function fillSelect() {
    const sel = R.el && $('.rg-sel', R.el); if (!sel) return;
    const list = (X.MINES || []).filter(m => m.state === 'live');
    const cur = R.mint;
    const opts = list.map(m => `<option value="${esc(m.mint)}">$${esc(m.symbol)} · #${m.height} · pool ${fsol(m.pool)} SOL${m.miners ? ` · ${m.miners} mining` : ''}</option>`).join('');
    const extra = cur && !list.some(m => m.mint === cur) && R.work && R.work.mint === cur ? `<option value="${esc(cur)}">$${esc(R.work.symbol)} · #${R.work.height}</option>` : '';
    sel.innerHTML = (cur ? '' : '<option value="">pick a mine…</option>') + extra + opts || '<option value="">no mines open yet</option>';
    if (cur) sel.value = cur;
  }
  function paintShare() { const b = R.el && $('.rg-share', R.el); if (b) { b.hidden = !R.lastFind; if (R.lastFind) b.textContent = `share block #${R.lastFind.height}`; } }
  function paintBtn() {
    const b = R.el && $('.rg-go', R.el); if (!b) return;
    b.disabled = R.busy;
    const ok = R.elig && R.elig.eligible;
    b.textContent = R.busy ? 'starting…' : R.on ? '■ stop' : ok || !R.elig ? '⛏ start mining' : '⛏ test my rig (not paid)';
    b.classList.toggle('stop', R.on); b.classList.toggle('go', !R.on);
  }
  function paint() {
    if (!R.el) return;
    const el = R.el, w = R.work && R.work.mint === R.mint ? R.work : null, m = mineOf();
    R.rate = rateNow();
    $('.rg-rate', el).textContent = R.on ? (R.cooling ? 'waiting' : hs(R.rate)) : 'idle';
    $('.rg-state', el).textContent = !R.on ? (R.mint ? 'press start' : 'pick a mine') : R.cooling ? 'sitting out this block' : R.mode === 'live' ? `mining $${w ? w.symbol : ''} #${w ? w.height : ''}` : 'test run · not paid';
    const set = (k, v) => { const b = $(`[data-n="${k}"]`, el); if (b && b.textContent !== v) b.textContent = v; };
    const pool = w ? w.pool : m ? m.pool : null;
    set('pool', pool == null ? '—' : fsol(w ? w.reward || 0 : pool) + ' SOL');
    set('height', w ? '#' + w.height : m ? '#' + m.height : '—');
    set('exp', w ? '~' + big(w.expected) + ' hashes' : '—');
    const eta = w && R.rate > 0 ? w.expected / R.rate : Infinity;
    set('eta', R.on && !R.cooling && R.rate > 0 ? '~' + dur(eta) : '—');
    set('odds', R.on && !R.cooling && R.rate > 0 && w ? (100 * (1 - Math.exp(-R.rate * 60 / w.expected))).toFixed(R.rate * 60 / w.expected < .1 ? 2 : 0) + '%' : '—');
    const n = R.net || m || {}; set('net', (n.miners || 0) + (n.rate ? ' · ' + hs(n.rate) : ''));
    set('done', R.hashes ? big(R.hashes) : '—');
    const best = R.best, tz = w ? zeros(w.targetHex) : 0;
    const put = (sel, hex) => { const b = $(sel, el), v = hex ? hl(hex) : '—'; if (b.dataset.v !== v) { b.innerHTML = v; b.dataset.v = v; } };
    put('.rg-t', w && w.targetHex); put('.rg-b', best); put('.rg-s', R.sample);
    const zb = $('.rg-z', el); if (zb) zb.innerHTML = w ? Array.from({ length: Math.max(tz + 1, 4) }, (_, i) => `<i class="${best && zeros(best) > i ? 'on' : ''} ${i >= tz ? 'x' : ''}"></i>`).join('') + `<small>${best ? zeros(best) : 0} of ${tz}+ zeros</small>` : '';
    // who can mine
    const e = R.elig, box = $('.rg-elig', el), sym = w ? w.symbol : m ? m.symbol : '';
    let h = '';
    if (!R.mint) h = `<span class="dim">pick a mine to work. every block pays its finder the creator fees in that mine’s pool.</span>`;
    else if (!R.miner) h = `<span class="dim">type the wallet a block should pay. it has to hold 100,000 $${esc(sym)} (0.01% of the supply). no signature, nothing to approve.</span>`;
    else if (!isAddr(R.miner)) h = `<span class="bad">that isn’t a Solana address.</span>`;
    else if (!e || e.checking) h = `<span class="dim">checking what ${esc(short(R.miner))} holds…</span>`;
    else if (e.error) h = `<span class="bad">${esc(e.error)}</span> <button type="button" class="chip" data-x="re">check again</button>`;
    else if (e.eligible && e.cooldown) h = `<span class="warn">✓ ${esc(short(R.miner))} holds ${big(e.held)} $${esc(e.symbol)}, but found one of the last ${(X.CFG && X.CFG.cooldown) || 4} blocks, so it sits this one out.</span>`;
    else if (e.eligible) h = `<span class="ok">✓ ${esc(short(R.miner))} holds ${big(e.held)} $${esc(e.symbol)}. a block it finds pays it, straight to that wallet.</span>`;
    else h = `<span class="warn">${esc(short(R.miner))} holds ${big(e.held)} $${esc(e.symbol)}. to be paid for a block, hold 100,000 (0.01% of the supply).</span> <a class="tx" href="${esc(pumpfun(R.mint))}" target="_blank" rel="noopener noreferrer">buy on pump.fun ↗</a> <button type="button" class="chip" data-x="re">check again</button>`;
    if (box.dataset.h !== h) { box.innerHTML = h; box.dataset.h = h; const re = $('[data-x=re]', box); if (re) re.onclick = () => checkElig(true); }
    $('.rg-tn', el).textContent = R.threads;
    paintBtn();
  }
  A.rig = {
    title: 'rig.exe — mine a coin', short: 'rig.exe', icon: 'rig', w: 740, h: 690, minW: 440, minH: 420,
    build(el) {
      R.el = el;
      el.innerHTML = `<div class="rg">
        <div class="rg-head">
          <label class="field"><span>mine</span><select class="rg-sel"></select></label>
          <label class="field"><span>pay blocks to</span><div class="row"><input class="rg-wal" placeholder="your Solana wallet address" spellcheck="false" autocomplete="off"><button type="button" class="chip" data-x="use">use connected</button></div></label>
        </div>
        <div class="rg-mid">
          <div class="rg-cvw"><canvas class="rg-cv" width="160" height="104"></canvas><div class="rg-hud"><b class="rg-rate">idle</b><small class="rg-state"></small></div><div class="rg-win"></div></div>
          <div class="rg-nums">
            <div class="gold"><b data-n="pool">—</b><span>next block pays</span></div>
            <div><b data-n="height">—</b><span>block to find</span></div>
            <div><b data-n="exp">—</b><span>a block takes</span></div>
            <div><b data-n="eta">—</b><span>at your speed</span></div>
            <div><b data-n="odds">—</b><span>your odds this minute</span></div>
            <div><b data-n="net">—</b><span>mining this coin now</span></div>
            <div><b data-n="done">—</b><span>your hashes this run</span></div>
          </div>
        </div>
        <div class="rg-hash"><div><span>target</span><code class="rg-t">—</code></div><div><span>your best</span><code class="rg-b">—</code></div><div><span>hashing</span><code class="rg-s">—</code></div><div class="rg-z"></div></div>
        <div class="rg-elig"></div>
        <div class="rg-ctl"><div class="rg-thr"><span>threads</span><button type="button" class="chip" data-t="-1" aria-label="fewer threads">−</button><b class="rg-tn">${R.threads}</b><button type="button" class="chip" data-t="1" aria-label="more threads">+</button><small class="dim">of ${CORES} cores</small></div><button type="button" class="btn ghost rg-share" hidden>share my block</button><button type="button" class="btn go rg-go">⛏ start mining</button></div>
        <div class="rg-log scroll"></div></div>`;
      const sel = $('.rg-sel', el), wal = $('.rg-wal', el);
      wal.value = R.miner || (WAL.current() ? WAL.current().address : '');
      if (!R.miner && wal.value) R.miner = wal.value;
      sel.onchange = () => { const was = R.on; if (was) stop('switching mines.'); R.mint = sel.value; R.work = null; R.best = null; R.sample = null; R.elig = null; R.net = null; X.ls.set('mw:rigmine', R.mint); pollWork(); checkElig(); if (was) setTimeout(start, 300); };
      wal.oninput = () => { const v = wal.value.trim(); if (v === R.miner) return; if (R.on) stop('the payout wallet changed.'); R.miner = v; R.elig = null; R.eligFor = ''; X.ls.set('mw:miner', v); clearTimeout(R.wt); R.wt = setTimeout(() => checkElig(), 450); paint(); };
      $('[data-x=use]', el).onclick = async () => { try { const w = WAL.current() || await X.connect(); wal.value = w.address; wal.oninput(); } catch (e) { X.toast(e.message); } };
      $$('[data-t]', el).forEach(b => b.onclick = () => { R.threads = Math.max(1, Math.min(CORES, R.threads + +b.dataset.t)); X.ls.set('mw:threads', String(R.threads)); if (R.on && !R.cooling) startJob(); paint(); SOUND.sfx('tick'); });
      $('.rg-go', el).onclick = () => R.on ? stop() : start();
      $('.rg-share', el).onclick = () => R.lastFind && X.shareBlock && X.shareBlock(R.lastFind);
      paintShare();
      X.on('mines', () => { fillSelect(); paint(); });
      X.on('wallet', w => { if (w && !wal.value.trim()) { wal.value = w.address; wal.oninput(); } });
      X.on('feed', it => { if (it.kind === 'block' && it.mint === R.mint) { if (!R.on) log(it.text, 'blk'); pollWork(); } });
      fillSelect();
      if (!R.mint && (X.MINES || []).length) { const best = X.MINES.filter(m => m.state === 'live').sort((a, b) => b.pool - a.pool)[0]; if (best) { R.mint = best.mint; fillSelect(); } }
      log('rig.exe ready. your browser hashes the next block of a coin’s chain. no download, no signature.', 'dim');
      pollWork(); checkElig();
      clearInterval(R.idleT); R.idleT = setInterval(() => { if (!R.on && X.WM.isOpen('rig') && !document.hidden) pollWork(); }, 12000);
      clearInterval(R.uiT); R.uiT = setInterval(paint, 500);
      loop(); paint();
    },
    open(arg) {
      if (arg && arg.mint && arg.mint !== R.mint) { const sel = R.el && $('.rg-sel', R.el); R.mint = arg.mint; if (sel) { fillSelect(); sel.value = arg.mint; sel.onchange(); } }
      loop();
    },
    focus() { loop(); },
    close() { /* the rig keeps mining when the window is closed only if minimized; closing stops it */ stop('the rig window closed, so it stopped.'); },
  };
  return A;
}
