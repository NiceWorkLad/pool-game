const fs = require('fs');
const strip = s => s.replace(/if \(typeof module[^\n]*\n?/g, '');
eval(strip(fs.readFileSync('physics.js', 'utf8')) + strip(fs.readFileSync('versus-rules.js', 'utf8')) + `
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const rack = makeRack(rnd);
let minD = 1e9; for (const a of rack) for (const b of rack) if (a.id < b.id) minD = Math.min(minD, Math.hypot(a.x - b.x, a.y - b.y));
console.log('balls', rack.length, 'min gap', (minD - 2 * T.R).toFixed(2), 'rack x span', Math.min(...rack.slice(1).map(b=>b.x)).toFixed(0), '-', Math.max(...rack.map(b=>b.x)).toFixed(0));
// play 300 random games: random shots, apply rules, check they always end sensibly
const tally = { games: 0, wins: 0, fouls: 0, assigned: 0, respots: 0, shots: 0, maxShots: 0 };
for (let g = 0; g < 300; g++) {
  const w = new World(makeRack(rnd)); const vs = { players: [{ name: 'A', group: null }, { name: 'B', group: null }], turn: 0, isBreak: true };
  let n = 0, done = false;
  while (!done && n < 400) {
    n++; tally.shots++;
    const p = vs.players[vs.turn];
    const mine = p.group ? remainingMine(w, p.group) : [];
    // aim at a random legal-ish ball so games progress
    const cand = w.balls.filter(b => b.on && b.id !== 0 && (p.group ? (mine.length ? groupIds(p.group).includes(b.id) : b.id === 8) : b.id !== 8));
    const t = cand.length ? cand[Math.floor(rnd() * cand.length)] : w.get(8), c = w.get(0);
    const ang = vs.isBreak ? Math.atan2(250 - c.y, 740 - c.x) : Math.atan2(t.y - c.y, t.x - c.x) + (rnd() - 0.5) * 0.06;
    w.strike(ang, vs.isBreak ? 1 : 0.3 + rnd() * 0.6, Math.round(rnd() * 2) - 1); w.events = null; w.run();
    const r = judgeVersus(w, vs, mine);
    if (r.winner !== null) { tally.wins++; done = true; break; }
    if (r.respot8) { tally.respots++; const b8 = w.get(8); const [x, y] = freeSpot(w, ...FOOT); b8.on = true; b8.x = x; b8.y = y; b8.vx = b8.vy = 0; }
    if (r.assigned) { tally.assigned++; p.group = r.assigned; vs.players[1 - vs.turn].group = otherGroup(r.assigned); }
    if (r.foul) tally.fouls++;
    if (r.cueIn) { const cb = w.get(0); const [x, y] = freeSpot(w, 250, 250, [0, 1]); cb.on = true; cb.x = x; cb.y = y; cb.vx = cb.vy = 0; }
    vs.isBreak = false;
    if (!r.keepTurn) vs.turn = 1 - vs.turn;
    // sanity: no overlapping balls at rest
    for (const a of w.balls) for (const b of w.balls) if (a.on && b.on && a.id < b.id && Math.hypot(a.x - b.x, a.y - b.y) < 2 * T.R - 0.5) throw new Error('overlap ' + a.id + ' ' + b.id);
  }
  tally.games++; tally.maxShots = Math.max(tally.maxShots, n);
}
console.log(JSON.stringify(tally));
`);
