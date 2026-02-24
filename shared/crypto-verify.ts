// Browser-compatible provably fair verification using Web Crypto API
// Self-contained — no server imports

export interface PlayerSeedData {
  playerId: string;
  seed: string;
  commitmentHash: string;
}

export interface ShuffleProof {
  serverSeed: string;
  timestamp: number;
  nonce: string;
  commitmentHash: string;
  deckOrder: string;
  handNumber: number;
  tableId: string;
  shuffleVersion?: 1 | 2;
  playerSeeds?: PlayerSeedData[];
  vrfRequestId?: string;
  vrfRandomWord?: string;
}

type Suit = "hearts" | "diamonds" | "clubs" | "spades";
type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";
interface Card { suit: Suit; rank: Rank }

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const SUIT_SHORT: Record<Suit, string> = { hearts: "h", diamonds: "d", clubs: "c", spades: "s" };

function createCanonicalDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

function deckToCanonicalString(deck: Card[]): string {
  return deck.map(c => `${c.rank}${SUIT_SHORT[c.suit]}`).join(",");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(key: string, message: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  return new Uint8Array(signature);
}

async function sha256Hex(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(message));
  return bytesToHex(new Uint8Array(hash));
}

// v1 shuffle (legacy, no rejection sampling)
async function deterministicShuffleV1(seed: string): Promise<Card[]> {
  const deck = createCanonicalDeck();

  for (let i = deck.length - 1; i > 0; i--) {
    const hash = await hmacSha256(seed, `shuffle-index-${i}`);
    const rand = (hash[0] << 24 | hash[1] << 16 | hash[2] << 8 | hash[3]) >>> 0;
    const j = rand % (i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

// v2 shuffle with rejection sampling to eliminate modulo bias
async function deterministicShuffle(seed: string): Promise<Card[]> {
  const deck = createCanonicalDeck();

  for (let i = deck.length - 1; i > 0; i--) {
    const range = i + 1;
    const max = Math.floor(0x100000000 / range) * range;
    let attempt = 0;
    let rand: number;

    do {
      const hash = await hmacSha256(seed, `shuffle-index-${i}-${attempt}`);
      rand = (hash[0] << 24 | hash[1] << 16 | hash[2] << 8 | hash[3]) >>> 0;
      attempt++;
    } while (rand >= max);

    const j = rand % range;
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

// Verify player seed commitments
async function verifyPlayerSeeds(playerSeeds: PlayerSeedData[]): Promise<boolean> {
  for (const ps of playerSeeds) {
    const computedHash = await sha256Hex(ps.seed);
    if (computedHash !== ps.commitmentHash) {
      return false;
    }
  }
  return true;
}

export async function verifyShuffleProof(proof: ShuffleProof): Promise<{
  valid: boolean;
  computedHash: string;
  computedOrder: string;
  playerSeedsValid?: boolean;
}> {
  // Select shuffle algorithm based on version
  const version = proof.shuffleVersion || 1;
  const shuffleFn = version === 1 ? deterministicShuffleV1 : deterministicShuffle;

  const deck = await shuffleFn(proof.serverSeed);
  const computedOrder = deckToCanonicalString(deck);
  const computedHash = await sha256Hex(computedOrder);

  // Verify player seed commitments if present
  let playerSeedsValid: boolean | undefined;
  if (proof.playerSeeds && proof.playerSeeds.length > 0) {
    playerSeedsValid = await verifyPlayerSeeds(proof.playerSeeds);
  }

  const shuffleValid = computedOrder === proof.deckOrder && computedHash === proof.commitmentHash;

  return {
    valid: shuffleValid && (playerSeedsValid !== false),
    computedHash,
    computedOrder,
    playerSeedsValid,
  };
}
