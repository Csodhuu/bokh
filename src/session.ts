// View-side session: holds the current run + match so scenes can share them.
import {
  completeRunMatch,
  createRun,
  DEFAULT_DATA,
  randomSeed,
  roundsWon,
  startRunMatch,
  toSeed,
  totalTurns,
  type MatchEvent,
  type MatchState,
  type RunState,
} from './core';
import { cardName, opponentName } from './i18n';

declare const __APP_VERSION__: string;
export const VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
export const DEBUG = params.get('debug') === '1';
const urlSeed = params.get('seed');

type Listener = () => void;

class Session {
  run: RunState | null = null;
  match: MatchState | null = null;
  /** Events from creating the current match (consumed by the Match scene). */
  pendingEvents: MatchEvent[] = [];
  private listeners: Listener[] = [];

  newRun(seed?: number | string): void {
    const s = seed !== undefined && seed !== '' ? toSeed(seed) : urlSeed ? toSeed(urlSeed) : randomSeed();
    this.run = createRun(s);
    this.match = null;
    this.emit();
  }

  startMatch(): MatchState {
    if (!this.run) throw new Error('No run');
    const { run, match } = startRunMatch(this.run);
    this.run = run;
    this.match = match.state;
    this.pendingEvents = match.events;
    this.emit();
    return match.state;
  }

  setMatch(state: MatchState): void {
    this.match = state;
    this.emit();
  }

  finishMatch(): RunState {
    if (!this.run || !this.match) throw new Error('No match');
    this.run = completeRunMatch(this.run, this.match);
    this.emit();
    return this.run;
  }

  setRun(run: RunState): void {
    this.run = run;
    this.emit();
  }

  onChange(fn: Listener): void {
    this.listeners.push(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }
}

export const session = new Session();

export function mostPlayed(run: RunState, n = 3): [string, number][] {
  return Object.entries(run.cardsPlayed)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n);
}

/** Short plain-text report testers can paste back to the developer. */
export function runSummary(run: RunState): string {
  const total = run.bracket.length;
  const won = roundsWon(run);
  const last = run.history[run.history.length - 1];
  const result =
    run.status === 'won'
      ? `WON the run (${won}/${total})`
      : `LOST in round ${run.history.length}/${total} to ${last ? opponentName(last.opponentId) : '?'} (${won}/${total} won)`;
  const matches = run.history
    .map((h, i) => `  ${i + 1}. ${opponentName(h.opponentId)} — ${h.won ? 'won' : 'lost'} in ${h.turns} turns`)
    .join('\n');
  const played = mostPlayed(run, 5)
    .map(([id, c]) => `${cardName(id)} ×${c}`)
    .join(', ');
  const extra = run.deck.slice(DEFAULT_DATA.starterDeck.length).map(cardName).join(', ') || '—';
  return [
    `Bökh playtest v${VERSION} · seed ${run.seed}`,
    `Result: ${result}`,
    `Turns: ${totalTurns(run)}`,
    matches,
    `Most played: ${played || '—'}`,
    `Cards added: ${extra}`,
    `Feedback: `,
  ].join('\n');
}
