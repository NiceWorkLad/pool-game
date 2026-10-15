/*PHYSICS*/
/*PUZZLES*/
/*HOLES*/
const SOLUTIONS = /*SOLUTIONS*/;
const GOLF_LINES = /*GOLFLINES*/;
const SURVIVAL = /*SURVIVAL*/;
const RATINGS = /*RATINGS*/;
const DIFF_NAMES = ['', 'Easy', 'Medium', 'Tricky', 'Hard', 'Expert'];
// Ratings come from a margin-of-error model: how often a club-level player (about 0.45 degrees of aim error) makes the best line.
const clubText = p => p === undefined ? '' : p >= 0.995 ? 'A club player makes this nearly every time.' : p < 0.01 ? 'A club player makes this less than 1 time in 100.' : `A club player makes this about ${Math.round(p * 100)}% of the time.`;
/*THEMES*/

const COLORS = { 1:'#f2c12e', 2:'#2453c9', 3:'#d6372b', 4:'#5e2d8c', 5:'#f07f1d', 6:'#1f8a47', 7:'#82222a', 8:'#141414' };
const colorOf = id => COLORS[id > 8 ? id - 8 : id];
const POCKET_NAMES = ['top-left', 'top-middle', 'top-right', 'bottom-left', 'bottom-middle', 'bottom-right'];
const POCKET_NAMES_ROT = ['top-right', 'right-middle', 'bottom-right', 'top-left', 'left-middle', 'bottom-left'];
const R = T.R, CUSH = 18, RAIL = 40, M0 = CUSH + RAIL;
const PK = [[-8, -8, 38], [T.W / 2, -20, 30], [T.W + 8, -8, 38], [-8, T.H + 8, 38], [T.W / 2, T.H + 20, 30], [T.W + 8, T.H + 8, 38]];
const cv = document.getElementById('c'); let ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('runout-' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('runout-' + k, JSON.stringify(v)); } catch (e) {} },
};
let themeKey = THEMES[store.get('theme', 'sketch')] ? store.get('theme', 'sketch') : 'sketch', TH = THEMES[themeKey];
let shakeOn = store.get('shake', true), fadeOn = store.get('fade', true);
const stats = Object.assign({ shots: 0, pots: 0, coins: 0, aces: 0, runs: 0, holes: 0, drills: 0, frames: 0, blackouts: 0 }, store.get('stats', {}));
for (const k in stats) if (!Number.isFinite(stats[k])) stats[k] = 0;
let pullOn = store.get('pull', true);
const bump = (k, n = 1) => { stats[k] += n; store.set('stats', stats); };

// ---------- state ----------
let mode = 'puzzle', level = 0, cur = null, world, aim = 0, state = 'aim', shots = 0, potAnims = [], strikeT = 0, replay = null, hintStep = null, acc = 0, pending = null;
let solved = store.get('solved', {}), golfStars = store.get('golf', {}), best = store.get('best', 0);
let golf = null;   // { strokes, par }
let surv = null;   // { cleared, lives, used }
let overview = false;
const cam = { x: T.W / 2, y: T.H / 2 };

// ---------- sound ----------
let ac = null, soundOn = store.get('sound', true);
function audio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (ac && ac.state === 'suspended') ac.resume(); return ac; }
function tone(freq, dur, vol, type = 'sine', slide = 1, delay = 0) {
  if (!soundOn || !ac) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur);
}
const click = v => tone(1800 + Math.random() * 400, 0.04, 0.05 + 0.25 * Math.min(1, v / 900), 'triangle', 0.6);
const thud = v => tone(140, 0.09, 0.04 + 0.15 * Math.min(1, v / 900), 'sine', 0.5);
const clunk = () => { tone(220, 0.18, 0.25, 'sine', 0.35); tone(160, 0.12, 0.12, 'triangle', 0.5, 0.07); };
const chime = () => { tone(1320, 0.08, 0.1, 'triangle'); tone(1760, 0.14, 0.1, 'triangle', 1, 0.07); };
const fanfare = () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 0.12, 'triangle', 1, i * 0.11));
const buzz = () => tone(180, 0.3, 0.12, 'sawtooth', 0.6);

// ---------- modes ----------
const isGolf = () => mode === 'golf';
function setMode(m) {
  mode = m; overview = false;
  $('gameTitle').textContent = { puzzle: 'Puzzles', golf: 'Golf', survival: 'Survival', versus: 'Two players', learn: 'Learn', blackout: 'Blackout' }[m];
  $('tag').textContent = { puzzle: 'Win from the position in one visit.', golf: 'Fairway is fast, rough and sand are slow, water costs a stroke.', survival: 'Positions get harder. Three lives.', versus: '8-ball on one device. Pass it between turns.', learn: '', blackout: '36 blacks. Fewest shots wins.' }[m];
  sessions[m] = true;
  $('spinSeg').hidden = m === 'golf';
  $('hint').hidden = m !== 'puzzle' && m !== 'learn';
  $('hint').textContent = m === 'learn' ? 'Lesson notes' : 'Hint';
  $('watch').textContent = m === 'learn' ? 'Show me' : 'Solution';
  $('gameBack').textContent = m === 'learn' ? '← Lessons' : '← Menu';
  $('map').hidden = m !== 'golf';
  $('watch').hidden = m === 'survival' || m === 'versus' || m === 'blackout';
  $('reset').hidden = m === 'survival' || m === 'versus';
  $('reset').textContent = m === 'blackout' ? 'New rack' : 'Reset';
  $('endrun').hidden = m !== 'survival';
  $('newMatch').hidden = m !== 'versus';
  $('levels').hidden = m === 'survival' || m === 'versus' || m === 'blackout';
  $('map').setAttribute('aria-pressed', 'false'); $('map').textContent = 'Whole course';
  if (m === 'puzzle') { let s = 0; for (let i = 0; i < PUZZLES.length; i++) if (!solved[i]) { s = i; break; } loadPuzzle(s); }
  else if (m === 'golf') { let s = 0; for (let i = 0; i < HOLES.length; i++) if (!golfStars[i]) { s = i; break; } loadHole(s); }
  else if (m === 'survival') newRun();
  else if (m === 'blackout') newBlackout();
}

function common() {
  shots = 0; state = 'aim'; anims = []; fx = []; replay = null; hintStep = null; predKey = ''; resetOrient(); lastSurf = null;
  $('overlay').hidden = true; showMsg('');
}
function loadPuzzle(i) {
  level = i; cur = { kind: 'pool', ...PUZZLES[i], rating: RATINGS.puzzles[i].rating, club: RATINGS.puzzles[i].club }; world = new World(cur.balls); common();
  $('pzName').textContent = `${i + 1}. ${cur.name}`; $('pzNote').textContent = cur.note;
  setSpin(0); defaultAim(); renderLevels(); renderHud(); snapCam();
}
function loadHole(i) {
  level = i; const h = HOLES[i]; cur = { kind: 'golf', hole: h, rating: RATINGS.golf[i].rating }; world = new GolfWorld(h); common();
  golf = { strokes: 0, par: h.par };
  $('pzName').textContent = `Hole ${i + 1}. ${h.name}`; $('pzNote').textContent = h.note;
  defaultAim(); renderLevels(); renderHud(); snapCam();
}
const CLOCK_START = 30, CLOCK_ADD = 20;
function newRun() { surv = { cleared: 0, lives: 3, used: new Set(), time: CLOCK_START, bestPaid: false, shown: -1 }; bump('runs'); nextSurvival(); }
function nextSurvival() {
  // The run ramps up by measured difficulty: the target tier climbs with the streak, and each position is drawn
  // from the tiers around it (so a run is mostly the right level with the odd easier or harder one).
  const target = Math.min(4.6, 1 + surv.cleared / 6);
  const w = i => Math.exp(-Math.pow(RATINGS.survival[i].rating - target, 2) / 0.9);
  let pool = SURVIVAL.map((p, i) => i).filter(i => !surv.used.has(i) && w(i) > 0.02);
  if (!pool.length) { surv.used.clear(); pool = SURVIVAL.map((p, i) => i).filter(i => w(i) > 0.02); }
  let tot = pool.reduce((a, i) => a + w(i), 0), r = Math.random() * tot, k = pool[pool.length - 1];
  for (const i of pool) { if ((r -= w(i)) < 0) { k = i; break; } }
  surv.used.add(k);
  const p = SURVIVAL[k];
  cur = { kind: 'pool', group: p.group, balls: p.balls, sol: p.sol, rating: RATINGS.survival[k].rating, club: RATINGS.survival[k].club }; world = new World(p.balls); common();
  $('pzName').textContent = `Position ${surv.cleared + 1}`;
  const mine = p.balls.filter(b => groupIds(p.group).includes(b.id)).length;
  $('pzNote').textContent = mine ? `You're ${p.group}. Pot ${mine === 1 ? 'your ball' : mine === 2 ? 'both your balls' : 'all ' + mine + ' of your balls'}, then the black.` : 'Just the black. Sink it.';
  setSpin(0); defaultAim(); renderHud(); snapCam();
}

// The break gets a lot more pace than a normal shot, like a real break cue.
const BREAK_BOOST = 3;
const breakBoost = () => (cur && cur.vs && vs && vs.isBreak) || (cur && cur.blackout && bo && bo.isBreak) ? BREAK_BOOST : 1;
const ALL_OBJ = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
const myIds = () => {
  if (cur.kind !== 'pool') return [];
  if (cur.vs && vs) { const g = vs.players[vs.turn].group; return g ? groupIds(g) : ALL_OBJ; }
  return cur.group === 'none' ? ALL_OBJ : groupIds(cur.group);
};
function legalTargets() {
  if (cur.blackout) return world.balls.filter(b => b.on && b.id > 100).map(b => b.id);
  if (cur.vs && vs) {
    const g = vs.players[vs.turn].group;
    if (!g) return world.balls.filter(b => b.on && b.id !== 0 && (vs.isBreak || b.id !== 8)).map(b => b.id);
    const m = remainingMine(world, g); return m.length ? m : [8];
  }
  const m = remainingMine(world, cur.group); return m.length ? m : [8];
}
function defaultAim() {
  const c = world.get(0); let tgt = null;
  if (mode === 'learn' && cur.learn && cur.learn.kind !== 'run' && learn && learn.choice !== null) { const b = world.get(learnTarget().target); if (b && b.on) tgt = [b.x, b.y]; }
  else if (cur.kind === 'golf') {
    const h = cur.hole, left = h.coins.filter((q, i) => !world.coins[i]);
    tgt = left.length ? left.reduce((m, q) => Math.hypot(q[0] - c.x, q[1] - c.y) < Math.hypot(m[0] - c.x, m[1] - c.y) ? q : m) : h.cup;
  } else {
    let bd = 1e9; for (const id of legalTargets()) { const b = world.get(id); const d = Math.hypot(b.x - c.x, b.y - c.y); if (d < bd) { bd = d; tgt = [b.x, b.y]; } }
  }
  if (tgt) aim = Math.atan2(tgt[1] - c.y, tgt[0] - c.x);
  updAim();
}

