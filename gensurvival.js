// Generate a bank of easy random 8-ball positions in three tiers; keep only ones the solver can win.
const { T, World } = require('./physics.js');
const { search } = require('./solver.js');
let seed = 20261014;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const R = T.R;

function place(balls, id) {
  for (let k = 0; k < 400; k++) {
    const x = 90 + rnd() * (T.W - 180), y = 70 + rnd() * (T.H - 140);
    if (balls.every(b => Math.hypot(b.x - x, b.y - y) > 2 * R + 14)) { balls.push({ id, x: Math.round(x), y: Math.round(y) }); return true; }
  }
  return false;
}
const TIERS = [
  { name: 'black', mine: 0, opp: [0, 2], want: 45 },
  { name: 'one', mine: 1, opp: [1, 3], want: 45 },
  { name: 'two', mine: 2, opp: [2, 4], want: 30 },
];
const out = [];
for (const [ti, t] of TIERS.entries()) {
  let made = 0, tried = 0;
  while (made < t.want && tried < 600) {
    tried++;
    const group = rnd() < 0.5 ? 'solids' : 'stripes';
    const mineIds = (group === 'solids' ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15]).sort(() => rnd() - 0.5);
    const oppIds = (group === 'solids' ? [9, 10, 11, 12, 13, 14, 15] : [1, 2, 3, 4, 5, 6, 7]).sort(() => rnd() - 0.5);
    const balls = [];
    place(balls, 0); place(balls, 8);
    for (let i = 0; i < t.mine; i++) place(balls, mineIds[i]);
    const nOpp = t.opp[0] + Math.floor(rnd() * (t.opp[1] - t.opp[0] + 1));
    for (let i = 0; i < nOpp; i++) place(balls, oppIds[i]);
    const stats = { total: 0, ok: 0 };
    const sol = search(new World(balls), group, t.mine + 1, 3, stats);
    if (!sol) continue;
    // "easy": a reasonable share of the obvious first shots are playable
    if (stats.total && stats.ok / stats.total < 0.04 && t.mine > 0) continue;
    out.push({ tier: ti, group, balls, sol: sol.map(s => ({ ang: s.ang, pow: s.pow, spin: s.spin })) });
    made++;
  }
  console.log(`tier ${ti} (${t.name}): ${made} puzzles from ${tried} tries`);
}
require('fs').writeFileSync('survival.json', JSON.stringify(out));
