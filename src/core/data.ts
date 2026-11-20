import cards from '../data/cards.json';
import opponents from '../data/opponents.json';
import rules from '../data/rules.json';
import type { GameData } from './types';

/** The game's tunable numbers, loaded from src/data/*.json. */
export const DEFAULT_DATA: GameData = {
  rules: rules as GameData['rules'],
  cards: cards.cards as GameData['cards'],
  starterDeck: cards.starterDeck,
  rewardPool: cards.rewardPool,
  opponents: opponents as GameData['opponents'],
};

/** Throws if the data references unknown cards/opponents. Run in tests. */
export function validateData(data: GameData): void {
  const known = (id: string) => {
    if (!data.cards[id]) throw new Error(`Unknown card id in data: ${id}`);
  };
  data.starterDeck.forEach(known);
  data.rewardPool.forEach(known);
  for (const id of data.rules.bracket) {
    if (!data.opponents[id]) throw new Error(`Unknown opponent id in bracket: ${id}`);
  }
  for (const [id, opp] of Object.entries(data.opponents)) {
    if (opp.pattern.length === 0) throw new Error(`Opponent ${id} has an empty pattern`);
  }
}
