// ---------- Learn mode ----------
// Lessons are built and verified offline (genlessons.js): every drill's ghost-ball aim really pots the ball,
// every zone is reachable, and each drill carries its measured margin of error for the feedback text.
const LESSONS = /*LESSONS*/;
const LEARN_AIM = [[0, 0], [500, 0], [1000, 0], [0, 500], [500, 500], [1000, 500]];
const ASSIST_NAMES = { full: 'Full guide', ghost: 'Ghost ball', cue: 'No help' };
let learnProg = store.get('learn', {});
let learn = null; // { li, di, stage, tries, choice, boost }
const drillKey = (li, di) => LESSONS[li].id + ':' + di;
const lessonCount = li => LESSONS[li].drills.filter((d, di) => learnProg[drillKey(li, di)]).length;
const learnTotals = () => { let n = 0, k = 0; LESSONS.forEach((l, li) => { n += l.drills.length; k += lessonCount(li); }); return [k, n]; };
const spinWord = s => s < 0 ? 'draw' : s > 0 ? 'follow' : 'stun';

function renderLearnList() {
  const box = $('learnList'); box.innerHTML = '';
  LESSONS.forEach((l, li) => {
    const n = l.drills.length, k = lessonCount(li);
    const b = document.createElement('button'); b.className = 'lesson' + (k === n ? ' done' : '');
    b.setAttribute('aria-label', `Lesson ${li + 1}, ${l.title}. ${l.blurb} ${k} of ${n} drills done.`);
    b.innerHTML = `<span class="num" aria-hidden="true">${k === n ? '✓' : li + 1}</span><span class="lt"><strong>${l.title}</strong><span>${l.blurb}</span></span><span class="lp" aria-hidden="true"><span>${k}/${n}</span><span class="meter"><i style="width:${Math.round(k / n * 100)}%"></i></span></span>`;
    b.onclick = () => openLesson(li);
    box.appendChild(b);
  });
  const [k, n] = learnTotals(); $('learnSum').textContent = k ? `${k} of ${n} drills done.` : `${LESSONS.length} lessons, ${n} drills.`;
}
function openLesson(li) {
  audio(); setMode('learn');
  const l = LESSONS[li]; let di = l.drills.findIndex((d, i) => !learnProg[drillKey(li, i)]); if (di < 0) di = 0;
  learn = { li, di, stage: 1, tries: 0, choice: null, boost: false };
  loadDrill(di); go('game');
  if (di === 0) showIntro();
}
function showIntro() {
  const l = LESSONS[learn.li];
  overlay(`Lesson ${learn.li + 1}. ${l.title}`, '', [['Start', () => { $('overlay').hidden = true; }, true]],
    `<div class="intro">${l.intro.map(p => `<p>${p}</p>`).join('')}</div>`, true);
}
function loadDrill(di, retry = false) {
  const l = LESSONS[learn.li], d = l.drills[di];
  if (!retry) { learn.tries = 0; learn.boost = false; learn.choice = null; }
  learn.di = di; learn.stage = 1; level = di;
  if (d.kind !== 'choice') learn.choice = -1;
  cur = { kind: 'pool', group: d.group || 'solids', balls: d.balls, sol: d.sol, learn: d }; world = new World(d.balls); common();
  $('tag').textContent = l.title;
  $('pzName').textContent = `${di + 1}. ${d.title}`; $('pzNote').textContent = d.text;
  setSpin(0); defaultAim(); renderLevels(); renderHud(); snapCam();
}
function learnTarget() {
  const d = cur.learn;
  if (d.kind === 'choice') { const o = d.options[d.answer]; return { target: o.target, pocket: o.pocket }; }
  if (learn.stage === 2 && d.next) return { target: d.next.id, pocket: d.next.pocket, any: true };
  return { target: d.target, pocket: d.pocket };
}
function assistLevel() { if (mode !== 'learn' || !cur || !cur.learn) return 'full'; return replay ? 'full' : cur.learn.assist; }
function ghostFor(t) { const b = world.get(t.target); if (!b || !b.on) return null; const [px, py] = LEARN_AIM[t.pocket], d = Math.hypot(px - b.x, py - b.y); return [b.x - (px - b.x) / d * 2 * R, b.y - (py - b.y) / d * 2 * R]; }
function idealAim(t) { const g = ghostFor(t), c = world.get(0); return g ? Math.atan2(g[1] - c.y, g[0] - c.x) : null; }
function learnPending(p) {
  if (cur.learn.kind === 'run') return;
  const t = learnTarget(), b = world.get(t.target), c = world.get(0);
  p.t = t; p.ideal = idealAim(t); p.ob0 = b ? [b.x, b.y] : null; p.cue0 = [c.x, c.y];
}

