import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { RequestHandler, Request } from "express";
import type { IncomingMessage } from "http";
import passport from "passport";
import { tableManager } from "./game/table-manager";
import { storage } from "./storage";
import { isIpBlocked } from "./middleware/geofence";
import { isSystemLocked } from "./routes";

// Client connection with metadata
export interface WsClient {
  ws: WebSocket;
  userId: string;
  displayName: string;
  tableId: string | null;
}

// Message types: Client → Server
export type ClientMessage =
  | { type: "join_table"; tableId: string; seatIndex?: number; buyIn: number; password?: string }
  | { type: "leave_table" }
  | { type: "player_action"; action: "fold" | "check" | "call" | "raise"; amount?: number; actionNumber?: number }
  | { type: "sit_out" }
  | { type: "sit_in" }
  | { type: "add_chips"; amount: number }
  | { type: "add_bots" }
  | { type: "chat"; message: string }
  | { type: "emote"; emoteId: string }
  | { type: "taunt"; tauntId: string }
  | { type: "seed_commit"; commitmentHash: string }
  | { type: "seed_reveal"; seed: string }
  | { type: "buy_time" }
  | { type: "accept_insurance" }
  | { type: "decline_insurance" }
  | { type: "run_it_vote"; count: 1 | 2 | 3 }
  | { type: "rtc_signal"; targetUserId: string; signal: any }
  | { type: "rtc_toggle"; video: boolean; audio: boolean };

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
  | { type: "taunt"; userId: string; displayName: string; tauntId: string; text: string }
  | { type: "seed_request"; handNumber: number; deadline: number }
  | { type: "seeds_collected"; count: number }
  | { type: "onchain_proof"; commitTx: string | null; revealTx: string | null }
  // New format-related messages
  | { type: "blind_increase"; level: number; sb: number; bb: number; ante: number }
  | { type: "player_eliminated"; playerId: string; displayName: string; finishPlace: number; prizeAmount: number }
  | { type: "tournament_complete"; results: any[]; prizePool: number }
  | { type: "bomb_pot_starting" }
  | { type: "tournament_status"; status: string; prizePool: number }
  | { type: "format_info"; gameFormat: string; currentBlindLevel: number; nextLevelIn: number; playersRemaining: number; isBombPot: boolean }
  | { type: "rtc_signal"; fromUserId: string; signal: any }
  | { type: "rtc_toggle"; userId: string; video: boolean; audio: boolean };

// Global map of connected clients
const clients = new Map<string, WsClient>();

// Rate limiting: sliding window per client (max messages per second)
const RATE_LIMIT_MAX = 20; // max 20 messages per window
const RATE_LIMIT_WINDOW_MS = 1000; // 1 second window
const rateLimitBuckets = new Map<string, number[]>(); // userId → timestamps

// Taunt cooldown: 5 seconds between taunts per user
const TAUNT_COOLDOWN_MS = 5000;
const tauntCooldowns = new Map<string, number>(); // userId → last taunt timestamp

// Taunt definitions (server-side copy for validation and text lookup)
const FREE_TAUNT_IDS = new Set([
  "gg", "nice-hand", "gl", "well-played", "thats-poker", "nice-try",
  "i-smell-bluff", "hmm", "patience", "bad-beat", "lets-go", "fold-pre",
]);

const TAUNT_TEXT: Record<string, string> = {
  "gg": "Good game!", "nice-hand": "Nice hand!", "gl": "Good luck!",
  "well-played": "Well played", "thats-poker": "That's poker, baby!",
  "nice-try": "Nice try!", "i-smell-bluff": "I smell a bluff...",
  "hmm": "Hmm... interesting", "patience": "Patience pays off",
  "bad-beat": "Brutal bad beat", "lets-go": "Let's gooo!",
  "fold-pre": "Should've folded pre",
  // Premium
  "ship-it": "Ship it!", "easy-money": "Easy money",
  "pay-me": "Pay me.", "own-table": "I own this table",
  "read-you": "Read you like a book", "drawing-dead": "You're drawing dead",
  "run-it": "Run it twice? I don't need to", "the-nuts": "The nuts, baby!",
  "call-clock": "Call the clock!", "crying-call": "That's a crying call",
  "grandma": "My grandma plays better", "reload": "Time to reload",
  "math": "I did the math", "scared-money": "Scared money don't make money",
  "all-day": "I can do this all day", "respect": "Respect the raise",
};

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

