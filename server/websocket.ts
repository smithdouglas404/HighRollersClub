import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { RequestHandler, Request } from "express";
import type { IncomingMessage } from "http";
import passport from "passport";
import { tableManager } from "./game/table-manager";
import { storage } from "./storage";
import { isIpBlocked } from "./middleware/geofence";
import { isSystemLocked } from "./routes";
import { subscribeCommentary, unsubscribeCommentary, setOmniscientMode, getCommentaryState } from "./game/commentary-engine";
import { antiCheatEngine } from "./anti-cheat";
import { fastFoldManager } from "./game/fast-fold-manager";
import { generateSessionKey, clearSessionKey, encryptCards, hasSessionKey, getSessionKeyHex } from "./game/card-encryption";
import { obfuscateCards, getEncryptedSpriteMapping, clearSpriteMapping, getOrCreateSpriteMapping } from "./game/card-obfuscation";
import { getPubSub } from "./infra/ws-pubsub";

// Rate limiting for table password attempts
const passwordAttempts = new Map<string, number>();

// Track Redis pub/sub unsubscribe functions per user per table/club
const pubsubUnsubs = new Map<string, () => void>();

// Track club chat pub/sub unsubscribe functions per user per club
const clubChatUnsubs = new Map<string, () => void>();

// Subscribe a client to a table's Redis pub/sub channel
function subscribeClientToTable(userId: string, tableId: string) {
  const key = `${userId}:${tableId}`;
  if (pubsubUnsubs.has(key)) return; // already subscribed

  const unsub = getPubSub().subscribe(`table:${tableId}`, (data: any) => {
    // Deliver the message to this local client (if they're still connected)
    const client = clients.get(userId);
    if (client && client.ws.readyState === WebSocket.OPEN && client.userId !== data.excludeUserId) {
      client.ws.send(JSON.stringify(data.tagged));
    }
  });
  pubsubUnsubs.set(key, unsub);
}

// Unsubscribe a client from a table's Redis pub/sub channel
function unsubscribeClientFromTable(userId: string, tableId: string) {
  const key = `${userId}:${tableId}`;
  const unsub = pubsubUnsubs.get(key);
  if (unsub) {
    unsub();
    pubsubUnsubs.delete(key);
  }
}

// Subscribe a client to a club's chat Redis pub/sub channel
function subscribeClientToClubChat(userId: string, clubId: string) {
  const key = `club:${userId}:${clubId}`;
  if (clubChatUnsubs.has(key)) return;

  const unsub = getPubSub().subscribe(`club:chat:${clubId}`, (data: any) => {
    const client = clients.get(userId);
    if (client && client.ws.readyState === WebSocket.OPEN && data.userId !== userId) {
      client.ws.send(JSON.stringify(data));
    }
  });
  clubChatUnsubs.set(key, unsub);
}

// Unsubscribe a client from a club's chat channel
function unsubscribeClientFromClubChat(userId: string, clubId: string) {
  const key = `club:${userId}:${clubId}`;
  const unsub = clubChatUnsubs.get(key);
  if (unsub) {
    unsub();
    clubChatUnsubs.delete(key);
  }
}

// Unsubscribe a client from ALL club chat channels
function unsubscribeClientFromAllClubChats(userId: string) {
  const prefix = `club:${userId}:`;
  for (const [key, unsub] of clubChatUnsubs.entries()) {
    if (key.startsWith(prefix)) {
      unsub();
      clubChatUnsubs.delete(key);
    }
  }
}

// Client connection with metadata — supports multi-tabling
export interface WsClient {
  ws: WebSocket;
  userId: string;
  displayName: string;
  tableIds: Set<string>;  // player can be at multiple tables simultaneously
  ip?: string;
}

const MAX_TABLES_PER_USER = 4;

