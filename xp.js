// ---------- levels & XP ----------
// Level n needs 100 + 50(n-1) XP to clear: 100, 150, 200, ... so early levels come quickly.
let xp = store.get('xp', 0);
const xpNeed = lv => 100 + 50 * (lv - 1);
function levelOf(total) { let lv = 1, rest = total; while (rest >= xpNeed(lv)) { rest -= xpNeed(lv); lv++; } return { level: lv, into: rest, need: xpNeed(lv) }; }
let xpQueue = [], xpTimer = null;
function awardXP(n, why) {
  n = Math.round(n); if (!(n > 0)) return false;
  const before = levelOf(xp).level; xp += n; store.set('xp', xp);
  const after = levelOf(xp).level;
  queueToast(`+${n} XP · ${why}`);
  if (after > before) queueToast(`Level up! You’re level ${after}`, true);
  renderLevelBits();
  return after > before;
}
function queueToast(text, big) { xpQueue.push([text, big]); $('live').textContent = text; if (!xpTimer) nextToast(); }
function nextToast() {
  const t = $('xpToast'), n = xpQueue.shift();
  if (!n) { xpTimer = null; t.classList.remove('on'); return; }
  t.textContent = n[0]; t.classList.toggle('big', !!n[1]); t.classList.add('on');
  if (n[1]) { tone(523, 0.12, 0.12, 'triangle', 0.8); tone(659, 0.12, 0.12, 'triangle', 0.8, 0.1); tone(784, 0.12, 0.12, 'triangle', 0.8, 0.2); tone(1046, 0.3, 0.14, 'triangle', 0.8, 0.3); }
  xpTimer = setTimeout(() => { t.classList.remove('on'); xpTimer = setTimeout(nextToast, 280); }, n[1] ? 2600 : 1600);
}
function renderLevelBits() {
  const L = levelOf(xp);
  $('menuLvl').textContent = `Level ${L.level}`; $('menuXp').style.width = Math.round(L.into / L.need * 100) + '%';
  $('menuProfile').setAttribute('aria-label', `Open profile. Level ${L.level}, ${L.need - L.into} XP to the next level.`);
  if (screen === 'profile') renderLevelBox();
}
function renderLevelBox() {
  const L = levelOf(xp);
  $('levelBox').innerHTML = `<div class="lvl-row"><b>Level ${L.level}</b><span>${xp} XP</span></div><div class="meter" aria-hidden="true"><i style="width:${Math.round(L.into / L.need * 100)}%"></i></div><p>${L.need - L.into} XP to level ${L.level + 1}</p>`;
}
