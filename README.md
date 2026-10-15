# Run Out

A pool game in a single HTML page: chess-style 8-ball puzzles, a Learn mode that teaches aiming, cut angles, spin and position, an endless Survival run against the clock, Blackout (36 black balls, fewest shots wins) and two-player pass-and-play 8-ball. Five themes, levels and XP, works on desktop and phones in portrait or landscape.

## Play

Open `index.html` in a browser (or play it at https://pool.whittleadams.com), or serve the folder:

```bash
npm run serve        # http://localhost:8080
```

## Build

`index.html` is generated. Edit the source files, then:

```bash
npm run build        # writes index.html
npm run check        # build + JavaScript syntax check
```

## Content pipeline

Every position in the game is verified with the same physics the game uses.

| Script | What it does |
|---|---|
| `solver.js` | Solves the hand-made puzzles, writes `solutions.json` |
| `gen2.js` | Generates graded survival positions into `bank/` (`node gen2.js <worker> <seconds> [theme]`) |
| `grade.js` | Tiers the generated positions and writes `survival.json` |
| `rate.js` | Writes `ratings.json` (puzzle and survival difficulty) |
| `genlessons.js` | Builds and verifies the Learn mode drills, writes `lessons.json` |
| `verifybank.js` | Replays every survival position to a win |
| `validate.js` | Checks the difficulty grader against published pool research |

Difficulty is a margin-of-error model: for each shot, how far the aim can be off and still succeed, turned into how often a club-level player makes the line. See `tol.js`.
