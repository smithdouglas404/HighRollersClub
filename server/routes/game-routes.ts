import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { storage } from "../storage";
import { insertTableSchema } from "@shared/schema";
import { tableManager } from "../game/table-manager";
import { sendGameStateToTable } from "../websocket";
import { getBlindPreset } from "../game/blind-presets";
import { analyzeHand } from "../game/hand-analyzer";
import { geofenceMiddleware } from "../middleware/geofence";
import { fastFoldManager, type FastFoldPoolConfig } from "../game/fast-fold-manager";
import { blockchainConfig } from "../blockchain/config";

export interface GameHelpers {
  logAdminAction: (
    req: import("express").Request,
    action: string,
    targetType: string | null,
    targetId: string | null,
    details: Record<string, any> | null,
  ) => Promise<void>;
}

export async function registerGameRoutes(
  app: Express,
  requireAuth: RequestHandler,
  requireAdmin: RequestHandler,
  helpers: GameHelpers,
) {
  const { logAdminAction } = helpers;

  // ─── Table Routes ────────────────────────────────────────────────────────
  // List all public tables (+ user's private tables)
  app.get("/api/tables", requireAuth, async (req, res, next) => {
    try {
      const allTables = await storage.getTables();
      const tablesWithPlayers = await Promise.all(
        allTables.map(async (table) => {
          // Use live engine state for player count and status when available
          const instance = tableManager.getTable(table.id);
          const playerCount = instance
            ? instance.engine.state.players.length  // includes bots
            : (await storage.getTablePlayers(table.id)).length;
          const status = instance
            ? (instance.engine.state.phase !== "waiting" ? "playing" : "waiting")
            : table.status;
          return {
            ...table,
            playerCount,
            status,
            password: undefined, // never expose password
          };
        })
      );
      // Show public tables, or private tables the user created
      let visible = tablesWithPlayers.filter(t => {
        if (!t.isPrivate) return true;
        return req.user && t.createdById === req.user.id;
      });

      // Optional format filter
      const format = req.query.format as string;
      if (format && format !== "all") {
        visible = visible.filter(t => t.gameFormat === format);
      }

      // Optional variant filter
      const variant = req.query.variant as string;
      if (variant && variant !== "all") {
        visible = visible.filter(t => t.pokerVariant === variant);
      }

      res.json(visible);
    } catch (err) {
      next(err);
    }
  });

  // Get single table
  // Resolve invite code to table ID
  app.get("/api/tables/invite/:code", async (req, res, next) => {
    try {
      const table = await storage.getTableByInviteCode(req.params.code);
      if (!table) return res.status(404).json({ message: "Invalid invite code" });
      res.json({ tableId: table.id, name: table.name, inviteCode: table.inviteCode });
    } catch (err) { next(err); }
  });

  app.get("/api/tables/:id", async (req, res, next) => {
    try {
      const table = await storage.getTable(req.params.id);
      if (!table) return res.status(404).json({ message: "Table not found" });
      const players = await storage.getTablePlayers(table.id);
      const occupiedSeats = players.map(p => p.seatIndex);
      // Include return buy-in minimum if the requesting user has one
      const userId = (req as any).user?.id;
      const returnMinBuyIn = userId ? tableManager.getReturnMinBuyIn(table.id, userId) : null;
      res.json({ ...table, password: undefined, players, occupiedSeats, returnMinBuyIn });
    } catch (err) {
      next(err);
    }
  });

  // REST endpoint for joining a table (professional: REST for join/leave, WS for gameplay)
  app.post("/api/tables/:id/join", requireAuth, geofenceMiddleware(), async (req, res, next) => {
    try {
      const { buyIn, seatIndex, password } = req.body;
      if (!buyIn || buyIn <= 0) return res.status(400).json({ message: "Invalid buy-in amount" });

      // Check private table password
      const tableForAuth = await storage.getTable(req.params.id);
      if (tableForAuth?.isPrivate && tableForAuth.password) {
        if (password !== tableForAuth.password) {
          return res.status(403).json({ message: "Incorrect table password" });
        }
      }

      const result = await tableManager.joinTable(req.params.id, req.user!.id, req.user!.displayName || req.user!.username, buyIn, seatIndex);
      if (!result.ok) return res.status(400).json({ message: result.error });
      sendGameStateToTable(req.params.id);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // REST endpoint for leaving a table
  app.post("/api/tables/:id/leave", requireAuth, async (req, res, next) => {
    try {
      await tableManager.leaveTable(req.params.id, req.user!.id);
      sendGameStateToTable(req.params.id);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // ─── Video (Daily.co) ──────────────────────────────────────────────────
  app.post("/api/tables/:id/video-token", requireAuth, async (req, res, next) => {
    try {
      if (!process.env.DAILY_API_KEY) {
        return res.status(200).json({ available: false, message: "Video chat is not currently available. Contact the platform administrator to enable this feature." });
      }
      const tableId = req.params.id;
      const user = req.user!;
      const table = await storage.getTable(tableId);
      if (!table) return res.status(404).json({ message: "Table not found" });

      const isOwner = String(table.createdById) === String(user.id);
      const { createMeetingToken } = await import("../video/daily-rooms");
      const token = await createMeetingToken(
        tableId,
        String(user.id),
        user.displayName || user.username || "Player",
        isOwner,
      );
      res.json({ token });
    } catch (err) { next(err); }
  });

  // Create table
  app.post("/api/tables", requireAuth, async (req, res, next) => {
    try {
      // Resolve blindPreset to blindSchedule for SNG/Tournament tables
      const body = { ...req.body };
      if ((body.gameFormat === "sng" || body.gameFormat === "tournament") && body.blindPreset && !body.blindSchedule) {
        body.blindSchedule = getBlindPreset(body.blindPreset);
      }
      // Lottery SNG: force hyper-turbo schedule, 3 players, 500 starting chips
      if (body.gameFormat === "lottery_sng") {
        body.blindSchedule = getBlindPreset("hyper_turbo");
        body.maxPlayers = 3;
        body.startingChips = 500;
        body.payoutStructure = [{ place: 1, percentage: 100 }];
      }
      delete body.blindPreset; // Not a schema field

      const parsed = insertTableSchema.safeParse(body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid table config", errors: parsed.error.flatten() });
      }
      const table = await storage.createTable({
        ...parsed.data,
        createdById: req.user!.id,
      });
      res.status(201).json({ ...table, password: undefined });
    } catch (err) {
      next(err);
    }
  });

  // Delete table (only creator)
  app.delete("/api/tables/:id", requireAuth, async (req, res, next) => {
    try {
      const table = await storage.getTable(req.params.id);
      if (!table) return res.status(404).json({ message: "Table not found" });
      if (table.createdById !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized" });
      }
      await storage.deleteTable(req.params.id);
      res.json({ message: "Table deleted" });
    } catch (err) {
      next(err);
    }
  });

  // ─── Lottery SNG (Spin & Go) ────────────────────────────────────────────
  const LOTTERY_BUY_IN_TIERS = [100, 250, 500, 1000, 2500, 5000] as const;

  // In-memory queue for each buy-in tier: maps tier → array of waiting table IDs
  const lotteryQueues = new Map<number, string[]>();
  for (const tier of LOTTERY_BUY_IN_TIERS) {
    lotteryQueues.set(tier, []);
  }

  app.get("/api/lottery-sng/tiers", requireAuth, async (_req, res) => {
    const tiers = LOTTERY_BUY_IN_TIERS.map(buyIn => {
      const queue = lotteryQueues.get(buyIn) || [];
      // Count registered players across all queued tables for this tier
      let totalQueued = 0;
      for (const tableId of queue) {
        const instance = tableManager.getTable(tableId);
        if (instance && instance.lifecycle && instance.lifecycle.status === "registering") {
          totalQueued += instance.lifecycle.registeredPlayers.size;
        }
      }
      return {
        buyIn,
        playersQueued: totalQueued,
        prizePoolRange: {
          min: buyIn * 3 * 2,   // 2x multiplier
          max: buyIn * 3 * 1000, // 1000x multiplier (jackpot)
        },
      };
    });
    res.json(tiers);
  });

  app.post("/api/lottery-sng/register", requireAuth, async (req, res, next) => {
    try {
      const { buyIn } = req.body;
      if (!buyIn || !LOTTERY_BUY_IN_TIERS.includes(buyIn)) {
        return res.status(400).json({ message: `Invalid buy-in. Available tiers: ${LOTTERY_BUY_IN_TIERS.join(", ")}` });
      }

      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Find an existing lottery table for this tier that has room
      const queue = lotteryQueues.get(buyIn) || [];
      let tableId: string | null = null;

      for (const queuedTableId of queue) {
        const instance = tableManager.getTable(queuedTableId);
        if (instance && instance.lifecycle && instance.lifecycle.status === "registering" && instance.lifecycle.registeredPlayers.size < 3) {
          // Don't let player register twice
          if (!instance.lifecycle.registeredPlayers.has(userId)) {
            tableId = queuedTableId;
            break;
          }
        }
      }

      // If no suitable table, create a new one
      if (!tableId) {
        const blindSchedule = getBlindPreset("hyper_turbo");
        const tableData = insertTableSchema.parse({
          name: `Spin & Go ${buyIn}`,
          maxPlayers: 3,
          smallBlind: 10,
          bigBlind: 20,
          minBuyIn: buyIn,
          maxBuyIn: buyIn,
          ante: 0,
          timeBankSeconds: 15,
          isPrivate: false,
          allowBots: false,
          replaceBots: false,
          gameFormat: "lottery_sng",
          blindSchedule,
          buyInAmount: buyIn,
          startingChips: 500,
          payoutStructure: [{ place: 1, percentage: 100 }],
        });
        const newTable = await storage.createTable({
          ...tableData,
          createdById: userId,
        });
        tableId = newTable.id;
        queue.push(tableId);
        lotteryQueues.set(buyIn, queue);
      }

      // Join the table via table manager
      const result = await tableManager.joinTable(
        tableId,
        userId,
        user.displayName || user.username || "Player",
        buyIn,
      );

      if (!result.ok) {
        return res.status(400).json({ message: result.error });
      }

      // Clean up completed tables from queue
      const updatedQueue = (lotteryQueues.get(buyIn) || []).filter(id => {
        const inst = tableManager.getTable(id);
        return inst && inst.lifecycle && inst.lifecycle.status === "registering";
      });
      lotteryQueues.set(buyIn, updatedQueue);

      res.json({ tableId, message: "Registered for Lottery SNG" });
    } catch (err) {
      next(err);
    }
  });

  // ─── Fast-Fold Pools ────────────────────────────────────────────────────
  app.get("/api/fast-fold/pools", requireAuth, async (_req, res) => {
    const pools = fastFoldManager.getAllPools();
    const poolStates = pools.map(p => fastFoldManager.getPoolState(p.poolId)).filter(Boolean);
    res.json(poolStates);
  });

  app.post("/api/fast-fold/pools", requireAuth, async (req, res) => {
    const user = req.user!;
    // Only admins can create pools
    const dbUser = await storage.getUser(user.id);
    if (!dbUser || dbUser.role !== "admin") {
      return res.status(403).json({ message: "Admin only" });
    }
    const { name, smallBlind, bigBlind, minBuyIn, maxBuyIn, maxPlayersPerTable, ante, rakePercent, rakeCap } = req.body;
    if (!name || !smallBlind || !bigBlind || !minBuyIn || !maxBuyIn) {
      return res.status(400).json({ message: "Missing required fields: name, smallBlind, bigBlind, minBuyIn, maxBuyIn" });
    }
    const config: FastFoldPoolConfig = {
      name,
      smallBlind: Number(smallBlind),
      bigBlind: Number(bigBlind),
      minBuyIn: Number(minBuyIn),
      maxBuyIn: Number(maxBuyIn),
      maxPlayersPerTable: Number(maxPlayersPerTable) || 6,
      ante: Number(ante) || 0,
      rakePercent: Number(rakePercent) || 0,
      rakeCap: Number(rakeCap) || 0,
    };
    const pool = fastFoldManager.createPool(config);
    res.status(201).json(fastFoldManager.getPoolState(pool.poolId));
  });

  app.post("/api/fast-fold/pools/:poolId/join", requireAuth, async (req, res) => {
    const { poolId } = req.params;
    const { buyIn } = req.body;
    if (!buyIn || Number(buyIn) <= 0) {
      return res.status(400).json({ message: "Valid buyIn required" });
    }
    const user = req.user!;
    const result = await fastFoldManager.addPlayer(
      poolId,
      user.id,
      user.displayName || user.username,
      Number(buyIn)
    );
    if (!result.ok) {
      return res.status(400).json({ message: result.error });
    }
    res.json({ ok: true, tableId: result.tableId, poolState: fastFoldManager.getPoolState(poolId) });
  });

  app.post("/api/fast-fold/pools/:poolId/leave", requireAuth, async (req, res) => {
    const result = await fastFoldManager.removePlayer(req.user!.id);
    if (!result.ok) {
      return res.status(400).json({ message: result.error });
    }
    res.json({ ok: true });
  });

  // ─── Hand Routes ─────────────────────────────────────────────────────────
  // ─── Secure Hand History Routes ──────────────────────────────────────────
  // ALL hand endpoints require authentication. Sensitive fields are stripped.

  app.get("/api/hands/:id", requireAuth, async (req, res, next) => {
    try {
      const hand = await storage.getGameHand(req.params.id);
      if (!hand) return res.status(404).json({ message: "Hand not found" });

      // Strip sensitive fields — never expose raw deck order, seeds, or full summary
      // Only admins or participants can see verification data
      const isAdmin = req.user!.role === "admin";
      const handPlayers = await storage.getHandPlayers(req.params.id);
      const isParticipant = handPlayers.some((p: any) => p.userId === req.user!.id);

      const safe: Record<string, any> = {
        id: hand.id,
        tableId: hand.tableId,
        handNumber: hand.handNumber,
        dealerSeat: hand.dealerSeat,
        communityCards: hand.communityCards,
        potTotal: hand.potTotal,
        totalRake: hand.totalRake,
        winnerIds: hand.winnerIds,
        commitmentHash: hand.commitmentHash, // hash is safe — it's the public commitment
        onChainCommitTx: hand.onChainCommitTx,
        onChainRevealTx: hand.onChainRevealTx,
        createdAt: hand.createdAt,
      };

      // Only participants and admins can see verification proof data (post-hand)
      if (isAdmin || isParticipant) {
        safe.serverSeed = hand.serverSeed;
        safe.deckOrder = hand.deckOrder;
        safe.playerSeeds = hand.playerSeeds;
        safe.vrfRequestId = hand.vrfRequestId;
        safe.vrfRandomWord = hand.vrfRandomWord;
      }

      // Never expose raw summary to non-admins (contains all hole cards)
      if (isAdmin) {
        safe.summary = hand.summary;
      }

      res.json(safe);
    } catch (err) {
      next(err);
    }
  });

  // Hand verification — only for participants and admins
  app.get("/api/hands/:id/verify", requireAuth, async (req, res, next) => {
    try {
      const hand = await storage.getGameHand(req.params.id);
      if (!hand) return res.status(404).json({ message: "Hand not found" });
      if (!hand.serverSeed || !hand.commitmentHash || !hand.deckOrder) {
        return res.status(404).json({ message: "No proof data for this hand" });
      }

      // Only participants or admins can verify
      const isAdmin = req.user!.role === "admin";
      const handPlayers = await storage.getHandPlayers(req.params.id);
      const isParticipant = handPlayers.some((p: any) => p.userId === req.user!.id);
      if (!isAdmin && !isParticipant) {
        return res.status(403).json({ message: "Only hand participants can verify" });
      }

      res.json({
        serverSeed: hand.serverSeed,
        commitmentHash: hand.commitmentHash,
        deckOrder: hand.deckOrder,
        handNumber: hand.handNumber,
        tableId: hand.tableId,
      });
    } catch (err) {
      next(err);
    }
  });

  // Table hands list
  app.get("/api/tables/:id/hands", requireAuth, async (req, res, next) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const hands = await storage.getGameHands(req.params.id, limit);
      // Strip sensitive fields from list view
      const safe = hands.map((h: any) => ({
        id: h.id, tableId: h.tableId, handNumber: h.handNumber,
        potTotal: h.potTotal, totalRake: h.totalRake, winnerIds: h.winnerIds,
        communityCards: h.communityCards, commitmentHash: h.commitmentHash,
        createdAt: h.createdAt,
      }));
      res.json(safe);
    } catch (err) {
      next(err);
    }
  });

  // Hand players — strip hole cards for non-showdown non-self players
  app.get("/api/hands/:id/players", requireAuth, async (req, res, next) => {
    try {
      const players = await storage.getHandPlayers(req.params.id);
      const safePlayers = players.map((p: any) => {
        if (p.userId === req.user!.id || p.finalAction === "showdown") {
          return p;
        }
        const { holeCards, ...rest } = p;
        return rest;
      });
      res.json(safePlayers);
    } catch (err) {
      next(err);
    }
  });

  // Hand actions — require authentication
  app.get("/api/hands/:id/actions", requireAuth, async (req, res, next) => {
    try {
      const actions = await storage.getHandActions(req.params.id);
      res.json(actions);
    } catch (err) {
      next(err);
    }
  });

  // Player hand history (all hands a user participated in)
  app.get("/api/players/:id/hands", requireAuth, async (req, res, next) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const hands = await storage.getPlayerHandHistory(req.params.id, limit);
      res.json(hands);
    } catch (err) {
      next(err);
    }
  });

  // ─── Hand Analysis Routes ────────────────────────────────────────────
  app.post("/api/analyze-hand", requireAuth, async (req, res, next) => {
    try {
      const { holeCards, communityCards, pot, position } = req.body;
      if (!holeCards || !Array.isArray(holeCards)) {
        return res.status(400).json({ message: "holeCards required" });
      }

      // Simple analysis based on hand strength and position
      const analysis = analyzeHand(holeCards, communityCards || [], pot || 0, position || "middle");

      await storage.createHandAnalysis({
        userId: req.user!.id,
        handId: typeof req.body.handId === "string" ? req.body.handId.slice(0, 100) : null,
        holeCards,
        communityCards: communityCards || null,
        pot: pot || 0,
        position: position || null,
        analysis,
      });

      // Return the analysis directly (matches AIAnalysisPanel's AnalysisResult shape)
      res.json(analysis);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/analyses", requireAuth, async (req, res, next) => {
    try {
      const analyses = await storage.getUserHandAnalyses(req.user!.id);
      res.json(analyses);
    } catch (err) {
      next(err);
    }
  });

  // ─── Card Encryption Verification ───────────────────────────────────────

  const cardEncryption = await import("../game/card-encryption");

  // Player can verify their own session key commitment
  app.get("/api/encryption/verify", requireAuth, async (req, res) => {
    const result = cardEncryption.verifySessionCommitment(req.user!.id);
    if (!result.found) return res.json({ verified: false, message: "No active session commitment" });

    const explorerUrl = result.batch?.txHash
      ? `https://${blockchainConfig.chainId === 137 ? "" : "amoy."}polygonscan.com/tx/${result.batch.txHash}`
      : null;

    res.json({
      verified: true,
      commitment: result.commitment,
      anchored: !!result.batch,
      batch: result.batch ? {
        merkleRoot: result.batch.merkleRoot,
        txHash: result.batch.txHash,
        explorerUrl,
        anchoredAt: new Date(result.batch.anchoredAt).toISOString(),
      } : null,
      merkleProof: result.merkleProof || null,
    });
  });

  // Admin: encryption stats
  app.get("/api/admin/encryption/stats", requireAuth, requireAdmin, async (_req, res) => {
    res.json(cardEncryption.getEncryptionStats());
  });

  // Admin: force anchor pending commitments now
  app.post("/api/admin/encryption/anchor", requireAuth, requireAdmin, async (req, res) => {
    const result = await cardEncryption.forceAnchor();
    if (!result) return res.json({ message: "No pending commitments to anchor" });
    await logAdminAction(req, "force_anchor", "system", null,
      { merkleRoot: result.merkleRoot, txHash: result.txHash, count: result.count });
    res.json(result);
  });

  // ─── Coaching - Live Analysis ────────────────────────────────────────────
  app.post("/api/coaching/live-analysis", requireAuth, async (req, res, next) => {
    try {
      const { holeCards, communityCards, pot, currentBet, position, phase } = req.body;
      if (!holeCards || !Array.isArray(holeCards) || holeCards.length < 2) {
        return res.status(400).json({ message: "holeCards required (array of 2+)" });
      }

      // Deduct 50 chips
      const user = await storage.getUser(req.user!.id);
      if (!user || user.chipBalance < 50) {
        return res.status(400).json({ message: "Insufficient chips (50 required)" });
      }
      await storage.atomicDeductChips(req.user!.id, 50);

      // Algorithmic poker math — no AI needed
      const ranks = "23456789TJQKA";
      const cardRank = (c: string) => ranks.indexOf(c[0]);
      const r1 = cardRank(holeCards[0]);
      const r2 = cardRank(holeCards[1]);
      const suited = holeCards[0]?.[1] === holeCards[1]?.[1];
      const paired = r1 === r2;

      // Hand strength 1-10
      let strength = Math.max(r1, r2) * 0.5 + Math.min(r1, r2) * 0.3;
      if (paired) strength += 3;
      if (suited) strength += 1.5;
      if (r1 >= 10 && r2 >= 10) strength += 2;
      strength = Math.min(10, Math.max(1, Math.round(strength)));

      // Position modifier
      const positionBonus: Record<string, number> = {
        "BTN": 1.5, "CO": 1.2, "MP": 0, "EP": -1, "SB": -0.5, "BB": 0.5,
      };
      const posMod = positionBonus[position] || 0;

      // Pot odds calculation
      const potSize = pot || 100;
      const betToCall = currentBet || 0;
      const potOdds = betToCall > 0 ? betToCall / (potSize + betToCall) : 0;

      const communityLen = Array.isArray(communityCards) ? communityCards.length : 0;
      const streetBonus = communityLen >= 3 ? 0.5 : 0;

      const winProb = Math.min(0.95, Math.max(0.05, (strength + posMod + streetBonus) / 12));
      const ev = Math.round((winProb * potSize - (1 - winProb) * betToCall) * 100) / 100;

      let action: string;
      let confidence: number;
      if (strength + posMod >= 7) {
        action = "RAISE";
        confidence = Math.min(95, 60 + strength * 3);
      } else if (ev > 0 || potOdds < winProb) {
        action = "CALL";
        confidence = Math.min(85, 50 + strength * 2);
      } else {
        action = "FOLD";
        confidence = Math.min(90, 55 + (10 - strength) * 3);
      }

      const explanations: Record<string, string> = {
        RAISE: `Strong hand (${strength}/10) in ${position || "position"} with positive EV.`,
        CALL: `Decent odds — pot odds ${(potOdds * 100).toFixed(0)}% vs ${(winProb * 100).toFixed(0)}% equity.`,
        FOLD: `Weak holding (${strength}/10) — negative EV in this spot.`,
      };

      res.json({ action, ev, confidence: Math.round(confidence), explanation: explanations[action] });
    } catch (err) { next(err); }
  });
}
