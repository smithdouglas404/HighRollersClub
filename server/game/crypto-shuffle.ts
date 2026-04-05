import { randomBytes, randomUUID, createHash, createHmac } from "crypto";
import type { CardType, Suit, Rank } from "./hand-evaluator";

// ─── Types ───────────────────────────────────────────────────────────────────
export interface PlayerSeedData {
  playerId: string;
  seed: string;
  commitmentHash: string;
}

export interface PlayerBlockchainIdentity {
  playerId: string;
  memberId: string | null;
  kycHash: string | null;
}

export interface ShuffleProof {
  serverSeed: string;
  timestamp: number;
  nonce: string;
  commitmentHash: string;
  deckOrder: string;
  handNumber: number;
  tableId: string;
  shuffleVersion: 1 | 2 | 3; // v3 = with blockchain identity entropy
  playerSeeds?: PlayerSeedData[];
  playerIdentities?: PlayerBlockchainIdentity[];
  vrfRequestId?: string;
  vrfRandomWord?: string;
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

// v1 shuffle (legacy, no rejection sampling — kept for old proof verification)
export function deterministicShuffleV1(seed: string): CardType[] {
  const deck = createCanonicalDeck();

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

// v2 shuffle with rejection sampling to eliminate modulo bias
export function deterministicShuffle(seed: string): CardType[] {
  const deck = createCanonicalDeck();

  for (let i = deck.length - 1; i > 0; i--) {
    const range = i + 1;
    // max is the largest multiple of range that fits in uint32
    const max = Math.floor(0x100000000 / range) * range;
    let attempt = 0;
    let rand: number;

    do {
      const hmac = createHmac("sha256", seed);
      hmac.update(`shuffle-index-${i}-${attempt}`);
      const hash = hmac.digest();
      rand = hash.readUInt32BE(0);
      attempt++;
    } while (rand >= max);

    const j = rand % range;
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

// ─── Combined Seed (multi-party entropy) ────────────────────────────────────
export function createCombinedSeed(serverSeed: string, playerSeeds: string[]): string {
  const hash = createHash("sha512");
  hash.update(serverSeed);
  // Sort player seeds for deterministic ordering
  const sorted = [...playerSeeds].sort();
  for (const ps of sorted) {
    hash.update(ps);
  }
  return hash.digest("hex");
}

// ─── Super Seed with VRF ────────────────────────────────────────────────────
export function createSuperSeedWithVRF(
  osRandom: Buffer,
  nonce: string,
  timestamp: number,
  vrfRandomWord: string
): string {
  const hash = createHash("sha512");
  hash.update(osRandom);
  hash.update(nonce);
  hash.update(timestamp.toString());
  hash.update(vrfRandomWord);
  return hash.digest("hex");
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
      shuffleVersion: 2,
    },
  };
}

// ─── Blockchain Identity Entropy ─────────────────────────────────────────────
// Each player's on-chain identity (memberId + kycHash) is mixed into the shuffle.
// This means the shuffle is partially seeded by each player's immutable blockchain
// identity — no single party (including the server) fully controls the randomness.
export function mixBlockchainIdentities(baseSeed: string, identities: PlayerBlockchainIdentity[]): string {
  if (identities.length === 0) return baseSeed;

  const hash = createHash("sha512");
  hash.update(baseSeed);

  // Sort by playerId for deterministic ordering
  const sorted = [...identities].sort((a, b) => a.playerId.localeCompare(b.playerId));
  for (const id of sorted) {
    if (id.memberId) hash.update(`member:${id.memberId}`);
    if (id.kycHash) hash.update(`kyc:${id.kycHash}`);
    hash.update(`player:${id.playerId}`);
  }

  return hash.digest("hex");
}

// ─── Create Multi-Party Provably Fair Shuffle ────────────────────────────────
export function createProvablyFairShuffleMultiParty(
  tableId: string,
  handNumber: number,
  playerSeedData: PlayerSeedData[],
  vrfRandomWord?: string,
  playerIdentities?: PlayerBlockchainIdentity[]
): { deck: CardType[]; proof: ShuffleProof } {
  const { osRandom, nonce, timestamp } = generateEntropy();

  // Create server seed (optionally with VRF)
  const baseSeed = vrfRandomWord
    ? createSuperSeedWithVRF(osRandom, nonce, timestamp, vrfRandomWord)
    : createSuperSeed(osRandom, nonce, timestamp);

  // Mix in player seeds
  const playerSeedValues = playerSeedData.map(ps => ps.seed);
  let combinedSeed = playerSeedValues.length > 0
    ? createCombinedSeed(baseSeed, playerSeedValues)
    : baseSeed;

  // Mix in player blockchain identities (v3 enhancement)
  const hasIdentities = playerIdentities && playerIdentities.some(id => id.memberId || id.kycHash);
  if (hasIdentities) {
    combinedSeed = mixBlockchainIdentities(combinedSeed, playerIdentities!);
  }

  const deck = deterministicShuffle(combinedSeed);
  const commitmentHash = commitDeck(deck);
  const deckOrder = deckToCanonicalString(deck);

  return {
    deck,
    proof: {
      serverSeed: combinedSeed,
      timestamp,
      nonce,
      commitmentHash,
      deckOrder,
      handNumber,
      tableId,
      shuffleVersion: hasIdentities ? 3 : 2,
      playerSeeds: playerSeedData.length > 0 ? playerSeedData : undefined,
      playerIdentities: hasIdentities ? playerIdentities : undefined,
      vrfRequestId: undefined,
      vrfRandomWord: vrfRandomWord || undefined,
    },
  };
}

// ─── Verify ──────────────────────────────────────────────────────────────────
export function verifyShuffle(proof: ShuffleProof): boolean {
  // Choose shuffle version
  const shuffleFn = proof.shuffleVersion === 1 ? deterministicShuffleV1 : deterministicShuffle;
  const deck = shuffleFn(proof.serverSeed);
  const computedOrder = deckToCanonicalString(deck);
  const computedHash = createHash("sha256").update(computedOrder).digest("hex");

  return (
    computedOrder === proof.deckOrder &&
    computedHash === proof.commitmentHash
  );
}
