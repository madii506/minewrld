// Mine's one function. Every route the site uses comes through here (vercel.json rewrites /api/<op> to ?op=<op>).
//  GET  config                 what launching costs, the mining rules, whether launching is open
//  POST prepare                record the coin and its locked dev cut; returns the mine's wallet and the deposit it needs
//  POST paybuild {id}          the deposit as an unsigned transfer, for the launcher's wallet to sign
//  POST relay {id, tx}         sends the signed deposit (only to a mine that is waiting for one)
//  GET  status?id=             where a launch is; a full deposit starts the coin
//  GET  veins                  every open mine: height, pool, target, miners
//  GET  vein?id=|mint=         one mine, its latest blocks and its log
//  GET  work?id=               the block to search for right now (header parts and the current target)
//  POST submit {id,height,nonce,miner}   a found block: checked, recorded, and its finder paid the pool
//  GET  eligible?id=&miner=    can this wallet mine this coin (holding, cooldown)
//  POST ping {id,miner,rate}   a miner says it is hashing (for the live miner count and hashrate)
//  GET  blocks?id=[&before=]   a mine's chain, newest first
//  GET  feed[?after=]          launches, claims, blocks and dev payouts across all mines
//  GET  stats                  the whole mountain in numbers
//  GET  tick                   one engine pass (the cron calls it every minute)
//  GET  meta?id= / img?id=     the metadata JSON and picture a coin's on-chain uri points at (/m/<id>, /i/<id>)
//  GET  legends / limg?m=      the big pump.fun coins of the past that hang as paintings in the intro, and their pictures
//  GET  selftest               builds and simulates a create and a claim with a throwaway key (no funds move)
const crypto = require('crypto');
const L = require('./_lib');
const E = require('./_engine');

const SOL = n => +(Number(n) / 1e9).toFixed(4);
const short = a => a ? a.slice(0, 4) + '…' + a.slice(-4) : '';

