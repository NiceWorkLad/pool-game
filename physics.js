// ---- Pool physics core (shared by game + solver) ----
const T = { W: 1000, H: 500, R: 22, M: 34, C: 53 };
const PHYS = { FRICTION: 260, DT: 1 / 480, BALL_E: 0.95, CUSH_E: 0.78, JAW_E: 0.6, MAX_V: 2000, SPIN_K: 0.55 };

const JAWS = [
  [T.C, 0], [0, T.C], [T.W - T.C, 0], [T.W, T.C],
  [T.C, T.H], [0, T.H - T.C], [T.W - T.C, T.H], [T.W, T.H - T.C],
  [T.W / 2 - T.M, 0], [T.W / 2 + T.M, 0], [T.W / 2 - T.M, T.H], [T.W / 2 + T.M, T.H],
];
const POCKETS = [
  [0, 0], [T.W / 2, -6], [T.W, 0], [0, T.H], [T.W / 2, T.H + 6], [T.W, T.H],
];

function inTopBottomSpan(x) {
  return (x > T.C && x < T.W / 2 - T.M) || (x > T.W / 2 + T.M && x < T.W - T.C);
}
function inSideSpan(y) { return y > T.C && y < T.H - T.C; }

class World {
  constructor(balls) {
    this.balls = balls.map(b => ({ id: b.id, x: b.x, y: b.y, vx: 0, vy: 0, on: true }));
  }
  clone() { const w = new World([]); w.balls = this.balls.map(b => ({ ...b })); return w; }
  get(id) { return this.balls.find(b => b.id === id); }
  strike(angle, power, spin, boost = 1) {
    const cue = this.get(0);
    const v = Math.max(0, Math.min(1, power)) * PHYS.MAX_V * boost;
    this.dir = [Math.cos(angle), Math.sin(angle)];
    cue.vx = this.dir[0] * v; cue.vy = this.dir[1] * v;
    this.spin = spin || 0;
    this.firstContact = null; this.contact = null; this.potted = []; this.cushionHits = 0;
    this.events = [];
  }
  moving() { return this.balls.some(b => b.on && (b.vx !== 0 || b.vy !== 0)); }
  step() {
    const dt = PHYS.DT, R = T.R, bs = this.balls;
    for (const b of bs) {
      if (!b.on) continue;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp === 0) continue;
      const ns = sp - PHYS.FRICTION * dt;
      if (ns <= 1) { b.vx = 0; b.vy = 0; continue; }
      b.vx *= ns / sp; b.vy *= ns / sp;
      b.x += b.vx * dt; b.y += b.vy * dt;
    }
    // ball-ball
    for (let i = 0; i < bs.length; i++) {
      const a = bs[i]; if (!a.on) continue;
      for (let j = i + 1; j < bs.length; j++) {
        const b = bs[j]; if (!b.on) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 >= 4 * R * R || d2 === 0) continue;
        // Rewind both balls to the exact moment their surfaces touched (|gap| = 2R),
        // resolve there, then replay the rest of the step with the new velocities.
        const wx = b.vx - a.vx, wy = b.vy - a.vy, ww = wx * wx + wy * wy, pw = dx * wx + dy * wy;
        let tb = 0;
        if (pw < 0 && ww > 0) {
          const disc = pw * pw - ww * (d2 - 4 * R * R);
          tb = (pw + Math.sqrt(Math.max(0, disc))) / ww;
          if (!(tb >= 0 && tb <= dt * 1.01)) tb = 0;
        }
        a.x -= a.vx * tb; a.y -= a.vy * tb; b.x -= b.vx * tb; b.y -= b.vy * tb;
        let ex = b.x - a.x, ey = b.y - a.y, d = Math.hypot(ex, ey) || 1e-9;
        const nx = ex / d, ny = ey / d;
        if (d < 2 * R - 1e-6) { const ov = (2 * R - d) / 2; a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov; }
        const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (vn > 0) {
          const jmp = (1 + PHYS.BALL_E) / 2 * vn;
          a.vx -= jmp * nx; a.vy -= jmp * ny; b.vx += jmp * nx; b.vy += jmp * ny;
          this.events && this.events.push({ t: 'ball', v: vn, a: a.id, b: b.id });
          if (this.firstContact === null && (a.id === 0 || b.id === 0)) {
            const cue = a.id === 0 ? a : b, obj = a.id === 0 ? b : a;
            this.firstContact = obj.id;
            this.contact = { x: cue.x, y: cue.y, ox: obj.x, oy: obj.y };
            if (this.spin) {
              const k = this.spin * PHYS.SPIN_K * vn;
              cue.vx += this.dir[0] * k; cue.vy += this.dir[1] * k;
            }
          }
        }
        a.x += a.vx * tb; a.y += a.vy * tb; b.x += b.vx * tb; b.y += b.vy * tb;
      }
    }
    // cushions, jaws, pockets
    for (const b of bs) {
      if (!b.on) continue;
      // Cushions: the ball's edge meets the cushion nose when its centre is R from it.
      // Rewind to that instant, bounce, then replay the remaining time.
      const E = PHYS.CUSH_E;
      if (b.y < R && b.vy < 0 && inTopBottomSpan(b.x - b.vx * (b.y - R) / b.vy)) { const tb = (b.y - R) / b.vy; b.x -= b.vx * tb; b.y = R; b.vy = -b.vy * E; this.cush(b); b.x += b.vx * tb; b.y += b.vy * tb; }
      if (b.y > T.H - R && b.vy > 0 && inTopBottomSpan(b.x - b.vx * (b.y - T.H + R) / b.vy)) { const tb = (b.y - T.H + R) / b.vy; b.x -= b.vx * tb; b.y = T.H - R; b.vy = -b.vy * E; this.cush(b); b.x += b.vx * tb; b.y += b.vy * tb; }
      if (b.x < R && b.vx < 0 && inSideSpan(b.y - b.vy * (b.x - R) / b.vx)) { const tb = (b.x - R) / b.vx; b.y -= b.vy * tb; b.x = R; b.vx = -b.vx * E; this.cush(b); b.y += b.vy * tb; b.x += b.vx * tb; }
      if (b.x > T.W - R && b.vx > 0 && inSideSpan(b.y - b.vy * (b.x - T.W + R) / b.vx)) { const tb = (b.x - T.W + R) / b.vx; b.y -= b.vy * tb; b.x = T.W - R; b.vx = -b.vx * E; this.cush(b); b.y += b.vy * tb; b.x += b.vx * tb; }
      for (const [jx, jy] of JAWS) {
        const dx = b.x - jx, dy = b.y - jy, d2 = dx * dx + dy * dy;
        if (d2 >= R * R) continue;
        const vv = b.vx * b.vx + b.vy * b.vy, pv = dx * b.vx + dy * b.vy;
        let tb = 0;
        if (pv < 0 && vv > 0) { tb = (pv + Math.sqrt(Math.max(0, pv * pv - vv * (d2 - R * R)))) / vv; if (!(tb >= 0 && tb <= dt * 1.01)) tb = 0; }
        b.x -= b.vx * tb; b.y -= b.vy * tb;
        const ex = b.x - jx, ey = b.y - jy, d = Math.hypot(ex, ey) || 1e-9, nx = ex / d, ny = ey / d;
        if (d < R) { b.x = jx + nx * R; b.y = jy + ny * R; }
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) { b.vx -= (1 + PHYS.JAW_E) * vn * nx; b.vy -= (1 + PHYS.JAW_E) * vn * ny; this.cush(b); }
        b.x += b.vx * tb; b.y += b.vy * tb;
      }
      if (b.x < 0 || b.x > T.W || b.y < 0 || b.y > T.H) {
        b.on = false;
        let best = 0, bd = 1e9;
        POCKETS.forEach((p, k) => { const dd = Math.hypot(p[0] - b.x, p[1] - b.y); if (dd < bd) { bd = dd; best = k; } });
        b.pocket = best; b.pvx = b.vx; b.pvy = b.vy; b.vx = 0; b.vy = 0;
        this.potted && this.potted.push(b.id);
        this.events && this.events.push({ t: 'pot', id: b.id, x: b.x, y: b.y, vx: b.pvx, vy: b.pvy });
      }
    }
  }
  cush(b) { this.events && this.events.push({ t: 'cush', v: Math.hypot(b.vx, b.vy), id: b.id, x: b.x, y: b.y }); }
  run(maxSteps = 20000) { let n = 0; while (this.moving() && n++ < maxSteps) this.step(); return n; }
}

