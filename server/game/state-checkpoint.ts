/**
 * Game State Checkpointing — persists active game state so hands survive server crashes.
 *
 * Uses Redis when REDIS_URL is set (fast, shared across instances).
 * Falls back to in-memory (no persistence, but no overhead either).
 *
 * State is saved after every player action and cleared when a hand completes.
 * On server startup, any in-progress hands can be restored.
 */

import { createCache, type ICache } from "../infra/cache-adapter";

interface TableCheckpoint {
  tableId: string;
  engineState: any; // serialized GameEngineState
  config: any; // table config needed to reconstruct
  timestamp: number;
}

// TTL: 2 hours — if a hand hasn't completed in 2 hours, something is very wrong
const CHECKPOINT_TTL = 2 * 60 * 60;

const checkpointCache: ICache<TableCheckpoint> = createCache<TableCheckpoint>("game:checkpoint");

/**
 * Save a snapshot of the current game state for a table.
 * Called after every player action during an active hand.
 */
export async function saveCheckpoint(tableId: string, engineState: any, config: any): Promise<void> {
  try {
    await checkpointCache.set(tableId, {
      tableId,
      engineState,
      config,
      timestamp: Date.now(),
    }, CHECKPOINT_TTL);
  } catch (err) {
    // Non-fatal — checkpoint failure shouldn't block gameplay
    console.warn(`[checkpoint] Failed to save state for table ${tableId}:`, (err as Error).message);
  }
}

/**
 * Clear the checkpoint for a table (called when hand completes normally).
 */
export async function clearCheckpoint(tableId: string): Promise<void> {
  try {
    await checkpointCache.delete(tableId);
  } catch {
    // Non-fatal
  }
}

/**
 * Load a checkpoint for a specific table (used during crash recovery).
 */
export async function loadCheckpoint(tableId: string): Promise<TableCheckpoint | null> {
  try {
    const checkpoint = await checkpointCache.get(tableId);
    return checkpoint || null;
  } catch {
    return null;
  }
}

/**
 * Check if any checkpoints exist (called on startup to detect incomplete hands).
 * Note: Only works with Redis — in-memory cache is empty after restart.
 */
export function isCheckpointingAvailable(): boolean {
  return !!process.env.REDIS_URL;
}
