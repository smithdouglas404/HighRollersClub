import type { Express, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { registerAuthRoutes, requireAuth } from "./auth";
import { insertTableSchema, insertClubSchema, createAllianceSchema, updateAllianceSchema, createLeagueSeasonSchema, updateLeagueSeasonSchema, leagueStandingsSchema, createTournamentSchema } from "@shared/schema";
import { setupWebSocket, sendGameStateToTable, getClients } from "./websocket";
import { getBlindPreset } from "./game/blind-presets";
import { tableManager } from "./game/table-manager";
import { analyzeHand } from "./game/hand-analyzer";
import { geofenceMiddleware } from "./middleware/geofence";
import { setAnthropicApiKey, getAnthropicApiKey, hasAIEnabled } from "./game/ai-bot-engine";

export async function registerRoutes(app: Express, sessionMiddleware: RequestHandler): Promise<Server> {
  // Auth routes
  registerAuthRoutes(app);

  // ─── Online Users ──────────────────────────────────────────────────────
  app.get("/api/online-users", (_req, res) => {
    const clients = getClients();
    const onlineIds = Array.from(clients.keys());
    res.json(onlineIds);
  });

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
      let visible = tablesWithPlayers.filter(t => {
        if (!t.isPrivate) return true;
        return req.user && t.createdById === req.user.id;
      });

      // Optional format filter
      const format = req.query.format as string;
      if (format && format !== "all") {
        visible = visible.filter(t => t.gameFormat === format);
      }

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
      const occupiedSeats = players.map(p => p.seatIndex);
      res.json({ ...table, password: undefined, players, occupiedSeats });
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

  // Create table
  app.post("/api/tables", requireAuth, async (req, res, next) => {
    try {
      // Resolve blindPreset to blindSchedule for SNG/Tournament tables
      const body = { ...req.body };
      if ((body.gameFormat === "sng" || body.gameFormat === "tournament") && body.blindPreset && !body.blindSchedule) {
        body.blindSchedule = getBlindPreset(body.blindPreset);
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

  // ─── User's Clubs ───────────────────────────────────────────────────────
  app.get("/api/me/clubs", requireAuth, async (req, res, next) => {
    try {
      const userClubs = await storage.getUserClubs(req.user!.id);
      res.json(userClubs);
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

  // User's pending club join requests (must be before /api/clubs/:id)
  app.get("/api/clubs/my-pending-requests", requireAuth, async (req, res, next) => {
    try {
      const requests = await storage.getUserPendingRequests(req.user!.id);
      res.json(requests);
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

  // Get stats for all members of a club
  app.get("/api/clubs/:id/members/stats", async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const members = await storage.getClubMembers(club.id);
      const userIds = members.map(m => m.userId);
      const statsMap = await storage.getPlayerStatsBatch(userIds);
      // Return as object keyed by userId
      const result: Record<string, any> = {};
      for (const uid of userIds) {
        const s = statsMap.get(uid);
        result[uid] = {
          handsPlayed: s?.handsPlayed ?? 0,
          potsWon: s?.potsWon ?? 0,
          bestWinStreak: s?.bestWinStreak ?? 0,
          currentWinStreak: s?.currentWinStreak ?? 0,
          totalWinnings: s?.totalWinnings ?? 0,
          vpip: s?.vpip ?? 0,
          pfr: s?.pfr ?? 0,
          showdownCount: s?.showdownCount ?? 0,
        };
      }
      res.json(result);
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

  // Update club settings (owner/admin only)
  app.put("/api/clubs/:id", requireAuth, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const members = await storage.getClubMembers(club.id);
      const member = members.find(m => m.userId === req.user!.id);
      if (!member || (member.role !== "owner" && member.role !== "admin")) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const { name, description, isPublic, avatarUrl } = req.body;
      const updated = await storage.updateClub(club.id, { name, description, isPublic, avatarUrl });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // Delete club (owner only)
  app.delete("/api/clubs/:id", requireAuth, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      if (club.ownerId !== req.user!.id) {
        return res.status(403).json({ message: "Only the club owner can delete the club" });
      }
      await storage.deleteClub(club.id);
      res.json({ message: "Club deleted" });
    } catch (err) {
      next(err);
    }
  });

  // Send invite or request to join
  app.post("/api/clubs/:id/invite", requireAuth, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const { userId, username, type } = req.body; // type: "invite" | "request"
      let targetUserId = type === "request" ? req.user!.id : userId;
      // Support invite by username
      if (!targetUserId && username) {
        const targetUser = await storage.getUserByUsername(username);
        if (!targetUser) return res.status(404).json({ message: `User "${username}" not found` });
        targetUserId = targetUser.id;
      }
      if (!targetUserId) return res.status(400).json({ message: "userId or username required" });

      const inv = await storage.createClubInvitation({
        clubId: club.id,
        userId: targetUserId,
        type: type || "invite",
        status: "pending",
      });
      res.status(201).json(inv);
    } catch (err) {
      next(err);
    }
  });

  // Accept/decline invitation
  app.put("/api/clubs/:id/invitations/:invId", requireAuth, async (req, res, next) => {
    try {
      const { status } = req.body;
      if (status !== "accepted" && status !== "declined") {
        return res.status(400).json({ message: "Status must be 'accepted' or 'declined'" });
      }
      const inv = await storage.updateClubInvitation(req.params.invId, { status });
      if (!inv) return res.status(404).json({ message: "Invitation not found" });
      if (status === "accepted") {
        await storage.addClubMember(req.params.id, inv.userId);
      }
      res.json(inv);
    } catch (err) {
      next(err);
    }
  });

  // Get club invitations
  app.get("/api/clubs/:id/invitations", requireAuth, async (req, res, next) => {
    try {
      const invitations = await storage.getClubInvitations(req.params.id);
      // Enrich with user data
      const enriched = await Promise.all(
        invitations.map(async (inv) => {
          const user = await storage.getUser(inv.userId);
          return {
            ...inv,
            username: user?.username || "Unknown",
            displayName: user?.displayName || user?.username || "Unknown",
            avatarId: user?.avatarId || null,
          };
        })
      );
      res.json(enriched);
    } catch (err) {
      next(err);
    }
  });

  // Promote/demote member role
  app.put("/api/clubs/:id/members/:userId/role", requireAuth, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const members = await storage.getClubMembers(club.id);
      const requester = members.find(m => m.userId === req.user!.id);
      if (!requester || (requester.role !== "owner" && requester.role !== "admin")) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const { role } = req.body;
      if (!["admin", "member"].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      await storage.updateClubMemberRole(req.params.id, req.params.userId, role);
      res.json({ message: "Role updated" });
    } catch (err) {
      next(err);
    }
  });

  // Kick member
  app.delete("/api/clubs/:id/members/:userId", requireAuth, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const members = await storage.getClubMembers(club.id);
      const requester = members.find(m => m.userId === req.user!.id);
      if (!requester || (requester.role !== "owner" && requester.role !== "admin")) {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (req.params.userId === club.ownerId) {
        return res.status(400).json({ message: "Cannot kick the owner" });
      }
      await storage.removeClubMember(req.params.id, req.params.userId);
      res.json({ message: "Member removed" });
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

  // Club Announcements
  app.get("/api/clubs/:id/announcements", async (req, res, next) => {
    try {
      const announcements = await storage.getClubAnnouncements(req.params.id);
      const enriched = await Promise.all(
        announcements.map(async (a) => {
          const user = await storage.getUser(a.authorId);
          return { ...a, authorName: user?.displayName || user?.username || "Unknown" };
        })
      );
      res.json(enriched);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/clubs/:id/announcements", requireAuth, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const members = await storage.getClubMembers(club.id);
      const member = members.find(m => m.userId === req.user!.id);
      if (!member || (member.role !== "owner" && member.role !== "admin")) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const { title, content, pinned } = req.body;
      const ann = await storage.createClubAnnouncement({
        clubId: club.id,
        authorId: req.user!.id,
        title,
        content,
        pinned: pinned || false,
      });
      res.status(201).json(ann);
    } catch (err) {
      next(err);
    }
  });

  // Club Events
  app.get("/api/clubs/:id/events", async (req, res, next) => {
    try {
      const events = await storage.getClubEvents(req.params.id);
      res.json(events);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/clubs/:id/events", requireAuth, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const { eventType, name, description, startTime, tableId } = req.body;
      const ev = await storage.createClubEvent({
        clubId: club.id,
        eventType,
        name,
        description: description || null,
        startTime: startTime ? new Date(startTime) : null,
        tableId: tableId || null,
      });
      res.status(201).json(ev);
    } catch (err) {
      next(err);
    }
  });

  // ─── Profile Routes ──────────────────────────────────────────────────────
  app.put("/api/profile/avatar", requireAuth, async (req, res, next) => {
    try {
      const { avatarId, displayName } = req.body;
      const updates: Record<string, any> = {};
      if (avatarId && typeof avatarId === "string") updates.avatarId = avatarId;
      if (displayName && typeof displayName === "string") updates.displayName = displayName.trim().slice(0, 50);
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "avatarId or displayName required" });
      }
      await storage.updateUser(req.user!.id, updates);
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

  app.get("/api/wallet/daily-status", requireAuth, async (req, res, next) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Determine bonus amount (2x with Elite Pass)
      const inv = await storage.getUserInventory(user.id);
      const items = await storage.getShopItems();
      const elitePass = items.find(i => i.category === "premium" && i.rarity === "legendary");
      const hasElitePass = elitePass ? inv.some(i => i.itemId === elitePass.id) : false;
      const bonusAmount = hasElitePass ? 2000 : 1000;

      if (user.lastDailyClaim) {
        const nextClaimAt = new Date(user.lastDailyClaim.getTime() + 24 * 60 * 60 * 1000);
        if (nextClaimAt.getTime() > Date.now()) {
          return res.json({ canClaim: false, nextClaimAt, bonusAmount });
        }
      }
      res.json({ canClaim: true, nextClaimAt: null, bonusAmount });
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

      // Check if user has Elite Pass for 2x bonus
      const userInventory = await storage.getUserInventory(user.id);
      const allShopItems = await storage.getShopItems();
      const elitePass = allShopItems.find(i => i.category === "premium" && i.rarity === "legendary");
      const hasElitePass = elitePass ? userInventory.some(inv => inv.itemId === elitePass.id) : false;
      const bonus = hasElitePass ? 2000 : 1000;
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

      res.json({ balance: balanceAfter, bonus, nextClaimAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/wallet/transactions", requireAuth, async (req, res, next) => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
      const txs = await storage.getTransactions(req.user!.id, limit, offset);
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

  // Hand players (per-player records for a specific hand)
  app.get("/api/hands/:id/players", async (req, res, next) => {
    try {
      const players = await storage.getHandPlayers(req.params.id);
      res.json(players);
    } catch (err) {
      next(err);
    }
  });

  // Hand actions (action-by-action replay log)
  app.get("/api/hands/:id/actions", async (req, res, next) => {
    try {
      const actions = await storage.getHandActions(req.params.id);
      res.json(actions);
    } catch (err) {
      next(err);
    }
  });

  // Player hand history (all hands a user participated in)
  app.get("/api/players/:id/hands", async (req, res, next) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const hands = await storage.getPlayerHandHistory(req.params.id, limit);
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
          vpip: 0, pfr: 0, showdownCount: 0,
        });
      }
      res.json({
        handsPlayed: stats.handsPlayed,
        potsWon: stats.potsWon,
        bestWinStreak: stats.bestWinStreak,
        currentWinStreak: stats.currentWinStreak,
        totalWinnings: stats.totalWinnings,
        vpip: stats.vpip,
        pfr: stats.pfr,
        showdownCount: stats.showdownCount,
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── Leaderboard ─────────────────────────────────────────────────────
  app.get("/api/leaderboard", requireAuth, async (req, res, next) => {
    try {
      const metric = (req.query.metric as string) || "chips";
      if (!["chips", "wins", "winRate"].includes(metric)) {
        return res.status(400).json({ error: "Invalid metric. Use chips, wins, or winRate" });
      }
      const data = await storage.getLeaderboard(metric as "chips" | "wins" | "winRate", 50);
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  // ─── Missions Routes ──────────────────────────────────────────────────

  // Helper: check if a mission period has expired and needs reset
  function isMissionPeriodStale(periodStart: Date | null, periodType: string): boolean {
    if (!periodStart) return true;
    const now = Date.now();
    const start = new Date(periodStart).getTime();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    if (periodType === "daily" && now - start > TWENTY_FOUR_HOURS) return true;
    if (periodType === "weekly" && now - start > SEVEN_DAYS) return true;
    return false;
  }

  // Helper: reset stale user missions and player stats for a given user.
  // Returns true if any missions were reset.
  async function resetStaleMissions(userId: string, allMissions: any[], userMs: any[]): Promise<boolean> {
    let didReset = false;
    for (const um of userMs) {
      const mission = allMissions.find((m: any) => m.id === um.missionId);
      if (!mission) continue;
      if (isMissionPeriodStale(um.periodStart, mission.periodType)) {
        await storage.updateUserMission(um.id, {
          progress: 0,
          claimedAt: null,
          completedAt: null,
          periodStart: new Date(),
        });
        didReset = true;
      }
    }
    // If any mission was reset, also reset the player's tracked stats so
    // progress counters start fresh for the new period
    if (didReset) {
      await storage.resetDailyStats(userId);
    }
    return didReset;
  }

  app.get("/api/missions", requireAuth, async (req, res, next) => {
    try {
      const allMissions = await storage.getMissions();
      let userMs = await storage.getUserMissions(req.user!.id);

      // Lazy reset: check for stale mission periods and reset them
      const didReset = await resetStaleMissions(req.user!.id, allMissions, userMs);
      // Re-fetch after reset so we have fresh data
      if (didReset) {
        userMs = await storage.getUserMissions(req.user!.id);
      }

      const stats = await storage.getPlayerStats(req.user!.id);

      const result = allMissions.map(m => {
        const userMission = userMs.find(um => um.missionId === m.id);
        let progress = 0;
        if (stats) {
          switch (m.type) {
            case "hands_played": progress = stats.handsPlayed; break;
            case "pots_won": progress = stats.potsWon; break;
            case "win_streak": progress = stats.bestWinStreak; break;
            case "consecutive_wins": progress = stats.currentWinStreak; break;
            case "sng_win": progress = (stats as any).sngWins ?? 0; break;
            case "bomb_pot": progress = (stats as any).bombPotsPlayed ?? 0; break;
            case "heads_up_win": progress = (stats as any).headsUpWins ?? 0; break;
            default: progress = userMission?.progress || 0;
          }
        }
        return {
          ...m,
          progress: Math.min(progress, m.target),
          completed: progress >= m.target,
          claimed: !!userMission?.claimedAt,
          userMissionId: userMission?.id,
        };
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/missions/:id/claim", requireAuth, async (req, res, next) => {
    try {
      const allMissions = await storage.getMissions();
      const mission = allMissions.find(m => m.id === req.params.id);
      if (!mission) return res.status(404).json({ message: "Mission not found" });

      // Lazy reset: check all user missions for staleness before evaluating claim
      let userMs = await storage.getUserMissions(req.user!.id);
      const didReset = await resetStaleMissions(req.user!.id, allMissions, userMs);
      if (didReset) {
        userMs = await storage.getUserMissions(req.user!.id);
      }

      const stats = await storage.getPlayerStats(req.user!.id);
      let progress = 0;
      if (stats) {
        switch (mission.type) {
          case "hands_played": progress = stats.handsPlayed; break;
          case "pots_won": progress = stats.potsWon; break;
          case "win_streak": progress = stats.bestWinStreak; break;
          case "consecutive_wins": progress = stats.currentWinStreak; break;
          case "sng_win": progress = (stats as any).sngWins ?? 0; break;
          case "bomb_pot": progress = (stats as any).bombPotsPlayed ?? 0; break;
          case "heads_up_win": progress = (stats as any).headsUpWins ?? 0; break;
        }
      }

      if (progress < mission.target) {
        return res.status(400).json({ message: "Mission not completed" });
      }

      // Check if already claimed
      const existing = userMs.find(um => um.missionId === mission.id && um.claimedAt);
      if (existing) {
        return res.status(400).json({ message: "Already claimed" });
      }

      // Create or update user mission
      let userMission = userMs.find(um => um.missionId === mission.id);
      if (userMission) {
        await storage.updateUserMission(userMission.id, {
          claimedAt: new Date(),
          completedAt: new Date(),
          progress,
        });
      } else {
        await storage.createUserMission({
          userId: req.user!.id,
          missionId: mission.id,
          progress,
          completedAt: new Date(),
          claimedAt: new Date(),
          periodStart: new Date(),
        });
      }

      // Credit reward
      const user = await storage.getUser(req.user!.id);
      if (user) {
        await storage.updateUser(user.id, { chipBalance: user.chipBalance + mission.reward });
        await storage.createTransaction({
          userId: user.id,
          type: "bonus",
          amount: mission.reward,
          balanceBefore: user.chipBalance,
          balanceAfter: user.chipBalance + mission.reward,
          tableId: null,
          description: `Mission reward: ${mission.label}`,
        });
      }

      res.json({ message: "Reward claimed", reward: mission.reward });
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
        handId: req.body.handId || null,
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

  // ─── Shop Routes ─────────────────────────────────────────────────────
  app.get("/api/shop/items", async (req, res, next) => {
    try {
      const category = req.query.category as string;
      const items = await storage.getShopItems(category || undefined);
      res.json(items);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/shop/purchase", requireAuth, async (req, res, next) => {
    try {
      const { itemId } = req.body;
      const item = await storage.getShopItem(itemId);
      if (!item) return res.status(404).json({ message: "Item not found" });

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Check if already owned
      const inventory = await storage.getUserInventory(user.id);
      if (inventory.some(i => i.itemId === itemId)) {
        return res.status(400).json({ message: "Already owned" });
      }

      if (user.chipBalance < item.price) {
        return res.status(400).json({ message: "Insufficient chips" });
      }

      await storage.updateUser(user.id, { chipBalance: user.chipBalance - item.price });
      await storage.createTransaction({
        userId: user.id,
        type: "withdraw",
        amount: -item.price,
        balanceBefore: user.chipBalance,
        balanceAfter: user.chipBalance - item.price,
        tableId: null,
        description: `Purchased: ${item.name}`,
      });

      const inv = await storage.addToInventory(user.id, itemId);

      // Grant bonus chips if item description mentions chips (e.g., VIP Chip Bundle)
      const chipMatch = item.description?.match(/(\d[\d,]*)\s*chips/i);
      if (chipMatch) {
        const bonusChips = parseInt(chipMatch[1].replace(/,/g, ""), 10);
        if (bonusChips > 0) {
          const updatedUser = await storage.getUser(user.id);
          if (updatedUser) {
            const newBalance = updatedUser.chipBalance + bonusChips;
            await storage.updateUser(user.id, { chipBalance: newBalance });
            await storage.createTransaction({
              userId: user.id,
              type: "deposit",
              amount: bonusChips,
              balanceBefore: updatedUser.chipBalance,
              balanceAfter: newBalance,
              tableId: null,
              description: `Bonus chips from: ${item.name}`,
            });
          }
        }
      }

      res.json({ message: "Purchased", item: inv });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/shop/inventory", requireAuth, async (req, res, next) => {
    try {
      const inventory = await storage.getUserInventory(req.user!.id);
      // Enrich with item data
      const enriched = await Promise.all(
        inventory.map(async (inv) => {
          const item = await storage.getShopItem(inv.itemId);
          return { ...inv, item };
        })
      );
      res.json(enriched);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/shop/equip", requireAuth, async (req, res, next) => {
    try {
      const { inventoryId } = req.body;
      await storage.equipItem(inventoryId);
      res.json({ message: "Equipped" });
    } catch (err) {
      next(err);
    }
  });

  // ─── Tournament Routes ──────────────────────────────────────────────────
  app.get("/api/tournaments", async (_req, res, next) => {
    try {
      const tourneys = await storage.getTournaments();
      res.json(tourneys);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/tournaments/:id", async (req, res, next) => {
    try {
      const tourney = await storage.getTournament(req.params.id);
      if (!tourney) return res.status(404).json({ message: "Tournament not found" });
      const regs = await storage.getTournamentRegistrations(tourney.id);
      res.json({ ...tourney, registrations: regs });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/tournaments", requireAuth, async (req, res, next) => {
    try {
      const parsed = createTournamentSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid input" });
      const { name, buyIn, startingChips, maxPlayers, clubId, startAt } = parsed.data;
      const { blindPreset } = req.body;

      const blindSchedule = blindPreset ? getBlindPreset(blindPreset) : getBlindPreset("mtt");

      const tourney = await storage.createTournament({
        name,
        buyIn,
        startingChips,
        blindSchedule,
        maxPlayers,
        status: "registering",
        prizePool: 0,
        createdById: req.user!.id,
        clubId: clubId || null,
        startAt: startAt ? new Date(startAt) : null,
      });
      res.status(201).json(tourney);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/tournaments/:id/register", requireAuth, async (req, res, next) => {
    try {
      const tourney = await storage.getTournament(req.params.id);
      if (!tourney) return res.status(404).json({ message: "Tournament not found" });
      if (tourney.status !== "registering") {
        return res.status(400).json({ message: "Registration closed" });
      }

      const user = await storage.getUser(req.user!.id);
      if (!user || user.chipBalance < tourney.buyIn) {
        return res.status(400).json({ message: "Insufficient chips" });
      }

      // Atomic registration: try to insert with unique constraint + count check
      // If the user is already registered or tournament is full, the DB will reject it
      const reg = await storage.registerForTournamentAtomic(
        tourney.id,
        req.user!.id,
        tourney.maxPlayers,
      );

      if (!reg) {
        // Re-check to give specific error message
        const regs = await storage.getTournamentRegistrations(tourney.id);
        if (regs.some(r => r.userId === req.user!.id)) {
          return res.status(400).json({ message: "Already registered" });
        }
        return res.status(400).json({ message: "Tournament full" });
      }

      // Deduct buy-in (after successful registration)
      await storage.updateUser(user.id, { chipBalance: user.chipBalance - tourney.buyIn });
      await storage.createTransaction({
        userId: user.id,
        type: "withdraw",
        amount: -tourney.buyIn,
        balanceBefore: user.chipBalance,
        balanceAfter: user.chipBalance - tourney.buyIn,
        tableId: null,
        description: `Tournament buy-in: ${tourney.name}`,
      });

      // Update prize pool
      await storage.updateTournament(tourney.id, {
        prizePool: tourney.prizePool + tourney.buyIn,
      });

      res.status(201).json(reg);
    } catch (err) {
      next(err);
    }
  });

  // ─── Alliance & League Routes ──────────────────────────────────────────

  // List all alliances
  app.get("/api/alliances", async (_req, res, next) => {
    try {
      const alliances = await storage.getClubAlliances();
      res.json(alliances);
    } catch (err) {
      next(err);
    }
  });

  // Alliance detail — enriched with club data
  app.get("/api/alliances/:id", async (req, res, next) => {
    try {
      const alliance = await storage.getClubAlliance(req.params.id);
      if (!alliance) return res.status(404).json({ message: "Alliance not found" });
      const allClubs = await storage.getClubs();
      const clubMap = new Map(allClubs.map((c: any) => [c.id, c]));
      const clubs = (alliance.clubIds as string[]).map(id => {
        const club = clubMap.get(id);
        return club
          ? { id: club.id, name: club.name, ownerId: club.ownerId, memberCount: 0 }
          : { id, name: "Unknown Club", ownerId: null, memberCount: 0 };
      });
      // Enrich with member counts in parallel
      await Promise.all(clubs.map(async (c) => {
        if (c.ownerId) {
          const members = await storage.getClubMembers(c.id);
          c.memberCount = members.length;
        }
      }));
      res.json({ ...alliance, clubs });
    } catch (err) {
      next(err);
    }
  });

  // Create alliance — requires selecting a founding club
  app.post("/api/alliances", requireAuth, async (req, res, next) => {
    try {
      const parsed = createAllianceSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid input" });
      const { name, clubId } = parsed.data;

      const club = await storage.getClub(clubId);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const members = await storage.getClubMembers(clubId);
      const member = members.find((m: any) => m.userId === req.user!.id);
      if (!member || (member.role !== "owner" && member.role !== "admin")) {
        return res.status(403).json({ message: "You must be an owner or admin of the club" });
      }

      const existing = await storage.getClubAllianceByClubId(clubId);
      if (existing) return res.status(409).json({ message: "This club is already in an alliance" });

      const alliance = await storage.createClubAlliance({ name: name.trim(), clubIds: [clubId] });
      res.status(201).json(alliance);
    } catch (err) {
      next(err);
    }
  });

  // Update alliance name
  app.put("/api/alliances/:id", requireAuth, async (req, res, next) => {
    try {
      const alliance = await storage.getClubAlliance(req.params.id);
      if (!alliance) return res.status(404).json({ message: "Alliance not found" });

      const foundingClubId = (alliance.clubIds as string[])[0];
      const members = await storage.getClubMembers(foundingClubId);
      const member = members.find((m: any) => m.userId === req.user!.id);
      if (!member || (member.role !== "owner" && member.role !== "admin")) {
        return res.status(403).json({ message: "Only founding club leaders can edit the alliance" });
      }

      const parsed = updateAllianceSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

      const updated = await storage.updateClubAlliance(req.params.id, {
        name: parsed.data.name,
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // Delete alliance
  app.delete("/api/alliances/:id", requireAuth, async (req, res, next) => {
    try {
      const alliance = await storage.getClubAlliance(req.params.id);
      if (!alliance) return res.status(404).json({ message: "Alliance not found" });

      const foundingClubId = (alliance.clubIds as string[])[0];
      const members = await storage.getClubMembers(foundingClubId);
      const member = members.find((m: any) => m.userId === req.user!.id);
      if (!member || (member.role !== "owner" && member.role !== "admin")) {
        return res.status(403).json({ message: "Only founding club leaders can delete the alliance" });
      }

      await storage.deleteClubAlliance(req.params.id);
      res.json({ message: "Alliance deleted" });
    } catch (err) {
      next(err);
    }
  });

  // Join alliance with a club
  app.post("/api/alliances/:id/join", requireAuth, async (req, res, next) => {
    try {
      const alliance = await storage.getClubAlliance(req.params.id);
      if (!alliance) return res.status(404).json({ message: "Alliance not found" });

      const { clubId } = req.body;
      if (!clubId) return res.status(400).json({ message: "clubId is required" });

      const club = await storage.getClub(clubId);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const members = await storage.getClubMembers(clubId);
      const member = members.find((m: any) => m.userId === req.user!.id);
      if (!member || (member.role !== "owner" && member.role !== "admin")) {
        return res.status(403).json({ message: "You must be an owner or admin of the club" });
      }

      const existingAlliance = await storage.getClubAllianceByClubId(clubId);
      if (existingAlliance) return res.status(409).json({ message: "This club is already in an alliance" });

      const clubIds = alliance.clubIds as string[];
      if (clubIds.includes(clubId)) return res.status(409).json({ message: "Club is already in this alliance" });

      const updatedClubIds = [...clubIds, clubId];
      const updated = await storage.updateClubAlliance(req.params.id, { clubIds: updatedClubIds });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // Remove a club from alliance
  app.post("/api/alliances/:id/remove-club", requireAuth, async (req, res, next) => {
    try {
      const alliance = await storage.getClubAlliance(req.params.id);
      if (!alliance) return res.status(404).json({ message: "Alliance not found" });

      const { clubId } = req.body;
      const clubIds = alliance.clubIds as string[];

      const foundingClubId = clubIds[0];
      if (clubId === foundingClubId) {
        return res.status(400).json({ message: "Cannot remove the founding club. Delete the alliance instead." });
      }

      const foundingMembers = await storage.getClubMembers(foundingClubId);
      const isFoundingLeader = foundingMembers.some((m: any) => m.userId === req.user!.id && (m.role === "owner" || m.role === "admin"));
      const targetMembers = await storage.getClubMembers(clubId);
      const isTargetLeader = targetMembers.some((m: any) => m.userId === req.user!.id && (m.role === "owner" || m.role === "admin"));

      if (!isFoundingLeader && !isTargetLeader) {
        return res.status(403).json({ message: "Not authorized to remove this club" });
      }

      const updatedClubIds = clubIds.filter((id: string) => id !== clubId);
      const updated = await storage.updateClubAlliance(req.params.id, { clubIds: updatedClubIds });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // Get the alliance a club belongs to
  app.get("/api/clubs/:id/alliance", async (req, res, next) => {
    try {
      const alliance = await storage.getClubAllianceByClubId(req.params.id);
      if (!alliance) return res.json(null);
      res.json(alliance);
    } catch (err) {
      next(err);
    }
  });

  // List all league seasons
  app.get("/api/leagues", async (_req, res, next) => {
    try {
      const seasons = await storage.getLeagueSeasons();
      res.json(seasons);
    } catch (err) {
      next(err);
    }
  });

  // League season detail
  app.get("/api/leagues/:id", async (req, res, next) => {
    try {
      const season = await storage.getLeagueSeason(req.params.id);
      if (!season) return res.status(404).json({ message: "League season not found" });
      res.json(season);
    } catch (err) {
      next(err);
    }
  });

  // Create league season
  app.post("/api/leagues", requireAuth, async (req, res, next) => {
    try {
      const parsed = createLeagueSeasonSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid input" });
      const { name, startDate, endDate } = parsed.data;

      const season = await storage.createLeagueSeason({
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        standings: [],
      });
      res.status(201).json(season);
    } catch (err) {
      next(err);
    }
  });

  // Update league season
  app.put("/api/leagues/:id", requireAuth, async (req, res, next) => {
    try {
      const season = await storage.getLeagueSeason(req.params.id);
      if (!season) return res.status(404).json({ message: "League season not found" });

      const parsed = updateLeagueSeasonSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

      const updated = await storage.updateLeagueSeason(req.params.id, {
        ...(parsed.data.name && { name: parsed.data.name }),
        ...(parsed.data.startDate && { startDate: new Date(parsed.data.startDate) }),
        ...(parsed.data.endDate && { endDate: new Date(parsed.data.endDate) }),
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // Delete league season
  app.delete("/api/leagues/:id", requireAuth, async (req, res, next) => {
    try {
      const season = await storage.getLeagueSeason(req.params.id);
      if (!season) return res.status(404).json({ message: "League season not found" });

      await storage.deleteLeagueSeason(req.params.id);
      res.json({ message: "League season deleted" });
    } catch (err) {
      next(err);
    }
  });

  // Manually update league standings
  app.post("/api/leagues/:id/standings", requireAuth, async (req, res, next) => {
    try {
      const season = await storage.getLeagueSeason(req.params.id);
      if (!season) return res.status(404).json({ message: "League season not found" });

      const parsed = leagueStandingsSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

      await storage.updateLeagueStandings(req.params.id, parsed.data.standings);
      const updated = await storage.getLeagueSeason(req.params.id);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // Complete a league season (set endDate to now)
  app.post("/api/leagues/:id/complete", requireAuth, async (req, res, next) => {
    try {
      const season = await storage.getLeagueSeason(req.params.id);
      if (!season) return res.status(404).json({ message: "League season not found" });

      const updated = await storage.updateLeagueSeason(req.params.id, { endDate: new Date() });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // ─── AI Bot Settings ──────────────────────────────────────────────────────
  app.get("/api/ai-settings", requireAuth, (_req, res) => {
    res.json({
      aiEnabled: hasAIEnabled(),
      hasKey: !!getAnthropicApiKey(),
      // Never return the actual key — just whether one is set
    });
  });

  app.post("/api/ai-settings", requireAuth, (req, res, next) => {
    try {
      if (req.user!.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const { apiKey } = req.body;
      if (typeof apiKey === "string" && apiKey.startsWith("sk-")) {
        setAnthropicApiKey(apiKey);
        return res.json({ success: true, aiEnabled: true });
      } else if (apiKey === null || apiKey === "") {
        setAnthropicApiKey(null);
        return res.json({ success: true, aiEnabled: false });
      } else {
        return res.status(400).json({ error: "Invalid API key format — must start with 'sk-'" });
      }
    } catch (err) {
      next(err);
    }
  });

  // ─── Create HTTP Server + WebSocket ──────────────────────────────────────
  const httpServer = createServer(app);
  setupWebSocket(httpServer, sessionMiddleware);

  return httpServer;
}
