/**
 * Fast Poker Hand Evaluator — Prime Product + Bitmask approach (Cactus Kev style)
 *
 * Each card is encoded as a 32-bit integer:
 *   Bits 0-7:   Prime number for rank (2=2, 3=3, 4=5, 5=7, ..., A=41)
 *   Bits 8-11:  Rank (0-12)
 *   Bits 12-15: Suit bitmask (0001=clubs, 0010=diamonds, 0100=hearts, 1000=spades)
 *   Bits 16-28: Rank bitmask (one bit per rank for flush/straight detection)
 *
 * Hand scores: 1 (worst) to 7462 (Royal Flush). Higher = better.
 */

import type { CardType, Suit, Rank } from "./hand-evaluator";

// Prime numbers assigned to each rank (2-A)
const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41];

// Rank to index: 2=0, 3=1, ..., A=12
const RANK_TO_IDX: Record<Rank, number> = {
  "2": 0, "3": 1, "4": 2, "5": 3, "6": 4, "7": 5, "8": 6,
  "9": 7, "10": 8, "J": 9, "Q": 10, "K": 11, "A": 12,
};

const SUIT_BITS: Record<Suit, number> = {
  clubs: 0x1000,
  diamonds: 0x2000,
  hearts: 0x4000,
  spades: 0x8000,
};

/** Encode a CardType into a 32-bit integer */
export function encodeCard(card: CardType): number {
  const ri = RANK_TO_IDX[card.rank];
  const prime = PRIMES[ri];
  const rankBit = 1 << (16 + ri);
  const suitBit = SUIT_BITS[card.suit];
  return prime | (ri << 8) | suitBit | rankBit;
}

/** Extract rank index (0-12) from encoded card */
function rankOf(c: number): number {
  return (c >> 8) & 0xF;
}

/** Extract suit bitmask from encoded card */
function suitOf(c: number): number {
  return c & 0xF000;
}

/** Extract prime from encoded card */
function primeOf(c: number): number {
  return c & 0xFF;
}

/** Extract rank bitmask from encoded card */
function rankBitOf(c: number): number {
  return c & 0x1FFF0000;
}

// ─── Pre-computed lookup tables ──────────────────────────────────────────────

// All possible 5-card rank bitmask patterns for straights (including A-5 wheel)
const STRAIGHT_MASKS: number[] = [];
// Standard straights: 5-high through A-high
for (let top = 4; top <= 12; top++) {
  let mask = 0;
  for (let i = top; i >= top - 4; i--) {
    mask |= (1 << (16 + i));
  }
  STRAIGHT_MASKS.push(mask);
}
// Wheel: A-2-3-4-5
STRAIGHT_MASKS.push((1 << (16 + 12)) | (1 << 16) | (1 << 17) | (1 << 18) | (1 << 19));

// Map from straight mask to the high card rank index (0-12)
const STRAIGHT_HIGH = new Map<number, number>();
for (let top = 4; top <= 12; top++) {
  let mask = 0;
  for (let i = top; i >= top - 4; i--) mask |= (1 << (16 + i));
  STRAIGHT_HIGH.set(mask, top);
}
// Wheel
{
  const wheelMask = (1 << (16 + 12)) | (1 << 16) | (1 << 17) | (1 << 18) | (1 << 19);
  STRAIGHT_HIGH.set(wheelMask, 3); // 5-high = rank index 3
}

// Flush lookup: rank bitmask → score (pre-computed for all 1287 unique 5-card flush patterns)
const FLUSH_TABLE = new Map<number, number>();

// Unique5 lookup: prime product → score (for straights and high cards with 5 unique ranks)
const UNIQUE5_TABLE = new Map<number, number>();

// Remainder lookup: prime product → score (for pairs, trips, full houses, quads)
const REMAINDER_TABLE = new Map<number, number>();

/**
 * Hand ranking categories and their score ranges (7462 total distinct hands):
 *   Straight Flush: 7453-7462 (10 hands)
 *   Four of a Kind:  7297-7452 (156 hands)
 *   Full House:      7141-7296 (156 hands)
 *   Flush:           6186-7140 (1277 hands - subtracting 10 straight flushes from C(13,5)=1287)
 *   Straight:        6175-6185 (10 hands, after removing straight flushes)
 *   Three of a Kind: 5864-6174 (858 - but we use 311 unique)
 *   Two Pair:        4140-5863 (858 - but we use 1724... simplified)
 *   One Pair:        1610-4139 (2860 - but simplified)
 *   High Card:       1-1609    (1277 hands)
 */

