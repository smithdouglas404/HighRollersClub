import type { Express, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { registerAuthRoutes, requireAuth } from "./auth";
import { insertTableSchema, insertClubSchema, createAllianceSchema, updateAllianceSchema, createLeagueSeasonSchema, updateLeagueSeasonSchema, leagueStandingsSchema, createTournamentSchema, users } from "@shared/schema";
import { sql } from "drizzle-orm";
import { setupWebSocket, sendGameStateToTable, getClients } from "./websocket";
import { getBlindPreset } from "./game/blind-presets";
import { tableManager } from "./game/table-manager";
import { analyzeHand } from "./game/hand-analyzer";
import { geofenceMiddleware } from "./middleware/geofence";
import { setAnthropicApiKey, getAnthropicApiKey, hasAIEnabled } from "./game/ai-bot-engine";
import { hasDatabase } from "./db";
import { MTTManager, activeMTTs } from "./game/mtt-manager";

// Global kill switch — blocks buy-ins and withdrawals if integrity check fails
let globalSystemLocked = false;
let globalLockReason = "";

export function isSystemLocked(): boolean {
  return globalSystemLocked;
}

export async function registerRoutes(app: Express, sessionMiddleware: RequestHandler): Promise<Server> {
  // Auth routes
  registerAuthRoutes(app);

  // ─── Server Info ───────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      storage: hasDatabase() ? "database" : "memory",
      warning: hasDatabase() ? null : "Using in-memory storage — all data will be lost on restart",
    });
  });

  // ─── Online Users ──────────────────────────────────────────────────────
  app.get("/api/online-users", requireAuth, (_req, res) => {
    const clients = getClients();
    const onlineIds = Array.from(clients.keys());
    res.json(onlineIds);
  });

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
      // Enrich with memberCount
      const enriched = await Promise.all(
        userClubs.map(async (club) => {
          const members = await storage.getClubMembers(club.id);
          return { ...club, memberCount: members.length };
        })
      );
      res.json(enriched);
    } catch (err) {
      next(err);
    }
  });

  // ─── Club Routes ─────────────────────────────────────────────────────────
  app.get("/api/clubs", async (req, res, next) => {
    try {
      const allClubs = await storage.getClubs();
      // Enrich with memberCount
      const enriched = await Promise.all(
        allClubs.map(async (club) => {
          const members = await storage.getClubMembers(club.id);
          return { ...club, memberCount: members.length };
        })
      );
      // #27: Filter out private clubs for unauthenticated users
      const visible = req.user
        ? enriched
        : enriched.filter(c => c.isPublic);
      res.json(visible);
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

  app.get("/api/clubs/:id/members", requireAuth, async (req, res, next) => {
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
  app.get("/api/clubs/:id/members/stats", requireAuth, async (req, res, next) => {
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
      const { name, description, isPublic, avatarUrl, ownerId } = req.body;
      // Ownership transfer: only the current owner can transfer
      const updateData: any = { name, description, isPublic, avatarUrl };
      if (ownerId && ownerId !== club.ownerId) {
        if (club.ownerId !== req.user!.id) {
          return res.status(403).json({ message: "Only the club owner can transfer ownership" });
        }
        // Verify new owner is a member
        if (!members.some(m => m.userId === ownerId)) {
          return res.status(400).json({ message: "New owner must be a club member" });
        }
        updateData.ownerId = ownerId;
        // Update old owner's role from "owner" to "admin"
        await storage.updateClubMemberRole(club.id, req.user!.id, "admin");
        // Update new owner's role to "owner"
        await storage.updateClubMemberRole(club.id, ownerId, "owner");
      }
      const updated = await storage.updateClub(club.id, updateData);
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

      // #28: Check for duplicate pending invitation
      const existing = await storage.getClubInvitations(club.id);
      if (existing.some(i => i.userId === targetUserId && i.status === "pending")) {
        return res.status(409).json({ message: "A pending invitation already exists for this user" });
      }

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
      // Fetch invitation first to verify ownership
      const existingInv = await storage.getClubInvitation(req.params.invId);
      if (!existingInv) return res.status(404).json({ message: "Invitation not found" });
      // Only the invitee or a club admin can accept/decline
      const isInvitee = existingInv.userId === req.user!.id;
      if (!isInvitee) {
        const members = await storage.getClubMembers(req.params.id);
        const requester = members.find(m => m.userId === req.user!.id);
        if (!requester || (requester.role !== "owner" && requester.role !== "admin")) {
          return res.status(403).json({ message: "Not authorized to modify this invitation" });
        }
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

  // Get club invitations (only club members can view)
  app.get("/api/clubs/:id/invitations", requireAuth, async (req, res, next) => {
    try {
      // Verify requester is a member of this club
      const clubMembers = await storage.getClubMembers(req.params.id);
      if (!clubMembers.some(m => m.userId === req.user!.id)) {
        return res.status(403).json({ message: "You must be a club member to view invitations" });
      }
      const invitations = await storage.getClubInvitations(req.params.id);
      // Filter out old resolved invitations (>7 days) to prevent accumulation
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const filtered = invitations.filter(inv => {
        if (inv.status === "pending") return true;
        return new Date(inv.createdAt).getTime() > sevenDaysAgo;
      });
      // Enrich with user data
      const enriched = await Promise.all(
        filtered.map(async (inv) => {
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
      // Private clubs require an accepted invitation — cannot join directly
      if (!club.isPublic) {
        return res.status(403).json({ message: "This is a private club. You need an invitation to join." });
      }
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
      if (!title || !title.trim()) {
        return res.status(400).json({ message: "Announcement title is required" });
      }
      if (!content || !content.trim()) {
        return res.status(400).json({ message: "Announcement content is required" });
      }
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
      // Only club owner/admin can create events
      const members = await storage.getClubMembers(club.id);
      const requester = members.find(m => m.userId === req.user!.id);
      if (!requester || (requester.role !== "owner" && requester.role !== "admin")) {
        return res.status(403).json({ message: "Only club admins can create events" });
      }
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

  // ─── Club Tournaments ───────────────────────────────────────────────────
  app.get("/api/clubs/:id/tournaments", requireAuth, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const tourneys = await storage.getClubTournaments(club.id);
      const enriched = await Promise.all(
        tourneys.map(async (t) => {
          const regs = await storage.getTournamentRegistrations(t.id);
          return { ...t, registeredCount: regs.length, registrations: regs };
        })
      );
      res.json(enriched);
    } catch (err) { next(err); }
  });

  // ─── Club Leaderboard ─────────────────────────────────────────────────
  app.get("/api/clubs/:id/leaderboard", requireAuth, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });

      const metric = (req.query.metric as string) || "chips";
      const validMetrics = ["chips", "wins", "winRate", "handsPlayed", "tournamentsWon"];
      if (!validMetrics.includes(metric)) return res.status(400).json({ message: "Invalid metric" });

      const members = await storage.getClubMembers(club.id);
      const userIds = members.map(m => m.userId);
      if (userIds.length === 0) return res.json([]);

      const statsMap = await storage.getPlayerStatsBatch(userIds);
      const userData = await Promise.all(userIds.map(id => storage.getUser(id)));
      const userMap = new Map<string, any>();
      userData.forEach(u => { if (u) userMap.set(u.id, u); });

      let tournamentWinsMap = new Map<string, number>();
      if (metric === "tournamentsWon") {
        const clubTourneys = await storage.getClubTournaments(club.id);
        for (const t of clubTourneys) {
          if (t.status === "complete") {
            const regs = await storage.getTournamentRegistrations(t.id);
            for (const r of regs) {
              if (r.finishPlace === 1 && userIds.includes(r.userId)) {
                tournamentWinsMap.set(r.userId, (tournamentWinsMap.get(r.userId) || 0) + 1);
              }
            }
          }
        }
      }

      const entries = userIds.map(uid => {
        const user = userMap.get(uid);
        const stats = statsMap.get(uid);
        if (!user) return null;
        let value = 0;
        switch (metric) {
          case "chips": value = user.chipBalance; break;
          case "wins": value = stats?.potsWon ?? 0; break;
          case "winRate":
            value = stats && stats.handsPlayed >= 10
              ? Math.round((stats.potsWon / stats.handsPlayed) * 100) : 0;
            break;
          case "handsPlayed": value = stats?.handsPlayed ?? 0; break;
          case "tournamentsWon": value = tournamentWinsMap.get(uid) || 0; break;
        }
        return { userId: uid, username: user.username, displayName: user.displayName, avatarId: user.avatarId, value };
      }).filter(Boolean);

      entries.sort((a: any, b: any) => b.value - a.value);
      res.json(entries);
    } catch (err) { next(err); }
  });

  // ─── Profile Routes ──────────────────────────────────────────────────────
  app.put("/api/profile/avatar", requireAuth, async (req, res, next) => {
    try {
      const { avatarId, displayName, tauntVoice } = req.body;
      const updates: Record<string, any> = {};
      if (avatarId && typeof avatarId === "string") updates.avatarId = avatarId;
      if (displayName && typeof displayName === "string") updates.displayName = displayName.trim().slice(0, 50);
      if (tauntVoice && typeof tauntVoice === "string") updates.tauntVoice = tauntVoice.slice(0, 30);
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "avatarId, displayName, or tauntVoice required" });
      }
      await storage.updateUser(req.user!.id, updates);
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (err) {
      next(err);
    }
  });

  // ─── Wallet Routes ───────────────────────────────────────────────────────
  app.get("/api/wallet/balance", requireAuth, async (req, res, next) => {
    try {
      const userWallets = await storage.getUserWallets(req.user!.id);
      const balances: Record<string, number> = {};
      let total = 0;
      for (const w of userWallets) {
        balances[w.walletType] = w.balance;
        total += w.balance;
      }
      // Backward compat: also return flat balance
      res.json({ balance: total, balances, wallets: userWallets });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/wallet/balances", requireAuth, async (req, res, next) => {
    try {
      await storage.ensureWallets(req.user!.id);
      const userWallets = await storage.getUserWallets(req.user!.id);
      const balances: Record<string, number> = { main: 0, cash_game: 0, sng: 0, tournament: 0, bonus: 0 };
      let total = 0;
      for (const w of userWallets) {
        balances[w.walletType] = w.balance;
        total += w.balance;
      }
      res.json({ balances, total, wallets: userWallets });
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

      // Atomically set lastDailyClaim to prevent race conditions
      // (re-read user to get fresh state after the check)
      await storage.updateUser(user.id, { lastDailyClaim: now });

      // Check if user has Elite Pass for 2x bonus
      const userInventory = await storage.getUserInventory(user.id);
      const allShopItems = await storage.getShopItems();
      const elitePass = allShopItems.find(i => i.category === "premium" && i.rarity === "legendary");
      const hasElitePass = elitePass ? userInventory.some(inv => inv.itemId === elitePass.id) : false;
      const bonus = hasElitePass ? 2000 : 1000;

      // Credit bonus wallet (ensure wallets exist first)
      await storage.ensureWallets(user.id);
      const { success, newBalance } = await storage.atomicAddToWallet(user.id, "bonus", bonus);
      if (!success) return res.status(500).json({ message: "Failed to credit bonus" });

      // Also update legacy chipBalance for backward compat
      await storage.atomicAddChips(user.id, bonus);

      await storage.createTransaction({
        userId: user.id,
        type: "bonus",
        amount: bonus,
        balanceBefore: newBalance - bonus,
        balanceAfter: newBalance,
        tableId: null,
        description: "Daily login bonus",
        walletType: "bonus",
        relatedTransactionId: null,
        paymentId: null,
        metadata: null,
      });

      const totalBal = await storage.getUserTotalBalance(user.id);
      res.json({ balance: totalBal, bonus, nextClaimAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/wallet/transactions", requireAuth, async (req, res, next) => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
      const txs = await storage.getTransactions(req.user!.id, limit, offset);

      // Add human-readable display types for the frontend
      const displayTypeMap: Record<string, string> = {
        buyin: "Table Buy-in",
        cashout: "Table Exit",
        deposit: "Funds Added",
        withdraw: "Added Chips to Table",
        bonus: "Bonus",
        rake: "Rake Collected",
        prize: "Tournament Prize",
      };

      const formatted = txs.map(tx => ({
        ...tx,
        displayType: displayTypeMap[tx.type] || "Adjustment",
        status: "Completed",
      }));

      res.json(formatted);
    } catch (err) {
      next(err);
    }
  });

  // Session profit/loss summaries — grouped by table
  app.get("/api/wallet/sessions", requireAuth, async (req, res, next) => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 50);
      const sessions = await storage.getSessionSummaries(req.user!.id, limit);
      res.json(sessions);
    } catch (err) {
      next(err);
    }
  });

  // ─── Wallet Transfer ─────────────────────────────────────────────────────
  app.post("/api/wallet/transfer", requireAuth, async (req, res, next) => {
    try {
      const { from, to, amount } = req.body;
      if (!from || !to || !amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid transfer: from, to, and amount > 0 required" });
      }
      const validTypes = ["main", "cash_game", "sng", "tournament", "bonus"];
      if (!validTypes.includes(from) || !validTypes.includes(to)) {
        return res.status(400).json({ message: "Invalid wallet type" });
      }
      if (from === to) return res.status(400).json({ message: "Cannot transfer to the same wallet" });
      if (from === "bonus") return res.status(400).json({ message: "Cannot transfer from bonus wallet" });

      await storage.ensureWallets(req.user!.id);
      const { success, fromBalance, toBalance } = await storage.atomicTransferBetweenWallets(
        req.user!.id, from, to, amount
      );
      if (!success) return res.status(400).json({ message: "Insufficient funds or wallet locked" });

      // Log both sides of the transfer
      const txId1 = require("crypto").randomUUID();
      const txId2 = require("crypto").randomUUID();
      await storage.createTransaction({
        userId: req.user!.id, type: "transfer", amount: -amount,
        balanceBefore: fromBalance + amount, balanceAfter: fromBalance,
        tableId: null, description: `Transfer to ${to} wallet`,
        walletType: from, relatedTransactionId: txId2, paymentId: null, metadata: null,
      });
      await storage.createTransaction({
        userId: req.user!.id, type: "transfer", amount: amount,
        balanceBefore: toBalance - amount, balanceAfter: toBalance,
        tableId: null, description: `Transfer from ${from} wallet`,
        walletType: to, relatedTransactionId: txId1, paymentId: null, metadata: null,
      });

      const allWallets = await storage.getUserWallets(req.user!.id);
      const balances: Record<string, number> = {};
      for (const w of allWallets) balances[w.walletType] = w.balance;

      res.json({ success: true, balances });
    } catch (err) {
      next(err);
    }
  });

  // ─── Payment / Deposit Routes ─────────────────────────────────────────────
  app.get("/api/payments/currencies", async (_req, res, next) => {
    try {
      const currencies = await storage.getSupportedCurrencies();
      res.json(currencies);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/payments/gateways", async (_req, res, next) => {
    try {
      const { getPaymentService } = await import("./payments/payment-service");
      const svc = getPaymentService();
      res.json(svc.getAvailableGateways());
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/payments/deposit", requireAuth, async (req, res, next) => {
    try {
      const { amount, currency, gateway, allocation } = req.body;
      if (!amount || !currency || !gateway || !allocation || !Array.isArray(allocation)) {
        return res.status(400).json({ message: "amount, currency, gateway, and allocation[] required" });
      }
      if (amount < 100) return res.status(400).json({ message: "Minimum deposit is $1.00 (100 cents)" });

      const allocSum = allocation.reduce((s: number, a: any) => s + (a.amount || 0), 0);
      if (allocSum !== amount) {
        return res.status(400).json({ message: `Allocation sum (${allocSum}) must equal deposit amount (${amount})` });
      }

      const { getPaymentService } = await import("./payments/payment-service");
      const svc = getPaymentService();
      const result = await svc.initiateDeposit(req.user!.id, amount, currency, gateway, allocation);
      res.json(result);
    } catch (err: any) {
      if (err.message?.includes("not configured")) {
        return res.status(400).json({ message: err.message });
      }
      next(err);
    }
  });

  app.get("/api/payments/:id", requireAuth, async (req, res, next) => {
    try {
      const payment = await storage.getPayment(req.params.id);
      if (!payment || payment.userId !== req.user!.id) {
        return res.status(404).json({ message: "Payment not found" });
      }
      res.json(payment);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/payments", requireAuth, async (req, res, next) => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
      const userPayments = await storage.getUserPayments(req.user!.id, limit, offset);
      res.json(userPayments);
    } catch (err) {
      next(err);
    }
  });

  // ─── Payment Webhooks (no auth — verified by signature) ───────────────────
  app.post("/api/payments/webhook/:provider", async (req, res, next) => {
    try {
      const provider = req.params.provider;
      const { getPaymentService } = await import("./payments/payment-service");
      const svc = getPaymentService();
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === "string") headers[k.toLowerCase()] = v;
      }
      const result = await svc.processWebhook(provider, req.body, headers);
      res.json({ ok: true, ...result });
    } catch (err: any) {
      console.error(`[Webhook] Error processing ${req.params.provider} webhook:`, err.message);
      res.status(400).json({ error: err.message });
    }
  });

  // ─── Withdrawal Routes ────────────────────────────────────────────────────
  app.post("/api/wallet/withdraw", requireAuth, async (req, res, next) => {
    try {
      const { amount, currency, address } = req.body;
      if (!amount || !currency || !address) {
        return res.status(400).json({ message: "amount, currency, and address required" });
      }
      if (amount <= 0) return res.status(400).json({ message: "Amount must be positive" });

      const { getPaymentService } = await import("./payments/payment-service");
      const svc = getPaymentService();
      const result = await svc.initiateWithdrawal(req.user!.id, amount, currency, address);
      res.json(result);
    } catch (err: any) {
      if (err.message?.includes("Insufficient") || err.message?.includes("Invalid")) {
        return res.status(400).json({ message: err.message });
      }
      next(err);
    }
  });

  app.get("/api/wallet/withdrawals", requireAuth, async (req, res, next) => {
    try {
      const requests = await storage.getUserWithdrawalRequests(req.user!.id);
      res.json(requests);
    } catch (err) {
      next(err);
    }
  });

  // ─── Hand Routes ─────────────────────────────────────────────────────────
  app.get("/api/hands/:id", requireAuth, async (req, res, next) => {
    try {
      const hand = await storage.getGameHand(req.params.id);
      if (!hand) return res.status(404).json({ message: "Hand not found" });
      res.json(hand);
    } catch (err) {
      next(err);
    }
  });

  // ─── Hand Verification Route ──────────────────────────────────────────────
  app.get("/api/hands/:id/verify", requireAuth, async (req, res, next) => {
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
  app.get("/api/tables/:id/hands", requireAuth, async (req, res, next) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const hands = await storage.getGameHands(req.params.id, limit);
      res.json(hands);
    } catch (err) {
      next(err);
    }
  });

  // Hand players (per-player records for a specific hand) — strip hole cards for non-showdown players
  app.get("/api/hands/:id/players", requireAuth, async (req, res, next) => {
    try {
      const players = await storage.getHandPlayers(req.params.id);
      const safePlayers = players.map((p: any) => {
        // Only reveal hole cards for the requesting user or if player went to showdown
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

  // Hand actions (action-by-action replay log)
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

  // ─── Commentary Audio ─────────────────────────────────────────────────
  app.get("/api/commentary-audio/:segmentId/:lineIndex", requireAuth, (req, res) => {
    const { getAudioBuffer } = require("./game/tts-engine");
    const { segmentId, lineIndex } = req.params;
    const entry = getAudioBuffer(segmentId, parseInt(lineIndex));
    if (!entry) {
      res.status(404).json({ error: "Audio not found or expired" });
      return;
    }
    res.set("Content-Type", "audio/mpeg");
    res.set("Cache-Control", "private, max-age=60");
    res.send(entry.buffer);
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
    let resetDaily = false;
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
        // Only reset stats when daily missions expire (weekly missions
        // rely on cumulative stats that shouldn't be wiped mid-week)
        if (mission.periodType === "daily") {
          resetDaily = true;
        }
      }
    }
    // Reset tracked stats only when a daily mission period has elapsed
    if (resetDaily) {
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

      // Credit reward to bonus wallet
      await storage.ensureWallets(req.user!.id);
      const { success: credited, newBalance } = await storage.atomicAddToWallet(req.user!.id, "bonus", mission.reward);
      if (credited) {
        await storage.createTransaction({
          userId: req.user!.id,
          type: "bonus",
          amount: mission.reward,
          balanceBefore: newBalance - mission.reward,
          balanceAfter: newBalance,
          tableId: null,
          description: `Mission reward: ${mission.label}`,
          walletType: "bonus",
          relatedTransactionId: null,
          paymentId: null,
          metadata: null,
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

      // Deduct from main wallet for shop purchases
      await storage.ensureWallets(user.id);
      const { success, newBalance: balanceAfterPurchase } = await storage.atomicDeductFromWallet(user.id, "main", item.price);
      if (!success) {
        return res.status(400).json({ message: "Insufficient chips in main wallet" });
      }

      await storage.createTransaction({
        userId: user.id,
        type: "purchase",
        amount: -item.price,
        balanceBefore: balanceAfterPurchase + item.price,
        balanceAfter: balanceAfterPurchase,
        tableId: null,
        description: `Purchased: ${item.name}`,
        walletType: "main",
        relatedTransactionId: null,
        paymentId: null,
        metadata: null,
      });

      const inv = await storage.addToInventory(user.id, itemId);

      // Grant bonus chips if item description mentions chips (e.g., VIP Chip Bundle)
      const chipMatch = item.description?.match(/(\d[\d,]*)\s*chips/i);
      if (chipMatch) {
        const bonusChips = parseInt(chipMatch[1].replace(/,/g, ""), 10);
        if (bonusChips > 0) {
          const { success: addOk, newBalance: balAfterBonus } = await storage.atomicAddChips(user.id, bonusChips);
          if (addOk) {
            await storage.createTransaction({
              userId: user.id,
              type: "deposit",
              amount: bonusChips,
              balanceBefore: balAfterBonus - bonusChips,
              balanceAfter: balAfterBonus,
              tableId: null,
              description: `Bonus chips from: ${item.name}`,
              walletType: "bonus",
              relatedTransactionId: null,
              paymentId: null,
              metadata: null,
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

      // If club tournament, verify user is admin/owner
      if (clubId) {
        const club = await storage.getClub(clubId);
        if (!club) return res.status(404).json({ message: "Club not found" });
        const members = await storage.getClubMembers(clubId);
        const member = members.find((m: any) => m.userId === req.user!.id);
        if (!member || (member.role !== "owner" && member.role !== "admin")) {
          return res.status(403).json({ message: "Only club admins can create club tournaments" });
        }
      }

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

      // Auto-create club event for club tournaments
      if (clubId) {
        await storage.createClubEvent({
          clubId,
          eventType: "tournament",
          name: tourney.name,
          description: `Tournament: ${tourney.name} | Buy-in: ${tourney.buyIn} chips`,
          startTime: tourney.startAt,
          tableId: null,
        });
      }

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

      // Deduct buy-in FIRST to prevent race condition (balance can't go negative with atomic op)
      await storage.ensureWallets(user.id);
      const { success: deducted, newBalance: balAfterBuyIn } = await storage.atomicDeductFromWallet(user.id, "tournament", tourney.buyIn);
      if (!deducted) {
        return res.status(400).json({ message: "Insufficient chips in tournament wallet" });
      }

      // Atomic registration: try to insert with unique constraint + count check
      const reg = await storage.registerForTournamentAtomic(
        tourney.id,
        req.user!.id,
        tourney.maxPlayers,
      );

      if (!reg) {
        // Registration failed — refund the buy-in
        await storage.atomicAddToWallet(user.id, "tournament", tourney.buyIn);
        const regs = await storage.getTournamentRegistrations(tourney.id);
        if (regs.some(r => r.userId === req.user!.id)) {
          return res.status(400).json({ message: "Already registered" });
        }
        return res.status(400).json({ message: "Tournament full" });
      }
      await storage.createTransaction({
        userId: user.id,
        type: "buyin",
        amount: -tourney.buyIn,
        balanceBefore: balAfterBuyIn + tourney.buyIn,
        balanceAfter: balAfterBuyIn,
        tableId: null,
        description: `Tournament buy-in: ${tourney.name}`,
        walletType: "tournament",
        relatedTransactionId: null,
        paymentId: null,
        metadata: null,
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

  // Start an MTT tournament
  app.post("/api/tournaments/:id/start", requireAuth, async (req, res, next) => {
    try {
      const tourney = await storage.getTournament(req.params.id);
      if (!tourney) return res.status(404).json({ message: "Tournament not found" });

      if (tourney.status !== "registering") {
        return res.status(400).json({ message: "Tournament already started or completed" });
      }

      // Verify user is admin or tournament creator
      const userId = req.user!.id;
      let isAuthorized = tourney.createdById === userId;

      if (!isAuthorized && tourney.clubId) {
        const members = await storage.getClubMembers(tourney.clubId);
        const member = members.find((m: any) => m.userId === userId);
        if (member && (member.role === "owner" || member.role === "admin")) {
          isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        return res.status(403).json({ message: "Only the tournament creator or club admin can start this tournament" });
      }

      // Check minimum registrations
      const regs = await storage.getTournamentRegistrations(tourney.id);
      if (regs.length < 2) {
        return res.status(400).json({ message: "Need at least 2 registered players to start" });
      }

      // Already running?
      if (activeMTTs.has(tourney.id)) {
        return res.status(400).json({ message: "Tournament is already running" });
      }

      // Resolve display names for all registrations
      const registrations = await Promise.all(
        regs.map(async (r) => {
          const user = await storage.getUser(r.userId);
          return {
            userId: r.userId,
            username: user?.username ?? r.userId,
            displayName: user?.displayName ?? user?.username ?? r.userId,
          };
        }),
      );

      // Create and start the MTT
      const blindSchedule = (tourney.blindSchedule as any[]) || undefined;
      const mtt = new MTTManager(tourney.id, registrations, {
        maxPlayersPerTable: Math.min(9, tourney.maxPlayers),
        prizePool: tourney.prizePool,
        startingChips: tourney.startingChips,
        buyInAmount: tourney.buyIn,
        blindSchedule,
        clubId: tourney.clubId,
      });

      activeMTTs.set(tourney.id, mtt);
      await mtt.start();

      res.json({
        message: "Tournament started",
        tournamentId: tourney.id,
        tables: mtt.getTableInfo(),
        totalPlayers: registrations.length,
      });
    } catch (err) {
      next(err);
    }
  });

  // Get live MTT status
  app.get("/api/tournaments/:id/status", async (req, res, next) => {
    try {
      const tourney = await storage.getTournament(req.params.id);
      if (!tourney) return res.status(404).json({ message: "Tournament not found" });

      const mtt = activeMTTs.get(tourney.id);
      if (!mtt) {
        // Not running in memory — return DB status
        const regs = await storage.getTournamentRegistrations(tourney.id);
        return res.json({
          tournamentId: tourney.id,
          status: tourney.status,
          registrations: regs.length,
          maxPlayers: tourney.maxPlayers,
          prizePool: tourney.prizePool,
          tables: [],
          standings: [],
        });
      }

      res.json({
        tournamentId: tourney.id,
        status: mtt.status,
        totalPlayers: mtt.registrations.length,
        remainingPlayers: mtt.getTotalRemainingPlayers(),
        tables: mtt.getTableInfo(),
        standings: mtt.getStandings(),
        prizePool: mtt.prizePool,
      });
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
      if (!clubId) return res.status(400).json({ message: "clubId is required" });
      const clubIds = alliance.clubIds as string[];

      if (!clubIds.includes(clubId)) {
        return res.status(404).json({ message: "Club is not in this alliance" });
      }

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

  // Create league season (admin only)
  app.post("/api/leagues", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
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

  // Update league season (admin only)
  app.put("/api/leagues/:id", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
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

  // Delete league season (admin only)
  app.delete("/api/leagues/:id", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const season = await storage.getLeagueSeason(req.params.id);
      if (!season) return res.status(404).json({ message: "League season not found" });

      await storage.deleteLeagueSeason(req.params.id);
      res.json({ message: "League season deleted" });
    } catch (err) {
      next(err);
    }
  });

  // Manually update league standings (admin only)
  app.post("/api/leagues/:id/standings", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
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

  // Complete a league season (admin only)
  app.post("/api/leagues/:id/complete", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
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

  // ─── Admin: Rake & Revenue Reports ─────────────────────────────────────

  const requireAdmin: RequestHandler = (req, res, next) => {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  };

  // Daily rake report by table
  app.get("/api/admin/rake-report", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 365);
      const report = await storage.getRakeReport(days);
      res.json(report);
    } catch (err) {
      next(err);
    }
  });

  // Rake contributed by each player (for rakeback calculations)
  app.get("/api/admin/rake-by-player", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 365);
      const report = await storage.getRakeByPlayer(days);
      res.json(report);
    } catch (err) {
      next(err);
    }
  });

  // Revenue summary: gross rake, total rakeback paid, net revenue
  app.get("/api/admin/revenue-summary", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const totals = await storage.getTransactionTotals();
      const totalsMap = new Map(totals.map(t => [t.type, t.total]));

      const grossRake = Math.abs(totalsMap.get("rake") || 0);
      const rakebackPaid = Math.abs(totalsMap.get("rakeback") || 0);
      const netRevenue = grossRake - rakebackPaid;
      const totalDeposits = totalsMap.get("deposit") || 0;
      const totalBonuses = totalsMap.get("bonus") || 0;
      const totalBuyins = Math.abs(totalsMap.get("buyin") || 0);
      const totalCashouts = totalsMap.get("cashout") || 0;
      const totalPrizes = totalsMap.get("prize") || 0;

      res.json({
        grossRake,
        rakebackPaid,
        netRevenue,
        totalDeposits,
        totalBonuses,
        totalBuyins,
        totalCashouts,
        totalPrizes,
      });
    } catch (err) {
      next(err);
    }
  });

  // Trial balance: the golden equation audit
  // Total Deposits + Bonuses - Total Withdrawals = Sum of Player Wallets + Total Rake
  app.get("/api/admin/trial-balance", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const totals = await storage.getTransactionTotals();
      const totalsMap = new Map(totals.map(t => [t.type, t.total]));
      const playerBalanceSum = await storage.getAllPlayerBalanceSum();

      // Money in: deposits, bonuses, prizes (created from thin air)
      const moneyIn = (totalsMap.get("deposit") || 0) + (totalsMap.get("bonus") || 0);
      // Money in escrow at tables (buyins - cashouts)
      const escrowedAtTables = Math.abs(totalsMap.get("buyin") || 0)
        - (totalsMap.get("cashout") || 0);
      // Withdrawals are money leaving the system, tracked separately
      const totalWithdrawals = Math.abs(totalsMap.get("withdraw") || 0);
      // Rake taken by the house
      const totalRake = Math.abs(totalsMap.get("rake") || 0);
      // Rakeback returned to players
      const totalRakeback = totalsMap.get("rakeback") || 0;
      // Prizes paid out
      const totalPrizes = totalsMap.get("prize") || 0;

      // Expected balance: all money IN, minus money OUT (rake, withdrawals)
      // Player wallets should equal: moneyIn - totalRake + totalRakeback - totalWithdrawals
      // Minus any chips currently sitting at tables (escrow)
      const expectedBalance = moneyIn - totalRake + totalRakeback - totalWithdrawals;
      const discrepancy = playerBalanceSum + escrowedAtTables - expectedBalance;

      const healthy = Math.abs(discrepancy) <= 1; // allow 1 chip rounding

      res.json({
        playerBalanceSum,
        escrowedAtTables,
        moneyIn,
        totalWithdrawals,
        totalRake,
        totalRakeback,
        totalPrizes,
        expectedBalance,
        discrepancy,
        healthy,
        breakdown: Object.fromEntries(totalsMap),
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── Admin: Rakeback Processing ──────────────────────────────────────────

  // Process rakeback for all players (e.g., 20% weekly)
  app.post("/api/admin/process-rakeback", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const { rakebackPercent = 20, days = 7 } = req.body;
      const percent = Math.min(Math.max(Number(rakebackPercent), 1), 100);
      const lookbackDays = Math.min(Math.max(Number(days), 1), 90);

      const rakeByPlayer = await storage.getRakeByPlayer(lookbackDays);
      const payouts: { userId: string; amount: number }[] = [];

      for (const entry of rakeByPlayer) {
        const rakebackAmount = Math.floor(entry.totalRake * percent / 100);
        if (rakebackAmount <= 0) continue;

        const user = await storage.getUser(entry.userId);
        if (!user) continue;

        await storage.updateUser(entry.userId, { chipBalance: user.chipBalance + rakebackAmount });
        await storage.createTransaction({
          userId: entry.userId,
          type: "rakeback",
          amount: rakebackAmount,
          balanceBefore: user.chipBalance,
          balanceAfter: user.chipBalance + rakebackAmount,
          tableId: null,
          description: `Rakeback payout (${percent}% of ${entry.totalRake} rake over ${lookbackDays} days)`,
          walletType: "bonus",
          relatedTransactionId: null,
          paymentId: null,
          metadata: null,
        });

        payouts.push({ userId: entry.userId, amount: rakebackAmount });
      }

      res.json({
        processed: payouts.length,
        totalPaid: payouts.reduce((sum, p) => sum + p.amount, 0),
        payouts,
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── Admin: Kill Switch ───────────────────────────────────────────────────

  // Global lock status
  app.get("/api/admin/system-status", requireAuth, requireAdmin, async (_req, res, next) => {
    try {
      res.json({ locked: globalSystemLocked, reason: globalLockReason });
    } catch (err) {
      next(err);
    }
  });

  // Toggle global lock
  app.post("/api/admin/system-lock", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const { locked, reason } = req.body;
      globalSystemLocked = !!locked;
      globalLockReason = reason || (locked ? "Manual admin lock" : "");
      console.warn(`[ADMIN] System lock ${locked ? "ENGAGED" : "RELEASED"}: ${globalLockReason}`);
      res.json({ locked: globalSystemLocked, reason: globalLockReason });
    } catch (err) {
      next(err);
    }
  });

  // ─── Admin: Payments & Withdrawals ──────────────────────────────────────
  app.get("/api/admin/payments", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      // Return all payments (admin view)
      const allPayments = await storage.getAllPayments(200, 0);
      res.json(allPayments);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/admin/withdrawals", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const status = req.query.status as string | undefined;
      const requests = await storage.getWithdrawalRequests(status || "pending");
      res.json(requests);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/admin/withdrawals/:id/approve", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const { getPaymentService } = await import("./payments/payment-service");
      const svc = getPaymentService();
      await svc.approveWithdrawal(req.params.id, req.user!.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/admin/withdrawals/:id/reject", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const { getPaymentService } = await import("./payments/payment-service");
      const svc = getPaymentService();
      const note = typeof req.body.note === "string" ? req.body.note.slice(0, 500) : "";
      await svc.rejectWithdrawal(req.params.id, req.user!.id, note);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // ─── Admin Stats ──────────────────────────────────────────────────────────

  app.get("/api/admin/stats", requireAuth, requireAdmin, async (_req, res, next) => {
    try {
      const allTables = await storage.getTables();
      const activeTables = allTables.filter(t => t.status !== "closed");

      // Use getTransactionTotals for deposit/withdrawal sums
      const totals = await storage.getTransactionTotals();
      const depositTotal = totals.find(t => t.type === "deposit")?.total ?? 0;
      const withdrawalTotal = totals.find(t => t.type === "withdrawal")?.total ?? 0;

      // Count users
      let totalUsers = 0;
      if ((storage as any).db) {
        const result = await (storage as any).db.select({ count: sql`count(*)` }).from(users);
        totalUsers = Number(result[0]?.count ?? 0);
      } else {
        totalUsers = (storage as any).users?.size ?? 0;
      }

      res.json({
        totalUsers,
        activeTables: activeTables.length,
        totalDeposits: depositTotal,
        totalWithdrawals: Math.abs(withdrawalTotal),
        totalTables: allTables.length,
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── Admin Collusion Alerts ─────────────────────────────────────────────

  app.get("/api/admin/collusion-alerts", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const status = req.query.status as string | undefined;
      const alerts = await storage.getCollusionAlerts(status);
      res.json(alerts);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/admin/collusion-alerts/:id/review", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const { status } = req.body;
      if (!status || !["reviewed", "dismissed"].includes(status)) {
        return res.status(400).json({ message: "Status must be 'reviewed' or 'dismissed'" });
      }
      const alert = await storage.reviewCollusionAlert(req.params.id, req.user!.id, status);
      if (!alert) return res.status(404).json({ message: "Alert not found" });
      res.json(alert);
    } catch (err) {
      next(err);
    }
  });

  // ─── Player Notes ──────────────────────────────────────────────────────

  app.get("/api/player-notes", requireAuth, async (req, res, next) => {
    try {
      const notes = await storage.getPlayerNotes(req.user!.id);
      res.json(notes);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/player-notes/:targetId", requireAuth, async (req, res, next) => {
    try {
      const note = await storage.getPlayerNote(req.user!.id, req.params.targetId);
      res.json(note ?? null);
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/player-notes/:targetId", requireAuth, async (req, res, next) => {
    try {
      const { note, color } = req.body;
      if (!note || typeof note !== "string") {
        return res.status(400).json({ message: "Note text is required" });
      }
      const result = await storage.upsertPlayerNote(
        req.user!.id,
        req.params.targetId,
        note.slice(0, 500),
        color || "gray",
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/player-notes/:targetId", requireAuth, async (req, res, next) => {
    try {
      await storage.deletePlayerNote(req.user!.id, req.params.targetId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // ─── Speech Translation ────────────────────────────────────────────────
  app.post("/api/translate", requireAuth, async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ message: "Text is required" });
      }
      if (text.length > 500) {
        return res.status(400).json({ message: "Text too long" });
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.json({ translated: text, original: text, detected: "unknown" });
      }

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a translator. Translate the following text to English. Return ONLY the translated text, nothing else. If the text is already in English, return it unchanged." },
          { role: "user", content: text },
        ],
        max_tokens: 200,
        temperature: 0.1,
      });

      const translated = completion.choices[0]?.message?.content?.trim() || text;
      res.json({ translated, original: text, detected: "auto" });
    } catch (err) {
      console.error("[translate] Error:", err);
      res.json({ translated: req.body?.text || "", original: req.body?.text || "", detected: "error" });
    }
  });

  // ─── Create HTTP Server + WebSocket ──────────────────────────────────────
  const httpServer = createServer(app);
  setupWebSocket(httpServer, sessionMiddleware);

  return httpServer;
}