// ---------- header / HUD ----------
function renderLevels() {
  const nav = $('levels'); nav.innerHTML = '';
  if (mode === 'learn') { if (learn) renderLearnLevels(nav); return; }
  const list = isGolf() ? HOLES : PUZZLES;
  list.forEach((p, i) => {
    const b = document.createElement('button');
    b.className = 'lv' + (!isGolf() && solved[i] ? ' solved' : ''); b.textContent = i + 1; b.title = p.name;
    b.setAttribute('aria-current', i === level ? 'true' : 'false');
    const rt = (isGolf() ? RATINGS.golf : RATINGS.puzzles)[i].rating;
    const st = document.createElement('span'); st.className = 'st'; b.appendChild(st);
    if (isGolf()) { const s = golfStars[i] || 0; st.textContent = s ? '★'.repeat(s) : ''; b.setAttribute('aria-label', `Hole ${i + 1}, ${DIFF_NAMES[rt]}, ${s} of 3 stars`); }
    else { st.className = 'st pips'; st.textContent = '•'.repeat(rt); st.dataset.r = rt; b.setAttribute('aria-label', `Puzzle ${i + 1}, ${DIFF_NAMES[rt]}${solved[i] ? ', solved' : ''}`); }
    b.title = `${p.name} · ${DIFF_NAMES[rt]}`;
    b.onclick = () => { audio(); isGolf() ? loadHole(i) : loadPuzzle(i); };
    nav.appendChild(b);
  });
}
function ballDot(id, gone) {
  const s = document.createElement('span'); s.className = 'dot' + (gone ? ' gone' : '');
  const c = `rgb(${ballBase(id).map(Math.round).join(',')})`, w = `rgb(${TH.white.join(',')})`, lum = ballBase(id).reduce((a, v, k) => a + v * [0.3, 0.59, 0.11][k], 0);
  s.style.background = id > 8 ? `linear-gradient(${w} 0 28%, ${c} 28% 72%, ${w} 72%)` : c;
  s.textContent = id; s.style.color = id <= 8 && lum < 120 ? w : `rgb(${TH.ink.join(',')})`;
  return s;
}
function renderHud() {
  const g = $('hud'); g.innerHTML = '';
  const span = (html) => { const s = document.createElement('span'); s.innerHTML = html; g.appendChild(s); return s; };
  if (mode === 'versus' && vs) { renderVersusHud(g); return; }
  if (mode === 'learn' && cur.learn) { renderLearnHud(g); return; }
  if (mode === 'blackout' && bo) { span(`Shots <b>${bo.shots}</b>`); span(`Left <b>${boLeft()}</b>`); span(`Best <b>${boBest || '–'}</b>`); return; }
  if (cur.rating) span(`<span class="diff" data-r="${cur.rating}" title="${clubText(cur.club)}" aria-label="Difficulty ${cur.rating} of 5, ${DIFF_NAMES[cur.rating]}. ${clubText(cur.club)}"><i></i><i></i><i></i><i></i><i></i> ${DIFF_NAMES[cur.rating]}</span>`);
  if (cur.kind === 'golf') {
    const got = world.coins.filter(Boolean).length;
    span(`Stroke <b>${golf.strokes}</b>`); span(`Par <b>${golf.par}</b>`); span(`Coins <b>${got}/${world.coins.length}</b>`);
    return;
  }
  if (mode === 'survival') {
    span(`Cleared <b>${surv.cleared}</b>`);
    span(`<span class="hearts" aria-label="${surv.lives} lives left">${'♥'.repeat(surv.lives)}<span class="lost">${'♥'.repeat(3 - surv.lives)}</span></span>`);
    span(`Best <b>${best}</b>`);
    const ck = span(''); ck.className = 'clock'; ck.id = 'clock'; surv.shown = -1; paintClock();
  }
  const grp = document.createElement('span'); grp.className = 'group'; g.appendChild(grp);
  const all = cur.balls.filter(b => myIds().includes(b.id)).map(b => b.id);
  const lab = document.createElement('span'); lab.textContent = mode === 'survival' ? '' : `You're ${cur.group}:`; grp.appendChild(lab);
  for (const id of all) grp.appendChild(ballDot(id, !world.get(id).on));
  if (all.length) { const t = document.createElement('span'); t.textContent = 'then'; grp.appendChild(t); }
  grp.appendChild(ballDot(8, !world.get(8).on));
}

// ---------- messages / overlay ----------
let msgTimer;
function showMsg(text, kind = '', ms = 2600) {
  const m = $('msg'); clearTimeout(msgTimer);
  if (!text) { m.style.opacity = 0; return; }
  m.textContent = text; m.dataset.kind = kind; m.style.opacity = 1;
  if (ms) msgTimer = setTimeout(() => m.style.opacity = 0, ms);
  $('live').textContent = text;
}
function overlay(title, text, buttons, extra, wide = false) {
  $('ovTitle').textContent = title; $('ovText').textContent = text; $('ovText').hidden = !text;
  $('overlay').querySelector('.card').classList.toggle('wide', wide);
  const ex = $('ovExtra'); ex.innerHTML = extra || ''; ex.hidden = !extra;
  const row = $('ovRow'); row.innerHTML = '';
  for (const [label, fn, primary] of buttons) { const b = document.createElement('button'); b.className = 'b' + (primary ? ' shoot' : ''); b.textContent = label; b.onclick = () => { audio(); fn(); }; row.appendChild(b); }
  $('overlay').hidden = false;
  const first = row.querySelector('.shoot') || row.querySelector('button'); first && first.focus();
}

// ---------- shooting ----------
function shoot(a = aim, p = +$('power').value, s = spinVal) {
  if (state !== 'aim' || !$('overlay').hidden) return;
  if (mode === 'learn' && learn && learn.choice === null) { showMsg('Pick A or B first.', 'bad'); return; }
  audio(); hintStep = null;
  const grp = mode === 'versus' ? vs.players[vs.turn].group : cur.group;
  pending = { a, p, s, mine: cur.kind === 'pool' ? (grp ? remainingMine(world, grp) : []) : null };
  if (mode === 'versus') vs.ballInHand = false;
  if (mode === 'learn') learnPending(pending);
  if (cur.kind === 'golf') pending.snap = { x: world.ball.x, y: world.ball.y, coins: world.coins.slice() };
  state = 'strike'; strikeT = 0; showMsg('');
}
function release() {
  if (cur.kind === 'golf') world.strike(pending.a, pending.p); else world.strike(pending.a, pending.p, pending.s, breakBoost());
  if (breakBoost() > 1) { tone(90, 0.35, 0.35, 'sine', 0.5); if (shakeOn) shake = 6; }
  state = 'roll'; acc = 0; click(pending.p * 1200);
}
function shotDone() {
  shots++; predKey = '';
  if (!replay) { bump('shots'); if (cur.kind === 'pool') bump('pots', world.potted.filter(id => id !== 0).length); }
  if (cur.kind === 'golf') return golfShotDone();
  if (mode === 'versus') return versusDone();
  if (mode === 'learn') return learnDone();
  if (mode === 'blackout') return blackoutDone();
  const j = judge(world, cur.group, pending.mine);
  renderHud();
  if (replay) {
    if (j.result === 'win') { state = 'done'; fanfare(); replay = null; overlay('That’s the line', `${shots} shot${shots > 1 ? 's' : ''}. Now try it yourself.`, [['Try it', () => loadPuzzle(level), true]]); }
    else if (j.result === 'continue') { state = 'wait'; setTimeout(nextReplay, 700); }
    else { state = 'done'; replay = null; showMsg('Replay drifted. Try it yourself.', 'bad'); }
    return;
  }
  if (j.result === 'continue') {
    state = 'aim'; const left = remainingMine(world, cur.group).length;
    showMsg(left ? `Good pot. ${left} to go, then the black.` : 'Good pot. Now the black.', 'good');
    defaultAim(); return;
  }
  if (mode === 'survival') return survivalDone(j);
  if (j.result === 'win') {
    const first = !solved[level];
    state = 'done'; fanfare(); solved[level] = true; store.set('solved', solved); renderLevels();
    awardXP(first ? 50 * (cur.rating || 1) : 10, first ? 'Puzzle solved' : 'Solved again');
    const last = level === PUZZLES.length - 1;
    overlay('Run out!', `Table cleared in ${shots} shot${shots > 1 ? 's' : ''}.`,
      last ? [['Play again', () => loadPuzzle(level)], ['Back to menu', () => go('menu'), true]]
           : [['Replay', () => loadPuzzle(level)], ['Next puzzle', () => loadPuzzle(level + 1), true]]);
  } else {
    state = 'done'; buzz();
    overlay(j.result === 'lose' ? 'Game lost' : 'Visit over', j.reason, [['Hint', () => { loadPuzzle(level); hintStep = 0; showHint(); }], ['Try again', () => loadPuzzle(level), true]]);
  }
}
function survivalDone(j) {
  state = 'done';
  if (j.result === 'win') {
    surv.cleared++; surv.time += CLOCK_ADD;
    awardXP(10 + 10 * (cur.rating || 1), 'Position cleared');
    if (surv.cleared > best) { best = surv.cleared; store.set('best', best); if (!surv.bestPaid && surv.cleared > 1) { surv.bestPaid = true; awardXP(50, 'New best run'); } }
    fanfare(); renderHud(); showMsg(`Cleared! +${CLOCK_ADD}s. ${surv.cleared} in a row.`, 'good');
    setTimeout(() => { if (mode === 'survival' && state === 'done') nextSurvival(); }, 900);
    return;
  }
  surv.lives--; surv.time = Math.max(surv.time, CLOCK_START); buzz(); renderHud();
  if (surv.lives <= 0) {
    const record = surv.cleared >= best && surv.cleared > 0;
    overlay('Run over', `${j.reason}. You cleared ${surv.cleared} position${surv.cleared === 1 ? '' : 's'}.${record ? ' New best!' : ` Best: ${best}.`}`, [['New run', newRun, true]]);
  } else {
    overlay(`${surv.lives} ${surv.lives === 1 ? 'life' : 'lives'} left`, j.reason, [['Next position', nextSurvival, true]]);
  }
}
// The survival clock: one clock for the whole run. It only runs while you are aiming.
function paintClock() {
  const el = $('clock'); if (!el || !surv) return;
  const t = Math.max(0, Math.ceil(surv.time)); if (t === surv.shown) return; surv.shown = t;
  el.innerHTML = `⏱ <b>${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}</b>`; el.classList.toggle('low', t <= 10);
  el.setAttribute('aria-label', `${t} seconds left`);
  if (t <= 5 && t > 0 && state === 'aim') tone(1700, 0.04, 0.06, 'square');
}
function tickClock(dt) {
  if (mode !== 'survival' || !surv || surv.lives <= 0 || screen !== 'game' || state !== 'aim' || replay || !$('overlay').hidden || document.hidden) return;
  surv.time -= dt; paintClock();
  if (surv.time <= 0) { surv.time = 0; paintClock(); survivalDone({ result: 'fail', reason: 'Out of time' }); }
}
function golfShotDone() {
  golf.strokes++;
  if (world.dead) {
    golf.strokes++; buzz();
    const s = pending.snap; world.ball.x = s.x; world.ball.y = s.y; world.ball.vx = world.ball.vy = 0; world.coins = s.coins; world.dead = false;
    showMsg('In the water. Penalty stroke, ball back where it was.', 'bad', 3200);
  }
  renderHud();
  if (replay) {
    if (world.holed) { state = 'done'; replay = null; fanfare(); overlay('That’s a 3-star line', `${golf.strokes} strokes with every coin. Your turn.`, [['Try it', () => loadHole(level), true]]); }
    else { state = 'wait'; setTimeout(nextReplay, 600); }
    return;
  }
  if (!world.holed) { state = 'aim'; defaultAim(); return; }
  state = 'done'; fanfare(); bump('holes'); if (golf.strokes === 1) bump('aces');
  const coins = world.coins.every(Boolean), underPar = golf.strokes <= golf.par;
  const stars = 1 + (coins ? 1 : 0) + (underPar ? 1 : 0);
  if (stars > (golfStars[level] || 0)) { golfStars[level] = stars; store.set('golf', golfStars); }
  renderLevels();
  const last = level === HOLES.length - 1;
  const term = golf.strokes === 1 ? 'Hole in one!' : golf.strokes < golf.par ? 'Under par!' : golf.strokes === golf.par ? 'Par.' : `${golf.strokes - golf.par} over par.`;
  const extra = `<div class="stars" aria-label="${stars} of 3 stars">${'★'.repeat(stars)}<span class="off">${'★'.repeat(3 - stars)}</span></div>
    <ul class="starlist"><li class="got">Holed out</li><li class="${coins ? 'got' : ''}">Collected every coin</li><li class="${underPar ? 'got' : ''}">Par ${golf.par} or better</li></ul>`;
  overlay(term, `${golf.strokes} stroke${golf.strokes === 1 ? '' : 's'}.`,
    last ? [['Replay', () => loadHole(level)], ['Back to hole 1', () => loadHole(0), true]]
         : [['Replay', () => loadHole(level)], ['Next hole', () => loadHole(level + 1), true]], extra);
}