// ---- drawing: pocket ring, zone, ghost ball, plain aim line, choice labels ----
function drawAimLine(len) {
  const c = world.get(0); if (!c.on) return;
  const dx = Math.cos(aim), dy = Math.sin(aim);
  ctx.save(); ctx.setLineDash([3, 7]); ctx.strokeStyle = `rgba(${TH.guide},.6)`; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(c.x + dx * R, c.y + dy * R); ctx.lineTo(c.x + dx * (R + len), c.y + dy * (R + len)); ctx.stroke(); ctx.restore();
}
function badge(x, y, text) {
  ctx.save(); ctx.fillStyle = TH.accent; ctx.beginPath(); ctx.arc(x, y, 17, 0, 7); ctx.fill();
  ctx.fillStyle = TH.sketch ? TH.bg : '#fff'; ctx.font = (TH.font || '700 {s}px sans-serif').replace('{s}', 20); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const rot = ROT ? -Math.PI / 2 : 0; ctx.translate(x, y); ctx.rotate(rot); ctx.fillText(text, 0, 1); ctx.restore();
}
function pocketRing(p, strong = true) {
  const [x, y] = POCKETS[p];
  ctx.save(); ctx.strokeStyle = TH.accent; ctx.lineWidth = strong ? 3.5 : 2; ctx.setLineDash(strong ? [] : [5, 5]);
  ctx.beginPath(); ctx.arc(x, y, 40, 0, 7); ctx.stroke(); ctx.restore();
}
function drawLearnMarks() {
  if (mode !== 'learn' || !cur || !cur.learn) return;
  const d = cur.learn, a = assistLevel(), aiming = state === 'aim' && !replay;
  if (d.kind === 'run') { if (aiming && a !== 'full') drawAimLine(a === 'cue' ? 70 : 900); return; }
  if (d.zone && learn.stage === 1) {
    const z = d.zone; ctx.save();
    ctx.fillStyle = `rgba(${TH.accentRGB},.13)`; ctx.strokeStyle = TH.accent; ctx.lineWidth = 2.5; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 7); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(z.x - 6, z.y); ctx.lineTo(z.x + 6, z.y); ctx.moveTo(z.x, z.y - 6); ctx.lineTo(z.x, z.y + 6); ctx.stroke(); ctx.restore();
  }
  if (d.kind === 'choice' && learn.choice === null) {
    d.options.forEach(o => {
      const b = world.get(o.target), [px, py] = LEARN_AIM[o.pocket], ux = b.x - px, uy = b.y - py, L = Math.hypot(ux, uy);
      ctx.save(); ctx.setLineDash([4, 6]); ctx.strokeStyle = `rgba(${TH.accentRGB},.75)`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(px, py); ctx.stroke(); ctx.restore();
      pocketRing(o.pocket, false); badge(px + ux / L * 62, py + uy / L * 62, o.label);
    });
    if (aiming) drawAimLine(70);
    return;
  }
  const t = learnTarget();
  if (!t.any) pocketRing(t.pocket);
  if (!aiming) return;
  if (a !== 'full') drawAimLine(a === 'cue' ? 70 : 900);
  if (a === 'ghost' || learn.boost) {
    const g = ghostFor(t); if (!g) return; const b = world.get(t.target), [px, py] = LEARN_AIM[t.pocket];
    ctx.save(); ctx.strokeStyle = `rgba(${TH.guide},.4)`; ctx.lineWidth = 1.4; ctx.setLineDash([2, 6]);
    ctx.beginPath(); ctx.moveTo(g[0], g[1]); ctx.lineTo(px, py); ctx.stroke();
    ctx.setLineDash([6, 5]); ctx.strokeStyle = TH.accent; ctx.lineWidth = 2.5; ctx.fillStyle = `rgba(${TH.accentRGB},.10)`;
    ctx.beginPath(); ctx.arc(g[0], g[1], R, 0, 7); ctx.fill(); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = TH.accent; ctx.beginPath(); ctx.arc(g[0], g[1], 2.5, 0, 7); ctx.fill(); ctx.restore();
  }
}