// Message types: Client → Server
// All table-scoped messages include tableId so the server knows which table the action targets
export type ClientMessage =
  | { type: "join_table"; tableId: string; seatIndex?: number; buyIn: number; password?: string; inviteCode?: string }
  | { type: "leave_table"; tableId?: string }
  | { type: "player_action"; tableId?: string; action: "fold" | "check" | "call" | "raise"; amount?: number; actionNumber?: number }
  | { type: "sit_out"; tableId?: string }
  | { type: "sit_in"; tableId?: string }
  | { type: "add_chips"; tableId?: string; amount: number }
  | { type: "add_bots"; tableId?: string }
  | { type: "chat"; tableId?: string; message: string }
  | { type: "emote"; tableId?: string; emoteId: string }
  | { type: "taunt"; tableId?: string; tauntId: string }
  | { type: "seed_commit"; tableId?: string; commitmentHash: string }
  | { type: "seed_reveal"; tableId?: string; seed: string }
  | { type: "buy_time"; tableId?: string }
  | { type: "accept_insurance"; tableId?: string }
  | { type: "decline_insurance"; tableId?: string }
  | { type: "run_it_vote"; tableId?: string; count: 1 | 2 | 3 }
  | { type: "post_blinds"; tableId?: string }
  | { type: "wait_for_bb"; tableId?: string }
  | { type: "commentary_toggle"; tableId?: string; enabled: boolean }
  | { type: "commentary_omniscient"; tableId?: string; enabled: boolean }
  // Club chat
  | { type: "club_chat"; clubId: string; message: string }
  // Fast-fold pool messages
  | { type: "join_fast_fold_pool"; poolId: string; buyIn: number }
  | { type: "leave_fast_fold_pool" }
  // Admin controls (already have tableId)
  | { type: "admin_pause_game"; tableId: string }
  | { type: "admin_resume_game"; tableId: string }
  | { type: "admin_approve_player"; tableId: string; playerId: string }
  | { type: "admin_decline_player"; tableId: string; playerId: string }
  | { type: "admin_update_table"; tableId: string; settings: { walletLimit?: number; smallBlind?: number; bigBlind?: number; ante?: number; rakePercent?: number; maxValuePerHand?: number; turnTimerDuration?: number; autoStartNextHand?: boolean } };

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
  | { type: "chat_history"; messages: { userId: string; displayName: string; message: string; timestamp: string }[] }
  | { type: "info"; message: string }
  | { type: "chips_added"; walletBalance: number; chipsAdded: number; newTableChips: number }
  | { type: "hand_countdown"; seconds: number }
  | { type: "player_moved"; playerId: string; displayName: string; toTableId: string; reason: string }
  | { type: "commentary"; segment: any }
  | { type: "commentary_status"; enabled: boolean; omniscientMode: boolean }
  // Lottery SNG messages
  | { type: "lottery_spin"; multiplier: number; prizePool: number; animation: "spinning" }
  | { type: "lottery_result"; multiplier: number; prizePool: number }
  // Admin control responses
  | { type: "game_paused"; pausedBy: string }
  | { type: "game_resumed"; resumedBy: string }
  | { type: "waiting_list"; players: { id: string; name: string; avatar?: string; chipBalance: number }[] }
  | { type: "player_approved"; playerId: string; displayName: string }
  | { type: "player_declined"; playerId: string }
  // Fast-fold pool responses
  | { type: "fast_fold_reassign"; newTableId: string }
  | { type: "fast_fold_pool_info"; poolId: string; playerCount: number; tablesActive: number };

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
export function clearClientTable(userId: string, tableId?: string) {
  const client = clients.get(userId);
  if (client) {
    if (tableId) {
      client.tableIds.delete(tableId);
    } else {
      client.tableIds.clear();
    }
  }
}