function startReplay() {
  if (mode === 'learn') {
    audio(); loadDrill(learn.di, true); if (cur.learn.kind === 'choice') learn.choice = cur.learn.answer;
    renderHud(); replay = { i: 0, sol: cur.learn.sol }; showMsg('Watching…', '', 0); nextReplay(); return;
  }
  if (isGolf()) {
    const line = GOLF_LINES[level]; if (!line) return;
    audio(); loadHole(level); replay = { i: 0, sol: line.map(s => ({ ang: s.a, pow: s.p, spin: 0 })) };
  } else {
    const sol = SOLUTIONS[level]; if (!sol) return;
    audio(); loadPuzzle(level); replay = { i: 0, sol };
  }
  showMsg('Watching the solution…', '', 0); nextReplay();
}
function nextReplay() {
  if (!replay) return;
  const s = replay.sol[replay.i++]; if (!s) return;
  aim = s.ang; $('power').value = s.pow; setSpin(s.spin); updOutputs(); updAim();
  state = 'aim'; setTimeout(() => shoot(s.ang, s.pow, s.spin), 650);
}
function showHint() {
  const sol = SOLUTIONS[level]; if (!sol) return;
  const k = Math.min(shots, sol.length - 1); hintStep = k;
  const s = sol[k];
  const spinWord = s.spin < 0 ? 'draw' : s.spin > 0 ? 'follow' : 'stun';
  const plan = sol.map(x => x.target).join(' → ');
  const pn = (ROT ? POCKET_NAMES_ROT : POCKET_NAMES)[s.pocket];
  showMsg(shots === 0 ? `Plan: ${plan}. First: the ${s.target} into the ${pn} pocket, with ${spinWord}.`
                      : `Try the ${s.target} into the ${pn} pocket, with ${spinWord}.`, '', 7000);
}

// ---------- view / camera ----------
let S = 1, ROT = false, tf = [1, 0, 0, 1, 0, 0], viewS = 1;
const LANDSCAPE = window.matchMedia('(orientation: landscape) and (max-height: 560px)');
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const fullW = T.W + 2 * M0, fullH = T.H + 2 * M0;
  cv.style.width = cv.style.height = '0px'; // collapse first so an old size can't widen the page while we measure
  ROT = window.innerWidth < 700 && window.innerHeight > window.innerWidth * 1.1;
  const aspect = ROT ? fullW / fullH : fullH / fullW;
  const stage = $('board').parentElement, land = LANDSCAPE.matches;
  let w = stage.clientWidth;
  const maxH = land ? Math.max(120, stage.clientHeight) : window.innerHeight * (ROT ? 0.66 : 0.6);
  if (w * aspect > maxH) w = maxH / aspect;
  cv.style.width = w + 'px'; cv.style.height = (w * aspect) + 'px';
  cv.width = Math.round(w * dpr); cv.height = Math.round(w * aspect * dpr);
  S = cv.width / (ROT ? fullH : fullW);
}
function viewSize(s) { const a = cv.width / s, b = cv.height / s; return ROT ? [b, a] : [a, b]; } // world units visible along x, y
function camTarget() {
  if (cur.kind !== 'golf') return [T.W / 2, T.H / 2];
  const h = cur.hole;
  if (overview) return [h.W / 2, h.H / 2];
  const b = world.ball; let tx = b.x, ty = b.y;
  if (state === 'aim' && !replay) { tx += Math.cos(aim) * 160; ty += Math.sin(aim) * 160; } // look a little ahead
  const [vw, vh] = viewSize(viewS);
  const clamp = (v, lo, hi) => lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v));
  return [clamp(tx, vw / 2 - M0, h.W + M0 - vw / 2), clamp(ty, vh / 2 - M0, h.H + M0 - vh / 2)];
}
function targetScale() {
  if (cur.kind !== 'golf' || !overview) return S;
  const h = cur.hole, ww = h.W + 2 * M0, hh = h.H + 2 * M0;
  return ROT ? Math.min(cv.width / hh, cv.height / ww) : Math.min(cv.width / ww, cv.height / hh);
}
function snapCam() { viewS = targetScale(); const [x, y] = camTarget(); cam.x = x; cam.y = y; }
function updCam(dt) {
  const k = Math.min(1, dt * 5);
  viewS += (targetScale() - viewS) * k;
  const [x, y] = camTarget(); cam.x += (x - cam.x) * k; cam.y += (y - cam.y) * k;
  const s = viewS, cw = cv.width / 2, ch = cv.height / 2;
  const jx = shake > 0.2 ? (Math.random() - 0.5) * shake * 2 : 0, jy = shake > 0.2 ? (Math.random() - 0.5) * shake * 2 : 0;
  tf = ROT ? [0, s, -s, 0, cw + cam.y * s + jx, ch - cam.x * s + jy] : [s, 0, 0, s, cw - cam.x * s + jx, ch - cam.y * s + jy];
}
function screenToWorld(px, py) {
  const [a, b, c, d, e, f] = tf, det = a * d - b * c;
  return [(d * (px - e) - c * (py - f)) / det, (-b * (px - e) + a * (py - f)) / det];
}

// ---------- prediction (runs the real physics on a copy) ----------
const OBJ_LEN = 320, CUE_LEN = 180, GOLF_LEN = 560;
let predKey = '', pred = null;
function predict() {
  const c0k = world.get(0), key = [mode, level, shots, aim, $('power').value, spinVal, c0k.x, c0k.y, mode === 'versus' && vs ? vs.turn + (vs.players[vs.turn].group || '') : ''].join('|');
  if (key === predKey) return pred;
  predKey = key;
  const w = world.clone();
  if (cur.kind === 'golf') {
    w.strike(aim, +$('power').value);
    const b = w.ball, p = { golf: true, before: [[b.x, b.y]], dead: false, holed: false }; let len = 0, cush = 0;
    for (let n = 0; n < 12000 && w.moving(); n++) {
      w.events = []; const q = [b.x, b.y]; w.step();
      for (const e of w.events) if (e.t === 'cush') { p.before.push([e.x, e.y]); cush++; }
      len += Math.hypot(b.x - q[0], b.y - q[1]);
      if (w.dead) { p.dead = true; break; }
      if (w.holed) { p.holed = true; break; }
      if (len > GOLF_LEN || cush >= 3) break;
    }
    p.before.push([b.x, b.y]); p.stopped = !w.moving() && !p.dead && !p.holed;
    return pred = p;
  }
  w.strike(aim, +$('power').value, spinVal, breakBoost());
  const c0 = w.get(0);
  const p = { before: [[c0.x, c0.y]], ghost: null, obj: null, objPath: null, cuePath: null, scratch: false };
  let obj = null, objLen = 0, cueLen = 0, objDone = false, cueDone = false, cush = 0;
  const hit = (e, id) => (e.t === 'ball' && (e.a === id || e.b === id)) || (e.t === 'cush' && e.id === id) || (e.t === 'pot' && e.id === id);
  const push = (path, b) => { const q = path[path.length - 1], d = Math.hypot(b.x - q[0], b.y - q[1]); path.push([b.x, b.y]); return d; };
  for (let n = 0; n < 8000 && w.moving(); n++) {
    w.events = []; w.step();
    const c = w.get(0);
    if (!obj) {
      for (const e of w.events) if (e.t === 'cush' && e.id === 0) { p.before.push([e.x, e.y]); cush++; }
      if (w.firstContact !== null) {
        obj = w.get(w.firstContact);
        p.ghost = [w.contact.x, w.contact.y]; p.before.push(p.ghost); p.obj = obj.id;
        p.objPath = [[w.contact.ox, w.contact.oy]]; p.cuePath = [p.ghost.slice()];
        objLen = push(p.objPath, obj); cueLen = push(p.cuePath, c);
        continue;
      }
      if (!c.on) { p.scratch = true; p.before.push([c.x, c.y]); break; }
      if (cush >= 3) break;
      continue;
    }
    if (!objDone) { objLen += push(p.objPath, obj); if (!obj.on || objLen >= OBJ_LEN || (!obj.vx && !obj.vy) || w.events.some(e => hit(e, obj.id))) objDone = true; }
    if (!cueDone) { cueLen += push(p.cuePath, c); if (!c.on || cueLen >= CUE_LEN || (!c.vx && !c.vy) || w.events.some(e => hit(e, 0))) cueDone = true; }
    if (objDone && cueDone) break;
  }
  if (!obj && !p.scratch) { const c = w.get(0); p.before.push([c.x, c.y]); }
  return pred = p;
}

