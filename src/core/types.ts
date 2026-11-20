// Pure data types for the game core. No Phaser / DOM imports anywhere in src/core.

export type Side = 'player' | 'opponent';
export type CardId = string;
export type OpponentId = string;

// ---------- Data definitions (loaded from src/data/*.json) ----------

export type CardEffect =
  | { type: 'grip'; amount: number }
  | { type: 'setGrip'; value: number }
  | { type: 'damage'; amount: number }
  | { type: 'selfDamage'; amount: number }
  | { type: 'guard'; amount: number }
  | { type: 'energyNextTurn'; amount: number }
  | { type: 'reversal' }
  | { type: 'weakenNextAttack'; amount: number };

export interface CardDef {
  cost: number;
  /** Minimum shared grip level needed to play the card. */
  requiresGrip?: number;
  /** Removed for the rest of the match after being played. */
  exhaust?: boolean;
  effects: CardEffect[];
}

export type OpponentMove =
  | { id: string; type: 'grip'; amount: number }
  | { id: string; type: 'guard'; amount: number }
  | { id: string; type: 'attack'; damage: number; hits?: number; requiresGrip?: number };

export interface OpponentDef {
  balance: number;
  pattern: OpponentMove[];
}

export interface Rules {
  maxBalance: number;
  energyPerTurn: number;
  handSize: number;
  healOnWin: number;
  palmSaveBalance: number;
  maxGrip: number;
  fatigueStartTurn: number;
  fatigueBase: number;
  fatigueEscalateEvery: number;
  rewardChoices: number;
  /** When an opponent attack lacks the grip it needs, it raises grip by this much instead. */
  fallbackGripOnMissingGrip: number;
  bracket: OpponentId[];
}

export interface GameData {
  rules: Rules;
  cards: Record<CardId, CardDef>;
  starterDeck: CardId[];
  rewardPool: CardId[];
  opponents: Record<OpponentId, OpponentDef>;
}

// ---------- Match state ----------

export interface CardInstance {
  /** Unique per match, lets the view track a specific card. */
  uid: number;
  id: CardId;
}

export interface PlayerState {
  balance: number;
  maxBalance: number;
  guard: number;
  energy: number;
  energyNextTurn: number;
  palmSaveUsed: boolean;
  reversalActive: boolean;
}

export interface OpponentState {
  id: OpponentId;
  balance: number;
  maxBalance: number;
  guard: number;
  intentIndex: number;
  /** Reduces the opponent's next attack (consumed when it attacks). */
  attackPenalty: number;
}

export interface MatchState {
  rng: number;
  seed: number;
  turn: number;
  phase: 'player' | 'over';
  grip: number;
  player: PlayerState;
  opponent: OpponentState;
  drawPile: CardInstance[];
  hand: CardInstance[];
  discardPile: CardInstance[];
  exhaustPile: CardInstance[];
  winner: Side | null;
  cardsPlayed: Record<CardId, number>;
}

export type MatchAction = { type: 'PlayCard'; handIndex: number } | { type: 'EndTurn' };

/** What the opponent will actually do given the current grip. */
export interface EffectiveIntent {
  moveId: string;
  type: 'grip' | 'guard' | 'attack';
  /** grip delta, guard amount, or per-hit damage (after penalty on the first hit). */
  amount: number;
  hits: number;
  /** Total damage of an attack (0 for non-attacks). */
  totalDamage: number;
  /** Set when an attack was converted to a grip move because grip was too low. */
  convertedFrom?: string;
  requiresGrip?: number;
}

// ---------- Events (consumed by the view for animations) ----------

export type DamageSource = 'card' | 'self' | 'attack' | 'reversal' | 'fatigue';

export type MatchEvent =
  | { type: 'TurnStarted'; turn: number }
  | { type: 'Fatigue'; amount: number }
  | { type: 'Shuffled'; count: number }
  | { type: 'CardDrawn'; card: CardInstance }
  | { type: 'CardPlayed'; card: CardInstance }
  | { type: 'PlayRejected'; reason: PlayBlockReason }
  | { type: 'CardExhausted'; card: CardInstance }
  | { type: 'HandDiscarded'; count: number }
  | { type: 'EnergyChanged'; from: number; to: number }
  | { type: 'BalanceChanged'; side: Side; from: number; to: number; source: DamageSource }
  | { type: 'GuardChanged'; side: Side; from: number; to: number }
  | { type: 'GuardAbsorbed'; side: Side; amount: number }
  | { type: 'GripChanged'; from: number; to: number }
  | { type: 'ReversalReady' }
  | { type: 'AttackWeakened'; amount: number }
  | { type: 'OpponentActed'; intent: EffectiveIntent }
  | { type: 'AttackReversed'; damage: number }
  | { type: 'PalmSave' }
  | { type: 'Fall'; side: Side }
  | { type: 'MatchEnded'; winner: Side };

export type PlayBlockReason =
  | { kind: 'matchOver' }
  | { kind: 'noCard' }
  | { kind: 'energy'; need: number; have: number }
  | { kind: 'grip'; need: number; have: number };

export interface ActionResult {
  state: MatchState;
  events: MatchEvent[];
}
