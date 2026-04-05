/**
 * API Gateway — Bridges the API server to the Game Engine via Redis pub/sub.
 *
 * When running in split-service mode (SERVICE_MODE=api), the API server cannot
 * directly call game logic. Instead, commands are published to Redis and the
 * game engine process picks them up.
 */

import { getPubSub } from "./infra/ws-pubsub";

export interface GameCommand {
  type: string;
  tableId?: string;
  userId?: string;
  payload?: Record<string, unknown>;
}

/**
 * Send a game command to the game engine via Redis pub/sub.
 * The game engine subscribes to "game:command" and processes these.
 */
export async function sendGameCommand(command: GameCommand): Promise<void> {
  await getPubSub().publish("game:command", command);
}

/**
 * Listen for game state events from the game engine.
 * The API server can use this to forward state updates to connected clients
 * (e.g., via SSE or a lightweight WS proxy).
 */
export function listenGameEvents(
  handler: (channel: string, event: unknown) => void,
): () => void {
  const unsubscribe = getPubSub().subscribe("game:state", (event) => {
    handler("game:state", event);
  });
  return unsubscribe;
}
