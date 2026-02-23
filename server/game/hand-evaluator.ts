// Server-side hand evaluator — ported from client/src/lib/hand-evaluator.ts

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";

export interface CardType {
  suit: Suit;
  rank: Rank;
  hidden?: boolean;
}

export type HandRank =
  | "High Card" | "Pair" | "Two Pair" | "Three of a Kind"
  | "Straight" | "Flush" | "Full House" | "Four of a Kind"
  | "Straight Flush" | "Royal Flush";

export interface EvaluatedHand {
  rank: HandRank;
  rankValue: number;
  kickers: number[];
  bestCards: CardType[];
  description: string;
}

const RANK_VALUES: Record<Rank, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
  "9": 9, "10": 10, "J": 11, "Q": 12, "K": 13, "A": 14,
};

const RANK_NAMES: Record<number, string> = {
  2: "Twos", 3: "Threes", 4: "Fours", 5: "Fives", 6: "Sixes",
  7: "Sevens", 8: "Eights", 9: "Nines", 10: "Tens",
  11: "Jacks", 12: "Queens", 13: "Kings", 14: "Aces",
};

const RANK_SINGULAR: Record<number, string> = {
  2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six",
  7: "Seven", 8: "Eight", 9: "Nine", 10: "Ten",
  11: "Jack", 12: "Queen", 13: "King", 14: "Ace",
};

function cardValue(card: CardType): number {
  return RANK_VALUES[card.rank];
}

function combinations(cards: CardType[], k: number): CardType[][] {
  if (k === 0) return [[]];
  if (cards.length === 0) return [];
  const [first, ...rest] = cards;
  const withFirst = combinations(rest, k - 1).map(c => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

function evaluate5(cards: CardType[]): EvaluatedHand {
  const sorted = [...cards].sort((a, b) => cardValue(b) - cardValue(a));
  const values = sorted.map(cardValue);
  const suits = sorted.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);

  let isStraight = false;
  let straightHigh = 0;

  const uniqueVals = Array.from(new Set(values)).sort((a, b) => b - a);
  if (uniqueVals.length >= 5) {
    for (let i = 0; i <= uniqueVals.length - 5; i++) {
      if (uniqueVals[i] - uniqueVals[i + 4] === 4) {
        isStraight = true;
        straightHigh = uniqueVals[i];
        break;
      }
    }
    if (!isStraight && uniqueVals.includes(14) && uniqueVals.includes(2) &&
        uniqueVals.includes(3) && uniqueVals.includes(4) && uniqueVals.includes(5)) {
      isStraight = true;
      straightHigh = 5;
    }
  }

  const counts: Record<number, number> = {};
  for (const v of values) {
    counts[v] = (counts[v] || 0) + 1;
  }
  const groups = Object.entries(counts)
    .map(([val, count]) => ({ val: parseInt(val), count }))
    .sort((a, b) => b.count - a.count || b.val - a.val);

  if (isFlush && isStraight) {
    if (straightHigh === 14) {
      return { rank: "Royal Flush", rankValue: 9, kickers: [14], bestCards: sorted, description: "Royal Flush!" };
    }
    return { rank: "Straight Flush", rankValue: 8, kickers: [straightHigh], bestCards: sorted, description: `Straight Flush, ${RANK_SINGULAR[straightHigh]} high` };
  }

  if (groups[0].count === 4) {
    return { rank: "Four of a Kind", rankValue: 7, kickers: [groups[0].val, groups[1].val], bestCards: sorted, description: `Four ${RANK_NAMES[groups[0].val]}` };
  }

  if (groups[0].count === 3 && groups[1].count === 2) {
    return { rank: "Full House", rankValue: 6, kickers: [groups[0].val, groups[1].val], bestCards: sorted, description: `Full House, ${RANK_NAMES[groups[0].val]} over ${RANK_NAMES[groups[1].val]}` };
  }

  if (isFlush) {
    return { rank: "Flush", rankValue: 5, kickers: values.slice(0, 5), bestCards: sorted, description: `Flush, ${RANK_SINGULAR[values[0]]} high` };
  }

  if (isStraight) {
    return { rank: "Straight", rankValue: 4, kickers: [straightHigh], bestCards: sorted, description: `Straight, ${RANK_SINGULAR[straightHigh]} high` };
  }

  if (groups[0].count === 3) {
    return { rank: "Three of a Kind", rankValue: 3, kickers: [groups[0].val, groups[1].val, groups[2].val], bestCards: sorted, description: `Three ${RANK_NAMES[groups[0].val]}` };
  }

  if (groups[0].count === 2 && groups[1].count === 2) {
    const highPair = Math.max(groups[0].val, groups[1].val);
    const lowPair = Math.min(groups[0].val, groups[1].val);
    return { rank: "Two Pair", rankValue: 2, kickers: [highPair, lowPair, groups[2].val], bestCards: sorted, description: `Two Pair, ${RANK_NAMES[highPair]} and ${RANK_NAMES[lowPair]}` };
  }

  if (groups[0].count === 2) {
    return { rank: "Pair", rankValue: 1, kickers: [groups[0].val, groups[1].val, groups[2].val, groups[3].val], bestCards: sorted, description: `Pair of ${RANK_NAMES[groups[0].val]}` };
  }

  return { rank: "High Card", rankValue: 0, kickers: values.slice(0, 5), bestCards: sorted, description: `${RANK_SINGULAR[values[0]]} High` };
}

export function evaluateHand(holeCards: CardType[], communityCards: CardType[]): EvaluatedHand {
  const allCards = [...holeCards, ...communityCards];
  if (allCards.length < 5) {
    if (allCards.length === 0) {
      return { rank: "High Card", rankValue: 0, kickers: [], bestCards: [], description: "No cards" };
    }
    return evaluate5([...allCards, ...Array(5 - allCards.length).fill({ suit: "spades" as Suit, rank: "2" as Rank })]);
  }

  const combos = combinations(allCards, 5);
  let bestHand: EvaluatedHand | null = null;
  for (const combo of combos) {
    const hand = evaluate5(combo);
    if (!bestHand || compareHands(hand, bestHand) > 0) {
      bestHand = hand;
    }
  }
  return bestHand!;
}

export function compareHands(a: EvaluatedHand, b: EvaluatedHand): number {
  if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue;
  for (let i = 0; i < Math.min(a.kickers.length, b.kickers.length); i++) {
    if (a.kickers[i] !== b.kickers[i]) return a.kickers[i] - b.kickers[i];
  }
  return 0;
}

export interface PlayerResult {
  playerId: string;
  hand: EvaluatedHand;
  isWinner: boolean;
}

export function determineWinners(
  players: { id: string; cards: CardType[] }[],
  communityCards: CardType[]
): PlayerResult[] {
  const results: PlayerResult[] = players.map(p => ({
    playerId: p.id,
    hand: evaluateHand(p.cards, communityCards),
    isWinner: false,
  }));

  let bestResult = results[0];
  for (let i = 1; i < results.length; i++) {
    if (compareHands(results[i].hand, bestResult.hand) > 0) {
      bestResult = results[i];
    }
  }

  for (const r of results) {
    if (compareHands(r.hand, bestResult.hand) === 0) {
      r.isWinner = true;
    }
  }

  return results;
}
