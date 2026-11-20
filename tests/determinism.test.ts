import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applyAction,
  chooseBotAction,
  chooseReward,
  completeRunMatch,
  createMatch,
  createRun,
  DEFAULT_DATA,
  startRunMatch,
  type MatchEvent,
  type MatchState,
} from '../src/core';

function playOut(seed: number, opponentId: string): { state: MatchState; events: MatchEvent[] } {
  let { state, events } = createMatch({ opponentId, deck: DEFAULT_DATA.starterDeck, seed });
  const all = [...events];
  for (let i = 0; i < 500 && state.phase !== 'over'; i++) {
    const r = applyAction(state, chooseBotAction(state));
    state = r.state;
    all.push(...r.events);
  }
  return { state, events: all };
}

describe('determinism', () => {
  it('the same seed produces the same match', () => {
    for (const opp of ['village', 'elephant', 'falcon']) {
      const a = playOut(12345, opp);
      const b = playOut(12345, opp);
      expect(a.state).toEqual(b.state);
      expect(a.events).toEqual(b.events);
      expect(a.state.phase).toBe('over');
    }
  });

  it('different seeds shuffle differently', () => {
    const hands = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const { state } = createMatch({ opponentId: 'village', deck: DEFAULT_DATA.starterDeck, seed });
      hands.add(state.hand.map((c) => c.uid).join(','));
    }
    expect(hands.size).toBeGreaterThan(1);
  });

  it('the same seed produces the same run', () => {
    const runOnce = () => {
      let run = createRun(999);
      const log: string[] = [];
      while (run.status === 'match') {
        const started = startRunMatch(run);
        run = started.run;
        let m = started.match.state;
        while (m.phase !== 'over') m = applyAction(m, chooseBotAction(m)).state;
        run = completeRunMatch(run, m);
        log.push(`${m.opponent.id}:${m.winner}:${m.turn}:${run.rewardChoices.join('/')}`);
        if (run.status === 'reward') run = chooseReward(run, run.rewardChoices[0] ?? null);
      }
      return { run, log };
    };
    expect(runOnce()).toEqual(runOnce());
  });
});

describe('architecture', () => {
  it('src/core has no Phaser (or DOM-framework) imports', () => {
    const dir = join(__dirname, '..', 'src', 'core');
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|js)$/.test(f)) files.push(p);
      }
    };
    walk(dir);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/from\s+['"]phaser['"]/i);
      expect(src, f).not.toMatch(/import\s*\(\s*['"]phaser['"]/i);
      expect(src, f).not.toMatch(/require\(\s*['"]phaser['"]/i);
      expect(src, f).not.toMatch(/from\s+['"]\.\.\/scenes/);
    }
  });
});
