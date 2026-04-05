/**
 * Game Server — Standalone entry point for the poker game engine process.
 *
 * Runs independently of the main API server. Communicates via Redis pub/sub:
 *   - Subscribes to `game:command` for commands from the API server
 *   - Publishes game state to `game:state:{tableId}` channels
 *   - Publishes hand results to `game:results` for payment/stats processing
 *
 * Required env vars: REDIS_URL, DATABASE_URL
 * Optional env vars: GAME_SERVER_PORT (default 5001)
 */

import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import Redis from "ioredis";
import { tableManager } from "./game/table-manager";
import { fastFoldManager } from "./game/fast-fold-manager";
import {
  type GameCommand,
  type GameEvent,
  GAME_COMMAND_CHANNEL,
  GAME_RESULTS_CHANNEL,
  gameStateChannel,
} from "./game-protocol";

// ─── Validate required environment ──────────────────────────────────────────

if (!process.env.REDIS_URL) {
  console.error("[game-server] REDIS_URL is required. Exiting.");
  process.exit(1);
}

// ─── Redis connections ──────────────────────────────────────────────────────

const redisSub = new Redis(process.env.REDIS_URL);
const redisPub = new Redis(process.env.REDIS_URL);

// ─── WebSocket client registry (mirrors websocket.ts structure) ─────────────

interface GameWsClient {
  ws: WebSocket;
  userId: string;
  displayName: string;
  tableIds: Set<string>;
}

const clients = new Map<string, GameWsClient>();

function sendToUser(userId: string, msg: any) {
  const client = clients.get(userId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(msg));
  }
}

function broadcastToTable(tableId: string, msg: any, excludeUserId?: string) {
  const tagged = { ...msg, tableId };
  clients.forEach((client) => {
    if (
      client.tableIds.has(tableId) &&
      client.userId !== excludeUserId &&
      client.ws.readyState === WebSocket.OPEN
    ) {
      client.ws.send(JSON.stringify(tagged));
    }
  });
}

function sendGameStateToTable(tableId: string) {
  const instance = tableManager.getTable(tableId);
  if (!instance) return;

  clients.forEach((client) => {
    if (client.tableIds.has(tableId) && client.ws.readyState === WebSocket.OPEN) {
      const state = instance.getStateForPlayer(client.userId);
      client.ws.send(JSON.stringify({ type: "game_state", tableId, state }));
    }
  });
}

// ─── Publish game events to Redis ───────────────────────────────────────────

async function publishGameEvent(event: GameEvent) {
  try {
    if (event.type === "state_update" && event.tableId) {
      await redisPub.publish(
        gameStateChannel(event.tableId),
        JSON.stringify(event)
      );
    } else if (event.type === "hand_complete") {
      await redisPub.publish(GAME_RESULTS_CHANNEL, JSON.stringify(event));
    } else {
      // Other events go to both the state channel and results channel
      if ("tableId" in event && event.tableId) {
        await redisPub.publish(
          gameStateChannel(event.tableId),
          JSON.stringify(event)
        );
      }
    }
  } catch (err) {
    console.error("[game-server] Failed to publish event:", err);
  }
}

// ─── Command handler ────────────────────────────────────────────────────────