// ---------- drawing ----------
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function cushion(pts) { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill(); }
function diamond(x, y) { ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x + 3, y); ctx.lineTo(x, y + 4); ctx.lineTo(x - 3, y); ctx.closePath(); ctx.fill(); }
function frame3(W, H, g = ctx) {
  if (TH.sketch) {
    g.fillStyle = TH.bg; gRound(g, -M0, -M0, W + 2 * M0, H + 2 * M0, 22); g.fill();
    g.save(); gRound(g, -M0, -M0, W + 2 * M0, H + 2 * M0, 22); g.rect(-CUSH, -CUSH, W + 2 * CUSH, H + 2 * CUSH); g.clip('evenodd');
    hatchRect(g, -M0, -M0, W + 2 * M0, H + 2 * M0, 11, 1.1, 0.28); g.restore();
    inkPath(g, rectPts(-M0 + 4, -M0 + 4, W + 2 * M0 - 8, H + 2 * M0 - 8), true, 2.6);
    return;
  }
  const rail = g.createLinearGradient(0, -M0, 0, H + M0);
  rail.addColorStop(0, TH.rail[0]); rail.addColorStop(1, TH.rail[1]);
  g.fillStyle = rail; gRound(g, -M0, -M0, W + 2 * M0, H + 2 * M0, 24); g.fill();
  if (TH.railLine) { g.strokeStyle = TH.railLine; g.lineWidth = 2; gRound(g, -M0 + 3, -M0 + 3, W + 2 * M0 - 6, H + 2 * M0 - 6, 21); g.stroke(); }
}
function drawTable() {
  frame3(T.W, T.H);
  ctx.fillStyle = TH.diamond;
  for (let i = 1; i < 8; i++) { if (i === 4) continue; diamond(i * T.W / 8, -CUSH - RAIL / 2); diamond(i * T.W / 8, T.H + CUSH + RAIL / 2); }
  for (let i = 1; i < 4; i++) { diamond(-CUSH - RAIL / 2, i * T.H / 4); diamond(T.W + CUSH + RAIL / 2, i * T.H / 4); }
  ctx.fillStyle = TH.under; ctx.fillRect(-CUSH, -CUSH, T.W + 2 * CUSH, T.H + 2 * CUSH);
  const felt = ctx.createRadialGradient(T.W / 2, T.H / 2, 40, T.W / 2, T.H / 2, T.W * 0.65);
  felt.addColorStop(0, TH.cloth[0]); felt.addColorStop(0.58, TH.cloth[1]); felt.addColorStop(1, TH.cloth[2]);
  ctx.fillStyle = felt; ctx.fillRect(0, 0, T.W, T.H);
  ctx.strokeStyle = TH.marks; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(T.W * 0.25, 0); ctx.lineTo(T.W * 0.25, T.H); ctx.stroke();
  ctx.fillStyle = TH.marks; ctx.beginPath(); ctx.arc(T.W * 0.75, T.H / 2, 3, 0, 7); ctx.fill();
  ctx.fillStyle = TH.cushion;
  const C = T.C, M = T.M, cush = [
    [[C, 0], [T.W / 2 - M, 0], [T.W / 2 - M - 9, -CUSH], [C + 16, -CUSH]], [[T.W / 2 + M, 0], [T.W - C, 0], [T.W - C - 16, -CUSH], [T.W / 2 + M + 9, -CUSH]],
    [[C, T.H], [T.W / 2 - M, T.H], [T.W / 2 - M - 9, T.H + CUSH], [C + 16, T.H + CUSH]], [[T.W / 2 + M, T.H], [T.W - C, T.H], [T.W - C - 16, T.H + CUSH], [T.W / 2 + M + 9, T.H + CUSH]],
    [[0, C], [0, T.H - C], [-CUSH, T.H - C - 16], [-CUSH, C + 16]], [[T.W, C], [T.W, T.H - C], [T.W + CUSH, T.H - C - 16], [T.W + CUSH, C + 16]]];
  cush.forEach(cushion);
  if (TH.sketch) cush.forEach(c => inkPath(ctx, [c[3], c[0], c[1], c[2]], false, 1.8, 1.2));
  if (TH.neon) {
    ctx.save(); ctx.shadowColor = TH.glow; ctx.shadowBlur = 14; ctx.strokeStyle = TH.glow; ctx.lineWidth = 2.2;
    cush.forEach(c => { ctx.beginPath(); ctx.moveTo(...c[0]); ctx.lineTo(...c[1]); ctx.stroke(); });
    ctx.restore();
  }
  PK.forEach(([x, y, r], k) => {
    const glow = mode === 'puzzle' && hintStep !== null && SOLUTIONS[level] && SOLUTIONS[level][hintStep].pocket === k;
    if (TH.sketch) { ctx.fillStyle = TH.inkCss; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); inkPath(ctx, circlePts(x, y, r + 5), true, 1.6, 1.4); }
    else {
      ctx.fillStyle = TH.pocketRim; ctx.beginPath(); ctx.arc(x, y, r + 5, 0, 7); ctx.fill();
      const g = ctx.createRadialGradient(x, y, 2, x, y, r); g.addColorStop(0, TH.pocket[0]); g.addColorStop(1, TH.pocket[1]);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      if (TH.neon) { ctx.save(); ctx.shadowColor = TH.glow2; ctx.shadowBlur = 16; ctx.strokeStyle = TH.glow2; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 2, 0, 7); ctx.stroke(); ctx.restore(); }
    }
    if (glow) { ctx.strokeStyle = TH.accent; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, r + 8, 0, 7); ctx.stroke(); }
  });
  if (TH.sketch) inkPath(ctx, rectPts(-CUSH, -CUSH, T.W + 2 * CUSH, T.H + 2 * CUSH), true, 2);
  if (TH.lamp) {
    const lamp = ctx.createRadialGradient(T.W / 2, T.H / 2, 0, T.W / 2, T.H / 2, T.W * 0.6);
    lamp.addColorStop(0, TH.lamp[0]); lamp.addColorStop(1, TH.lamp[1]);
    ctx.fillStyle = lamp; ctx.fillRect(-CUSH, -CUSH, T.W + 2 * CUSH, T.H + 2 * CUSH);
  }
}
// ---------- golf course rendering ----------
// One painter for the main view, the minimap and the previews, so they always agree.
function gRound(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function gPoly(g, P) { g.beginPath(); P.pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); }
function paintCourse(g, h, full, now = 0, scale = 1) {
  const P = prepHole(h)._prep, [cx, cy] = h.cup, GR = GOLF.GREEN_R, C = TH.golf, sk = TH.sketch && full, ne = TH.neon && full;
  if (full) { frame3(h.W, h.H, g); g.fillStyle = C.under; g.fillRect(-CUSH, -CUSH, h.W + 2 * CUSH, h.H + 2 * CUSH); }
  g.fillStyle = P.fair.length ? C.rough : C.fair; g.fillRect(0, 0, h.W, h.H);
  if (sk) { g.save(); g.beginPath(); g.rect(0, 0, h.W, h.H); g.clip(); g.fillStyle = 'rgba(28,27,25,.18)';
    for (let k = 0; k < h.W * h.H / 2600; k++) { const x = (jit(k, 1, 2) * 0.5 + 0.5) * h.W, y = (jit(k, 3, 4) * 0.5 + 0.5) * h.H; g.fillRect(x, y, 1.6, 4); } g.restore(); }
  g.save(); g.beginPath();
  for (const f of P.fair) { f.pts.forEach(([x, y], k) => k ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); }
  g.moveTo(cx + GR + 26, cy); g.arc(cx, cy, GR + 26, 0, Math.PI * 2);
  if (P.fair.length) { g.fillStyle = C.fair; g.fill(); }
  if (full) {
    if (P.fair.length) g.clip(); else { g.beginPath(); g.rect(0, 0, h.W, h.H); g.clip(); }
    g.fillStyle = C.stripe;
    for (let x = -h.H, k = 0; x < h.W + h.H; x += 80, k++) if (k % 2) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 80, 0); g.lineTo(x + 80 + h.H * 0.35, h.H); g.lineTo(x + h.H * 0.35, h.H); g.fill(); }
  }
  g.restore();
  if (sk) for (const f of P.fair) inkPath(g, f.pts.filter((_, k) => k % 2 === 0), true, 1.8, 2);
  if (ne) { g.save(); g.shadowColor = TH.glow; g.shadowBlur = 10; g.strokeStyle = 'rgba(41,231,255,.55)'; g.lineWidth = 1.5; for (const f of P.fair) { gPoly(g, f); g.stroke(); } g.restore(); }
  g.fillStyle = C.fringe; g.beginPath(); g.arc(cx, cy, GR + 10, 0, 7); g.fill();
  g.fillStyle = C.green; g.beginPath(); g.arc(cx, cy, GR, 0, 7); g.fill();
  if (full) {
    g.save(); g.beginPath(); g.arc(cx, cy, GR, 0, 7); g.clip(); g.fillStyle = C.stripe;
    for (let k = -GR; k < GR; k += 40) g.fillRect(cx + k, cy - GR, 20, GR * 2);
    g.restore();
    if (sk) inkPath(g, circlePts(cx, cy, GR, 30), true, 1.6, 1.5);
  }
  for (const sd of P.sand) {
    gPoly(g, sd); g.fillStyle = C.sand; g.fill();
    if (full && !sk) {
      g.lineWidth = 3; g.strokeStyle = C.sandEdge; g.stroke();
      if (!ne) { g.save(); g.clip(); const gr = g.createRadialGradient(sd.cx - sd.rad * 0.3, sd.cy - sd.rad * 0.3, 0, sd.cx, sd.cy, sd.rad * 1.1);
        gr.addColorStop(0, 'rgba(255,255,255,.18)'); gr.addColorStop(1, 'rgba(160,120,60,.16)'); g.fillStyle = gr; g.fillRect(sd.cx - sd.rad, sd.cy - sd.rad, sd.rad * 2, sd.rad * 2); g.restore(); }
    }
    if (sk) { g.save(); gPoly(g, sd); g.clip(); g.fillStyle = TH.inkCss; for (let k = 0; k < sd.rad * sd.rad / 90; k++) { const x = sd.cx + jit(k, 7, 1) * sd.rad, y = sd.cy + jit(k, 9, 2) * sd.rad; g.beginPath(); g.arc(x, y, 1.1, 0, 7); g.fill(); } g.restore(); inkPath(g, sd.pts.filter((_, k) => k % 2 === 0), true, 1.8, 1.4); }
  }
  for (const w of P.water) {
    gPoly(g, w);
    if (full && !sk) { g.lineWidth = 8; g.strokeStyle = TH.neon ? 'rgba(41,231,255,.15)' : 'rgba(255,255,255,.25)'; g.stroke(); }
    const gr = g.createRadialGradient(w.cx, w.cy, 0, w.cx, w.cy, w.rad); gr.addColorStop(0, C.waterDeep); gr.addColorStop(1, C.water);
    g.fillStyle = gr; g.fill();
    if (full) {
      if (!sk) { g.save(); if (ne) { g.shadowColor = TH.glow; g.shadowBlur = 12; } g.lineWidth = 2; g.strokeStyle = C.waterEdge; g.stroke(); g.restore(); }
      g.save(); gPoly(g, w); g.clip(); g.strokeStyle = sk ? TH.inkCss : 'rgba(255,255,255,.16)'; g.lineWidth = sk ? 1.4 : 2; g.lineCap = 'round';
      const t = sk ? 0 : now / 1000;
      for (let yy = w.cy - w.rad + 20, k = 0; yy < w.cy + w.rad; yy += sk ? 22 : 46, k++) {
        const off = ((t * 22 + k * 37) % 160) - 80;
        for (let xx = w.cx - w.rad + off; xx < w.cx + w.rad; xx += sk ? 70 : 160) { g.beginPath(); g.moveTo(xx, yy); g.quadraticCurveTo(xx + 14, yy - 5, xx + 28, yy); g.stroke(); }
      }
      g.restore();
      if (sk) inkPath(g, w.pts.filter((_, k) => k % 2 === 0), true, 2.2, 1.6);
    }
  }
  for (const r of h.blocks) {
    if (full && !sk) { g.fillStyle = 'rgba(0,0,0,.25)'; gRound(g, r[0] + 3, r[1] + 5, r[2], r[3], 8); g.fill(); }
    g.fillStyle = C.wall; gRound(g, r[0], r[1], r[2], r[3], 8); g.fill();
    if (sk) { g.save(); gRound(g, r[0], r[1], r[2], r[3], 8); g.clip(); hatchRect(g, r[0], r[1], r[2], r[3], 8, 1.3, 0.7); g.restore(); inkPath(g, rectPts(r[0], r[1], r[2], r[3], 50), true, 2.2); }
    else if (full) { g.save(); if (ne) { g.shadowColor = TH.glow2; g.shadowBlur = 12; } g.strokeStyle = C.wallTop; g.lineWidth = 2; gRound(g, r[0] + 1, r[1] + 1, r[2] - 2, r[3] - 2, 7); g.stroke(); g.restore(); }
  }
  for (const p of h.posts) {
    if (full && !sk) { g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.arc(p[0] + 3, p[1] + 5, p[2], 0, 7); g.fill(); }
    g.save(); if (ne) { g.shadowColor = TH.glow2; g.shadowBlur = 16; }
    g.fillStyle = C.bump; g.beginPath(); g.arc(p[0], p[1], p[2], 0, 7); g.fill(); g.restore();
    g.fillStyle = C.bumpIn; g.beginPath(); g.arc(p[0], p[1], p[2] * 0.55, 0, 7); g.fill();
    if (sk) inkPath(g, circlePts(p[0], p[1], p[2], 18), true, 2, 1.2);
  }
  g.fillStyle = C.cupRim; g.beginPath(); g.arc(cx, cy, GOLF.CUP_R + (full ? 3 : 8 / scale), 0, 7); g.fill();
  g.fillStyle = C.hole; g.beginPath(); g.arc(cx, cy, GOLF.CUP_R, 0, 7); g.fill();
  if (sk) inkPath(g, circlePts(cx, cy, GOLF.CUP_R + 3, 18), true, 1.8, 1);
}
function drawCourse(h, coins = world.coins) {
  const now = performance.now(), [cx, cy] = h.cup, C = TH.golf;
  paintCourse(ctx, h, true, now);
  const lean = Math.sin(now / 70) * flagKick * 10, wave = TH.sketch ? 0 : Math.sin(now / 300) * 4;
  if (!TH.sketch) { ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 40, cy - 66); ctx.stroke(); }
  ctx.strokeStyle = C.pole; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 2 + lean, cy - 90); ctx.stroke();
  ctx.fillStyle = C.flag; ctx.beginPath(); ctx.moveTo(cx + 2 + lean, cy - 90); ctx.quadraticCurveTo(cx + 28 + lean, cy - 84 + wave, cx + 50 + lean, cy - 76); ctx.lineTo(cx + 2 + lean * 0.7, cy - 60); ctx.closePath();
  if (TH.sketch) { ctx.save(); ctx.clip(); hatchRect(ctx, cx, cy - 92, 54, 34, 5, 1.4, 0.9); ctx.restore(); inkPath(ctx, [[cx + 2, cy - 90], [cx + 50, cy - 76], [cx + 2, cy - 60]], true, 1.8, 0.8); }
  else { if (TH.neon) { ctx.save(); ctx.shadowColor = TH.glow2; ctx.shadowBlur = 14; ctx.fill(); ctx.restore(); } else ctx.fill(); }
  const t = now / 600;
  h.coins.forEach((c, i) => {
    if (coins[i]) return;
    const squash = 0.55 + 0.45 * Math.abs(Math.cos(t + i));
    ctx.save(); ctx.translate(c[0], c[1]); ctx.scale(squash, 1);
    if (!TH.sketch) { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.arc(2, 4, GOLF.COIN_R + 2, 0, 7); ctx.fill(); }
    ctx.fillStyle = C.coinEdge; ctx.beginPath(); ctx.arc(0, 0, GOLF.COIN_R + 2.5, 0, 7); ctx.fill();
    ctx.fillStyle = C.coin; ctx.beginPath(); ctx.arc(0, 0, GOLF.COIN_R, 0, 7); ctx.fill();
    if (TH.sketch) { ctx.strokeStyle = TH.inkCss; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, GOLF.COIN_R * 0.55, 0, 7); ctx.stroke(); }
    else { ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.arc(-4, -4, 4, 0, 7); ctx.fill(); }
    ctx.restore();
  });
}

