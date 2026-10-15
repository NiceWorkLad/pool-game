// ---------- screens & navigation ----------
let screen = 'menu', navStack = [];
const sessions = {};
function go(name, push = true) {
  if (push && screen !== name) navStack.push(screen);
  screen = name;
  for (const id of ['menu', 'game', 'settings', 'profile', 'versus', 'learn']) $('scr-' + id).hidden = id !== name;
  if (name === 'menu') { navStack = []; renderMenu(); }
  if (name === 'game') { resize(); snapCam(); miniKey = ''; if (cur) { renderHud(); if (mode !== 'survival') renderLevels(); } }
  if (name === 'settings') renderSettings();
  if (name === 'profile') renderProfile();
  if (name === 'versus') renderVersusSetup();
  if (name === 'learn') renderLearnList();
  window.scrollTo(0, 0);
  const h = $('scr-' + name).querySelector('h1');
  if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
}
function goBack() { go(navStack.pop() || 'menu', false); }
function startMode(m) {
  audio();
  if (m === 'learn') { go('learn'); return; }
  if (m === 'versus') { if (mode === 'versus' && vs && !vs.over && sessions.versus) go('game'); else go('versus'); return; }
  if (mode === m && sessions[m] && cur) { go('game'); return; }
  setMode(m); go('game');
}

