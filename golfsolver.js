// Beam search: fewest strokes that collect every coin and hole out (3 stars), plus fewest strokes to just hole out.
const { GolfWorld, T, touchesWater, surfaceAt } = require('./physics.js');
const HOLES = require('./holes.js');
const ANG = 180, POWERS = [0.12, 0.17, 0.23, 0.3, 0.38, 0.47, 0.57, 0.68, 0.8, 0.92];

function shotsFrom(g) {
  const out = [];
  for (let i = 0; i < ANG; i++) for (const p of POWERS) {
    const a = i * 2 * Math.PI / ANG, w = g.clone();
    w.strike(a, p); w.events = null; w.run();
    if (w.dead) continue;
    out.push({ a, p, w });
  }
  return out;
}
function score(g, h) {
  const left = h.coins.map((c, i) => g.coins[i] ? null : c).filter(Boolean);
  const b = g.ball;
  const tgt = left.length ? left.reduce((m, c) => Math.hypot(c[0] - b.x, c[1] - b.y) < Math.hypot(m[0] - b.x, m[1] - b.y) ? c : m) : h.cup;
  return g.coins.filter(Boolean).length * 10000 - Math.hypot(tgt[0] - b.x, tgt[1] - b.y);
}
function solve(h, needCoins, maxDepth = 6, beam = 12) {
  let frontier = [{ g: new GolfWorld(h), line: [] }];
  for (let d = 1; d <= maxDepth; d++) {
    const next = [], seen = new Set();
    for (const st of frontier) {
      for (const s of shotsFrom(st.g)) {
        const line = [...st.line, { a: s.a, p: s.p }];
        const all = s.w.coins.every(Boolean);
        if (s.w.holed) { if (!needCoins || all) return line; continue; }
        const key = s.w.coins.map(Number).join('') + ':' + Math.round(s.w.ball.x / 45) + ',' + Math.round(s.w.ball.y / 45);
        if (seen.has(key)) continue; seen.add(key);
        next.push({ g: s.w, line, sc: score(s.w, h) });
      }
    }
    next.sort((x, y) => y.sc - x.sc);
    frontier = next.slice(0, beam);
  }
  return null;
}
if (require.main === module) {
  const only = process.argv[2] ? +process.argv[2] : null;
  const out = {};
  HOLES.forEach((h, i) => {
    if (only !== null && i !== only) return;
    if (touchesWater(h, h.start[0], h.start[1], T.R)) console.log('START IN WATER', i);
    h.coins.forEach((c, k) => { if (touchesWater(h, c[0], c[1], 13)) console.log('COIN IN WATER', i, k); });
    if (touchesWater(h, h.cup[0], h.cup[1], 30)) console.log('CUP IN WATER', i);
    const t0 = Date.now();
    const quick = solve(h, false, 5, 10), full = solve(h, true, 7, 14);
    console.log(`#${i} ${h.name}: hole-out ${quick ? quick.length : '-'} strokes, 3-star line ${full ? full.length : 'NONE'} strokes (${Date.now() - t0}ms)`);
    out[i] = { quick: quick && quick.length, line: full };
  });
  if (only === null) require('fs').writeFileSync('golf-solutions.json', JSON.stringify(out));
}
