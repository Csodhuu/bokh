import { createMatch, DEFAULT_DATA, type CardId, type GameData, type MatchState, type OpponentId } from '../src/core';

/** Starts a match and replaces the opening hand with the given cards. */
export function matchWithHand(
  hand: CardId[],
  opts: { opponent?: OpponentId; grip?: number; energy?: number; data?: GameData; seed?: number } = {},
): MatchState {
  const data = opts.data ?? DEFAULT_DATA;
  const { state } = createMatch(
    { opponentId: opts.opponent ?? 'village', deck: data.starterDeck, seed: opts.seed ?? 1 },
    data,
  );
  state.hand = hand.map((id, i) => ({ uid: 1000 + i, id }));
  if (opts.grip !== undefined) state.grip = opts.grip;
  if (opts.energy !== undefined) state.player.energy = opts.energy;
  return state;
}

/** A deep copy of the default data, safe to tweak inside a test. */
export function cloneData(): GameData {
  return structuredClone(DEFAULT_DATA);
}