// Broadcast to all users at a table — uses Redis pub/sub when REDIS_URL is set
// so multiple server instances can broadcast to each other's WebSocket clients
export function broadcastToTable(tableId: string, msg: ServerMessage, excludeUserId?: string) {
  const tagged = { ...msg, tableId } as any;

  if (process.env.REDIS_URL) {
    // Multi-instance: publish to Redis channel, all instances will receive and deliver locally
    getPubSub().publish(`table:${tableId}`, { tagged, excludeUserId }).catch(() => {});
  } else {
    // Single instance: deliver directly to local clients
    deliverToLocalClients(tableId, tagged, excludeUserId);
  }
}

// Deliver a message to local WebSocket clients at a table
function deliverToLocalClients(tableId: string, tagged: any, excludeUserId?: string) {
  clients.forEach((client) => {
    if (client.tableIds.has(tableId) && client.userId !== excludeUserId) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(tagged));
      }
    }
  });
}

// Subscribe to Redis pub/sub channels for table broadcasts (called once on startup)
function initPubSubSubscriptions() {
  if (!process.env.REDIS_URL) return;

  // Global subscription for all table messages — re-subscribe per table as clients join
  // This is handled dynamically in the join/leave handlers below
  console.log("[WS] Redis pub/sub active — multi-instance broadcasting enabled");
}

// Send personalized game state to each player at a table
// 4-Level Anti-Scraping Protection:
//   L1: Card indices obfuscated (encrypted sprite positions)
//   L2: Canvas rendering flag (client renders to canvas, not DOM)
//   L3: Per-session randomized sprite mapping
//   L4: Encrypted React state (cards stored as AES ciphertext)
export function sendGameStateToTable(tableId: string) {
  const instance = tableManager.getTable(tableId);
  if (!instance) return;

  clients.forEach((client) => {
    if (client.tableIds.has(tableId) && client.ws.readyState === WebSocket.OPEN) {
      const state = instance.getStateForPlayer(client.userId);

      if (state && state.players && hasSessionKey(client.userId)) {
        // Get the session key hex for this user
        const sessionKeyHex = getSessionKeyHex(client.userId);

        for (const p of state.players) {
          if (p.cards && Array.isArray(p.cards) && p.cards.length > 0) {
            if (p.id === client.userId && !p.cards[0]?.hidden) {
              // Hero's own cards: encrypt with AES-256-GCM (Level 4)
              const encrypted = encryptCards(client.userId, p.cards);
              if (encrypted) {
                // Level 1+3: Also obfuscate for sprite mapping
                (p as any)._encryptedCards = encrypted;
                if (!sessionKeyHex) {
                  // No session key — refuse to send cards unencrypted
                  p.cards = p.cards.map(() => ({ hidden: true }));
                  continue;
                }
                (p as any)._obfuscatedCards = obfuscateCards(p.cards, client.userId, sessionKeyHex);
                p.cards = p.cards.map(() => ({ encrypted: true }));
              }
            }
            // Other players' cards are already { hidden: true } from getStateForPlayer
          }
        }

        // Level 2: Signal client to use canvas rendering
        (state as any)._renderMode = "canvas";
      }

      client.ws.send(JSON.stringify({ type: "game_state", tableId, state }));
    }
  });
}


