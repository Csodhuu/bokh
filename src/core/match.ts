// Match rules: a pure reducer. applyAction(state, action) -> { state, events }.
// The input state is never mutated; each call works on a deep copy.

import { shuffle } from './rng';
import { DEFAULT_DATA } from './data';
import type {
  ActionResult,
  CardDef,
  CardEffect,
  CardId,
  CardInstance,
  DamageSource,
  EffectiveIntent,
  GameData,
  MatchAction,
  MatchEvent,
  MatchState,
  OpponentId,
  PlayBlockReason,
  Side,
} from './types';

export interface MatchSetup {
  opponentId: OpponentId;
  deck: CardId[];
  seed: number;
  /** Player balance at match start (carries over in a run). Defaults to max. */
  playerBalance?: number;
}

type Ctx = { s: MatchState; ev: MatchEvent[]; data: GameData };

// ---------------------------------------------------------------- creation

export function createMatch(setup: MatchSetup, data: GameData = DEFAULT_DATA): ActionResult {
  const opp = data.opponents[setup.opponentId];
  if (!opp) throw new Error(`Unknown opponent: ${setup.opponentId}`);
  const cards: CardInstance[] = setup.deck.map((id, uid) => {
    if (!data.cards[id]) throw new Error(`Unknown card: ${id}`);
    return { uid, id };
  });
  const seed = setup.seed >>> 0;
  const [drawPile, rng] = shuffle(cards, seed);
  const rules = data.rules;
  const s: MatchState = {
    rng,
    seed,
    turn: 0,
    phase: 'player',
    grip: 0,
    player: {
      balance: Math.min(setup.playerBalance ?? rules.maxBalance, rules.maxBalance),
      maxBalance: rules.maxBalance,
      guard: 0,
      energy: 0,
      energyNextTurn: 0,
      palmSaveUsed: false,
      reversalActive: false,
    },
    opponent: {
      id: setup.opponentId,
      balance: opp.balance,
      maxBalance: opp.balance,
      guard: 0,
      intentIndex: 0,
      attackPenalty: 0,
    },
    drawPile,
    hand: [],
    discardPile: [],
    exhaustPile: [],
    winner: null,
    cardsPlayed: {},
  };
  const ctx: Ctx = { s, ev: [], data };
  startPlayerTurn(ctx);
  return { state: s, events: ctx.ev };
}

// ---------------------------------------------------------------- queries

export function cardDef(id: CardId, data: GameData = DEFAULT_DATA): CardDef {
  const def = data.cards[id];
  if (!def) throw new Error(`Unknown card: ${id}`);
  return def;
}

/** null if the card in hand can be played, otherwise why not. */
export function playBlockReason(
  state: MatchState,
  handIndex: number,
  data: GameData = DEFAULT_DATA,
): PlayBlockReason | null {
  if (state.phase === 'over') return { kind: 'matchOver' };
  const card = state.hand[handIndex];
  if (!card) return { kind: 'noCard' };
  const def = cardDef(card.id, data);
  const need = def.requiresGrip ?? 0;
  if (state.grip < need) return { kind: 'grip', need, have: state.grip };
  if (state.player.energy < def.cost) return { kind: 'energy', need: def.cost, have: state.player.energy };
  return null;
}

export function canPlay(state: MatchState, handIndex: number, data: GameData = DEFAULT_DATA): boolean {
  return playBlockReason(state, handIndex, data) === null;
}

/** The opponent's next action as it would resolve with the current grip. */
export function effectiveIntent(state: MatchState, data: GameData = DEFAULT_DATA): EffectiveIntent {
  const opp = data.opponents[state.opponent.id];
  if (!opp) throw new Error(`Unknown opponent: ${state.opponent.id}`);
  const move = opp.pattern[state.opponent.intentIndex % opp.pattern.length];
  if (!move) throw new Error('Empty opponent pattern');
  if (move.type === 'attack') {
    const need = move.requiresGrip ?? 0;
    if (state.grip < need) {
      return {
        moveId: 'grab',
        type: 'grip',
        amount: data.rules.fallbackGripOnMissingGrip,
        hits: 1,
        totalDamage: 0,
        convertedFrom: move.id,
        requiresGrip: need,
      };
    }
    const hits = Math.max(1, move.hits ?? 1);
    const first = Math.max(0, move.damage - state.opponent.attackPenalty);
    const total = first + move.damage * (hits - 1);
    return {
      moveId: move.id,
      type: 'attack',
      amount: move.damage,
      hits,
      totalDamage: total,
      requiresGrip: need,
    };
  }
  return { moveId: move.id, type: move.type, amount: move.amount, hits: 1, totalDamage: 0 };
}

