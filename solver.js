const { T, World, judge, remainingMine, groupIds } = require('./physics.js');
const AIM = [[0, 0], [500, 0], [1000, 0], [0, 500], [500, 500], [1000, 500]];
const POWERS = [0.16, 0.22, 0.3, 0.4, 0.52, 0.66, 0.82, 1];
const SPINS = [-1, 0, 1];
const OFFS = [-0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6].map(d => d * Math.PI / 180);

function candidates(world, group, bank) {
  const cue = world.get(0);
  const mine = remainingMine(world, group);
  const targets = mine.length ? mine : [8];
  const out = [];
  for (const id of targets) {
    const b = world.get(id);
    for (let p = 0; p < 6; p++) {
      const [px, py] = AIM[p];
      const dx = px - b.x, dy = py - b.y, d = Math.hypot(dx, dy);
      const gx = b.x - dx / d * 2 * T.R, gy = b.y - dy / d * 2 * T.R;
      const srcs = bank
        ? [[gx, -gy], [gx, 2 * T.H - gy], [-gx, gy], [2 * T.W - gx, gy]]
        : [[gx, gy]];
      for (const [ax, ay] of srcs) {
        const ang = Math.atan2(ay - cue.y, ax - cue.x);
        if (!bank) {
          const ca = Math.acos(((ax - cue.x) * dx + (ay - cue.y) * dy) / (Math.hypot(ax - cue.x, ay - cue.y) * d));
          if (ca > 82 * Math.PI / 180) continue;
        }
        out.push({ id, p, ang });
      }
    }
  }
  return out;
}

function trySh(world, group, ang, pow, spin) {
  const w = world.clone();
  const mineBefore = remainingMine(w, group);
  w.strike(ang, pow, spin); w.events = null; w.run();
  return { w, j: judge(w, group, mineBefore) };
}

let sims = 0;
function search(world, group, depth, K, stats) {
  const results = [];
  for (const bank of [false, true]) {
    for (const c of candidates(world, group, bank)) {
      for (const o of OFFS) for (const pw of POWERS) for (const sp of SPINS) {
        sims++;
        const ang = c.ang + o;
        const { w, j } = trySh(world, group, ang, pw, sp);
        const shot = { ang, pow: pw, spin: sp, target: c.id, pocket: c.p };
        if (stats) { stats.total++; if (j.result !== 'fail' && j.result !== 'lose') stats.ok++; }
        if (j.result === 'win') return [shot];
        if (j.result === 'continue') results.push({ shot, w });
      }
    }
    if (results.length) break;
  }
  if (depth <= 1) return null;
  // diversify: dedupe by cue position bucket
  const seen = new Set(), pick = [];
  results.sort(() => 0); // keep order
  for (const r of results) {
    const c = r.w.get(0); const key = r.w.balls.filter(b => b.on).length + ':' + Math.round(c.x / 60) + ',' + Math.round(c.y / 60);
    if (seen.has(key)) continue; seen.add(key); pick.push(r);
  }
  // prefer cue near centre of table
  pick.sort((a, b) => { const ca = a.w.get(0), cb = b.w.get(0); return Math.hypot(ca.x - 500, ca.y - 250) - Math.hypot(cb.x - 500, cb.y - 250); });
  for (const r of pick.slice(0, K)) {
    const rest = search(r.w, group, depth - 1, K, null);
    if (rest) return [r.shot, ...rest];
  }
  return null;
}

module.exports = { search, candidates, trySh, get sims() { return sims; } };

if (require.main === module) {
  const P = require('./puzzles.js');
  const only = process.argv[2] ? +process.argv[2] : null;
  const sol = {};
  P.forEach((pz, i) => {
    if (only !== null && i !== only) return;
    const w = new World(pz.balls);
    const stats = { total: 0, ok: 0 };
    sims = 0; const t0 = Date.now();
    const s = search(w, pz.group, pz.balls.length, 4, stats);
    console.log(`#${i} ${pz.name}: ${s ? 'SOLVED in ' + s.length : 'NO SOLUTION'}  firstShotLegal=${stats.ok}/${stats.total} sims=${sims} ${Date.now() - t0}ms`);
    if (s) sol[i] = s;
  });
  require('fs').writeFileSync('solutions.json', JSON.stringify(sol));
}