// ---------- minimap ----------
const mini = $('mini'), mctx = mini.getContext('2d');
let miniKey = '', miniBase = null, miniTf = null;
function drawMini() {
  const show = cur && cur.kind === 'golf' && !overview;
  if (mini.hidden !== !show) mini.hidden = !show;
  if (!show) return;
  const h = cur.hole, dpr = Math.min(2, window.devicePixelRatio || 1), pad = 26;
  const ww = h.W + 2 * pad, hh = h.H + 2 * pad;
  const cssW = Math.round(Math.min(cv.clientWidth * (ROT ? 0.3 : 0.2), ROT ? 120 : 200));
  const cssH = Math.round(cssW * (ROT ? ww / hh : hh / ww));
  const key = level + '|' + ROT + '|' + cssW + '|' + dpr + '|' + themeKey;
  if (key !== miniKey) {
    miniKey = key;
    mini.style.width = cssW + 'px'; mini.style.height = cssH + 'px';
    mini.width = Math.round(cssW * dpr); mini.height = Math.round(cssH * dpr);
    const m = mini.width / (ROT ? hh : ww);
    miniTf = ROT ? [0, m, -m, 0, (h.H + pad) * m, pad * m] : [m, 0, 0, m, pad * m, pad * m];
    miniBase = document.createElement('canvas'); miniBase.width = mini.width; miniBase.height = mini.height;
    const g = miniBase.getContext('2d');
    g.fillStyle = TH.golf.mini; g.fillRect(0, 0, mini.width, mini.height);
    g.setTransform(...miniTf); paintCourse(g, h, false, 0, m);
  }
  const g = mctx, m = Math.abs(miniTf[0] || miniTf[1]);
  g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(miniBase, 0, 0);
  g.setTransform(...miniTf);
  h.coins.forEach((c, i) => { if (!world.coins[i]) { g.fillStyle = TH.sketch ? TH.inkCss : TH.golf.coin; g.beginPath(); g.arc(c[0], c[1], 3.2 * dpr / m, 0, 7); g.fill(); } });
  // what the main view currently shows
  const corners = [[0, 0], [cv.width, 0], [cv.width, cv.height], [0, cv.height]].map(([x, y]) => screenToWorld(x, y));
  g.strokeStyle = `rgba(${TH.guide},.85)`; g.lineWidth = 1.5 * dpr / m; g.beginPath();
  corners.forEach(([x, y], k) => k ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.stroke();
  const b = world.ball;
  if (b.on) { g.fillStyle = `rgb(${TH.ink.join(',')})`; g.beginPath(); g.arc(b.x, b.y, 5 * dpr / m, 0, 7); g.fill(); g.fillStyle = `rgb(${TH.white.join(',')})`; g.beginPath(); g.arc(b.x, b.y, 3.6 * dpr / m, 0, 7); g.fill(); }
}
mini.addEventListener('click', () => $('map').click());

// ---------- 3D rolling balls ----------
// Each ball carries an orientation: n = the axis through its two number discs, p = the stripe axis.
// As a ball moves it rolls (rotation about the axis perpendicular to travel, angle = distance / R),
// and every ball is shaded per pixel as a real sphere, so numbers, stripes and the cue dot tumble.
const orient = new Map();
const v3 = { dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; } };
function rot(v, ax, th) { // Rodrigues
  const c = Math.cos(th), s = Math.sin(th), k = v3.cross(ax, v), d = v3.dot(ax, v) * (1 - c);
  return [v[0] * c + k[0] * s + ax[0] * d, v[1] * c + k[1] * s + ax[1] * d, v[2] * c + k[2] * s + ax[2] * d];
}
const restPose = () => ROT ? { n: [0, 0, 1], p: [0, -1, 0] } : { n: [0, 0, 1], p: [1, 0, 0] };
function getOrient(b) {
  let o = orient.get(b.id);
  if (!o) { const r = restPose(); o = { n: r.n, p: r.p, lx: b.x, ly: b.y, dirty: true }; orient.set(b.id, o); }
  return o;
}
function resetOrient() { orient.clear(); }
function rollBall(o, x, y, factor = 1) {
  const dx = x - o.lx, dy = y - o.ly, d = Math.hypot(dx, dy);
  o.lx = x; o.ly = y;
  if (d < 1e-6 || d > 400) return;
  const ax = [-dy / d, dx / d, 0], th = d / R * factor;
  o.n = v3.norm(rot(o.n, ax, th)); o.p = v3.norm(rot(o.p, ax, th)); o.dirty = true;
}
function settle(o, dt) { // after the balls stop, ease the numbers face-up so they stay readable
  const r = restPose(), k = 1 - Math.exp(-dt * 7);
  const flip = v3.dot(o.n, r.n) < 0 ? -1 : 1, tn = r.n.map(c => c * flip);
  if (1 - v3.dot(o.n, tn) < 1e-5 && 1 - v3.dot(o.p, r.p) < 1e-5) return;
  let n = v3.norm(o.n.map((c, i) => c + (tn[i] - c) * k));
  let p = o.p.map((c, i) => c + (r.p[i] - c) * k); const dp = v3.dot(p, n); p = v3.norm(p.map((c, i) => c - n[i] * dp));
  o.n = n; o.p = p; o.dirty = true;
}
const glyphs = new Map(), GL = 48;
function ballBase(id) {
  if (id > 100) id = 8;
  if (id === 0) return TH.cueBall;
  if (TH.balls === 'gray') { const v = BALL_GRAY[id > 8 ? id - 8 : id]; return [v, v, v]; }
  const c = hexRGB(colorOf(id));
  return TH.balls === 'pastel' ? c.map(v => v + (255 - v) * 0.38) : c;
}
function glyphMask(id) {
  const gk = themeKey + ':' + id; if (glyphs.has(gk)) return glyphs.get(gk);
  const c = document.createElement('canvas'); c.width = c.height = GL; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = TH.font.replace('{s}', id > 9 ? (TH.sketch ? 32 : 27) : (TH.sketch ? 40 : 34));
  g.fillText(String(id), GL / 2, GL / 2 + 2);
  const a = g.getImageData(0, 0, GL, GL).data, m = new Uint8Array(GL * GL);
  for (let i = 0; i < GL * GL; i++) m[i] = a[i * 4 + 3];
  glyphs.set(gk, m); return m;
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { glyphs.clear(); orient.forEach(o => o.dirty = true); });
const hexRGB = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const sprites = new Map();
function ballSprite(id, o, px, faded) {
  let s = sprites.get(id);
  if (!s) { s = { c: document.createElement('canvas') }; sprites.set(id, s); }
  const key = px + '|' + faded + '|' + ROT + '|' + themeKey;
  if (!o.dirty && s.key === key) return s.c;
  s.key = key; o.dirty = false;
  const c = s.c; if (c.width !== px) { c.width = c.height = px; }
  const g = c.getContext('2d'), img = g.createImageData(px, px), D = img.data;
  const base = ballBase(id), white = TH.white, ink = TH.ink, red = TH.cueDot, sk = !!TH.sketch, fade = TH.fade;
  const vis = id > 100 ? 8 : id, n = o.n, p = o.p, q = v3.cross(n, p), mask = vis ? glyphMask(vis) : null, stripe = vis > 8;
  const L = v3.norm(ROT ? [-0.52, 0.42, 0.74] : [-0.42, -0.52, 0.74]), Hh = v3.norm([L[0], L[1], L[2] + 1]);
  const CD = 0.83, SA = Math.sqrt(1 - CD * CD); // number disc: cos/sin of its angular radius
  for (let j = 0; j < px; j++) {
    const y = (j + 0.5) / px * 2 - 1;
    for (let i = 0; i < px; i++) {
      const x = (i + 0.5) / px * 2 - 1, r2 = x * x + y * y, k = (j * px + i) * 4;
      if (r2 >= 1) { D[k + 3] = 0; continue; }
      const z = Math.sqrt(1 - r2);
      const dn = x * n[0] + y * n[1] + z * n[2], dp = x * p[0] + y * p[1] + z * p[2];
      let col = base;
      if (stripe && Math.abs(dp) > 0.62) col = white;
      if (id === 0) { if (Math.abs(dn) > 0.972) col = red; }
      else if (Math.abs(dn) > CD) {
        col = white;
        const dq = x * q[0] + y * q[1] + z * q[2], s = dn > 0 ? 1 : -1;
        const gx = Math.floor((dp / SA * 0.5 + 0.5) * GL), gy = Math.floor((dq * s / SA * 0.5 + 0.5) * GL);
        if (gx >= 0 && gy >= 0 && gx < GL && gy < GL) { const a = mask[gy * GL + gx] / 255; if (a > 0) col = [col[0] + (ink[0] - col[0]) * a, col[1] + (ink[1] - col[1]) * a, col[2] + (ink[2] - col[2]) * a]; }
        if (Math.abs(dn) < CD + 0.01) col = [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8];
      }
      const nl = x * L[0] + y * L[1] + z * L[2], nh = x * Hh[0] + y * Hh[1] + z * Hh[2];
      let rr, gg, bb;
      if (sk) { // flat paper tones, cross-hatched on the shadow side, a blank paper highlight
        let sh = 1;
        if (nl < 0.25 && (i + j) % 4 === 0) sh = 0.45; else if (nl < -0.15 && (i - j + 400) % 4 === 0) sh = 0.45;
        const hi = nh > 0.975 ? 1 : 0;
        rr = hi ? 255 : col[0] * sh; gg = hi ? 255 : col[1] * sh; bb = hi ? 255 : col[2] * sh;
      } else {
        const diff = 0.32 + 0.78 * Math.max(0, nl), spec = Math.pow(Math.max(0, nh), 70) * 0.85 + Math.pow(Math.max(0, nh), 9) * 0.07;
        const rim = 0.72 + 0.28 * Math.sqrt(z);
        rr = col[0] * diff * rim + 255 * spec; gg = col[1] * diff * rim + 255 * spec; bb = col[2] * diff * rim + 255 * spec;
      }
      if (faded) { rr = rr * 0.45 + fade[0] * 0.55; gg = gg * 0.45 + fade[1] * 0.55; bb = bb * 0.45 + fade[2] * 0.55; }
      D[k] = rr; D[k + 1] = gg; D[k + 2] = bb;
      D[k + 3] = Math.min(1, (1 - Math.sqrt(r2)) * px * 0.5 + 0.35) * 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}
function drawBall(id, x, y, scale = 1, ring = null, o = null, extra = null) {
  const r = R * scale;
  const faded = fadeOn && cur.kind === 'pool' && id !== 0 && id !== 8 && id < 100 && !myIds().includes(id);
  if (!extra || !extra.noShadow) { ctx.fillStyle = TH.shadow; ctx.beginPath(); ctx.ellipse(x + 3 * scale, y + 5 * scale, r, r * 0.9, 0, 0, 7); ctx.fill(); }
  const b = o || getOrient({ id, x, y });
  const px = Math.max(8, Math.min(160, Math.ceil(2 * R * viewS)));
  ctx.drawImage(ballSprite(id, b, px, faded), x - r, y - r, 2 * r, 2 * r);
  if (TH.sketch && scale > 0.5) inkPath(ctx, circlePts(x, y, r, 20), true, 1.7, 0.8);
  if (extra && extra.dark) { ctx.fillStyle = TH.sketch ? `rgba(28,27,25,${extra.dark})` : `rgba(0,0,0,${extra.dark})`; ctx.beginPath(); ctx.arc(x, y, r + 0.5, 0, 7); ctx.fill(); }
  if (ring) { ctx.strokeStyle = ring; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 5, 0, 7); ctx.stroke(); }
}

// ---------- drop animations & effects ----------
let anims = [], fx = [], shake = 0, flagKick = 0;
function startPocketDrop(e) {
  const b = world.get(e.id), [pcx, pcy, pr] = PK[b.pocket], o = getOrient(b);
  const sp = Math.hypot(e.vx || 0, e.vy || 0) || 1;
  anims.push({ kind: 'pocket', id: e.id, o, t0: performance.now(), dur: 700, x0: e.x, y0: e.y,
    cx: e.x + (e.vx || 0) / sp * Math.min(40, sp * 0.03), cy: e.y + (e.vy || 0) / sp * Math.min(40, sp * 0.03),
    px: pcx, py: pcy, pr, sp });
  // the rattle: a couple of quick clicks against the jaws, then the drop onto the leather
  const loud = Math.min(1, sp / 1200);
  tone(1500, 0.03, 0.08 + 0.12 * loud, 'triangle', 0.7); tone(1150, 0.03, 0.06 + 0.1 * loud, 'triangle', 0.7, 0.07);
  tone(170, 0.22, 0.32, 'sine', 0.4, 0.24); tone(95, 0.3, 0.22, 'sine', 0.6, 0.27); tone(600, 0.05, 0.05, 'square', 0.5, 0.3);
}
function startCupDrop(e) {
  const h = cur.hole, o = getOrient(world.ball), dx = e.x - h.cup[0], dy = e.y - h.cup[1];
  const a0 = Math.atan2(dy, dx), sp = Math.hypot(e.vx, e.vy);
  const tang = (-dy * e.vx + dx * e.vy) / (Math.hypot(dx, dy) || 1); // sideways speed decides which way it circles
  anims.push({ kind: 'cup', id: 0, o, t0: performance.now(), dur: 1100, a0, d0: Math.hypot(dx, dy), dir: tang >= 0 ? 1 : -1, turns: 0.35 + Math.min(0.9, sp / 900), cx: h.cup[0], cy: h.cup[1] });
  flagKick = 1;
  for (let k = 0; k < 4; k++) tone(900 + k * 140, 0.05, 0.05, 'triangle', 0.9, k * 0.09);
  tone(210, 0.2, 0.35, 'sine', 0.45, 0.5); tone(120, 0.3, 0.25, 'sine', 0.5, 0.53); tone(1900, 0.04, 0.06, 'triangle', 0.5, 0.62);
}
const ease = t => t * t * (3 - 2 * t);
function drawAnims(now) {
  anims = anims.filter(a => now - a.t0 < a.dur);
  for (const a of anims) {
    const t = (now - a.t0) / a.dur;
    if (a.kind === 'pocket') {
      // 0-0.4: carries on into the pocket and rolls under the lip; 0.4-1: drops, shrinking into the dark
      let x, y, sc, dark = 0;
      if (t < 0.4) {
        const u = ease(t / 0.4), iu = 1 - u;
        x = iu * iu * a.x0 + 2 * iu * u * a.cx + u * u * a.px; y = iu * iu * a.y0 + 2 * iu * u * a.cy + u * u * a.py;
        sc = 1 - 0.12 * u;
      } else {
        const u = (t - 0.4) / 0.6, jig = Math.sin(u * 28) * (1 - u) * 3;
        x = a.px + jig; y = a.py + jig * 0.6; sc = 0.88 - 0.45 * ease(u); dark = 0.15 + 0.8 * u;
        if (u < 0.08 && !a.shook) { a.shook = true; if (shakeOn) shake = 4; }
      }
      rollBall(a.o, x, y);
      ctx.save(); ctx.beginPath(); if (t < 0.4) ctx.rect(0, 0, T.W, T.H); ctx.moveTo(a.px + a.pr + 2, a.py); ctx.arc(a.px, a.py, a.pr + 2, 0, Math.PI * 2); ctx.clip();
      drawBall(a.id, x, y, sc, null, a.o, { dark, noShadow: t > 0.4 });
      ctx.restore();
    } else if (a.kind === 'cup') {
      // circles the rim (lip-out drama), spirals in, then drops
      let x, y, sc = 1, dark = 0;
      if (t < 0.55) {
        const u = t / 0.55, ang = a.a0 + a.dir * a.turns * Math.PI * 2 * (1 - (1 - u) * (1 - u)), rad = a.d0 * (1 - u) + 6 * u;
        x = a.cx + Math.cos(ang) * rad; y = a.cy + Math.sin(ang) * rad; sc = 1 - 0.1 * u;
      } else {
        const u = (t - 0.55) / 0.45; x = a.cx; y = a.cy;
        sc = 0.9 - 0.5 * ease(u) + Math.sin(u * 18) * (1 - u) * 0.05; dark = 0.2 + 0.75 * u;
        if (!a.shook) { a.shook = true; if (shakeOn) shake = 3; }
      }
      rollBall(a.o, x, y);
      ctx.save(); if (t >= 0.55) { ctx.beginPath(); ctx.arc(a.cx, a.cy, GOLF.CUP_R, 0, 7); ctx.clip(); }
      drawBall(0, x, y, sc, null, a.o, { dark, noShadow: t >= 0.55 });
      ctx.restore();
    } else if (a.kind === 'sink') {
      const u = t; ctx.save(); ctx.globalAlpha = 1 - u;
      drawBall(0, a.x, a.y, 1 - 0.5 * u, null, a.o, { dark: 0.2 + 0.5 * u, noShadow: true });
      ctx.fillStyle = `rgba(40,110,170,${0.5 * u})`; ctx.beginPath(); ctx.arc(a.x, a.y, R * (1 - 0.5 * u), 0, 7); ctx.fill();
      ctx.restore();
    }
  }
  fx = fx.filter(f => now - f.t0 < f.dur);
  for (const f of fx) {
    const u = (now - f.t0) / f.dur;
    if (f.kind === 'ring') { ctx.strokeStyle = f.color.replace('A', (1 - u).toFixed(3)); ctx.lineWidth = 3 * (1 - u) + 0.5; ctx.beginPath(); ctx.arc(f.x, f.y, f.r0 + (f.r1 - f.r0) * ease(u), 0, 7); ctx.stroke(); }
    else if (f.kind === 'dot') { const x = f.x + f.vx * u, y = f.y + f.vy * u + 40 * u * u; ctx.fillStyle = f.color.replace('A', (1 - u).toFixed(3)); ctx.beginPath(); ctx.arc(x, y, f.r * (1 - 0.5 * u), 0, 7); ctx.fill(); }
    else if (f.kind === 'coin') {
      const y = f.y - 60 * ease(u), sq = Math.abs(Math.cos(u * 12));
      ctx.save(); ctx.globalAlpha = 1 - u * u; ctx.translate(f.x, y); ctx.scale(sq * (1 + 0.3 * u), 1 + 0.3 * u);
      ctx.fillStyle = TH.golf.coin; ctx.beginPath(); ctx.arc(0, 0, GOLF.COIN_R, 0, 7); ctx.fill(); if (TH.sketch) { ctx.strokeStyle = TH.inkCss; ctx.lineWidth = 1.5; ctx.stroke(); } ctx.restore();
    }
  }
}
function burst(x, y, color, n, spread, rmax) {
  const now = performance.now();
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = spread * (0.4 + Math.random() * 0.6); fx.push({ kind: 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, r: 2 + Math.random() * rmax, color, t0: now, dur: 450 + Math.random() * 250 }); }
}

