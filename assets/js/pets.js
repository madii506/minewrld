// The miners on the taskbar. Each one walks, stops, blinks and hops. When its mine claims fees or a block is found,
// it hops, gold pops out and it says what happened. Only one of them talks at a time. Click one to open its mine; pick one up and drop it.
export function installPets(X) {
  const { $, SPR, tinted, hueOf, walkFrames, fsol } = X;
  const layer = $('#pets'); if (!layer || !SPR.pet) return;
  const MAX = X.MOBILE ? 3 : 6, S = X.MOBILE ? 40 : 48, pets = new Map();
  const IDLE = ['dig.', 'still here.', 'gold?', 'the mine never closes.', '…', 'tink. tink.', 'checking the target.', 'launch a coin. i need a mine.', 'the pool is filling.', 'one more hash.', 'leading zeros…', 'press start in rig.exe.'];
  const COL = { claim: '#ffb347', block: '#ffd27a', dev: '#e07a4a', launch: '#ffe1b0' };
  let talker = null, quietUntil = 0, fxT = 0, fxN = 0;
  // the soft green glow is drawn into each frame once, so nothing has to be filtered while they walk
  const glow = fr => { const c = document.createElement('canvas'); c.width = 40; c.height = 41; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.shadowColor = 'rgba(92,240,138,.5)'; g.shadowBlur = 5; g.drawImage(fr, 4, 4); g.shadowBlur = 0; g.drawImage(fr, 4, 4); return c; };
  function make(key, b) {
    const el = document.createElement('div'); el.className = 'pet'; el.style.width = S + 'px'; el.style.height = S + 'px';
    const sh = document.createElement('i'); sh.className = 'pshadow'; el.appendChild(sh);
    const body = document.createElement('div'); body.className = 'pbody'; el.appendChild(body);
    const c = document.createElement('canvas'); c.width = 40; c.height = 41; body.appendChild(c);
    const tag = document.createElement('span'); tag.className = 'ptag'; tag.textContent = b ? b.budName : 'miner'; el.appendChild(tag);
    const say = document.createElement('div'); say.className = 'psay'; el.appendChild(say);
    layer.appendChild(el);
    const hue = hueOf(key), walk = walkFrames(tinted(SPR.pet, hue)).map(glow), bag = walkFrames(tinted(SPR.bag, hue)).map(glow);
    const p = { key, b, el, body, sh, c, g: c.getContext('2d'), tag, say, walk, bag, x: 120 + Math.random() * Math.max(40, innerWidth - S - 380), v: 0, dir: Math.random() < .5 ? -1 : 1, state: 'idle', t: 0, f: 0, bagT: 0, sayT: 0, y: 0, vy: 0, drag: false, blink: 0, sq: 0, air: false };
    el.addEventListener('pointerdown', e => { e.preventDefault(); p.drag = true; p.dragged = false; el.setPointerCapture(e.pointerId); const ox = e.clientX - p.x;
      const mv = ev => { p.dragged = true; p.x = ev.clientX - ox; p.y = Math.max(0, innerHeight - ev.clientY - 60); };
      const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); p.drag = false; p.air = p.y > 0;
        if (!p.dragged && p.b) X.openBud(p.b.mint); else if (!p.dragged) speak(p, IDLE[Math.random() * IDLE.length | 0], 2600, true); X.SOUND.sfx('squeak'); };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); });
    pets.set(key, p); el.animate([{ opacity: 0, transform: `translate(${p.x}px, ${-S + 20}px)` }, { opacity: 1, transform: `translate(${p.x}px, ${-S}px)` }], { duration: 400, easing: 'ease-out' });
    return p;
  }
  // one voice at a time: a new line replaces whoever was talking
  function speak(p, text, ms = 4200, force) {
    const now = performance.now(); if (!force && talker && talker !== p && now < quietUntil) return false;
    if (talker && talker !== p) { talker.say.classList.remove('on'); talker.sayT = 0; }
    p.say.textContent = text; p.say.classList.remove('on'); void p.say.offsetWidth; p.say.classList.add('on'); p.sayT = now + ms; talker = p; quietUntil = now + Math.min(ms, 2600); return true;
  }
  function sync() {
    if (!X.SET.pets) { pets.forEach(p => p.el.remove()); pets.clear(); talker = null; return; }
    const live = X.BUDS.filter(b => b.state === 'live').sort((a, b) => new Date(b.workedAt || b.liveAt || 0) - new Date(a.workedAt || a.liveAt || 0)).slice(0, MAX);
    const want = new Set(live.map(b => b.mint)); if (!live.length) want.add('__house');
    pets.forEach((p, k) => { if (!want.has(k) && !p.pinned) { p.el.remove(); pets.delete(k); if (talker === p) talker = null; } });
    live.forEach(b => { const p = pets.get(b.mint) || make(b.mint, b); p.b = b; p.tag.textContent = b.budName; });
    if (!live.length && !pets.has('__house')) { const p = make('__house', null); setTimeout(() => speak(p, 'no mines yet. launch one.', 4200, true), 2500); }
  }
  X.on('buds', sync); X.on('settings', sync); sync();
  // a real job: the bag, a hop, coins, the amount floating up, and a line about it
  X.on('feed', it => {
    // every miner on the taskbar hops when a block lands anywhere
    if (it.kind === 'block') pets.forEach((q, k) => { if (k !== it.mint && q.y === 0 && !q.drag) { q.vy = 120 + Math.random() * 60; q.air = true; q.sq = -.8; } });
    const p = pets.get(it.mint); if (!p) return;
    p.bagT = performance.now() + 5000; p.state = 'walk'; p.v = 60;
    if (p.y === 0) { p.vy = 170; p.air = true; p.sq = -1; }
    const r = p.el.getBoundingClientRect(), now = performance.now();
    if (now - fxT > 1000) { fxT = now; fxN = 0; }
    if (it.kind !== 'launch' && Number(it.sol) > 0 && now - (p.fxAt || 0) > 1400 && fxN < 3) { p.fxAt = now; fxN++;
      X.fx.burst(r.left + r.width / 2, r.top + 8, { n: 10, up: true, speed: 140, size: 4, colors: it.kind === 'block' ? ['#ffd27a', '#fff1cf', '#f2c14e'] : ['#ffb347', '#a8641c'] });
      X.fx.floatText(r.left + r.width / 2, r.top - 6, `${it.kind === 'claim' ? '+' : ''}${fsol(it.sol)} SOL`, COL[it.kind] || '#f2c14e');
    }
    speak(p, it.text.length > 52 ? it.text.slice(0, 50) + '…' : it.text, 5000, true);
  });
  X.on('pet:spawn', key => {
    const b = key ? X.budBy(key) : X.BUDS[Math.random() * X.BUDS.length | 0];
    const k = b ? b.mint : '__extra' + Math.random(); const p = pets.get(k) || make(k, b || null); p.pinned = true; p.x = innerWidth / 2; p.y = 140; p.vy = 0; p.air = true; speak(p, b ? `${b.budName} miner reporting for the shift.` : 'hi.', 4200, true);
  });
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame); const dt = Math.max(0, Math.min(.05, (now - last) / 1000)); last = now; if (document.hidden) return;
    const W = innerWidth;
    pets.forEach(p => {
      if (!p.drag) {
        p.t -= dt;
        if (p.t <= 0) { const r = Math.random(); p.state = r < .55 ? 'walk' : r < .86 ? 'idle' : 'hop'; p.t = 1.5 + Math.random() * 4; p.v = 22 + Math.random() * 28; if (Math.random() < .4) p.dir *= -1;
          if (p.state === 'hop' && p.y === 0) { p.vy = 150; p.air = true; p.sq = -.8; } if (Math.random() < .05) speak(p, IDLE[Math.random() * IDLE.length | 0], 2600); }
        const target = (p.state === 'walk' || p.bagT > now) ? p.v : 0; p.cur = (p.cur || 0) + (target - (p.cur || 0)) * Math.min(1, dt * 6);
        p.x += p.dir * p.cur * dt;
        if (p.x < 96) { p.x = 96; p.dir = 1; } if (p.x > W - S - 230) { p.x = W - S - 230; p.dir = -1; }
        if (p.y > 0 || p.vy) { p.vy -= 560 * dt; p.y = Math.max(0, p.y + p.vy * dt); if (p.y === 0) { if (p.air && Math.abs(p.vy) > 60) p.sq = Math.min(1, Math.abs(p.vy) / 260); p.vy = 0; p.air = false; } }
      }
      p.sq += (0 - p.sq) * Math.min(1, dt * 12);
      const moving = (p.cur || 0) > 6 || p.drag;
      p.f += dt * (moving ? 7 : 1.2); p.blink -= dt; if (p.blink < -.12) p.blink = 2 + Math.random() * 4;
      const bagOn = p.bagT > now, fi = moving ? Math.abs(p.f | 0) % 2 : 0, key = (bagOn ? 'b' : 'w') + fi + (p.blink < 0 ? 'x' : '');
      if (key !== p.key) { p.key = key; const frames = bagOn ? p.bag : p.walk, fr = frames[fi] || frames[0];
        p.g.clearRect(0, 0, 40, 41); p.g.drawImage(fr, 0, 0);
        if (p.blink < 0) { p.g.fillStyle = '#2c8a4c'; p.g.fillRect(10, 19, 3, 3); p.g.fillRect(16, 19, 3, 3); } }
      const flip = p.dir < 0 ? -1 : 1, sq = p.sq, sx = 1 + sq * .18, sy = 1 - sq * .2;
      p.el.style.transform = `translate(${p.x.toFixed(1)}px, ${(-S - p.y).toFixed(1)}px)`;
      p.body.style.transform = `scale(${(sx * flip).toFixed(3)}, ${sy.toFixed(3)})`;
      p.sh.style.transform = `translate(-50%, ${p.y.toFixed(1)}px) scale(${Math.max(.35, 1 - p.y / 160).toFixed(2)})`; p.sh.style.opacity = Math.max(.15, .55 - p.y / 300).toFixed(2);
      if (p.sayT && now > p.sayT) { p.say.classList.remove('on'); p.sayT = 0; if (talker === p) talker = null; }
    });
  }
  requestAnimationFrame(frame);
}
