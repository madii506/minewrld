// The engine. It is custodial, and says so: every coin launched on minewrld gets its own wallet (the mine), derived on
// this server from one master secret, and that wallet is the coin's pump.fun creator. Every minute the engine claims the
// coin's creator fees into the mine. The dev's cut (0–30%, locked at launch) goes to the dev; the rest fills the pool.
// Each coin runs its own proof-of-work chain: browsers search for a hash under the target, and whoever finds the next
// block is paid the whole pool, in one Solana transaction whose memo carries the block's hash. There is no sell job and
// no withdraw job.
const crypto = require('crypto');
const L = require('./_lib');

let web3 = null, spl = null;
const w3 = () => web3 || (web3 = require('@solana/web3.js'));
const sp = () => spl || (spl = require('@solana/spl-token'));

const LAMPORTS = 1e9;
const FEE = 0.05 * LAMPORTS;               // the launch fee, forwarded to the house once the coin is live
const RESERVE = 0.015 * LAMPORTS;          // stays in every mine for gas and token-account rent
const CREATE_COST = 0.03 * LAMPORTS;       // pump.fun rent for a new coin, plus margin; whatever is unused goes back
const MIN_DEV = 0.01, MAX_DEV = 10, DEV_CAP = 30;
const CLAIM_MIN = 0.003 * LAMPORTS;        // claim when at least this much is waiting
const DEV_MIN = 0.004 * LAMPORTS;          // the dev is paid once their cut is worth a transaction
const MIN_PAY = 0.0005 * LAMPORTS;         // a block pays when the pool holds at least this; smaller pools wait for the next block
const GAS = 20000;                         // kept from each payout so the mine's gas reserve stays full
const PORTAL = 'https://pumpportal.fun/api/trade-local';
const MEMO = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const PRIORITY = Number(process.env.PRIORITY_FEE || 0.0002);
// proof of work: sha256 of the header; the first 8 bytes, read as a number, must be under the target
const TWO64 = 2n ** 64n;
const T_EASY = TWO64 / 2000000n;           // the easiest a block can get: ~2 million hashes
const T_HARD = TWO64 / 10000000000000n;    // the hardest: ~10 trillion
const T_INIT = TWO64 / BigInt(process.env.MW_T_INIT || 30000000);   // a new mine starts at ~30 million hashes a block
const BLOCK_SECS = 60;                     // the chain retunes itself toward one block a minute
const EASE_AFTER = 90;                     // with no block for 90 s, the target starts to ease
const MIN_HOLD = 100000n * 1000000n;       // to mine, hold 0.01% of the supply (100,000 tokens of 1,000,000,000)
const COOLDOWN = 4;                        // finders of any of the last 4 blocks sit out the next one
const LEVELS = [['shallow', 0], ['deep', 25], ['deeper', 250], ['bedrock', 2500]];
const level = blocks => { let l = LEVELS[0]; for (const x of LEVELS) if (blocks >= x[1]) l = x; return l[0]; };
const need = devBuy => Math.ceil((FEE + CREATE_COST + devBuy * 1.02 * LAMPORTS + RESERVE) / 1e6) * 1e6;   // rounded up to 0.001 SOL

// ---------- keys: derived, never stored ----------
let MASTER = null;
async function master() {
  if (MASTER) return MASTER;
  if (process.env.MW_MASTER && process.env.MW_MASTER.length >= 32) return (MASTER = process.env.MW_MASTER);
  await L.ready();
  await L.q(`INSERT INTO mw_meta (k, v) VALUES ('master', $1) ON CONFLICT (k) DO NOTHING`, [crypto.randomBytes(32).toString('hex')]);
  const r = await L.q(`SELECT v FROM mw_meta WHERE k='master'`);
  return (MASTER = r[0].v);
}
async function keys(id) {
  const m = await master(); const { Keypair } = w3();
  const seed = tag => crypto.createHmac('sha256', m).update(tag + ':' + id).digest();
  return { wallet: Keypair.fromSeed(seed('mine')), mint: Keypair.fromSeed(seed('mint')) };
}
const newId = () => crypto.randomBytes(9).toString('base64url');

