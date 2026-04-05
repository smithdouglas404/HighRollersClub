/**
 * Card Encryption Layer with Blockchain Hash Commitment
 *
 * Security model:
 * 1. On WebSocket connect, server generates a random AES-256-GCM key per player
 * 2. A SHA-256 hash commitment of (userId + sessionId + key + timestamp) is created
 * 3. Key is sent to client over the WSS connection
 * 4. Hole cards are encrypted per-player before WebSocket transmission
 * 5. Commitments are batched and anchored to Polygon every BATCH_INTERVAL
 * 6. Anyone can verify a session key was genuine by checking the on-chain Merkle root
 *
 * Tamper resistance:
 * - AES-256: 2^256 brute force (heat death of universe)
 * - GCM auth tag: detects any ciphertext modification
 * - Hash commitment: server can't retroactively change keys (hash is on-chain)
 * - Merkle root: one transaction anchors thousands of commitments
 */

import { randomBytes, createCipheriv, createDecipheriv, createHash, randomUUID } from "crypto";
import { blockchainConfig } from "../blockchain/config";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12;  // 96 bits for GCM

// ─── Session Key Store ──────────────────────────────────────────────────────

const sessionKeys = new Map<string, Buffer>();

// ─── Hash Commitment Store ──────────────────────────────────────────────────

export interface KeyCommitment {
  userId: string;
  sessionId: string;
  commitmentHash: string; // SHA-256(userId + sessionId + keyHex + timestamp)
  timestamp: number;
}

// Pending commitments waiting to be batched
const pendingCommitments: KeyCommitment[] = [];
// All commitments (for verification lookups)
const commitmentsByUser = new Map<string, KeyCommitment>();
// Anchored batch roots (batchId → { merkleRoot, txHash, commitments })
const anchoredBatches: Array<{
  batchId: string;
  merkleRoot: string;
  txHash: string | null;
  commitments: KeyCommitment[];
  anchoredAt: number;
}> = [];

// Batch settings
const BATCH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const MIN_BATCH_SIZE = 1; // Anchor even a single commitment

// ─── Key Generation with Commitment ─────────────────────────────────────────

/** Generate session key + hash commitment */
export function generateSessionKey(userId: string): string {
  const key = randomBytes(KEY_LENGTH);
  const keyHex = key.toString("hex");
  const sessionId = randomUUID();
  const timestamp = Date.now();

  sessionKeys.set(userId, key);

  // Create commitment: SHA-256(userId | sessionId | keyHex | timestamp)
  const commitmentHash = createHash("sha256")
    .update(`${userId}|${sessionId}|${keyHex}|${timestamp}`)
    .digest("hex");

  const commitment: KeyCommitment = { userId, sessionId, commitmentHash, timestamp };
  pendingCommitments.push(commitment);
  commitmentsByUser.set(userId, commitment);

  return keyHex;
}

/** Remove session key on disconnect */
export function clearSessionKey(userId: string): void {
  sessionKeys.delete(userId);
}

// ─── Encryption / Decryption ────────────────────────────────────────────────

export function encryptCards(userId: string, cards: any[]): string | null {
  const key = sessionKeys.get(userId);
  if (!key) return null;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = JSON.stringify(cards);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptCards(encryptedStr: string, keyHex: string): any[] | null {
  try {
    const [ivHex, authTagHex, ciphertextHex] = encryptedStr.split(":");
    const key = Buffer.from(keyHex, "hex");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8"));
  } catch {
    return null;
  }
}

export function hasSessionKey(userId: string): boolean {
  return sessionKeys.has(userId);
}

/** Get session key hex for obfuscation (server-side only) */
export function getSessionKeyHex(userId: string): string {
  const key = sessionKeys.get(userId);
  return key ? key.toString("hex") : "";
}

// ─── Merkle Tree ────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Build a Merkle root from an array of commitment hashes */
function buildMerkleRoot(hashes: string[]): string {
  if (hashes.length === 0) return sha256("empty");
  if (hashes.length === 1) return hashes[0];

  let layer = [...hashes];
  // Pad to even number
  if (layer.length % 2 !== 0) layer.push(layer[layer.length - 1]);

  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      next.push(sha256(layer[i] + layer[i + 1]));
    }
    layer = next;
    if (layer.length > 1 && layer.length % 2 !== 0) {
      layer.push(layer[layer.length - 1]);
    }
  }

  return layer[0];
}

// ─── Blockchain Anchoring ───────────────────────────────────────────────────