function polyline(pts) { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); }
function arrowHead(pts, color) {
  if (pts.length < 2) return;
  const [x2, y2] = pts[pts.length - 1]; let k = pts.length - 2;
  while (k > 0 && Math.hypot(x2 - pts[k][0], y2 - pts[k][1]) < 12) k--;
  const [x1, y1] = pts[k], a = Math.atan2(y2 - y1, x2 - x1), s = 14;
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - s * Math.cos(a - 0.45), y2 - s * Math.sin(a - 0.45)); ctx.lineTo(x2 - s * Math.cos(a + 0.45), y2 - s * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
function corridor(pts, tint) {
  ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
  ctx.strokeStyle = tint; ctx.lineWidth = 2 * R; polyline(pts);
  ctx.strokeStyle = `rgba(${TH.guide},.3)`; ctx.lineWidth = 1;
  for (const s of [-1, 1]) {
    ctx.save(); ctx.setLineDash([3, 6]);
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1], [x2, y2] = pts[i], L = Math.hypot(x2 - x1, y2 - y1) || 1, nx = -(y2 - y1) / L * R * s, ny = (x2 - x1) / L * R * s;
      ctx.beginPath(); ctx.moveTo(x1 + nx, y1 + ny); ctx.lineTo(x2 + nx, y2 + ny); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.setLineDash([7, 7]); ctx.strokeStyle = `rgba(${TH.guide},.78)`; ctx.lineWidth = 1.8; polyline(pts); ctx.setLineDash([]);
}
function drawGuide() {
  const cue = world.get(0); if (!cue.on) return;
  const p = predict();
  const G = TH.guide, bad = TH.bad, badTint = `rgba(${TH.badRGB},.14)`, okTint = `rgba(${G},.10)`;
  if (p.golf) {
    corridor(p.before, p.dead ? badTint : okTint);
    const [ex, ey] = p.before[p.before.length - 1];
    if (p.dead || p.stopped) { ctx.strokeStyle = p.dead ? bad : `rgba(${G},.85)`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ex, ey, R, 0, 7); ctx.stroke(); }
    else arrowHead(p.before, `rgba(${G},.85)`);
    return;
  }
  const ok = p.obj !== null && legalTargets().includes(p.obj);
  corridor(p.before, p.obj === null || !ok ? badTint : okTint);
  if (p.ghost) {
    ctx.strokeStyle = ok ? `rgba(${G},.95)` : bad; ctx.lineWidth = 2;
    ctx.fillStyle = `rgba(${G},.12)`; ctx.beginPath(); ctx.arc(p.ghost[0], p.ghost[1], R, 0, 7); ctx.fill(); ctx.stroke();
    const oc = ok ? `rgba(${TH.accentRGB},.95)` : bad;
    ctx.save(); if (TH.neon) { ctx.shadowColor = oc; ctx.shadowBlur = 10; }
    ctx.strokeStyle = oc; ctx.lineWidth = 3; polyline(p.objPath); arrowHead(p.objPath, oc); ctx.restore();
    if (p.cuePath.length > 1) { ctx.setLineDash([4, 6]); ctx.strokeStyle = `rgba(${G},.55)`; ctx.lineWidth = 1.8; polyline(p.cuePath); ctx.setLineDash([]); }
  } else {
    const [ex, ey] = p.before[p.before.length - 1];
    ctx.strokeStyle = bad; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ex, ey, R, 0, 7); ctx.stroke();
  }
}
function drawCue() {
  const cue = world.get(0); if (!cue.on) return;
  const dx = Math.cos(aim), dy = Math.sin(aim);
  const pull = state === 'strike' ? (1 - Math.min(1, strikeT / 0.12)) : 1;
  const back = 14 + (6 + 70 * +$('power').value) * pull;
  const sx = cue.x - dx * back, sy = cue.y - dy * back, ex = sx - dx * 520, ey = sy - dy * 520;
  ctx.lineCap = 'round';
  const Q = TH.cue;
  ctx.strokeStyle = TH.shadow; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(sx + 5, sy + 7); ctx.lineTo(ex + 5, ey + 7); ctx.stroke();
  const g = ctx.createLinearGradient(sx, sy, ex, ey);
  g.addColorStop(0, Q[0]); g.addColorStop(0.012, Q[0]); g.addColorStop(0.014, Q[1]); g.addColorStop(0.05, Q[1]);
  g.addColorStop(0.052, Q[2]); g.addColorStop(0.62, Q[3]); g.addColorStop(0.625, Q[4]); g.addColorStop(0.64, Q[5]); g.addColorStop(1, Q[6]);
  ctx.strokeStyle = g; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
  if (TH.sketch) { const nx = -dy * 4, ny = dx * 4; inkPath(ctx, [[sx + nx, sy + ny], [ex + nx, ey + ny]], false, 1.5, 0.8); inkPath(ctx, [[sx - nx, sy - ny], [ex - nx, ey - ny]], false, 1.5, 0.8); }
}
function draw(dt) {
  updCam(dt);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = TH.bg; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(...tf);
  if (cur.kind === 'golf') drawCourse(cur.hole); else drawTable();
  const hintTarget = mode === 'puzzle' && hintStep !== null && SOLUTIONS[level] ? SOLUTIONS[level][hintStep].target : null;
  if (state === 'aim' && !replay && assistLevel() === 'full' && !(mode === 'learn' && learn && learn.choice === null)) drawGuide();
  drawLearnMarks();
  const now = performance.now();
  drawAnims(now);
  const mineRing = ringTargets();
  for (const b of world.balls) if (b.on) drawBall(b.id, b.x, b.y, 1, b.id === hintTarget || mineRing.has(b.id) ? TH.accent : null, getOrient(b));
  drawBallInHand();
  if (state === 'aim' || state === 'strike') drawCue();
  drawMini();
}