// ---------- the chain ----------
const genesis = mint => crypto.createHash('sha256').update('minewrld genesis ' + mint).digest('hex');
const header = (mint, height, prev, miner, nonce) => `minewrld|${mint}|${height}|${prev}|${miner}|${nonce}`;
const hashOf = s => crypto.createHash('sha256').update(s).digest('hex');
const head64 = hex => BigInt('0x' + hex.slice(0, 16));
const big = v => BigInt(String(v).split('.')[0] || '0');
function since(c, now = Date.now()) { const t = c.last_block_at || c.live_at; return t ? Math.max(0, (now - new Date(t).getTime()) / 1000) : 0; }
function effTarget(c, now = Date.now()) {          // the target eases the longer a block goes unfound
  const T = big(c.target) || T_INIT, s = since(c, now);
  if (s <= EASE_AFTER) return T;
  const t = T * BigInt(Math.round(s / EASE_AFTER * 1000)) / 1000n;
  return t > T_EASY ? T_EASY : t;
}
function retarget(Teff, secs) {                     // after a block: faster than a minute → harder, slower → easier
  const k = Math.max(.5, Math.min(2, secs / BLOCK_SECS));
  let t = Teff * BigInt(Math.round(k * 1000)) / 1000n;
  if (t > T_EASY) t = T_EASY; if (t < T_HARD) t = T_HARD; return t;
}
const expected = T => Number(TWO64 / (T > 0n ? T : 1n));   // hashes a block takes on average

// ---------- sending ----------
async function blockhash() { const r = await L.rpc('getLatestBlockhash', [{ commitment: 'confirmed' }]); return r.value; }
async function status(sig) { try { const r = await L.rpc('getSignatureStatuses', [[sig], { searchTransactionHistory: true }]); return r.value && r.value[0]; } catch { return undefined; } }
async function confirm(sig, ms = 40000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await L.rpc('getSignatureStatuses', [[sig], { searchTransactionHistory: false }]);
      const s = r.value && r.value[0];
      if (s) { if (s.err) return { ok: false, err: JSON.stringify(s.err) }; if (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized') return { ok: true }; }
    } catch {}
    await new Promise(r => setTimeout(r, L.MOCK ? 20 : 1500));
  }
  return { ok: false, err: 'not confirmed in time' };
}
async function sendRaw(bytes, skipPreflight = false) {
  const b64 = Buffer.from(bytes).toString('base64');
  const j = await L.rpcRaw('sendTransaction', [b64, { encoding: 'base64', skipPreflight, maxRetries: 3, preflightCommitment: 'confirmed' }], 20000);
  if (j.error) { const logs = j.error.data && j.error.data.logs; throw new Error((j.error.message || 'send failed') + (logs ? ' | ' + logs.slice(-3).join(' | ') : '')); }
  return j.result;
}
async function sendAndConfirm(bytes, ms) { const sig = await sendRaw(bytes); const c = await confirm(sig, ms); if (!c.ok) { const e = new Error(c.err); e.sig = sig; throw e; } return sig; }
async function buildTx(payer, ixs) {
  const { Transaction, ComputeBudgetProgram } = w3();
  const bh = await blockhash();
  const tx = new Transaction({ feePayer: payer.publicKey, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight });
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 60000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 60000 }), ...ixs); tx.sign(payer);
  return tx;
}
async function sendIxs(payer, ixs) { return sendAndConfirm((await buildTx(payer, ixs)).serialize()); }
async function portal(args, signers) {
  if (L.MOCK && L.MOCK.portal) return L.MOCK.portal(args, signers);
  const r = await fetch(PORTAL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(15000) });
  if (r.status !== 200) throw new Error('pumpportal ' + r.status + ': ' + (await r.text().catch(() => '')).slice(0, 160));
  const { VersionedTransaction } = w3();
  const tx = VersionedTransaction.deserialize(new Uint8Array(await r.arrayBuffer()));
  tx.sign(signers); return tx;
}

