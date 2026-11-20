import { describe, expect, it } from 'vitest';
import {
  applyAction,
  canPlay,
  createMatch,
  DEFAULT_DATA,
  effectiveIntent,
  fatigueForTurn,
  playBlockReason,
  validateData,
  type MatchState,
} from '../src/core';
import { cloneData, matchWithHand, TEST_DATA } from './helpers';

const D = TEST_DATA;
const play = (s: MatchState, handIndex: number) => applyAction(s, { type: 'PlayCard', handIndex }, D);
const endTurn = (s: MatchState) => applyAction(s, { type: 'EndTurn' }, D);

describe('data', () => {
  it('is internally consistent', () => {
    expect(() => validateData(DEFAULT_DATA)).not.toThrow();
    expect(() => validateData(TEST_DATA)).not.toThrow();
  });
});

describe('match setup', () => {
  it('starts turn 1 with 3 energy and 5 cards, grip at distance', () => {
    const { state } = createMatch({ opponentId: 'village', deck: D.starterDeck, seed: 42 }, D);
    expect(state.turn).toBe(1);
    expect(state.player.energy).toBe(3);
    expect(state.hand).toHaveLength(5);
    expect(state.drawPile).toHaveLength(5);
    expect(state.grip).toBe(0);
    expect(state.player.balance).toBe(10);
    expect(state.opponent.balance).toBe(8);
  });
});

describe('grip requirements and energy', () => {
  it('blocks a card that needs more grip, with the reason', () => {
    const s = matchWithHand(['hook'], { grip: 1 });
    expect(canPlay(s, 0, D)).toBe(false);
    expect(playBlockReason(s, 0, D)).toEqual({ kind: 'grip', need: 2, have: 1 });
    const { state, events } = play(s, 0);
    expect(events).toEqual([{ type: 'PlayRejected', reason: { kind: 'grip', need: 2, have: 1 } }]);
    expect(state.hand).toHaveLength(1);
    expect(state.player.energy).toBe(3);
    expect(state.opponent.balance).toBe(s.opponent.balance);
  });

  it('allows the card once grip is high enough', () => {
    const s = matchWithHand(['sleeveGrip', 'hook'], { grip: 1 });
    const r1 = play(s, 0);
    expect(r1.state.grip).toBe(2);
    expect(r1.events).toContainEqual({ type: 'GripChanged', from: 1, to: 2 });
    const r2 = play(r1.state, 0);
    expect(r2.state.opponent.balance).toBe(s.opponent.balance - 4);
  });

  it('spends energy and blocks when there is not enough', () => {
    const s = matchWithHand(['hook', 'hook', 'twist'], { grip: 2 });
    const r1 = play(s, 0);
    expect(r1.state.player.energy).toBe(1);
    expect(playBlockReason(r1.state, 0, D)).toEqual({ kind: 'energy', need: 2, have: 1 });
    const r2 = play(r1.state, 1); // twist costs 1
    expect(r2.state.player.energy).toBe(0);
  });

  it('0-cost cards are playable with 0 energy', () => {
    const s = matchWithHand(['zasuulSlap'], { energy: 0 });
    expect(canPlay(s, 0, D)).toBe(true);
  });

  it('grip is clamped to 0..3', () => {
    const r1 = play(matchWithHand(['legGrab'], { grip: 2 }), 0);
    expect(r1.state.grip).toBe(3);
    const r2 = play(matchWithHand(['stepBack'], { grip: 0 }), 0);
    expect(r2.state.grip).toBe(0);
  });

  it('does not mutate the input state', () => {
    const s = matchWithHand(['sleeveGrip']);
    const before = structuredClone(s);
    play(s, 0);
    endTurn(s);
    expect(s).toEqual(before);
  });
});

