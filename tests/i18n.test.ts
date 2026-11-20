import { describe, expect, it } from 'vitest';
import { DEFAULT_DATA } from '../src/core';
import en from '../src/i18n/en.json';
import mn from '../src/i18n/mn.json';

describe('i18n', () => {
  it('Mongolian has every English key', () => {
    const missing = Object.keys(en).filter((k) => !(k in mn));
    expect(missing).toEqual([]);
  });

  it('every card, opponent and opponent move has a name', () => {
    const dict = en as Record<string, string>;
    for (const id of Object.keys(DEFAULT_DATA.cards)) expect(dict[`card.${id}`], id).toBeTruthy();
    for (const [id, opp] of Object.entries(DEFAULT_DATA.opponents)) {
      expect(dict[`opponent.${id}`], id).toBeTruthy();
      for (const m of opp.pattern) expect(dict[`move.${m.id}`], m.id).toBeTruthy();
    }
  });
});