// ---------- reading a mine ----------
async function mintInfo(mint) {
  return L.remember('mi:' + mint, 36e5, async () => { const [m] = await L.accounts([mint]); if (!m) throw new Error('mint not found'); return { program: m.owner, decimals: m.data[44] }; });
}
async function tokenBal(owner, mint) {
  const { program } = await mintInfo(mint); const [a] = await L.accounts([L.ataOf(owner, mint, program)]);
  return L.tokenAmount(a);
}
async function waiting(wallet) {   // creator fees waiting to be claimed, in lamports (bonding curve vault + PumpSwap vault)
  const v1 = L.creatorVaultOf(wallet), v2 = L.ammVaultOf(wallet);
  const [a, b] = await L.accounts([v1, L.ataOf(v2, L.SOL, L.TOKEN)]);
  return Math.max(0, (a ? a.lamports - L.RENT0 : 0)) + Number(L.tokenAmount(b));
}
const fmtTok = (raw, decimals = 6) => { const ui = Number(raw) / 10 ** decimals; return ui >= 1e9 ? (ui / 1e9).toFixed(2) + 'B' : ui >= 1e6 ? (ui / 1e6).toFixed(2) + 'M' : ui >= 1e3 ? (ui / 1e3).toFixed(1) + 'K' : ui.toFixed(0); };
const sol4 = l => (l / LAMPORTS).toFixed(4);
const short = a => a.slice(0, 4) + '…' + a.slice(-4);
async function say(c, kind, text, extra = {}) { await L.log(c.id, kind, text, extra); if (kind !== 'error') await L.q(`UPDATE mw_coins SET last_text=$2 WHERE id=$1`, [c.id, String(text).slice(0, 200)]).catch(() => {}); }