// Score offsets for each category (we build tables dynamically)
// Exact score ranges (contiguous, no overlap):
// High Card:       1-1277    (1277 hands: C(13,5) - 10 straights)
// One Pair:        1278-4137 (2860 hands: 13 × C(12,3))
// Two Pair:        4138-4995 (858 hands: C(13,2) × 11)
// Three of a Kind: 4996-5853 (858 hands: 13 × C(12,2))
// Straight:        5854-5863 (10 hands)
// Flush:           5864-7140 (1277 hands: C(13,5) - 10 straight flushes)
// Full House:      7141-7296 (156 hands: 13 × 12)
// Four of a Kind:  7297-7452 (156 hands: 13 × 12)
// Straight Flush:  7453-7462 (10 hands)
const SCORE_HIGH_CARD = 1;
const SCORE_ONE_PAIR = 1278;
const SCORE_TWO_PAIR = 4138;
const SCORE_THREE_KIND = 4996;
const SCORE_STRAIGHT = 5854;
const SCORE_FLUSH = 5864;
const SCORE_FULL_HOUSE = 7141;
const SCORE_FOUR_KIND = 7297;
const SCORE_STRAIGHT_FLUSH = 7453;

/** Generate all C(n,k) combinations of indices */
function* combIndices(n: number, k: number, start = 0): Generator<number[]> {
  if (k === 0) { yield []; return; }
  for (let i = start; i <= n - k; i++) {
    for (const rest of combIndices(n, k - 1, i + 1)) {
      yield [i, ...rest];
    }
  }
}

