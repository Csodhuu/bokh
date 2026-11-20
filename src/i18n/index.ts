import en from './en.json';
import mn from './mn.json';
import type { CardDef } from '../core';

export type Lang = 'en' | 'mn';
type Dict = Record<string, string>;

const DICTS: Record<Lang, Dict> = { en, mn };
const STORAGE_KEY = 'bokh.lang';

let lang: Lang = loadLang();

function loadLang(): Lang {
  try {
    const fromUrl = new URLSearchParams(location.search).get('lang');
    if (fromUrl === 'en' || fromUrl === 'mn') return fromUrl;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'mn') return stored;
  } catch {
    /* storage unavailable */
  }
  return 'en';
}

export function getLang(): Lang {
  return lang;
}

export function setLang(next: Lang): void {
  lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = next;
}

/** Translate a key, interpolating {params}. Falls back to English, then the key. */
export function t(key: string, params: Record<string, string | number> = {}): string {
  const raw = DICTS[lang][key] ?? DICTS.en[key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => (k in params ? String(params[k]) : `{${k}}`));
}

export const gripName = (level: number) => t(`grip.${level}`);
export const cardName = (id: string) => t(`card.${id}`);
export const opponentName = (id: string) => t(`opponent.${id}`);
export const moveName = (id: string) => t(`move.${id}`);

/** Card rules text, built from the card's data so numbers always match. */
export function cardDescription(def: CardDef): string[] {
  const lines: string[] = [];
  for (const e of def.effects) {
    switch (e.type) {
      case 'grip':
        lines.push(e.amount >= 0 ? t('effect.grip', { n: e.amount }) : t('effect.gripDown', { n: -e.amount }));
        break;
      case 'setGrip':
        lines.push(t('effect.setGrip', { grip: gripName(e.value) }));
        break;
      case 'damage':
        lines.push(t('effect.damage', { n: e.amount }));
        break;
      case 'selfDamage':
        lines.push(t('effect.selfDamage', { n: e.amount }));
        break;
      case 'guard':
        lines.push(t('effect.guard', { n: e.amount }));
        break;
      case 'energyNextTurn':
        lines.push(t('effect.energyNextTurn', { n: e.amount }));
        break;
      case 'reversal':
        lines.push(t('effect.reversal'));
        break;
      case 'weakenNextAttack':
        lines.push(t('effect.weakenNextAttack', { n: e.amount }));
        break;
    }
  }
  if (def.effects.some((e) => e.type === 'selfDamage') && def.effects.some((e) => e.type === 'damage')) {
    lines.push(t('effect.bothFall'));
  }
  if (def.exhaust) lines.push(t('effect.exhaust'));
  return lines;
}