// ---------- the launch ----------
async function create(c) {
  const k = await keys(c.id);
  await say(c, 'launch', `deposit in. opening the mine for $${c.symbol} on pump.fun`);
  let sig;
  try {
    const tx = await portal({ publicKey: k.wallet.publicKey.toBase58(), action: 'create', tokenMetadata: { name: c.name, symbol: c.symbol, uri: c.meta_uri },
      mint: k.mint.publicKey.toBase58(), denominatedInSol: 'true', amount: c.dev_buy, slippage: 10, priorityFee: PRIORITY, pool: 'pump' }, [k.mint, k.wallet]);
    sig = await sendAndConfirm(tx.serialize());
  } catch (e) {
    const [bc] = await L.accounts([L.bondingCurveOf(c.mint)]).catch(() => [null]);
    if (!bc) {
      await L.q(`UPDATE mw_coins SET state='failed', err=$2 WHERE id=$1`, [c.id, String(e.message).slice(0, 300)]);
      await say(c, 'error', 'launch failed: ' + String(e.message).slice(0, 200), { sig: e.sig });
      await refund(c, 'launch failed, the whole deposit went back');
      return { ok: false, error: String(e.message) };
    }
    sig = e.sig || null;
  }
  await L.q(`UPDATE mw_coins SET state='live', live_at=now(), create_sig=$2, err=NULL, height=0, prev=$3, target=$4, last_block_at=now() WHERE id=$1`, [c.id, sig, genesis(c.mint), T_INIT.toString()]);
  await say(c, 'launch', `$${c.symbol} is live. the mine is open: block #0 is waiting to be found`, { sig, height: 0 });
  await payFee(c, k).catch(e => L.log(c.id, 'error', 'launch fee transfer failed, will retry: ' + String(e.message).slice(0, 160)));
  await handOut(c, k).catch(e => L.log(c.id, 'error', 'sending the first buy back failed: ' + String(e.message).slice(0, 160)));
  return { ok: true, sig };
}
async function payFee(c, k) {
  if (c.fee_sig || !L.isAddr(L.FEE_WALLET)) return null;
  const { SystemProgram, PublicKey } = w3();
  const sig = await sendIxs(k.wallet, [SystemProgram.transfer({ fromPubkey: k.wallet.publicKey, toPubkey: new PublicKey(L.FEE_WALLET), lamports: FEE })]);
  await L.q(`UPDATE mw_coins SET fee_sig=$2 WHERE id=$1`, [c.id, sig]);
  await L.log(c.id, 'fee', `launch fee paid (${sol4(FEE)} SOL)`, { sig, sol: FEE / LAMPORTS });
  c.fee_sig = sig; return sig;
}
async function handOut(c, k) {
  k = k || await keys(c.id);
  const { PublicKey, SystemProgram } = w3(); const S = sp();
  const owner = k.wallet.publicKey, to = new PublicKey(c.launcher), mint = new PublicKey(c.mint);
  const { program, decimals } = await mintInfo(c.mint); const prog = new PublicKey(program);
  const ixs = [];
  const amt = await tokenBal(owner.toBase58(), c.mint);
  if (amt > 0n) {
    const src = new PublicKey(L.ataOf(owner.toBase58(), c.mint, program)), dst = new PublicKey(L.ataOf(c.launcher, c.mint, program));
    ixs.push(S.createAssociatedTokenAccountIdempotentInstruction(owner, dst, to, mint, prog), S.createTransferCheckedInstruction(src, mint, dst, owner, amt, decimals, [], prog));
  }
  const bal = await L.balance(owner.toBase58());
  const extra = bal - RESERVE - (c.fee_sig ? 0 : FEE) - 0.0025 * LAMPORTS;
  if (extra > 0.002 * LAMPORTS) ixs.push(SystemProgram.transfer({ fromPubkey: owner, toPubkey: to, lamports: Math.floor(extra) }));
  if (!ixs.length) return null;
  const sig = await sendIxs(k.wallet, ixs);
  await L.q(`UPDATE mw_coins SET out_sig=$2 WHERE id=$1`, [c.id, sig]);
  await say(c, 'launch', `first buy (${fmtTok(amt, decimals)} $${c.symbol})${extra > 0.002 * LAMPORTS ? ' and unused SOL' : ''} sent to the dev`, { sig, sol: extra > 0 ? extra / LAMPORTS : null, tokens: amt });
  return sig;
}
async function refund(c, why) {
  const k = await keys(c.id); const { SystemProgram, PublicKey } = w3();
  const bal = await L.balance(k.wallet.publicKey.toBase58());
  const amt = bal - 10000;
  if (amt <= 0) return null;
  try {
    const sig = await sendIxs(k.wallet, [SystemProgram.transfer({ fromPubkey: k.wallet.publicKey, toPubkey: new PublicKey(c.launcher), lamports: amt })]);
    await L.q(`UPDATE mw_coins SET refund_sig=$2, state=CASE WHEN state='live' THEN state ELSE 'refunded' END WHERE id=$1`, [c.id, sig]);
    await say(c, 'refund', why, { sig, sol: amt / LAMPORTS });
    return sig;
  } catch (e) { await L.log(c.id, 'error', 'refund failed, will retry: ' + String(e.message).slice(0, 160)); return null; }
}
async function advance(c) {
  if (c.state === 'waiting') {
    const bal = await L.balance(c.wallet);
    if (bal >= Number(c.need) * 0.995) {
      const got = await L.q(`UPDATE mw_coins SET state='creating', ticked_at=now() WHERE id=$1 AND state='waiting' RETURNING *`, [c.id]);
      if (got.length) return create(got[0]);
    } else if (Date.now() - new Date(c.created_at) > 3 * 36e5) {
      await L.q(`UPDATE mw_coins SET state='expired' WHERE id=$1 AND state='waiting'`, [c.id]);
      if (bal > 10000) await refund({ ...c, state: 'expired' }, 'never fully funded, deposit returned');
    }
    return { ok: true, state: 'waiting', balance: bal };
  }
  if (c.state === 'creating' && Date.now() - new Date(c.ticked_at || c.created_at) > 4 * 6e4) {
    const [bc] = await L.accounts([L.bondingCurveOf(c.mint)]);
    if (bc) await L.q(`UPDATE mw_coins SET state='live', live_at=COALESCE(live_at, now()), height=0, prev=$2, target=$3, last_block_at=now() WHERE id=$1 AND state='creating'`, [c.id, genesis(c.mint), T_INIT.toString()]);
    else { await L.q(`UPDATE mw_coins SET state='failed', err='creation did not land' WHERE id=$1`, [c.id]); await refund(c, 'launch did not land, deposit returned'); }
  }
  if ((c.state === 'expired' || c.state === 'failed') && !c.refund_sig) { const bal = await L.balance(c.wallet); if (bal > 10000) await refund(c, 'deposit returned'); }
  return { ok: true, state: c.state };
}