// ---------- previews (menu art, theme cards, showcase) ----------
// Draws a small scene with the real table/course/ball painters under a given theme, then restores the game.
const SCENE_POOL = [{ id: 0, x: 300, y: 330 }, { id: 3, x: 640, y: 250 }, { id: 8, x: 760, y: 360 }, { id: 11, x: 470, y: 150 }, { id: 6, x: 860, y: 140 }, { id: 13, x: 190, y: 120 }, { id: 1, x: 560, y: 420 }];
let sr = 11; const SCENE_RACK = makeRack(() => (sr = (sr * 16807) % 2147483647) / 2147483647); SCENE_RACK[0].x = 230; SCENE_RACK[0].y = 250;
const SCENE_LEARN = [{ id: 0, x: 330, y: 330 }, { id: 3, x: 720, y: 170 }];
const SCENE_BLACK = blackoutRack();
const SCENE_SURV = [{ id: 0, x: 260, y: 250 }, { id: 8, x: 700, y: 180 }, { id: 2, x: 520, y: 330 }, { id: 12, x: 820, y: 400 }, { id: 9, x: 380, y: 110 }];
function renderPreview(cnv, key, kind, cover = false) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = cnv.clientWidth || 300, ch = cnv.clientHeight || Math.round(cw * 0.56);
  const w = Math.round(cw * dpr), h = Math.round(ch * dpr);
  if (cnv.width !== w || cnv.height !== h) { cnv.width = w; cnv.height = h; }
  const save = { ctx, tf, viewS, cur, world, ROT, TH, themeKey, aim, state, hintStep, flagKick };
  ROT = false; TH = THEMES[key]; themeKey = key; ctx = cnv.getContext('2d'); state = 'aim'; hintStep = null; flagKick = 0;
  const rest = () => ({ n: [0, 0, 1], p: [1, 0, 0], dirty: true });
  try {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = TH.bg; ctx.fillRect(0, 0, w, h);
    if (kind === 'golf') {
      const hole = HOLES[1];
      cur = { kind: 'golf', hole }; world = new GolfWorld(hole);
      const s = Math.max(w / (hole.W * 0.62), h / (hole.H * 0.62)), cx = 620, cy = 460;
      tf = [s, 0, 0, s, w / 2 - cx * s, h / 2 - cy * s]; viewS = s; ctx.setTransform(...tf);
      drawCourse(hole, world.coins);
      const b = [330, 470], t = [700, 432];
      corridor([b, t], `rgba(${TH.guide},.10)`); arrowHead([b, t], `rgba(${TH.guide},.85)`);
      aim = Math.atan2(t[1] - b[1], t[0] - b[0]); world.ball.x = b[0]; world.ball.y = b[1];
      drawBall(0, b[0], b[1], 1, null, rest()); drawCue();
    } else {
      if (kind === 'learn') {
        const balls = SCENE_LEARN; cur = { kind: 'pool', group: 'solids', balls }; world = new World(balls);
        const fw = T.W + 2 * M0, fh = T.H + 2 * M0, s = Math.max(w / fw, h / fh) * 1.04;
        tf = [s, 0, 0, s, (w - fw * s) / 2 + M0 * s, (h - fh * s) / 2 + M0 * s]; viewS = s; ctx.setTransform(...tf);
        drawTable();
        const cue = balls[0], ob = balls[1], pk = [1000, 0], d = Math.hypot(pk[0] - ob.x, pk[1] - ob.y), ux = (pk[0] - ob.x) / d, uy = (pk[1] - ob.y) / d, g = [ob.x - ux * 2 * R, ob.y - uy * 2 * R];
        ctx.save(); ctx.setLineDash([3, 8]); ctx.strokeStyle = `rgba(${TH.guide},.7)`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cue.x, cue.y); ctx.lineTo(g[0], g[1]); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(g[0], g[1]); ctx.lineTo(pk[0], pk[1]); ctx.stroke();
        ctx.setLineDash([7, 6]); ctx.strokeStyle = TH.accent; ctx.lineWidth = 3; ctx.fillStyle = `rgba(${TH.accentRGB},.12)`; ctx.beginPath(); ctx.arc(g[0], g[1], R, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore();
        for (const b of balls) drawBall(b.id, b.x, b.y, 1, null, rest());
        aim = Math.atan2(g[1] - cue.y, g[0] - cue.x); drawCue();
        return;
      }
      const rackish = kind === 'versus' || kind === 'blackout';
      const balls = kind === 'survival' ? SCENE_SURV : kind === 'versus' ? SCENE_RACK : kind === 'blackout' ? SCENE_BLACK : SCENE_POOL;
      cur = { kind: 'pool', group: rackish ? 'none' : 'solids', balls }; world = new World(balls);
      const fw = T.W + 2 * M0, fh = T.H + 2 * M0, s = cover ? Math.max(w / fw, h / fh) * 1.04 : Math.min(w / fw, h / fh);
      tf = [s, 0, 0, s, (w - fw * s) / 2 + M0 * s, (h - fh * s) / 2 + M0 * s]; viewS = s; ctx.setTransform(...tf);
      drawTable();
      const cue = balls[0], tgt = rackish ? balls.slice(1).reduce((m, b) => b.x < m.x ? b : m) : balls.find(b => b.id === (kind === 'survival' ? 2 : 3));
      const L = Math.hypot(tgt.x - cue.x, tgt.y - cue.y), dx = (tgt.x - cue.x) / L, dy = (tgt.y - cue.y) / L;
      const gx = tgt.x - dx * 2 * R, gy = tgt.y - dy * 2 * R;
      corridor([[cue.x, cue.y], [gx, gy]], `rgba(${TH.guide},.10)`);
      ctx.strokeStyle = `rgba(${TH.guide},.95)`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(gx, gy, R, 0, 7); ctx.stroke();
      const nx = (tgt.x - gx) / (2 * R), ny = (tgt.y - gy) / (2 * R), path = [[tgt.x, tgt.y], [tgt.x + nx * 170, tgt.y + ny * 170]];
      ctx.strokeStyle = `rgba(${TH.accentRGB},.95)`; ctx.lineWidth = 3; polyline(path); arrowHead(path, `rgba(${TH.accentRGB},.95)`);
      for (const b of balls) drawBall(b.id, b.x, b.y, 1, null, rest());
      aim = Math.atan2(dy, dx); drawCue();
    }
  } finally {
    ({ ctx, tf, viewS, cur, world, ROT, TH, themeKey, aim, state, hintStep, flagKick } = save);
  }
}

// ---------- menu ----------
const golfStarTotal = () => Object.values(golfStars).reduce((a, b) => a + b, 0);
const solvedCount = () => Object.keys(solved).filter(k => solved[k]).length;
function playerName() { return store.get('name', '') || 'Player'; }
function renderMenu() {
  const nm = playerName();
  $('menuName').textContent = nm; $('menuAv').textContent = nm.trim()[0].toUpperCase();
  const fresh = !solvedCount() && !golfStarTotal() && !best;
  const meta = (id, pct, text, badge) => {
    $(id).innerHTML = `${badge ? `<span><span class="badge">${badge}</span></span>` : ''}<div class="meter" aria-hidden="true"><i style="width:${Math.round(pct * 100)}%"></i></div><span>${text}</span>`;
  };
  const [lk, ln] = learnTotals();
  meta('metaLearn', lk / ln, lk ? `${lk} of ${ln} drills done` : `${LESSONS.length} lessons, ${ln} drills`, fresh && !lk ? 'Start here' : sessions.learn && mode === 'learn' && lk < ln ? 'Continue' : '');
  meta('metaPuzzle', solvedCount() / PUZZLES.length, `${solvedCount()} of ${PUZZLES.length} solved`, sessions.puzzle && mode === 'puzzle' ? 'Continue' : '');
  const runOn = sessions.survival && mode === 'survival' && surv && surv.lives > 0;
  meta('metaSurvival', Math.min(1, best / 30), best ? `Best run: ${best} cleared` : 'No runs yet', runOn ? 'Continue' : '');
  const boOn = sessions.blackout && mode === 'blackout' && bo && !bo.done && bo.shots > 0;
  meta('metaBlackout', boBest ? Math.max(0.05, Math.min(1, (90 - boBest) / 70)) : 0, boBest ? `Best: ${boBest} shots` : 'No clears yet', boOn ? 'Continue' : '');
  renderLevelBits();
  const vsOn = mode === 'versus' && vs && !vs.over && sessions.versus;
  $('metaVersus').innerHTML = vsOn ? `<span><span class="badge">Continue</span></span><span>${vs.players[0].name} ${vs.score[0]} – ${vs.score[1]} ${vs.players[1].name}</span>` : '<span>Pass and play on this device.</span>';
  renderMenuArt();
}
function renderMenuArt() { document.querySelectorAll('canvas[data-art]').forEach(c => renderPreview(c, themeKey, c.dataset.art, true)); }

