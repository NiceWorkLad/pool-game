// ---------- two players: pass and play ----------
let vs = null;
function startVersus(names, breaker, pass, score = [0, 0]) {
  setMode('versus');
  vs = { players: [{ name: names[0], group: null }, { name: names[1], group: null }], turn: breaker, breaker, isBreak: true, ballInHand: 'kitchen', pass, score, over: false };
  cur = { kind: 'pool', group: 'solids', balls: makeRack(), vs: true }; world = new World(cur.balls); common();
  setSpin(0); $('power').value = 0.9; updOutputs(); defaultAim(); renderVersus(); snapCam();
  handover(`${vs.players[vs.turn].name} breaks`, 'Drag the cue ball anywhere behind the line, then break. The break hits with extra power.');
}
function rematch() { const v = vs; startVersus(v.players.map(p => p.name), 1 - v.breaker, v.pass, v.score); }
function versusNote() {
  const p = vs.players[vs.turn];
  if (vs.ballInHand === 'kitchen') return 'Ball in hand behind the line. Drag the cue ball, then break.';
  if (vs.ballInHand) return 'Ball in hand. Drag the cue ball anywhere, then shoot.';
  if (!p.group) return 'Open table. Pot any ball except the black to claim its group.';
  const left = remainingMine(world, p.group).length;
  return left ? `You're ${p.group} (${p.group === 'solids' ? '1–7' : '9–15'}), ringed on the table. ${left} left, then the black.` : 'All yours are down. Pot the black to win.';
}
function renderVersus() {
  $('pzName').textContent = `${vs.players[vs.turn].name}’s turn`;
  $('pzNote').textContent = versusNote();
  renderHud();
}
function groupChips(g) {
  const ids = g ? groupIds(g).filter(id => world.get(id) && world.get(id).on) : [];
  return ids.map(id => ballDot(id, false).outerHTML).join('');
}
function renderVersusHud(el) {
  const wrap = document.createElement('div'); wrap.className = 'players'; el.appendChild(wrap);
  vs.players.forEach((p, i) => {
    const d = document.createElement('div'); d.className = 'pl' + (i === vs.turn && !vs.over ? ' on' : '');
    d.setAttribute('aria-label', `${p.name}, ${vs.score[i]} frames, ${p.group || 'open table'}${i === vs.turn ? ', to shoot' : ''}`);
    d.innerHTML = `<b class="selectable">${p.name}</b><span class="score">${vs.score[i]}</span><span class="grp">${p.group === 'solids' ? 'Solids 1–7' : p.group === 'stripes' ? 'Stripes 9–15' : 'Open table'}</span><span class="dots">${groupChips(p.group)}</span>`;
    wrap.appendChild(d);
  });
}
function handover(title, text) {
  if (!vs.pass) { showMsg(text ? `${title}. ${text}` : title, '', 3800); return; }
  state = 'handover';
  const p = vs.players[vs.turn];
  const extra = p.group ? `<div class="group" style="justify-content:center">${groupChips(p.group) || ballDot(8, false).outerHTML}</div>` : '';
  overlay(title, text, [[`I’m ${p.name}, let’s go`, () => { $('overlay').hidden = true; state = 'aim'; }, true]], extra);
}
function versusDone() {
  const r = judgeVersus(world, vs, pending.mine);
  const p = vs.players[vs.turn], o = vs.players[1 - vs.turn], prevTurn = vs.turn;
  if (r.winner !== null) {
    state = 'done'; vs.over = true; vs.score[r.winner]++; fanfare(); renderHud(); bump('frames'); awardXP(40, 'Frame finished');
    const w = vs.players[r.winner];
    overlay(`${w.name} wins!`, `${r.reason} Frames: ${vs.players[0].name} ${vs.score[0]}, ${vs.players[1].name} ${vs.score[1]}.`,
      [['Menu', () => go('menu')], ['Rematch', rematch, true]]);
    return;
  }
  if (r.respot8) { const b = world.get(8), [x, y] = freeSpot(world, ...FOOT); b.on = true; b.x = x; b.y = y; b.vx = b.vy = 0; getOrient(b).lx = x; getOrient(b).ly = y; }
  if (r.assigned) { p.group = r.assigned; o.group = otherGroup(r.assigned); }
  if (r.cueIn) { const c = world.get(0), [x, y] = freeSpot(world, HEAD_X - 60, 250, [0, 1]); c.on = true; c.x = x; c.y = y; c.vx = c.vy = 0; const oc = getOrient(c); oc.lx = x; oc.ly = y; }
  const wasBreak = vs.isBreak; vs.isBreak = false;
  let msg;
  if (r.foul) { vs.turn = 1 - vs.turn; vs.ballInHand = true; msg = `${r.foul}. ${o.name} has ball in hand.`; buzz(); }
  else if (r.keepTurn) { vs.ballInHand = false; msg = r.assigned ? `${p.name} takes ${r.assigned}. Shoot again.` : wasBreak ? 'Good break. Shoot again.' : 'Good pot. Shoot again.'; }
  else { vs.turn = 1 - vs.turn; msg = wasBreak ? 'Nothing went down on the break.' : `${p.name} missed.`; }
  if (r.respot8) msg = 'The black went in on the break, so it’s back on its spot. ' + msg;
  state = 'aim'; predKey = ''; setSpin(0); defaultAim(); renderVersus();
  if (vs.turn !== prevTurn) handover(`${vs.players[vs.turn].name}’s turn`, msg);
  else showMsg(msg, 'good', 3200);
}
// ball in hand: drag the cue ball to any free spot (behind the line on the break)
function tryPlaceCue(x, y) {
  const c = world.get(0), lim = vs.ballInHand === 'kitchen' ? HEAD_X : T.W - R - 1;
  x = Math.max(R + 1, Math.min(lim, x)); y = Math.max(R + 1, Math.min(T.H - R - 1, y));
  if (world.balls.every(b => b.id === 0 || !b.on || Math.hypot(b.x - x, b.y - y) > 2 * R + 0.5)) {
    c.x = x; c.y = y; const o = getOrient(c); o.lx = x; o.ly = y; predKey = '';
  }
}
function drawBallInHand() {
  if (mode !== 'versus' || !vs || !vs.ballInHand || state !== 'aim') return;
  const c = world.get(0);
  ctx.save(); ctx.setLineDash([6, 6]); ctx.strokeStyle = TH.accent; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(c.x, c.y, R + 9, 0, 7); ctx.stroke();
  if (vs.ballInHand === 'kitchen') { ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(HEAD_X, 0); ctx.lineTo(HEAD_X, T.H); ctx.stroke(); }
  ctx.restore();
}
