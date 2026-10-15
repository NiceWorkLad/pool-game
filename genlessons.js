// Builds lessons.json for Learn mode. Every drill is constructed from shot geometry and verified with the
// real physics: the ghost-ball aim must pot the ball, zones must be reachable (and, for spin drills, only
// with the spin being taught), and each drill records its measured margin of error for the feedback text.
const fs = require('fs');
const { T, World, judge, remainingMine } = require('./physics.js');
const { AIM, aimFor } = require('./ghost.js');
const tol = require('./tol.js');
const { mulberry } = require('./gen2.js');
const R = T.R, DEG = Math.PI / 180;
let rnd = mulberry(424242);
const U = (a, b) => a + rnd() * (b - a);
const unit = ([x, y]) => { const d = Math.hypot(x, y) || 1; return [x / d, y / d]; };
const rot = ([x, y], t) => [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)];
const inside = (x, y, m) => x >= m && x <= T.W - m && y >= m && y <= T.H - m;
const r1 = v => Math.round(v * 10) / 10;

function sim(balls, ang, pow, spin) { const w = new World(balls); w.strike(ang, pow, spin); w.events = null; w.run(); return w; }
function pots(w, id, p) { const b = w.get(id); return !b.on && (p == null || b.pocket === p) && w.get(0).on && w.firstContact === id; }
// object ball `tid` sent into pocket p: cut angle, cue-to-ghost distance d1, ball-to-pocket distance d2
function geom({ p, cut, d1, d2, dirDeg, side, tid = 3 }) {
  const pk = AIM[p], toC = unit([T.W / 2 - pk[0], T.H / 2 - pk[1]]), dir = rot(toC, dirDeg * DEG);
  const ob = [pk[0] + dir[0] * d2, pk[1] + dir[1] * d2], u = unit([pk[0] - ob[0], pk[1] - ob[1]]);
  const g = [ob[0] - u[0] * 2 * R, ob[1] - u[1] * 2 * R], v = rot(u, side * cut * DEG), c = [g[0] - v[0] * d1, g[1] - v[1] * d1];
  if (!inside(...ob, R + 40) || !inside(...c, R + 36)) return null;
  return [{ id: 0, x: r1(c[0]), y: r1(c[1]) }, { id: tid, x: r1(ob[0]), y: r1(ob[1]) }];
}
// aim window (degrees, around the exact ghost-ball aim) for a success test at a given power and spin
function aimWindow(balls, tid, p, pow, spin, ok = w => pots(w, tid, p)) {
  const ang = aimFor(new World(balls), { id: tid, p, src: 0, off: 0 });
  const win = tol.window(d => ok(sim(balls, ang + d * DEG, pow, spin)));
  return win ? { ang, win, half: (win[1] - win[0]) / 2, centre: (win[0] + win[1]) / 2 } : null;
}
function cutOf(balls, tid, p) { const c = balls[0], b = balls.find(x => x.id === tid), pk = AIM[p], u = unit([pk[0] - b.x, pk[1] - b.y]), g = [b.x - u[0] * 2 * R, b.y - u[1] * 2 * R], v = unit([g[0] - c.x, g[1] - c.y]); return Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1]))) / DEG; }

