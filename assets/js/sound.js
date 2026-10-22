// bud sound: an original night track written in code with the Web Audio API, plus the greenhouse's small noises.
// Nothing is downloaded. Browsers only allow sound after a click or a key, so it starts on the first one.
const PROG = [                                            // Fmaj9 · Em7 · Dm9 · Cmaj9, two bars each at 56 bpm: a slow walk down
  { bass: 41, pad: [53, 57, 60, 64, 67], keys: [65, 69, 72, 76, 79, 81] },
  { bass: 40, pad: [52, 55, 59, 62, 67], keys: [64, 67, 71, 74, 76, 79] },
  { bass: 38, pad: [50, 53, 57, 60, 64], keys: [62, 65, 69, 72, 74, 77] },
  { bass: 36, pad: [48, 55, 59, 62, 64], keys: [60, 64, 67, 71, 72, 76] },
];
const BPM = 56, BEAT = 60 / BPM, BAR = BEAT * 4;
const hz = m => 440 * Math.pow(2, (m - 69) / 12);

export function createSound(store) {
  const get = (k, d) => { try { const v = store.get(k); return v == null ? d : v; } catch { return d; } };
  let ctx = null, master, musicBus, sfxBus, verb, echo, noiseBuf, rain = null, started = false, timer = 0, analyser = null;
  let muted = get('mw:mute', '0') === '1', vol = Math.max(0, Math.min(1, parseFloat(get('mw:vol', '.8')) || .8)), scene = 'intro';
  let step = 0, nextT = 0, seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const listeners = new Set();
  const running = () => !!ctx && started && ctx.state === 'running';
  const emit = () => listeners.forEach(f => f({ muted, vol, on: running() }));

  function impulse(sec, decay) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    try { ctx = new AC(); } catch { return false; }
    ctx.onstatechange = () => emit();
    master = ctx.createGain(); master.gain.value = muted ? 0 : vol;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; master.connect(comp).connect(ctx.destination);
    analyser = ctx.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = .78; comp.connect(analyser);   // the cd player's visualizer listens here
    verb = ctx.createConvolver(); verb.buffer = impulse(3.4, 2.6); const vg = ctx.createGain(); vg.gain.value = .2; verb.connect(vg).connect(master);
    echo = ctx.createDelay(1.5); echo.delayTime.value = BEAT * .75; const fb = ctx.createGain(); fb.gain.value = .26; const eg = ctx.createGain(); eg.gain.value = .14; const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 1800; echo.connect(ef);
    ef.connect(fb).connect(echo); ef.connect(eg).connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master); musicBus.connect(verb);
    sfxBus = ctx.createGain(); sfxBus.gain.value = .9; sfxBus.connect(master); sfxBus.connect(verb);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return true;
  }
  // ---------------------------------------------------------------- instruments: a soft pad, a felt electric piano, a round bass. no drums.
  const env = (g, t, a, peak, d, sus, r, end) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setTargetAtTime(sus, t + a, d); g.gain.setTargetAtTime(0, end, r); };
  function pad(notes, t, len, level) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 950; lp.Q.value = .4;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .07; lg.gain.value = 260; lfo.connect(lg).connect(lp.frequency); lfo.start(t); lfo.stop(t + len + 6);
    const g = ctx.createGain(); env(g, t, 2.8, level, 2.5, level * .8, 1.6, t + len); lp.connect(g).connect(musicBus);
    notes.forEach((m, i) => [-5, 5].forEach(cents => { const o = ctx.createOscillator(); o.type = i === 0 ? 'sine' : 'triangle'; o.frequency.value = hz(m); o.detune.value = cents; const og = ctx.createGain(); og.gain.value = .13; o.connect(og).connect(lp); o.start(t); o.stop(t + len + 6); }));
  }
  function keys(m, t, v, len = 3.4) {                       // two sines and a tine: warm, round, a little bell on top
    const f = hz(m), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = .2;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .012); g.gain.exponentialRampToValueAtTime(v * .35, t + .9); g.gain.exponentialRampToValueAtTime(.0001, t + len);
    const car = ctx.createOscillator(); car.type = 'sine'; car.frequency.value = f;
    const mod = ctx.createOscillator(); mod.type = 'sine'; mod.frequency.value = f; const mg = ctx.createGain(); mg.gain.setValueAtTime(f * .9, t); mg.gain.exponentialRampToValueAtTime(f * .03, t + 1.1); mod.connect(mg).connect(car.frequency);
    const tine = ctx.createOscillator(); tine.type = 'sine'; tine.frequency.value = f * 4.01; const tg = ctx.createGain(); tg.gain.setValueAtTime(v * .09, t); tg.gain.exponentialRampToValueAtTime(.00005, t + .45);
    car.connect(g).connect(lp); tine.connect(tg).connect(lp); lp.connect(musicBus); lp.connect(echo);
    [car, mod, tine].forEach(o => { o.start(t); o.stop(t + len + .1); });
  }
  function bass(m, t, len, level) {
    const g = ctx.createGain(); env(g, t, .35, level, 1.2, level * .7, .6, t + len - .2);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz(m); const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = hz(m) * 2; const g2 = ctx.createGain(); g2.gain.value = .12;
    o.connect(g); o2.connect(g2).connect(g); g.connect(musicBus); o.start(t); o2.start(t); o.stop(t + len + 2); o2.stop(t + len + 2);
  }
  function noise(t, dur, type, freq, q, level, bus = musicBus) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.loopStart = rnd(); const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(level, t); g.gain.exponentialRampToValueAtTime(.0004, t + dur);
    s.connect(f).connect(g).connect(bus); s.start(t, rnd() * 1.5); s.stop(t + dur + .05); return g;
  }
  // ---------------------------------------------------------------- the sequencer: eighth notes, scheduled a little ahead. the melody walks, it never jumps.
  let walk = 2, padBlk = -1;
  function schedule() {
    const now = ctx.currentTime, H = BEAT / 2;
    if (nextT < now + .02) {
      // the page was busy (the greenhouse building itself) and we fell behind: skip ahead quietly, never fire a pile of late notes
      const n = Math.ceil((now + .05 - nextT) / H); step += n; nextT += n * H;
      const blk = Math.floor(step / 16), ch = PROG[blk % 4];
      if (blk !== padBlk && step % 16 !== 0) { padBlk = blk; const rem = (16 - step % 16) * H; pad(ch.pad, now + .05, rem + .4, scene === 'desk' ? .045 : .055); bass(ch.bass, now + .05, rem, scene === 'desk' ? .12 : .08); }
    }
    const ahead = now + .6;
    while (nextT < ahead) {
      const t = nextT, s8 = step % 16, ch = PROG[Math.floor(step / 16) % 4], desk = scene === 'desk';
      if (s8 === 0) {
        padBlk = Math.floor(step / 16);
        pad(ch.pad, t, BAR * 2 + .4, desk ? .045 : .055);
        bass(ch.bass, t, BAR * 2, desk ? .12 : .08);
        if (rnd() < (desk ? .7 : .45)) [0, 2, 4].forEach((k, i) => keys(ch.keys[k], t + i * BEAT * .5 + rnd() * .02, (desk ? .05 : .04) - i * .006, 4));
      } else if (s8 % 2 === 0 && s8 > 3) {
        if (rnd() < (desk ? .34 : .2)) {
          walk = Math.max(0, Math.min(ch.keys.length - 1, walk + [-2, -1, -1, 1, 1, 2][Math.floor(rnd() * 6)]));
          keys(ch.keys[walk] + (rnd() < .2 ? 12 : 0), t + (rnd() - .5) * .03, (desk ? .045 : .035) * (.75 + rnd() * .4));
          if (rnd() < .2) keys(ch.keys[Math.max(0, walk - 1)], t + BEAT * .5, (desk ? .03 : .025));
        }
      }
      nextT += BEAT / 2; step++;
    }
  }
  function startRain() {
    if (rain) return;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
    const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(scene === 'intro' ? .07 : .018, ctx.currentTime, 1.5);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .13; lg.gain.value = .012; lfo.connect(lg).connect(g.gain); lfo.start();
    s.connect(hp).connect(lp).connect(g).connect(master); s.start();
    rain = { g };
  }
  function startMusic() {
    if (timer) return;
    nextT = ctx.currentTime + .15; step = 0;
    musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.setValueAtTime(musicBus.gain.value, ctx.currentTime); musicBus.gain.linearRampToValueAtTime(scene === 'desk' ? .78 : .86, ctx.currentTime + 6);
    timer = setInterval(schedule, 50); schedule();
  }
  // ---------------------------------------------------------------- the room's noises
  const SFX = {
    beep: t => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = 880; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.035, t + .01); g.gain.exponentialRampToValueAtTime(.0005, t + .35); o.connect(g).connect(sfxBus); o.start(t); o.stop(t + .4); },
    power: t => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(38, t + .3); g.gain.setValueAtTime(.28, t); g.gain.exponentialRampToValueAtTime(.001, t + .45); o.connect(g).connect(sfxBus); o.start(t); o.stop(t + .5); },
    click: t => { noise(t, .025, 'bandpass', 2400, 1.2, .16, sfxBus); noise(t + .05, .02, 'bandpass', 1600, 1.2, .08, sfxBus); },
    hdd: t => { for (let i = 0; i < 3; i++) noise(t + i * (.03 + rnd() * .04), .008, 'bandpass', 3400 + rnd() * 1200, 3, .02, sfxBus); },
    key: t => { noise(t, .035, 'bandpass', 2600 + rnd() * 900, 1.4, .09, sfxBus); const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 150 + rnd() * 40; g.gain.setValueAtTime(.06, t); g.gain.exponentialRampToValueAtTime(.001, t + .06); o.connect(g).connect(sfxBus); o.start(t); o.stop(t + .07); },
    thunder: (t, a = 1) => { noise(t, 2.8, 'lowpass', 150, .5, .36 * a, sfxBus); },
    creak: t => { const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(110, t + .9); o.frequency.linearRampToValueAtTime(85, t + 1.5);
      f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 6; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.05, t + .2); g.gain.linearRampToValueAtTime(.03, t + 1.2); g.gain.linearRampToValueAtTime(0, t + 1.6); o.connect(f).connect(g).connect(sfxBus); o.start(t); o.stop(t + 1.7); },
    clunk: (t, a = 1) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(55, t + .14); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.12 * a, t + .01); g.gain.exponentialRampToValueAtTime(.0005, t + .3); o.connect(g).connect(sfxBus); o.start(t); o.stop(t + .32); },
    squeak: t => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(1500, t + .06); o.frequency.exponentialRampToValueAtTime(700, t + .14); g.gain.setValueAtTime(.03, t); g.gain.exponentialRampToValueAtTime(.0005, t + .16); o.connect(g).connect(sfxBus); o.start(t); o.stop(t + .18); },
    buddy: t => { [[67, 0], [72, .09], [79, .18]].forEach(([m, d]) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = hz(m); g.gain.setValueAtTime(.05, t + d); g.gain.exponentialRampToValueAtTime(.0005, t + d + .4); o.connect(g).connect(sfxBus); o.start(t + d); o.stop(t + d + .45); }); },
    job: t => { [[84, 0], [91, .06]].forEach(([m, d]) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = hz(m); g.gain.setValueAtTime(.035, t + d); g.gain.exponentialRampToValueAtTime(.0005, t + d + .5); o.connect(g).connect(sfxBus); o.start(t + d); o.stop(t + d + .55); }); },
    coin: t => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.setValueAtTime(988, t); o.frequency.setValueAtTime(1319, t + .06); g.gain.setValueAtTime(.025, t); g.gain.exponentialRampToValueAtTime(.0005, t + .22); o.connect(g).connect(sfxBus); o.start(t); o.stop(t + .24); },
    hurt: t => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(70, t + .25); g.gain.setValueAtTime(.04, t); g.gain.exponentialRampToValueAtTime(.0005, t + .28); o.connect(g).connect(sfxBus); o.start(t); o.stop(t + .3); },
    dive: t => { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(880, t + 1.9); og.gain.setValueAtTime(.001, t); og.gain.exponentialRampToValueAtTime(.08, t + 1.6); og.gain.exponentialRampToValueAtTime(.001, t + 2.1); o.connect(og).connect(sfxBus); o.start(t); o.stop(t + 2.2);
      const o2 = ctx.createOscillator(), g2 = ctx.createGain(); o2.type = 'triangle'; o2.frequency.setValueAtTime(220, t); o2.frequency.exponentialRampToValueAtTime(1760, t + 1.9); g2.gain.setValueAtTime(.001, t); g2.gain.exponentialRampToValueAtTime(.03, t + 1.6); g2.gain.exponentialRampToValueAtTime(.001, t + 2.1); o2.connect(g2).connect(sfxBus); o2.start(t); o2.stop(t + 2.2); },
    chime: t => { [62, 69, 74, 78, 81, 86].forEach((m, i) => { const at = t + i * .085, o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = hz(m); o2.frequency.value = hz(m) * 2.01;
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(.07, at + .01); g.gain.exponentialRampToValueAtTime(.0005, at + 2.6); const g2 = ctx.createGain(); g2.gain.value = .25; o.connect(g); o2.connect(g2).connect(g); g.connect(sfxBus); o.start(at); o2.start(at); o.stop(at + 2.7); o2.stop(at + 2.7); }); },
    open: t => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(660, t); o.frequency.exponentialRampToValueAtTime(990, t + .06); g.gain.setValueAtTime(.035, t); g.gain.exponentialRampToValueAtTime(.0005, t + .12); o.connect(g).connect(sfxBus); o.start(t); o.stop(t + .14); },
    close: t => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(560, t); o.frequency.exponentialRampToValueAtTime(380, t + .07); g.gain.setValueAtTime(.03, t); g.gain.exponentialRampToValueAtTime(.0005, t + .12); o.connect(g).connect(sfxBus); o.start(t); o.stop(t + .14); },
    ding: t => { [76, 71].forEach((m, i) => { const at = t + i * .14, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = hz(m); g.gain.setValueAtTime(.06, at); g.gain.exponentialRampToValueAtTime(.0005, at + .9); o.connect(g).connect(sfxBus); o.start(at); o.stop(at + 1); }); },
    tick: t => { noise(t, .02, 'highpass', 4000, .7, .05, sfxBus); },
    crton: t => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(42, t + .5); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.16, t + .03); g.gain.exponentialRampToValueAtTime(.0005, t + .6); o.connect(g).connect(sfxBus); o.start(t); o.stop(t + .65);
      [62, 69, 74].forEach((m, i) => { const at = t + .18 + i * .09, k = ctx.createOscillator(), kg = ctx.createGain(); k.type = 'sine'; k.frequency.value = hz(m) * 2; kg.gain.setValueAtTime(.0001, at); kg.gain.exponentialRampToValueAtTime(.03, at + .02); kg.gain.exponentialRampToValueAtTime(.0005, at + 1.4); k.connect(kg).connect(sfxBus); k.start(at); k.stop(at + 1.5); }); },
    crtoff: t => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(60, t + .35); g.gain.setValueAtTime(.05, t); g.gain.exponentialRampToValueAtTime(.0005, t + .4); o.connect(g).connect(sfxBus); o.start(t); o.stop(t + .45); noise(t, .2, 'bandpass', 1200, .8, .04, sfxBus); },
    min: t => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(720, t); o.frequency.exponentialRampToValueAtTime(300, t + .14); g.gain.setValueAtTime(.025, t); g.gain.exponentialRampToValueAtTime(.0005, t + .16); o.connect(g).connect(sfxBus); o.start(t); o.stop(t + .18); },
    pop: t => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(980, t + .07); g.gain.setValueAtTime(.04, t); g.gain.exponentialRampToValueAtTime(.0005, t + .12); o.connect(g).connect(sfxBus); o.start(t); o.stop(t + .14); },
    born: t => { [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => { const at = t + i * .07, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = hz(m); g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(.045, at + .01); g.gain.exponentialRampToValueAtTime(.0005, at + 1.4); o.connect(g).connect(sfxBus); o.start(at); o.stop(at + 1.5); }); },
    pick: t => { noise(t, .03, 'bandpass', 3600 + rnd() * 800, 4, .05, sfxBus); const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(1750 + rnd() * 300, t); o.frequency.exponentialRampToValueAtTime(1200, t + .12); g.gain.setValueAtTime(.018, t); g.gain.exponentialRampToValueAtTime(.0005, t + .16); o.connect(g).connect(sfxBus); o.start(t); o.stop(t + .18); },
    boom: t => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(40, t + .5); g.gain.setValueAtTime(.25, t); g.gain.exponentialRampToValueAtTime(.001, t + .6); o.connect(g).connect(sfxBus); o.start(t); o.stop(t + .65); },
  };
  let lastSfx = {};
  return {
    unlock() { if (!init()) return; if (ctx.state === 'suspended') ctx.resume().then(emit, () => {}); if (!started) { started = true; startMusic(); emit(); } },
    // the off button: if the browser is still holding the sound back, a press means "play"; otherwise it mutes or unmutes
    toggle() { if (!running()) { this.unlock(); if (muted) this.setMuted(false); return; } this.setMuted(!muted); },
    scene(name) {
      scene = name; if (!ctx) return;
      const t = ctx.currentTime;
      musicBus.gain.cancelScheduledValues(t); musicBus.gain.setValueAtTime(musicBus.gain.value, t); musicBus.gain.linearRampToValueAtTime(name === 'desk' ? .78 : .86, t + 3);
      if (rain) rain.g.gain.setTargetAtTime(name === 'intro' ? .07 : .016, t, 1.6);
    },
    sfx(name, arg) {
      if (!ctx || !started || muted || !SFX[name]) return;
      const now = performance.now(); if (lastSfx[name] && now - lastSfx[name] < 40) return; lastSfx[name] = now;
      try { SFX[name](ctx.currentTime + .005, arg); } catch {}
    },
    setMuted(v) { muted = !!v; try { store.set('mw:mute', muted ? '1' : '0'); } catch {} if (ctx) { const t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setTargetAtTime(muted ? 0 : vol, t, .08); } emit(); },
    setVolume(v) { vol = Math.max(0, Math.min(1, v)); try { store.set('mw:vol', String(vol)); } catch {} if (ctx && !muted) master.gain.setTargetAtTime(vol, ctx.currentTime, .05); emit(); },
    get muted() { return muted; }, get volume() { return vol; }, get on() { return running(); },
    analyser: () => analyser, sceneName: () => scene,
    onChange(f) { listeners.add(f); f({ muted, vol, on: running() }); return () => listeners.delete(f); },
  };
}