// ---------- fees: claim, the dev's cut, the pool ----------
async function claim(c, k) {
  const w = await waiting(c.wallet);
  if (w < CLAIM_MIN) return 0;
  const before = await L.balance(c.wallet);
  const tx = await portal({ publicKey: c.wallet, action: 'collectCreatorFee', priorityFee: 0.00001, pool: 'pump' }, [k.wallet]);
  const sig = await sendAndConfirm(tx.serialize());
  const got = Math.max(0, (await L.balance(c.wallet)) - before);
  if (got <= 0) return 0;
  const dev = Math.floor(got * c.dev_cut / 100), pool = got - dev;
  await L.q(`UPDATE mw_coins SET claimed=claimed+$2, pool=pool+$3, owed_dev=owed_dev+$4 WHERE id=$1`, [c.id, got, pool, dev]);
  c.pool = Number(c.pool) + pool; c.owed_dev = Number(c.owed_dev) + dev;
  await say(c, 'claim', `claimed ${sol4(got)} SOL of creator fees · ${sol4(pool)} into the pool${dev ? `, ${sol4(dev)} for the dev` : ''}`, { sig, sol: got / LAMPORTS });
  return got;
}
async function payDev(c, k) {
  const owed = Number(c.owed_dev); if (owed < DEV_MIN) return null;
  const { PublicKey, SystemProgram } = w3();
  const sig = await sendIxs(k.wallet, [SystemProgram.transfer({ fromPubkey: k.wallet.publicKey, toPubkey: new PublicKey(c.launcher), lamports: owed })]);
  await L.q(`UPDATE mw_coins SET owed_dev=GREATEST(0, owed_dev-$2), dev_paid=dev_paid+$2 WHERE id=$1`, [c.id, owed]);
  await say(c, 'dev', `paid the dev ${sol4(owed)} SOL (${c.dev_cut}% cut)`, { sig, sol: owed / LAMPORTS });
  return sig;
}