/** Resolve and validate a tableId from a client message. Falls back to first table if only at one. */
function resolveTableId(client: WsClient, msg: { tableId?: string }): string | null {
  if (msg.tableId && client.tableIds.has(msg.tableId)) return msg.tableId;
  // Backward compat: if client only at 1 table, use it
  if (client.tableIds.size === 1) return client.tableIds.values().next().value!;
  return null;
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

    // Track connection for anti-cheat
    const userAgent = (_req.headers["user-agent"] as string) || "";
    antiCheatEngine.trackConnection(user.id, clientIp, userAgent);

    const client: WsClient = {
      ws,
      userId: user.id,
      displayName: user.displayName || user.username,
      tableIds: new Set(),
      ip: clientIp,
    };

    // Replace any existing connection for this user (reconnection)
    const existing = clients.get(user.id);
    if (existing) {
      // Reconnection: transfer ALL table contexts and notify table manager
      if (existing.tableIds.size > 0) {
        client.tableIds = new Set(existing.tableIds);
        for (const tid of client.tableIds) {
          tableManager.handleReconnect(tid, user.id);
        }
      }
      existing.ws.close(1000, "Replaced by new connection");
    }
    clients.set(user.id, client);

    // Generate per-session card encryption key + sprite mapping and send to client
    const cardKey = generateSessionKey(user.id);
    const spriteMapping = getOrCreateSpriteMapping(user.id);
    const encryptedMapping = getEncryptedSpriteMapping(user.id, cardKey);
    ws.send(JSON.stringify({ type: "session_key", cardKey, spriteMapping: encryptedMapping }));

    // Subscribe to club chat channels for all user's clubs
    storage.getUserClubs(user.id).then(userClubs => {
      for (const club of userClubs) {
        subscribeClientToClubChat(user.id, club.id);
      }
    }).catch(() => {});

    // If reconnecting to tables, send current game state for each
    for (const tid of client.tableIds) {
      sendGameStateToTable(tid);
    }

    ws.on("message", async (data) => {
      try {
        // Rate limiting check
        if (isRateLimited(user.id)) {
          sendToUser(user.id, { type: "error", message: "Rate limited — slow down" });
          return;
        }
        const msg = JSON.parse(data.toString()) as ClientMessage;
        const logTableId = (msg as any).tableId?.slice(0, 8) || (client.tableIds.size === 1 ? [...client.tableIds][0].slice(0, 8) : `${client.tableIds.size} tables`);
        console.log(`[ws] ${client.displayName}: ${msg.type} (${logTableId})`);
        await handleMessage(client, msg);
      } catch (err: any) {
        sendToUser(user.id, { type: "error", message: err.message || "Invalid message" });
      }
    });

    ws.on("close", () => {
      // Handle disconnect for ALL tables
      for (const tid of client.tableIds) {
        tableManager.handleDisconnect(tid, client.userId);
        if (process.env.REDIS_URL) unsubscribeClientFromTable(user.id, tid);
      }
      // Unsubscribe from all club chat channels
      unsubscribeClientFromAllClubChats(user.id);
      antiCheatEngine.removeConnection(user.id);
      clearSessionKey(user.id);
      clearSpriteMapping(user.id);
      clients.delete(user.id);
      rateLimitBuckets.delete(user.id);
    });

    ws.on("error", () => {
      for (const tid of client.tableIds) {
        tableManager.handleDisconnect(tid, client.userId);
      }
      clients.delete(user.id);
    });
  });
}

/** Check if a user is the table creator or a site admin */
async function isTableAdmin(userId: string, tableId: string): Promise<boolean> {
  const table = await storage.getTable(tableId);
  if (!table) return false;
  if (String(table.createdById) === String(userId)) return true;
  const user = await storage.getUser(userId);
  return user?.role === "admin";
}

