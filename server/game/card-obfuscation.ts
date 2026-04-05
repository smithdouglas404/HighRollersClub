/**
 * Card Obfuscation System — 4-Level Anti-Scraping Protection
 *
 * Level 1: Obfuscated card indices (encrypted integers instead of "Ah")
 * Level 2: Canvas-only rendering signal (client renders to canvas, not DOM)
 * Level 3: Per-session randomized sprite mapping (card positions scrambled)
 * Level 4: Encrypted React state (card data stored as ciphertext in memory)
 *
 * Combined with AES-256-GCM WebSocket encryption, this makes automated
 * scraping near-impossible. The DOM, React DevTools, and network inspector
 * all show meaningless encrypted data.
 */

import { randomBytes, createCipheriv, createHash } from "crypto";

// ─── Card Index Mapping ─────────────────────────────────────────────────────

// Standard deck: 52 cards indexed 0-51
// Index = suit * 13 + rank
// Suits: 0=hearts, 1=diamonds, 2=clubs, 3=spades
// Ranks: 0=2, 1=3, ..., 8=10, 9=J, 10=Q, 11=K, 12=A

const SUITS = ["hearts", "diamonds", "clubs", "spades"] as const;
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"] as const;

export function cardToIndex(suit: string, rank: string): number {
  const si = SUITS.indexOf(suit as any);
  const ri = RANKS.indexOf(rank as any);
  if (si < 0 || ri < 0) return -1;
  return si * 13 + ri;
}

export function indexToCard(index: number): { suit: string; rank: string } | null {
  if (index < 0 || index > 51) return null;
  return { suit: SUITS[Math.floor(index / 13)], rank: RANKS[index % 13] };
}

// ─── Per-Session Sprite Mapping ─────────────────────────────────────────────

// Each session gets a random permutation of 0-51.
// Card index 0 might map to sprite position 37, etc.
// This means even if someone reverse-engineers the sprite sheet layout,
// the mapping changes every session.

export interface SpriteMapping {
  // Forward: real card index → sprite position
  forward: number[];
  // Reverse: sprite position → real card index
  reverse: number[];
  // Salt for additional encryption
  salt: string;
}

export function generateSpriteMapping(): SpriteMapping {
  // Fisher-Yates shuffle of 0-51
  const forward = Array.from({ length: 52 }, (_, i) => i);
  for (let i = 51; i > 0; i--) {
    const j = randomBytes(4).readUInt32BE(0) % (i + 1);
    [forward[i], forward[j]] = [forward[j], forward[i]];
  }

  // Build reverse mapping
  const reverse = new Array(52);
  for (let i = 0; i < 52; i++) {
    reverse[forward[i]] = i;
  }

  const salt = randomBytes(16).toString("hex");

  return { forward, reverse, salt };
}

// ─── Session Sprite Store ───────────────────────────────────────────────────

const sessionSpriteMappings = new Map<string, SpriteMapping>();

export function getOrCreateSpriteMapping(userId: string): SpriteMapping {
  let mapping = sessionSpriteMappings.get(userId);
  if (!mapping) {
    mapping = generateSpriteMapping();
    sessionSpriteMappings.set(userId, mapping);
  }
  return mapping;
}

export function clearSpriteMapping(userId: string): void {
  sessionSpriteMappings.delete(userId);
}

// ─── Obfuscate Card Data ────────────────────────────────────────────────────

/**
 * Transform a card from readable { suit, rank } into obfuscated format.
 * Returns an object that the client can only decode with the session key.
 *
 * Output: { _o: encrypted_sprite_position, _s: salt_hint }
 * The client uses its session key + sprite mapping to decode.
 */
export function obfuscateCard(
  card: { suit: string; rank: string; hidden?: boolean },
  userId: string,
  sessionKeyHex: string
): any {
  if (card.hidden) return { hidden: true };

  const mapping = getOrCreateSpriteMapping(userId);
  const realIndex = cardToIndex(card.suit, card.rank);
  if (realIndex < 0) return card; // unknown card, pass through

  // Map to scrambled sprite position
  const spritePos = mapping.forward[realIndex];

  // Encrypt the sprite position with session key
  const key = Buffer.from(sessionKeyHex.slice(0, 64), "hex"); // use first 32 bytes
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = JSON.stringify({ i: spritePos, r: card.rank, s: card.suit });
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    _o: `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`,
    _s: mapping.salt.slice(0, 8), // partial salt hint for client-side cache key
  };
}

/**
 * Obfuscate an array of cards for a specific player.
 * Hidden cards stay as { hidden: true }.
 * Real cards become encrypted objects.
 */
export function obfuscateCards(
  cards: any[],
  userId: string,
  sessionKeyHex: string
): any[] {
  return cards.map(card => {
    if (!card || card.hidden || card.encrypted) return card;
    return obfuscateCard(card, userId, sessionKeyHex);
  });
}

/**
 * Get the sprite mapping data to send to the client (encrypted).
 * The client needs this to know which sprite position maps to which visual.
 */
export function getEncryptedSpriteMapping(userId: string, sessionKeyHex: string): string | null {
  const mapping = sessionSpriteMappings.get(userId);
  if (!mapping) return null;

  // Encrypt the full forward mapping with the session key
  const key = Buffer.from(sessionKeyHex.slice(0, 64), "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = JSON.stringify(mapping.forward);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}
