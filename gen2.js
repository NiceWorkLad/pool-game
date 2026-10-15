// Puzzle generator v2.
//   node gen2.js <workerId> <seconds> [theme]
// Builds positions from themes (each controls the real difficulty drivers), solves them for SEVERAL
// winning lines, keeps the line a human is most likely to make, grades it with the margin-of-error
// model, and appends the raw record to bank/w<id>.jsonl. Tiers are assigned later by grade.js.
const fs = require('fs');
const { T, World, remainingMine } = require('./physics.js');
const { AIM, aimFor, geometry } = require('./ghost.js');
const S2 = require('./solver2.js');
const tol = require('./tol.js');
const R = T.R, DEG = Math.PI / 180;
const SOLIDS = [1, 2, 3, 4, 5, 6, 7], STRIPES = [9, 10, 11, 12, 13, 14, 15];

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
let rnd = Math.random;
const U = (a, b) => a + rnd() * (b - a);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const rot = ([x, y], t) => [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)];
const unit = ([x, y]) => { const d = Math.hypot(x, y) || 1; return [x / d, y / d]; };
const inside = (x, y, m) => x >= m && x <= T.W - m && y >= m && y <= T.H - m;
function segDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)); }
const clear = (balls, x, y, gap = 2 * R + 12) => balls.every(b => Math.hypot(b.x - x, b.y - y) > gap);
function scatter(balls, id, { margin = 60, gap = 2 * R + 14, avoid = [], avoidDist = 3 * R } = {}) {
  for (let k = 0; k < 300; k++) {
    const x = U(margin, T.W - margin), y = U(margin, T.H - margin);
    if (!clear(balls, x, y, gap)) continue;
    if (avoid.some(([ax, ay, bx, by]) => segDist(x, y, ax, ay, bx, by) < avoidDist)) continue;
    balls.push({ id, x: Math.round(x), y: Math.round(y) }); return true;
  }
  return false;
}
function groups() {
  const g = rnd() < 0.5 ? 'solids' : 'stripes';
  return { group: g, mine: shuffle((g === 'solids' ? SOLIDS : STRIPES).slice()), opp: shuffle((g === 'solids' ? STRIPES : SOLIDS).slice()) };
}

