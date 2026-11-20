import { describe, expect, it } from 'vitest';
import { chooseReward, completeRunMatch, createRun, DEFAULT_DATA, startRunMatch, type MatchState } from '../src/core';

function finish(match: MatchState, winner: 'player' | 'opponent', playerBalance: number): MatchState {
  return { ...match, phase: 'over', winner, player: { ...match.player, balance: playerBalance } };
}

describe('run', () => {
  it('follows the bracket and restores balance after a win (capped at max)', () => {
    let run = createRun(5);
    expect(run.bracket).toEqual(DEFAULT_DATA.rules.bracket);
    const started = startRunMatch(run);
    run = started.run;
    expect(started.match.state.opponent.id).toBe(run.bracket[0]);

    run = completeRunMatch(run, finish(started.match.state, 'player', 4));
    expect(run.status).toBe('reward');
    expect(run.playerBalance).toBe(7);
    expect(run.rewardChoices).toHaveLength(3);
    expect(new Set(run.rewardChoices).size).toBe(3);
    for (const c of run.rewardChoices) expect(DEFAULT_DATA.rewardPool).toContain(c);

    const pick = run.rewardChoices[1]!;
    run = chooseReward(run, pick);
    expect(run.deck).toHaveLength(11);
    expect(run.deck).toContain(pick);
    expect(run.round).toBe(1);

    const m2 = startRunMatch(run);
    expect(m2.match.state.player.balance).toBe(7);
    run = completeRunMatch(m2.run, finish(m2.match.state, 'player', 9));
    expect(run.playerBalance).toBe(10);
  });

  it('a loss ends the run', () => {
    const { run, match } = startRunMatch(createRun(1));
    const after = completeRunMatch(run, finish(match.state, 'opponent', 0));
    expect(after.status).toBe('lost');
  });

  it('winning the last match wins the run without a reward', () => {
    let run = createRun(3);
    for (let i = 0; i < run.bracket.length; i++) {
      const s = startRunMatch(run);
      run = completeRunMatch(s.run, finish(s.match.state, 'player', 5));
      if (run.status === 'reward') run = chooseReward(run, null);
    }
    expect(run.status).toBe('won');
    expect(run.history.every((h) => h.won)).toBe(true);
  });

  it('rejects a card that was not offered', () => {
    const s = startRunMatch(createRun(1));
    const run = completeRunMatch(s.run, finish(s.match.state, 'player', 5));
    expect(() => chooseReward(run, 'hook')).toThrow();
  });
});
