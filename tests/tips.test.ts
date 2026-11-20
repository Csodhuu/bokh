import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/core';
import { matchTip } from '../src/ui/tips';
import { matchWithHand, TEST_DATA as D } from './helpers';

describe('match tips', () => {
  it('warns when the coming attack would use the palm save, or make you fall', () => {
    const s = matchWithHand(['sleeveGrip'], { grip: 1 });
    s.opponent.intentIndex = 1; // twist 3
    s.player.balance = 3;
    expect(matchTip(s, D)?.key).toBe('tip.palm');
    s.player.palmSaveUsed = true;
    expect(matchTip(s, D)?.key).toBe('tip.lethal');
    s.player.guard = 1;
    expect(matchTip(s, D)?.key).not.toBe('tip.lethal');
  });

  it('suggests Reversal against a big attack', () => {
    const s = matchWithHand(['reversal'], { grip: 2, opponent: 'elephant' });
    s.opponent.intentIndex = 2; // big throw 6
    expect(matchTip(s, D)).toMatchObject({ key: 'tip.reversal', params: { n: 6 }, cards: { card: 'reversal' } });
    const after = applyAction(s, { type: 'PlayCard', handIndex: 0 }, D).state;
    expect(matchTip(after, D)?.key).not.toBe('tip.reversal');
  });

  it('suggests Step Back when it would make the attack fail', () => {
    const s = matchWithHand(['stepBack'], { grip: 2, opponent: 'elephant' });
    s.opponent.intentIndex = 2; // big throw needs 2
    expect(matchTip(s, D)).toMatchObject({ key: 'tip.stepBack', moves: { move: 'bigThrow' } });
  });

  it('suggests raising grip for a grip-blocked card', () => {
    const s = matchWithHand(['hook', 'sleeveGrip']);
    expect(matchTip(s, D)).toMatchObject({ key: 'tip.grip', cards: { card: 'hook' }, grips: { grip: 2 } });
  });

  it('says to end the turn when nothing is playable', () => {
    const s = matchWithHand(['hook'], { grip: 2, energy: 1 });
    expect(matchTip(s, D)?.key).toBe('tip.endTurn');
  });

  it('warns one turn before fatigue', () => {
    const s = matchWithHand([]);
    s.turn = D.rules.fatigueStartTurn - 1;
    expect(matchTip(s, D)?.key).toBe('tip.fatigueSoon');
  });
});
