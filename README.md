# minewrld

every coin is a mine. your browser mines it. every block pays SOL.

launch a pump.fun coin here and it becomes a mine: a wallet made for that coin and set as its creator. every minute the engine claims the coin's creator fees into the mine's pool (minus the launcher's locked dev cut, 0–30%). each coin runs its own SHA-256 proof-of-work chain; browsers mine it in rig.exe, and whoever finds the next block is paid the whole pool in one Solana transaction whose memo carries the block's hash.

- `index.html`, `assets/` — the intro (down the shaft, three.js) and minewrld OS (rig.exe, launch.exe, veins, chain.exe, stats.exe, ledger, terminal, paint).
- `api/minewrld.js` — the one function: config, prepare, paybuild, relay, status, veins, vein, work, submit, eligible, ping, blocks, feed, stats, tick, meta/img, selftest.
- `api/_engine.js` — the custodial engine (keys derived from one master secret, PumpPortal for create / claim, block checks and payouts).

needs `DATABASE_URL` (Postgres). optional: `RPC_URL` (or `RPC_URLS`), `MW_FEE_WALLET`, `PINATA_JWT`, `PRIORITY_FEE`, `MW_MASTER`.
