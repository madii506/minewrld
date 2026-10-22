// Pixel art drawn in code: the desktop icons (16×16, auto-outlined) and the miner sprites, with a tint per mine so
// every mine's miner looks a little like itself. Everything ends up as canvases or data URLs; nothing else is downloaded.
const PAL = { k: '#120a04', g: '#ffb347', G: '#a8641c', l: '#ffe1b0', w: '#fff6e6', a: '#f2c14e', A: '#a8721c', s: '#b5653a', S: '#6e3a1f',
  b: '#6b5d52', B: '#2a211b', c: '#ece2d0', C: '#b7a68e', m: '#e0915a', M: '#8a4a24', r: '#ff6b6b', p: '#c58af0', e: '#eafff2', y: '#ffd27a' };

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
// draw on a 16×16 grid of palette letters, then wrap everything in a 1px dark outline
function icon(draw) {
  const G = Array.from({ length: 16 }, () => Array(16).fill('.'));
  const P = {
    px: (x, y, c) => { if (x >= 0 && x < 16 && y >= 0 && y < 16) G[y][x] = c; },
    rect: (x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) P.px(i, j, c); },
    h: (x1, x2, y, c) => { for (let i = x1; i <= x2; i++) P.px(i, y, c); },
    v: (x, y1, y2, c) => { for (let j = y1; j <= y2; j++) P.px(x, j, c); },
    map: (rows, ox = 0, oy = 0) => rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') P.px(ox + i, oy + j, ch); })),
  };
  draw(P);
  const out = G.map(r => r.slice());
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (G[y][x] === '.' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const r = G[y + dy]; return r && r[x + dx] && r[x + dx] !== '.' && r[x + dx] !== 'k'; })) out[y][x] = 'k';
  const c = canvas(16, 16), g = c.getContext('2d');
  out.forEach((r, y) => r.forEach((ch, x) => { if (ch !== '.') { g.fillStyle = PAL[ch]; g.fillRect(x, y, 1, 1); } }));
  return c.toDataURL();
}