async function handleMessage(client: WsClient, msg: ClientMessage) {
  switch (msg.type) {
    case "join_table": {
      // Kill switch: block buy-ins when system is locked
      if (isSystemLocked()) {
        sendToUser(client.userId, { type: "error", message: "System is temporarily locked for maintenance" });
        return;
      }
      // Validate password for private tables (invite code bypasses password)
      const tableInfo = await storage.getTable(msg.tableId);
      if (tableInfo?.isPrivate && tableInfo.password) {
        const hasValidInvite = msg.inviteCode && tableInfo.inviteCode === msg.inviteCode;
        if (!hasValidInvite && (!msg.password || msg.password !== tableInfo.password)) {
          // Rate limit password attempts per user per table
          const pwKey = `pw:${client.userId}:${msg.tableId}`;
          const pwAttempts = (passwordAttempts.get(pwKey) || 0) + 1;
          passwordAttempts.set(pwKey, pwAttempts);
          if (pwAttempts >= 5) {
            sendToUser(client.userId, { type: "error", message: "Too many password attempts. Try again later." });
            setTimeout(() => passwordAttempts.delete(pwKey), 5 * 60 * 1000); // reset after 5 min
            return;
          }
          sendToUser(client.userId, { type: "error", message: "Incorrect table password" });
          return;
        }
      }
      // Multi-table limit check
      if (client.tableIds.size >= MAX_TABLES_PER_USER && !client.tableIds.has(msg.tableId)) {
        sendToUser(client.userId, { type: "error", message: `Maximum ${MAX_TABLES_PER_USER} tables at once` });
        return;
      }
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
      client.tableIds.add(msg.tableId);
      antiCheatEngine.setPlayerTable(client.userId, msg.tableId);

      // Subscribe to Redis pub/sub for this table (multi-instance broadcasting)
      if (process.env.REDIS_URL) {
        subscribeClientToTable(client.userId, msg.tableId);
      }

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
      const leaveTableId = resolveTableId(client, msg);
      if (!leaveTableId) return;
      await tableManager.leaveTable(leaveTableId, client.userId);

      // Check if the player was flagged as pending leave (still in hand)
      const stillAtTable = tableManager.getTable(leaveTableId)?.engine.getPlayer(client.userId);
      if (!stillAtTable) {
        client.tableIds.delete(leaveTableId);
        if (process.env.REDIS_URL) unsubscribeClientFromTable(client.userId, leaveTableId);
      } else {
        sendToUser(client.userId, { type: "info", message: "You will leave after this hand completes" } as any);
      }
      sendGameStateToTable(leaveTableId);
      break;
    }

    case "player_action": {
      const tid = resolveTableId(client, msg);
      if (!tid) return;
      const result = tableManager.handleAction(tid, client.userId, msg.action, msg.amount, msg.actionNumber);
      if (!result.ok) {
        sendToUser(client.userId, { type: "error", message: result.error! });
        return;
      }
      broadcastToTable(tid, { type: "action_performed", userId: client.userId, action: msg.action, amount: msg.amount });
      sendGameStateToTable(tid);
      break;
    }

    case "sit_out": {
      const tid = resolveTableId(client, msg);
      if (!tid) return;
      tableManager.setSitOut(tid, client.userId, true);
      sendGameStateToTable(tid);
      break;
    }

    case "sit_in": {
      const tid = resolveTableId(client, msg);
      if (!tid) return;
      tableManager.setSitOut(tid, client.userId, false);
      sendGameStateToTable(tid);
      break;
    }

    case "add_chips": {
      const tid = resolveTableId(client, msg);
      if (!tid) return;
      if (isSystemLocked()) {
        sendToUser(client.userId, { type: "error", message: "System is temporarily locked for maintenance" });
        return;
      }
      const amount = msg.amount;
      if (!amount || amount <= 0) return;
      const table = await storage.getTable(tid);
      if (!table) return;
      const instance = tableManager.getTable(tid);
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
        tableId: tid,
        description: "Added chips to table",
        walletType: "cash_game",
        relatedTransactionId: null,
        paymentId: null,
        metadata: null,
      });
      player.chips += addAmount;
      // Persist chip change to table_players for atomicity
      try {
        await storage.updateTablePlayerChips(tid, client.userId, player.chips);
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
      sendGameStateToTable(tid);
      break;
    }

    case "add_bots": {
      const tid = resolveTableId(client, msg);
      if (!tid) {
        sendToUser(client.userId, { type: "error", message: "Not seated at a table — please rejoin" });
        return;
      }
      await tableManager.addBots(tid);
      sendGameStateToTable(tid);
      break;
    }

    case "chat": {
      const tid = resolveTableId(client, msg);
      if (!tid) return;
      const rawMsg = msg.message?.slice(0, 200);
      if (!rawMsg) return;
      const chatMsg = rawMsg.replace(/[<>&"']/g, (c: string) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] || c));
      storage.saveChatMessage(tid, client.userId, client.displayName, chatMsg).catch(() => {});
      broadcastToTable(tid, {
        type: "chat",
        userId: client.userId,
        displayName: client.displayName,
        message: chatMsg,
      });
      break;
    }

    case "emote": {
      const tid = resolveTableId(client, msg);
      if (!tid) return;
      const emoteId = msg.emoteId?.slice(0, 20);
      if (!emoteId) return;
      broadcastToTable(tid, {
        type: "emote",
        userId: client.userId,
        displayName: client.displayName,
        emoteId,
      });
      break;
    }

    case "taunt": {
      const tid = resolveTableId(client, msg);
      if (!tid) return;
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
      broadcastToTable(tid, {
        type: "taunt",
        userId: client.userId,
        displayName: client.displayName,
        tauntId,
        text: tauntText,
      });
      break;
    }

    case "seed_commit": {
      const tid = resolveTableId(client, msg);
      if (!tid) return;
      const hash = msg.commitmentHash?.slice(0, 128);
      if (!hash) return;
      tableManager.handleSeedCommit(tid, client.userId, hash);
      break;
    }

    case "seed_reveal": {
      const tid = resolveTableId(client, msg);
      if (!tid) return;
      const seed = msg.seed?.slice(0, 128);
      if (!seed) return;
      tableManager.handleSeedReveal(tid, client.userId, seed);
      break;
    }

    case "buy_time": {
      const tid = resolveTableId(client, msg);
      if (!tid) return;
      const result = tableManager.handleBuyTime(tid, client.userId);
      if (!result.ok) {
        sendToUser(client.userId, { type: "error", message: result.error! });
        return;
      }
      sendGameStateToTable(tid);
      break;
    }

    case "accept_insurance": {
      const tid = resolveTableId(client, msg);
      if (!tid) return;
      const result = tableManager.handleInsuranceResponse(tid, client.userId, true);
      if (!result.ok) {
        sendToUser(client.userId, { type: "error", message: result.error! });
        return;
      }
      sendGameStateToTable(tid);
      break;
    }

    case "decline_insurance": {
      const tid = resolveTableId(client, msg);
      if (!tid) return;
      const result = tableManager.handleInsuranceResponse(tid, client.userId, false);
      if (!result.ok) {
        sendToUser(client.userId, { type: "error", message: result.error! });
        return;
      }
      sendGameStateToTable(tid);
      break;
    }

    case "run_it_vote": {
      const tid = resolveTableId(client, msg);
      if (!tid) return;
      const count = msg.count;
      if (count !== 1 && count !== 2 && count !== 3) return;
      const result = tableManager.handleRunItVote(tid, client.userId, count);
      if (!result.ok) {
        sendToUser(client.userId, { type: "error", message: result.error! });
        return;
      }
      sendGameStateToTable(tid);
      break;
    }

    case "post_blinds": {
      const tid = resolveTableId(client, msg);
      if (!tid) return;
      tableManager.handlePostBlindChoice(tid, client.userId, "post");
      sendGameStateToTable(tid);
      break;
    }

    case "wait_for_bb": {
      const tid = resolveTableId(client, msg);
      if (!tid) return;
      tableManager.handlePostBlindChoice(tid, client.userId, "wait");
      sendGameStateToTable(tid);
      break;
    }

    case "commentary_toggle": {
      const tid = resolveTableId(client, msg);
      if (!tid) return;
      if (msg.enabled) {
        subscribeCommentary(tid, client.userId, false);
      } else {
        unsubscribeCommentary(tid, client.userId);
      }
      const cState = getCommentaryState(tid);
      sendToUser(client.userId, {
        type: "commentary_status",
        enabled: msg.enabled,
        omniscientMode: cState?.subscribers.get(client.userId)?.omniscient ?? false,
      });
      break;
    }

    case "commentary_omniscient": {
      const tid = resolveTableId(client, msg);
      if (!tid) return;
      const canOmniscient = await isTableAdmin(client.userId, tid);
      if (!canOmniscient) {
        sendToUser(client.userId, { type: "error", message: "Only table admins can enable omniscient mode" } as any);
        return;
      }
      setOmniscientMode(tid, client.userId, msg.enabled);
      sendToUser(client.userId, {
        type: "commentary_status",
        enabled: true,
        omniscientMode: msg.enabled,
      });
      break;
    }

    // ═══ FAST-FOLD POOL ═══

    case "join_fast_fold_pool": {
      if (isSystemLocked()) {
        sendToUser(client.userId, { type: "error", message: "System is temporarily locked for maintenance" });
        return;
      }
      const result = await fastFoldManager.addPlayer(
        msg.poolId,
        client.userId,
        client.displayName,
        msg.buyIn
      );
      if (!result.ok) {
        sendToUser(client.userId, { type: "error", message: result.error! });
        return;
      }
      if (result.tableId) {
        client.tableIds.add(result.tableId);
        sendGameStateToTable(result.tableId);
      }
      break;
    }

    case "leave_fast_fold_pool": {
      const result = await fastFoldManager.removePlayer(client.userId);
      if (!result.ok) {
        sendToUser(client.userId, { type: "error", message: result.error! });
        return;
      }
      // Fast-fold: remove all table associations when leaving pool
      client.tableIds.clear();
      break;
    }

    // ═══ ADMIN CONTROLS ═══

    case "admin_pause_game": {
      const adminTableId = msg.tableId;
      if (!adminTableId) return;
      const isAdmin = await isTableAdmin(client.userId, adminTableId);
      if (!isAdmin) {
        sendToUser(client.userId, { type: "error", message: "Only the table creator can pause the game" });
        return;
      }
      const paused = tableManager.pauseGame(adminTableId);
      if (!paused) {
        sendToUser(client.userId, { type: "error", message: "Table not found" });
        return;
      }
      broadcastToTable(adminTableId, { type: "game_paused", pausedBy: client.displayName });
      break;
    }

    case "admin_resume_game": {
      const adminTableId = msg.tableId;
      if (!adminTableId) return;
      const isAdmin = await isTableAdmin(client.userId, adminTableId);
      if (!isAdmin) {
        sendToUser(client.userId, { type: "error", message: "Only the table creator can resume the game" });
        return;
      }
      const resumed = tableManager.resumeGame(adminTableId);
      if (!resumed) {
        sendToUser(client.userId, { type: "error", message: "Table not found" });
        return;
      }
      broadcastToTable(adminTableId, { type: "game_resumed", resumedBy: client.displayName });
      sendGameStateToTable(adminTableId);
      break;
    }

    case "admin_approve_player": {
      const adminTableId = msg.tableId;
      const playerId = msg.playerId;
      if (!adminTableId || !playerId) return;
      const isAdmin = await isTableAdmin(client.userId, adminTableId);
      if (!isAdmin) {
        sendToUser(client.userId, { type: "error", message: "Only the table creator can approve players" });
        return;
      }
      const approved = tableManager.removeFromWaitingList(adminTableId, playerId);
      if (!approved) {
        sendToUser(client.userId, { type: "error", message: "Player not found in waiting list" });
        return;
      }
      // Auto-join the approved player to the table
      const joinResult = await tableManager.joinTable(
        adminTableId, playerId, approved.name, approved.chipBalance
      );
      if (!joinResult.ok) {
        sendToUser(client.userId, { type: "error", message: `Could not seat player: ${joinResult.error}` });
        return;
      }
      // Set the approved player's WS client table association
      const approvedClient = clients.get(playerId);
      if (approvedClient) {
        approvedClient.tableIds.add(adminTableId);
      }
      broadcastToTable(adminTableId, { type: "player_approved", playerId, displayName: approved.name });
      // Send updated waiting list to admin
      const remainingWL = tableManager.getWaitingList(adminTableId);
      sendToUser(client.userId, {
        type: "waiting_list",
        players: remainingWL,
      });
      sendGameStateToTable(adminTableId);
      break;
    }

    case "admin_decline_player": {
      const adminTableId = msg.tableId;
      const playerId = msg.playerId;
      if (!adminTableId || !playerId) return;
      const isAdmin = await isTableAdmin(client.userId, adminTableId);
      if (!isAdmin) {
        sendToUser(client.userId, { type: "error", message: "Only the table creator can decline players" });
        return;
      }
      const declined = tableManager.removeFromWaitingList(adminTableId, playerId);
      if (!declined) {
        sendToUser(client.userId, { type: "error", message: "Player not found in waiting list" });
        return;
      }
      // Notify the declined player
      sendToUser(playerId, { type: "error", message: "Your request to join was declined by the table admin" });
      broadcastToTable(adminTableId, { type: "player_declined", playerId });
      // Send updated waiting list to admin
      const remainingWL = tableManager.getWaitingList(adminTableId);
      sendToUser(client.userId, {
        type: "waiting_list",
        players: remainingWL,
      });
      break;
    }

    case "admin_update_table": {
      const adminTableId = msg.tableId;
      if (!adminTableId) return;
      const isAdmin = await isTableAdmin(client.userId, adminTableId);
      if (!isAdmin) {
        sendToUser(client.userId, { type: "error", message: "Only the table creator can update settings" });
        return;
      }
      const settings = msg.settings || {};
      const updated = await tableManager.updateTableSettings(adminTableId, {
        smallBlind: settings.smallBlind,
        bigBlind: settings.bigBlind,
        ante: settings.ante,
        rakePercent: settings.rakePercent,
        maxValuePerHand: settings.maxValuePerHand,
        turnTimerDuration: settings.turnTimerDuration,
        autoStartNextHand: settings.autoStartNextHand,
      });
      if (!updated) {
        sendToUser(client.userId, { type: "error", message: "Table not found" });
        return;
      }
      broadcastToTable(adminTableId, {
        type: "info",
        message: `${client.displayName} updated table settings — changes take effect next hand`,
      } as any);
      sendGameStateToTable(adminTableId);
      break;
    }

    case "club_chat": {
      const clubId = (msg as any).clubId;
      if (!clubId) return;
      const rawMsg = ((msg as any).message || "").trim();
      if (!rawMsg || rawMsg.length > 500) return;

      // Sanitize
      const sanitized = rawMsg.replace(/[<>&"']/g, (c: string) =>
        ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] || c)
      );

      // Verify club membership
      const members = await storage.getClubMembers(clubId);
      if (!members.some(m => m.userId === client.userId)) {
        sendToUser(client.userId, { type: "error", message: "Not a member of this club" });
        return;
      }

      // Save to DB
      const saved = await storage.createClubMessage({ clubId, userId: client.userId, message: sanitized });

      // Get user info
      const chatUser = await storage.getUser(client.userId);
      const payload = {
        type: "club_chat",
        id: saved.id,
        clubId: saved.clubId,
        userId: saved.userId,
        message: saved.message,
        createdAt: saved.createdAt,
        username: chatUser?.username ?? "Unknown",
        displayName: chatUser?.displayName ?? null,
        avatarId: chatUser?.avatarId ?? null,
      };

      // Send to self immediately
      sendToUser(client.userId, payload as any);

      // Broadcast via pub/sub to all other online club members
      getPubSub().publish(`club:chat:${clubId}`, payload).catch(() => {});
      break;
    }

    default: {
      sendToUser(client.userId, { type: "error", message: `Unknown message type: ${(msg as any).type}` });
      break;
    }
  }
}
