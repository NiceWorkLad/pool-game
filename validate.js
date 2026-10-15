// Does the grader reproduce what the pool-difficulty research says?
const { T, World } = require('./physics.js');
const { aimFor, AIM } = require('./ghost.js');
const tol = require('./tol.js');
const R = T.R;
function grade(balls, spec, pow = 0.5) {
  const w = new World(balls); const ang = aimFor(w, spec);
  const line = [{ spec, ang, pow, spin: 0 }];
  const st = tol.lineStates(balls, 'solids', line);
  // black-only position so the single shot must win
  const wins = tol.quickWindows(st, line, 'solids');
  return { win: wins[0], P: tol.quickP(wins, 0.3) };
}
const pocket = AIM[5], u = (() => { const d = Math.hypot(pocket[0], pocket[1]); return [-pocket[0] / d, -pocket[1] / d]; })(); // from pocket toward far corner
const at = d => ({ x: pocket[0] + u[0] * d, y: pocket[1] + u[1] * d });
// 1. straight shot, cue-to-pocket distance D fixed, slide the object ball (pooltool: hardest near D/2)
const D = 900; console.log(`Straight-in shot, cue ${D} from the pocket; object ball slides along the line`);
console.log('d2(ball→pocket)  d1(cue→ball)  half-window°  P(σ=0.3°)  1/(d1·d2) ∝');
for (let d2 = 120; d2 <= 760; d2 += 80) {
  const ob = at(d2), cb = at(D);
  const r = grade([{ id: 0, x: cb.x, y: cb.y }, { id: 8, x: ob.x, y: ob.y }], { id: 8, p: 5, src: 0, off: 0 });
  const d1 = D - d2 - 2 * R;
  console.log(String(d2).padStart(8), String(d1).padStart(12), r.win ? ((r.win[1] - r.win[0]) / 2).toFixed(3).padStart(14) : '   none', r.P.toFixed(3).padStart(10), (1e6 / (d1 * d2)).toFixed(2).padStart(10));
}
// 2. cut angle sweep: fixed distances, swing the cue ball round the ghost ball
console.log('\nCut-angle sweep (ball 260 from pocket, cue 200 from the ghost ball)');
console.log('cut°  half-window°  P(σ=0.3°)');
const ob = at(260), g = { x: ob.x - u[0] * 2 * R, y: ob.y - u[1] * 2 * R };
const toP = [-u[0], -u[1]]; // ghost->pocket direction
for (const cut of [0, 10, 20, 30, 40, 50, 60, 65]) {
  const th = cut * Math.PI / 180; let res = null;
  for (const sgn of [1, -1]) {
    const dx = toP[0] * Math.cos(th) - sgn * toP[1] * Math.sin(th), dy = toP[1] * Math.cos(th) + sgn * toP[0] * Math.sin(th);
    const cb = { x: g.x - dx * 200, y: g.y - dy * 200 };
    if (cb.x < 60 || cb.x > 940 || cb.y < 60 || cb.y > 440) continue;
    res = grade([{ id: 0, x: cb.x, y: cb.y }, { id: 8, x: ob.x, y: ob.y }], { id: 8, p: 5, src: 0, off: 0 }); break;
  }
  console.log(String(cut).padStart(4), res ? (res.win ? ((res.win[1] - res.win[0]) / 2).toFixed(3).padStart(13) : '         none') : '   (off the table)', res ? res.P.toFixed(3).padStart(10) : '');
}