// ---- HUD ----
function renderLearnHud(el) {
  const d = cur.learn, n = LESSONS[learn.li].drills.length;
  const s = document.createElement('span'); s.innerHTML = `Drill <b>${learn.di + 1}/${n}</b>`; el.appendChild(s);
  const a = document.createElement('span'); a.textContent = learn.boost && d.assist !== 'full' ? 'Ghost ball shown' : ASSIST_NAMES[d.assist]; a.className = 'assist'; el.appendChild(a);
  if (d.kind === 'choice' && learn.choice === null) {
    const w = document.createElement('span'); w.className = 'choices';
    d.options.forEach((o, i) => { const b = document.createElement('button'); b.className = 'b shoot'; b.textContent = `Pick ${o.label}`; b.onclick = () => answerChoice(i); w.appendChild(b); });
    el.appendChild(w);
  }
}
function answerChoice(i) {
  audio(); const d = cur.learn, o = d.options, good = o[d.answer], other = o[1 - d.answer];
  learn.choice = i; renderHud(); predKey = '';
  const right = i === d.answer;
  right ? chime() : buzz();
  const why = `${good.label} gives you about ±${good.half}° of aim to play with. ${other.label} gives about ±${other.half}°.`;
  overlay(right ? `Yes, ${good.label}` : `It’s ${good.label}`, `${why} ${d.tip}`, [[`Pot it into ${good.label}`, () => { $('overlay').hidden = true; defaultAim(); }, true]]);
}