// A pot drill: the exact ghost-ball aim must work, with a margin inside [minHalf, maxHalf].
function potDrill(spec, { pow = 0.45, spin = 0, minHalf = 0.2, maxHalf = 9, extra = [], tries = 4000 } = {}) {
  for (let t = 0; t < tries; t++) {
    const p = spec.p ?? [0, 2, 3, 5][Math.floor(rnd() * 4)];
    const balls = geom({ p, cut: spec.cut + U(-1, 1), d1: spec.d1 * U(0.9, 1.1), d2: spec.d2 * U(0.9, 1.1), dirDeg: U(-30, 30), side: rnd() < 0.5 ? 1 : -1, tid: spec.tid ?? 3 });
    if (!balls) continue;
    const all = balls.concat(extra.map(e => ({ ...e })));
    if (extra.some(e => all.some(b => b !== e && b.id !== e.id && Math.hypot(b.x - e.x, b.y - e.y) < 2 * R + 30))) continue;
    const a = aimWindow(all, spec.tid ?? 3, p, pow, spin);
    if (!a || a.half < minHalf || a.half > maxHalf || Math.abs(a.centre) > 0.25 || a.win[0] > -0.05 || a.win[1] < 0.05) continue;
    return { balls: all, target: spec.tid ?? 3, pocket: p, half: +a.half.toFixed(2), sol: [{ ang: a.ang, pow, spin }], cut: +cutOf(all, spec.tid ?? 3, p).toFixed(1) };
  }
  throw new Error('no pot drill for ' + JSON.stringify(spec));
}
// A zone drill: pot the ball AND stop the cue ball in a circle. `only` = the spin being taught must be needed.
function zoneDrill(spec, { spin, pow, zr = 1.8 * R, only = false, minPowWin = 0.06, minAim = 0.3 } = {}) {
  const t0 = Date.now(), why = { pot: 0, potCue: 0, out: 0, powWin: 0, only: 0, aim: 0 }; console.error('zone', JSON.stringify(spec), spin, pow);
  for (let t = 0; t < 600; t++) {
    if (t % 100 === 0) console.error('  zone try', t, ((Date.now() - t0) / 1000).toFixed(1) + 's');
    let d; try { d = potDrill(spec, { pow, spin, minHalf: 0.3, tries: 300 }); } catch (e) { why.pot++; continue; }
    const ang = d.sol[0].ang, w = sim(d.balls, ang, pow, spin), c = w.get(0);
    if (!pots(w, d.target, d.pocket)) { why.potCue++; continue; }
    if (!inside(c.x, c.y, R + 14)) { why.out++; continue; }
    const zone = { x: r1(c.x), y: r1(c.y), r: zr };
    const inZ = ww => pots(ww, d.target, d.pocket) && Math.hypot(ww.get(0).x - zone.x, ww.get(0).y - zone.y) < zone.r;
    // power window at the exact aim
    let lo = pow, hi = pow; while (lo > 0.08 && inZ(sim(d.balls, ang, lo - 0.01, spin))) lo -= 0.01; while (hi < 1 && inZ(sim(d.balls, ang, hi + 0.01, spin))) hi += 0.01;
    if (hi - lo < minPowWin) { why.powWin++; continue; }
    if (only) { let other = false; for (const s of [-1, 0, 1]) if (s !== spin) for (let q = 0.1; q <= 1.001 && !other; q += 0.02) if (inZ(sim(d.balls, ang, q, s))) other = true; if (other) { why.only++; continue; } }
    const a = tol.window(dd => inZ(sim(d.balls, ang + dd * DEG, pow, spin)));
    if (!a || (a[1] - a[0]) / 2 < minAim) { why.aim++; continue; }
    return { ...d, zone, sol: [{ ang, pow, spin }], powWin: [+lo.toFixed(2), +hi.toFixed(2)], half: +((a[1] - a[0]) / 2).toFixed(2) };
  }
  throw new Error('no zone drill for ' + JSON.stringify(spec) + ' ' + JSON.stringify(why));
}
// Position drill: pot the 3, land in the circle, from where the 5 is a straight pot. Then pot the 5.
function positionDrill(spec, opts) {
  const why = { pockets: 0, place: 0, first: 0, second: 0 };
  for (let t = 0; t < 120; t++) {
    const d = zoneDrill(spec, opts), z = d.zone;
    const cands = [0, 1, 2, 3, 4, 5].filter(q => q !== d.pocket).map(q => ({ q, dist: Math.hypot(AIM[q][0] - z.x, AIM[q][1] - z.y) })).filter(o => o.dist > 300 && o.dist < 760);
    if (!cands.length) { why.pockets++; continue; }
    let found = null;
    for (const o of cands) for (const frac of [0.45, 0.55, 0.65, 0.35]) {
      const u = unit([AIM[o.q][0] - z.x, AIM[o.q][1] - z.y]), along = o.dist * frac;
      const B = { id: 5, x: r1(z.x + u[0] * along), y: r1(z.y + u[1] * along) };
      if (!inside(B.x, B.y, R + 26) || d.balls.some(b => Math.hypot(b.x - B.x, b.y - B.y) < 2 * R + 30)) { why.place++; continue; }
      const balls = d.balls.concat([B]), w = sim(balls, d.sol[0].ang, d.sol[0].pow, d.sol[0].spin);
      if (!pots(w, d.target, d.pocket) || Math.hypot(w.get(0).x - z.x, w.get(0).y - z.y) > z.r || !w.get(5).on || Math.hypot(w.get(5).x - B.x, w.get(5).y - B.y) > 0.01) { why.first++; continue; }
      const after = w.balls.filter(b => b.on).map(b => ({ id: b.id, x: b.x, y: b.y })), a2 = aimWindow(after, 5, o.q, 0.4, 0);
      if (!a2 || a2.half < 0.45 || Math.abs(a2.centre) > 0.25) { why.second++; continue; }
      found = { ...d, balls, next: { id: 5, pocket: o.q }, sol: [d.sol[0], { ang: a2.ang, pow: 0.4, spin: 0 }] }; break;
    }
    if (found) return found;
  }
  throw new Error('no position drill ' + JSON.stringify(why));
}
// Choice drill: two candidate pots; the player picks the one with more margin for error, then plays it.
function choicePockets({ contrarian = false } = {}) {
  for (let t = 0; t < 6000; t++) {
    const ob = { id: 3, x: r1(U(260, 740)), y: r1(U(130, 370)) }, cue = { id: 0, x: r1(U(120, 880)), y: r1(U(90, 410)) };
    if (Math.hypot(ob.x - cue.x, ob.y - cue.y) < 180) continue;
    const balls = [cue, ob], cands = [];
    for (let p = 0; p < 6; p++) { if (cutOf(balls, 3, p) > 60) continue; const a = aimWindow(balls, 3, p, 0.5, 0); if (a && Math.abs(a.centre) < 0.25 && a.win[0] < -0.05 && a.win[1] > 0.05) cands.push({ p, half: a.half, ang: a.ang, d2: Math.hypot(AIM[p][0] - ob.x, AIM[p][1] - ob.y), cut: cutOf(balls, 3, p) }); }
    if (cands.length < 2) continue;
    cands.sort((a, b) => b.half - a.half);
    const good = cands[0], bad = cands[cands.length - 1];
    if (good.half < 1.6 * bad.half || bad.half < 0.15) continue;
    if (contrarian && !(good.d2 > 1.4 * bad.d2 && bad.cut > good.cut + 15)) continue;
    if (!contrarian && !(good.cut < 25)) continue;
    const pair = rnd() < 0.5 ? [good, bad] : [bad, good];
    return { balls, target: 3, options: pair.map((c, i) => ({ label: 'AB'[i], target: 3, pocket: c.p, half: +c.half.toFixed(2), cut: +c.cut.toFixed(0), d2: Math.round(c.d2) })), answer: pair.indexOf(good), sol: [{ ang: good.ang, pow: 0.5, spin: 0 }], half: +good.half.toFixed(2) };
  }
  throw new Error('no choice drill');
}
// Straight-in shots with the same cue-to-pocket distance: halfway (hardest) vs close to the pocket.
function choiceHalfway() {
  for (const [cx, pa, pb] of [[300, 0, 3], [300, 3, 0], [700, 2, 5], [700, 5, 2], [280, 0, 3], [720, 2, 5]]) {
    const cue = { id: 0, x: cx, y: 250 }, D = Math.hypot(AIM[pa][0] - cx, AIM[pa][1] - 250);
    const along = (p, d2, id) => { const u = unit([AIM[p][0] - cue.x, AIM[p][1] - cue.y]); return { id, x: r1(AIM[p][0] - u[0] * d2), y: r1(AIM[p][1] - u[1] * d2) }; };
    const X = along(pa, D / 2, 2), Y = along(pb, 100, 6), balls = [cue, X, Y];
    const ax = aimWindow(balls, 2, pa, 0.5, 0), ay = aimWindow(balls, 6, pb, 0.5, 0);
    console.error('halfway try', cx, pa, pb, ax && ax.half, ay && ay.half);
    if (!ax || !ay || ay.half < 1.4 * ax.half) continue;
    const opts = [{ label: 'A', target: 2, pocket: pa, half: +ax.half.toFixed(2) }, { label: 'B', target: 6, pocket: pb, half: +ay.half.toFixed(2) }];
    return { balls, options: opts, answer: 1, target: 6, sol: [{ ang: ay.ang, pow: 0.5, spin: 0 }], half: +ay.half.toFixed(2) };
  }
  throw new Error('no halfway drill');
}
// run-out drills from the graded bank
function runDrill(minShots, tier) {
  const SV = require('./survival.json');
  const c = SV.filter(p => p.rating === tier && p.sol.length >= minShots && p.theme !== 'cluster').sort((a, b) => b.club - a.club);
  const p = c[0]; return { balls: p.balls, group: p.group, sol: p.sol, club: p.club };
}