// ---------- settings ----------
function applyTheme(k) {
  themeKey = k; TH = THEMES[k];
  document.documentElement.dataset.theme = k; store.set('theme', k);
  miniKey = ''; orient.forEach(o => o.dirty = true);
  document.querySelectorAll('.theme-card').forEach(c => { const on = c.dataset.theme === k; c.setAttribute('aria-checked', on); c.tabIndex = on ? 0 : -1; });
  renderShowcase();
}
function renderShowcase() {
  $('showName').textContent = THEMES[themeKey].name;
  renderPreview($('showPool'), themeKey, 'pool'); renderPreview($('showLearn'), themeKey, 'learn');
}
function setSwitch(id, on) { $(id).setAttribute('aria-checked', on ? 'true' : 'false'); }
function renderSettings() {
  const list = $('themeList');
  if (!list.children.length) {
    THEME_ORDER.forEach(k => {
      const t = THEMES[k], b = document.createElement('button');
      b.className = 'theme-card'; b.setAttribute('role', 'radio'); b.dataset.theme = k;
      b.innerHTML = `<canvas aria-hidden="true"></canvas><div class="tc-body"><strong>${t.name}<span class="tick" aria-hidden="true">✓</span></strong><span>${t.blurb}</span></div>`;
      b.onclick = () => applyTheme(k);
      b.onkeydown = ev => {
        const i = THEME_ORDER.indexOf(k), d = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0;
        if (!d) return; ev.preventDefault(); const nk = THEME_ORDER[(i + d + THEME_ORDER.length) % THEME_ORDER.length];
        applyTheme(nk); list.querySelector(`[data-theme="${nk}"]`).focus();
      };
      list.appendChild(b);
    });
  }
  // each card is drawn in its own theme so you can compare them side by side
  list.querySelectorAll('.theme-card').forEach(c => {
    const on = c.dataset.theme === themeKey; c.setAttribute('aria-checked', on); c.tabIndex = on ? 0 : -1;
    renderPreview(c.querySelector('canvas'), c.dataset.theme, 'pool');
  });
  setSwitch('setSound', soundOn); setSwitch('setShake', shakeOn); setSwitch('setFade', fadeOn); setSwitch('setPull', pullOn);
  renderShowcase();
}
$('setSound').onclick = () => { soundOn = !soundOn; store.set('sound', soundOn); setSwitch('setSound', soundOn); if (soundOn) { audio(); chime(); } };
$('setPull').onclick = () => { pullOn = !pullOn; store.set('pull', pullOn); setSwitch('setPull', pullOn); $('aimHelp').firstChild.textContent = pullOn ? 'Drag behind the cue ball to aim, turn the wheel to fine-tune. ' : 'Tap where you want to hit, turn the wheel to fine-tune. '; };
$('setShake').onclick = () => { shakeOn = !shakeOn; store.set('shake', shakeOn); setSwitch('setShake', shakeOn); };
$('setFade').onclick = () => { fadeOn = !fadeOn; store.set('fade', fadeOn); setSwitch('setFade', fadeOn); orient.forEach(o => o.dirty = true); renderShowcase(); };