/** Initialize all lookup tables */
function initTables() {
  // We need to enumerate all possible 5-card hands by rank pattern and score them

  // Helper: get rank counts from 5 rank indices
  function getRankPattern(ranks: number[]): number[] {
    const counts: Record<number, number> = {};
    for (const r of ranks) counts[r] = (counts[r] || 0) + 1;
    return Object.values(counts).sort((a, b) => b - a);
  }

  // Score all flush hands (5 unique ranks, suited)
  // C(13,5) = 1287 combinations
  const flushRankSets: number[][] = [];
  for (const combo of combIndices(13, 5)) {
    flushRankSets.push(combo);
  }
  // Sort by hand strength (high cards descending)
  flushRankSets.sort((a, b) => {
    const as = [...a].sort((x, y) => y - x);
    const bs = [...b].sort((x, y) => y - x);
    for (let i = 0; i < 5; i++) {
      if (as[i] !== bs[i]) return as[i] - bs[i];
    }
    return 0;
  });

  // Separate straight flushes from regular flushes
  const straightFlushes: number[][] = [];
  const regularFlushes: number[][] = [];
  for (const ranks of flushRankSets) {
    const sorted = [...ranks].sort((a, b) => b - a);
    const isStraight = (sorted[0] - sorted[4] === 4) ||
      (sorted[0] === 12 && sorted[1] === 3 && sorted[2] === 2 && sorted[3] === 1 && sorted[4] === 0);
    if (isStraight) {
      straightFlushes.push(ranks);
    } else {
      regularFlushes.push(ranks);
    }
  }

  // Score straight flushes: 7453 - 7462
  straightFlushes.sort((a, b) => {
    const as = [...a].sort((x, y) => y - x);
    const bs = [...b].sort((x, y) => y - x);
    // Handle wheel: A-2-3-4-5 → high card is 5 (index 3)
    const aHigh = (as[0] === 12 && as[1] === 3) ? 3 : as[0];
    const bHigh = (bs[0] === 12 && bs[1] === 3) ? 3 : bs[0];
    return aHigh - bHigh;
  });
  for (let i = 0; i < straightFlushes.length; i++) {
    const mask = straightFlushes[i].reduce((m, r) => m | (1 << (16 + r)), 0);
    FLUSH_TABLE.set(mask, SCORE_STRAIGHT_FLUSH + i);
  }

  // Score regular flushes
  for (let i = 0; i < regularFlushes.length; i++) {
    const mask = regularFlushes[i].reduce((m, r) => m | (1 << (16 + r)), 0);
    FLUSH_TABLE.set(mask, SCORE_FLUSH + i);
  }

  // Score unique-5 (non-flush) hands: straights and high cards
  const straights: number[][] = [];
  const highCards: number[][] = [];
  for (const combo of combIndices(13, 5)) {
    const sorted = [...combo].sort((a, b) => b - a);
    const isStraight = (sorted[0] - sorted[4] === 4) ||
      (sorted[0] === 12 && sorted[1] === 3 && sorted[2] === 2 && sorted[3] === 1 && sorted[4] === 0);
    if (isStraight) {
      straights.push(combo);
    } else {
      highCards.push(combo);
    }
  }

  straights.sort((a, b) => {
    const as = [...a].sort((x, y) => y - x);
    const bs = [...b].sort((x, y) => y - x);
    const aHigh = (as[0] === 12 && as[1] === 3) ? 3 : as[0];
    const bHigh = (bs[0] === 12 && bs[1] === 3) ? 3 : bs[0];
    return aHigh - bHigh;
  });

  highCards.sort((a, b) => {
    const as = [...a].sort((x, y) => y - x);
    const bs = [...b].sort((x, y) => y - x);
    for (let i = 0; i < 5; i++) {
      if (as[i] !== bs[i]) return as[i] - bs[i];
    }
    return 0;
  });

  for (let i = 0; i < straights.length; i++) {
    const product = straights[i].reduce((p, r) => p * PRIMES[r], 1);
    UNIQUE5_TABLE.set(product, SCORE_STRAIGHT + i);
  }

  for (let i = 0; i < highCards.length; i++) {
    const product = highCards[i].reduce((p, r) => p * PRIMES[r], 1);
    UNIQUE5_TABLE.set(product, SCORE_HIGH_CARD + i);
  }

  // Score paired hands (quads, full houses, trips, two pair, one pair)
  // Enumerate all rank patterns with duplicates

  // Four of a kind: 1 rank × 4, 1 kicker
  const quads: { quadRank: number; kicker: number }[] = [];
  for (let q = 0; q < 13; q++) {
    for (let k = 0; k < 13; k++) {
      if (k === q) continue;
      quads.push({ quadRank: q, kicker: k });
    }
  }
  quads.sort((a, b) => a.quadRank !== b.quadRank ? a.quadRank - b.quadRank : a.kicker - b.kicker);
  for (let i = 0; i < quads.length; i++) {
    const product = Math.pow(PRIMES[quads[i].quadRank], 4) * PRIMES[quads[i].kicker];
    REMAINDER_TABLE.set(product, SCORE_FOUR_KIND + i);
  }

  // Full house: 1 rank × 3, 1 rank × 2
  const fullHouses: { tripRank: number; pairRank: number }[] = [];
  for (let t = 0; t < 13; t++) {
    for (let p = 0; p < 13; p++) {
      if (p === t) continue;
      fullHouses.push({ tripRank: t, pairRank: p });
    }
  }
  fullHouses.sort((a, b) => a.tripRank !== b.tripRank ? a.tripRank - b.tripRank : a.pairRank - b.pairRank);
  for (let i = 0; i < fullHouses.length; i++) {
    const product = Math.pow(PRIMES[fullHouses[i].tripRank], 3) * Math.pow(PRIMES[fullHouses[i].pairRank], 2);
    REMAINDER_TABLE.set(product, SCORE_FULL_HOUSE + i);
  }

  // Three of a kind: 1 rank × 3, 2 kickers
  const trips: { tripRank: number; k1: number; k2: number }[] = [];
  for (let t = 0; t < 13; t++) {
    for (let k1 = 0; k1 < 13; k1++) {
      if (k1 === t) continue;
      for (let k2 = k1 + 1; k2 < 13; k2++) {
        if (k2 === t) continue;
        trips.push({ tripRank: t, k1, k2 });
      }
    }
  }
  trips.sort((a, b) => {
    if (a.tripRank !== b.tripRank) return a.tripRank - b.tripRank;
    if (a.k2 !== b.k2) return a.k2 - b.k2;
    return a.k1 - b.k1;
  });
  for (let i = 0; i < trips.length; i++) {
    const product = Math.pow(PRIMES[trips[i].tripRank], 3) * PRIMES[trips[i].k1] * PRIMES[trips[i].k2];
    REMAINDER_TABLE.set(product, SCORE_THREE_KIND + i);
  }

  // Two pair: 2 ranks × 2, 1 kicker
  const twoPairs: { hi: number; lo: number; kicker: number }[] = [];
  for (let h = 1; h < 13; h++) {
    for (let l = 0; l < h; l++) {
      for (let k = 0; k < 13; k++) {
        if (k === h || k === l) continue;
        twoPairs.push({ hi: h, lo: l, kicker: k });
      }
    }
  }
  twoPairs.sort((a, b) => {
    if (a.hi !== b.hi) return a.hi - b.hi;
    if (a.lo !== b.lo) return a.lo - b.lo;
    return a.kicker - b.kicker;
  });
  for (let i = 0; i < twoPairs.length; i++) {
    const product = Math.pow(PRIMES[twoPairs[i].hi], 2) * Math.pow(PRIMES[twoPairs[i].lo], 2) * PRIMES[twoPairs[i].kicker];
    REMAINDER_TABLE.set(product, SCORE_TWO_PAIR + i);
  }

  // One pair: 1 rank × 2, 3 kickers
  const onePairs: { pairRank: number; k1: number; k2: number; k3: number }[] = [];
  for (let p = 0; p < 13; p++) {
    for (let k1 = 0; k1 < 13; k1++) {
      if (k1 === p) continue;
      for (let k2 = k1 + 1; k2 < 13; k2++) {
        if (k2 === p) continue;
        for (let k3 = k2 + 1; k3 < 13; k3++) {
          if (k3 === p) continue;
          onePairs.push({ pairRank: p, k1, k2, k3 });
        }
      }
    }
  }
  onePairs.sort((a, b) => {
    if (a.pairRank !== b.pairRank) return a.pairRank - b.pairRank;
    if (a.k3 !== b.k3) return a.k3 - b.k3;
    if (a.k2 !== b.k2) return a.k2 - b.k2;
    return a.k1 - b.k1;
  });
  for (let i = 0; i < onePairs.length; i++) {
    const product = Math.pow(PRIMES[onePairs[i].pairRank], 2) *
      PRIMES[onePairs[i].k1] * PRIMES[onePairs[i].k2] * PRIMES[onePairs[i].k3];
    REMAINDER_TABLE.set(product, SCORE_ONE_PAIR + i);
  }
}