// In two players, ring every ball the shooter may hit first (their group, or the black once it's cleared).
function ringTargets() {
  if (mode !== 'versus' || !vs || vs.over || (state !== 'aim' && state !== 'handover') || !vs.players[vs.turn].group) return new Set();
  return new Set(legalTargets());
}
// ---------- loop ----------
let last = performance.now(), lastSurf = null, settleT = 0;
function frame(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
  if (screen !== 'game' || !cur) { requestAnimationFrame(frame); return; }
  tickClock(dt);
  if (state === 'strike') { strikeT += dt; if (strikeT >= 0.12) release(); }
  else if (state === 'roll') {
    acc += dt; let n = 0;
    while (acc >= PHYS.DT && n < 200) { world.step(); acc -= PHYS.DT; n++; if (!world.moving()) break; }
    let sounds = 0; const now = performance.now();
    for (const e of world.events) {
      if (e.t === 'pot') startPocketDrop(e);
      else if (e.t === 'holed') startCupDrop(e);
      else if (e.t === 'coin') { chime(); renderHud(); if (!replay) bump('coins'); const c = cur.hole.coins[e.i]; fx.push({ kind: 'coin', x: c[0], y: c[1], t0: now, dur: 650 }); fx.push({ kind: 'ring', x: c[0], y: c[1], r0: 10, r1: 46, color: 'rgba(242,201,76,A)', t0: now, dur: 500 }); burst(c[0], c[1], 'rgba(255,226,120,A)', 10, 70, 2.5); }
      else if (e.t === 'dead') {
        anims.push({ kind: 'sink', x: e.x, y: e.y, o: getOrient(world.ball), t0: now, dur: 700 });
        for (let k = 0; k < 3; k++) fx.push({ kind: 'ring', x: e.x, y: e.y, r0: 18, r1: 70 + k * 25, color: 'rgba(190,225,255,A)', t0: now + k * 110, dur: 700 });
        burst(e.x, e.y, 'rgba(170,215,255,A)', 14, 90, 3); tone(500, 0.25, 0.15, 'sine', 0.3); tone(260, 0.35, 0.1, 'triangle', 0.5, 0.05);
      }
      else if (sounds++ < 3) e.t === 'ball' ? click(e.v) : thud(e.v);
    }
    world.events = [];
    // roll every moving ball; the cue ball shows its spin (draw spins backwards) until it meets a ball
    for (const b of world.balls) if (b.on) {
      const pre = cur.kind === 'pool' && b.id === 0 && world.firstContact === null;
      rollBall(getOrient(b), b.x, b.y, pre ? 1 + 1.7 * (pending ? pending.s : 0) : 1);
    }
    if (cur.kind === 'golf' && world.ball.on) {
      const sf = surfaceAt(cur.hole, world.ball.x, world.ball.y);
      if (sf === 'sand' && lastSurf !== 'sand') { burst(world.ball.x, world.ball.y, 'rgba(226,200,140,A)', 16, 60, 3); tone(300, 0.12, 0.08, 'sawtooth', 0.5); }
      lastSurf = sf;
    }
    if (!world.moving()) { state = 'settling'; settleT = 0; }
  }
  else if (state === 'settling') {
    settleT += dt;
    if (settleT > 0.25 && !anims.some(a => a.kind !== 'sink')) shotDone();
  }
  if (state === 'aim' || state === 'done') for (const b of world.balls) if (b.on) { const o = getOrient(b); o.lx = b.x; o.ly = b.y; settle(o, dt); }
  shake *= Math.exp(-dt * 12); flagKick *= Math.exp(-dt * 2.5);
  draw(dt);
  requestAnimationFrame(frame);
}

