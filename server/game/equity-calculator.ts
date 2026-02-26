// Monte Carlo equity calculator for all-in scenarios
import type { CardType, Suit, Rank } from "./hand-evaluator";
import { encodeCard, evaluate7Fast } from "./fast-evaluator";

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

function buildFullDeck(): CardType[] {
  const deck: CardType[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

function cardKey(c: CardType): string {
  return `${c.rank}${c.suit}`;
}

function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Calculate equity for each player using Monte Carlo simulation
 * @param playerCards Array of hole card pairs for each active player
 * @param communityCards Current community cards (0-4)
 * @param iterations Number of simulations to run
 * @returns Array of equity percentages (0-1) for each player
 */
export function calculateEquity(
  playerCards: CardType[][],
  communityCards: CardType[],
  iterations: number = 5000
): number[] {
  const usedCards = new Set<string>();
  for (const hand of playerCards) {
    for (const c of hand) usedCards.add(cardKey(c));
  }
  for (const c of communityCards) usedCards.add(cardKey(c));

  const remaining = buildFullDeck().filter(c => !usedCards.has(cardKey(c)));
  const neededCards = 5 - communityCards.length;
  const wins = new Array(playerCards.length).fill(0);
  const ties = new Array(playerCards.length).fill(0);

  for (let iter = 0; iter < iterations; iter++) {
    shuffleArray(remaining);
    const simCommunity = [...communityCards, ...remaining.slice(0, neededCards)];
    const communityEncoded = simCommunity.map(encodeCard);

    let bestScore = 0;
    const scores: number[] = [];

    for (let p = 0; p < playerCards.length; p++) {
      const encoded = [...playerCards[p].map(encodeCard), ...communityEncoded];
      const score = evaluate7Fast(encoded);
      scores.push(score);
      if (score > bestScore) bestScore = score;
    }

    const winnerCount = scores.filter(s => s === bestScore).length;
    for (let p = 0; p < playerCards.length; p++) {
      if (scores[p] === bestScore) {
        if (winnerCount === 1) {
          wins[p]++;
        } else {
          ties[p]++;
        }
      }
    }
  }

  return playerCards.map((_, i) => (wins[i] + ties[i] / 2) / iterations);
}
