// Browser-compatible provably fair verification using Web Crypto API
// Self-contained — no server imports

export interface ShuffleProof {
  serverSeed: string;
  timestamp: number;
  nonce: string;
  commitmentHash: string;
  deckOrder: string;
  handNumber: number;
  tableId: string;
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

async function deterministicShuffle(seed: string): Promise<Card[]> {
  const deck = createCanonicalDeck();

  for (let i = deck.length - 1; i > 0; i--) {
    const hash = await hmacSha256(seed, `shuffle-index-${i}`);
    // Read first 4 bytes as big-endian uint32
    const rand = (hash[0] << 24 | hash[1] << 16 | hash[2] << 8 | hash[3]) >>> 0;
    const j = rand % (i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

export async function verifyShuffleProof(proof: ShuffleProof): Promise<{
  valid: boolean;
  computedHash: string;
  computedOrder: string;
}> {
  const deck = await deterministicShuffle(proof.serverSeed);
  const computedOrder = deckToCanonicalString(deck);
  const computedHash = await sha256Hex(computedOrder);

  return {
    valid: computedOrder === proof.deckOrder && computedHash === proof.commitmentHash,
    computedHash,
    computedOrder,
  };
}
