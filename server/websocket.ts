import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { RequestHandler, Request } from "express";
import type { IncomingMessage } from "http";
import passport from "passport";
import { tableManager } from "./game/table-manager";
import { storage } from "./storage";

// Client connection with metadata
export interface WsClient {
  ws: WebSocket;
  userId: string;
  displayName: string;
  tableId: string | null;
}

// Message types: Client → Server
export type ClientMessage =
  | { type: "join_table"; tableId: string; seatIndex?: number; buyIn: number }
  | { type: "leave_table" }
  | { type: "player_action"; action: "fold" | "check" | "call" | "raise"; amount?: number; actionNumber?: number }
  | { type: "sit_out" }
  | { type: "sit_in" }
  | { type: "add_chips"; amount: number }
  | { type: "add_bots" }
  | { type: "chat"; message: string }
  | { type: "emote"; emoteId: string }
  | { type: "seed_commit"; commitmentHash: string }
  | { type: "seed_reveal"; seed: string };

// Message types: Server → Client
export type ServerMessage =
  | { type: "game_state"; state: any }
  | { type: "player_joined"; player: any }
  | { type: "player_left"; userId: string; seatIndex: number; displayName?: string }
  | { type: "action_performed"; userId: string; action: string; amount?: number }
  | { type: "new_hand"; handNumber: number; dealerSeat: number }
  | { type: "community_cards"; cards: any[]; phase: string }
  | { type: "showdown"; results: any[] }
  | { type: "pot_update"; pot: number; sidePots?: any[] }
  | { type: "error"; message: string }
  | { type: "chat"; userId: string; displayName: string; message: string }
  | { type: "table_info"; table: any }
  | { type: "shuffle_commitment"; commitmentHash: string; handNumber: number }
  | { type: "shuffle_reveal"; proof: any }
  | { type: "emote"; userId: string; displayName: string; emoteId: string }
  | { type: "seed_request"; handNumber: number; deadline: number }
  | { type: "seeds_collected"; count: number }
  | { type: "onchain_proof"; commitTx: string | null; revealTx: string | null }
  // New format-related messages
  | { type: "blind_increase"; level: number; sb: number; bb: number; ante: number }
  | { type: "player_eliminated"; playerId: string; displayName: string; finishPlace: number; prizeAmount: number }
  | { type: "tournament_complete"; results: any[]; prizePool: number }
  | { type: "bomb_pot_starting" }
  | { type: "tournament_status"; status: string; prizePool: number }
  | { type: "format_info"; gameFormat: string; currentBlindLevel: number; nextLevelIn: number; playersRemaining: number; isBombPot: boolean };

// Global map of connected clients
const clients = new Map<string, WsClient>();

// Rate limiting: sliding window per client (max messages per second)
const RATE_LIMIT_MAX = 20; // max 20 messages per window
const RATE_LIMIT_WINDOW_MS = 1000; // 1 second window
const rateLimitBuckets = new Map<string, number[]>(); // userId → timestamps

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  let timestamps = rateLimitBuckets.get(userId);
  if (!timestamps) {
    timestamps = [];
    rateLimitBuckets.set(userId, timestamps);
  }
  // Remove expired timestamps
  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift();
  }
  if (timestamps.length >= RATE_LIMIT_MAX) {
    return true;
  }
  timestamps.push(now);
  return false;
}

export function getClients() {
  return clients;
}

// Send to a specific user
export function sendToUser(userId: string, msg: ServerMessage) {
  const client = clients.get(userId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(msg));
  }
}

// Broadcast to all users at a table
export function broadcastToTable(tableId: string, msg: ServerMessage, excludeUserId?: string) {
  clients.forEach((client) => {
    if (client.tableId === tableId && client.userId !== excludeUserId) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(msg));
      }
    }
  });
}