/** Fatigue damage at the start of a given turn (0 before it kicks in). */
export function fatigueForTurn(turn: number, data: GameData = DEFAULT_DATA): number {
  const r = data.rules;
  if (turn < r.fatigueStartTurn) return 0;
  return r.fatigueBase + Math.floor((turn - r.fatigueStartTurn) / r.fatigueEscalateEvery);
}

// ---------------------------------------------------------------- reducer

export function applyAction(
  state: MatchState,
  action: MatchAction,
  data: GameData = DEFAULT_DATA,
): ActionResult {
  const s = structuredClone(state);
  const ctx: Ctx = { s, ev: [], data };
  if (s.phase === 'over') return { state: s, events: [] };

  switch (action.type) {
    case 'PlayCard':
      playCard(ctx, action.handIndex);
      break;
    case 'EndTurn':
      endTurn(ctx);
      break;
  }
  return { state: s, events: ctx.ev };
}

// ---------------------------------------------------------------- internals

function playCard(ctx: Ctx, handIndex: number): void {
  const { s, ev, data } = ctx;
  const block = playBlockReason(s, handIndex, data);
  if (block) {
    ev.push({ type: 'PlayRejected', reason: block });
    return;
  }
  const card = s.hand[handIndex] as CardInstance;
  const def = cardDef(card.id, data);

  setEnergy(ctx, s.player.energy - def.cost);
  s.hand.splice(handIndex, 1);
  s.cardsPlayed[card.id] = (s.cardsPlayed[card.id] ?? 0) + 1;
  ev.push({ type: 'CardPlayed', card });

  for (const effect of def.effects) applyEffect(ctx, effect);

  if (def.exhaust) {
    s.exhaustPile.push(card);
    ev.push({ type: 'CardExhausted', card });
  } else {
    s.discardPile.push(card);
  }
  checkFalls(ctx);
}

function applyEffect(ctx: Ctx, e: CardEffect): void {
  const { s, ev } = ctx;
  switch (e.type) {
    case 'grip':
      setGrip(ctx, s.grip + e.amount);
      break;
    case 'setGrip':
      setGrip(ctx, e.value);
      break;
    case 'damage':
      dealDamage(ctx, 'opponent', e.amount, 'card');
      break;
    case 'selfDamage':
      // Self-inflicted damage (e.g. Sacrifice Throw) ignores your own guard.
      dealDamage(ctx, 'player', e.amount, 'self', true);
      break;
    case 'guard':
      setGuard(ctx, 'player', s.player.guard + e.amount);
      break;
    case 'energyNextTurn':
      s.player.energyNextTurn += e.amount;
      break;
    case 'reversal':
      s.player.reversalActive = true;
      ev.push({ type: 'ReversalReady' });
      break;
    case 'weakenNextAttack':
      s.opponent.attackPenalty += e.amount;
      ev.push({ type: 'AttackWeakened', amount: e.amount });
      break;
  }
}

function endTurn(ctx: Ctx): void {
  const { s, ev } = ctx;
  // Discard the hand.
  const n = s.hand.length;
  s.discardPile.push(...s.hand);
  s.hand = [];
  ev.push({ type: 'HandDiscarded', count: n });

  opponentTurn(ctx);
  if (s.phase === 'over') return;
  startPlayerTurn(ctx);
}

function opponentTurn(ctx: Ctx): void {
  const { s, ev, data } = ctx;
  // Opponent guard lasts until the start of its own next turn.
  setGuard(ctx, 'opponent', 0);

  const intent = effectiveIntent(s, data);
  ev.push({ type: 'OpponentActed', intent });

  switch (intent.type) {
    case 'grip':
      setGrip(ctx, s.grip + intent.amount);
      break;
    case 'guard':
      setGuard(ctx, 'opponent', s.opponent.guard + intent.amount);
      break;
    case 'attack': {
      const hitDamages: number[] = [];
      for (let i = 0; i < intent.hits; i++) {
        hitDamages.push(i === 0 ? Math.max(0, intent.amount - s.opponent.attackPenalty) : intent.amount);
      }
      s.opponent.attackPenalty = 0;
      if (s.player.reversalActive) {
        const reflected = hitDamages.reduce((a, b) => a + b, 0);
        s.player.reversalActive = false;
        ev.push({ type: 'AttackReversed', damage: reflected });
        dealDamage(ctx, 'opponent', reflected, 'reversal');
      } else {
        for (const d of hitDamages) dealDamage(ctx, 'player', d, 'attack');
      }
      break;
    }
  }

  const opp = data.opponents[s.opponent.id];
  s.opponent.intentIndex = (s.opponent.intentIndex + 1) % (opp?.pattern.length ?? 1);
  // Reversal only lasts for the turn it was played.
  s.player.reversalActive = false;
  checkFalls(ctx);
}

