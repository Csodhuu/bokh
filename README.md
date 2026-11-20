# Bökh — playtest prototype

A small roguelite deckbuilder based on traditional Mongolian wrestling (бөх).
This is a **test build** for playtesting with friends: one question — is a
match fun enough that you want to play again?

Plays in desktop and mobile browsers (landscape). No backend, no art assets —
everything is drawn with simple shapes.

## How to play

- **Make your opponent fall.** There is no HP. Each wrestler has **Balance**;
  at 0 you fall and lose the match.
- **Palm save.** In real bökh your palms may touch the ground — your knee,
  elbow or back may not. Once per match, a hit that would make you fall leaves
  you at 1 balance instead (“Palm touches the ground!”). Opponents don't get one.
- **Your turn.** You get 3 energy and draw 5 cards. Tap/click a card to play it
  (on a phone: first tap enlarges it, second tap plays). Unplayed cards are
  discarded when you end your turn.
- **Grip** is shared by both wrestlers: Distance → One-hand → Two-hand → Clinch.
  Throws need grip, but higher grip also lets your opponent throw *you*.
  Greyed-out cards tell you what they need.
- **Intent.** The opponent's next move is always shown at the top. If its
  attack needs more grip than there is, it grabs instead — so stepping back
  can cancel a throw.
- **Guard** absorbs balance damage and resets at the start of your next turn.
  **Reversal** cancels the opponent's attack this turn and throws its damage back.
- **Fatigue.** From turn 6 both wrestlers lose 1 balance per turn, +1 every 3
  turns after that.
- **The run.** Beat 3 opponents in a row (Village Wrestler → Elephant →
  Falcon). After each win you pick 1 of 3 new moves and recover 3 balance.
  Your balance carries over. One loss ends the run.

**In-game help:** the **Guide** button on the menu (and the **?** button during a match, which pauses it) explains the rules, grip, opponents and their patterns, defense, card combos, tactics, and lists every card. During a match a tip line under the intent panel suggests a useful move (e.g. when an attack would make you fall, or which grip a card needs).

At the end, press **Copy summary** and paste it to the developer along with
your feedback. The summary includes the seed and version, so the run can be
replayed exactly.

### Starter deck

| Card | Mongolian (placeholder) | Cost | Effect |
|---|---|---|---|
| Sleeve Grip ×3 | Ханцуй барих | 1 | Grip +1 |
| Hook ×2 | Дэгээдэх | 2 | Needs Two-hand. Deal 4 |
| Twist | Мушгих | 1 | Needs One-hand. Deal 2 |
| Lower Stance ×2 | Суудал намсгах | 1 | +3 guard |
| Reversal | Эргүүлж хаях | 2 | If the opponent attacks this turn, cancel it and deal its damage back |
| Zasuul's Slap | Засуулын алга | 0 | +1 energy next turn. Exhaust |

Reward pool: Lift and Throw (Өргөж хаях), Hip Throw (Ташаагаар хаях), Knee
Sweep (Тахимдах), Step Back (Ухрах), Leg Grab (Хөл шүүрэх), Sacrifice Throw
(Хамт унах). Exact numbers live in [`src/data/cards.json`](src/data/cards.json).

> Mongolian card and move names are placeholders, to be checked with a wrestling coach.

## URL options

| Param | Effect |
|---|---|
| `?seed=12345` | Start runs with a fixed seed (numbers used as-is, text is hashed) |
| `?lang=mn` / `?lang=en` | Force language (otherwise the menu toggle, remembered per browser) |
| `?debug=1` | Shows raw state, a seed box to restart a run, and **B** = let the bot play one action |

## Running it

Requires Node 20+.

```bash
npm install
```

```bash
npm run dev
```

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm test` | Vitest unit tests for the core rules |
| `npm run build` | Typecheck + production build into `dist/` |
| `npm run sim` | 10,000 greedy-bot matches per opponent + full runs; prints win rate, average turns, card play counts (`-- --n 2000 --seed 7` to change) |
| `npm run tune -- village "[[24,9,5],[22,8,6]]"` | Grid-search one opponent's balance / attack / guard numbers |

Balance history and reasoning: [BALANCE.md](BALANCE.md).

## Deploying

`.github/workflows/deploy.yml` runs tests, builds, and publishes `dist/` to
GitHub Pages on every push to `main`. One-time setup in the GitHub repo:
**Settings → Pages → Source: GitHub Actions**. Vite uses `base: './'`, so the
build works under `https://<user>.github.io/<repo>/`.

## Project layout

```
src/core/      pure game rules (no Phaser) — reducer, RNG, run, bot
src/data/      cards.json, opponents.json, rules.json — every tunable number
src/i18n/      en.json, mn.json
src/scenes/    Phaser scenes: Menu, Match, Reward, RunEnd, Guide
src/ui/        drawing helpers (cards, wrestlers, buttons, bars) + match tips
tests/         Vitest tests (rule tests use frozen fixture data)
scripts/       sim.ts, tune.ts
```

See [CLAUDE.md](CLAUDE.md) for architecture and conventions.