// Send personalized game state to each player at a table
export function sendGameStateToTable(tableId: string) {
  const instance = tableManager.getTable(tableId);
  if (!instance) return;

  clients.forEach((client) => {
    if (client.tableId === tableId && client.ws.readyState === WebSocket.OPEN) {
      const state = instance.getStateForPlayer(client.userId);
      client.ws.send(JSON.stringify({ type: "game_state", state }));
    }
  });
}

export function setupWebSocket(server: Server, sessionMiddleware: RequestHandler) {
  const wss = new WebSocketServer({ noServer: true });

  // Handle HTTP upgrade with session auth
  server.on("upgrade", (req: IncomingMessage, socket, head) => {
    // Skip non-websocket upgrades (like Vite HMR)
    if (!req.url?.startsWith("/ws")) {
      return;
    }

    // Parse session from cookie
    const mockRes = {
      setHeader: () => {},
      getHeader: () => undefined,
      writeHead: () => mockRes,
      end: () => {},
    } as any;

    sessionMiddleware(req as any, mockRes, () => {
      passport.initialize()(req as any, mockRes, () => {
        passport.session()(req as any, mockRes, () => {
          const user = (req as any).user;
          if (!user) {
            socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
            socket.destroy();
            return;
          }

          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit("connection", ws, req, user);
          });
        });
      });
    });
  });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage, user: Express.User) => {
    const client: WsClient = {
      ws,
      userId: user.id,
      displayName: user.displayName || user.username,
      tableId: null,
    };

    // Replace any existing connection for this user (reconnection)
    const existing = clients.get(user.id);
    if (existing) {
      // Reconnection: transfer table context and notify table manager
      if (existing.tableId) {
        client.tableId = existing.tableId;
        tableManager.handleReconnect(existing.tableId, user.id);
      }
      existing.ws.close(1000, "Replaced by new connection");
    }
    clients.set(user.id, client);

    // If reconnecting to a table, send current game state
    if (client.tableId) {
      sendGameStateToTable(client.tableId);
    }

    ws.on("message", async (data) => {
      try {
        // Rate limiting check
        if (isRateLimited(user.id)) {
          sendToUser(user.id, { type: "error", message: "Rate limited — slow down" });
          return;
        }
        const msg = JSON.parse(data.toString()) as ClientMessage;
        await handleMessage(client, msg);
      } catch (err: any) {
        sendToUser(user.id, { type: "error", message: err.message || "Invalid message" });
      }
    });

    ws.on("close", () => {
      // Handle disconnect — grace period handled by table manager
      if (client.tableId) {
        tableManager.handleDisconnect(client.tableId, client.userId);
      }
      clients.delete(user.id);
      rateLimitBuckets.delete(user.id);
    });

    ws.on("error", () => {
      if (client.tableId) {
        tableManager.handleDisconnect(client.tableId, client.userId);
      }
      clients.delete(user.id);
    });
  });
}

