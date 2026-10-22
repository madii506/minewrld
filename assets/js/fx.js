// Small motion helpers for bud OS: numbers that count, pixel bursts, floating text, staggered entrances.
// Everything respects reduced motion and cleans up after itself.
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = t => 1 - Math.pow(1 - t, 3);

// count a number up (or down) to its new value; a changed value gets a short flash
export function countTo(el, to, fmt = v => String(Math.round(v)), ms = 900) {
  if (!el) return;
  to = Number(to) || 0; const from = el._v != null ? el._v : 0; el._v = to;
  if (RM || from === to || !document.body.contains(el)) { el.textContent = fmt(to); return; }
  cancelAnimationFrame(el._raf); const t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / ms); el.textContent = fmt(from + (to - from) * ease(k));
    if (k < 1) el._raf = requestAnimationFrame(step);
    else { el.textContent = fmt(to); if (from !== 0) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } }
  };
  el._raf = requestAnimationFrame(step);
}

// a burst of pixel confetti from a point on the screen
export function burst(x, y, opt = {}) {
  if (RM) return;
  const n = opt.n || 18, cols = opt.colors || ['#ffb347', '#f2c14e', '#ffe1b0', '#ffd27a'], g = opt.gravity ?? 260;
  const box = document.createElement('div'); box.className = 'fxb'; box.style.left = x + 'px'; box.style.top = y + 'px'; document.body.appendChild(box);
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i'), s = Math.round((opt.size || 5) * (Math.random() < .3 ? 1.6 : 1));
    p.style.width = p.style.height = s + 'px'; p.style.background = p.style.color = cols[i % cols.length]; box.appendChild(p);
    const a = opt.up ? -Math.PI / 2 + (Math.random() - .5) * 1.5 : Math.random() * Math.PI * 2, v = (opt.speed || 120) * (.45 + Math.random() * .8);
    const dx = Math.cos(a) * v, dy = Math.sin(a) * v, spin = (Math.random() < .5 ? -1 : 1) * 90, kf = [];
    for (let k = 0; k <= 8; k++) { const t = k / 8; kf.push({ transform: `translate(${(dx * t).toFixed(1)}px, ${(dy * t + g * t * t).toFixed(1)}px) rotate(${(spin * t * 4) | 0}deg)`, opacity: t < .6 ? 1 : 1 - (t - .6) / .4 }); }
    p.animate(kf, { duration: 650 + Math.random() * 450, easing: 'linear', fill: 'forwards' });
  }
  setTimeout(() => box.remove(), 1300);
}

// a few words that float up and fade, like +0.012 SOL
export function floatText(x, y, text, color = '#f2c14e') {
  if (RM) return;
  const d = document.createElement('div'); d.className = 'fxt'; d.textContent = text; d.style.left = x + 'px'; d.style.top = y + 'px'; d.style.color = color; document.body.appendChild(d);
  d.animate([{ transform: 'translate(-50%, 4px) scale(.8)', opacity: 0 }, { transform: 'translate(-50%, -12px) scale(1)', opacity: 1, offset: .18 }, { transform: 'translate(-50%, -44px) scale(1)', opacity: 0 }],
    { duration: 1500, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }).onfinish = () => d.remove();
}

// staggered entrance: each element gets the class with a growing delay
export function stagger(els, cls = 'in', step = 30, delay = 0) {
  [...els].forEach((e, i) => { e.style.animationDelay = (delay + i * step) + 'ms'; e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls); });
}

// type a line of text into an element, a few characters a frame
export function typeInto(el, text, cps = 60) {
  if (!el) return; cancelAnimationFrame(el._traf);
  if (RM) { el.textContent = text; return; }
  const t0 = performance.now();
  const step = now => { const n = Math.min(text.length, Math.floor((now - t0) / 1000 * cps)); el.textContent = text.slice(0, n); if (n < text.length) el._traf = requestAnimationFrame(step); };
  el._traf = requestAnimationFrame(step);
}