describe('guard', () => {
  it('absorbs attack damage', () => {
    // Village pattern: grab, twist 3, brace. Put it on twist with grip 1.
    let s = matchWithHand(['lowerStance'], { grip: 1 });
    s.opponent.intentIndex = 1;
    s = play(s, 0).state;
    expect(s.player.guard).toBe(3);
    const { state, events } = endTurn(s);
    expect(events).toContainEqual({ type: 'GuardAbsorbed', side: 'player', amount: 3 });
    expect(state.player.balance).toBe(10);
  });

  it('partially absorbs bigger attacks', () => {
    let s = matchWithHand(['stepBack'], { grip: 3, opponent: 'elephant' });
    s.opponent.intentIndex = 2; // big throw 6, needs grip 2
    s = play(s, 0).state; // grip 2, guard 2
    const { state } = endTurn(s);
    expect(state.player.balance).toBe(10 - (6 - 2));
  });

  it('resets at the start of the next player turn', () => {
    let s = matchWithHand(['lowerStance']);
    s.opponent.intentIndex = 0; // opponent only grabs
    s = play(s, 0).state;
    expect(s.player.guard).toBe(3);
    const { state, events } = endTurn(s);
    expect(state.player.guard).toBe(0);
    expect(events).toContainEqual({ type: 'GuardChanged', side: 'player', from: 3, to: 0 });
  });

  it('opponent guard absorbs player damage, lasts through the player turn, resets on its turn', () => {
    let s = matchWithHand([], { grip: 2 });
    s.opponent.intentIndex = 2; // brace 3
    s = endTurn(s).state;
    expect(s.opponent.guard).toBe(3);
    const startBalance = s.opponent.balance;
    s.hand = [{ uid: 900, id: 'hook' }];
    s.grip = 2;
    s = play(s, 0).state;
    expect(s.opponent.guard).toBe(0);
    expect(s.opponent.balance).toBe(startBalance - 1);

    let t = matchWithHand([]);
    t.opponent.guard = 5;
    t = endTurn(t).state; // village grabs; guard resets first
    expect(t.opponent.guard).toBe(0);
  });
});

describe('palm save', () => {
  it('sets balance to 1 instead of falling, once per match', () => {
    let s = matchWithHand([], { grip: 1 });
    s.opponent.intentIndex = 1; // twist 3
    s.player.balance = 2;
    const r1 = endTurn(s);
    expect(r1.events.filter((e) => e.type === 'PalmSave')).toHaveLength(1);
    expect(r1.state.player.balance).toBe(1);
    expect(r1.state.player.palmSaveUsed).toBe(true);
    expect(r1.state.phase).toBe('player');

    // Next lethal hit is a real fall.
    s = r1.state;
    s.hand = [];
    s.opponent.intentIndex = 1;
    s.grip = 1;
    const r2 = endTurn(s);
    expect(r2.events.some((e) => e.type === 'PalmSave')).toBe(false);
    expect(r2.state.phase).toBe('over');
    expect(r2.state.winner).toBe('opponent');
    expect(r2.events).toContainEqual({ type: 'Fall', side: 'player' });
  });

  it('does not trigger on non-lethal damage', () => {
    const s = matchWithHand([], { grip: 1 });
    s.opponent.intentIndex = 1;
    const r = endTurn(s);
    expect(r.state.player.balance).toBe(7);
    expect(r.state.player.palmSaveUsed).toBe(false);
  });

  it('opponents have no palm save', () => {
    const s = matchWithHand(['hook'], { grip: 2 });
    s.opponent.balance = 3;
    const r = play(s, 0);
    expect(r.state.winner).toBe('player');
    expect(r.events).toContainEqual({ type: 'MatchEnded', winner: 'player' });
  });
});

