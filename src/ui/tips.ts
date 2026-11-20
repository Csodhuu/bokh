// Contextual coaching tips shown during a match. Pure: reads core state only,
// returns an i18n key + params (the view translates it).
import {
  cardDef,
  DEFAULT_DATA,
  effectiveIntent,
  playBlockReason,
  type GameData,
  type MatchState,
} from '../core';

export interface Tip {
  key: string;
  params: Record<string, string | number>;
  /** Card ids / move ids referenced in params, translated by the view. */
  cards?: Record<string, string>;
  moves?: Record<string, string>;
  grips?: Record<string, number>;
}

/** The single most useful tip for the current state, or null. */
export function matchTip(s: MatchState, data: GameData = DEFAULT_DATA): Tip | null {
  if (s.phase === 'over') return null;
  const intent = effectiveIntent(s, data);
  const playable = (id: string) => s.hand.some((c, i) => c.id === id && playBlockReason(s, i, data) === null);
  const inHand = (id: string) => s.hand.some((c) => c.id === id);

  if (intent.type === 'attack' && !s.player.reversalActive) {
    const incoming = intent.totalDamage - s.player.guard;
    if (incoming >= s.player.balance) {
      return { key: s.player.palmSaveUsed ? 'tip.lethal' : 'tip.palm', params: {} };
    }
    if (playable('reversal') && intent.totalDamage >= 5) {
      return { key: 'tip.reversal', params: { n: intent.totalDamage }, cards: { card: 'reversal' } };
    }
    const need = intent.requiresGrip ?? 0;
    if (need > 0 && playable('stepBack') && s.grip - 1 < need) {
      return { key: 'tip.stepBack', params: {}, cards: { card: 'stepBack' }, moves: { move: intent.moveId } };
    }
  }

  // A card in hand is blocked only by grip, and a grip card is playable.
  const gripRaisers = s.hand.filter(
    (c, i) =>
      playBlockReason(s, i, data) === null &&
      cardDef(c.id, data).effects.some((e) => e.type === 'grip' && e.amount > 0),
  );
  if (gripRaisers.length > 0) {
    for (let i = 0; i < s.hand.length; i++) {
      const r = playBlockReason(s, i, data);
      const card = s.hand[i];
      if (r?.kind === 'grip' && card) {
        return { key: 'tip.grip', params: {}, cards: { card: card.id }, grips: { grip: r.need } };
      }
    }
  }

  if (s.hand.length > 0 && s.hand.every((_, i) => playBlockReason(s, i, data) !== null)) {
    return { key: 'tip.endTurn', params: {} };
  }
  if (s.turn === data.rules.fatigueStartTurn - 1) return { key: 'tip.fatigueSoon', params: {} };
  if (s.turn === 1 && s.grip === 0 && inHand('zasuulSlap')) {
    return { key: 'tip.slap', params: {}, cards: { card: 'zasuulSlap' } };
  }
  return null;
}