// ---- themes ----
// "pot": choose the three numbers the research says matter (cut angle, cue distance, ball-to-pocket distance), then build the table.
function themePot(knobs = {}) {
  const { group, mine, opp } = groups();
  for (let tries = 0; tries < 200; tries++) {
    const p = Math.floor(rnd() * 6), pk = AIM[p], side = p === 1 || p === 4;
    const cut = knobs.cut ?? U(0, 58), d1 = knobs.d1 ?? U(130, 640), d2 = knobs.d2 ?? U(130, 640);
    const toC = unit([T.W / 2 - pk[0], T.H / 2 - pk[1]]);
    const dir = rot(toC, U(side ? -55 : -38, side ? 55 : 38) * DEG);
    const obx = pk[0] + dir[0] * d2, oby = pk[1] + dir[1] * d2;
    if (!inside(obx, oby, 52)) continue;
    const u = unit([pk[0] - obx, pk[1] - oby]), gx = obx - u[0] * 2 * R, gy = oby - u[1] * 2 * R;
    const v = rot(u, (rnd() < 0.5 ? 1 : -1) * cut * DEG), cx = gx - v[0] * d1, cy = gy - v[1] * d1;
    if (!inside(cx, cy, R + 30)) continue;
    const useMine = rnd() < (knobs.mineP ?? 0.4) && !knobs.blackOnly;
    const balls = [{ id: 0, x: Math.round(cx), y: Math.round(cy) }];
    balls.push({ id: useMine ? mine[0] : 8, x: Math.round(obx), y: Math.round(oby) });
    const lines = [[cx, cy, gx, gy], [obx, oby, pk[0], pk[1]]];
    if (useMine && !scatter(balls, 8, { margin: 60, avoid: [] })) continue;
    const nOpp = knobs.nOpp ?? Math.floor(U(0, 3.5));
    for (let i = 0; i < nOpp; i++) scatter(balls, opp[i], { margin: 50, avoid: lines, avoidDist: knobs.avoid ?? 3.2 * R });
    return { theme: 'pot', group, balls, knobs: { p, cut: +cut.toFixed(1), d1: Math.round(d1), d2: Math.round(d2) } };
  }
  return null;
}
// "run": several own balls scattered, black last. Position play decides everything.
function themeRun() {
  const { group, mine, opp } = groups(), n = 1 + Math.floor(rnd() * 4), balls = [];
  scatter(balls, 0, { margin: 70 });
  for (let i = 0; i < n; i++) if (!scatter(balls, mine[i], { margin: 55 })) return null;
  if (!scatter(balls, 8, { margin: 55 })) return null;
  const nOpp = Math.floor(U(0, 4.2)); for (let i = 0; i < nOpp; i++) scatter(balls, opp[i], { margin: 50 });
  return { theme: 'run', group, balls, knobs: { n } };
}
// "blocked": a good pot with the obvious line cut off by an opposition ball.
function themeBlocked() {
  const base = themePot({ cut: U(0, 40), d1: U(180, 500), d2: U(160, 520), nOpp: 0, mineP: 0.3 }); if (!base) return null;
  const { opp } = groups(), balls = base.balls, cue = balls[0], tgt = balls[1], pk = AIM[base.knobs.p];
  const u = unit([pk[0] - tgt.x, pk[1] - tgt.y]), g = [tgt.x - u[0] * 2 * R, tgt.y - u[1] * 2 * R];
  const where = rnd();
  let bx, by;
  if (where < 0.45) { const t = U(0.35, 0.65); bx = cue.x + (g[0] - cue.x) * t + U(-0.7, 0.7) * R; by = cue.y + (g[1] - cue.y) * t + U(-0.7, 0.7) * R; }      // between cue and ball
  else { const d = U(2.4, 4) * R; bx = tgt.x + u[0] * d + U(-1, 1) * R * 0.9; by = tgt.y + u[1] * d + U(-1, 1) * R * 0.9; }                                       // guarding the pocket
  if (!inside(bx, by, R + 8) || !clear(balls, bx, by, 2 * R + 3)) return null;
  balls.push({ id: opp.find(i => !balls.some(b => b.id === i)), x: Math.round(bx), y: Math.round(by) });
  if (rnd() < 0.5) scatter(balls, opp.find(i => !balls.some(b => b.id === i)), { margin: 60 });
  return { theme: 'blocked', group: base.group, balls, knobs: base.knobs };
}
// "cluster": an own ball touching one or two opposition balls.
function themeCluster() {
  const { group, mine, opp } = groups(), balls = [];
  if (!scatter(balls, 0, { margin: 70 })) return null;
  const cx = U(300, 800), cy = U(110, 390), a0 = U(0, 6.28);
  balls.push({ id: mine[0], x: Math.round(cx), y: Math.round(cy) });
  const k = 1 + Math.floor(rnd() * 2);
  for (let i = 0; i < k; i++) {
    const a = a0 + i * (1.0 + rnd() * 0.5), gap = 2 * R + 0.6;
    const x = cx + Math.cos(a) * gap, y = cy + Math.sin(a) * gap;
    if (!inside(x, y, R + 4) || !clear(balls.slice(1), x, y, 2 * R + 0.05) || Math.hypot(x - balls[0].x, y - balls[0].y) < 2 * R + 10) return null;
    balls.push({ id: opp[i], x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
  }
  if (rnd() < 0.5 && !scatter(balls, mine[1], { margin: 60 })) return null;
  if (!scatter(balls, 8, { margin: 60 })) return null;
  return { theme: 'cluster', group, balls, knobs: { k } };
}
// "rail": own ball almost on the cushion.
function themeRail() {
  const { group, mine, opp } = groups(), balls = [];
  if (!scatter(balls, 0, { margin: 80 })) return null;
  const horiz = rnd() < 0.65, off = R + U(2, 12);
  const x = horiz ? U(160, 840) : (rnd() < 0.5 ? off : T.W - off), y = horiz ? (rnd() < 0.5 ? off : T.H - off) : U(110, 390);
  if (!clear(balls, x, y)) return null;
  balls.push({ id: mine[0], x: Math.round(x), y: Math.round(y) });
  if (!scatter(balls, 8, { margin: 60 })) return null;
  const nOpp = Math.floor(U(0, 3)); for (let i = 0; i < nOpp; i++) scatter(balls, opp[i], { margin: 50 });
  return { theme: 'rail', group, balls, knobs: {} };
}
// "gentle": short, straight-ish shots for the first rungs of a run
function themeGentle() { const c = themePot({ cut: U(0, 32), d1: U(110, 430), d2: U(110, 430), mineP: 0.45, nOpp: Math.floor(U(0, 3)) }); if (c) c.theme = 'gentle'; return c; }
const THEMES = { gentle: [themeGentle, 0], pot: [themePot, 25], run: [themeRun, 35], blocked: [themeBlocked, 20], cluster: [themeCluster, 10], rail: [themeRail, 10] };
function pickTheme(only) {
  if (only) return THEMES[only][0];
  if (only === undefined) { /* weighted */ }
  const tot = Object.values(THEMES).reduce((s, t) => s + t[1], 0); let r = rnd() * tot;
  for (const t of Object.values(THEMES)) { if ((r -= t[1]) < 0) return t[0]; }
}

// ---- evaluate ----
function evaluate(c, { quiet = true } = {}) {
  const t0 = Date.now(), world = new World(c.balls), nMine = remainingMine(world, c.group).length;
  let found = null, kindsUsed = 'direct';
  for (const [name, kinds] of [['direct', { bank: false, combo: false }], ['bank', { bank: true, combo: false }], ['combo', { bank: true, combo: true }]]) {
    const r = S2.findLines(world, c.group, { maxLines: 6, K: 3, maxDepth: nMine + 1, ms: 14000, kinds });
    if (r.lines.length) { found = r; kindsUsed = name; break; }
    if (Date.now() - t0 > 30000) break;
  }
  if (!found) return { reject: 'unsolvable' };
  const best = S2.bestLine(c.balls, c.group, found.lines);
  if (!best || best.p <= 0.0005) return { reject: 'hopeless' };
  const full = tol.fullWindows(best.st, best.line, c.group), g = tol.summarise(full);
  // reading difficulty: how many tempting first shots pot a ball but lose the position?
  const firstTarget = best.line[0].spec.id, seen = new Set(), probe = [];
  for (const o of found ? S2.pickContinues(found.rootConts, 40) : []) {
    const k = o.spec.id + '/' + o.spec.p; if (o.spec.id === firstTarget && o.spec.p === best.line[0].spec.p) continue;
    if (seen.has(k)) continue; seen.add(k); probe.push(o);
  }
  let tested = 0, trapped = 0;
  for (const o of probe.slice(0, 4)) { tested++; if (!S2.solvable(o.w, c.group, nMine + 1 - 1, 2)) trapped++; }
  const geo = best.line.map((s, k) => { const gg = geometry(best.st[k].w, s.spec); return { cut: +gg.cut.toFixed(1), d1: Math.round(gg.d1), d2: Math.round(gg.d2), pocket: gg.pocket, kind: gg.kind, spin: s.spin, pow: s.pow }; });
  return {
    theme: c.theme, group: c.group, balls: c.balls, knobs: c.knobs, nMine,
    sol: best.line.map(s => ({ ang: s.ang, pow: s.pow, spin: s.spin })), spec: best.line.map(s => s.spec),
    kinds: kindsUsed, grade: g, geo, traps: { tested, trapped }, lines: found.lines.length, ms: Date.now() - t0,
  };
}

module.exports = { THEMES, evaluate, pickTheme, mulberry, setRng: f => { rnd = f; } };

if (require.main === module) {
  const id = +process.argv[2] || 0, secs = +process.argv[3] || 60, only = process.argv[4];
  rnd = mulberry(1000003 * (id + 1) + (+process.argv[5] || 0));
  fs.mkdirSync('bank', { recursive: true });
  const out = `bank/w${id}.jsonl`, t0 = Date.now(), stat = { tried: 0, kept: 0, unsolvable: 0, hopeless: 0, nolayout: 0 };
  while (Date.now() - t0 < secs * 1000) {
    const c = pickTheme(only)(); stat.tried++;
    if (!c) { stat.nolayout++; continue; }
    const r = evaluate(c);
    if (r.reject) { stat[r.reject]++; continue; }
    fs.appendFileSync(out, JSON.stringify(r) + '\n'); stat.kept++;
    if (stat.kept % 5 === 0) console.log(`w${id}`, JSON.stringify(stat), `${((Date.now() - t0) / 1000) | 0}s`);
  }
  console.log(`w${id} done`, JSON.stringify(stat));
}