describe('reversal', () => {
  it('cancels an attack and reflects its damage', () => {
    let s = matchWithHand(['reversal'], { grip: 1 });
    s.opponent.intentIndex = 1; // twist 3
    const oppBefore = s.opponent.balance;
    s = play(s, 0).state;
    expect(s.player.reversalActive).toBe(true);
    const { state, events } = endTurn(s);
    expect(events).toContainEqual({ type: 'AttackReversed', damage: 3 });
    expect(state.player.balance).toBe(10);
    expect(state.opponent.balance).toBe(oppBefore - 3);
    expect(state.player.reversalActive).toBe(false);
  });

  it('reflects every hit of a multi-hit attack', () => {
    let s = matchWithHand(['reversal'], { grip: 1, opponent: 'falcon' });
    s.opponent.intentIndex = 1; // quick strikes 2 x 2
    const oppBefore = s.opponent.balance;
    s = play(s, 0).state;
    const { state } = endTurn(s);
    expect(state.opponent.balance).toBe(oppBefore - 4);
    expect(state.player.balance).toBe(10);
  });

  it('is wasted if the opponent does not attack, and expires', () => {
    let s = matchWithHand(['reversal'], { grip: 0 });
    s.opponent.intentIndex = 0; // grab
    const oppBefore = s.opponent.balance;
    s = play(s, 0).state;
    const r = endTurn(s);
    expect(r.events.some((e) => e.type === 'AttackReversed')).toBe(false);
    expect(r.state.player.reversalActive).toBe(false);
    expect(r.state.opponent.balance).toBe(oppBefore);
  });
});

describe('opponent intents', () => {
  it('an attack without enough grip raises grip instead', () => {
    const s = matchWithHand([], { opponent: 'elephant', grip: 1 });
    s.opponent.intentIndex = 2; // big throw needs 2
    const intent = effectiveIntent(s, D);
    expect(intent).toMatchObject({ type: 'grip', convertedFrom: 'bigThrow', amount: 1 });
    const { state } = endTurn(s);
    expect(state.grip).toBe(2);
    expect(state.player.balance).toBe(10);
    expect(state.opponent.intentIndex).toBe(0);
  });

  it('knee sweep weakens the next attack', () => {
    let s = matchWithHand(['kneeSweep'], { grip: 1 });
    s.opponent.intentIndex = 1; // twist 3
    s = play(s, 0).state;
    expect(effectiveIntent(s, D).totalDamage).toBe(1);
    const { state } = endTurn(s);
    expect(state.player.balance).toBe(9);
    expect(state.opponent.attackPenalty).toBe(0);
  });

  it('cycles through the pattern', () => {
    let s = matchWithHand([]);
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      seen.push(effectiveIntent(s, D).moveId);
      s = endTurn(s).state;
      s.hand = [];
      s.grip = 1;
    }
    expect(seen).toEqual(['grab', 'twist', 'brace', 'grab']);
  });
});

describe('fatigue', () => {
  it('starts on turn 6 and escalates every 3 turns', () => {
    expect([1, 5, 6, 7, 8, 9, 11, 12].map((t) => fatigueForTurn(t, D))).toEqual([0, 0, 1, 1, 1, 2, 2, 3]);
  });

  it('hits both wrestlers at the start of the turn, ignoring guard', () => {
    // Make the opponent harmless so only fatigue matters.
    const data = cloneData();
    data.opponents.elephant!.pattern = [{ id: 'brace', type: 'guard', amount: 0 }];
    let s = matchWithHand([], { opponent: 'elephant', data });
    const startOpp = s.opponent.balance;
    const log: number[] = [];
    for (let turn = 1; turn <= 9; turn++) {
      log.push(s.player.balance);
      s.player.guard = 5;
      s = applyAction(s, { type: 'EndTurn' }, data).state;
    }
    // Balance at the start of turns 1..9 (after that turn's fatigue): 10 x5, then 9, 8, 7, 5.
    expect(log).toEqual([10, 10, 10, 10, 10, 9, 8, 7, 5]);
    expect(s.turn).toBe(10);
    // Turn 10 dealt 2 more.
    expect(s.player.balance).toBe(3);
    expect(s.opponent.balance).toBe(startOpp - 7);
  });
});