// ---- 8-ball puzzle rules ----
const SOLIDS = [1, 2, 3, 4, 5, 6, 7], STRIPES = [9, 10, 11, 12, 13, 14, 15];
function groupIds(group) { return group === 'stripes' ? STRIPES : SOLIDS; }
function remainingMine(world, group) {
  const ids = groupIds(group);
  return world.balls.filter(b => b.on && ids.includes(b.id)).map(b => b.id);
}
// Judge a completed shot. mineBefore = list of own balls on table before the shot.
function judge(world, group, mineBefore) {
  const ids = groupIds(group);
  const onBlack = mineBefore.length === 0;
  const fc = world.firstContact;
  const cuePotted = world.potted.includes(0);
  const blackPotted = world.potted.includes(8);
  const legalFirst = fc !== null && (onBlack ? fc === 8 : ids.includes(fc));
  if (blackPotted) {
    if (!onBlack) return { result: 'lose', reason: 'Black potted before your balls were cleared' };
    if (cuePotted) return { result: 'lose', reason: 'Potted the black but scratched' };
    if (!legalFirst) return { result: 'lose', reason: 'Foul on the black — wrong first contact' };
    return { result: 'win' };
  }
  if (cuePotted) return { result: 'fail', reason: 'Scratch — cue ball went in' };
  if (fc === null) return { result: 'fail', reason: 'Foul — missed every ball' };
  if (!legalFirst) return { result: 'fail', reason: onBlack ? 'Foul — you must hit the black first' : 'Foul — hit the wrong group first' };
  if (!world.potted.some(id => ids.includes(id))) return { result: 'fail', reason: 'Nothing potted — your visit is over' };
  return { result: 'continue' };
}