module.exports = { potDrill, zoneDrill, positionDrill, choicePockets, choiceHalfway, setSeed: n => { rnd = mulberry(n); } };
if (require.main === module) {
const L = [];
L.push({ id: 'ghost', title: 'The ghost ball', blurb: 'Aim the cue ball at where it has to be, not at the ball.',
  intro: ['To pot a ball, the cue ball has to arrive at one exact spot: touching the object ball on the line that runs from the pocket through the ball’s centre.',
    'Players call that imaginary ball the ghost ball. Aim the centre of the cue ball at the centre of the ghost, and the object ball goes where the ghost was pointing.',
    'These drills take the help away a step at a time: first the full guide, then just the ghost ball, then nothing.'],
  drills: [
    { title: 'Straight in', text: 'Line the guide up with the pocket and shoot.', assist: 'full', kind: 'pot', ...potDrill({ cut: 0, d1: 260, d2: 260 }, { minHalf: 0.5 }), tip: 'On a straight shot the ghost ball, object ball and pocket are all on one line.' },
    { title: 'A small cut', text: 'The dashed circle is the ghost ball. Send the cue ball at its centre.', assist: 'ghost', kind: 'pot', ...potDrill({ cut: 14, d1: 250, d2: 240 }, { minHalf: 0.45 }), tip: 'The object ball always leaves along the line between the two ball centres at contact.' },
    { title: 'A wider cut', text: 'Same again with a sharper angle. Aim at the ghost, not the ball.', assist: 'ghost', kind: 'pot', ...potDrill({ cut: 26, d1: 260, d2: 250 }, { minHalf: 0.4 }), tip: 'The bigger the cut, the further the ghost sits from the ball you can see.' },
    { title: 'No help', text: 'No guide this time. Picture the ghost ball yourself, then aim at it.', assist: 'cue', kind: 'pot', ...potDrill({ cut: 18, d1: 240, d2: 230 }, { minHalf: 0.5 }), tip: 'That picture in your head is what good players see on every shot.' },
  ] });
L.push({ id: 'cuts', title: 'Cut angles', blurb: 'Full, three-quarter, half and quarter-ball hits.',
  intro: ['How full you hit the object ball sets its angle. A full-ball hit sends it straight on.',
    'A three-quarter-ball hit (cue ball centre aimed a quarter of a ball off the object ball’s centre) cuts it about 15°. A half-ball hit (aimed at its edge) cuts it about 30°. A quarter-ball hit cuts it about 49°.',
    'Thin cuts are harder: the object ball gets less of the speed, and your margin for error shrinks quickly.'],
  drills: [
    { title: 'Half-ball', text: 'About 30°. Aim the centre of the cue ball at the edge of the object ball.', assist: 'ghost', kind: 'pot', ...potDrill({ cut: 30, d1: 230, d2: 230 }, { minHalf: 0.3 }), tip: 'Half-ball is the most useful reference angle in pool. Learn how it looks.' },
    { title: 'Three-quarter ball', text: 'About 15°. Aim a quarter of a ball off centre.', assist: 'cue', kind: 'pot', ...potDrill({ cut: 15, d1: 240, d2: 240 }, { minHalf: 0.4 }), tip: 'Between straight and half-ball, a three-quarter hit fills the gap.' },
    { title: 'Half-ball, no help', text: 'Find the half-ball hit on your own.', assist: 'cue', kind: 'pot', ...potDrill({ cut: 30, d1: 230, d2: 220 }, { minHalf: 0.3 }), tip: 'If you missed on the near side of the pocket you hit it too full (thick).' },
    { title: 'Quarter-ball', text: 'About 45°. A thin hit, and it needs a bit more pace.', assist: 'ghost', kind: 'pot', ...potDrill({ cut: 44, d1: 200, d2: 200, p: undefined }, { pow: 0.6, minHalf: 0.2 }), tip: 'Thin cuts leave very little room. That is why players avoid them when they can.' },
  ] });
L.push({ id: 'margin', title: 'Pick the easier pot', blurb: 'Margin of error, and why halfway is hardest.',
  intro: ['How hard a pot is comes down to its margin of error: how far your aim can be off and the ball still drops.',
    'Research by Dr Dave Alciatore at Colorado State shows that margin shrinks as the cut gets thinner, as the cue ball gets further from the object ball, and as the object ball gets further from the pocket.',
    'For a straight shot it is the product of the two distances that matters, so the hardest place for the object ball is exactly halfway between the cue ball and the pocket.'],
  drills: [
    { title: 'Which pocket?', text: 'Two pockets are possible. Pick the one with more room for error, then pot it.', assist: 'ghost', kind: 'choice', ...choicePockets(), tip: 'A small cut nearly always beats a big one.' },
    { title: 'Closer isn’t always easier', text: 'One pocket is nearer. Is it the easier pot?', assist: 'ghost', kind: 'choice', ...choicePockets({ contrarian: true }), tip: 'A short, thin cut can be harder than a longer, fuller one.' },
    { title: 'The halfway trap', text: 'Both are dead straight, and both are the same distance from cue ball to pocket. Which has more room?', assist: 'ghost', kind: 'choice', ...choiceHalfway(), tip: 'Same total distance, very different margins: halfway is the hardest place for the object ball to be.' },
  ] });
L.push({ id: 'spin', title: 'Stun, draw and follow', blurb: 'Control where the cue ball goes after contact.',
  intro: ['Spin decides where the cue ball goes after it hits the object ball.',
    'Stun (no spin at contact): on a straight shot the cue ball stops dead. On a cut it leaves at 90° to the object ball’s path. Players call this the 90° rule.',
    'Follow (top spin) pushes the cue ball forward of that line. Draw (back spin) pulls it back. More power makes both effects bigger.'],
  drills: [
    { title: 'Stop shot', text: 'Pot it and stop the cue ball in the circle. Use stun.', assist: 'full', kind: 'zone', ...zoneDrill({ cut: 0, d1: 220, d2: 240 }, { spin: 0, pow: 0.4, zr: 1.6 * R }), tip: 'Stun on a straight shot hands all the speed to the object ball.' },
    { title: 'Draw back', text: 'Pot it and screw the cue ball back into the circle. Use draw.', assist: 'full', kind: 'zone', ...zoneDrill({ cut: 0, d1: 220, d2: 200 }, { spin: -1, pow: 0.5, only: true, zr: 2.6 * R }), tip: 'Draw needs pace: the spin has to survive the trip to the object ball.' },
    { title: 'Follow through', text: 'Pot it and roll the cue ball on into the circle. Use follow.', assist: 'full', kind: 'zone', ...zoneDrill({ cut: 8, d1: 200, d2: 380 }, { spin: 1, pow: 0.42, only: true, zr: 2 * R }), tip: 'Follow is the gentlest way to move the cue ball forward.' },
    { title: 'The 90° rule', text: 'A cut with stun. The cue ball leaves at right angles to the object ball. Land it in the circle.', assist: 'ghost', kind: 'zone', ...zoneDrill({ cut: 32, d1: 230, d2: 240 }, { spin: 0, pow: 0.5, zr: 2 * R }), tip: 'Know the 90° line and you can predict the cue ball before you shoot.' },
  ] });
L.push({ id: 'position', title: 'Position play', blurb: 'Pot this one and leave the next one easy.',
  intro: ['Good players don’t just pot the ball. They leave the cue ball where the next shot is easy.',
    'Choose the speed and spin that send the cue ball to a good spot, then the next pot looks after itself.'],
  drills: [
    { title: 'Set up the next', text: 'Pot the 3 and land in the circle. From there the 5 is straight in. Then pot the 5.', assist: 'full', kind: 'zone', ...positionDrill({ cut: 14, d1: 220, d2: 260 }, { spin: 1, pow: 0.32, zr: 2.4 * R }), tip: 'Straight-in shots are easiest, so plan to leave yourself straight.' },
    { title: 'Stop for the next', text: 'Pot the 3, stop in the circle, then pot the 5.', assist: 'ghost', kind: 'zone', ...positionDrill({ cut: 0, d1: 230, d2: 230 }, { spin: 0, pow: 0.4, zr: 2 * R }), tip: 'Sometimes the best position is right where you are.' },
    { title: 'Draw for the next', text: 'Pot the 3, draw back into the circle, then pot the 5.', assist: 'ghost', kind: 'zone', ...positionDrill({ cut: 8, d1: 220, d2: 200 }, { spin: -1, pow: 0.5, zr: 2.6 * R }), tip: 'Draw shots let you come back towards the middle of the table.' },
  ] });
L.push({ id: 'together', title: 'Putting it together', blurb: 'The 8-ball rules, then clear the table.',
  intro: ['In 8-ball one player has the solids (1–7), the other the stripes (9–15). You must hit one of your own balls first, pot all of them, then pot the black.',
    'Pot the black early, or scratch on it, and you lose. In these drills you play the whole visit: every shot must hit your group first and pot one of your balls.',
    'Use what you’ve learned: pick the pots with the most room, and leave the cue ball straight for the next one.'],
  drills: [
    { title: 'Run out: easy', text: '', assist: 'full', kind: 'run', ...runDrill(2, 1), tip: 'That’s a run out.' },
    { title: 'Run out: medium', text: '', assist: 'ghost', kind: 'run', ...runDrill(3, 2), tip: 'Planning the order makes each pot easier.' },
    { title: 'Run out: on your own', text: '', assist: 'cue', kind: 'run', ...runDrill(3, 3), tip: 'You’re ready for Puzzles and Survival.' },
  ] });
for (const l of L) for (const d of l.drills) { d.group = d.group || 'solids'; if (d.kind === 'run') { const mine = d.balls.filter(b => (d.group === 'solids' ? b.id < 8 : b.id > 8) && b.id !== 0).length; d.text = `You’re ${d.group}. Pot ${mine === 1 ? 'your ball' : mine === 2 ? 'both your balls' : 'all ' + mine + ' of your balls'}, then the black.`; } }

// ---- verify: replay every drill's stored solution ----
let ok = 0, bad = 0;
for (const l of L) for (const d of l.drills) {
  let pass = false;
  if (d.kind === 'run') { const w = new World(d.balls); let j; for (const s of d.sol) { const m = remainingMine(w, d.group); w.strike(s.ang, s.pow, s.spin); w.events = null; w.run(); j = judge(w, d.group, m).result; if (j !== 'continue') break; } pass = j === 'win'; }
  else {
    const tgt = d.kind === 'choice' ? d.options[d.answer] : { target: d.target, pocket: d.pocket };
    const w = sim(d.balls, d.sol[0].ang, d.sol[0].pow, d.sol[0].spin); pass = pots(w, tgt.target, tgt.pocket);
    if (d.zone) pass = pass && Math.hypot(w.get(0).x - d.zone.x, w.get(0).y - d.zone.y) < d.zone.r;
    if (d.next) { const w2 = new World(w.balls.filter(b => b.on)); w2.strike(d.sol[1].ang, d.sol[1].pow, d.sol[1].spin); w2.events = null; w2.run(); pass = pass && pots(w2, d.next.id, d.next.pocket); }
  }
  pass ? ok++ : bad++;
  console.log(pass ? 'ok  ' : 'FAIL', l.id.padEnd(9), d.title.padEnd(26), d.kind.padEnd(7), 'margin ±' + (d.half ?? '-') + '°', d.cut !== undefined ? 'cut ' + d.cut + '°' : '', d.powWin ? 'power ' + d.powWin.join('-') : '', d.options ? d.options.map(o => o.label + ':±' + o.half).join(' ') : '');
}
fs.writeFileSync('lessons.json', JSON.stringify(L));
console.log(`${ok} drills verified, ${bad} failed`);
process.exit(bad ? 1 : 0);

}