describe('sacrifice throw', () => {
  it('deals 5 to the opponent and 3 to yourself (ignoring your guard)', () => {
    const s = matchWithHand(['sacrificeThrow']);
    s.player.guard = 5;
    s.opponent.balance = 8;
    const { state } = play(s, 0);
    expect(state.opponent.balance).toBe(3);
    expect(state.player.balance).toBe(7);
  });

  it('palm save still applies: you survive, the opponent falls', () => {
    const s = matchWithHand(['sacrificeThrow']);
    s.player.balance = 3;
    s.opponent.balance = 5;
    const { state, events } = play(s, 0);
    expect(events.some((e) => e.type === 'PalmSave')).toBe(true);
    expect(state.player.balance).toBe(1);
    expect(state.winner).toBe('player');
  });

  it('both fall: the wrestler with lower balance loses', () => {
    const s = matchWithHand(['sacrificeThrow']);
    s.player.palmSaveUsed = true;
    s.player.balance = 2; // -> -1
    s.opponent.balance = 3; // -> -2
    const { state, events } = play(s, 0);
    expect(state.winner).toBe('player');
    expect(events).toContainEqual({ type: 'Fall', side: 'opponent' });

    const s2 = matchWithHand(['sacrificeThrow']);
    s2.player.palmSaveUsed = true;
    s2.player.balance = 1; // -> -2
    s2.opponent.balance = 4; // -> -1
    expect(play(s2, 0).state.winner).toBe('opponent');
  });

  it('both fall with a tie: the player loses', () => {
    const s = matchWithHand(['sacrificeThrow']);
    s.player.palmSaveUsed = true;
    s.player.balance = 2; // -> -1
    s.opponent.balance = 4; // -> -1
    const { state, events } = play(s, 0);
    expect(state.winner).toBe('opponent');
    expect(events).toContainEqual({ type: 'Fall', side: 'player' });
  });

  it('opponent guard absorbs the throw but not the self damage', () => {
    const s = matchWithHand(['sacrificeThrow']);
    s.opponent.guard = 3;
    s.opponent.balance = 8;
    const { state } = play(s, 0);
    expect(state.opponent.balance).toBe(6);
    expect(state.player.balance).toBe(7);
  });
});

describe('deck cycling', () => {
  it('discards the hand at end of turn and reshuffles when the draw pile is empty', () => {
    let { state } = createMatch({ opponentId: 'village', deck: D.starterDeck, seed: 7 }, D);
    state = endTurn(state).state; // turn 2: draws the other 5
    expect(state.drawPile).toHaveLength(0);
    const r = endTurn(state); // turn 3: must reshuffle
    expect(r.events.some((e) => e.type === 'Shuffled')).toBe(true);
    expect(r.state.hand).toHaveLength(5);
    expect(r.state.drawPile.length + r.state.discardPile.length + r.state.hand.length).toBe(10);
  });

  it('the Zasuul slap gives +1 energy next turn and is exhausted', () => {
    let s = matchWithHand(['zasuulSlap']);
    s = play(s, 0).state;
    expect(s.exhaustPile.map((c) => c.id)).toEqual(['zasuulSlap']);
    s = endTurn(s).state;
    expect(s.player.energy).toBe(4);
    const all = [...s.drawPile, ...s.discardPile, ...s.hand];
    expect(all.some((c) => c.uid === 1000)).toBe(false);
  });

  it('hip throw resets grip to one-hand', () => {
    const s = matchWithHand(['hipThrow'], { grip: 3 });
    s.opponent.balance = 8;
    const { state } = play(s, 0);
    expect(state.grip).toBe(1);
    expect(state.opponent.balance).toBe(3);
  });
});

describe('finished matches', () => {
  it('ignore further actions', () => {
    const s = matchWithHand(['hook', 'twist'], { grip: 2 });
    s.opponent.balance = 1;
    const over = play(s, 0).state;
    expect(over.phase).toBe('over');
    expect(play(over, 0).events).toEqual([]);
    expect(endTurn(over).events).toEqual([]);
  });
});
