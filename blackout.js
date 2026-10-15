// ---------- Blackout: 36 black balls, pot them all in as few shots as you can ----------
// Balls are ids 101-136 so the physics can tell them apart; they all draw as the 8.
let bo = null, boBest = store.get('boBest', 0);
function blackoutRack() {
  const gap = R + 0.35, balls = [{ id: 0, x: 210, y: 250 }]; let id = 101;
  for (let r = 0; r < 8; r++) for (let k = 0; k <= r; k++)
    balls.push({ id: id++, x: Math.round((590 + r * Math.sqrt(3) * gap) * 100) / 100, y: Math.round((250 + (k - r / 2) * 2 * gap) * 100) / 100 });
  return balls;
}
const boLeft = () => world.balls.filter(b => b.on && b.id > 100).length;
function newBlackout() {
  bo = { shots: 0, scratches: 0, isBreak: true, done: false };
  cur = { kind: 'pool', group: 'none', balls: blackoutRack(), blackout: true }; world = new World(cur.balls); common();
  $('pzName').textContent = 'Blackout'; $('pzNote').textContent = 'Pot all 36 blacks. Any order, any pocket. The break hits with extra power.';
  setSpin(0); $('power').value = 0.9; updOutputs(); defaultAim(); renderHud(); snapCam();
}
function blackoutDone() {
  bo.shots++; bo.isBreak = false;
  const c = world.get(0), n = world.potted.filter(id => id > 100).length;
  let msg = '', kind = 'good';
  if (!c.on) {
    bo.shots++; bo.scratches++;
    const [x, y] = freeSpot(world, HEAD_X - 40, 250, [0, 1]); c.on = true; c.x = x; c.y = y; c.vx = c.vy = 0; const o = getOrient(c); o.lx = x; o.ly = y;
    buzz(); msg = 'Scratch: one shot added, cue ball back behind the line.'; kind = 'bad';
  }
  const left = boLeft(); renderHud();
  if (!left) {
    state = 'done'; bo.done = true; fanfare(); bump('blackouts');
    const prev = boBest, isBest = !prev || bo.shots < prev;
    if (isBest) { boBest = bo.shots; store.set('boBest', boBest); }
    awardXP(100 + 5 * Math.max(0, 50 - bo.shots), 'Table cleared');
    if (isBest) awardXP(50, 'New best');
    overlay('Table cleared!', `All 36 in ${bo.shots} shots${bo.scratches ? `, including ${bo.scratches} for scratches` : ''}. ${isBest ? (prev ? `New best, beating ${prev}.` : 'That’s your first clear.') : `Your best is ${boBest}.`}`,
      [['Menu', () => go('menu')], ['Rack again', newBlackout, true]]);
    return;
  }
  state = 'aim';
  $('pzNote').textContent = `${left} to go.`;
  if (!msg && n) msg = n === 1 ? `One down. ${left} to go.` : `${n} down. ${left} to go.`;
  if (msg) showMsg(msg, kind, 2600);
  defaultAim();
}