/** Anchor pending commitments to Polygon as a Merkle root */
async function anchorBatch(): Promise<void> {
  if (pendingCommitments.length < MIN_BATCH_SIZE) return;

  const batch = pendingCommitments.splice(0, pendingCommitments.length);
  const hashes = batch.map(c => c.commitmentHash);
  const merkleRoot = buildMerkleRoot(hashes);
  const batchId = randomUUID();

  let txHash: string | null = null;

  // Write Merkle root to Polygon if blockchain is enabled
  if (blockchainConfig.enabled && blockchainConfig.walletPrivateKey && blockchainConfig.rpcUrl) {
    try {
      const { ethers } = await import("ethers");
      const provider = new ethers.JsonRpcProvider(blockchainConfig.rpcUrl);
      const signer = new ethers.Wallet(blockchainConfig.walletPrivateKey, provider);

      // Send a transaction with the Merkle root as data
      // This is a simple, cheap way to anchor — just store data in tx calldata
      const rootBytes = "0x" + merkleRoot;
      const tx = await signer.sendTransaction({
        to: signer.address, // self-send (cheapest — only gas for calldata)
        value: 0,
        data: rootBytes,
      });
      const receipt = await tx.wait();
      txHash = receipt?.hash || tx.hash;

      console.log(`[CardEncryption] Anchored batch ${batchId}: ${batch.length} commitments, Merkle root ${merkleRoot.slice(0, 16)}..., tx ${txHash}`);
    } catch (err: any) {
      console.warn(`[CardEncryption] Blockchain anchor failed: ${err.message}. Batch stored locally.`);
    }
  } else {
    console.log(`[CardEncryption] Batch ${batchId}: ${batch.length} commitments, Merkle root ${merkleRoot.slice(0, 16)}... (blockchain not enabled, stored locally)`);
  }

  anchoredBatches.push({
    batchId,
    merkleRoot,
    txHash,
    commitments: batch,
    anchoredAt: Date.now(),
  });

  // Keep only last 100 batches in memory
  while (anchoredBatches.length > 100) anchoredBatches.shift();
}

// ─── Verification ───────────────────────────────────────────────────────────

/** Verify a session key commitment for a user */
export function verifySessionCommitment(userId: string): {
  found: boolean;
  commitment?: KeyCommitment;
  batch?: { batchId: string; merkleRoot: string; txHash: string | null; anchoredAt: number };
  merkleProof?: string[];
} {
  const commitment = commitmentsByUser.get(userId);
  if (!commitment) return { found: false };

  // Find which batch contains this commitment
  for (const batch of anchoredBatches) {
    const idx = batch.commitments.findIndex(c => c.commitmentHash === commitment.commitmentHash);
    if (idx >= 0) {
      // Build Merkle proof
      const proof = buildMerkleProof(batch.commitments.map(c => c.commitmentHash), idx);
      return {
        found: true,
        commitment,
        batch: { batchId: batch.batchId, merkleRoot: batch.merkleRoot, txHash: batch.txHash, anchoredAt: batch.anchoredAt },
        merkleProof: proof,
      };
    }
  }

  // Not yet anchored — still in pending
  return { found: true, commitment, batch: undefined };
}

/** Build a Merkle proof (sibling hashes needed to reconstruct root) */
function buildMerkleProof(hashes: string[], targetIdx: number): string[] {
  if (hashes.length <= 1) return [];

  let layer = [...hashes];
  if (layer.length % 2 !== 0) layer.push(layer[layer.length - 1]);

  const proof: string[] = [];
  let idx = targetIdx;

  while (layer.length > 1) {
    const sibling = idx % 2 === 0 ? idx + 1 : idx - 1;
    if (sibling < layer.length) proof.push(layer[sibling]);

    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      next.push(sha256(layer[i] + layer[i + 1]));
    }
    layer = next;
    idx = Math.floor(idx / 2);
    if (layer.length > 1 && layer.length % 2 !== 0) {
      layer.push(layer[layer.length - 1]);
    }
  }

  return proof;
}

/** Get stats for the admin dashboard */
export function getEncryptionStats(): {
  activeKeys: number;
  pendingCommitments: number;
  anchoredBatches: number;
  totalAnchored: number;
  lastAnchorTx: string | null;
} {
  const lastBatch = anchoredBatches[anchoredBatches.length - 1];
  return {
    activeKeys: sessionKeys.size,
    pendingCommitments: pendingCommitments.length,
    anchoredBatches: anchoredBatches.length,
    totalAnchored: anchoredBatches.reduce((sum, b) => sum + b.commitments.length, 0),
    lastAnchorTx: lastBatch?.txHash || null,
  };
}

// ─── Start Batch Timer ──────────────────────────────────────────────────────

setInterval(() => {
  anchorBatch().catch(err => console.error("[CardEncryption] Anchor error:", err));
}, BATCH_INTERVAL_MS);

// Anchor first batch after 30 seconds if any commitments exist
setTimeout(() => {
  if (pendingCommitments.length > 0 && anchoredBatches.length === 0) {
    anchorBatch().catch(() => {});
  }
}, 30000);

/** Force an immediate anchor (for admin use) */
export async function forceAnchor(): Promise<{ merkleRoot: string; txHash: string | null; count: number } | null> {
  if (pendingCommitments.length === 0) return null;
  const count = pendingCommitments.length;
  await anchorBatch();
  const last = anchoredBatches[anchoredBatches.length - 1];
  return last ? { merkleRoot: last.merkleRoot, txHash: last.txHash, count } : null;
}
