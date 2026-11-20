// Balance simulator: `npm run sim [-- --n 10000 --seed 1]`
// Plays N matches of the greedy bot (starter deck, full balance) against each
// opponent, then N full runs with random reward picks, and prints stats.

import { pathToFileURL } from 'node:url';
import {
  applyAction,
  chooseBotAction,
  chooseReward,
  completeRunMatch,
  createMatch,
  createRun,
  DEFAULT_DATA,
  nextFloat,
  nextInt,
  startRunMatch,
  type GameData,
  type MatchState,
} from '../src/core';

const MAX_ACTIONS = 1000;

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(v) ? v : fallback;
}

function playMatch(state: MatchState, data: GameData): MatchState {
  let s = state;
  for (let i = 0; i < MAX_ACTIONS && s.phase !== 'over'; i++) {
    s = applyAction(s, chooseBotAction(s, data), data).state;
  }
  if (s.phase !== 'over') throw new Error('Match did not finish (fatigue should guarantee it)');
  return s;
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export function simulate(n: number, baseSeed: number, data: GameData = DEFAULT_DATA) {
  const rows: { opponent: string; winRate: number; avgTurns: number; palmSaves: number }[] = [];
  const cardTotals: Record<string, number> = {};
  for (const opponentId of Object.keys(data.opponents)) {
    let wins = 0;
    let turns = 0;
    let palm = 0;
    let rng = (baseSeed ^ opponentId.length * 0x9e3779b9) >>> 0;
    for (let i = 0; i < n; i++) {
      let f: number;
      [f, rng] = nextFloat(rng);
      const seed = Math.floor(f * 4294967296) >>> 0;
      const start = createMatch({ opponentId, deck: data.starterDeck, seed }, data).state;
      const end = playMatch(start, data);
      if (end.winner === 'player') wins++;
      if (end.player.palmSaveUsed) palm++;
      turns += end.turn;
      for (const [id, c] of Object.entries(end.cardsPlayed)) cardTotals[id] = (cardTotals[id] ?? 0) + c;
    }
    rows.push({ opponent: opponentId, winRate: wins / n, avgTurns: turns / n, palmSaves: palm / n });
  }

  // Full runs with a random reward pick each time.
  let runWins = 0;
  const roundsReached: number[] = [];
  let rng = baseSeed >>> 0;
  for (let i = 0; i < n; i++) {
    let f: number;
    [f, rng] = nextFloat(rng);
    let run = createRun(Math.floor(f * 4294967296) >>> 0, data);
    while (run.status === 'match') {
      const started = startRunMatch(run, data);
      run = completeRunMatch(started.run, playMatch(started.match.state, data), data);
      if (run.status === 'reward') {
        let k: number;
        [k, rng] = nextInt(rng, run.rewardChoices.length);
        run = chooseReward(run, run.rewardChoices[k] ?? null);
      }
    }
    if (run.status === 'won') runWins++;
    const won = run.history.filter((h) => h.won).length;
    roundsReached[won] = (roundsReached[won] ?? 0) + 1;
  }
  return { rows, cardTotals, runWinRate: runWins / n, roundsReached };
}

function main() {
  const n = arg('n', 10000);
  const seed = arg('seed', 1);
  const t0 = Date.now();
  const { rows, cardTotals, runWinRate, roundsReached } = simulate(n, seed);

  console.log(`\nBökh balance sim — ${n} matches per opponent, greedy bot, starter deck, seed ${seed}\n`);
  console.log('opponent    win rate   avg turns   palm save used   in 30–80%?');
  for (const r of rows) {
    const ok = r.winRate >= 0.3 && r.winRate <= 0.8 ? 'yes' : 'NO';
    console.log(
      `${r.opponent.padEnd(11)} ${pct(r.winRate).padStart(8)}   ${r.avgTurns.toFixed(2).padStart(9)}   ${pct(r.palmSaves).padStart(14)}   ${ok}`,
    );
  }

  const total = Object.values(cardTotals).reduce((a, b) => a + b, 0);
  console.log('\nCards played (all single matches):');
  for (const [id, c] of Object.entries(cardTotals).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${id.padEnd(15)} ${String(c).padStart(8)}  ${pct(c / total).padStart(6)}  (${(c / (n * rows.length)).toFixed(2)} / match)`);
  }

  console.log(`\nFull 3-match runs (random reward picks): run win rate ${pct(runWinRate)}`);
  console.log(
    '  matches won before the run ended: ' +
      roundsReached.map((c, i) => `${i}: ${pct((c ?? 0) / n)}`).join(', '),
  );
  console.log(`\n(${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);
}

// Only run when executed directly (not when imported by other scripts).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
