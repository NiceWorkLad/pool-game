// Difficulty = how precisely each shot of the known solution has to be played.
// For every shot we measure the aim window (degrees) and power window (fraction) that still work,
// then score each shot by how tight those windows are. Tighter windows and more shots = harder.
const { World, GolfWorld, judge, remainingMine } = require('./physics.js');
const fs = require('fs');
const DEG = Math.PI / 180;

function scan(ok, maxSteps, step) { // contiguous width around 0 where ok(offset) holds
  let l = 0, r = 0;
  for (let i = 1; i <= maxSteps && ok(-i * step); i++) l = i;
  for (let i = 1; i <= maxSteps && ok(i * step); i++) r = i;
  return (l + r + 1) * step;
}
function shotScore(aimWin, powWin) {
  const a = Math.max(0, Math.log2(1.6 / Math.max(aimWin, 0.02)));
  const p = Math.max(0, 0.6 * Math.log2(0.25 / Math.max(powWin, 0.01)));
  return a + p;
}
function ratePool(balls, group, line) {
  let w = new World(balls), total = 0; const shots = [];
  line.forEach((s, k) => {
    const last = k === line.length - 1;
    const good = (ang, pow) => { const c = w.clone(); const m = remainingMine(c, group); c.strike(ang, pow, s.spin); c.events = null; c.run(); const j = judge(c, group, m).result; return last ? j === 'win' : j === 'continue' || j === 'win'; };
    const aimWin = scan(o => good(s.ang + o * DEG, s.pow), 150, 0.02);
    const powWin = scan(o => good(s.ang, s.pow * (1 + o)), 20, 0.02);
    const sc = shotScore(aimWin, powWin); total += sc; shots.push({ aimWin: +aimWin.toFixed(2), powWin: +powWin.toFixed(2) });
    const m = remainingMine(w, group); w.strike(s.ang, s.pow, s.spin); w.events = null; w.run();
  });
  return { score: total + 0.6 * (line.length - 1), shots };
}
function rateGolf(hole, line) {
  let w = new GolfWorld(hole), total = 0; const shots = [];
  line.forEach((s) => {
    const ref = w.clone(); ref.strike(s.a, s.p); ref.events = null; ref.run();
    const good = (ang, pow) => { const c = w.clone(); c.strike(ang, pow); c.events = null; c.run(); if (c.dead) return false; if (ref.holed && !c.holed) return false; return ref.coins.every((v, i) => !v || c.coins[i]); };
    const aimWin = scan(o => good(s.a + o * DEG, s.p), 150, 0.02);
    const powWin = scan(o => good(s.a, s.p * (1 + o)), 20, 0.02);
    total += shotScore(aimWin, powWin); shots.push({ aimWin: +aimWin.toFixed(2), powWin: +powWin.toFixed(2) });
    w.strike(s.a, s.p); w.events = null; w.run();
  });
  return { score: total + 0.6 * (line.length - 1), shots };
}
// Fixed thresholds so ratings stay stable as content is added
const toRating = sc => sc < 2 ? 1 : sc < 4 ? 2 : sc < 6.5 ? 3 : sc < 9.5 ? 4 : 5;

const P = require('./puzzles.js'), S = require('./solutions.json'), H = require('./holes.js'), G = require('./golf-solutions.json');
const SV = JSON.parse(fs.readFileSync('survival.json', 'utf8'));
const out = { puzzles: [], golf: [], survival: [] };
// hand-made puzzles are graded by the same margin-of-error model as the generated bank
const G2 = require('./gen2.js'), GR = require('./grade.js');
P.forEach((p, i) => {
  const e = G2.evaluate({ theme: 'hand', group: p.group, balls: p.balls, knobs: {} });
  let e2 = e;
  if (e.reject) { // the line finder missed it: grade the stored solution instead, rebuilding each shot as an aim spec
    const { aimFor, geometry } = require('./ghost.js'), tol = require('./tol.js'), { World: W, remainingMine: rm } = require('./physics.js');
    let w = new W(p.balls); const line = [];
    for (const s of S[i]) {
      let best = null;
      for (let src = 0; src < 5; src++) { const spec = { id: s.target, p: s.pocket, src, off: 0 }; const a = aimFor(w, spec); if (a === null) continue; const off = Math.atan2(Math.sin(s.ang - a), Math.cos(s.ang - a)); if (!best || Math.abs(off) < Math.abs(best.spec.off)) best = { spec: { ...spec, off }, ang: s.ang, pow: s.pow, spin: s.spin }; }
      line.push(best); w.strike(s.ang, s.pow, s.spin); w.events = null; w.run();
    }
    const st = tol.lineStates(p.balls, p.group, line), full = tol.fullWindows(st, line, p.group);
    e2 = { grade: tol.summarise(full), traps: { tested: 0, trapped: 0 }, sol: line, geo: line.map((l, k) => geometry(st[k].w, l.spec)) };
    console.log('puzzle', i, p.name, '(graded from stored solution)');
  }
  const e0 = e2; const sc = GR.score(e0); out.puzzles.push({ score: +sc.toFixed(2), rating: GR.tierOf(sc), club: e0.grade.P.club });
  console.log('puzzle', i, p.name.padEnd(18), 'shots', e0.sol.length, 'club', e0.grade.P.club, 'score', sc.toFixed(2), 'tier', GR.tierOf(sc));
});
H.forEach((h, i) => { const r = rateGolf(h, G[i].line); out.golf.push({ score: +r.score.toFixed(2), rating: toRating(r.score) }); console.log('hole', i, h.name, r.score.toFixed(2), toRating(r.score), JSON.stringify(r.shots)); });
SV.forEach(p => out.survival.push({ score: p.score, rating: p.rating, club: p.club }));
const hist = [1, 2, 3, 4, 5].map(k => out.survival.filter(x => x.rating === k).length);
console.log('survival ratings 1..5:', hist.join(' '));
fs.writeFileSync('ratings.json', JSON.stringify(out));
