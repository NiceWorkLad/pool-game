// ---------- themes ----------
// Each theme drives the canvas (table, course, balls, guide, cue). The page chrome comes from the
// matching [data-theme] block of CSS tokens.
const BALL_GRAY = { 1: 214, 2: 98, 3: 152, 4: 70, 5: 186, 6: 126, 7: 50, 8: 26 };
const THEMES = {
  hall: { name: 'Pool Hall', blurb: 'Walnut rails, brass and green baize.', bg: '#12100e',
    rail: ['#5a3720', '#2a180d'], railLine: 'rgba(255,220,170,.12)', diamond: '#e8d6a8', under: '#16564a',
    cloth: ['#2a8a74', '#1f6f5e', '#154f43'], cushion: '#1a5e50', pocketRim: '#2b1a0e', pocket: ['#000', '#0d0906'], marks: 'rgba(255,255,255,.08)',
    lamp: ['rgba(255,240,200,.07)', 'rgba(0,0,0,.18)'], accent: '#d9a441', accentRGB: '217,164,65', guide: '255,255,255', bad: 'rgba(239,111,92,.9)', badRGB: '239,111,92',
    cue: ['#3d6fb0', '#f1e6cc', '#d9b77e', '#b58546', '#d9a441', '#1b1410', '#2d1a10'], fade: [18, 46, 38], balls: 'color',
    white: [250, 247, 240], ink: [16, 14, 12], cueBall: [246, 241, 230], cueDot: [196, 48, 40], shadow: 'rgba(0,0,0,.38)', font: '700 {s}px Archivo, Arial, sans-serif',
    golf: { rough: '#24553a', fair: '#2f7d4c', stripe: 'rgba(255,255,255,.04)', green: '#4aa865', fringe: '#3d9356', sand: '#d9c08a', sandEdge: '#b89a62',
      water: '#2a76a8', waterDeep: '#1a4f7c', waterEdge: '#8cc3d6', wall: '#4a2e1a', wallTop: '#6b4328', bump: '#d9a441', bumpIn: '#9e2f25',
      cupRim: '#e9e4d6', hole: '#0b0806', flag: '#ef6f5c', pole: '#f4ecd8', coin: '#e8b84a', coinEdge: '#9c7424', under: '#1d4a2f', mini: 'rgba(18,16,14,.92)' } },
  sketch: { name: 'Sketchbook', blurb: 'Pencil on paper. Black and white, drawn by hand.', bg: '#f6f3ec', sketch: true, inkCss: '#1c1b19',
    rail: ['#f6f3ec', '#f6f3ec'], railLine: null, diamond: '#1c1b19', under: '#efeadf',
    cloth: ['#fdfbf6', '#f9f6ef', '#f2ede2'], cushion: '#eee8db', pocketRim: '#1c1b19', pocket: ['#1c1b19', '#1c1b19'], marks: 'rgba(28,27,25,.25)',
    lamp: null, accent: '#1c1b19', accentRGB: '28,27,25', guide: '28,27,25', bad: 'rgba(179,38,30,.9)', badRGB: '179,38,30',
    cue: ['#1c1b19', '#fbf9f4', '#ece6d8', '#dcd4c3', '#1c1b19', '#1c1b19', '#3a3833'], fade: [246, 243, 236], balls: 'gray',
    white: [252, 250, 245], ink: [20, 19, 17], cueBall: [252, 250, 245], cueDot: [20, 19, 17], shadow: 'rgba(28,27,25,.13)', font: '400 {s}px "Patrick Hand", "Comic Sans MS", cursive',
    golf: { rough: '#ece7da', fair: '#faf7f0', stripe: 'rgba(28,27,25,.035)', green: '#fffdf9', fringe: '#f2ede1', sand: '#f3ebd7', sandEdge: '#1c1b19',
      water: '#e4e8ec', waterDeep: '#d9dee4', waterEdge: '#1c1b19', wall: '#f6f3ec', wallTop: '#1c1b19', bump: '#fbf9f4', bumpIn: '#1c1b19',
      cupRim: '#fbf9f4', hole: '#1c1b19', flag: '#1c1b19', pole: '#1c1b19', coin: '#fbf9f4', coinEdge: '#1c1b19', under: '#e8e2d4', mini: 'rgba(246,243,236,.96)' } },
  pastel: { name: 'Pastel', blurb: 'Mint cloth, candy rails, soft and light.', bg: '#f6f1fa',
    rail: ['#f8cfdd', '#eeb3c7'], railLine: 'rgba(255,255,255,.7)', diamond: '#ffffff', under: '#86ccb9',
    cloth: ['#bdeedf', '#a6e2d1', '#92d5c3'], cushion: '#95d8c6', pocketRim: '#8a7fa8', pocket: ['#3f3858', '#544b70'], marks: 'rgba(255,255,255,.45)',
    lamp: ['rgba(255,255,255,.14)', 'rgba(120,90,160,.06)'], accent: '#ff8fab', accentRGB: '240,110,145', guide: '74,64,98', bad: 'rgba(242,84,110,.9)', badRGB: '242,84,110',
    cue: ['#9fd3f5', '#ffffff', '#ffe6cc', '#f9d2aa', '#ff8fab', '#c9b8e8', '#b4a2db'], fade: [178, 228, 214], balls: 'pastel',
    white: [255, 252, 250], ink: [64, 54, 88], cueBall: [255, 252, 248], cueDot: [255, 128, 160], shadow: 'rgba(110,80,150,.2)', font: '800 {s}px Nunito, Arial, sans-serif',
    golf: { rough: '#addbaa', fair: '#c9edc0', stripe: 'rgba(255,255,255,.28)', green: '#def7d5', fringe: '#c2e8b7', sand: '#ffe3c6', sandEdge: '#f4c99e',
      water: '#acd5f7', waterDeep: '#8fc3f1', waterEdge: '#eef7ff', wall: '#d2c2ef', wallTop: '#e8def9', bump: '#ffa3ba', bumpIn: '#ffffff',
      cupRim: '#ffffff', hole: '#4a4262', flag: '#ff8fab', pole: '#ffffff', coin: '#ffd27a', coinEdge: '#efab45', under: '#9fd29b', mini: 'rgba(255,255,255,.94)' } },
  neon: { name: 'Neon Arcade', blurb: 'Midnight purple, glowing cyan and hot pink.', bg: '#07060d', neon: true, glow: '#29e7ff', glow2: '#ff3da8',
    rail: ['#16122b', '#0c0a19'], railLine: 'rgba(41,231,255,.35)', diamond: '#29e7ff', under: '#120c26',
    cloth: ['#2b1765', '#1e104a', '#140b33'], cushion: '#1d1250', pocketRim: '#ff3da8', pocket: ['#000', '#05030a'], marks: 'rgba(41,231,255,.18)',
    lamp: ['rgba(255,61,168,.07)', 'rgba(0,0,0,.25)'], accent: '#ff3da8', accentRGB: '255,61,168', guide: '41,231,255', bad: 'rgba(255,77,109,.95)', badRGB: '255,77,109',
    cue: ['#29e7ff', '#ffffff', '#2b2347', '#1c1733', '#ff3da8', '#0c0a19', '#16122b'], fade: [30, 16, 72], balls: 'color',
    white: [245, 242, 255], ink: [10, 8, 20], cueBall: [245, 242, 255], cueDot: [255, 61, 168], shadow: 'rgba(0,0,0,.55)', font: '700 {s}px "Exo 2", Arial, sans-serif',
    golf: { rough: '#0b171c', fair: '#0f2b2a', stripe: 'rgba(41,231,255,.035)', green: '#134238', fringe: '#11372f', sand: '#3a2f1c', sandEdge: '#ffd84d',
      water: '#0d2d5c', waterDeep: '#071a3a', waterEdge: '#29e7ff', wall: '#16122b', wallTop: '#ff3da8', bump: '#ff3da8', bumpIn: '#07060d',
      cupRim: '#29e7ff', hole: '#000', flag: '#ff3da8', pole: '#efeaff', coin: '#ffd84d', coinEdge: '#b8901e', under: '#09141a', mini: 'rgba(7,6,13,.94)' } },
  slate: { name: 'Slate', blurb: 'Cool ink, tournament-blue cloth, coral accent.', bg: '#0e131a',
    rail: ['#263142', '#19212d'], railLine: 'rgba(255,255,255,.06)', diamond: '#9fb0c4', under: '#1f4f7a',
    cloth: ['#3a7fb8', '#2f6ca2', '#25598a'], cushion: '#245d90', pocketRim: '#121822', pocket: ['#000', '#070a0e'], marks: 'rgba(255,255,255,.08)',
    lamp: ['rgba(255,255,255,.05)', 'rgba(0,10,30,.16)'], accent: '#ff8a5b', accentRGB: '255,138,91', guide: '255,255,255', bad: 'rgba(255,111,111,.9)', badRGB: '255,111,111',
    cue: ['#4b8fd6', '#f4f1ea', '#e4cfa4', '#c9a86e', '#ff8a5b', '#1a2230', '#2a3546'], fade: [34, 80, 122], balls: 'color',
    white: [250, 247, 240], ink: [16, 14, 12], cueBall: [246, 241, 230], cueDot: [196, 48, 40], shadow: 'rgba(0,0,0,.38)', font: '800 {s}px Manrope, Arial, sans-serif',
    golf: { rough: '#2d5b45', fair: '#4a9460', stripe: 'rgba(255,255,255,.045)', green: '#67b56f', fringe: '#579f62', sand: '#e8d3a2', sandEdge: '#cdb27c',
      water: '#3b86cf', waterDeep: '#2a68ad', waterEdge: '#a9d2f5', wall: '#2a3546', wallTop: '#3a4860', bump: '#ff8a5b', bumpIn: '#1c2532',
      cupRim: '#f4f1ea', hole: '#0b0f14', flag: '#ff8a5b', pole: '#f4f1ea', coin: '#f2c46d', coinEdge: '#c99a3e', under: '#233040', mini: 'rgba(14,19,26,.92)' } },
};
const THEME_ORDER = ['sketch', 'hall', 'pastel', 'neon', 'slate'];