// ---------- profile ----------
function renderProfile() {
  const nm = store.get('name', '');
  $('profName').value = nm; $('profAv').textContent = (nm || 'Player').trim()[0].toUpperCase();
  const tile = (value, label, pct) => `<div class="stat"><b>${value}</b><span>${label}</span>${pct !== undefined ? `<div class="meter" aria-hidden="true"><i style="width:${Math.round(pct * 100)}%"></i></div>` : ''}</div>`;
  $('stats').innerHTML = [
    tile(`${solvedCount()}/${PUZZLES.length}`, 'Puzzles solved', solvedCount() / PUZZLES.length),
    tile(`${learnTotals()[0]}/${learnTotals()[1]}`, 'Learn drills done', learnTotals()[0] / learnTotals()[1]),
    tile(best, 'Best survival run'),
    tile(boBest || '–', 'Best Blackout (shots)'),
    tile(stats.shots, 'Shots played'),
    tile(stats.pots, 'Balls potted'),
    tile(stats.runs, 'Survival runs'),
    tile(stats.frames, 'Two-player frames'),
    tile(stats.blackouts, 'Blackout clears'),
  ].join('');
  renderLevelBox(); resetIdle();
}
$('profName').addEventListener('input', () => {
  const v = $('profName').value.slice(0, 20); store.set('name', v.trim());
  $('profAv').textContent = (v.trim() || 'Player')[0].toUpperCase();
});
function resetIdle() { $('resetRow').innerHTML = '<button class="b warn" id="resetAsk">Reset progress</button>'; $('resetAsk').onclick = resetConfirm; }
function resetConfirm() {
  $('resetRow').innerHTML = '<span>This can’t be undone.</span><button class="b" id="resetNo">Cancel</button><button class="b warn-solid" id="resetYes">Reset everything</button>';
  $('resetNo').onclick = () => { resetIdle(); $('resetAsk').focus(); };
  $('resetYes').onclick = () => {
    solved = {}; golfStars = {}; best = 0; xp = 0; learnProg = {}; boBest = 0; for (const k in stats) stats[k] = 0;
    store.set('solved', solved); store.set('golf', golfStars); store.set('best', 0); store.set('stats', stats); store.set('xp', 0); store.set('learn', {}); store.set('boBest', 0);
    renderLevelBits();
    for (const k in sessions) delete sessions[k];
    renderProfile(); showMsg('Progress reset.');
    $('resetRow').insertAdjacentHTML('afterbegin', '<span role="status">Progress reset.</span>');
  };
  $('resetNo').focus();
}

// ---------- two player setup ----------
let vsBreak = 'r';
function renderVersusSetup() {
  $('vsName1').value = store.get('p1name', '') || store.get('name', '') || 'Player 1';
  $('vsName2').value = store.get('p2name', '') || 'Player 2';
  setSwitch('vsPass', store.get('pass', true));
  markBreak();
}
function markBreak() { document.querySelectorAll('#vsBreak button').forEach(b => b.setAttribute('aria-pressed', b.dataset.b === vsBreak)); }
document.querySelectorAll('#vsBreak button').forEach(b => b.onclick = () => { vsBreak = b.dataset.b; markBreak(); });
$('vsPass').onclick = () => { const on = $('vsPass').getAttribute('aria-checked') !== 'true'; store.set('pass', on); setSwitch('vsPass', on); };
$('vsStart').onclick = () => {
  audio();
  const n1 = $('vsName1').value.trim() || 'Player 1', n2 = $('vsName2').value.trim() || 'Player 2';
  store.set('p1name', n1); store.set('p2name', n2);
  const br = vsBreak === 'r' ? (Math.random() < 0.5 ? 0 : 1) : +vsBreak;
  const keep = vs && vs.players[0].name === n1 && vs.players[1].name === n2 ? vs.score : [0, 0];
  startVersus([n1, n2], br, store.get('pass', true), keep);
  navStack = []; go('game', false); navStack = ['menu'];
};
$('newMatch').onclick = () => go('versus');

// ---------- wiring ----------
document.querySelectorAll('.mode-card').forEach(b => b.onclick = () => startMode(b.dataset.mode));
$('menuSettings').onclick = () => go('settings');
$('menuProfile').onclick = $('menuProfile2').onclick = () => go('profile');
$('gameBack').onclick = () => mode === 'learn' ? (navStack[navStack.length - 1] === 'learn' ? goBack() : go('learn')) : go('menu');
$('gameSettings').onclick = () => go('settings');
document.querySelectorAll('[data-back]').forEach(b => b.onclick = goBack);

document.documentElement.dataset.theme = themeKey;
updOutputs();
if (!pullOn) $('aimHelp').firstChild.textContent = 'Tap where you want to hit, turn the wheel to fine-tune. ';
go('menu', false);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (screen === 'menu') renderMenuArt(); if (screen === 'settings') renderSettings(); });
