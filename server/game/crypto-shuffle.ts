import { randomBytes, randomUUID, createHash, createHmac } from "crypto";
import type { CardType, Suit, Rank } from "./hand-evaluator";

// ─── Types ───────────────────────────────────────────────────────────────────
export interface ShuffleProof {
  serverSeed: string;
  timestamp: number;
  nonce: string;
  commitmentHash: string;
  deckOrder: string;
  handNumber: number;
  tableId: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

const SUIT_SHORT: Record<Suit, string> = {
  hearts: "h", diamonds: "d", clubs: "c", spades: "s",
};

// ─── Entropy ─────────────────────────────────────────────────────────────────
export function generateEntropy(): { osRandom: Buffer; nonce: string; timestamp: number } {
  return {
    osRandom: randomBytes(32),
    nonce: randomUUID(),
    timestamp: Date.now(),
  };
}

export function createSuperSeed(osRandom: Buffer, nonce: string, timestamp: number): string {
  const hash = createHash("sha512");
  hash.update(osRandom);
  hash.update(nonce);
  hash.update(timestamp.toString());
  return hash.digest("hex"); // 128-char hex
}

// ─── Deterministic Shuffle ───────────────────────────────────────────────────
function createCanonicalDeck(): CardType[] {
  const deck: CardType[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

export function deterministicShuffle(seed: string): CardType[] {
  const deck = createCanonicalDeck();

  // Fisher-Yates with HMAC-SHA256 for each swap index
  for (let i = deck.length - 1; i > 0; i--) {
    const hmac = createHmac("sha256", seed);
    hmac.update(`shuffle-index-${i}`);
    const hash = hmac.digest();
    const rand = hash.readUInt32BE(0);
    const j = rand % (i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

// ─── Canonical String ────────────────────────────────────────────────────────
export function deckToCanonicalString(deck: CardType[]): string {
  return deck.map(c => `${c.rank}${SUIT_SHORT[c.suit]}`).join(",");
}

// ─── Commitment ──────────────────────────────────────────────────────────────
export function commitDeck(deck: CardType[]): string {
  const canonical = deckToCanonicalString(deck);
  return createHash("sha256").update(canonical).digest("hex");
}

// ─── Create Provably Fair Shuffle ────────────────────────────────────────────
export function createProvablyFairShuffle(
  tableId: string,
  handNumber: number
): { deck: CardType[]; proof: ShuffleProof } {
  const { osRandom, nonce, timestamp } = generateEntropy();
  const serverSeed = createSuperSeed(osRandom, nonce, timestamp);
  const deck = deterministicShuffle(serverSeed);
  const commitmentHash = commitDeck(deck);
  const deckOrder = deckToCanonicalString(deck);

  return {
    deck,
    proof: {
      serverSeed,
      timestamp,
      nonce,
      commitmentHash,
      deckOrder,
      handNumber,
      tableId,
    },
  };
}

// ─── Verify ──────────────────────────────────────────────────────────────────
export function verifyShuffle(proof: ShuffleProof): boolean {
  // Re-run deterministic shuffle with the same seed
  const deck = deterministicShuffle(proof.serverSeed);
  const computedOrder = deckToCanonicalString(deck);
  const computedHash = createHash("sha256").update(computedOrder).digest("hex");

  return (
    computedOrder === proof.deckOrder &&
    computedHash === proof.commitmentHash
  );
}
