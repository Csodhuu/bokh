import { createMatch, type CardId, type GameData, type MatchState, type OpponentId } from '../src/core';
import cards from './fixtures/cards.json';
import opponents from './fixtures/opponents.v01.json';
import rules from './fixtures/rules.json';

/**
 * Frozen copy of the game data (the original v0.1 spec numbers) used by rule
 * tests, so balance tuning in src/data/*.json never breaks rule tests.
 */
export const TEST_DATA: GameData = {
  rules: rules as GameData['rules'],
  cards: cards.cards as GameData['cards'],
  starterDeck: cards.starterDeck,
  rewardPool: cards.rewardPool,
  opponents: opponents as GameData['opponents'],
};

/** Starts a match and replaces the opening hand with the given cards. */
export function matchWithHand(
  hand: CardId[],
  opts: { opponent?: OpponentId; grip?: number; energy?: number; data?: GameData; seed?: number } = {},
): MatchState {
  const data = opts.data ?? TEST_DATA;
  const { state } = createMatch(
    { opponentId: opts.opponent ?? 'village', deck: data.starterDeck, seed: opts.seed ?? 1 },
    data,
  );
  state.hand = hand.map((id, i) => ({ uid: 1000 + i, id }));
  if (opts.grip !== undefined) state.grip = opts.grip;
  if (opts.energy !== undefined) state.player.energy = opts.energy;
  return state;
}

/** A deep copy of the test data, safe to tweak inside a test. */
export function cloneData(): GameData {
  return structuredClone(TEST_DATA);
}
