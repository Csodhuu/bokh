// Run structure: a bracket of matches. Today it's 3 rounds (rules.bracket);
// a 9-round Naadam bracket only needs a longer bracket list in rules.json.

import { DEFAULT_DATA } from './data';
import { createMatch } from './match';
import { nextFloat, nextInt } from './rng';
import type { ActionResult, CardId, GameData, MatchState, OpponentId } from './types';

export interface MatchRecord {
  opponentId: OpponentId;
  won: boolean;
  turns: number;
}

export interface RunState {
  seed: number;
  rng: number;
  bracket: OpponentId[];
  /** Index into bracket of the current/next match. */
  round: number;
  deck: CardId[];
  playerBalance: number;
  status: 'match' | 'reward' | 'won' | 'lost';
  rewardChoices: CardId[];
  history: MatchRecord[];
  cardsPlayed: Record<CardId, number>;
}

export function createRun(seed: number, data: GameData = DEFAULT_DATA): RunState {
  return {
    seed: seed >>> 0,
    rng: seed >>> 0,
    bracket: data.rules.bracket.slice(),
    round: 0,
    deck: data.starterDeck.slice(),
    playerBalance: data.rules.maxBalance,
    status: 'match',
    rewardChoices: [],
    history: [],
    cardsPlayed: {},
  };
}

export function currentOpponent(run: RunState): OpponentId {
  const id = run.bracket[run.round];
  if (!id) throw new Error('Run has no current opponent');
  return id;
}

/** Starts the current round's match. Returns the new run (rng advanced) and the match. */
export function startRunMatch(
  run: RunState,
  data: GameData = DEFAULT_DATA,
): { run: RunState; match: ActionResult } {
  if (run.status !== 'match') throw new Error(`Cannot start match in status ${run.status}`);
  const [f, rng] = nextFloat(run.rng);
  const matchSeed = Math.floor(f * 4294967296) >>> 0;
  const match = createMatch(
    { opponentId: currentOpponent(run), deck: run.deck, seed: matchSeed, playerBalance: run.playerBalance },
    data,
  );
  return { run: { ...run, rng }, match };
}

/** Records a finished match and moves the run to reward / won / lost. */
export function completeRunMatch(run: RunState, match: MatchState, data: GameData = DEFAULT_DATA): RunState {
  if (match.phase !== 'over') throw new Error('Match is not over');
  const won = match.winner === 'player';
  const cardsPlayed = { ...run.cardsPlayed };
  for (const [id, n] of Object.entries(match.cardsPlayed)) cardsPlayed[id] = (cardsPlayed[id] ?? 0) + n;
  const history = [...run.history, { opponentId: match.opponent.id, won, turns: match.turn }];
  const next: RunState = { ...run, cardsPlayed, history, rewardChoices: [] };
  if (!won) return { ...next, status: 'lost', playerBalance: Math.max(0, match.player.balance) };

  next.playerBalance = Math.min(data.rules.maxBalance, match.player.balance + data.rules.healOnWin);
  if (run.round + 1 >= run.bracket.length) return { ...next, status: 'won' };

  // Offer N distinct random cards from the reward pool.
  const pool = data.rewardPool.slice();
  const choices: CardId[] = [];
  let rng = next.rng;
  while (choices.length < data.rules.rewardChoices && pool.length > 0) {
    let i: number;
    [i, rng] = nextInt(rng, pool.length);
    choices.push(pool.splice(i, 1)[0] as CardId);
  }
  return { ...next, rng, status: 'reward', rewardChoices: choices };
}

/** Adds the chosen reward (or nothing, if null) and advances to the next round. */
export function chooseReward(run: RunState, cardId: CardId | null): RunState {
  if (run.status !== 'reward') throw new Error('Not choosing a reward');
  if (cardId !== null && !run.rewardChoices.includes(cardId)) throw new Error(`Not a reward choice: ${cardId}`);
  return {
    ...run,
    deck: cardId ? [...run.deck, cardId] : run.deck,
    rewardChoices: [],
    round: run.round + 1,
    status: 'match',
  };
}

export function roundsWon(run: RunState): number {
  return run.history.filter((h) => h.won).length;
}

export function totalTurns(run: RunState): number {
  return run.history.reduce((a, h) => a + h.turns, 0);
}