export const ICONS = {};
const DEF = {
  term: P => { P.rect(1, 2, 14, 9, 'b'); P.rect(2, 3, 12, 7, 'B'); P.px(3, 4, 'g'); P.px(4, 5, 'g'); P.px(3, 6, 'g'); P.h(6, 9, 6, 'g'); P.rect(6, 11, 4, 1, 'b'); P.rect(4, 12, 8, 2, 'b'); },
  launch_old: P => { P.rect(4, 9, 8, 1, 'S'); P.rect(5, 10, 6, 3, 's'); P.rect(6, 13, 4, 1, 's'); P.v(7, 4, 8, 'g'); P.v(8, 4, 8, 'G'); P.map(['gg...gg', 'lgg.ggl', '.lgggl.'], 4, 2); P.px(7, 1, 'a'); P.px(8, 1, 'a'); P.px(6, 0, 'a'); P.px(9, 0, 'a'); },
  launch: P => { P.rect(2, 8, 12, 5, 'b'); P.rect(3, 9, 10, 3, 'B'); P.h(2, 13, 8, 'C'); P.px(4, 14, 'k'); P.px(11, 14, 'k'); P.rect(3, 13, 3, 2, 'b'); P.rect(10, 13, 3, 2, 'b'); P.map(['..aa.a..', '.ayaaya.', 'aaaaaaaa'], 4, 5); P.v(13, 1, 5, 'g'); P.h(11, 15, 3, 'g'); },
  buds: P => P.map(['....gg....gg....', '...gllg..gllg...', '...glggggglgg...', '....gggggggg....', '......gggg......', '....gggggggg....', '...gggggggggg...', '..gggwwggwwggg..', '..ggwwgggwwggg..', '..gggggggggggg..', '..ggggBBBBgggg..', '...gggggggggg...', '....gggggggg....', '....gG....Gg....', '....gg....gg....'], 0, 0),
  ledger: P => { P.rect(3, 2, 10, 12, 'c'); P.v(3, 2, 13, 'G'); P.v(4, 2, 13, 'g'); [5, 7, 9].forEach(y => P.h(6, 11, y, 'C')); P.px(8, 11, 'G'); P.px(9, 12, 'G'); P.px(10, 11, 'G'); P.px(11, 10, 'G'); P.px(12, 9, 'G'); },
  greenhouse: P => { [[7, 8, 3], [6, 9, 4], [5, 10, 5], [4, 11, 6]].forEach(([a, b, y]) => P.h(a, b, y, 'm')); P.rect(3, 7, 10, 7, 'm'); P.v(7, 7, 13, 'M'); P.v(8, 7, 13, 'M'); P.h(3, 12, 9, 'M'); P.h(4, 11, 6, 'M'); P.px(5, 12, 'g'); P.px(5, 11, 'g'); P.px(10, 12, 'g'); P.px(10, 11, 'g'); P.px(11, 11, 'g'); P.px(4, 11, 'g'); },
  readme: P => { P.rect(4, 2, 8, 12, 'c'); P.rect(10, 2, 2, 2, 'C'); [5, 7, 9, 11].forEach((y, i) => P.h(5, i % 2 ? 9 : 10, y, 'b')); },
  bagwork: P => { P.rect(6, 3, 4, 2, 'a'); P.h(6, 9, 5, 'S'); P.rect(5, 6, 6, 1, 'a'); P.rect(4, 7, 8, 6, 'a'); P.rect(5, 13, 6, 1, 'A'); P.v(11, 8, 12, 'A'); P.map(['.S.', 'SSS', 'S..', 'SSS', '..S', 'SSS', '.S.'], 7, 6); P.px(12, 2, 'a'); P.px(13, 1, 'a'); },
  paint: P => { P.rect(2, 4, 10, 8, 'c'); P.rect(3, 3, 7, 1, 'c'); P.rect(3, 12, 7, 1, 'c'); P.px(4, 6, 'r'); P.px(7, 5, 'a'); P.px(9, 7, 'g'); P.px(5, 9, 'p'); P.px(8, 10, 'm'); P.rect(6, 7, 2, 2, 'B'); P.v(12, 1, 8, 'A'); P.v(13, 1, 8, 'S'); P.rect(12, 9, 2, 3, 'b'); },
  display: P => { P.rect(1, 2, 14, 9, 'b'); P.rect(2, 3, 12, 7, 'B'); P.h(4, 11, 5, 'G'); P.px(6, 5, 'g'); P.h(4, 11, 7, 'G'); P.px(9, 7, 'g'); P.rect(6, 11, 4, 1, 'b'); P.rect(4, 12, 8, 2, 'b'); },
  bin: P => { P.rect(4, 3, 8, 1, 'b'); P.rect(6, 2, 4, 1, 'b'); P.rect(5, 4, 6, 10, 'b'); [6, 8, 10].forEach(x => P.v(x, 5, 12, 'B')); },
  mybuds: P => { DEF.buds(P); P.rect(11, 11, 4, 4, 'a'); P.px(12, 12, 'A'); P.px(13, 13, 'A'); },
  x: P => { P.rect(2, 2, 12, 12, 'B'); for (let i = 0; i < 8; i++) { P.px(4 + i, 4 + i, 'w'); P.px(11 - i, 4 + i, 'w'); } },
  welcome: P => { P.map(['.....aaaaaa.....', '...aayyaaaaaa...', '..aaaawwaaaaaa..', '.aaaaaaaaaaaaaa.', 'AAAAAAAAAAAAAAAA', '...kkkkkkkkkk...', '..kkkkkkkkkkkk..', '..kkeekkkkeekk..', '..kkeekkkkeekk..', '..kkkkkkkkkkkk..', '...kkkkkkkkkk...', '....kkkkkkkk....'], 0, 2); },
  miner: P => { DEF.welcome(P); },
  chat: P => { P.rect(2, 3, 12, 8, 'c'); P.rect(4, 11, 2, 2, 'c'); P.h(4, 11, 5, 'C'); P.h(4, 9, 7, 'C'); P.h(4, 10, 9, 'C'); },
  folder: P => { P.rect(2, 4, 5, 2, 'A'); P.rect(2, 5, 12, 9, 'a'); P.h(2, 13, 6, 'A'); },
  stats: P => { P.rect(1, 2, 14, 12, 'b'); P.rect(2, 3, 12, 10, 'B'); P.rect(3, 9, 2, 3, 'm'); P.rect(6, 7, 2, 5, 'g'); P.rect(9, 5, 2, 7, 'a'); P.rect(12, 8, 1, 4, 'r'); P.h(3, 12, 12, 'C'); P.px(4, 7, 'l'); P.px(7, 5, 'l'); P.px(10, 3, 'l'); },
  veins: P => { P.map(['.......b........', '......bbb.......', '.....bbBbb......', '....bbbBabb.....', '....bBbbbab.....', '...bbabbBbbb....', '..bbbbaBbbbbb...', '..bBbbbabbBbbb..', '.bbbBbbbaabbbbb.', '.bbabbbBbbbbabb.', 'bbbbaabbbbBbbbbb', 'bBbbbbabbbbbabbb'], 0, 3); P.px(9, 6, 'y'); P.px(5, 12, 'y'); },
  rig: P => { for (let i = 0; i < 10; i++) { P.px(3 + i, 13 - i, 'S'); P.px(4 + i, 13 - i, 's'); } P.map(['...cccc.....', '.cc....cc...', 'c.......C...'], 4, 1); P.px(12, 3, 'C'); P.px(13, 4, 'C'); P.px(13, 5, 'C'); P.px(3, 2, 'C'); P.px(2, 3, 'C'); P.px(14, 12, 'y'); P.px(12, 13, 'a'); P.px(14, 14, 'a'); },
  chain: P => { [[1, 5], [6, 5], [11, 5]].forEach(([x, y], i) => { P.rect(x, y, 4, 4, i === 2 ? 'a' : 'C'); P.rect(x + 1, y + 1, 2, 2, i === 2 ? 'y' : 'c'); }); P.h(5, 5, 7, 'b'); P.h(10, 10, 7, 'b'); P.h(1, 14, 11, 'G'); P.px(13, 3, 'y'); },
  pipe: P => { P.rect(0, 7, 3, 3, 'a'); P.px(1, 8, 'A'); P.h(3, 4, 8, 'G'); P.rect(5, 4, 5, 8, 'g'); P.px(5, 4, 'G'); P.px(9, 4, 'G'); P.px(6, 6, 'w'); P.px(8, 6, 'w'); P.h(6, 8, 9, 'G'); P.v(7, 2, 3, 'G'); P.v(11, 2, 13, 'b'); P.h(10, 10, 8, 'b'); P.h(12, 14, 2, 'r'); P.h(12, 14, 8, 'm'); P.h(12, 14, 13, 'a'); },
};
for (const k in DEF) ICONS[k] = icon(DEF[k]);

