// Replay every position's stored line through the game physics and check legality.
const { T, World, judge, remainingMine } = require('./physics.js');
const SV = require('./survival.json'); let bad = 0, overlap = 0;
SV.forEach((p, i) => {
  for (let a = 0; a < p.balls.length; a++) for (let b = a + 1; b < p.balls.length; b++) if (Math.hypot(p.balls[a].x - p.balls[b].x, p.balls[a].y - p.balls[b].y) < 2 * T.R - 0.01) { overlap++; console.log('overlap in', i); }
  const w = new World(p.balls); let res = null;
  for (let k = 0; k < p.sol.length; k++) {
    const m = remainingMine(w, p.group), s = p.sol[k];
    w.strike(s.ang, s.pow, s.spin); w.events = null; w.run();
    res = judge(w, p.group, m).result;
    if (k < p.sol.length - 1 && res !== 'continue') { res = 'broke at ' + k; break; }
  }
  if (res !== 'win') { bad++; console.log('FAIL', i, p.theme, res); }
});
const t = [1, 2, 3, 4, 5].map(r => SV.filter(p => p.rating === r).length);
console.log(`checked ${SV.length} positions: ${bad} failed, ${overlap} overlaps. per tier ${t.join(' ')}`);
process.exit(bad || overlap ? 1 : 0);