function startPlayerTurn(ctx: Ctx): void {
  const { s, ev, data } = ctx;
  s.turn += 1;
  ev.push({ type: 'TurnStarted', turn: s.turn });

  // Guard resets at the start of your next turn.
  setGuard(ctx, 'player', 0);

  const fatigue = fatigueForTurn(s.turn, data);
  if (fatigue > 0) {
    ev.push({ type: 'Fatigue', amount: fatigue });
    dealDamage(ctx, 'player', fatigue, 'fatigue', true);
    dealDamage(ctx, 'opponent', fatigue, 'fatigue', true);
    checkFalls(ctx);
    if (s.phase === 'over') return;
  }

  setEnergy(ctx, data.rules.energyPerTurn + s.player.energyNextTurn);
  s.player.energyNextTurn = 0;
  draw(ctx, data.rules.handSize);
}

function draw(ctx: Ctx, count: number): void {
  const { s, ev } = ctx;
  for (let i = 0; i < count; i++) {
    if (s.drawPile.length === 0) {
      if (s.discardPile.length === 0) return;
      const [shuffled, rng] = shuffle(s.discardPile, s.rng);
      s.rng = rng;
      s.drawPile = shuffled;
      s.discardPile = [];
      ev.push({ type: 'Shuffled', count: shuffled.length });
    }
    const card = s.drawPile.shift() as CardInstance;
    s.hand.push(card);
    ev.push({ type: 'CardDrawn', card });
  }
}

function dealDamage(ctx: Ctx, side: Side, amount: number, source: DamageSource, ignoreGuard = false): void {
  const { s, ev, data } = ctx;
  if (amount <= 0) return;
  const w = side === 'player' ? s.player : s.opponent;
  let dmg = amount;
  if (!ignoreGuard && w.guard > 0) {
    const absorbed = Math.min(w.guard, dmg);
    dmg -= absorbed;
    ev.push({ type: 'GuardAbsorbed', side, amount: absorbed });
    setGuard(ctx, side, w.guard - absorbed);
  }
  if (dmg <= 0) return;
  const from = w.balance;
  let to = from - dmg;
  const palmSave = side === 'player' && to <= 0 && !s.player.palmSaveUsed;
  if (palmSave) {
    s.player.palmSaveUsed = true;
    to = data.rules.palmSaveBalance;
  }
  w.balance = to;
  ev.push({ type: 'BalanceChanged', side, from, to, source });
  if (palmSave) ev.push({ type: 'PalmSave' });
}

/**
 * Ends the match if anyone has fallen. If both fall at once, the wrestler
 * with the lower balance loses; on a tie the player loses.
 */
function checkFalls(ctx: Ctx): void {
  const { s, ev } = ctx;
  if (s.phase === 'over') return;
  const p = s.player.balance;
  const o = s.opponent.balance;
  const pDown = p <= 0;
  const oDown = o <= 0;
  if (!pDown && !oDown) return;
  let loser: Side;
  if (pDown && oDown) loser = o < p ? 'opponent' : 'player';
  else loser = pDown ? 'player' : 'opponent';
  const winner: Side = loser === 'player' ? 'opponent' : 'player';
  s.phase = 'over';
  s.winner = winner;
  ev.push({ type: 'Fall', side: loser });
  ev.push({ type: 'MatchEnded', winner });
}

function setGrip(ctx: Ctx, value: number): void {
  const { s, ev, data } = ctx;
  const to = Math.max(0, Math.min(data.rules.maxGrip, value));
  if (to === s.grip) return;
  ev.push({ type: 'GripChanged', from: s.grip, to });
  s.grip = to;
}

function setGuard(ctx: Ctx, side: Side, value: number): void {
  const w = side === 'player' ? ctx.s.player : ctx.s.opponent;
  if (w.guard === value) return;
  ctx.ev.push({ type: 'GuardChanged', side, from: w.guard, to: value });
  w.guard = value;
}

function setEnergy(ctx: Ctx, value: number): void {
  const p = ctx.s.player;
  if (p.energy === value) return;
  ctx.ev.push({ type: 'EnergyChanged', from: p.energy, to: value });
  p.energy = value;
}
