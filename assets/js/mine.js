// The mine: a headframe on a hill at night in the rain, a cage that drops you down a timbered shaft past lanterns and gold,
// a tunnel at the bottom with a cart of ore on the rails, little miners in hard hats who turn to watch you, eyes in the
// cracks of the walls, and at the end of the tunnel an old amber terminal on a crate.
import * as THREE from './vendor/three.module.min.js';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';

let seed = 7; export const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
const BEIGE = 0xcfc3a3, BEIGE2 = 0xbfb08c;
export const A1 = new THREE.Color(1.0, .62, .24), A2 = new THREE.Color(1.0, .74, .38);
export function tex(w, h, draw, repeat, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const Hh = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf); const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(Hh(xi, yi, zi), Hh(xi + 1, yi, zi), u), L(Hh(xi, yi + 1, zi), Hh(xi + 1, yi + 1, zi), u), v), L(L(Hh(xi, yi, zi + 1), Hh(xi + 1, yi, zi + 1), u), L(Hh(xi, yi + 1, zi + 1), Hh(xi + 1, yi + 1, zi + 1), u), v), w);
}
const fbm = (x, y, z) => vnoise(x, y, z) * .55 + vnoise(x * 2.1, y * 2.1, z * 2.1) * .28 + vnoise(x * 4.3, y * 4.3, z * 4.3) * .17;

// a little miner: a dark round body, a hard hat with a lamp, glowing eyes. The head turns to whatever it watches.
export function makeMiner(parent, scale = 1, opt = {}) {
  const root = new THREE.Group(); parent.add(root); root.scale.setScalar(scale);
  const head = new THREE.Group(); head.position.y = .12; root.add(head);
  const skin = new THREE.MeshStandardMaterial({ color: opt.color || 0x121412, roughness: .6 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(.12, 24, 18), skin); body.scale.set(1, .98, .94); body.castShadow = true; head.add(body);
  const hatM = new THREE.MeshStandardMaterial({ color: 0xd9a032, roughness: .45, metalness: .1 });
  const hat = new THREE.Mesh(new THREE.SphereGeometry(.105, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), hatM); hat.position.y = .06; hat.castShadow = true; head.add(hat);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .012, 24), hatM); brim.position.y = .062; head.add(brim);
  const lampM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.1, 1.4), toneMapped: false });
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .02, 12), lampM); lamp.rotation.x = Math.PI / 2; lamp.position.set(0, .115, .092); head.add(lamp);
  const eyeM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.8, 2.4), toneMapped: false, side: THREE.DoubleSide });
  const eyes = [];
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.PlaneGeometry(.026, .03), eyeM); e.position.set(sx * .04, .01, .114); e.rotation.y = sx * .3; head.add(e); eyes.push(e); }
  for (const sx of [-1, 1]) { const a = new THREE.Mesh(new THREE.SphereGeometry(.03, 10, 8), skin); a.position.set(sx * .118, .08, .01); a.scale.set(.8, 1.1, .8); root.add(a); }
  root.userData = { head, eyes, eyeM, look: new THREE.Vector3(0, 0, 1), yaw: 0, pitch: 0, lag: .03 + rnd() * .05, blinkT: rnd() * 5 };
  return root;
}