async function upload(img, f, site, id) {
  try {
    if (!L.MOCK) {
      const fd = new FormData();
      fd.append('file', new Blob([img], { type: 'image/jpeg' }), 'coin.jpg');
      for (const [k, v] of Object.entries({ name: f.name, symbol: f.symbol, description: f.description, twitter: f.twitter || '', telegram: f.telegram || '', website: f.website, showName: 'true' })) fd.append(k, v);
      const r = await fetch('https://pump.fun/api/ipfs', { method: 'POST', body: fd, signal: AbortSignal.timeout(12000) });
      const j = await r.json().catch(() => null);
      if (j && j.metadataUri && /^https?:\/\//.test(j.metadataUri)) return { uri: j.metadataUri, via: 'pump.fun ipfs' };
    }
  } catch {}
  const jwt = (process.env.PINATA_JWT || '').trim();
  if (jwt && !L.MOCK) {
    try {
      const put = async (blob, name) => { const fd = new FormData(); fd.append('network', 'public'); fd.append('file', blob, name);
        const r = await fetch('https://uploads.pinata.cloud/v3/files', { method: 'POST', headers: { Authorization: 'Bearer ' + jwt }, body: fd, signal: AbortSignal.timeout(15000) });
        const j = await r.json(); if (!j || !j.data || !j.data.cid) throw new Error('pinata'); return 'https://ipfs.io/ipfs/' + j.data.cid; };
      const image = await put(new Blob([img], { type: 'image/jpeg' }), 'coin.jpg');
      const meta = await put(new Blob([JSON.stringify({ name: f.name, symbol: f.symbol, description: f.description, image, showName: true, createdOn: site, twitter: f.twitter || undefined, telegram: f.telegram || undefined, website: f.website })], { type: 'application/json' }), 'meta.json');
      return { uri: meta, via: 'pinata ipfs' };
    } catch {}
  }
  return { uri: site + '/m/' + id, via: 'mine' };
}
async function picture(dataUrl) {
  const m = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return null;
  const raw = Buffer.from(m[2], 'base64');
  try { return await require('sharp')(raw, { animated: false }).rotate().resize(512, 512, { fit: 'cover' }).flatten({ background: '#0c0805' }).jpeg({ quality: 88, mozjpeg: true }).toBuffer(); }
  catch { return /jpe?g/.test(m[1]) ? raw : null; }
}

async function prepare(req, res) {
  if (!L.MOCK && L.limited('prep:' + L.ip(req), 8, 600000)) return L.send(res, 200, { ok: false, error: 'Too many launches from here. Wait a few minutes.' });
  if (!L.dbReady()) return L.send(res, 200, { ok: false, error: 'The engine’s records are offline, so launching is paused.' });
  const b = await L.body(req, 2.6 * 1024 * 1024);
  if (b.tooBig) return L.send(res, 200, { ok: false, error: 'That picture is too big. Use one under 1.5 MB.' });
  const launcher = String(b.launcher || '').trim();
  if (!L.isAddr(launcher)) return L.send(res, 200, { ok: false, error: 'Connect a wallet first. The first buy, the dev cut and any refund go there.' });
  const name = L.clean(b.name, 32), symbol = L.clean(b.symbol, 10).replace(/^\$/, '').toUpperCase();
  const description = L.clean(b.description, 400);
  if (!name || Buffer.byteLength(name) > 32) return L.send(res, 200, { ok: false, error: 'Give the coin a name of up to 32 characters.' });
  if (!/^[A-Z0-9]{1,10}$/.test(symbol)) return L.send(res, 200, { ok: false, error: 'The ticker is 1–10 letters or numbers.' });
  if (L.BANNED.test(name + ' ' + symbol + ' ' + description)) return L.send(res, 200, { ok: false, error: 'Pick other words. Those break the house rules.' });
  const tw = String(b.twitter || '').trim(), tg = String(b.telegram || '').trim(), web = String(b.website || '').trim();
  if (tw && !/^https:\/\/(x|twitter)\.com\/[A-Za-z0-9_]{1,15}(\/status\/\d+)?\/?$/.test(tw)) return L.send(res, 200, { ok: false, error: 'The X link should look like https://x.com/yourcoin.' });
  if (tg && !/^https:\/\/t\.me\/[A-Za-z0-9_+]{3,64}\/?$/.test(tg)) return L.send(res, 200, { ok: false, error: 'The Telegram link should look like https://t.me/yourcoin.' });
  if (web && !/^https:\/\/[^\s"'<>]{3,200}$/.test(web)) return L.send(res, 200, { ok: false, error: 'The website should start with https://.' });
  const dev = Number(b.devBuy);
  if (!(dev >= E.MIN_DEV && dev <= E.MAX_DEV)) return L.send(res, 200, { ok: false, error: `The first buy is between ${E.MIN_DEV} and ${E.MAX_DEV} SOL.` });
  const cut = Math.round(Number(b.devCut));
  if (!Number.isInteger(cut) || cut < 0 || cut > E.DEV_CAP) return L.send(res, 200, { ok: false, error: `The dev cut is 0–${E.DEV_CAP}%.` });
  const img = await picture(b.image);
  if (!img) return L.send(res, 200, { ok: false, error: 'Add a picture for the coin (PNG, JPG, WEBP or GIF).' });
  try {
    await L.ready();
    const id = E.newId(); const k = await E.keys(id);
    const wallet = k.wallet.publicKey.toBase58(), mint = k.mint.publicKey.toBase58();
    const site = L.origin(req), page = site + '/?mine=' + mint;
    const desc = (description ? description + '\n\n' : '') + `this coin is a mine. browsers mine it, and every block pays its finder the creator fees${cut ? ` (dev cut ${cut}%)` : ''}. ${page.replace(/^https?:\/\//, '')}`;
    const up = await upload(img, { name, symbol, description: desc, twitter: tw, telegram: tg, website: web || page }, site, id);
    const needL = E.need(dev);
    await L.q(`INSERT INTO mw_coins (id, wallet, mint, launcher, name, symbol, description, twitter, telegram, website, img, meta_uri, dev_buy, need, dev_cut)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`, [id, wallet, mint, launcher, name, symbol, desc, tw || null, tg || null, web || null, img, up.uri, dev, needL, cut]);
    await L.log(id, 'launch', `a mine for $${symbol} is waiting for ${SOL(needL)} SOL`);
    L.send(res, 200, { ok: true, id, wallet, mint, need: needL, needSol: SOL(needL), parts: { fee: SOL(E.FEE), create: SOL(E.CREATE_COST), dev: +(dev * 1.02).toFixed(4), gas: SOL(E.RESERVE) }, uri: up.uri, via: up.via, devCut: cut });
  } catch (e) { L.send(res, 200, { ok: false, error: 'The launch didn’t save. Try again.' }); }
}

async function row(id) { const r = await L.q('SELECT * FROM mw_coins WHERE id=$1', [id]); return r[0] || null; }
const okId = id => /^[A-Za-z0-9_-]{6,20}$/.test(String(id || ''));

async function paybuild(req, res) {
  const b = await L.body(req, 4096);
  if (!okId(b.id)) return L.send(res, 200, { ok: false, error: 'No such launch.' });
  await L.ready(); const c = await row(b.id);
  if (!c || c.state !== 'waiting') return L.send(res, 200, { ok: false, error: 'That launch isn’t waiting for a deposit.' });
  const bal = await L.balance(c.wallet).catch(() => 0);
  const left = Math.max(0, Number(c.need) - bal);
  if (left <= 0) return L.send(res, 200, { ok: true, paid: true });
  const { Transaction, SystemProgram, PublicKey, ComputeBudgetProgram } = require('@solana/web3.js');
  const bh = await E.blockhash();
  const from = new PublicKey(c.launcher);
  const tx = new Transaction({ feePayer: from, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight })
    .add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 20000 }), SystemProgram.transfer({ fromPubkey: from, toPubkey: new PublicKey(c.wallet), lamports: left }));
  L.send(res, 200, { ok: true, tx: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64'), lamports: left, sol: SOL(left) });
}
async function relay(req, res) {
  if (!L.MOCK && L.limited('relay:' + L.ip(req), 12, 600000)) return L.send(res, 200, { ok: false, error: 'Too many from here.' });
  const b = await L.body(req, 4096);
  try {
    const { Transaction, SystemProgram } = require('@solana/web3.js');
    const buf = Buffer.from(String(b.tx || ''), 'base64'); const tx = Transaction.from(buf);
    const to = tx.instructions.filter(i => i.programId.equals(SystemProgram.programId)).map(i => i.keys[1] && i.keys[1].pubkey.toBase58()).filter(Boolean);
    if (!to.length) return L.send(res, 200, { ok: false, error: 'That isn’t a deposit.' });
    await L.ready();
    const ok = await L.q(`SELECT id FROM mw_coins WHERE wallet = ANY($1) AND state='waiting'`, [to]);
    if (!ok.length) return L.send(res, 200, { ok: false, error: 'That deposit isn’t for a mine that is waiting.' });
    const sig = await E.sendRaw(buf);
    await L.q(`UPDATE mw_coins SET pay_sig=$2 WHERE id=$1`, [ok[0].id, sig]);
    L.send(res, 200, { ok: true, sig });
  } catch (e) { L.send(res, 200, { ok: false, error: 'Sending failed: ' + String(e.message).slice(0, 140) }); }
}
async function status(req, res) {
  const id = String(L.query(req).id || '');
  if (!okId(id) || !L.dbReady()) return L.send(res, 200, { ok: false, error: 'No such launch.' });
  await L.ready();
  let c = await row(id); if (!c) return L.send(res, 200, { ok: false, error: 'No such launch.' });
  let bal = null, note = null;
  if (['waiting', 'creating', 'failed', 'expired'].includes(c.state)) {
    try { const a = await E.advance(c); if (a && a.balance != null) bal = a.balance; if (a && a.error) note = a.error; } catch (e) { note = String(e.message).slice(0, 160); }
    c = await row(id);
  }
  if (bal == null && c.state === 'waiting') bal = await L.balance(c.wallet).catch(() => null);
  const logs = await L.q(`SELECT kind, text, sig, sol, at FROM mw_log WHERE id=$1 ORDER BY n DESC LIMIT 12`, [id]);
  L.send(res, 200, { ok: true, id: c.id, state: c.state, wallet: c.wallet, mint: c.mint, symbol: c.symbol, name: c.name, need: Number(c.need), needSol: SOL(c.need), balance: bal,
    pay_sig: c.pay_sig, create_sig: c.create_sig, fee_sig: c.fee_sig, out_sig: c.out_sig, refund_sig: c.refund_sig, err: c.err, note, logs, devCut: c.dev_cut });
}

// ---------- mines ----------
async function liveMiners(ids) {
  if (!ids.length) return {};
  const r = await L.q(`SELECT id, count(*)::int AS n, COALESCE(sum(rate),0)::float8 AS rate FROM mw_miners WHERE id = ANY($1) AND seen_at > now() - interval '75 seconds' GROUP BY id`, [ids]);
  return Object.fromEntries(r.map(x => [x.id, { n: x.n, rate: x.rate }]));
}
function pub(c, mm = {}) {
  const T = E.effTarget(c), exp = E.expected(T);
  return { id: c.id, n: c.n, name: c.name, symbol: c.symbol, mint: c.mint, wallet: c.wallet, launcher: c.launcher, state: c.state, devCut: c.dev_cut,
    level: E.level(c.blocks), height: c.height, blocks: c.blocks, pool: SOL(c.pool), paid: SOL(c.paid), claimed: SOL(c.claimed), devPaid: SOL(c.dev_paid),
    expected: exp, since: +E.since(c).toFixed(1), lastBlockAt: c.last_block_at, miners: (mm[c.id] || {}).n || 0, rate: Math.round((mm[c.id] || {}).rate || 0),
    last: c.last_text, liveAt: c.live_at, createdAt: c.created_at, tickedAt: c.ticked_at, mcapSol: c.mcap_sol, complete: c.complete,
    img: '/i/' + c.id, twitter: c.twitter, telegram: c.telegram, website: c.website, createSig: c.create_sig };
}
const COLS = `id, n, name, symbol, mint, wallet, launcher, state, dev_cut, claimed, pool, paid, dev_paid, owed_dev, height, prev, target, last_block_at, blocks,
  last_text, live_at, ticked_at, created_at, mcap_sol, complete, twitter, telegram, website, create_sig`;
async function veins(req, res) {
  if (!L.dbReady()) return L.send(res, 200, { ok: true, veins: [], totals: {}, offline: true });
  await L.ready();
  const qy = L.query(req), owner = String(qy.owner || ''), lim = Math.max(1, Math.min(200, Number(qy.limit) || 100));
  const order = { top: 'paid DESC', pool: 'pool DESC', active: 'last_block_at DESC NULLS LAST', recent: 'COALESCE(live_at, created_at) DESC' }[qy.sort] || 'pool DESC, last_block_at DESC NULLS LAST';
  const rows = L.isAddr(owner)
    ? await L.q(`SELECT ${COLS} FROM mw_coins WHERE launcher=$1 ORDER BY created_at DESC LIMIT $2`, [owner, lim])
    : await L.q(`SELECT ${COLS} FROM mw_coins WHERE state IN ('live','creating') ORDER BY ${order} LIMIT $1`, [lim]);
  const mm = await liveMiners(rows.map(r => r.id));
  const t = (await L.q(`SELECT count(*)::int AS mines, COALESCE(sum(claimed),0) AS claimed, COALESCE(sum(paid),0) AS paid, COALESCE(sum(pool),0) AS pool, COALESCE(sum(blocks),0)::int AS blocks,
    COALESCE(sum(dev_paid),0) AS dev FROM mw_coins WHERE state='live'`))[0];
  const act = (await L.q(`SELECT count(DISTINCT miner)::int AS miners, COALESCE(sum(rate),0)::float8 AS rate FROM mw_miners WHERE seen_at > now() - interval '75 seconds'`))[0];
  const tick = await L.q(`SELECT v FROM mw_meta WHERE k='tick_done'`).catch(() => []);
  L.send(res, 200, { ok: true, veins: rows.map(c => pub(c, mm)), totals: { mines: t.mines, claimed: SOL(t.claimed), paid: SOL(t.paid), pool: SOL(t.pool), blocks: t.blocks, dev: SOL(t.dev), miners: act.miners, rate: Math.round(act.rate) },
    tickAt: tick[0] ? Number(tick[0].v) : null, now: Date.now() }, L.isAddr(owner) ? 'no-store' : L.CACHE(4, 12));
}
async function findCoin(qy) {
  return okId(qy.id) ? (await L.q(`SELECT ${COLS}, description FROM mw_coins WHERE id=$1`, [qy.id]))[0] : L.isAddr(String(qy.mint || '')) ? (await L.q(`SELECT ${COLS}, description FROM mw_coins WHERE mint=$1`, [qy.mint]))[0] : null;
}
const pubBlock = b => ({ height: b.height, hash: b.hash, prev: b.prev, nonce: b.nonce, miner: b.miner, target: String(b.target), reward: SOL(b.reward), sig: b.sig, pay: b.pay_state, secs: b.secs, at: b.at });
async function vein(req, res) {
  const qy = L.query(req); if (!L.dbReady()) return L.send(res, 200, { ok: false, error: 'offline' });
  await L.ready();
  const c = await findCoin(qy); if (!c) return L.send(res, 200, { ok: false, error: 'No mine by that name.' });
  const mm = await liveMiners([c.id]);
  const [blocks, logs, top] = await Promise.all([
    L.q(`SELECT * FROM mw_blocks WHERE id=$1 ORDER BY height DESC LIMIT 12`, [c.id]),
    L.q(`SELECT n, kind, text, sol, sig, miner, height, at FROM mw_log WHERE id=$1 AND kind <> 'error' ORDER BY n DESC LIMIT 40`, [c.id]),
    L.q(`SELECT miner, count(*)::int AS blocks, COALESCE(sum(reward),0) AS paid FROM mw_blocks WHERE id=$1 GROUP BY miner ORDER BY blocks DESC, paid DESC LIMIT 8`, [c.id]),
  ]);
  L.send(res, 200, { ok: true, vein: { ...pub(c, mm), description: c.description }, blocks: blocks.map(pubBlock), logs, top: top.map(t => ({ miner: t.miner, blocks: t.blocks, paid: SOL(t.paid) })) }, L.CACHE(3, 10));
}
async function work(req, res) {
  const qy = L.query(req); if (!L.dbReady()) return L.send(res, 200, { ok: false, error: 'offline' });
  await L.ready();
  const c = await findCoin(qy); if (!c || c.state !== 'live') return L.send(res, 200, { ok: false, error: 'That mine isn’t open.' });
  const T = E.effTarget(c), pool = Number(c.pool);
  const last = await L.q(`SELECT miner FROM mw_blocks WHERE id=$1 ORDER BY height DESC LIMIT $2`, [c.id, E.COOLDOWN]);
  L.send(res, 200, { ok: true, id: c.id, mint: c.mint, symbol: c.symbol, height: c.height, prev: c.prev, target: T.toString(), targetHex: T.toString(16).padStart(16, '0'),
    expected: E.expected(T), since: +E.since(c).toFixed(1), pool: SOL(pool), reward: pool >= E.MIN_PAY ? SOL(pool - 20000) : 0, minHold: 100000, cooldown: last.map(b => b.miner),
    header: `mine|${c.mint}|${c.height}|${c.prev}|<miner>|<nonce>`, now: Date.now() });
}
async function submit(req, res) {
  const b = await L.body(req, 4096);
  if (!L.MOCK && L.limited('sub:' + L.ip(req), 40, 60000)) return L.send(res, 200, { ok: false, error: 'Too many submissions from here.' });
  const id = String(b.id || ''), miner = String(b.miner || '').trim(), nonce = String(b.nonce || '');
  if (!okId(id) || !L.isAddr(miner) || !/^[0-9]{1,20}$/.test(nonce) || !Number.isInteger(Number(b.height))) return L.send(res, 200, { ok: false, error: 'That block is malformed.' });
  await L.ready();
  try { L.send(res, 200, await E.submit(id, Number(b.height), nonce, miner)); }
  catch (e) { L.send(res, 200, { ok: false, error: 'The block couldn’t be checked: ' + String(e.message).slice(0, 120) }); }
}
async function eligible(req, res) {
  const qy = L.query(req), miner = String(qy.miner || '').trim();
  if (!L.isAddr(miner)) return L.send(res, 200, { ok: false, error: 'That isn’t a Solana address.' });
  await L.ready(); const c = await findCoin(qy); if (!c) return L.send(res, 200, { ok: false, error: 'No mine by that name.' });
  const held = await E.holds(miner, c.mint); const last = await L.q(`SELECT miner FROM mw_blocks WHERE id=$1 ORDER BY height DESC LIMIT $2`, [c.id, E.COOLDOWN]);
  L.send(res, 200, { ok: true, held: Number(held) / 1e6, need: 100000, eligible: held >= E.MIN_HOLD, cooldown: last.some(b => b.miner === miner), symbol: c.symbol });
}
async function ping(req, res) {
  const b = await L.body(req, 2048);
  const id = String(b.id || ''), miner = String(b.miner || '').trim(), rate = Math.max(0, Math.min(5e8, Number(b.rate) || 0));
  if (!okId(id) || !L.isAddr(miner)) return L.send(res, 200, { ok: false });
  if (!L.MOCK && L.limited('ping:' + L.ip(req), 20, 60000)) return L.send(res, 200, { ok: false });
  await L.ready();
  await L.q(`INSERT INTO mw_miners (id, miner, rate, seen_at) VALUES ($1,$2,$3,now()) ON CONFLICT (id, miner) DO UPDATE SET rate=EXCLUDED.rate, seen_at=now()`, [id, miner, rate]);
  const mm = await liveMiners([id]);
  L.send(res, 200, { ok: true, miners: (mm[id] || {}).n || 0, rate: Math.round((mm[id] || {}).rate || 0) });
}
async function blocks(req, res) {
  const qy = L.query(req); if (!L.dbReady()) return L.send(res, 200, { ok: true, blocks: [] });
  await L.ready();
  const before = Math.max(0, Number(qy.before) || 0), lim = Math.max(1, Math.min(100, Number(qy.limit) || 40));
  if (qy.all) {
    const r = await L.q(`SELECT b.*, c.symbol, c.mint FROM mw_blocks b JOIN mw_coins c ON c.id=b.id ORDER BY b.at DESC LIMIT $1`, [lim]);
    return L.send(res, 200, { ok: true, blocks: r.map(b => ({ ...pubBlock(b), id: b.id, symbol: b.symbol, mint: b.mint })) }, L.CACHE(3, 10));
  }
  const c = await findCoin(qy); if (!c) return L.send(res, 200, { ok: false, error: 'No mine by that name.' });
  const r = await L.q(`SELECT * FROM mw_blocks WHERE id=$1 AND ($2 = 0 OR height < $2) ORDER BY height DESC LIMIT $3`, [c.id, before, lim]);
  L.send(res, 200, { ok: true, id: c.id, symbol: c.symbol, mint: c.mint, height: c.height, genesis: E.genesis(c.mint), blocks: r.map(pubBlock) }, L.CACHE(3, 10));
}
async function feed(req, res) {
  if (!L.dbReady()) return L.send(res, 200, { ok: true, items: [] });
  await L.ready();
  const qy = L.query(req), after = Math.max(0, Number(qy.after) || 0), before = Math.max(0, Number(qy.before) || 0), lim = Math.max(1, Math.min(100, Number(qy.limit) || 40));
  const all = ['launch', 'claim', 'block', 'dev', 'refund'], kinds = all.includes(qy.kind) ? [qy.kind] : all;
  const items = await L.q(`SELECT l.n, l.id, l.kind, l.text, l.sol, l.sig, l.miner, l.height, l.at, c.symbol, c.mint FROM mw_log l JOIN mw_coins c ON c.id=l.id
    WHERE l.n > $1 AND ($2 = 0 OR l.n < $2) AND l.kind = ANY($3) ORDER BY l.n DESC LIMIT $4`, [after, before, kinds, lim]);
  L.send(res, 200, { ok: true, items, last: items[0] ? Number(items[0].n) : after }, L.CACHE(3, 10));
}
async function stats(req, res) {
  if (!L.dbReady()) return L.send(res, 200, { ok: true, offline: true, hours: [], mins: [], top: [], miners: [], fresh: [], day: {}, totals: {} });
  await L.ready();
  const buckets = (rows, n) => { const out = Array.from({ length: n }, (_, i) => ({ i, blocks: 0, paid: 0, claimed: 0 }));
    for (const r of rows) { const b = out[Math.max(0, Math.min(n - 1, r.b))]; if (r.kind === 'block') { b.blocks += r.n; b.paid += +Number(r.sol || 0).toFixed(6); } else b.claimed += +Number(r.sol || 0).toFixed(6); }
    return out; };
  const [hr, mn, top, miners, fresh, day, t, act, tick] = await Promise.all([
    L.q(`SELECT floor(extract(epoch from (now() - at)) / 3600)::int AS b, kind, count(*)::int AS n, COALESCE(sum(sol),0)::float8 AS sol FROM mw_log WHERE at > now() - interval '24 hours' AND kind IN ('block','claim') GROUP BY 1, 2`),
    L.q(`SELECT floor(extract(epoch from (now() - at)) / 120)::int AS b, kind, count(*)::int AS n, COALESCE(sum(sol),0)::float8 AS sol FROM mw_log WHERE at > now() - interval '60 minutes' AND kind IN ('block','claim') GROUP BY 1, 2`),
    L.q(`SELECT ${COLS} FROM mw_coins WHERE state='live' ORDER BY paid DESC, blocks DESC LIMIT 8`),
    L.q(`SELECT miner, count(*)::int AS blocks, COALESCE(sum(reward),0) AS paid FROM mw_blocks GROUP BY miner ORDER BY paid DESC, blocks DESC LIMIT 8`),
    L.q(`SELECT ${COLS} FROM mw_coins WHERE state='live' ORDER BY live_at DESC NULLS LAST LIMIT 5`),
    L.q(`SELECT count(*)::int AS blocks, COALESCE(sum(reward),0) AS paid, count(DISTINCT miner)::int AS finders FROM mw_blocks WHERE at > now() - interval '24 hours'`),
    L.q(`SELECT count(*)::int AS mines, COALESCE(sum(claimed),0) AS claimed, COALESCE(sum(paid),0) AS paid, COALESCE(sum(pool),0) AS pool, COALESCE(sum(blocks),0)::int AS blocks, COALESCE(sum(dev_paid),0) AS dev FROM mw_coins WHERE state='live'`),
    L.q(`SELECT count(DISTINCT miner)::int AS miners, COALESCE(sum(rate),0)::float8 AS rate FROM mw_miners WHERE seen_at > now() - interval '75 seconds'`),
    L.q(`SELECT v FROM mw_meta WHERE k='tick_done'`).catch(() => []),
  ]);
  const mm = await liveMiners([...top, ...fresh].map(c => c.id));
  const d = day[0] || {}, tt = t[0] || {}, a = act[0] || {};
  L.send(res, 200, { ok: true, hours: buckets(hr, 24), mins: buckets(mn, 30), top: top.map(c => pub(c, mm)), fresh: fresh.map(c => pub(c, mm)),
    miners: miners.map(m => ({ miner: m.miner, blocks: m.blocks, paid: SOL(m.paid) })),
    day: { blocks: d.blocks || 0, paid: SOL(d.paid || 0), finders: d.finders || 0 },
    totals: { mines: tt.mines || 0, claimed: SOL(tt.claimed || 0), paid: SOL(tt.paid || 0), pool: SOL(tt.pool || 0), blocks: tt.blocks || 0, dev: SOL(tt.dev || 0), miners: a.miners || 0, rate: Math.round(a.rate || 0) },
    tickAt: tick[0] ? Number(tick[0].v) : null, now: Date.now() }, L.CACHE(8, 30));
}
async function meta(req, res) {
  const qy = L.query(req);
  if (!L.dbReady()) return L.send(res, 404, { error: 'not found' });
  await L.ready();
  if (qy.img) {
    const id = String(qy.img).replace(/\.\w+$/, '');
    const r = okId(id) ? await L.q('SELECT img FROM mw_coins WHERE id=$1 AND img IS NOT NULL', [id]).catch(() => []) : [];
    if (!r.length) { res.statusCode = 404; res.setHeader('Cache-Control', 'public, max-age=30'); return res.end(); }
    res.statusCode = 200; res.setHeader('Content-Type', 'image/jpeg'); res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=31536000, immutable');
    return res.end(Buffer.from(r[0].img));
  }
  const id = String(qy.id || '').replace(/\.json$/, '');
  if (!okId(id)) return L.send(res, 404, { error: 'not found' });
  const r = await L.q('SELECT id, mint, name, symbol, description, twitter, telegram, website FROM mw_coins WHERE id=$1', [id]).catch(() => []);
  if (!r.length) return L.send(res, 404, { error: 'not found' }, 'public, max-age=30');
  const k = r[0], site = L.origin(req), page = site + '/?mine=' + k.mint;
  L.send(res, 200, { name: k.name, symbol: k.symbol, description: k.description, image: site + '/i/' + k.id, showName: true, createdOn: site,
    twitter: k.twitter || undefined, telegram: k.telegram || undefined, website: k.website || page, external_url: page }, 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
}
// ---------------------------------------------------------------- the legends: big pump.fun coins of the past, hung as paintings in the mine's galleries.
// Their pictures come from DexScreener through here, so the 3D scene can paint with them (same origin) and the CDN keeps a copy.
const LEGENDS = [   // [mint, symbol, name, level (0 shallow · 1 deep · 2 deeper), slot (0 back wall · 1 left · 2 right)]
  ['Dfh5DzRgSvvCFDoYc2ciTkMrbDfRKybA4SoFbPmApump', 'PIPPIN', 'Pippin', 0, 0],
  ['A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump', 'FWOG', 'FWOG', 0, 1],
  ['KENJSUYLASHUMfHyy5o4Hp2FdNqZg1AsUPhfH2kYvEP', 'GRIFFAIN', 'griffain', 0, 2],
  ['ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY', 'MOODENG', 'Moo Deng', 1, 0],
  ['8x5VqbHA8D7NkD52uNuS5nnt3PwA8pLD34ymskeSo2Wn', 'ZEREBRO', 'zerebro', 1, 1],
  ['61V8vBaqAGMpgDQi4JcAwo1dmBGHsyhzodcPqnEVpump', 'ARC', 'AI Rig Complex', 1, 2],
  ['9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump', 'FARTCOIN', 'Fartcoin', 2, 0],
  ['2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump', 'PNUT', 'Peanut the Squirrel', 2, 1],
  ['CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump', 'GOAT', 'Goatseus Maximus', 2, 2],
];
function legends(req, res) { L.send(res, 200, { ok: true, legends: LEGENDS.map(([mint, symbol, name, lv, slot]) => ({ mint, symbol, name, lv, slot, img: '/api/limg?m=' + mint })) }, L.CACHE(3600)); }
async function limg(req, res) {
  const m = String(L.query(req).m || ''), it = LEGENDS.find(l => l[0] === m);
  const miss = () => { res.statusCode = 404; res.setHeader('Cache-Control', 'public, max-age=300'); res.end(); };
  if (!it) return miss();
  const out = (buf, type, cache) => { res.statusCode = 200; res.setHeader('Content-Type', type); res.setHeader('Cache-Control', cache); res.setHeader('Access-Control-Allow-Origin', '*'); res.end(buf); };
  if (L.MOCK) { try { return out(require('fs').readFileSync(require('path').join(__dirname, '..', 'dev', 'legends', it[1] + '.png')), 'image/png', 'no-store'); } catch { return miss(); } }
  try {
    const j = await L.getJson('https://api.dexscreener.com/tokens/v1/solana/' + m, {}, 8000);
    const p = (Array.isArray(j.json) ? j.json : []).find(x => x && x.baseToken && x.baseToken.address === m && x.info && x.info.imageUrl);
    if (!p) return miss();
    const u = new URL(p.info.imageUrl); if (u.protocol !== 'https:' || !/(^|\.)dexscreener\.com$/.test(u.hostname)) return miss();
    if (u.searchParams.has('width')) { u.searchParams.set('width', '384'); u.searchParams.set('height', '384'); }
    const r = await fetch(u, { headers: { accept: 'image/png,image/jpeg,image/webp;q=0.9,*/*;q=0.5' }, signal: AbortSignal.timeout(9000) });
    const type = r.headers.get('content-type') || ''; if (!r.ok || !/^image\//.test(type)) return miss();
    const buf = Buffer.from(await r.arrayBuffer()); if (!buf.length || buf.length > 3e6) return miss();
    return out(buf, type, 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000');
  } catch { return miss(); }
}
async function selftest(req, res) {
  if (L.limited('st:' + L.ip(req), 6, 600000)) return L.send(res, 200, { ok: false, error: 'Wait a few minutes.' });
  const { Keypair } = require('@solana/web3.js');
  const sim = async tx => { const j = await L.rpcRaw('simulateTransaction', [Buffer.from(tx.serialize()).toString('base64'), { encoding: 'base64', sigVerify: false, replaceRecentBlockhash: true, commitment: 'confirmed' }]);
    const v = j.result && j.result.value; return { err: v ? v.err : j.error && j.error.message, logs: v && v.logs ? v.logs.slice(-4) : [] }; };
  const out = {}; const w = Keypair.generate(), mk = Keypair.generate();
  const step = async (name, fn) => { const t0 = Date.now(); try { out[name] = { ok: true, ...(await fn()), ms: Date.now() - t0 }; } catch (e) { out[name] = { ok: false, error: String(e.message).slice(0, 200), ms: Date.now() - t0 }; } };
  await step('create', async () => { const tx = await E.portal({ publicKey: w.publicKey.toBase58(), action: 'create', tokenMetadata: { name: 'mine selftest', symbol: 'TEST', uri: L.origin(req) + '/m/selftest' }, mint: mk.publicKey.toBase58(), denominatedInSol: 'true', amount: 0.01, slippage: 10, priorityFee: 0.0001, pool: 'pump' }, [mk, w]);
    return { bytes: tx.serialize().length, sim: await sim(tx) }; });
  await step('claim', async () => { const tx = await E.portal({ publicKey: w.publicKey.toBase58(), action: 'collectCreatorFee', priorityFee: 0.00001, pool: 'pump' }, [w]); return { bytes: tx.serialize().length, sim: await sim(tx) }; });
  await step('hash', async () => { const h = E.hashOf(E.header('MINT', 0, E.genesis('MINT'), 'MINER', '42')); return { sample: h.slice(0, 16), engine: 'sha256' }; });
  L.send(res, 200, { ok: true, note: 'throwaway keys, nothing is sent; insufficient-funds errors in the simulation are expected', ...out });
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return L.send(res, 204, {});
  const op = String(L.query(req).op || 'config');
  try {
    if (req.method === 'POST' && op === 'prepare') return await prepare(req, res);
    if (req.method === 'POST' && op === 'paybuild') return await paybuild(req, res);
    if (req.method === 'POST' && op === 'relay') return await relay(req, res);
    if (req.method === 'POST' && op === 'submit') return await submit(req, res);
    if (req.method === 'POST' && op === 'ping') return await ping(req, res);
    if (op === 'status') return await status(req, res);
    if (op === 'veins') return await veins(req, res);
    if (op === 'vein') return await vein(req, res);
    if (op === 'work') return await work(req, res);
    if (op === 'eligible') return await eligible(req, res);
    if (op === 'blocks') return await blocks(req, res);
    if (op === 'feed') return await feed(req, res);
    if (op === 'stats') return await stats(req, res);
    if (op === 'meta') return await meta(req, res);
    if (op === 'img') { req.query = { ...(L.query(req)), img: L.query(req).id }; return await meta(req, res); }
    if (op === 'tick') { if (!L.dbReady()) return L.send(res, 200, { ok: false, error: 'engine offline: no database' }); return L.send(res, 200, await E.tick(40000)); }
    if (op === 'blockhash') return L.send(res, 200, { ok: true, ...(await E.blockhash()) });
    if (op === 'selftest') return await selftest(req, res);
    if (op === 'legends') return legends(req, res);
    if (op === 'limg') return await limg(req, res);
    L.send(res, 200, { ok: true, open: L.dbReady(), fee: SOL(E.FEE), feeWallet: L.FEE_WALLET, createSol: SOL(E.CREATE_COST), reserveSol: SOL(E.RESERVE), minDev: E.MIN_DEV, maxDev: E.MAX_DEV,
      devCap: E.DEV_CAP, levels: E.LEVELS, minHold: 100000, cooldown: E.COOLDOWN, blockSecs: E.BLOCK_SECS, minPay: SOL(E.MIN_PAY), mock: !!L.MOCK }, L.CACHE(60));
  } catch (e) { L.send(res, 200, { ok: false, error: 'Something broke: ' + String(e && e.message).slice(0, 120) }); }
};