// ---- Golf: one ball on a big course. Surfaces: fairway, rough (slower), sand (much slower),
// water (touch it and the shot is dead). Plus walls, bumpers, coins and a cup. ----
const GOLF = { COIN_R: 13, CUP_R: 30, CUP_MAX_V: 900, CUSH_E: 0.78, POST_E: 0.8, SAND: 5, ROUGH: 1.8, GREEN_R: 170 };
function bounceStatic(b, px, py, rad, e, dt) {
  const dx = b.x - px, dy = b.y - py, d2 = dx * dx + dy * dy;
  if (d2 >= rad * rad) return false;
  const vv = b.vx * b.vx + b.vy * b.vy, pv = dx * b.vx + dy * b.vy;
  let tb = 0;
  if (pv < 0 && vv > 0) { tb = (pv + Math.sqrt(Math.max(0, pv * pv - vv * (d2 - rad * rad)))) / vv; if (!(tb >= 0 && tb <= dt * 1.01)) tb = 0; }
  b.x -= b.vx * tb; b.y -= b.vy * tb;
  const ex = b.x - px, ey = b.y - py, d = Math.hypot(ex, ey) || 1e-9, nx = ex / d, ny = ey / d;
  if (d < rad) { b.x = px + nx * rad; b.y = py + ny * rad; }
  const vn = b.vx * nx + b.vy * ny;
  let hit = false;
  if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; hit = true; }
  b.x += b.vx * tb; b.y += b.vy * tb;
  return hit;
}
// Shapes: {blob:[cx,cy,rx,ry,seed]} organic pond/bunker, or {river:[[x,y],...], w} a ribbon.
// Both become one polygon that physics and drawing share, so what you see is what you hit.
function shapePoly(sh) {
  let pts = [];
  if (sh.blob) {
    const [cx, cy, rx, ry, sd] = sh.blob, N = 48;
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2, k = 1 + 0.13 * Math.sin(3 * a + sd) + 0.07 * Math.sin(5 * a + 2.3 * sd);
      pts.push([cx + rx * k * Math.cos(a), cy + ry * k * Math.sin(a)]);
    }
  } else if (sh.river) {
    const P = sh.river, L = [], Rr = [];
    // densify with Catmull-Rom so the ribbon curves smoothly
    const dense = [];
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      for (let t = 0; t < 1; t += 1 / 10) {
        const t2 = t * t, t3 = t2 * t;
        dense.push([0, 1].map(k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
      }
    }
    dense.push(P[P.length - 1]);
    dense.forEach((p, i) => {
      const a = dense[Math.max(0, i - 1)], c = dense[Math.min(dense.length - 1, i + 1)];
      let tx = c[0] - a[0], ty = c[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const w = sh.w / 2 * (1 + 0.15 * Math.sin(i * 0.45));
      L.push([p[0] - ty * w, p[1] + tx * w]); Rr.push([p[0] + ty * w, p[1] - tx * w]);
    });
    pts = L.concat(Rr.reverse());
  }
  let cx = 0, cy = 0; pts.forEach(p => { cx += p[0]; cy += p[1]; }); cx /= pts.length; cy /= pts.length;
  const rad = Math.max(...pts.map(p => Math.hypot(p[0] - cx, p[1] - cy)));
  return { pts, cx, cy, rad };
}
function inPoly(P, x, y) {
  if (Math.hypot(x - P.cx, y - P.cy) > P.rad) return false;
  let c = false; const p = P.pts;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++)
    if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c;
  return c;
}
function nearPoly(P, x, y, r) {
  if (Math.hypot(x - P.cx, y - P.cy) > P.rad + r) return false;
  if (inPoly(P, x, y)) return true;
  const p = P.pts;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const ax = p[j][0], ay = p[j][1], bx = p[i][0] - ax, by = p[i][1] - ay, l2 = bx * bx + by * by;
    const t = Math.max(0, Math.min(1, ((x - ax) * bx + (y - ay) * by) / (l2 || 1)));
    if ((x - ax - t * bx) ** 2 + (y - ay - t * by) ** 2 < r * r) return true;
  }
  return false;
}
function prepHole(h) {
  if (h._prep) return h;
  const map = a => (a || []).map(shapePoly);
  Object.defineProperty(h, '_prep', { value: { water: map(h.water), sand: map(h.sand), fair: map(h.fairway) }, enumerable: false });
  return h;
}
function surfaceAt(h, x, y) {
  const P = prepHole(h)._prep;
  for (const s of P.sand) if (inPoly(s, x, y)) return 'sand';
  if (!P.fair.length) return 'fair';
  if (Math.hypot(x - h.cup[0], y - h.cup[1]) < GOLF.GREEN_R) return 'green';
  for (const f of P.fair) if (inPoly(f, x, y)) return 'fair';
  return 'rough';
}
function touchesWater(h, x, y, r) { for (const w of prepHole(h)._prep.water) if (nearPoly(w, x, y, r)) return true; return false; }