export function build(scene, mobile) {
  const std = o => new THREE.MeshStandardMaterial(o);
  const mesh = (geo, mat, x = 0, y = 0, z = 0, parent = scene, shadow = !mobile) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = shadow; parent.add(m); return m; };
  const P = { bars: [], buds: [], crts: [] };
  const Z_IN = 7, Z_END = -8.6, RAD = 1.5, CY = 1.0, LEN = Z_IN - Z_END;
  const SH = 20, ZS = Z_IN + .75, SR = 1.9;   // the shaft: from the surface at y=SH down to the tunnel, centred on z=ZS
  Object.assign(P, { SH, ZS, Z_IN });

  // ---- outside: a mountain in the rain, a moon behind cloud
  const sky = tex(1024, 512, (g, w, h) => {
    const s = g.createLinearGradient(0, 0, 0, h); s.addColorStop(0, '#04050b'); s.addColorStop(.6, '#0d1020'); s.addColorStop(1, '#1c1626'); g.fillStyle = s; g.fillRect(0, 0, w, h);
    const m = g.createRadialGradient(w * .32, h * .25, 0, w * .32, h * .25, 110); m.addColorStop(0, 'rgba(210,215,240,.5)'); m.addColorStop(.15, 'rgba(160,170,220,.2)'); m.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = m; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 36; i++) { const x = rnd() * w, y = rnd() * h * .7, r = 40 + rnd() * 140, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(28,30,50,${.3 + rnd() * .3})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide, fog: false, toneMapped: false, color: 0x9a9a9a })); dome.position.set(0, SH - 6, ZS); scene.add(dome); P.sky = dome;
  const rockT = (bump) => tex(1024, 1024, (g, w, h) => {
    g.fillStyle = bump ? '#808080' : '#2a2520'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 7000; i++) { const x = rnd() * w, y = rnd() * h, r = 2 + rnd() * 18, k = rnd();
      g.fillStyle = bump ? `rgba(${k < .5 ? '255,255,255' : '0,0,0'},${.05 + rnd() * .12})` : (k < .45 ? `rgba(70,60,50,${.08 + rnd() * .2})` : k < .9 ? `rgba(8,6,5,${.1 + rnd() * .25})` : `rgba(110,92,70,${.1 + rnd() * .2})`);
      g.beginPath(); g.ellipse(x, y, r, r * (.4 + rnd() * .8), rnd() * 3, 0, 7); g.fill(); }
    for (let i = 0; i < 120; i++) { g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 1 + rnd() * 2.5; g.beginPath(); let x = rnd() * w, y = rnd() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rnd() - .5) * 90; y += (rnd() - .3) * 70; g.lineTo(x, y); } g.stroke(); }
    if (!bump) for (let i = 0; i < 220; i++) { g.fillStyle = `rgba(255,${190 + rnd() * 50 | 0},90,${.25 + rnd() * .5})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 2); }
  }, [6, 2], !bump);
  const RT = rockT(false), RB = rockT(true);
  const rockM = std({ map: RT, bumpMap: RB, bumpScale: 2.2, roughness: .93, color: 0xb0a090, side: THREE.BackSide });
  // the bottom of the shaft: a rock wall with the tunnel's mouth in it, framed in timber
  const face = new THREE.Shape(); face.moveTo(-2.5, -.6); face.lineTo(2.5, -.6); face.lineTo(2.5, 2.9); face.lineTo(-2.5, 2.9); face.lineTo(-2.5, -.6);
  const hole = new THREE.Path(); for (let i = 0; i <= 40; i++) { const a = Math.PI * i / 40; hole.lineTo(Math.cos(a) * 1.3, CY + .2 + Math.sin(a) * 1.1); } hole.lineTo(-1.3, -0.02); hole.lineTo(1.3, -0.02);
  face.holes.push(hole);
  const faceG = new THREE.ShapeGeometry(face, 24); const fp = faceG.attributes.position;
  for (let i = 0; i < fp.count; i++) { const x = fp.getX(i), y = fp.getY(i); fp.setZ(i, (fbm(x * .9, y * .9, 1) - .5) * .35); }
  faceG.computeVertexNormals();
  const faceM = std({ map: RT, bumpMap: RB, bumpScale: 2.2, roughness: .95, color: 0x8a7a6a });
  const fm = mesh(faceG, faceM, 0, 0, Z_IN + .06); fm.castShadow = false;
  // the surface: wet mud around the collar of the shaft, a headframe over it, a lamp, a sign
  const mudT = tex(1024, 1024, (g, w, h) => { g.fillStyle = '#1b1612'; g.fillRect(0, 0, w, h); for (let i = 0; i < 16000; i++) { const k = rnd(); g.fillStyle = k < .5 ? `rgba(60,50,40,${rnd() * .35})` : k < .95 ? `rgba(0,0,0,${rnd() * .4})` : `rgba(150,120,80,${rnd() * .3})`; const r = .5 + rnd() * 4; g.fillRect(rnd() * w, rnd() * h, r, r); } }, [10, 10]);
  const gs = new THREE.Shape(); gs.moveTo(-40, -40); gs.lineTo(40, -40); gs.lineTo(40, 40); gs.lineTo(-40, 40); gs.lineTo(-40, -40);
  const gh = new THREE.Path(); for (let i = 0; i <= 40; i++) { const a = Math.PI * 2 * i / 40; gh.lineTo(Math.cos(a) * 1.5, -ZS + Math.sin(a) * 1.5); } gs.holes.push(gh);
  const gg = new THREE.ShapeGeometry(gs, 8); gg.rotateX(-Math.PI / 2);
  const ggp = gg.attributes.position; for (let i = 0; i < ggp.count; i++) { const x = ggp.getX(i), z = ggp.getZ(i), d = Math.hypot(x, z - ZS); if (d > 6) ggp.setY(i, (fbm(x * .12, z * .12, 2) - .45) * Math.min(4, (d - 6) * .35)); }
  gg.computeVertexNormals();
  const surf = mesh(gg, std({ map: mudT, roughness: .5, metalness: .15, color: 0x8a7a6a }), 0, SH, 0, scene, false); surf.receiveShadow = !mobile;
  // rain over the surface
  const N = mobile ? 380 : 900, rp = new Float32Array(N * 6);
  for (let i = 0; i < N; i++) { const x = (rnd() - .5) * 18, y = rnd() * 6, z = ZS - 7 + rnd() * 16; rp.set([x, y, z, x - .01, y - .18, z], i * 6); }
  const rainG = new THREE.BufferGeometry(); rainG.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  P.rain = new THREE.LineSegments(rainG, new THREE.LineBasicMaterial({ color: 0x9aa6c8, transparent: true, opacity: .32, fog: false })); P.rain.position.y = SH; scene.add(P.rain);
  P.rainT = tex(8, 8, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 8, 8); });

  // ---- the tunnel
  const tg = new THREE.CylinderGeometry(RAD, RAD, LEN, 72, 120, true); tg.rotateX(Math.PI / 2);
  const tp = tg.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), y = tp.getY(i), z = tp.getZ(i), a = Math.atan2(y, x);
    const n = fbm(Math.cos(a) * 1.6 + 3, Math.sin(a) * 1.6 + 7, z * .8) - .5, n2 = vnoise(Math.cos(a) * 6, Math.sin(a) * 6, z * 3) - .5;
    const s = 1 + n * .26 + n2 * .06; tp.setX(i, x * s * 1.02); tp.setY(i, y * s * .92); tp.setZ(i, z);
  }
  tg.computeVertexNormals();
  const tun = mesh(tg, rockM, 0, CY, (Z_IN + Z_END) / 2); tun.castShadow = false;
  // the far end: a rock cap
  const cap = new THREE.CircleGeometry(RAD * 1.35, 48); const cpp = cap.attributes.position; for (let i = 0; i < cpp.count; i++) cpp.setZ(i, (fbm(cpp.getX(i), cpp.getY(i), 3) - .5) * .5);
  cap.computeVertexNormals(); mesh(cap, std({ map: RT, bumpMap: RB, bumpScale: 2.2, roughness: .95, color: 0x9a8a7a }), 0, CY, Z_END + .05);
  const dirt = tex(1024, 1024, (g, w, h) => { g.fillStyle = '#1d1813'; g.fillRect(0, 0, w, h); for (let i = 0; i < 16000; i++) { const k = rnd(); g.fillStyle = k < .5 ? `rgba(60,50,40,${rnd() * .35})` : k < .95 ? `rgba(0,0,0,${rnd() * .4})` : `rgba(150,120,80,${rnd() * .3})`; const r = .5 + rnd() * 4; g.fillRect(rnd() * w, rnd() * h, r, r); } }, [2, 10]);
  const floor = mesh(new THREE.PlaneGeometry(4.2, LEN), std({ map: dirt, roughness: .98, color: 0x9a8a7a }), 0, .002, (Z_IN + Z_END) / 2); floor.rotation.x = -Math.PI / 2;
  // rails + sleepers on the right
  const woodT = tex(1024, 256, (g, w, h) => { g.fillStyle = '#3a2a1c'; g.fillRect(0, 0, w, h); for (let i = 0; i < 160; i++) { const y = rnd() * h, c = 25 + rnd() * 35 | 0; g.strokeStyle = `rgba(${c + 50},${c + 30},${c + 12},${.2 + rnd() * .4})`; g.lineWidth = .8 + rnd() * 2.6; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 48) g.lineTo(x, y + Math.sin(x / 200 + i) * 3 + (rnd() - .5) * 2); g.stroke(); } });
  const steel = std({ color: 0x5a5f63, metalness: .75, roughness: .38 }), wood = std({ map: woodT, roughness: .85, color: 0x8a7a6a }), tw = std({ map: woodT, roughness: .8, color: 0xa08a70 });
  const RX = .55;
  for (const sx of [-.3, .3]) mesh(new THREE.BoxGeometry(.04, .045, LEN + 1.6), steel, RX + sx, .07, (Z_IN + Z_END) / 2 + .8, scene, false);
  const sleeper = new THREE.InstancedMesh(new THREE.BoxGeometry(.9, .045, .12), wood, 64); let si = 0; const M = new THREE.Matrix4();
  for (let z = Z_IN + 1.2; z > Z_END + .6 && si < 64; z -= .46) { M.makeRotationY((rnd() - .5) * .06).setPosition(RX + (rnd() - .5) * .03, .03, z); sleeper.setMatrixAt(si++, M); }
  sleeper.count = si; sleeper.receiveShadow = true; scene.add(sleeper);
  // timber sets: posts and a cap beam every 1.75 m
  const setsZ = []; for (let z = Z_IN - .2; z > Z_END + 1.2; z -= 1.75) setsZ.push(z);
  setsZ.forEach(z => {
    const lp = mesh(new THREE.CylinderGeometry(.075, .085, 2.1, 10), tw, -1.18, 1.03, z); lp.rotation.z = -.07;
    const rp2 = mesh(new THREE.CylinderGeometry(.075, .085, 2.1, 10), tw, 1.18, 1.03, z); rp2.rotation.z = .07;
    mesh(new THREE.BoxGeometry(2.6, .17, .18), tw, 0, 2.06, z);
  });
  // lanterns: one on every set, left and right in turn. they are the lights that clunk on as you walk in.
  const iron = std({ color: 0x1b1a18, metalness: .6, roughness: .5 });
  const glowT = tex(64, 64, (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.3, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
  setsZ.forEach((z, i) => {
    const sx = i % 2 ? 1 : -1, c = (i % 3 === 2 ? A2 : A1).clone();
    const g = new THREE.Group(); g.position.set(sx * 1.02, 1.66, z + .12); scene.add(g);
    mesh(new THREE.CylinderGeometry(.06, .07, .02, 12), iron, 0, .1, 0, g, false); mesh(new THREE.CylinderGeometry(.07, .07, .02, 12), iron, 0, -.1, 0, g, false);
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + .4; mesh(new THREE.CylinderGeometry(.006, .006, .2, 4), iron, Math.cos(a) * .062, 0, Math.sin(a) * .062, g, false); }
    const barM = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(.05), toneMapped: false });
    mesh(new THREE.CylinderGeometry(.05, .05, .16, 14), barM, 0, 0, 0, g, false);
    const cone = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); cone.scale.set(.9, .9, .9); g.add(cone);
    const spot = (mobile ? i % 3 : i % 2) ? null : new THREE.PointLight(c, 0, 8, 1.5);
    if (spot) { spot.position.set(sx * .86, 1.6, z + .1); scene.add(spot); }
    P.bars.push({ g, barM, cone, spot, c, z, x: sx, on: 0, want: 0, flick: i === 3 ? 1 : 0 });
  });

  // ---- the shaft: rock walls, a timber set every 2 m, guide rails, lanterns, gold, and the cage that rides it
  const RTs = RT.clone(), RBs = RB.clone(); RTs.repeat.set(4, 16); RBs.repeat.set(4, 16); RTs.needsUpdate = RBs.needsUpdate = true;
  const rockS = std({ map: RTs, bumpMap: RBs, bumpScale: 2.2, roughness: .93, color: 0xb0a090, side: THREE.BackSide });
  const wallR = (a, y) => { const n = fbm(Math.cos(a) * 1.4 + 11, Math.sin(a) * 1.4 + 5, y * .55) - .5, n2 = vnoise(Math.cos(a) * 5, Math.sin(a) * 5, y * 2.2) - .5; return SR * (1 + n * .22 + n2 * .05); };
  const shaftGeo = (y0, y1, t0, tl, segY) => {
    const g = new THREE.CylinderGeometry(SR, SR, y1 - y0, 56, segY, true, t0, tl); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i) + (y0 + y1) / 2, z = p.getZ(i), a = Math.atan2(x, z), k = wallR(a, y) / SR; p.setX(i, x * k); p.setZ(i, z * k); }
    g.computeVertexNormals(); return g;
  };
  const cut = 1.2;
  mesh(shaftGeo(-.6, 2.9, Math.PI + cut, Math.PI * 2 - cut * 2, 8), rockS, 0, (-.6 + 2.9) / 2, ZS, scene, false);
  mesh(shaftGeo(2.55, SH + .06, 0, Math.PI * 2, 96), rockS, 0, (2.55 + SH + .06) / 2, ZS, scene, false);
  const sfloor = mesh(new THREE.CircleGeometry(SR + .3, 32), std({ map: dirt, roughness: .98, color: 0x9a8a7a }), 0, .003, ZS); sfloor.rotation.x = -Math.PI / 2;
  // timber sets: a square of beams every 2 m, and two guide rails the cage runs on
  const setY = []; for (let y = 3.1; y < SH - .5; y += 2.6) setY.push(y);
  const beamS = new THREE.InstancedMesh(new THREE.BoxGeometry(2.95, .12, .13), tw, setY.length * 4); let bi = 0;
  setY.forEach(y => { for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; M.makeRotationY(a).setPosition(Math.sin(a) * 1.36, y, ZS + Math.cos(a) * 1.36); beamS.setMatrixAt(bi++, M); } });
  beamS.castShadow = false; beamS.receiveShadow = !mobile; scene.add(beamS);
  for (const sx of [-.7, .7]) mesh(new THREE.BoxGeometry(.1, SH, .16), tw, sx, SH / 2, ZS, scene, false);
  // lanterns down the shaft: they clunk on as the cage comes down to them
  const lantern = (x, y, z, c, withLight, flick) => {
    const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
    mesh(new THREE.CylinderGeometry(.06, .07, .02, 12), iron, 0, .1, 0, g, false); mesh(new THREE.CylinderGeometry(.07, .07, .02, 12), iron, 0, -.1, 0, g, false);
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + .4; mesh(new THREE.CylinderGeometry(.006, .006, .2, 4), iron, Math.cos(a) * .062, 0, Math.sin(a) * .062, g, false); }
    const barM = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(.05), toneMapped: false });
    mesh(new THREE.CylinderGeometry(.05, .05, .16, 14), barM, 0, 0, 0, g, false);
    const cone = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); cone.scale.set(1.0, 1.0, 1.0); g.add(cone);
    const spot = withLight ? new THREE.PointLight(c, 0, 7, 1.6) : null; if (spot) { spot.position.set(x * .8, y, ZS + (z - ZS) * .8); scene.add(spot); }
    return { g, barM, cone, spot, c, z, y, x, on: 0, want: 0, flick: flick ? 1 : 0 };
  };
  for (let y = SH - 2.6, i = 0; y > 3.0; y -= 2.6, i++) {
    const a = Math.PI + (i % 2 ? .8 : -.8), r = wallR(a, y) * .86;
    P.bars.push(Object.assign(lantern(Math.sin(a) * r, y, ZS + Math.cos(a) * r, (i % 3 === 1 ? A2 : A1).clone(), false, i === 3), { shaft: true }));
  }
  // gold in the shaft walls
  const goldS = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), std({ color: 0xffb040, emissive: 0xff8a10, emissiveIntensity: 1.2, metalness: .5, roughness: .35 }), 300); let gs2 = 0;
  { const Q2 = new THREE.Quaternion(), E2 = new THREE.Euler(), S4 = new THREE.Vector3();
    for (let c = 0; c < 46 && gs2 < 300; c++) { const a = rnd() * Math.PI * 2, y = 3 + rnd() * (SH - 4), r = wallR(a, y) * .97;
      for (let k = 0, cnt = 4 + (rnd() * 8 | 0); k < cnt && gs2 < 300; k++) { const rr = .008 + rnd() * .018, da = (rnd() - .5) * .12, dy = (rnd() - .5) * .22; E2.set(rnd() * 3, rnd() * 3, rnd() * 3); Q2.setFromEuler(E2);
        M.compose(S4.set(Math.sin(a + da) * r, y + dy, ZS + Math.cos(a + da) * r), Q2, new THREE.Vector3(rr, rr * (1 + rnd()), rr)); goldS.setMatrixAt(gs2++, M); } } }
  goldS.count = gs2; scene.add(goldS);

  { const DS = mobile ? 220 : 600, dp2 = new Float32Array(DS * 3); for (let i = 0; i < DS; i++) { const a = rnd() * Math.PI * 2, r = .3 + rnd() * 1.3; dp2.set([Math.sin(a) * r, rnd() * SH, ZS + Math.cos(a) * r], i * 3); }
    const dg2 = new THREE.BufferGeometry(); dg2.setAttribute('position', new THREE.BufferAttribute(dp2, 3));
    P.shaftDust = new THREE.Points(dg2, new THREE.PointsMaterial({ color: 0xffd9a0, size: .011, transparent: true, opacity: .32, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(P.shaftDust); }
  // ---- the cage: a steel frame, wire-mesh walls, a grated floor, a gate that drops shut, a lamp in the roof
  const cage = new THREE.Group(); cage.position.set(0, SH, ZS); scene.add(cage); P.cage = cage;
  const cageM = std({ color: 0x3a3c3e, metalness: .7, roughness: .45 });
  const meshT = tex(256, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(170,170,160,1)'; g.lineWidth = 6; for (let i = -h; i < w + h; i += 42) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke(); } }, [3, 5]);
  const wireM = std({ map: meshT, transparent: true, alphaTest: .35, side: THREE.DoubleSide, metalness: .6, roughness: .5, color: 0x8a8a84 });
  const wireF = std({ map: meshT.clone(), transparent: true, alphaTest: .35, side: THREE.DoubleSide, metalness: .6, roughness: .5, color: 0x7a7a74 }); wireF.map.repeat.set(4, 4); wireF.map.needsUpdate = true;
  const fl2 = mesh(new THREE.PlaneGeometry(1.12, 1.12), wireF, 0, .02, 0, cage, false); fl2.rotation.x = -Math.PI / 2;
  for (const [x, z, w, d] of [[0, .56, 1.16, .05], [0, -.56, 1.16, .05], [.56, 0, .05, 1.16], [-.56, 0, .05, 1.16]]) { mesh(new THREE.BoxGeometry(w, .06, d), cageM, x, .02, z, cage, false); mesh(new THREE.BoxGeometry(w, .06, d), cageM, x, 2.2, z, cage, false); }
  for (const sx of [-.56, .56]) for (const sz of [-.56, .56]) mesh(new THREE.CylinderGeometry(.03, .03, 2.2, 8), cageM, sx, 1.1, sz, cage, false);
  const side = (x, z, ry) => { const m = mesh(new THREE.PlaneGeometry(1.1, .95), wireM, x, .52, z, cage, false); m.rotation.y = ry; };
  side(-.56, 0, Math.PI / 2); side(.56, 0, -Math.PI / 2); side(0, .56, Math.PI);
  mesh(new THREE.BoxGeometry(1.16, .08, .08), cageM, 0, 2.2, 0, cage, false);
  const gate = new THREE.Group(); gate.position.set(0, 0, -.56); cage.add(gate); P.gate = gate;
  for (const y of [.3, .62, .94, 1.26]) mesh(new THREE.BoxGeometry(1.1, .035, .035), cageM, 0, y, 0, gate, false);
  for (const x of [-.36, 0, .36]) mesh(new THREE.BoxGeometry(.03, 1.0, .03), cageM, x, .78, 0, gate, false);
  const clampM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.9, 1.2), toneMapped: false });
  mesh(new THREE.CylinderGeometry(.05, .06, .05, 12), clampM, 0, 2.15, -.2, cage, false);
  P.cageLight = new THREE.PointLight(0xffc27a, 0, 12, 1.1); P.cageLight.position.set(0, 2.05, -.25); cage.add(P.cageLight);
  P.cable = mesh(new THREE.CylinderGeometry(.02, .02, 1, 6), std({ color: 0x2a2c2e, metalness: .8, roughness: .4 }), 0, SH, ZS, scene, false);

  // ---- the surface: a headframe over the shaft, the sheave wheel, a winch house, a lamp, a sign
  const beam = (a, b, r, m) => { const d = b.clone().sub(a), L = d.length(); const c = mesh(new THREE.CylinderGeometry(r, r * 1.1, L, 8), m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, scene, false); c.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); return c; };
  const HT = SH + 6.0; P.HT = HT;
  const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => [V(sx * 2.0, SH - .2, ZS + sz * 2.0), V(sx * .62, HT, ZS + sz * .62)]);
  legs.forEach(([a, b]) => beam(a, b, .11, tw));
  for (const f of [.28, .56, .82]) { const pts = legs.map(([a, b]) => a.clone().lerp(b, f)); for (let k = 0; k < 4; k++) beam(pts[k], pts[(k + 1) % 4], .06, tw); }
  for (let k = 0; k < 4; k++) { const [a0, b0] = legs[k], [a1, b1] = legs[(k + 1) % 4]; beam(a0.clone().lerp(b0, .28), a1.clone().lerp(b1, .56), .045, tw); }
  mesh(new THREE.BoxGeometry(1.6, .14, 1.6), tw, 0, HT, ZS, scene, false);
  for (const [x, z, w, d] of [[0, ZS + 1.75, 3.7, .3], [0, ZS - 1.75, 3.7, .3], [1.75, ZS, .3, 3.2], [-1.75, ZS, .3, 3.2]]) mesh(new THREE.BoxGeometry(w, .22, d), tw, x, SH + .06, z, scene, false);
  const wheelM = std({ color: 0x55595d, metalness: .8, roughness: .35 });
  const wheel = new THREE.Group(); wheel.position.set(-.7, HT + .85, ZS); scene.add(wheel); P.wheel = wheel;
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(.7, .05, 8, 40), wheelM));
  for (let k = 0; k < 6; k++) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, 1.4, 5), wheelM); sp.rotation.z = k / 6 * Math.PI; wheel.add(sp); }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .2, 12), wheelM); hub.rotation.x = Math.PI / 2; wheel.add(hub);
  for (const sz of [-.25, .25]) beam(V(-.7, HT, ZS + sz), V(-.7, HT + .85, ZS + sz), .05, tw);
  const house = V(-9.5, SH, ZS + 1.5);
  beam(V(-1.4, HT + .85, ZS), V(house.x + 1.3, SH + 1.6, ZS), .02, std({ color: 0x2a2c2e, metalness: .8, roughness: .4 }));
  mesh(new THREE.BoxGeometry(3.2, 2.6, 3.0), std({ map: woodT, color: 0x6a5848, roughness: .9 }), house.x, SH + 1.3, house.z, scene, false);
  const roof = mesh(new THREE.ConeGeometry(2.6, 1.1, 4), std({ color: 0x2a2420, roughness: .8 }), house.x, SH + 3.15, house.z, scene, false); roof.rotation.y = Math.PI / 4;
  const winM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.35, .55), toneMapped: false });
  mesh(new THREE.PlaneGeometry(.7, .5), winM, house.x + 1.61, SH + 1.5, house.z - .4, scene, false).rotation.y = Math.PI / 2;
  mesh(new THREE.PlaneGeometry(.7, .5), winM, house.x + .5, SH + 1.5, house.z + 1.51, scene, false);
  // the lamp on the headframe and its light
  P.surfLantern = lantern(1.15, SH + 2.5, ZS + 1.45, A1.clone(), false, true); P.surfLantern.want = 1;
  P.surfLight = new THREE.PointLight(0xffb060, 0, 20, 1.2); P.surfLight.position.set(1.4, SH + 2.4, ZS + 1.9); scene.add(P.surfLight);
  // the sign
  const signT = tex(1024, 448, (g, w, h) => {
    g.fillStyle = '#2a1d12'; g.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(0,0,0,${.15 + rnd() * .25})`; g.lineWidth = 1 + rnd() * 3; const y = rnd() * h; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + (rnd() - .5) * 8); g.stroke(); }
    g.fillStyle = '#120b06'; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 14, w, 14);
    g.textAlign = 'center'; g.font = '150px PX, monospace'; g.fillStyle = '#ffb347'; g.shadowColor = 'rgba(255,170,70,.6)'; g.shadowBlur = 24; g.fillText('MINE', w / 2, 200);
    g.shadowBlur = 0; g.font = '64px VT, monospace'; g.fillStyle = '#f2e6cc'; g.fillText('shaft no. 1  ·  every coin is a mine', w / 2, 300);
    g.font = '50px VT, monospace'; g.fillStyle = 'rgba(242,230,204,.6)'; g.fillText('the mine never closes', w / 2, 372);
  });
  const sign = new THREE.Group(); sign.position.set(2.4, SH, ZS + 1.8); sign.rotation.y = -.46; scene.add(sign);
  mesh(new THREE.BoxGeometry(2.1, .92, .06), std({ map: signT, roughness: .75 }), 0, 1.62, 0, sign, false);
  for (const x of [-.8, .8]) mesh(new THREE.BoxGeometry(.09, 1.7, .09), tw, x, .85, -.06, sign, false);
  // gold in the walls
  const goldM = std({ color: 0xffb040, emissive: 0xff8a10, emissiveIntensity: 1.2, metalness: .5, roughness: .35 });
  const gold = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), goldM, 360); let gn = 0; const Q = new THREE.Quaternion(), E = new THREE.Euler(), S3 = new THREE.Vector3();
  for (let c = 0; c < 44; c++) {
    const side = rnd() < .5 ? -1 : 1, a = side > 0 ? (-.3 + rnd() * 1.3) : (Math.PI - (-.3 + rnd() * 1.3)), z = Z_IN - 1 - rnd() * (LEN - 2);
    const zl = z - (Z_IN + Z_END) / 2, n0 = fbm(Math.cos(a) * 1.6 + 3, Math.sin(a) * 1.6 + 7, zl * .8) - .5, s = 1 + n0 * .26;
    const cx = Math.cos(a) * RAD * s * 1.02 * .965, cy = CY + Math.sin(a) * RAD * s * .92 * .965; if (cy < .3) continue;
    for (let k = 0, cnt = 4 + (rnd() * 8 | 0); k < cnt && gn < 360; k++) { const r = .007 + rnd() * .016; E.set(rnd() * 3, rnd() * 3, rnd() * 3); Q.setFromEuler(E);
      M.compose(S3.set(cx + (rnd() - .5) * .14, cy + (rnd() - .5) * .14, z + (rnd() - .5) * .2), Q, new THREE.Vector3(r, r * (1 + rnd()), r)); gold.setMatrixAt(gn++, M); }
  }
  gold.count = gn; scene.add(gold);
  // the cart of ore on the rails
  const cart = new THREE.Group(); cart.position.set(RX, 0, -1.4); scene.add(cart);
  const iron2 = std({ color: 0x2c2f31, metalness: .7, roughness: .45 }), rim = std({ color: 0x4a4e50, metalness: .8, roughness: .35 });
  const body = new THREE.BoxGeometry(.7, .4, .95); const bp = body.attributes.position; for (let i = 0; i < bp.count; i++) if (bp.getY(i) > 0) { bp.setX(i, bp.getX(i) * 1.18); bp.setZ(i, bp.getZ(i) * 1.1); }
  body.computeVertexNormals(); mesh(body, iron2, 0, .42, 0, cart); mesh(new THREE.BoxGeometry(.86, .04, 1.06), rim, 0, .63, 0, cart);
  for (const sx of [-.3, .3]) for (const sz of [-.32, .32]) { const w = mesh(new THREE.CylinderGeometry(.1, .1, .06, 16), iron2, sx, .12, sz, cart); w.rotation.z = Math.PI / 2; }
  const oreM = std({ color: 0xffc35a, emissive: 0xff8f1f, emissiveIntensity: 2.4, metalness: .6, roughness: .35 }), ore2 = std({ color: 0x3a332c, roughness: .9 });
  for (let i = 0; i < 40; i++) { const r = .045 + rnd() * .06, m = mesh(new THREE.IcosahedronGeometry(r, 0), rnd() < .45 ? oreM : ore2, (rnd() - .5) * .72, .62 + rnd() * .12, (rnd() - .5) * .9, cart, false); m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); }
  P.jarGlow = new THREE.PointLight(0xffa13a, .25, 2.2, 2); P.jarGlow.position.set(RX, .95, -1.4); scene.add(P.jarGlow);
  // dust hanging in the lantern light
  const DN = mobile ? 160 : 420, dp = new Float32Array(DN * 3); for (let i = 0; i < DN; i++) dp.set([(rnd() - .5) * 2.4, .2 + rnd() * 1.9, Z_IN - rnd() * (LEN - .5)], i * 3);
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  P.sporeM = new THREE.PointsMaterial({ color: 0xffd9a0, size: .012, transparent: true, opacity: .2, depthWrite: false, blending: THREE.AdditiveBlending }); P.spores = new THREE.Points(dg, P.sporeM); scene.add(P.spores);

  // ---- little miners along the tunnel: on crates, on the cart, by the desk. they turn to watch.
  const crateT = tex(512, 512, (g, w, h) => { g.fillStyle = '#4a3420'; g.fillRect(0, 0, w, h); for (let p = 0; p < 4; p++) { const y = p * 128; g.fillStyle = p % 2 ? '#523a24' : '#46311d'; g.fillRect(0, y + 2, w, 124); for (let i = 0; i < 30; i++) { g.strokeStyle = `rgba(20,12,6,${.2 + rnd() * .3})`; g.lineWidth = 1 + rnd() * 2; const yy = y + 6 + rnd() * 116; g.beginPath(); g.moveTo(0, yy); g.lineTo(w, yy + (rnd() - .5) * 6); g.stroke(); } } g.fillStyle = '#2a1d10'; g.fillRect(0, 0, 36, h); g.fillRect(w - 36, 0, 36, h); g.save(); g.translate(w / 2, h / 2); g.rotate(-.78); g.fillRect(-w * .72, -16, w * 1.44, 32); g.restore(); });
  const crateM = std({ map: crateT, roughness: .85 });
  const crate = (x, z, s, ry = 0) => { const c = mesh(new THREE.BoxGeometry(.5 * s, .44 * s, .5 * s), crateM, x, .22 * s, z); c.rotation.y = ry; return c; };
  [[-.85, 4.3, 1, .3], [-.9, 1.2, .9, -.2], [-.82, -2.6, 1.1, .5], [.95, 2.6, .8, .1]].forEach(([x, z, s, ry]) => { crate(x, z, s, ry); const m = makeMiner(scene, s * 1.05); m.position.set(x, .44 * s + .1 * s, z); m.rotation.y = Math.PI * .92; P.buds.push(m); });
  [[RX - .15, -1.25, .9], [-1.0, -5.2, 1.4], [1.05, -5.6, 1.25]].forEach(([x, z, s], i) => { const m = makeMiner(scene, s); m.position.set(x, i === 0 ? .78 : .1 * s, z); m.rotation.y = Math.PI * .92; P.buds.push(m); });

  // ---- eyes in the cracks: little ones, mostly hidden in the walls. a few watch the mouth already; the rest turn as you pass.
  const tinyBody = new THREE.SphereGeometry(.12, 14, 10), tinyHat = new THREE.SphereGeometry(.1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const tinySkin = std({ color: 0x141614, roughness: .5 }), tinyHatM = std({ color: 0xb98a2c, roughness: .5 });
  P.tinyEyeM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2.05, 1.75), toneMapped: false, side: THREE.DoubleSide });
  const tEyeG = new THREE.PlaneGeometry(.026, .03);
  const TN0 = mobile ? 26 : 64, TN = TN0 + (mobile ? 8 : 22);
  const tB = new THREE.InstancedMesh(tinyBody, tinySkin, TN), tH = new THREE.InstancedMesh(tinyHat, tinyHatM, TN), tE = new THREE.InstancedMesh(tEyeG, P.tinyEyeM, TN * 2);
  [tB, tH, tE].forEach(m => { m.frustumCulled = false; scene.add(m); });
  const LB = new THREE.Matrix4().compose(V(0, .12, 0), new THREE.Quaternion(), V(1, .96, .94)), LH = new THREE.Matrix4().compose(V(0, .18, 0), new THREE.Quaternion(), V(1, 1, 1));
  const tEyes = [-1, 1].map(sx => ({ p: V(sx * .04, .13, .113), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, sx * .3, 0)), sx }));
  P.tiny = [];
  for (let i = TN0; i < TN; i++) {
    const a = rnd() * Math.PI * 2, y = 3.4 + rnd() * (SH - 5), r = wallR(a, y) * .9;
    const o = new THREE.Object3D(); o.position.set(Math.sin(a) * r, y, ZS + Math.cos(a) * r); o.scale.setScalar(.3 + rnd() * .28); o.rotation.y = a + Math.PI + (rnd() - .5) * .5;
    o.userData = { lag: .02 + rnd() * .05, nb: rnd() * 6000, wake: 99, blink: 1, bob: rnd() * 6, shaft: true };
    P.tiny[i] = o;
  }
  for (let i = 0; i < TN0; i++) {
    const z = Z_IN - .6 - rnd() * (LEN - 1.6), side = rnd() < .5 ? -1 : 1, a = side > 0 ? (-.25 + rnd() * .9) : (Math.PI + .25 - rnd() * .9);
    const zl = z - (Z_IN + Z_END) / 2, n0 = fbm(Math.cos(a) * 1.6 + 3, Math.sin(a) * 1.6 + 7, zl * .8) - .5, s = 1 + n0 * .26;
    let x = Math.cos(a) * RAD * s * 1.02 * .9, y = CY + Math.sin(a) * RAD * s * .92 * .9; if (y < .12) y = .12;
    const o = new THREE.Object3D(); o.position.set(x, y - .06, z); o.scale.setScalar(.32 + rnd() * .3);
    const watching = rnd() < .3; o.rotation.y = watching ? -side * .9 + (rnd() - .5) * .6 : -side * Math.PI / 2 + Math.PI + (rnd() - .5) * .8;
    o.userData = { lag: .015 + rnd() * .05, nb: rnd() * 6000, wake: 3.2 + rnd() * 4.2, blink: 1, bob: rnd() * 6 };
    P.tiny[i] = o;
  }
  const tm = new THREE.Matrix4(), em = new THREE.Matrix4(), es = new THREE.Vector3();
  P.tinyUpdate = (t = 0) => {
    P.tiny.forEach((o, i) => {
      const u = o.userData; o.scale.y = o.scale.x * (1 + Math.sin(t * 1.6 + u.bob) * .025); o.updateMatrix();
      tB.setMatrixAt(i, tm.multiplyMatrices(o.matrix, LB)); tH.setMatrixAt(i, tm.multiplyMatrices(o.matrix, LH));
      tEyes.forEach((e, k) => { em.compose(e.p, e.q, es.set(-e.sx, Math.max(.001, u.blink), 1)); tE.setMatrixAt(i * 2 + k, tm.multiplyMatrices(o.matrix, em)); });
    });
    tB.instanceMatrix.needsUpdate = tH.instanceMatrix.needsUpdate = tE.instanceMatrix.needsUpdate = true;
  };
  P.tinyUpdate();

  // ---- the end of the tunnel: crates for a desk, the terminal, a lantern, a slate with the last blocks in chalk
  const deskZ = -7.25, DH = .78;
  for (const sx of [-.48, .48]) mesh(new THREE.BoxGeometry(.9, DH - .05, .8), crateM, sx, (DH - .05) / 2, deskZ + .12);
  mesh(new THREE.BoxGeometry(2.0, .05, .95), std({ map: woodT, roughness: .7, color: 0x9a8064 }), 0, DH - .025, deskZ + .12);
  const pc = new THREE.Group(); pc.position.set(0, DH, deskZ); scene.add(pc); P.pc = pc;
  const plastic = std({ color: BEIGE, roughness: .55 }), plastic2 = std({ color: BEIGE2, roughness: .6 }), dark = std({ color: 0x2a2a26, roughness: .7 }), black = std({ color: 0x0b0b0c, roughness: .5 });
  mesh(new RoundedBoxGeometry(.98, .2, .78, 4, .02), plastic, 0, .1, -.12, pc);
  const front = (w, h, x, y, m = black) => mesh(new THREE.BoxGeometry(w, h, .01), m, x, y, .272, pc);
  front(.3, .016, .2, .12); front(.3, .016, .2, .07); front(.12, .03, -.3, .1, dark); for (let i = 0; i < 7; i++) front(.004, .1, -.15 + i * .018, .1, dark);
  P.ledMat = new THREE.MeshBasicMaterial({ color: 0x261804, toneMapped: false }); P.hddMat = new THREE.MeshBasicMaterial({ color: 0x2a1c08, toneMapped: false });
  mesh(new THREE.BoxGeometry(.014, .014, .01), P.ledMat, -.42, .06, .274, pc); mesh(new THREE.BoxGeometry(.014, .014, .01), P.hddMat, -.39, .06, .274, pc);
  const mon = new THREE.Group(); mon.position.set(0, .26, -.05); pc.add(mon); P.mon = mon;
  mesh(new THREE.CylinderGeometry(.16, .2, .05, 32), plastic2, 0, -.035, -.05, mon);
  mesh(new RoundedBoxGeometry(.8, .64, .1, 5, .03), plastic, 0, .32, .06, mon);
  const back = new THREE.BoxGeometry(.74, .58, .5); const bkp = back.attributes.position;
  for (let i = 0; i < bkp.count; i++) if (bkp.getZ(i) < 0) { bkp.setX(i, bkp.getX(i) * .66); bkp.setY(i, bkp.getY(i) * .7 + .02); }
  back.computeVertexNormals(); mesh(back, plastic2, 0, .32, -.2, mon);
  mesh(new THREE.BoxGeometry(.64, .49, .02), std({ color: 0x1a1a18, roughness: .4 }), 0, .335, .105, mon);
  P.monLed = new THREE.MeshBasicMaterial({ color: 0x2a1c08, toneMapped: false }); mesh(new THREE.BoxGeometry(.012, .012, .01), P.monLed, .23, .045, .116, mon);
  const sg = new THREE.PlaneGeometry(.6, .45, 24, 18); const sp = sg.attributes.position;
  for (let i = 0; i < sp.count; i++) { const x = sp.getX(i) / .3, y = sp.getY(i) / .225; sp.setZ(i, .016 * (1 - .5 * (x * x + y * y))); }
  sg.computeVertexNormals(); P.screenGeo = sg;
  P.screenAt = (map) => { const s = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ map, toneMapped: false })); s.position.set(0, .335, .118); mon.add(s); P.screen = s; return s; };
  P.SCREEN_C = V(0, DH + .26 + .335, deskZ - .05 + .118);
  const kb = new THREE.Group(); kb.position.set(0, DH + .018, deskZ + .43); kb.rotation.x = .05; scene.add(kb);
  mesh(new RoundedBoxGeometry(.86, .03, .27, 3, .01), plastic, 0, 0, 0, kb);
  const keys = new THREE.InstancedMesh(new THREE.BoxGeometry(.034, .014, .034), plastic2, 120); let n = 0; const base = [], kidx = {}; const KM = new THREE.Matrix4();
  for (let r = 0; r < 6; r++) for (let c = 0; c < 20; c++) { if (r === 5 && c > 3 && c < 12) continue; KM.makeTranslation(-.38 + c * .04, .021, -.1 + r * .042); keys.setMatrixAt(n, KM); base[n] = KM.clone(); kidx[r + ':' + c] = n; n++; }
  KM.makeScale(8, 1, 1).setPosition(-.06, .021, .11); keys.setMatrixAt(n, KM); base[n] = KM.clone(); kidx.space = n; n++;
  keys.count = n; keys.castShadow = keys.receiveShadow = !mobile; kb.add(keys); Object.assign(P, { keys, base, kidx });
  mesh(new RoundedBoxGeometry(.12, .05, .2, 4, .024), plastic, .66, DH + .025, deskZ + .45);
  // the desk lantern: a big one on a hook over the terminal, warm on the keyboard
  const dl = new THREE.Group(); dl.position.set(-.62, DH + .62, deskZ + .1); scene.add(dl);
  mesh(new THREE.CylinderGeometry(.075, .085, .025, 14), iron, 0, .14, 0, dl, false); mesh(new THREE.CylinderGeometry(.085, .085, .025, 14), iron, 0, -.13, 0, dl, false);
  for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + .4; mesh(new THREE.CylinderGeometry(.007, .007, .26, 4), iron, Math.cos(a) * .076, 0, Math.sin(a) * .076, dl, false); }
  P.shadeM = std({ color: 0x5a3a12, roughness: .2, emissive: 0xffa040, emissiveIntensity: 0, transparent: true, opacity: .95 });
  mesh(new THREE.CylinderGeometry(.064, .064, .22, 16), P.shadeM, 0, 0, 0, dl, false);
  mesh(new THREE.CylinderGeometry(.006, .006, .5, 4), iron, 0, .38, 0, dl, false);
  P.lamp = new THREE.SpotLight(0xffb060, 0, 2.2, .95, .7, 1.6); P.lamp.position.set(-.62, DH + .6, deskZ + .1); P.lamp.target.position.set(-.1, DH, deskZ + .4);
  P.lamp.castShadow = !mobile; P.lamp.shadow.mapSize.set(1024, 1024); P.lamp.shadow.bias = -.0015; scene.add(P.lamp, P.lamp.target);
  // the slate: the last blocks found down here, in chalk. it updates while you are close.
  const CW = 1024, CH = 640; const cc = document.createElement('canvas'); cc.width = CW; cc.height = CH; const cg = cc.getContext('2d');
  const chartT = new THREE.CanvasTexture(cc); chartT.colorSpace = THREE.SRGBColorSpace;
  const slate = new THREE.Group(); slate.position.set(1.32, 1.12, deskZ + .5); slate.rotation.y = -.55; scene.add(slate);
  mesh(new THREE.BoxGeometry(1.1, .72, .04), std({ map: woodT, color: 0x7a6248, roughness: .8 }), 0, 0, -.025, slate, false);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.0, .625), new THREE.MeshBasicMaterial({ map: chartT, toneMapped: false })); slate.add(board);
  for (const lx of [-.42, .42]) { const l = mesh(new THREE.BoxGeometry(.035, 1.1, .035), std({ color: 0x3a2a1c, roughness: .8 }), lx, -.55, -.06, slate, false); }
  P.chartGlow = new THREE.PointLight(0xffc070, .25, 1.8, 2); P.chartGlow.position.set(1.15, 1.2, deskZ + .9); scene.add(P.chartGlow);
  const rows = []; let hgt = 811;
  const chalk = (t) => {
    if (rows.length === 0 || t - (rows.lastT || 0) > 1.6) { rows.lastT = t; hgt++; rows.unshift([hgt, (rnd() * .08 + .004).toFixed(4), ['7Hk2…9fPa', 'Dq1x…4mZe', '3vNw…aa8Q', 'Bc9r…p2Lu'][hgt % 4]]); rows.length = Math.min(rows.length, 6); }
    cg.fillStyle = '#16120e'; cg.fillRect(0, 0, CW, CH);
    for (let i = 0; i < 1600; i++) { cg.fillStyle = `rgba(230,220,200,${Math.random() * .035})`; cg.fillRect(Math.random() * CW, Math.random() * CH, 2, 2); }
    cg.font = '54px VT, monospace'; cg.fillStyle = '#f2e6cc'; cg.fillText('BLOCKS FOUND TONIGHT', 46, 84);
    cg.fillStyle = 'rgba(242,230,204,.5)'; cg.fillRect(46, 104, 600, 3);
    cg.font = '44px VT, monospace';
    rows.forEach(([h, sol, who], i) => { cg.fillStyle = i === 0 ? '#ffc56a' : `rgba(242,230,204,${.9 - i * .12})`; cg.fillText(`#${h}  ${who}  +${sol} SOL`, 46, 170 + i * 72); });
    chartT.needsUpdate = true;
  };
  P.chartTick = t => chalk(t); chalk(0);
  // a miner sits on the desk by the terminal
  const dm = makeMiner(scene, .7); dm.position.set(.6, DH, deskZ + .05); P.buds.push(dm); P.jarBud = dm;

  // ---- light
  P.hemi = new THREE.HemisphereLight(0x22283c, 0x0c0806, .25); scene.add(P.hemi);
  P.moon = new THREE.DirectionalLight(0x7f97de, .55); P.moon.position.set(-5, SH + 8, ZS + 9); P.moon.target.position.set(0, SH, ZS); scene.add(P.moon, P.moon.target);
  P.bolt = new THREE.PointLight(0xbfd0ff, 0, 40, 1.2); P.bolt.position.set(-3, SH + 7, ZS + 9); scene.add(P.bolt);
  P.glow = new THREE.PointLight(0xffa64d, 0, 3, 2); P.glow.position.set(0, DH + .7, deskZ + .55); scene.add(P.glow);
  return P;
}
