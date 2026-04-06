import type { Card, Rank } from "./deck";

const RANK_VALUES: Record<Rank, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
  "9": 9, "10": 10, "J": 11, "Q": 12, "K": 13, "A": 14,
};

const HAND_RANKS = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  THREE_OF_A_KIND: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  FOUR_OF_A_KIND: 7,
  STRAIGHT_FLUSH: 8,
  ROYAL_FLUSH: 9,
} as const;

const HAND_NAMES: Record<number, string> = {
  0: "High Card",
  1: "Pair",
  2: "Two Pair",
  3: "Three of a Kind",
  4: "Straight",
  5: "Flush",
  6: "Full House",
  7: "Four of a Kind",
  8: "Straight Flush",
  9: "Royal Flush",
};

export interface HandResult {
  rank: number;
  name: string;
  score: number;
  bestCards: Card[];
}

function getCombinations(cards: Card[], size: number): Card[][] {
  const results: Card[][] = [];
  function combine(start: number, current: Card[]) {
    if (current.length === size) {
      results.push([...current]);
      return;
    }
    for (let i = start; i < cards.length; i++) {
      current.push(cards[i]);
      combine(i + 1, current);
      current.pop();
    }
  }
  combine(0, []);
  return results;
}

function evaluateFiveCards(cards: Card[]): { rank: number; score: number } {
  const sorted = [...cards].sort((a, b) => RANK_VALUES[b.rank] - RANK_VALUES[a.rank]);
  const values = sorted.map(c => RANK_VALUES[c.rank]);
  const suits = sorted.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);
  const uniqueValues = [...new Set(values)].sort((a, b) => b - a);

  let isStraight = false;
  if (uniqueValues.length === 5) {
    if (uniqueValues[0] - uniqueValues[4] === 4) {
      isStraight = true;
    }
    if (uniqueValues[0] === 14 && uniqueValues[1] === 5 && uniqueValues[4] === 2) {
      isStraight = true;
      values[0] = 1;
      values.sort((a, b) => b - a);
    }
  }

  const counts: Record<number, number> = {};
  for (const v of values) {
    counts[v] = (counts[v] || 0) + 1;
  }
  const groups = Object.entries(counts)
    .map(([val, count]) => ({ val: Number(val), count }))
    .sort((a, b) => b.count - a.count || b.val - a.val);

  let rank: number;
  let tiebreakers: number[];

  if (isFlush && isStraight) {
    if (values[0] === 14 && values[1] === 13) {
      rank = HAND_RANKS.ROYAL_FLUSH;
    } else {
      rank = HAND_RANKS.STRAIGHT_FLUSH;
    }
    tiebreakers = [Math.max(...values)];
  } else if (groups[0].count === 4) {
    rank = HAND_RANKS.FOUR_OF_A_KIND;
    tiebreakers = [groups[0].val, groups[1].val];
  } else if (groups[0].count === 3 && groups[1].count === 2) {
    rank = HAND_RANKS.FULL_HOUSE;
    tiebreakers = [groups[0].val, groups[1].val];
  } else if (isFlush) {
    rank = HAND_RANKS.FLUSH;
    tiebreakers = values;
  } else if (isStraight) {
    rank = HAND_RANKS.STRAIGHT;
    tiebreakers = [Math.max(...values)];
  } else if (groups[0].count === 3) {
    rank = HAND_RANKS.THREE_OF_A_KIND;
    tiebreakers = [groups[0].val, ...groups.slice(1).map(g => g.val)];
  } else if (groups[0].count === 2 && groups[1].count === 2) {
    rank = HAND_RANKS.TWO_PAIR;
    const pairs = groups.filter(g => g.count === 2).map(g => g.val).sort((a, b) => b - a);
    const kicker = groups.find(g => g.count === 1)!.val;
    tiebreakers = [...pairs, kicker];
  } else if (groups[0].count === 2) {
    rank = HAND_RANKS.PAIR;
    tiebreakers = [groups[0].val, ...groups.slice(1).map(g => g.val)];
  } else {
    rank = HAND_RANKS.HIGH_CARD;
    tiebreakers = values;
  }

  let score = rank * 1_000_000;
  for (let i = 0; i < tiebreakers.length; i++) {
    score += tiebreakers[i] * Math.pow(15, 4 - i);
  }

  return { rank, score };
}

export function evaluateHand(holeCards: Card[], communityCards: Card[]): HandResult {
  const allCards = [...holeCards, ...communityCards];
  const combos = getCombinations(allCards, 5);

  let bestScore = -1;
  let bestRank = 0;
  let bestCards: Card[] = [];

  for (const combo of combos) {
    const result = evaluateFiveCards(combo);
    if (result.score > bestScore) {
      bestScore = result.score;
      bestRank = result.rank;
      bestCards = combo;
    }
  }

  return {
    rank: bestRank,
    name: HAND_NAMES[bestRank],
    score: bestScore,
    bestCards,
  };
}

export function compareHands(a: HandResult, b: HandResult): number {
  return a.score - b.score;
}