class GolfWorld {
  constructor(hole) {
    this.h = prepHole(hole);
    this.ball = { id: 0, x: hole.start[0], y: hole.start[1], vx: 0, vy: 0, on: true };
    this.coins = hole.coins.map(() => false);
  }
  clone() { const g = Object.create(GolfWorld.prototype); g.h = this.h; g.ball = { ...this.ball }; g.coins = this.coins.slice(); return g; }
  get balls() { return [this.ball]; }
  get(id) { return id === 0 ? this.ball : undefined; }
  strike(angle, power) {
    const v = Math.max(0, Math.min(1, power)) * PHYS.MAX_V, b = this.ball;
    b.vx = Math.cos(angle) * v; b.vy = Math.sin(angle) * v;
    this.events = []; this.holed = false; this.dead = false; this.n = 0;
  }
  moving() { return this.ball.on && !this.dead && (this.ball.vx !== 0 || this.ball.vy !== 0); }
  step() {
    const dt = PHYS.DT, R = T.R, b = this.ball, h = this.h;
    if (!b.on || this.dead) return;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp === 0) return;
    // surface lookup every 4th step is plenty (ball moves < 17 units in that time)
    if ((this.n++ & 3) === 0 || !this.surf) this.surf = surfaceAt(h, b.x, b.y);
    const f = PHYS.FRICTION * (this.surf === 'sand' ? GOLF.SAND : this.surf === 'rough' ? GOLF.ROUGH : 1);
    const ns = sp - f * dt;
    if (ns <= 1) { b.vx = 0; b.vy = 0; return; }
    b.vx *= ns / sp; b.vy *= ns / sp;
    b.x += b.vx * dt; b.y += b.vy * dt;
    const E = GOLF.CUSH_E, ev = this.events;
    const wall = () => ev && ev.push({ t: 'cush', v: Math.hypot(b.vx, b.vy), id: 0, x: b.x, y: b.y });
    if (b.y < R && b.vy < 0) { const tb = (b.y - R) / b.vy; b.x -= b.vx * tb; b.y = R; b.vy = -b.vy * E; wall(); b.x += b.vx * tb; b.y += b.vy * tb; }
    if (b.y > h.H - R && b.vy > 0) { const tb = (b.y - h.H + R) / b.vy; b.x -= b.vx * tb; b.y = h.H - R; b.vy = -b.vy * E; wall(); b.x += b.vx * tb; b.y += b.vy * tb; }
    if (b.x < R && b.vx < 0) { const tb = (b.x - R) / b.vx; b.y -= b.vy * tb; b.x = R; b.vx = -b.vx * E; wall(); b.y += b.vy * tb; b.x += b.vx * tb; }
    if (b.x > h.W - R && b.vx > 0) { const tb = (b.x - h.W + R) / b.vx; b.y -= b.vy * tb; b.x = h.W - R; b.vx = -b.vx * E; wall(); b.y += b.vy * tb; b.x += b.vx * tb; }
    for (const r of h.blocks || []) {
      const cx = Math.max(r[0], Math.min(b.x, r[0] + r[2])), cy = Math.max(r[1], Math.min(b.y, r[1] + r[3]));
      if (bounceStatic(b, cx, cy, R, E, dt)) wall();
    }
    for (const p of h.posts || []) if (bounceStatic(b, p[0], p[1], R + p[2], GOLF.POST_E, dt)) wall();
    h.coins.forEach((c, i) => {
      if (!this.coins[i] && Math.hypot(b.x - c[0], b.y - c[1]) < R + GOLF.COIN_R) { this.coins[i] = true; ev && ev.push({ t: 'coin', i }); }
    });
    if (touchesWater(h, b.x, b.y, R)) { this.dead = true; this.deadAt = [b.x, b.y]; b.vx = 0; b.vy = 0; ev && ev.push({ t: 'dead', x: b.x, y: b.y }); return; }
    const dc = Math.hypot(b.x - h.cup[0], b.y - h.cup[1]);
    if (dc < GOLF.CUP_R - 4 && Math.hypot(b.vx, b.vy) < GOLF.CUP_MAX_V) {
      ev && ev.push({ t: 'holed', x: b.x, y: b.y, vx: b.vx, vy: b.vy });
      b.on = false; b.vx = 0; b.vy = 0; this.holed = true;
    }
  }
  run(maxSteps = 40000) { let n = 0; while (this.moving() && n++ < maxSteps) this.step(); return n; }
}

if (typeof module !== 'undefined') module.exports = { T, PHYS, World, JAWS, POCKETS, judge, remainingMine, groupIds, GolfWorld, GOLF, shapePoly, prepHole, surfaceAt, touchesWater };