// Clear a user's table association (used when pending-leave cash-out completes)
export function clearClientTable(userId: string) {
  const client = clients.get(userId);
  if (client) {
    client.tableId = null;
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

  wss.on("connection", async (ws: WebSocket, _req: IncomingMessage, user: Express.User) => {
    // Geofence check on WebSocket connection
    const clientIp = (_req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || _req.socket.remoteAddress || "";
    try {
      if (await isIpBlocked(clientIp)) {
        ws.close(1008, "Service not available in your jurisdiction");
        return;
      }
    } catch {} // graceful: allow on error

    console.log(`[ws] client connected: ${user.displayName || user.username} (${user.id})`);
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
        console.log(`[ws] ${client.displayName}: ${msg.type}${client.tableId ? ` (table: ${client.tableId.slice(0,8)})` : " (no table)"}`);
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
      // Kill switch: block buy-ins when system is locked
      if (isSystemLocked()) {
        sendToUser(client.userId, { type: "error", message: "System is temporarily locked for maintenance" });
        return;
      }
      // Validate password for private tables
      const tableInfo = await storage.getTable(msg.tableId);
      if (tableInfo?.isPrivate && tableInfo.password) {
        if (!msg.password || msg.password !== tableInfo.password) {
          sendToUser(client.userId, { type: "error", message: "Incorrect table password" });
          return;
        }
      }
      // Try joining the new table first before leaving the old one
      const previousTableId = client.tableId;
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
      // Join succeeded — now leave the old table
      if (previousTableId && previousTableId !== msg.tableId) {
        await tableManager.leaveTable(previousTableId, client.userId);
        sendGameStateToTable(previousTableId);
      }
      client.tableId = msg.tableId;
      sendGameStateToTable(msg.tableId);

      // Send recent chat history to the joining player
      storage.getRecentChatMessages(msg.tableId, 30).then(messages => {
        if (messages.length > 0) {
          sendToUser(client.userId, {
            type: "chat_history",
            messages: messages.map(m => ({
              userId: m.userId,
              displayName: m.username,
              message: m.message,
              timestamp: m.createdAt.toISOString(),
            })),
          } as any);
        }
      }).catch(() => {});
      break;
    }

    case "leave_table": {
      if (!client.tableId) return;
      const leaveTableId = client.tableId;
      await tableManager.leaveTable(leaveTableId, client.userId);

      // Check if the player was flagged as pending leave (still in hand)
      const stillAtTable = tableManager.getTable(leaveTableId)?.engine.getPlayer(client.userId);
      if (!stillAtTable) {
        // Immediate removal — clear client table reference
        client.tableId = null;
      } else {
        // Pending leave — player stays until hand ends, then auto-removed
        sendToUser(client.userId, { type: "info", message: "You will leave after this hand completes" } as any);
      }
      sendGameStateToTable(leaveTableId);
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
      if (isSystemLocked()) {
        sendToUser(client.userId, { type: "error", message: "System is temporarily locked for maintenance" });
        return;
      }
      const amount = msg.amount;
      if (!amount || amount <= 0) return;
      // Verify user has enough chips in cash_game wallet and add to stack
      const table = await storage.getTable(client.tableId);
      if (!table) return;
      const instance = tableManager.getTable(client.tableId);
      if (!instance) return;
      const player = instance.engine.getPlayer(client.userId);
      if (!player) return;
      // Only allow adding chips when not in an active hand
      if (instance.engine.state.phase !== "waiting" && instance.engine.state.phase !== "showdown") {
        sendToUser(client.userId, { type: "error", message: "Can only add chips between hands" });
        return;
      }
      // Cap so total stack doesn't exceed maxBuyIn
      const maxAdd = Math.max(0, table.maxBuyIn - player.chips);
      const addAmount = Math.min(amount, maxAdd);
      if (addAmount <= 0) {
        sendToUser(client.userId, { type: "error", message: "Invalid amount" });
        return;
      }
      // Atomically deduct from cash_game wallet
      await storage.ensureWallets(client.userId);
      const { success: deducted, newBalance: newWalletBalance } = await storage.atomicDeductFromWallet(client.userId, "cash_game", addAmount);
      if (!deducted) {
        sendToUser(client.userId, { type: "error", message: "Insufficient chips in cash game wallet" });
        return;
      }
      // Record the transaction
      await storage.createTransaction({
        userId: client.userId,
        type: "withdraw",
        amount: -addAmount,
        balanceBefore: newWalletBalance + addAmount,
        balanceAfter: newWalletBalance,
        tableId: client.tableId,
        description: "Added chips to table",
        walletType: "cash_game",
        relatedTransactionId: null,
        paymentId: null,
        metadata: null,
      });
      player.chips += addAmount;
      // Persist chip change to table_players for atomicity
      try {
        await storage.updateTablePlayerChips(client.tableId, client.userId, player.chips);
      } catch (persistErr) {
        // Rollback in-memory change and refund wallet
        player.chips -= addAmount;
        await storage.atomicAddToWallet(client.userId, "cash_game", addAmount);
        sendToUser(client.userId, { type: "error", message: "Failed to add chips, please try again" });
        break;
      }
      // Send confirmation with new wallet balance so client can update display
      sendToUser(client.userId, {
        type: "chips_added",
        amount: addAmount,
        newTableStack: player.chips,
        newWalletBalance,
      } as any);
      sendGameStateToTable(client.tableId);
      break;
    }

    case "add_bots": {
      if (!client.tableId) {
        sendToUser(client.userId, { type: "error", message: "Not seated at a table — please rejoin" });
        return;
      }
      await tableManager.addBots(client.tableId);
      sendGameStateToTable(client.tableId);
      break;
    }

    case "chat": {
      if (!client.tableId) return;
      const chatMsg = msg.message?.slice(0, 200);
      if (!chatMsg) return;
      // Persist chat message
      storage.saveChatMessage(client.tableId, client.userId, client.displayName, chatMsg).catch(() => {});
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

    case "taunt": {
      if (!client.tableId) return;
      const tauntId = msg.tauntId?.slice(0, 30);
      if (!tauntId) return;

      // Validate taunt exists
      const tauntText = TAUNT_TEXT[tauntId];
      if (!tauntText) {
        sendToUser(client.userId, { type: "error", message: "Unknown taunt" });
        return;
      }

      // Check cooldown (5 seconds between taunts)
      const now = Date.now();
      const lastTaunt = tauntCooldowns.get(client.userId) || 0;
      if (now - lastTaunt < TAUNT_COOLDOWN_MS) {
        sendToUser(client.userId, { type: "error", message: "Taunt cooldown active" });
        return;
      }

      // If premium taunt, validate ownership
      if (!FREE_TAUNT_IDS.has(tauntId)) {
        const inventory = await storage.getUserInventory(client.userId);
        const shopItems = await storage.getShopItems("taunt");
        const ownedItemIds = new Set(inventory.map(i => i.itemId));
        // Find the shop item that corresponds to this taunt
        const tauntShopItem = shopItems.find(item =>
          item.description?.includes(tauntId) || item.name === tauntText
        );
        if (!tauntShopItem || !ownedItemIds.has(tauntShopItem.id)) {
          sendToUser(client.userId, { type: "error", message: "You don't own this taunt" });
          return;
        }
      }

      tauntCooldowns.set(client.userId, now);
      broadcastToTable(client.tableId, {
        type: "taunt",
        userId: client.userId,
        displayName: client.displayName,
        tauntId,
        text: tauntText,
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

    case "buy_time": {
      if (!client.tableId) return;
      const result = tableManager.handleBuyTime(client.tableId, client.userId);
      if (!result.ok) {
        sendToUser(client.userId, { type: "error", message: result.error! });
        return;
      }
      sendGameStateToTable(client.tableId);
      break;
    }

    case "accept_insurance": {
      if (!client.tableId) return;
      const result = tableManager.handleInsuranceResponse(client.tableId, client.userId, true);
      if (!result.ok) {
        sendToUser(client.userId, { type: "error", message: result.error! });
        return;
      }
      sendGameStateToTable(client.tableId);
      break;
    }

    case "decline_insurance": {
      if (!client.tableId) return;
      const result = tableManager.handleInsuranceResponse(client.tableId, client.userId, false);
      if (!result.ok) {
        sendToUser(client.userId, { type: "error", message: result.error! });
        return;
      }
      sendGameStateToTable(client.tableId);
      break;
    }

    case "run_it_vote": {
      if (!client.tableId) return;
      const count = msg.count;
      if (count !== 1 && count !== 2 && count !== 3) return;
      const result = tableManager.handleRunItVote(client.tableId, client.userId, count);
      if (!result.ok) {
        sendToUser(client.userId, { type: "error", message: result.error! });
        return;
      }
      sendGameStateToTable(client.tableId);
      break;
    }

    case "rtc_signal": {
      // Relay WebRTC signaling to target peer
      const targetId = msg.targetUserId;
      if (!targetId) return;
      sendToUser(targetId, {
        type: "rtc_signal",
        fromUserId: client.userId,
        signal: msg.signal,
      });
      break;
    }

    case "rtc_toggle": {
      // Broadcast media toggle to table
      if (!client.tableId) return;
      broadcastToTable(client.tableId, {
        type: "rtc_toggle",
        userId: client.userId,
        video: msg.video,
        audio: msg.audio,
      }, client.userId);
      break;
    }
  }
}