// ---------------------------------------------------------------- bud sprites
const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
export const SPR = { ready: null };
SPR.ready = (async () => {
  const [pet, glow] = await Promise.all(['/assets/img/miner.png', '/assets/img/miner-glow.png'].map(s => load(s).catch(() => null)));
  Object.assign(SPR, { pet, bag: pet, sil: glow || pet, cute: pet, glow });
  return SPR;
})();
export function hash(s) { let h = 2166136261; for (const c of String(s || '')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
// each mine's miner gets a hue of its own, kept in the warm metals: copper, brass, gold, rose
export const hueOf = key => [-26, -16, -8, 0, 6, 14, 24, 34][hash(key) % 8];
const tintCache = new Map();
export function tinted(img, hue) {
  if (!img) return null;
  const k = img.src + ':' + hue; if (tintCache.has(k)) return tintCache.get(k);
  const c = canvas(img.width, img.height), g = c.getContext('2d');
  g.filter = hue ? `hue-rotate(${hue}deg)` : 'none'; g.drawImage(img, 0, 0);
  // the eyes and the grin keep their own colours
  if (hue) { const o = canvas(img.width, img.height), og = o.getContext('2d'); og.drawImage(img, 0, 0); const d = og.getImageData(0, 0, img.width, img.height), t = g.getImageData(0, 0, img.width, img.height);
    for (let i = 0; i < d.data.length; i += 4) { const r = d.data[i], gg = d.data[i + 1], b = d.data[i + 2]; if ((r > 220 && gg > 220) || (r < 30 && gg < 45 && b < 35) || (r > 150 && gg < 160 && b < 110)) t.data.set(d.data.subarray(i, i + 4), i); }
    g.putImageData(t, 0, 0); }
  tintCache.set(k, c); return c;
}
// a two-frame walk: the body bobs and the feet take turns
export function walkFrames(img) {
  const out = [];
  for (let f = 0; f < 2; f++) {
    const c = canvas(img.width, img.height + 1), g = c.getContext('2d');
    g.drawImage(img, 0, 0, img.width, 26, 0, f ? 0 : 1, img.width, 26);
    g.drawImage(img, 0, 26, 12, 6, 0, 26 + (f ? 0 : 1), 12, 6);
    g.drawImage(img, 12, 26, img.width - 12, 6, 12, 26 + (f ? 1 : 0), img.width - 12, 6);
    out.push(c);
  }
  return out;
}
export function avatarURL(key, size = 32, kind = 'pet') {
  const img = SPR[kind]; if (!img) return ICONS.miner;
  const c = canvas(size, size), g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(tinted(img, hueOf(key)), 0, 0, size, size); return c.toDataURL();
}
