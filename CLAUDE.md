# CLAUDE.md — Bökh prototype

Roguelite deckbuilder about Mongolian wrestling. TypeScript (strict) + Vite +
Phaser 4 + Vitest. Static site deployed to GitHub Pages.

## Commands

- `npm test` — unit tests (must pass)
- `npm run build` — `tsc --noEmit` + Vite build (must pass)
- `npm run sim` — balance simulation; run after any change to `src/data/`
- `npm run tune -- <opponentId> "[[balance,damage,guard],...]"` — grid search
- `npm run dev` — dev server; `?debug=1&seed=N` for state overlay + bot key **B**

## Architecture

```
src/core/     PURE game logic. No Phaser, no DOM, no window/localStorage.
src/data/     JSON data: cards.json, opponents.json, rules.json
src/i18n/     en.json (default), mn.json; t(key, params)
src/session.ts  view-side holder of the current RunState/MatchState
src/scenes/   Phaser scenes (Menu, Match, Reward, RunEnd, Guide) — view only
src/ui/tips.ts  pure `matchTip(state)` coaching tips (tested in tests/tips.test.ts)
src/ui/       Phaser drawing helpers
scripts/      sim.ts (greedy bot balance sim), tune.ts
tests/        Vitest
```

### Core (src/core)

- **Reducer:** `applyAction(state, action, data?) -> { state, events }`.
  Actions: `PlayCard {handIndex}`, `EndTurn`. Input state is never mutated
  (the reducer works on a `structuredClone`). Finished matches ignore actions.
- **Events** (`MatchEvent` in `types.ts`) describe what happened, in order:
  `CardPlayed`, `BalanceChanged`, `GripChanged`, `GuardChanged`,
  `GuardAbsorbed`, `PalmSave`, `AttackReversed`, `Fall`, `MatchEnded`, ...
  The Match scene replays them as tweens, then re-renders from `state`.
  The view never computes rules itself — it asks core (`playBlockReason`,
  `effectiveIntent`, `fatigueForTurn`).
- **RNG:** mulberry32; the RNG state is a uint32 inside the state, so states
  are plain serialisable data and the same seed + same actions = same match.
- **Run:** `createRun` / `startRunMatch` / `completeRunMatch` / `chooseReward`
  in `run.ts`. The bracket is `rules.bracket` — a 9-round Naadam is just a
  longer list.
- **Data:** every function takes an optional `GameData` (defaults to
  `DEFAULT_DATA` from `src/data`). Tests and the sim pass their own.

### Rules v0.1 (summary — tests are the source of truth)

- Balance ≤ 0 = fall = lose. No HP.
- Palm save: once per match, player only; lethal damage leaves balance at
  `rules.palmSaveBalance` (1). Event order: `BalanceChanged` then `PalmSave`.
- Turn: 3 energy (+ any `energyNextTurn`), draw 5, discard hand at end;
  reshuffle discard into draw when empty. Exhausted cards leave the match.
- Round order: player turn start (guard → 0, fatigue, energy, draw) → player
  cards → end turn (discard) → opponent turn (opponent guard → 0, act, advance
  pattern, reversal expires) → next player turn.
- Guard absorbs incoming damage; self-damage and fatigue ignore guard.
- Grip 0..3 shared. Cards with `requiresGrip` are blocked below it. An
  opponent attack lacking grip becomes `grip +rules.fallbackGripOnMissingGrip`
  (pattern still advances).
- Reversal: cancels the next opponent attack this round and deals its total
  damage (all hits) to the opponent.
- Knee sweep's weaken reduces the first hit of the opponent's next attack.
- Fatigue from `fatigueStartTurn` (6): `fatigueBase + floor((turn-6)/3)` to
  both, at the start of the player's turn, ignoring guard.
- Simultaneous falls (Sacrifice Throw, fatigue): lower balance loses; tie →
  player loses. Palm save is applied before this check.
- Run: balance carries over; +`healOnWin` (3) after a win, capped at max.

## Conventions

- **Keep core pure.** Nothing in `src/core` may import Phaser, scenes, i18n
  or touch the DOM. `tests/determinism.test.ts` enforces the Phaser part.
- **All numbers in data files.** Costs, damage, balances, patterns, rules
  constants live in `src/data/*.json`. Card text is generated from card data
  (`cardDescription` in `src/i18n`), so it never drifts from the numbers.
- **Every rule change needs a test.** Rule tests use the frozen fixture data
  in `tests/fixtures/` (the original v0.1 spec numbers), so balance tuning in
  `src/data` doesn't break them. If you change a *rule*, update the fixture
  only if the test needs a new card/opponent.
- **Balance changes:** run `npm run sim`, keep each opponent's greedy-bot win
  rate in 30–80%, and log the change and numbers in `BALANCE.md`.
- **i18n:** every user-facing string goes through `t()`. Add keys to both
  `en.json` and `mn.json` (a test checks MN has every EN key). Mongolian
  names are placeholders pending review by a wrestling coach.
- **Guide text** (Guide scene, tips) must take numbers from data via i18n params, never hard-code them. New mechanics need a Guide entry in both languages.
- **Mobile:** 1280×720 base, `Scale.FIT`. Keep text ≥ 15px at base size;
  important text ≥ 20px.
- Commit messages: imperative summary line, body explains why.