// ---------- mining: check a found block, pay its finder ----------
async function holds(miner, mint) { try { return await tokenBal(miner, mint); } catch { return 0n; } }
async function submit(id, height, nonce, miner) {
  const r = await L.q(`SELECT * FROM mw_coins WHERE id=$1`, [id]); const c = r[0];
  if (!c || c.state !== 'live') return { ok: false, error: 'That mine isn’t open.' };
  if (Number(height) !== c.height) return { ok: false, stale: true, error: `Block #${height} was already found. The chain is at #${c.height}.` };
  const hash = hashOf(header(c.mint, c.height, c.prev, miner, nonce)), T = effTarget(c);
  if (head64(hash) >= T) return { ok: false, low: true, error: 'That hash is not under the target.' };
  const held = await holds(miner, c.mint);
  if (held < MIN_HOLD) return { ok: false, error: `To mine $${c.symbol}, hold at least 100,000 $${c.symbol} (0.01% of the supply).`, need: true };
  const last = await L.q(`SELECT miner FROM mw_blocks WHERE id=$1 ORDER BY height DESC LIMIT $2`, [id, COOLDOWN]);
  if (last.some(b => b.miner === miner)) return { ok: false, error: `You found one of the last ${COOLDOWN} blocks. Sit this one out; the next one is yours to find.`, cooldown: true };
  const secs = since(c), next = retarget(T, Math.max(1, secs));
  const pool = Number(c.pool), reward = pool >= MIN_PAY ? pool - GAS : 0;
  const won = await L.q(`UPDATE mw_coins SET height=height+1, prev=$3, target=$4, last_block_at=now(), blocks=blocks+1, pool=pool-$5, paid=paid+$6
    WHERE id=$1 AND height=$2 AND pool >= $5 RETURNING height`, [id, c.height, hash, next.toString(), reward > 0 ? pool : 0, reward]);
  if (!won.length) return { ok: false, stale: true, error: 'Someone found it first.' };
  await L.q(`INSERT INTO mw_blocks (id, height, hash, prev, nonce, miner, target, reward, pay_state, secs) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, c.height, hash, c.prev, String(nonce), miner, T.toString(), reward, reward > 0 ? 'paying' : 'none', +secs.toFixed(2)]);
  const blk = { height: c.height, hash, reward: reward / LAMPORTS, miner, secs: +secs.toFixed(1), symbol: c.symbol };
  if (reward <= 0) {
    await say(c, 'block', `block #${c.height} found by ${short(miner)} · the pool was still filling, so it paid nothing`, { miner, height: c.height, sol: 0 });
    return { ok: true, block: blk, paid: false };
  }
  const pay = await payBlock(c, c.height, hash, miner, reward);
  return { ok: true, block: { ...blk, sig: pay.sig || null }, paid: !!pay.ok, pending: !pay.ok };
}
async function payBlock(c, height, hash, miner, reward) {
  const k = await keys(c.id); const { PublicKey, SystemProgram, TransactionInstruction } = w3();
  const memo = new TransactionInstruction({ programId: new PublicKey(MEMO), keys: [], data: Buffer.from(`minewrld $${c.symbol} block #${height} ${hash}`) });
  let sig = null;
  try {
    const tx = await buildTx(k.wallet, [SystemProgram.transfer({ fromPubkey: k.wallet.publicKey, toPubkey: new PublicKey(miner), lamports: reward }), memo]);
    sig = await sendRaw(tx.serialize());
    await L.q(`UPDATE mw_blocks SET sig=$3 WHERE id=$1 AND height=$2`, [c.id, height, sig]);
    const cf = await confirm(sig, 25000);
    if (!cf.ok) throw Object.assign(new Error(cf.err), { sig });
    await L.q(`UPDATE mw_blocks SET pay_state='paid' WHERE id=$1 AND height=$2`, [c.id, height]);
    await say(c, 'block', `block #${height} found by ${short(miner)} · paid ${sol4(reward)} SOL`, { sig, sol: reward / LAMPORTS, miner, height });
    return { ok: true, sig };
  } catch (e) {
    await L.q(`UPDATE mw_blocks SET pay_state='retry' WHERE id=$1 AND height=$2`, [c.id, height]);
    await L.log(c.id, 'error', `block #${height} payout is retrying: ` + String(e.message).slice(0, 140), { sig, height, miner });
    return { ok: false, sig };
  }
}
async function retryPayouts(c) {
  const rows = await L.q(`SELECT * FROM mw_blocks WHERE id=$1 AND pay_state IN ('retry','paying') AND at < now() - interval '45 seconds' ORDER BY height LIMIT 3`, [c.id]);
  for (const b of rows) {
    if (b.sig) { const s = await status(b.sig); if (s && !s.err) { await L.q(`UPDATE mw_blocks SET pay_state='paid' WHERE id=$1 AND height=$2`, [c.id, b.height]);
      await say(c, 'block', `block #${b.height} found by ${short(b.miner)} · paid ${sol4(Number(b.reward))} SOL`, { sig: b.sig, sol: Number(b.reward) / LAMPORTS, miner: b.miner, height: b.height }); continue; }
      if (s === undefined || (s === null && Date.now() - new Date(b.at) < 150000)) continue; }
    await payBlock(c, b.height, b.hash, b.miner, Number(b.reward));
  }
}