async function handleMessage(client: WsClient, msg: ClientMessage) {
  switch (msg.type) {
    case "join_table": {
      const result = await tableManager.joinTable(
        msg.tableId,
        client.userId,
        client.displayName,
        msg.buyIn,
        msg.seatIndex
      );
      if (!result.ok) {
        sendToUser(client.userId, { type: "error", message: result.error! });
        return;
      }
      client.tableId = msg.tableId;
      sendGameStateToTable(msg.tableId);
      break;
    }

    case "leave_table": {
      if (!client.tableId) return;
      await tableManager.leaveTable(client.tableId, client.userId);
      const leftTableId = client.tableId;
      client.tableId = null;
      sendGameStateToTable(leftTableId);
      break;
    }

    case "player_action": {
      if (!client.tableId) return;
      const result = tableManager.handleAction(
        client.tableId,
        client.userId,
        msg.action,
        msg.amount,
        msg.actionNumber
      );
      if (!result.ok) {
        sendToUser(client.userId, { type: "error", message: result.error! });
        return;
      }
      // Broadcast specific action performed (lightweight update)
      broadcastToTable(client.tableId, {
        type: "action_performed",
        userId: client.userId,
        action: msg.action,
        amount: msg.amount,
      });
      sendGameStateToTable(client.tableId);
      break;
    }

    case "sit_out": {
      if (!client.tableId) return;
      tableManager.setSitOut(client.tableId, client.userId, true);
      sendGameStateToTable(client.tableId);
      break;
    }

    case "sit_in": {
      if (!client.tableId) return;
      tableManager.setSitOut(client.tableId, client.userId, false);
      sendGameStateToTable(client.tableId);
      break;
    }

    case "add_chips": {
      if (!client.tableId) return;
      const amount = msg.amount;
      if (!amount || amount <= 0) return;
      // Verify user has enough chips and add to their stack
      const user = await storage.getUser(client.userId);
      if (!user || user.chipBalance < amount) {
        sendToUser(client.userId, { type: "error", message: "Insufficient chips" });
        return;
      }
      const table = await storage.getTable(client.tableId);
      if (!table) return;
      // Can only add chips between hands
      const instance = tableManager.getTable(client.tableId);
      if (!instance) return;
      const player = instance.engine.getPlayer(client.userId);
      if (!player) return;
      // Only allow adding chips when not in an active hand
      if (instance.engine.state.phase !== "waiting" && instance.engine.state.phase !== "showdown") {
        sendToUser(client.userId, { type: "error", message: "Can only add chips between hands" });
        return;
      }
      // Cap at table max buy-in
      const maxAdd = table.maxBuyIn - player.chips;
      const addAmount = Math.min(amount, maxAdd);
      if (addAmount <= 0) {
        sendToUser(client.userId, { type: "error", message: "Already at max buy-in" });
        return;
      }
      // Re-read to prevent race condition (optimistic locking)
      const freshUser = await storage.getUser(client.userId);
      if (!freshUser || freshUser.chipBalance < addAmount) {
        sendToUser(client.userId, { type: "error", message: "Insufficient chips" });
        return;
      }
      // Deduct from user balance and add to stack
      await storage.updateUser(client.userId, { chipBalance: freshUser.chipBalance - addAmount });
      // Record the transaction
      await storage.createTransaction({
        userId: client.userId,
        type: "withdraw",
        amount: -addAmount,
        balanceBefore: freshUser.chipBalance,
        balanceAfter: freshUser.chipBalance - addAmount,
        tableId: client.tableId,
        description: "Added chips to table",
      });
      player.chips += addAmount;
      sendGameStateToTable(client.tableId);
      break;
    }

    case "add_bots": {
      if (!client.tableId) return;
      await tableManager.addBots(client.tableId);
      sendGameStateToTable(client.tableId);
      break;
    }

    case "chat": {
      if (!client.tableId) return;
      const chatMsg = msg.message?.slice(0, 200);
      if (!chatMsg) return;
      broadcastToTable(client.tableId, {
        type: "chat",
        userId: client.userId,
        displayName: client.displayName,
        message: chatMsg,
      });
      break;
    }

    case "emote": {
      if (!client.tableId) return;
      const emoteId = msg.emoteId?.slice(0, 20);
      if (!emoteId) return;
      broadcastToTable(client.tableId, {
        type: "emote",
        userId: client.userId,
        displayName: client.displayName,
        emoteId,
      });
      break;
    }

    case "seed_commit": {
      if (!client.tableId) return;
      const hash = msg.commitmentHash?.slice(0, 128);
      if (!hash) return;
      tableManager.handleSeedCommit(client.tableId, client.userId, hash);
      break;
    }

    case "seed_reveal": {
      if (!client.tableId) return;
      const seed = msg.seed?.slice(0, 128);
      if (!seed) return;
      tableManager.handleSeedReveal(client.tableId, client.userId, seed);
      break;
    }
  }
}