// ---- hand-drawn ink (Sketchbook) ----
// Jitter is a hash of the point, so lines wobble like pen strokes but stay still between frames.
const jit = (x, y, k) => { const v = Math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453; return (v - Math.floor(v)) * 2 - 1; };
function inkPath(g, pts, closed, w = 2.2, amp = 1.8) {
  const ink = TH.inkCss || '#000';
  for (let pass = 0; pass < 2; pass++) {
    g.beginPath();
    pts.forEach(([x, y], i) => { const px = x + jit(x, y, pass + 1) * amp, py = y + jit(y, x, pass + 3) * amp; i ? g.lineTo(px, py) : g.moveTo(px, py); });
    if (closed) g.closePath();
    g.strokeStyle = ink; g.lineWidth = pass ? w * 0.55 : w; g.globalAlpha = pass ? 0.5 : 0.92; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke();
  }
  g.globalAlpha = 1;
}
function rectPts(x, y, w, h, step = 60) {
  const pts = [], edge = (x0, y0, x1, y1) => { const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step)); for (let i = 0; i < n; i++) pts.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]); };
  edge(x, y, x + w, y); edge(x + w, y, x + w, y + h); edge(x + w, y + h, x, y + h); edge(x, y + h, x, y);
  return pts;
}
function circlePts(cx, cy, r, n = 22) { const pts = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return pts; }
function hatchRect(g, x, y, w, h, gap = 12, lw = 1.2, alpha = 0.35) { // caller sets the clip
  g.save(); g.strokeStyle = TH.inkCss; g.lineWidth = lw; g.globalAlpha = alpha; g.beginPath();
  for (let k = -h; k < w; k += gap) { g.moveTo(x + k, y + h); g.lineTo(x + k + h, y); }
  g.stroke(); g.restore();
}
