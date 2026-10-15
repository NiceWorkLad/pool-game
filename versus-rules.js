// ---- Two-player 8-ball (pure rules: no DOM, so it can be tested in node) ----
const FOOT = [750, 250], HEAD_X = 250;
function makeRack(rand = Math.random) {
  // 8 in the middle of row 3, one solid and one stripe in the back corners, the rest shuffled
  const others = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
  for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
  const solid = others.find(id => id < 8), stripe = others.find(id => id > 8);
  const rest = others.filter(id => id !== solid && id !== stripe);
  const corners = rand() < 0.5 ? [solid, stripe] : [stripe, solid];
  const gap = T.R + 0.35, balls = [{ id: 0, x: HEAD_X - 20, y: 250 + (rand() - 0.5) * 60 }];
  for (let r = 0; r < 5; r++) for (let k = 0; k <= r; k++) {
    let id;
    if (r === 2 && k === 1) id = 8; else if (r === 4 && k === 0) id = corners[0]; else if (r === 4 && k === 4) id = corners[1]; else id = rest.pop();
    balls.push({ id, x: Math.round((FOOT[0] - 10 + r * Math.sqrt(3) * gap) * 100) / 100, y: Math.round((FOOT[1] + (k - r / 2) * 2 * gap) * 100) / 100 });
  }
  return balls;
}
function freeSpot(world, x, y, dir = [1, 0]) { // nearest free spot along a line, used to re-spot the 8 and the cue ball
  for (let k = 0; k < 60; k++) {
    for (const s of k ? [1, -1] : [1]) {
      const px = x + dir[0] * k * 6 * s, py = y + dir[1] * k * 6 * s;
      if (px < T.R + 2 || px > T.W - T.R - 2 || py < T.R + 2 || py > T.H - T.R - 2) continue;
      if (world.balls.every(b => !b.on || Math.hypot(b.x - px, b.y - py) > 2 * T.R + 1)) return [px, py];
    }
  }
  return [x, y];
}
const otherGroup = g => g === 'solids' ? 'stripes' : 'solids';
const groupOf = id => id < 8 ? 'solids' : 'stripes';
// vs: { players:[{name, group}], turn, isBreak }, mineBefore: own balls on the table before the shot
function judgeVersus(w, vs, mineBefore) {
  const p = vs.players[vs.turn], potted = w.potted.filter(id => id !== 0);
  const cueIn = w.potted.includes(0), black = potted.includes(8), fc = w.firstContact;
  const onBlack = !!p.group && mineBefore.length === 0;
  let foul = null;
  if (cueIn) foul = 'Scratch: the cue ball went in';
  else if (fc === null) foul = 'Foul: no ball hit';
  else if (p.group) { if (onBlack ? fc !== 8 : !groupIds(p.group).includes(fc)) foul = onBlack ? 'Foul: you must hit the black first' : `Foul: hit the ${p.group === 'solids' ? 'stripes' : 'solids'} first`; }
  else if (fc === 8 && !vs.isBreak) foul = 'Foul: you can’t hit the black first on an open table';
  const out = { foul, potted, cueIn, assigned: null, winner: null, reason: '', respot8: false, keepTurn: false };
  if (black) {
    if (vs.isBreak) out.respot8 = true;                                   // black on the break: spot it and play on
    else if (onBlack && !foul) { out.winner = vs.turn; out.reason = `${p.name} potted the black.`; return out; }
    else { out.winner = 1 - vs.turn; out.reason = !onBlack ? `${p.name} potted the black too early.` : `${p.name} potted the black on a foul.`; return out; }
  }
  if (!p.group && !foul && !vs.isBreak) {
    const first = potted.find(id => id !== 8);
    if (first !== undefined) out.assigned = groupOf(first);
  }
  const grp = out.assigned || p.group;
  const ownPotted = vs.isBreak ? potted.some(id => id !== 8) : grp ? potted.some(id => groupIds(grp).includes(id)) : false;
  out.keepTurn = !foul && ownPotted;
  return out;
}