// ---------- the market ----------
async function market(c) {
  const [bc] = await L.accounts([L.bondingCurveOf(c.mint)]);
  if (bc && bc.data && bc.data.length >= 49) {
    const vTok = bc.data.readBigUInt64LE(8), vSol = bc.data.readBigUInt64LE(16), rTok = bc.data.readBigUInt64LE(24), complete = bc.data[48] === 1;
    const mcapSol = vTok > 0n ? Number(vSol) / 1e9 / (Number(vTok) / 1e6) * 1e9 : null;
    const progress = Math.max(0, Math.min(1, Number(793100000000000n - rTok) / 793100000000000));
    return { mcapSol, progress: complete ? 1 : progress, complete };
  }
  return { mcapSol: null, progress: null, complete: false };
}

// ---------- one tick ----------
async function tickCoin(c, deadline) {
  const k = await keys(c.id);
  if (k.wallet.publicKey.toBase58() !== c.wallet) throw new Error('key mismatch');
  if (!c.fee_sig) await payFee(c, k).catch(() => null);
  try { await claim(c, k); } catch (e) { await L.log(c.id, 'error', 'claim failed: ' + String(e.message).slice(0, 160)); }
  if (Date.now() < deadline) { try { await payDev(c, k); } catch (e) { await L.log(c.id, 'error', 'dev payout failed, will retry: ' + String(e.message).slice(0, 140)); } }
  if (Date.now() < deadline) await retryPayouts(c).catch(() => null);
  const m = await market(c).catch(() => null);
  if (m) await L.q(`UPDATE mw_coins SET mcap_sol=$2, complete=$3 WHERE id=$1`, [c.id, m.mcapSol, !!m.complete]);
  await L.q(`UPDATE mw_coins SET ticked_at=now() WHERE id=$1`, [c.id]);
}
async function tick(budgetMs = 40000) {
  await L.ready();
  const lock = await L.q(`INSERT INTO mw_meta (k, v) VALUES ('tick', $1) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v WHERE mw_meta.v::bigint < $2 RETURNING v`, [String(Date.now()), Date.now() - (L.MOCK ? 1500 : 50000)]);
  if (!lock.length) return { ok: true, skipped: 'a tick ran under a minute ago' };
  const deadline = Date.now() + budgetMs; const done = { launches: 0, mines: 0, errors: 0 };
  const pend = await L.q(`SELECT * FROM mw_coins WHERE state IN ('waiting','creating') OR (state IN ('expired','failed') AND refund_sig IS NULL) ORDER BY created_at LIMIT 20`);
  for (const c of pend) { if (Date.now() > deadline) break; try { await advance(c); done.launches++; } catch { done.errors++; } }
  const live = await L.q(`SELECT * FROM mw_coins WHERE state='live' ORDER BY ticked_at NULLS FIRST LIMIT 30`);
  for (const c of live) { if (Date.now() > deadline - Math.min(8000, budgetMs / 4)) break; try { await tickCoin(c, deadline); done.mines++; } catch (e) { done.errors++; await L.log(c.id, 'error', 'tick: ' + String(e.message).slice(0, 160)); } }
  await L.q(`DELETE FROM mw_miners WHERE seen_at < now() - interval '15 minutes'`).catch(() => {});
  await L.q(`INSERT INTO mw_meta (k, v) VALUES ('tick_done', $1) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v`, [String(Date.now())]);
  return { ok: true, ...done, at: new Date().toISOString() };
}

module.exports = { keys, newId, need, advance, tick, blockhash, sendRaw, confirm, portal, waiting, market, level, LEVELS, submit, holds,
  genesis, header, hashOf, head64, effTarget, expected, since, big,
  FEE, RESERVE, CREATE_COST, MIN_DEV, MAX_DEV, DEV_CAP, LAMPORTS, MIN_PAY, MIN_HOLD, COOLDOWN, BLOCK_SECS, T_INIT, T_EASY, T_HARD, TWO64 };
