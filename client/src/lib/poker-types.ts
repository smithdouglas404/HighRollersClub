export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export type GamePhase = 'pre-flop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface CardType {
  suit: Suit;
  rank: Rank;
  hidden?: boolean;
}

export interface Player {
  id: string;
  name: string;
  chips: number;
  avatar?: string;
  cards?: [CardType, CardType];
  isActive: boolean;
  isDealer: boolean;
  isSmallBlind?: boolean;
  isBigBlind?: boolean;
  currentBet: number;
  status: 'thinking' | 'folded' | 'all-in' | 'checked' | 'waiting' | 'called' | 'raised';
  timeLeft?: number; // percentage 0-100
}

export interface GameState {
  pot: number;
  communityCards: CardType[];
  currentTurnPlayerId: string;
  dealerId: string;
  phase: GamePhase;
  minBet: number;
  lastAggressorId?: string;
  dealingPhase?: 'idle' | 'dealing' | 'dealt';
}