async function handleCommand(command: GameCommand) {
  switch (command.type) {
    case "create_table": {
      const { tableId } = command;
      // The table will be lazily loaded from the database by tableManager.ensureTable
      // when the first player joins. We publish a confirmation event.
      await publishGameEvent({ type: "table_created", tableId });
      console.log(`[game-server] Table creation acknowledged: ${tableId}`);
      break;
    }

    case "join_table": {
      const { tableId, userId, displayName, buyIn, seatIndex } = command;
      try {
        const result = await tableManager.joinTable(
          tableId,
          userId,
          displayName,
          buyIn,
          seatIndex
        );
        if (result.ok) {
          await publishGameEvent({
            type: "player_joined",
            tableId,
            userId,
            seatIndex: seatIndex ?? -1,
          });
          // Broadcast updated state to all players at the table
          sendGameStateToTable(tableId);
        } else {
          await publishGameEvent({
            type: "error",
            tableId,
            userId,
            message: result.error || "Failed to join table",
          });
        }
      } catch (err: any) {
        console.error(`[game-server] join_table error:`, err.message);
        await publishGameEvent({
          type: "error",
          tableId,
          userId,
          message: err.message,
        });
      }
      break;
    }

    case "leave_table": {
      const { tableId, userId } = command;
      try {
        await tableManager.leaveTable(tableId, userId);
        await publishGameEvent({ type: "player_left", tableId, userId });
        sendGameStateToTable(tableId);
      } catch (err: any) {
        console.error(`[game-server] leave_table error:`, err.message);
      }
      break;
    }

    case "player_action": {
      const { tableId, userId, action, amount, actionNumber } = command;
      try {
        const result = tableManager.handleAction(
          tableId,
          userId,
          action,
          amount,
          actionNumber
        );
        if (!result.ok) {
          await publishGameEvent({
            type: "error",
            tableId,
            userId,
            message: result.error || "Action failed",
          });
        }
        // State is broadcast by the engine's internal callbacks
        sendGameStateToTable(tableId);
      } catch (err: any) {
        console.error(`[game-server] player_action error:`, err.message);
      }
      break;
    }

    case "start_hand": {
      const { tableId } = command;
      const instance = tableManager.getTable(tableId);
      if (instance) {
        instance.engine.startHand();
        sendGameStateToTable(tableId);
      }
      break;
    }

    case "sit_out": {
      const { tableId, userId } = command;
      tableManager.setSitOut(tableId, userId, true);
      sendGameStateToTable(tableId);
      break;
    }

    case "sit_in": {
      const { tableId, userId } = command;
      tableManager.setSitOut(tableId, userId, false);
      sendGameStateToTable(tableId);
      break;
    }

    case "add_chips": {
      // The API server handles wallet deduction and validation.
      // This handler only applies the chip change to the in-memory engine state.
      const { tableId, userId, amount } = command;
      const instance = tableManager.getTable(tableId);
      if (instance) {
        const player = instance.engine.getPlayer(userId);
        if (player && amount > 0) {
          // Only allow between hands
          const { phase } = instance.engine.state;
          if (phase === "waiting" || phase === "showdown") {
            player.chips += amount;
            sendGameStateToTable(tableId);
          } else {
            await publishGameEvent({
              type: "error",
              tableId,
              userId,
              message: "Can only add chips between hands",
            });
          }
        }
      }
      break;
    }

    case "shutdown": {
      console.log("[game-server] Received shutdown command via Redis.");
      await gracefulShutdown("REDIS_SHUTDOWN");
      break;
    }

    default: {
      console.warn(
        `[game-server] Unknown command type: ${(command as any).type}`
      );
    }
  }
}

// ─── Subscribe to game commands ─────────────────────────────────────────────

redisSub.subscribe(GAME_COMMAND_CHANNEL, (err) => {
  if (err) {
    console.error("[game-server] Failed to subscribe to game:command:", err);
    process.exit(1);
  }
  console.log(`[game-server] Subscribed to ${GAME_COMMAND_CHANNEL}`);
});

redisSub.on("message", (channel: string, raw: string) => {
  if (channel !== GAME_COMMAND_CHANNEL) return;
  try {
    const command: GameCommand = JSON.parse(raw);
    handleCommand(command).catch((err) => {
      console.error("[game-server] Command handler error:", err);
    });
  } catch (err) {
    console.error("[game-server] Malformed command message:", raw);
  }
});

// ─── Express app (minimal — health endpoint only) ───────────────────────────

const app = express();
const server = http.createServer(app);

app.get("/health", (_req, res) => {
  const activeTables: string[] = [];
  const connectedPlayers = clients.size;

  // Gather active table IDs from connected clients
  const tableIdSet = new Set<string>();
  clients.forEach((client) => {
    client.tableIds.forEach((tid) => tableIdSet.add(tid));
  });
  tableIdSet.forEach((tid) => activeTables.push(tid));

  res.json({
    status: "ok",
    uptime: process.uptime(),
    activeTables: activeTables.length,
    activeTableIds: activeTables,
    connectedPlayers,
    memoryUsage: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  });
});

