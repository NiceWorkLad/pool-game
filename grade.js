// Turn raw generator records into tiers, pick a balanced bank, sanity-check against the research.
//   node grade.js            -> survival.json (+ ratings.json survival/puzzles), report on stdout
const fs = require('fs');
const G = require('./gen2.js');

// Tier = how often a club-level player (aim sigma 0.45 deg, speed sigma 9%) makes the best line, in "bits of luck":
//   bits = -log2(P_club).  Anchors: P>=70% -> tier 1, >=35% -> 2, >=12% -> 3, >=2% -> 4, below -> 5.
const CUTS = [0.5, 1.5, 3.0, 5.6];
const bitsOf = p => -Math.log2(Math.max(p, 1e-4));
function reading(r) { // extra bits for how hard the line is to FIND
  const trapRate = r.traps.tested ? r.traps.trapped / r.traps.tested : 0;
  const odd = r.geo.filter(g => g.kind !== 'direct').length;
  return 1.5 * trapRate + 0.8 * odd + 0.2 * (r.sol.length - 1);
}
function score(r) { return bitsOf(r.grade.P.club) + reading(r); }
const tierOf = s => CUTS.filter(c => s >= c).length + 1;
const NAMES = ['', 'Easy', 'Medium', 'Tricky', 'Hard', 'Expert'];

function load() {
  const rows = [];
  for (const f of fs.readdirSync('bank')) if (f.endsWith('.jsonl')) for (const l of fs.readFileSync('bank/' + f, 'utf8').split('\n')) if (l.trim()) { try { rows.push(JSON.parse(l)); } catch (e) { } }
  // drop anything with balls closer than touching
  return rows.filter(r => r.balls.every((a, i) => r.balls.every((b, j) => j <= i || Math.hypot(a.x - b.x, a.y - b.y) >= 44.02)));
}
function spearman(a, b) {
  const rank = v => { const idx = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]); const r = new Array(v.length); idx.forEach(([, i], k) => r[i] = k); return r; };
  const ra = rank(a), rb = rank(b), n = a.length, m = (n - 1) / 2; let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (ra[i] - m) * (rb[i] - m); da += (ra[i] - m) ** 2; db += (rb[i] - m) ** 2; }
  return num / Math.sqrt(da * db);
}
if (require.main === module) {
  const rows = load(); rows.forEach(r => { r.score = score(r); r.rating = tierOf(r.score); });
  console.log('records', rows.length);
  const by = {}; rows.forEach(r => (by[r.rating] = by[r.rating] || []).push(r));
  console.log('per tier:', [1, 2, 3, 4, 5].map(t => `${t}:${(by[t] || []).length}`).join('  '));
  console.log('theme x tier'); for (const th of Object.keys(G.THEMES)) console.log(' ', th.padEnd(8), [1, 2, 3, 4, 5].map(t => String(rows.filter(r => r.theme === th && r.rating === t).length).padStart(4)).join(''));

  // --- does the grade follow the research? black-only single direct shots: only cut, d1, d2 and pocket vary
  const solo = rows.filter(r => r.theme === 'pot' && r.sol.length === 1 && r.kinds === 'direct');
  if (solo.length > 12) {
    const D = solo.map(r => bitsOf(r.grade.P.club)), cut = solo.map(r => r.geo[0].cut), d1 = solo.map(r => r.geo[0].d1), d2 = solo.map(r => r.geo[0].d2);
    const prod = solo.map(r => r.geo[0].d1 * r.geo[0].d2);
    console.log(`\nSingle black shots (n=${solo.length}), Spearman correlation of difficulty (bits) with:`);
    console.log('  cut angle           ', spearman(D, cut).toFixed(2));
    console.log('  cue-to-ball distance', spearman(D, d1).toFixed(2));
    console.log('  ball-to-pocket dist ', spearman(D, d2).toFixed(2));
    console.log('  d1 x d2 (TP 3.4)    ', spearman(D, prod).toFixed(2));
    const idx = solo.map(r => Math.log(r.geo[0].d1 * r.geo[0].d2) + 2.2 * Math.log(1 / Math.cos(Math.min(r.geo[0].cut, 80) * Math.PI / 180)));
    console.log('  ln(d1 d2) + 2.2 ln(1/cos cut)', spearman(D, idx).toFixed(2));
  }
  // --- balanced bank
  const WANT = +process.argv[2] || 60, bank = [];
  for (let t = 1; t <= 5; t++) {
    const pool = (by[t] || []).slice().sort(() => 0);
    // round-robin over themes so each tier mixes shot types; within a theme prefer the middle of the tier's range
    const themes = {}; pool.forEach(r => (themes[r.theme] = themes[r.theme] || []).push(r));
    const keys = Object.keys(themes); let i = 0, taken = 0; const seen = new Set();
    while (taken < WANT && keys.some(k => themes[k].length)) {
      const k = keys[i++ % keys.length]; const r = themes[k].shift(); if (!r) continue;
      const key = r.balls.map(b => `${b.id}:${Math.round(b.x / 40)},${Math.round(b.y / 40)}`).join('|'); if (seen.has(key)) continue; seen.add(key);
      bank.push(r); taken++;
    }
    console.log(`tier ${t} ${NAMES[t]}: picked ${taken} / ${pool.length}`);
  }
  fs.writeFileSync('survival.json', JSON.stringify(bank.map(r => ({
    tier: r.rating - 1, group: r.group, balls: r.balls, sol: r.sol, theme: r.theme,
    rating: r.rating, score: +r.score.toFixed(2), club: r.grade.P.club, strong: r.grade.P.strong, casual: r.grade.P.casual, s70: r.grade.sigma70,
  }))));
  console.log('wrote survival.json', bank.length);
}
module.exports = { score, tierOf, bitsOf, NAMES, CUTS, reading };
