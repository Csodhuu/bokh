// A simple greedy bot used by the balance simulator (scripts/sim.ts).
// It scores each playable card with a few heuristics and plays the best one
// until nothing scores above zero, then ends the turn.

import { DEFAULT_DATA } from './data';
import { cardDef, effectiveIntent, playBlockReason } from './match';
import type { GameData, MatchAction, MatchState } from './types';

export function chooseBotAction(state: MatchState, data: GameData = DEFAULT_DATA): MatchAction {
  let best = -Infinity;
  let bestIndex = -1;
  for (let i = 0; i < state.hand.length; i++) {
    if (playBlockReason(state, i, data)) continue;
    const score = scoreCard(state, i, data);
    if (score > best) {
      best = score;
      bestIndex = i;
    }
  }
  if (bestIndex >= 0 && best > 0) return { type: 'PlayCard', handIndex: bestIndex };
  return { type: 'EndTurn' };
}

function scoreCard(state: MatchState, handIndex: number, data: GameData): number {
  const card = state.hand[handIndex];
  if (!card) return -Infinity;
  const def = cardDef(card.id, data);
  const intent = effectiveIntent(state, data);
  const incoming = intent.type === 'attack' ? intent.totalDamage : 0;
  const unguarded = Math.max(0, incoming - state.player.guard);
  const oppEffective = state.opponent.balance + state.opponent.guard;
  // Highest grip any other card in hand wants.
  const wantedGrip = state.hand.reduce((m, c, i) => {
    if (i === handIndex) return m;
    return Math.max(m, cardDef(c.id, data).requiresGrip ?? 0);
  }, 0);

  let score = 0;
  for (const e of def.effects) {
    switch (e.type) {
      case 'damage':
        score += e.amount >= oppEffective ? 100 : e.amount * 2;
        break;
      case 'selfDamage': {
        const lethalForUs = state.player.balance - e.amount <= 0 && state.player.palmSaveUsed;
        score -= lethalForUs ? 200 : e.amount * 1.5;
        break;
      }
      case 'grip': {
        const after = Math.max(0, Math.min(data.rules.maxGrip, state.grip + e.amount));
        if (after > state.grip && state.grip < wantedGrip) score += 3;
        else if (after > state.grip && state.grip < 2) score += 1;
        if (after < state.grip && intent.type === 'attack' && after < (intent.requiresGrip ?? 0)) score += unguarded;
        break;
      }
      case 'setGrip':
        break;
      case 'guard':
        score += Math.min(e.amount, unguarded) * 1.5;
        break;
      case 'energyNextTurn':
        score += 1;
        break;
      case 'reversal':
        score += state.player.reversalActive ? -10 : incoming * 2;
        break;
      case 'weakenNextAttack':
        score += Math.min(e.amount, incoming) * 0.5;
        break;
    }
  }
  return score - def.cost * 0.1;
}