// ---- after the shot ----
function learnDone() {
  const d = cur.learn, w = world, c = w.get(0);
  renderHud();
  let ok = false, why = '';
  if (d.kind === 'run') {
    const j = judge(w, cur.group, pending.mine);
    if (j.result === 'continue') {
      if (replay) { state = 'wait'; setTimeout(nextReplay, 700); return; }
      state = 'aim'; const left = remainingMine(w, cur.group).length;
      showMsg(left ? `Good pot. ${left} to go, then the black.` : 'Good pot. Now the black.', 'good'); defaultAim(); return;
    }
    ok = j.result === 'win'; why = ok ? '' : j.reason + '.';
  } else {
    const t = pending.t, b = w.get(t.target);
    ok = !b.on && (t.any || b.pocket === t.pocket) && w.firstContact === t.target && c.on;
    const inZone = d.zone ? Math.hypot(c.x - d.zone.x, c.y - d.zone.y) < d.zone.r : true;
    if (ok && learn.stage === 1 && d.zone && !inZone) { ok = false; why = zoneFeedback(); }
    else if (!ok) why = potFeedback(t);
    if (ok && learn.stage === 1 && d.next) {
      learn.stage = 2; chime();
      $('pzNote').textContent = `In the circle. Now pot the ${d.next.id}.`;
      if (replay) { state = 'wait'; setTimeout(nextReplay, 700); return; }
      state = 'aim'; showMsg(`In the circle. Now pot the ${d.next.id}.`, 'good', 3000); defaultAim(); return;
    }
  }
  if (replay) {
    state = 'done'; replay = null;
    overlay(ok ? 'That’s the shot' : 'The replay drifted', ok ? watchedText(d) : 'Try it yourself.', [['Try it', () => loadDrill(learn.di, true), true]]);
    return;
  }
  state = 'done';
  if (ok) {
    const was = learnProg[drillKey(learn.li, learn.di)];
    learnProg[drillKey(learn.li, learn.di)] = true; store.set('learn', learnProg);
    if (!was) { bump('drills'); awardXP(25, 'New drill'); if (LESSONS[learn.li].drills.every((x, i) => learnProg[drillKey(learn.li, i)])) awardXP(75, 'Lesson complete'); }
    fanfare(); renderLevels();
    const L = LESSONS[learn.li], nextDi = L.drills.findIndex((x, i) => i > learn.di && !learnProg[drillKey(learn.li, i)]);
    const allDone = L.drills.every((x, i) => learnProg[drillKey(learn.li, i)]);
    if (nextDi >= 0) overlay('Nice', d.tip, [['Again', () => loadDrill(learn.di)], ['Next drill', () => loadDrill(nextDi), true]]);
    else if (!allDone) { const gap = L.drills.findIndex((x, i) => !learnProg[drillKey(learn.li, i)]); overlay('Nice', d.tip, [['Again', () => loadDrill(learn.di)], ['Next drill', () => loadDrill(gap), true]]); }
    else if (learn.li + 1 < LESSONS.length) overlay('Lesson complete', d.tip, [['Lessons', () => go('learn')], ['Next lesson', () => openLesson(learn.li + 1), true]]);
    else overlay('Course complete', `${d.tip} Every lesson done.`, [['Lessons', () => go('learn')], ['Play Survival', () => { setMode('survival'); navStack = ['menu']; go('game', false); }, true]]);
  } else {
    buzz(); learn.tries++;
    const btns = [['Try again', () => loadDrill(learn.di, true), true]];
    if (learn.tries >= 2) btns.unshift(['Show me', startReplay]);
    if (learn.tries >= 2 && d.assist === 'cue' && !learn.boost && d.kind !== 'run') btns.unshift(['Show ghost ball', () => { loadDrill(learn.di, true); learn.boost = true; renderHud(); }]);
    if (learn.tries >= 2 && d.kind !== 'run') why += ` This one wants about ${Math.round(d.sol[learn.stage === 2 ? 1 : 0].pow * 100)}% power with ${spinWord(d.sol[learn.stage === 2 ? 1 : 0].spin)}.`;
    overlay('Not quite', why, btns);
  }
}
function watchedText(d) {
  const s = d.sol[0]; return `${Math.round(s.pow * 100)}% power with ${spinWord(s.spin)}.${d.half ? ` This shot allows about ±${d.half}° of aim.` : ''} Now you try.`;
}
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
function potFeedback(t) {
  const w = world, c = w.get(0), b = w.get(t.target), fc = w.firstContact, d = cur.learn;
  const name = id => id === 8 ? 'black' : 'the ' + id;
  if (fc === null) return 'The cue ball missed everything.';
  if (fc !== t.target) return `You hit ${name(fc)} first. The ${t.target} has to be the first ball the cue ball touches.`;
  if (!b.on && c.on && !t.any && b.pocket !== t.pocket) return 'It went in, but not in the ringed pocket. Aim for that one.';
  if (!b.on && !c.on) return 'The ball went in, but so did the cue ball. Use less power, or stun or draw to hold the cue ball back.';
  if (!c.on) return 'The cue ball went in a pocket. Use less power, or change the spin.';
  // ball missed: compare where it went with where it needed to go
  const k = w.contact; if (!k || pending.ideal === null) return 'Missed.';
  const [px, py] = LEARN_AIM[t.pocket];
  const need = Math.atan2(py - k.oy, px - k.ox), went = Math.atan2(k.oy - k.y, k.ox - k.x), cueDir = pending.a;
  const thetaNeed = Math.abs(angDiff(need, cueDir)), thetaWent = Math.abs(angDiff(went, cueDir));
  const obErr = Math.abs(angDiff(went, need)) * 180 / Math.PI, aimErr = Math.abs(angDiff(pending.a, pending.ideal)) * 180 / Math.PI;
  const room = d.half ? ` This shot allows about ±${d.half}°.` : '';
  if (obErr < 1.2) {
    const ob0 = pending.ob0, total = Math.hypot(px - ob0[0], py - ob0[1]), left = Math.hypot(px - b.x, py - b.y);
    if (left < total) return `Right line, but it stopped short or rattled in the jaws. ${left > 60 ? 'Hit it a little harder.' : 'A touch more pace.'}`;
  }
  const thin = thetaWent > thetaNeed;
  return `Too ${thin ? 'thin' : 'thick'}: you ${thin ? 'cut it too much' : 'hit it too full'}. Your aim was ${aimErr.toFixed(1)}° off.${room} Aim a touch ${thin ? 'fuller' : 'thinner'}.`;
}
function zoneFeedback() {
  const d = cur.learn, c = world.get(0), z = d.zone, k = world.contact, want = d.sol[0];
  const bw = n => { const v = Math.max(0.5, Math.round(n / (2 * R) * 2) / 2); return `${v} ball-width${v === 1 ? '' : 's'}`; };
  const off = Math.hypot(c.x - z.x, c.y - z.y) - z.r;
  const spinTip = pending.s !== want.spin ? ` This one needs ${spinWord(want.spin)}.` : '';
  if (!k) return 'Potted, but the cue ball missed the circle.';
  const dz = Math.hypot(z.x - k.x, z.y - k.y), dc = Math.hypot(c.x - k.x, c.y - k.y);
  if (dc < dz - z.r * 0.6) return `Potted, but the cue ball stopped ${bw(off)} short. A little more power.${spinTip}`;
  if (dc > dz + z.r * 0.6) return `Potted, but the cue ball ran ${bw(off)} too far. A little less power.${spinTip}`;
  return `Potted, and the distance was right, but the cue ball went the wrong way.${spinTip || ' Check your aim: a small change in the cut changes where the cue ball goes.'}`;
}
function renderLearnLevels(nav) {
  const L = LESSONS[learn.li];
  L.drills.forEach((d, i) => {
    const b = document.createElement('button'), done = learnProg[drillKey(learn.li, i)];
    b.className = 'lv' + (done ? ' solved' : ''); b.textContent = i + 1; b.title = d.title;
    b.setAttribute('aria-current', i === learn.di ? 'true' : 'false');
    b.setAttribute('aria-label', `Drill ${i + 1}, ${d.title}${done ? ', done' : ''}`);
    b.onclick = () => { audio(); loadDrill(i); };
    nav.appendChild(b);
  });
}
