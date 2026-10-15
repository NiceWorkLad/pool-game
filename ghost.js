// Aim geometry shared by the solver, the grader and the generator.
// A shot is described by a "spec", not a raw angle, so a player can be modelled as
// "aims at the right spot from wherever the cue ball ended up, then executes with noise".
//   spec = { id, p, src, via?, off }
//   id   : object ball to hit first          p   : pocket index (see AIM)
//   src  : 0 direct, 1-4 bank (cushion mirror) via : second ball, for combinations
//   off  : small fixed aim correction in radians
const { T } = require('./physics.js');
const AIM = [[0, 0], [500, 0], [1000, 0], [0, 500], [500, 500], [1000, 500]];
const POCKET_KIND = ['corner', 'side', 'corner', 'corner', 'side', 'corner'];

function ghostPoint(b, tx, ty) { // where the cue ball must be to send ball b towards (tx, ty)
  const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy) || 1e-9;
  return [b.x - dx / d * 2 * T.R, b.y - dy / d * 2 * T.R];
}
function aimFor(world, spec) {
  const cue = world.get(0), b = world.get(spec.id);
  if (!cue || !cue.on || !b || !b.on) return null;
  let tx, ty;
  if (spec.via !== undefined) {
    const v = world.get(spec.via); if (!v || !v.on) return null;
    [tx, ty] = ghostPoint(v, AIM[spec.p][0], AIM[spec.p][1]);
  } else [tx, ty] = AIM[spec.p];
  const [gx, gy] = ghostPoint(b, tx, ty);
  const srcs = [[gx, gy], [gx, -gy], [gx, 2 * T.H - gy], [-gx, gy], [2 * T.W - gx, gy]];
  const [ax, ay] = srcs[spec.src || 0];
  return Math.atan2(ay - cue.y, ax - cue.x) + (spec.off || 0);
}
// Plain-English geometry of a direct shot: the three numbers that drive difficulty in the research
// (cut angle, cue-to-ghost distance, object-ball-to-pocket distance).
function geometry(world, spec) {
  const cue = world.get(0), b = world.get(spec.id);
  if (!cue || !b) return null;
  const [tx, ty] = spec.via !== undefined ? ghostPoint(world.get(spec.via), ...AIM[spec.p]) : AIM[spec.p];
  const [gx, gy] = ghostPoint(b, tx, ty);
  const v1 = [gx - cue.x, gy - cue.y], v2 = [tx - b.x, ty - b.y];
  const d1 = Math.hypot(...v1), d2 = Math.hypot(...v2);
  const cut = Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / (d1 * d2 || 1)))) * 180 / Math.PI;
  return { cut, d1, d2, pocket: POCKET_KIND[spec.p], kind: spec.via !== undefined ? 'combo' : spec.src ? 'bank' : 'direct' };
}
module.exports = { AIM, POCKET_KIND, ghostPoint, aimFor, geometry };