// ─── WebSocket server (game-only, no REST routes) ───────────────────────────

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  // Only handle /ws path
  if (!req.url?.startsWith("/ws")) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", (ws: WebSocket, req) => {
  // Expect userId and displayName via query params for the game server
  // (the API server is responsible for authentication before proxying)
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const userId = url.searchParams.get("userId");
  const displayName = url.searchParams.get("displayName") || "Player";

  if (!userId) {
    ws.close(4001, "Missing userId");
    return;
  }

  // Register client
  const client: GameWsClient = {
    ws,
    userId,
    displayName,
    tableIds: new Set(),
  };
  clients.set(userId, client);
  console.log(`[game-server] Client connected: ${userId} (${displayName})`);

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      handleWsMessage(client, msg);
    } catch {
      // Ignore malformed messages
    }
  });

  ws.on("close", () => {
    // Clean up client from all tables
    client.tableIds.forEach((tableId) => {
      // Mark as disconnected rather than removing immediately
      const instance = tableManager.getTable(tableId);
      if (instance) {
        const player = instance.engine.getPlayer(userId);
        if (player) {
          player.isConnected = false;
        }
      }
    });
    clients.delete(userId);
    console.log(`[game-server] Client disconnected: ${userId}`);
  });
});

function handleWsMessage(client: GameWsClient, msg: any) {
  // Handle direct WebSocket messages (for clients connected directly to game server)
  switch (msg.type) {
    case "join_table": {
      const { tableId } = msg;
      if (tableId) {
        client.tableIds.add(tableId);
      }
      // Forward as a game command
      handleCommand({
        type: "join_table",
        tableId: msg.tableId,
        userId: client.userId,
        displayName: client.displayName,
        buyIn: msg.buyIn || 0,
        seatIndex: msg.seatIndex,
      });
      break;
    }

    case "leave_table": {
      const tableId = msg.tableId || client.tableIds.values().next().value;
      if (tableId) {
        client.tableIds.delete(tableId);
        handleCommand({
          type: "leave_table",
          tableId,
          userId: client.userId,
        });
      }
      break;
    }

    case "player_action": {
      const tableId = msg.tableId || client.tableIds.values().next().value;
      if (tableId) {
        handleCommand({
          type: "player_action",
          tableId,
          userId: client.userId,
          action: msg.action,
          amount: msg.amount,
          actionNumber: msg.actionNumber,
        });
      }
      break;
    }

    case "sit_out": {
      const tableId = msg.tableId || client.tableIds.values().next().value;
      if (tableId) {
        handleCommand({ type: "sit_out", tableId, userId: client.userId });
      }
      break;
    }

    case "sit_in": {
      const tableId = msg.tableId || client.tableIds.values().next().value;
      if (tableId) {
        handleCommand({ type: "sit_in", tableId, userId: client.userId });
      }
      break;
    }

    default:
      // Unknown message type — ignore
      break;
  }
}

// ─── Graceful shutdown ──────────────────────────────────────────────────────

let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`[game-server] ${signal} received — shutting down gracefully...`);

  // 1. Stop accepting new commands
  try {
    await redisSub.unsubscribe(GAME_COMMAND_CHANNEL);
  } catch {}

  // 2. Close all WebSocket connections
  clients.forEach((client) => {
    try {
      client.ws.close(1001, "Server shutting down");
    } catch {}
  });
  clients.clear();

  // 3. Close WebSocket server
  wss.close();

  // 4. Close HTTP server
  server.close();

  // 5. Disconnect Redis
  try {
    redisSub.disconnect();
    redisPub.disconnect();
  } catch {}

  console.log("[game-server] Shutdown complete.");
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Force exit after 10 seconds if graceful shutdown stalls
process.on("SIGTERM", () => {
  setTimeout(() => {
    console.error("[game-server] Graceful shutdown timed out — forcing exit.");
    process.exit(1);
  }, 10000).unref();
});

// ─── Start server ───────────────────────────────────────────────────────────

const port = parseInt(process.env.GAME_SERVER_PORT || "5001", 10);

server.listen(port, "0.0.0.0", () => {
  console.log(`[game-server] Game engine running on port ${port}`);
  console.log(`[game-server] Health: http://localhost:${port}/health`);
  console.log(`[game-server] WebSocket: ws://localhost:${port}/ws`);
  console.log(`[game-server] Redis command channel: ${GAME_COMMAND_CHANNEL}`);
});