// Initialize tables on module load
initTables();

// ─── Evaluation Functions ────────────────────────────────────────────────────

/** Evaluate a 5-card hand from encoded cards. Returns score 1-7462 (higher = better). */
export function evaluate5Fast(c0: number, c1: number, c2: number, c3: number, c4: number): number {
  // Step A: Flush check — AND all suit bits
  if ((suitOf(c0) & suitOf(c1) & suitOf(c2) & suitOf(c3) & suitOf(c4)) !== 0) {
    // All same suit — look up in flush table using rank bitmask
    const rankMask = rankBitOf(c0) | rankBitOf(c1) | rankBitOf(c2) | rankBitOf(c3) | rankBitOf(c4);
    return FLUSH_TABLE.get(rankMask) || 0;
  }

  // Compute prime product
  const product = primeOf(c0) * primeOf(c1) * primeOf(c2) * primeOf(c3) * primeOf(c4);

  // Step B: Unique ranks check (straights and high cards)
  const unique5Score = UNIQUE5_TABLE.get(product);
  if (unique5Score !== undefined) return unique5Score;

  // Step C: Paired hands (pairs, trips, full house, quads)
  return REMAINDER_TABLE.get(product) || 0;
}

/** Evaluate a 7-card hand (2 hole + 5 board). Returns score 1-7462 (higher = better). */
export function evaluate7Fast(cards: number[]): number {
  // Test all C(7,5) = 21 combinations and return the best
  let best = 0;
  for (let i = 0; i < 7; i++) {
    for (let j = i + 1; j < 7; j++) {
      // Skip cards i and j (pick the other 5)
      const hand: number[] = [];
      for (let k = 0; k < 7; k++) {
        if (k !== i && k !== j) hand.push(cards[k]);
      }
      const score = evaluate5Fast(hand[0], hand[1], hand[2], hand[3], hand[4]);
      if (score > best) best = score;
    }
  }
  return best;
}

// ─── Score to Hand Name ──────────────────────────────────────────────────────

export type HandCategory = "High Card" | "Pair" | "Two Pair" | "Three of a Kind" |
  "Straight" | "Flush" | "Full House" | "Four of a Kind" | "Straight Flush" | "Royal Flush";

const CATEGORY_RANGES: { min: number; max: number; name: HandCategory; rankValue: number }[] = [
  { min: 7453, max: 7462, name: "Straight Flush", rankValue: 8 },
  { min: 7297, max: 7452, name: "Four of a Kind", rankValue: 7 },
  { min: 7141, max: 7296, name: "Full House", rankValue: 6 },
  { min: 5864, max: 7140, name: "Flush", rankValue: 5 },
  { min: 5854, max: 5863, name: "Straight", rankValue: 4 },
  { min: 4996, max: 5853, name: "Three of a Kind", rankValue: 3 },
  { min: 4138, max: 4995, name: "Two Pair", rankValue: 2 },
  { min: 1278, max: 4137, name: "Pair", rankValue: 1 },
  { min: 1, max: 1277, name: "High Card", rankValue: 0 },
];

export function getHandCategory(score: number): { name: HandCategory; rankValue: number } {
  // Royal Flush is the top straight flush (A-high)
  if (score === 7462) return { name: "Royal Flush", rankValue: 9 };
  for (const cat of CATEGORY_RANGES) {
    if (score >= cat.min && score <= cat.max) return cat;
  }
  return { name: "High Card", rankValue: 0 };
}
