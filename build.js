const fs = require('fs');
const strip = s => s.replace(/if \(typeof module[^\n]*\n?/g, '');
const golf = JSON.parse(fs.readFileSync('golf-solutions.json', 'utf8'));
const HOLES = require('./holes.js');
// par: the verified 3-star line, plus one stroke of slack
HOLES.forEach((h, i) => { const n = golf[i].line.length; h.par = n + 1; });
const lines = {}; for (const k in golf) lines[k] = golf[k].line;
let js = fs.readFileSync('game.js', 'utf8')
  .replace('/*THEMES*/', () => fs.readFileSync('themes.js', 'utf8'))
  .replace('/*VERSUS*/', () => fs.readFileSync('versus-rules.js', 'utf8') + fs.readFileSync('versus.js', 'utf8'))
  .replace('/*LEARN*/', () => fs.readFileSync('xp.js', 'utf8') + fs.readFileSync('learn.js', 'utf8').replace('/*LESSONS*/', () => fs.readFileSync('lessons.json', 'utf8')) + fs.readFileSync('blackout.js', 'utf8'))
  .replace('/*UI*/', () => fs.readFileSync('ui.js', 'utf8'))
  .replace('/*PHYSICS*/', () => strip(fs.readFileSync('physics.js', 'utf8')))
  .replace('/*PUZZLES*/', () => strip(fs.readFileSync('puzzles.js', 'utf8')))
  .replace('/*HOLES*/', () => 'const HOLES = ' + JSON.stringify(HOLES) + ';')
  .replace('/*SOLUTIONS*/', () => fs.readFileSync('solutions.json', 'utf8'))
  .replace('/*GOLFLINES*/', () => JSON.stringify(lines))
  .replace('/*RATINGS*/', () => fs.readFileSync('ratings.json', 'utf8'))
  .replace('/*SURVIVAL*/', () => JSON.stringify(JSON.parse(fs.readFileSync('survival.json', 'utf8')).map(p => ({ group: p.group, balls: p.balls, sol: p.sol }))));
const html = fs.readFileSync('template.html', 'utf8').replace('/*SCRIPT*/', () => js);
fs.writeFileSync('run-out.html', html);
if (process.argv[2]) fs.writeFileSync(process.argv[2] + '/check.js', js); // optional: the bare script, for syntax checks
console.log('built', html.length, 'pars', HOLES.map(h => h.par).join(','));
