// Line finder: unlike solver.js (first win and stop) this collects several complete winning lines,
// then keeps the one a real player is most likely to pull off (highest chance at a reference skill).
const { T, World, judge, remainingMine } = require('./physics.js');
const { aimFor, geometry } = require('./ghost.js');
const tol = require('./tol.js');

const POWERS = [0.16, 0.22, 0.3, 0.4, 0.52, 0.66, 0.82, 1];
const SPINS = [0, -1, 1];
const OFFS = [0, 0.4, -0.4, 0.8, -0.8].map(d => d * Math.PI / 180);
const SCREEN_POW = 0.6;
let sims = 0;

function enumSpecs(world, group, kinds) {
  const mine = remainingMine(world, group), targets = mine.length ? mine : [8], out = [];
  for (const id of targets) for (let p = 0; p < 6; p++) {
    out.push({ id, p, src: 0 });
    if (kinds.bank) for (let src = 1; src <= 4; src++) out.push({ id, p, src });
    if (kinds.combo && mine.length >= 2) for (const via of mine) if (via !== id) out.push({ id, via, p, src: 0 });
  }
  return out;
}
function run(world, group, mine, ang, pow, spin) {
  sims++;
  const w = world.clone(); w.strike(ang, pow, spin); w.events = null; w.run();
  return { w, j: judge(w, group, mine).result };
}
// every playable (spec, power, spin) from this position
function options(world, group, kinds) {
  const mine = remainingMine(world, group), out = [];
  for (const spec0 of enumSpecs(world, group, kinds)) {
    const base = aimFor(world, { ...spec0, off: 0 }); if (base === null) continue;
    if (!spec0.src && spec0.via === undefined) { const g = geometry(world, spec0); if (g.cut > 80) continue; }
    let off = null;
    for (const o of OFFS) { const r = run(world, group, mine, base + o, SCREEN_POW, 0); if (r.j === 'win' || r.j === 'continue') { off = o; break; } }
    if (off === null) continue;
    const spec = { ...spec0, off };
    for (const pow of POWERS) for (const spin of SPINS) {
      const r = run(world, group, mine, base + off, pow, spin);
      if (r.j === 'win' || r.j === 'continue') out.push({ spec, ang: base + off, pow, spin, j: r.j, w: r.w });
    }
  }
  return out;
}
const specKey = s => `${s.id}/${s.via ?? ''}/${s.p}/${s.src}`;
// pick a robust representative per winning spec: middle of the powers that win, plain spin if possible
function pickWins(wins) {
  const by = new Map();
  for (const o of wins) { const k = specKey(o.spec); if (!by.has(k)) by.set(k, []); by.get(k).push(o); }
  return [...by.values()].map(list => {
    const plain = list.filter(o => o.spin === 0), use = plain.length ? plain : list;
    return use[Math.floor((use.length - 1) / 2)];
  });
}
function pickContinues(conts, K) {
  const seen = new Set(), pick = [];
  const ranked = conts.slice().sort((a, b) => { const ca = a.w.get(0), cb = b.w.get(0); return Math.hypot(ca.x - 500, ca.y - 250) - Math.hypot(cb.x - 500, cb.y - 250); });
  for (const o of ranked) {
    const c = o.w.get(0), key = specKey(o.spec) + ':' + Math.round(c.x / 70) + ',' + Math.round(c.y / 70) + ':' + o.w.balls.filter(b => b.on).length;
    if (seen.has(key)) continue; seen.add(key); pick.push(o);
  }
  return pick.slice(0, K);
}
// depth-first collection of winning lines. kinds escalate (direct, then banks, then combos) only if needed.
function findLines(world, group, { maxLines = 8, K = 3, maxDepth = 6, ms = 20000, kinds = { bank: false, combo: false } } = {}) {
  const lines = [], t0 = Date.now(), rootConts = [];
  const rec = (o) => ({ spec: o.spec, ang: o.ang, pow: o.pow, spin: o.spin });
  function dfs(w, depth, prefix, isRoot) {
    if (lines.length >= maxLines || Date.now() - t0 > ms) return;
    const os = options(w, group, kinds);
    if (isRoot) rootConts.push(...os.filter(o => o.j === 'continue'));
    for (const o of pickWins(os.filter(o => o.j === 'win'))) { lines.push([...prefix, rec(o)]); if (lines.length >= maxLines) return; }
    if (depth <= 1) return;
    for (const o of pickContinues(os.filter(o => o.j === 'continue'), K)) { dfs(o.w, depth - 1, [...prefix, rec(o)], false); if (lines.length >= maxLines || Date.now() - t0 > ms) return; }
  }
  dfs(world, maxDepth, [], true);
  return { lines, rootConts, ms: Date.now() - t0 };
}
// can the position still be won? (cheap yes/no used for "trap" detection)
function solvable(world, group, depth, K = 2, kinds = { bank: false, combo: false }) {
  const os = options(world, group, kinds);
  if (os.some(o => o.j === 'win')) return true;
  if (depth <= 1) return false;
  for (const o of pickContinues(os.filter(o => o.j === 'continue'), K)) if (solvable(o.w, group, depth - 1, K, kinds)) return true;
  return false;
}
// best line = highest chance at a reference skill (quick, centre-power windows)
function bestLine(balls, group, lines, sigma = tol.LEVELS.club) {
  let best = null;
  for (const line of lines) {
    const st = tol.lineStates(balls, group, line), wins = tol.quickWindows(st, line, group), p = tol.quickP(wins, sigma);
    if (!best || p > best.p) best = { line, st, wins, p };
  }
  return best;
}
module.exports = { options, findLines, solvable, bestLine, pickContinues, specKey, get sims() { return sims; } };
