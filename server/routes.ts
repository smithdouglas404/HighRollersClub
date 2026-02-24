import type { Express, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { registerAuthRoutes, requireAuth } from "./auth";
import { insertTableSchema, insertClubSchema } from "@shared/schema";
import { setupWebSocket } from "./websocket";

export async function registerRoutes(app: Express, sessionMiddleware: RequestHandler): Promise<Server> {
  // Auth routes
  registerAuthRoutes(app);

  // ─── Table Routes ────────────────────────────────────────────────────────
  // List all public tables (+ user's private tables)
  app.get("/api/tables", async (req, res, next) => {
    try {
      const allTables = await storage.getTables();
      const tablesWithPlayers = await Promise.all(
        allTables.map(async (table) => {
          const players = await storage.getTablePlayers(table.id);
          return {
            ...table,
            playerCount: players.length,
            password: undefined, // never expose password
          };
        })
      );
      // Show public tables, or private tables the user created
      const visible = tablesWithPlayers.filter(t => {
        if (!t.isPrivate) return true;
        return req.user && t.createdById === req.user.id;
      });
      res.json(visible);
    } catch (err) {
      next(err);
    }
  });

  // Get single table
  app.get("/api/tables/:id", async (req, res, next) => {
    try {
      const table = await storage.getTable(req.params.id);
      if (!table) return res.status(404).json({ message: "Table not found" });
      const players = await storage.getTablePlayers(table.id);
      res.json({ ...table, password: undefined, players });
    } catch (err) {
      next(err);
    }
  });

  // Create table
  app.post("/api/tables", requireAuth, async (req, res, next) => {
    try {
      const parsed = insertTableSchema.safeParse(req.body);
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

  // ─── Club Routes ─────────────────────────────────────────────────────────
  app.get("/api/clubs", async (_req, res, next) => {
    try {
      const allClubs = await storage.getClubs();
      res.json(allClubs);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/clubs/:id", async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const members = await storage.getClubMembers(club.id);
      res.json({ ...club, memberCount: members.length });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/clubs/:id/members", async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const members = await storage.getClubMembers(club.id);
      // Enrich with user data
      const enriched = await Promise.all(
        members.map(async (m) => {
          const user = await storage.getUser(m.userId);
          return {
            ...m,
            username: user?.username || "Unknown",
            displayName: user?.displayName || user?.username || "Unknown",
            avatarId: user?.avatarId || null,
            chipBalance: user?.chipBalance ?? 0,
          };
        })
      );
      res.json(enriched);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/clubs", requireAuth, async (req, res, next) => {
    try {
      const parsed = insertClubSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid club data", errors: parsed.error.flatten() });
      }
      const club = await storage.createClub({
        ...parsed.data,
        ownerId: req.user!.id,
      });
      res.status(201).json(club);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/clubs/:id/join", requireAuth, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const members = await storage.getClubMembers(club.id);
      if (members.some(m => m.userId === req.user!.id)) {
        return res.status(409).json({ message: "Already a member" });
      }
      await storage.addClubMember(club.id, req.user!.id);
      res.json({ message: "Joined club" });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/clubs/:id/leave", requireAuth, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      if (club.ownerId === req.user!.id) {
        return res.status(400).json({ message: "Owner cannot leave club" });
      }
      await storage.removeClubMember(club.id, req.user!.id);
      res.json({ message: "Left club" });
    } catch (err) {
      next(err);
    }
  });

  // ─── Profile Routes ──────────────────────────────────────────────────────
  app.put("/api/profile/avatar", requireAuth, async (req, res, next) => {
    try {
      const { avatarId } = req.body;
      if (!avatarId || typeof avatarId !== "string") {
        return res.status(400).json({ message: "avatarId required" });
      }
      await storage.updateUser(req.user!.id, { avatarId });
      const user = await storage.getUser(req.user!.id);
      res.json(user);
    } catch (err) {
      next(err);
    }
  });

  // ─── Wallet Routes ───────────────────────────────────────────────────────
  app.get("/api/wallet/balance", requireAuth, async (req, res, next) => {
    try {
      const user = await storage.getUser(req.user!.id);
      res.json({ balance: user?.chipBalance ?? 0 });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/wallet/claim-daily", requireAuth, async (req, res, next) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const now = new Date();
      if (user.lastDailyClaim) {
        const hoursSince = (now.getTime() - user.lastDailyClaim.getTime()) / (1000 * 60 * 60);
        if (hoursSince < 24) {
          return res.status(429).json({
            message: "Daily bonus already claimed",
            nextClaimAt: new Date(user.lastDailyClaim.getTime() + 24 * 60 * 60 * 1000),
          });
        }
      }

      const bonus = 1000;
      const balanceBefore = user.chipBalance;
      const balanceAfter = balanceBefore + bonus;

      await storage.updateUser(user.id, {
        chipBalance: balanceAfter,
        lastDailyClaim: now,
      });

      await storage.createTransaction({
        userId: user.id,
        type: "bonus",
        amount: bonus,
        balanceBefore,
        balanceAfter,
        tableId: null,
        description: "Daily login bonus",
      });

      res.json({ balance: balanceAfter, bonus });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/wallet/transactions", requireAuth, async (req, res, next) => {
    try {
      const txs = await storage.getTransactions(req.user!.id);
      res.json(txs);
    } catch (err) {
      next(err);
    }
  });

  // ─── Hand Routes ─────────────────────────────────────────────────────────
  app.get("/api/hands/:id", async (req, res, next) => {
    try {
      const hand = await storage.getGameHand(req.params.id);
      if (!hand) return res.status(404).json({ message: "Hand not found" });
      res.json(hand);
    } catch (err) {
      next(err);
    }
  });

  // ─── Hand Verification Route ──────────────────────────────────────────────
  app.get("/api/hands/:id/verify", async (req, res, next) => {
    try {
      const hand = await storage.getGameHand(req.params.id);
      if (!hand) return res.status(404).json({ message: "Hand not found" });
      if (!hand.serverSeed || !hand.commitmentHash || !hand.deckOrder) {
        return res.status(404).json({ message: "No proof data for this hand" });
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

  // ─── Hand History Routes ────────────────────────────────────────────────
  app.get("/api/tables/:id/hands", async (req, res, next) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const hands = await storage.getGameHands(req.params.id, limit);
      res.json(hands);
    } catch (err) {
      next(err);
    }
  });

  // ─── Player Stats Routes ──────────────────────────────────────────────
  app.get("/api/stats/me", requireAuth, async (req, res, next) => {
    try {
      const stats = await storage.getPlayerStats(req.user!.id);
      if (!stats) {
        return res.json({
          handsPlayed: 0, potsWon: 0,
          bestWinStreak: 0, currentWinStreak: 0, totalWinnings: 0,
        });
      }
      res.json({
        handsPlayed: stats.handsPlayed,
        potsWon: stats.potsWon,
        bestWinStreak: stats.bestWinStreak,
        currentWinStreak: stats.currentWinStreak,
        totalWinnings: stats.totalWinnings,
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── Create HTTP Server + WebSocket ──────────────────────────────────────
  const httpServer = createServer(app);
  setupWebSocket(httpServer, sessionMiddleware);

  return httpServer;
}
