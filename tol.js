// Margin-of-error grader.
// For each shot of a line we measure, with the real game physics, how far the aim can be off
// (degrees) at several power errors and still pull the shot off. That window is the "margin of
// error" used in the pool-shot-difficulty research (Alciatore, Colorado State). A shot only counts
// as made if the cue ball also finishes where the NEXT planned shot still works, so position play
// and speed control are part of the grade.
// A player is modelled by one skill number s: aim error ~ N(0, s degrees), speed error ~ N(0, 0.2*s).
const { World, judge, remainingMine } = require('./physics.js');
const { aimFor } = require('./ghost.js');
const DEG = Math.PI / 180;

const LEVELS = { casual: 0.9, club: 0.45, strong: 0.22, pro: 0.11 }; // aim sigma in degrees
const SPEED_PER_DEG = 0.2;
const LADDER = [0.06, 0.09, 0.13, 0.19, 0.28, 0.42, 0.62, 0.92, 1.4, 2.1];
const POW_ROWS = [-0.4, -0.25, -0.12, 0, 0.12, 0.25, 0.4];
const POW_EDGES = [-9, -0.325, -0.185, -0.06, 0.06, 0.185, 0.325, 9];

function erf(x) { const s = x < 0 ? -1 : 1; x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); }
const Phi = z => 0.5 * (1 + erf(z / Math.SQRT2));

// states[k] = { w: world before shot k, mine: own balls then }; line[k] = { spec, ang, pow, spin }
function lineStates(balls, group, line) {
  let w = new World(balls); const states = [];
  for (const s of line) {
    states.push({ w: w.clone(), mine: remainingMine(w, group) });
    w.strike(s.ang, s.pow, s.spin); w.events = null; w.run();
  }
  return states;
}
function trial(states, line, group, k, dDeg, powMul) {
  const s = line[k], st = states[k], w = st.w.clone();
  w.strike(s.ang + dDeg * DEG, Math.min(1, s.pow * powMul), s.spin); w.events = null; w.run();
  const j = judge(w, group, st.mine).result;
  if (k === line.length - 1) return j === 'win';
  if (j !== 'continue') return false;
  const n = line[k + 1], a2 = aimFor(w, n.spec); if (a2 === null) return false; // next shot must still be there to take
  const w2 = w.clone(), m2 = remainingMine(w, group);
  w2.strike(a2, n.pow, n.spin); w2.events = null; w2.run();
  const j2 = judge(w2, group, m2).result;
  return k + 1 === line.length - 1 ? j2 === 'win' : j2 === 'continue';
}
// contiguous aim window [l, r] in degrees around the nominal aim for a given power multiplier
function window(f, maxDeg = 4, res = 0.01) {
  let x0 = 0;
  if (!f(0)) { x0 = null; for (const d of [0.03, -0.03, 0.06, -0.06, 0.12, -0.12, 0.25, -0.25]) if (f(d)) { x0 = d; break; } if (x0 === null) return null; }
  const edge = dir => {
    let good = x0, step = 0.04, bad = null;
    while (bad === null) {
      const t = good + dir * step;
      if (Math.abs(t) >= maxDeg) { if (f(dir * maxDeg)) return dir * maxDeg; bad = dir * maxDeg; break; }
      if (f(t)) { good = t; step *= 2; } else bad = t;
    }
    while (Math.abs(bad - good) > res) { const m = (good + bad) / 2; if (f(m)) good = m; else bad = m; }
    return good;
  };
  return [edge(-1), edge(1)];
}
// cheap: centre power only. Used to rank candidate lines.
function quickWindows(states, line, group) {
  return line.map((_, k) => window(d => trial(states, line, group, k, d, 1)));
}
function pAim(win, sigma) { return win ? Math.max(0, Phi(win[1] / sigma) - Phi(win[0] / sigma)) : 0; }
function quickP(wins, sigma) { return wins.reduce((p, w) => p * pAim(w, sigma), 1); }
// full: aim window at 7 power errors per shot
function fullWindows(states, line, group) {
  return line.map((_, k) => POW_ROWS.map(r => window(d => trial(states, line, group, k, d, 1 + r))));
}
function shotP(rows, s) {
  const sv = Math.max(1e-6, SPEED_PER_DEG * s); let p = 0;
  rows.forEach((win, i) => { p += (Phi(POW_EDGES[i + 1] / sv) - Phi(POW_EDGES[i] / sv)) * pAim(win, s); });
  return p;
}
function lineP(full, s) { return full.reduce((p, rows) => p * shotP(rows, s), 1); }
// sigma at which the line is made 70% of the time (smaller = needs a more accurate player)
function sigma70(full) {
  let prev = null;
  for (const s of LADDER) {
    const p = lineP(full, s);
    if (p < 0.7) { if (prev === null) return LADDER[0] * 0.7; const lo = Math.log(prev.s), hi = Math.log(s), t = (prev.p - 0.7) / (prev.p - p); return Math.exp(lo + (hi - lo) * t); }
    prev = { s, p };
  }
  return LADDER[LADDER.length - 1];
}
function summarise(full) {
  const out = { sigma70: +sigma70(full).toFixed(3), P: {} };
  for (const [k, s] of Object.entries(LEVELS)) out.P[k] = +lineP(full, s).toFixed(3);
  out.shots = full.map(rows => ({ margin: rows[3] ? +(rows[3][1] - rows[3][0]).toFixed(2) : 0, P: +shotP(rows, LEVELS.club).toFixed(3) }));
  return out;
}
module.exports = { LEVELS, lineStates, trial, window, quickWindows, quickP, fullWindows, shotP, lineP, sigma70, summarise, pAim, Phi };
