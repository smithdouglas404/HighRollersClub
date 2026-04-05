/**
 * Client-Side Card Security — 4-Level Anti-Scraping
 *
 * Level 1: Decrypt obfuscated card indices from server
 * Level 2: Canvas rendering helpers (no DOM nodes for cards)
 * Level 3: Decode per-session sprite mapping
 * Level 4: Decrypt card data from encrypted React state
 *
 * All decryption uses the AES-256-GCM session key received at WebSocket connect.
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

// ─── AES-256-GCM Decryption (Web Crypto API) ───────────────────────────────

async function aesDecrypt(encryptedStr: string, keyHex: string): Promise<string | null> {
  try {
    const [ivHex, authTagHex, ciphertextHex] = encryptedStr.split(":");
    const key = await crypto.subtle.importKey("raw", hexToBytes(keyHex), "AES-GCM", false, ["decrypt"]);
    const iv = hexToBytes(ivHex);
    const authTag = hexToBytes(authTagHex);
    const ciphertext = hexToBytes(ciphertextHex);
    // GCM auth tag appended to ciphertext for Web Crypto
    const combined = new Uint8Array(ciphertext.length + authTag.length);
    combined.set(ciphertext);
    combined.set(authTag, ciphertext.length);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, combined);
    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

// ─── Level 1: Decrypt obfuscated card ───────────────────────────────────────

export async function decryptObfuscatedCard(
  obfuscated: { _o: string; _s: string },
  keyHex: string
): Promise<{ suit: string; rank: string } | null> {
  const decrypted = await aesDecrypt(obfuscated._o, keyHex);
  if (!decrypted) return null;
  try {
    const parsed = JSON.parse(decrypted);
    return { suit: parsed.s, rank: parsed.r };
  } catch {
    return null;
  }
}

// ─── Level 3: Decrypt sprite mapping ────────────────────────────────────────

let cachedSpriteMapping: number[] | null = null;

export async function decryptSpriteMapping(encryptedMapping: string, keyHex: string): Promise<number[]> {
  const decrypted = await aesDecrypt(encryptedMapping, keyHex);
  if (!decrypted) return Array.from({ length: 52 }, (_, i) => i); // fallback: identity
  try {
    const mapping = JSON.parse(decrypted);
    cachedSpriteMapping = mapping;
    return mapping;
  } catch {
    return Array.from({ length: 52 }, (_, i) => i);
  }
}

export function getSpriteMapping(): number[] | null {
  return cachedSpriteMapping;
}

// ─── Level 4: Decrypt encrypted cards array ─────────────────────────────────

export async function decryptCards(encryptedStr: string, keyHex: string): Promise<any[] | null> {
  const decrypted = await aesDecrypt(encryptedStr, keyHex);
  if (!decrypted) return null;
  try {
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
}

// ─── Level 2: Canvas Card Renderer ──────────────────────────────────────────

const SUITS_DISPLAY: Record<string, { symbol: string; color: string }> = {
  hearts:   { symbol: "♥", color: "#ef4444" },
  diamonds: { symbol: "♦", color: "#3b82f6" },
  clubs:    { symbol: "♣", color: "#22c55e" },
  spades:   { symbol: "♠", color: "#94a3b8" },
};

/**
 * Render a card directly onto a canvas element.
 * No DOM nodes are created — the card is pure pixels.
 * A scraper would need OCR to read this.
 */
export function renderCardToCanvas(
  canvas: HTMLCanvasElement,
  card: { suit: string; rank: string },
  options?: { width?: number; height?: number; isHero?: boolean }
): void {
  const w = options?.width || canvas.width || 70;
  const h = options?.height || canvas.height || 105;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const isHero = options?.isHero || false;
  const suitInfo = SUITS_DISPLAY[card.suit] || { symbol: "?", color: "#888" };

  // Card background
  ctx.fillStyle = "#fdfee8";
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 6);
  ctx.fill();

  // Border
  ctx.strokeStyle = isHero ? "#d4af37" : "rgba(180,160,120,0.5)";
  ctx.lineWidth = isHero ? 2 : 1.5;
  ctx.stroke();

  // Light sheen
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, "rgba(255,255,255,0.15)");
  gradient.addColorStop(0.3, "transparent");
  gradient.addColorStop(1, "rgba(255,255,255,0.05)");
  ctx.fillStyle = gradient;
  ctx.fill();

  // Rank + suit (top-left)
  ctx.fillStyle = suitInfo.color;
  ctx.font = `bold ${Math.round(w * 0.22)}px "Space Grotesk", system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(card.rank, w * 0.1, h * 0.22);
  ctx.font = `${Math.round(w * 0.2)}px serif`;
  ctx.fillText(suitInfo.symbol, w * 0.1, h * 0.38);

  // Large center suit
  ctx.font = `${Math.round(w * 0.45)}px serif`;
  ctx.textAlign = "center";
  ctx.fillText(suitInfo.symbol, w * 0.5, h * 0.65);

  // Rank + suit (bottom-right, rotated)
  ctx.save();
  ctx.translate(w * 0.9, h * 0.82);
  ctx.rotate(Math.PI);
  ctx.font = `bold ${Math.round(w * 0.22)}px "Space Grotesk", system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(card.rank, 0, 0);
  ctx.font = `${Math.round(w * 0.2)}px serif`;
  ctx.fillText(suitInfo.symbol, 0, h * 0.16);
  ctx.restore();

  // Hero glow
  if (isHero) {
    ctx.shadowColor = suitInfo.color;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = suitInfo.color + "40";
    ctx.lineWidth = 1;
    ctx.strokeRect(2, 2, w - 4, h - 4);
    ctx.shadowBlur = 0;
  }
}

/**
 * Render a card back onto a canvas (no card data exposed).
 */
export function renderCardBackToCanvas(
  canvas: HTMLCanvasElement,
  options?: { width?: number; height?: number }
): void {
  const w = options?.width || canvas.width || 70;
  const h = options?.height || canvas.height || 105;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Gold border
  const borderGrad = ctx.createLinearGradient(0, 0, w, h);
  borderGrad.addColorStop(0, "#d4af37");
  borderGrad.addColorStop(0.5, "#8b6914");
  borderGrad.addColorStop(1, "#d4af37");
  ctx.fillStyle = borderGrad;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 6);
  ctx.fill();

  // Inner dark
  ctx.fillStyle = "#1a1a2e";
  ctx.beginPath();
  ctx.roundRect(2, 2, w - 4, h - 4, 4);
  ctx.fill();

  // Diamond pattern
  ctx.strokeStyle = "rgba(212,175,55,0.15)";
  ctx.lineWidth = 0.5;
  for (let x = 0; x < w; x += 10) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + h, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - h, h);
    ctx.stroke();
  }

  // Center emblem
  ctx.fillStyle = "rgba(212,175,55,0.2)";
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(212,175,55,0.3)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ─── Session Key Store ──────────────────────────────────────────────────────

let sessionCardKey: string | null = null;

export function setSessionCardKey(key: string) {
  sessionCardKey = key;
}

export function getSessionCardKey(): string | null {
  return sessionCardKey;
}

export function clearSessionCardKey() {
  sessionCardKey = null;
  cachedSpriteMapping = null;
}