// ---------- input ----------
function toWorld(ev) {
  const r = cv.getBoundingClientRect(), k = cv.width / r.width;
  return screenToWorld((ev.clientX - r.left) * k, (ev.clientY - r.top) * k);
}
let dragging = false, placing = false;
cv.addEventListener('pointerdown', ev => {
  if (state !== 'aim' || replay) return;
  cv.setPointerCapture(ev.pointerId); audio();
  if (mode === 'versus' && vs && vs.ballInHand) {
    const [x, y] = toWorld(ev), c = world.get(0);
    if (Math.hypot(x - c.x, y - c.y) < 2.6 * R) { placing = true; return; }
  }
  dragging = true; aimAt(ev);
});
cv.addEventListener('pointermove', ev => { if (placing) { const [x, y] = toWorld(ev); tryPlaceCue(x, y); } else if (dragging) aimAt(ev); });
cv.addEventListener('pointerup', () => { dragging = false; if (placing) { placing = false; defaultAimIfPlaced(); } });
function defaultAimIfPlaced() { renderVersus(); }
// Pull back to aim: the cue follows your finger behind the cue ball, so the shot goes the other way.
function aimAt(ev) { const [x, y] = toWorld(ev), c = world.get(0); if (Math.hypot(x - c.x, y - c.y) < 4) return; aim = pullOn ? Math.atan2(c.y - y, c.x - x) : Math.atan2(y - c.y, x - c.x); updAim(); }
function nudge(deg) { if (state !== 'aim' || replay) return; aim += deg * Math.PI / 180; updAim(); tickSound(deg); }
function updAim() {
  let d = (aim * 180 / Math.PI) % 360; if (d < 0) d += 360;
  $('wheelDeg').textContent = d.toFixed(1) + '°';
  const w = $('wheel'); w.setAttribute('aria-valuenow', d.toFixed(1)); w.setAttribute('aria-valuetext', d.toFixed(1) + ' degrees');
}

// ---------- aim wheel ----------
const gear = 6; let wheelRot = 0, tickAcc = 0; // degrees of aim per full turn of the wheel
(function buildWheel() {
  const g = $('wheelRot'); let s = '';
  for (let i = 0; i < 72; i++) {
    const a = i * 5 * Math.PI / 180, long = i % 6 === 0, r1 = long ? 70 : 76, r2 = 90;
    s += `<line class="tk${long ? ' l' : ''}" x1="${(Math.sin(a) * r1).toFixed(1)}" y1="${(-Math.cos(a) * r1).toFixed(1)}" x2="${(Math.sin(a) * r2).toFixed(1)}" y2="${(-Math.cos(a) * r2).toFixed(1)}"/>`;
  }
  g.innerHTML = s;
})();
function turnWheel(deltaDeg) {
  if (state !== 'aim' || replay) return;
  wheelRot += deltaDeg; $('wheelRot').setAttribute('transform', `rotate(${wheelRot})`);
  aim += deltaDeg / 360 * gear * Math.PI / 180; updAim(); tickSound(deltaDeg / 360 * gear);
}
function tickSound(aimDeg) { tickAcc += Math.abs(aimDeg); if (tickAcc >= 0.1) { tickAcc = 0; tone(2600, 0.015, 0.03, 'square'); } }
(function wheelInput() {
  const w = $('wheel'); let lastA = null;
  const ang = ev => { const r = w.getBoundingClientRect(); return Math.atan2(ev.clientY - (r.top + r.height / 2), ev.clientX - (r.left + r.width / 2)) * 180 / Math.PI; };
  w.addEventListener('pointerdown', ev => { audio(); w.setPointerCapture(ev.pointerId); lastA = ang(ev); ev.preventDefault(); });
  w.addEventListener('pointermove', ev => { if (lastA === null) return; const a = ang(ev); let d = a - lastA; if (d > 180) d -= 360; if (d < -180) d += 360; lastA = a; turnWheel(d); });
  const end = () => lastA = null; w.addEventListener('pointerup', end); w.addEventListener('pointercancel', end);
  w.addEventListener('wheel', ev => { ev.preventDefault(); turnWheel(ev.deltaY > 0 ? 6 : -6); }, { passive: false });
  w.addEventListener('keydown', ev => {
    const step = ev.shiftKey ? 60 : 6;
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') { turnWheel(step); ev.preventDefault(); ev.stopPropagation(); }
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') { turnWheel(-step); ev.preventDefault(); ev.stopPropagation(); }
  });
})();
cv.addEventListener('wheel', ev => { if (state !== 'aim' || replay) return; ev.preventDefault(); turnWheel(ev.deltaY > 0 ? 6 : -6); }, { passive: false });
function updOutputs() { const v = +$('power').value; $('powerOut').value = Math.round(v * 100) + '%'; $('power').style.setProperty('--fill', ((v - 0.08) / 0.92 * 100) + '%'); }
$('power').oninput = updOutputs;
let spinVal = 0;
function setSpin(v) {
  spinVal = v;
  document.querySelectorAll('#spinSeg button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.spin === Math.sign(v)));
}
document.querySelectorAll('#spinSeg button').forEach(b => b.onclick = () => { if (!replay) setSpin(+b.dataset.spin); });
$('shoot').onclick = () => { if (!replay) shoot(); };
$('reset').onclick = () => mode === 'learn' ? loadDrill(learn.di, true) : mode === 'blackout' ? newBlackout() : isGolf() ? loadHole(level) : loadPuzzle(level);
$('hint').onclick = () => { if (mode === 'learn') { if (state !== 'roll') showIntro(); return; } if (state === 'aim' && !replay) showHint(); };
$('watch').onclick = startReplay;
$('map').onclick = () => { overview = !overview; $('map').setAttribute('aria-pressed', overview); $('map').textContent = overview ? 'Follow ball' : 'Whole course'; };
$('endrun').onclick = () => { if (mode !== 'survival' || state === 'roll') return; surv.lives = 1; survivalDone({ result: 'fail', reason: 'You ended the run' }); };
window.addEventListener('keydown', ev => {
  if (ev.key === 'Escape') { if (screen !== 'menu') { ev.preventDefault(); goBack(); } return; }
  if (screen !== 'game') return;
  if (ev.target.tagName === 'INPUT' && ev.key !== ' ') return;
  if (ev.key === 'ArrowLeft') { nudge(ev.shiftKey ? -1 : -0.1); ev.preventDefault(); }
  else if (ev.key === 'ArrowRight') { nudge(ev.shiftKey ? 1 : 0.1); ev.preventDefault(); }
  else if (ev.key === ' ') { if (!$('overlay').hidden) return; if (!replay) shoot(); ev.preventDefault(); }
  else if ((ev.key === 'r' || ev.key === 'R') && mode !== 'survival' && mode !== 'versus' && mode !== 'blackout') $('reset').click();
  else if ((ev.key === 'm' || ev.key === 'M') && isGolf()) $('map').click();
});
window.addEventListener('resize', () => { if (screen === 'game') { resize(); snapCam(); } else if (screen === 'menu') renderMenuArt(); else if (screen === 'settings') renderShowcase(); });

/*VERSUS*/
/*LEARN*/
/*UI*/
requestAnimationFrame(frame);
