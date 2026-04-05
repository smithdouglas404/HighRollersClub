import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { storage } from "../storage";
import { insertClubSchema } from "@shared/schema";
import { sql as defaultSql } from "drizzle-orm";
import { hasDatabase as defaultHasDatabase, getDb as defaultGetDb } from "../db";

// ─── Tier System Constants (needed for requireTier middleware) ──────────
const TIER_ORDER = ["free", "bronze", "silver", "gold", "platinum"] as const;
type Tier = typeof TIER_ORDER[number];

function tierRank(tier: string): number {
  const idx = TIER_ORDER.indexOf(tier as Tier);
  return idx >= 0 ? idx : 0;
}

function requireTier(minTier: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    const user = await storage.getUser(req.user.id);
    if (!user) return res.status(401).json({ message: "User not found" });
    // Check tier expiry — if expired, revert to free
    if (user.tier !== "free" && user.tierExpiresAt && new Date(user.tierExpiresAt) < new Date()) {
      await storage.updateUser(user.id, { tier: "free", tierExpiresAt: null });
      user.tier = "free";
    }
    if (tierRank(user.tier) < tierRank(minTier)) {
      return res.status(403).json({ message: `Requires ${minTier} tier or higher` });
    }
    next();
  };
}

export interface ClubHelpers {
  hasDatabase: () => boolean;
  getDb: () => ReturnType<typeof defaultGetDb>;
  sql: typeof defaultSql;
}

export async function registerClubRoutes(
  app: Express,
  requireAuth: RequestHandler,
  requireAdmin: RequestHandler,
  helpers: ClubHelpers,
) {
  const { hasDatabase, getDb, sql } = helpers;

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

  // ─── Club Rankings (public) ──────────────────────────────────────────────
  app.get("/api/clubs/rankings", async (_req, res, next) => {
    try {
      const allClubs = await storage.getClubs();
      if (allClubs.length === 0) return res.json([]);

      // Gather all tournaments and registrations once
      const allTournaments = await storage.getTournaments();
      const completeTournaments = allTournaments.filter(t => t.status === "complete" && t.clubId);

      // Build club-level tournament win counts
      const clubTournamentWins = new Map<string, number>();
      for (const t of completeTournaments) {
        const regs = await storage.getTournamentRegistrations(t.id);
        const winner = regs.find(r => r.finishPlace === 1);
        if (winner && t.clubId) {
          clubTournamentWins.set(t.clubId, (clubTournamentWins.get(t.clubId) || 0) + 1);
        }
      }

      // 7 days ago cutoff for active players
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const rankings = await Promise.all(allClubs.map(async (club) => {
        const members = await storage.getClubMembers(club.id);
        const userIds = members.map(m => m.userId);
        if (userIds.length === 0) {
          return {
            clubId: club.id,
            clubName: club.name,
            memberCount: 0,
            activePlayers7d: 0,
            totalHandsPlayed: 0,
            combinedWinRate: 0,
            totalChipsWon: 0,
            tournamentWins: clubTournamentWins.get(club.id) || 0,
            rank: 0,
          };
        }

        const statsMap = await storage.getPlayerStatsBatch(userIds);
        const userData = await Promise.all(userIds.map(id => storage.getUser(id)));

        let totalHands = 0;
        let totalPots = 0;
        let totalChips = 0;

        for (const uid of userIds) {
          const stats = statsMap.get(uid);
          const user = userData.find(u => u?.id === uid);
          totalHands += stats?.handsPlayed ?? 0;
          totalPots += stats?.potsWon ?? 0;
          totalChips += stats?.totalWinnings ?? 0;
          if (!totalChips && user) {
            // fallback: use chipBalance above starting amount
            totalChips += Math.max(0, (user.chipBalance ?? 0) - 1000);
          }
        }

        // Approximate active players in last 7 days using playerStats.updatedAt
        let activePlayers7d = 0;
        for (const uid of userIds) {
          const stats = statsMap.get(uid);
          if (stats && stats.updatedAt && new Date(stats.updatedAt) >= weekAgo && stats.handsPlayed > 0) {
            activePlayers7d++;
          }
        }

        const combinedWinRate = totalHands > 0
          ? Math.round((totalPots / totalHands) * 1000) / 10
          : 0;

        return {
          clubId: club.id,
          clubName: club.name,
          memberCount: userIds.length,
          activePlayers7d,
          totalHandsPlayed: totalHands,
          combinedWinRate,
          totalChipsWon: totalChips,
          tournamentWins: clubTournamentWins.get(club.id) || 0,
          rank: 0,
        };
      }));

      // Sort by total hands played (primary ranking)
      rankings.sort((a, b) => b.totalHandsPlayed - a.totalHandsPlayed);

      // Assign ranks and limit to top 50
      const top50 = rankings.slice(0, 50).map((r, i) => ({ ...r, rank: i + 1 }));

      res.json(top50);
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

  // ─── Club Social Feed ────────────────────────────────────────────────────
  app.get("/api/clubs/my-feed", requireAuth, async (req, res, next) => {
    try {
      const userClubs = await storage.getUserClubs(req.user!.id);
      if (userClubs.length === 0) return res.json([]);

      type FeedItem = {
        type: "big_pot" | "tournament_win" | "member_join" | "announcement" | "table_started";
        clubId: string;
        clubName: string;
        playerName: string;
        description: string;
        timestamp: string;
        amount?: number;
      };

      const feed: FeedItem[] = [];

      for (const club of userClubs) {
        // Fetch announcements
        const announcements = await storage.getClubAnnouncements(club.id);
        for (const a of announcements.slice(0, 5)) {
          const author = await storage.getUser(a.authorId);
          feed.push({
            type: "announcement",
            clubId: club.id,
            clubName: club.name,
            playerName: author?.displayName || author?.username || "Unknown",
            description: a.title,
            timestamp: a.createdAt.toISOString(),
          });
        }

        // Fetch club events
        const events = await storage.getClubEvents(club.id);
        for (const ev of events.slice(0, 5)) {
          const evType = ev.eventType === "tournament" ? "tournament_win" as const : "table_started" as const;
          feed.push({
            type: evType,
            clubId: club.id,
            clubName: club.name,
            playerName: "",
            description: ev.name + (ev.description ? ` - ${ev.description}` : ""),
            timestamp: (ev.startTime || ev.createdAt).toISOString(),
          });
        }

        // Fetch recent member joins
        const members = await storage.getClubMembers(club.id);
        const recentMembers = members
          .filter(m => m.joinedAt)
          .sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime())
          .slice(0, 3);
        for (const m of recentMembers) {
          const memberUser = await storage.getUser(m.userId);
          feed.push({
            type: "member_join",
            clubId: club.id,
            clubName: club.name,
            playerName: memberUser?.displayName || memberUser?.username || "Unknown",
            description: `${memberUser?.displayName || memberUser?.username || "Someone"} joined the club`,
            timestamp: new Date(m.joinedAt).toISOString(),
          });
        }
      }

      // Sort newest first, return top 20
      feed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      res.json(feed.slice(0, 20));
    } catch (err) {
      next(err);
    }
  });

  // Active clubs with online member counts
  app.get("/api/clubs/my-active", requireAuth, async (req, res, next) => {
    try {
      const userClubs = await storage.getUserClubs(req.user!.id);
      if (userClubs.length === 0) return res.json([]);

      // Gather all active table player user IDs
      const allTables = await storage.getTables();
      const activePlayerIds = new Set<string>();
      for (const table of allTables) {
        const players = await storage.getTablePlayers(table.id);
        for (const p of players) {
          activePlayerIds.add(p.userId);
        }
      }

      const result = await Promise.all(
        userClubs.map(async (club) => {
          const members = await storage.getClubMembers(club.id);
          const onlineCount = members.filter(m => activePlayerIds.has(m.userId)).length;
          return {
            id: club.id,
            name: club.name,
            memberCount: members.length,
            onlineCount,
          };
        })
      );

      res.json(result);
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

  // ─── Tier club creation limits ─────────────────────────────────────────
  const TIER_CLUB_CREATE_LIMIT: Record<string, number> = {
    free: 0, bronze: 1, silver: 3, gold: 5, platinum: -1, // -1 = unlimited
  };
  const TIER_CLUB_MEMBER_LIMIT: Record<string, number> = {
    free: 0, bronze: 25, silver: 100, gold: 500, platinum: -1,
  };

  app.post("/api/clubs", requireAuth, requireTier("bronze"), async (req, res, next) => {
    try {
      const parsed = insertClubSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid club data", errors: parsed.error.flatten() });
      }

      // ─── Tier-based club creation limit enforcement ───────────────────
      const clubUser = await storage.getUser(req.user!.id);
      if (!clubUser) return res.status(401).json({ message: "User not found" });
      const tier = clubUser.tier || "free";
      const createLimit = TIER_CLUB_CREATE_LIMIT[tier] ?? 0;
      if (createLimit === 0) {
        return res.status(403).json({ message: "Your subscription tier cannot create clubs. Upgrade to Bronze or higher." });
      }
      if (createLimit > 0) {
        // Count clubs owned by user
        const userClubs = await storage.getUserClubs(req.user!.id);
        const ownedClubs = userClubs.filter((c: any) => c.ownerId === req.user!.id);
        if (ownedClubs.length >= createLimit) {
          return res.status(403).json({
            message: `Your ${tier} tier allows creating up to ${createLimit} club(s). Upgrade your tier for more.`,
          });
        }
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
      const { name, description, isPublic, avatarUrl, ownerId,
        timezone, language, rakePercent, maxBuyInCap, creditLimit,
        require2fa, adminApprovalRequired, antiCollusion, themeColor } = req.body;
      // Ownership transfer: only the current owner can transfer
      const updateData: any = { name, description, isPublic, avatarUrl };
      // Club settings fields — only set if provided (not undefined)
      if (timezone !== undefined) updateData.timezone = timezone;
      if (language !== undefined) updateData.language = language;
      if (rakePercent !== undefined) updateData.rakePercent = rakePercent;
      if (maxBuyInCap !== undefined) updateData.maxBuyInCap = maxBuyInCap;
      if (creditLimit !== undefined) updateData.creditLimit = creditLimit;
      if (require2fa !== undefined) updateData.require2fa = require2fa;
      if (adminApprovalRequired !== undefined) updateData.adminApprovalRequired = adminApprovalRequired;
      if (antiCollusion !== undefined) updateData.antiCollusion = antiCollusion;
      if (themeColor !== undefined) updateData.themeColor = themeColor;
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

      // Notify all club members about the announcement
      try {
        for (const m of members) {
          if (m.userId !== req.user!.id) {
            await storage.createNotification(
              m.userId,
              "club_announcement",
              `${club.name}: ${title}`,
              content.length > 120 ? content.slice(0, 120) + "..." : content,
              { clubId: club.id, announcementId: ann.id },
            );
          }
        }
      } catch (_) { /* non-critical */ }

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

  // ─── Club Challenges ────────────────────────────────────────────────────
  app.get("/api/clubs/:id/challenges", requireAuth, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const challenges = await storage.getClubChallenges(club.id);
      const now = new Date();
      // Return active (not expired or recently completed within 7 days) challenges
      const relevant = challenges.filter(c => {
        if (c.completedAt) {
          const completedAgo = now.getTime() - new Date(c.completedAt).getTime();
          return completedAgo < 7 * 24 * 60 * 60 * 1000;
        }
        return new Date(c.expiresAt).getTime() > now.getTime();
      });
      res.json(relevant);
    } catch (err) { next(err); }
  });

  app.post("/api/clubs/:id/challenges/generate", requireAuth, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const members = await storage.getClubMembers(club.id);
      const requester = members.find(m => m.userId === req.user!.id);
      if (!requester || (requester.role !== "owner" && requester.role !== "admin")) {
        return res.status(403).json({ message: "Only club admins can generate challenges" });
      }
      const challengeTemplates = [
        { title: "Play 500 Hands", description: "Play 500 hands as a club this week", type: "hands_played", targetValue: 500 },
        { title: "Win 10 Tournaments", description: "Club members win 10 tournaments combined", type: "tournaments_won", targetValue: 10 },
        { title: "5 Active Members", description: "Have 5 different members play today", type: "members_active", targetValue: 5 },
        { title: "Win 50 Pots", description: "Win 50 pots as a club this week", type: "pots_won", targetValue: 50 },
      ];
      const shuffled = challengeTemplates.sort(() => Math.random() - 0.5);
      const count = 3 + Math.floor(Math.random() * 2);
      const selected = shuffled.slice(0, count);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const created = [];
      for (const tmpl of selected) {
        const rewardChips = 1000 + Math.floor(Math.random() * 4001);
        const challenge = await storage.createClubChallenge({
          clubId: club.id,
          title: tmpl.title,
          description: tmpl.description,
          targetValue: tmpl.targetValue,
          currentValue: 0,
          rewardChips,
          rewardDescription: `${rewardChips.toLocaleString()} chips`,
          type: tmpl.type,
          expiresAt,
          completedAt: null,
        });
        created.push(challenge);
      }
      res.status(201).json(created);
    } catch (err) { next(err); }
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

  // ─── Club Quick Stats ─────────────────────────────────────────────────
  app.get("/api/clubs/:id/quick-stats", requireAuth, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });

      let mostActiveTable: { name: string; playerCount: number } | null = null;
      let topWinnerThisWeek: { displayName: string; amount: number } | null = null;
      let biggestPotToday: { amount: number; winnerName: string } | null = null;

      if (hasDatabase()) {
        const db = getDb();

        // 1. Most Active Table: table with most current players
        const activeRows = await db.execute(sql`
          SELECT t.name, COUNT(tp.id)::int AS player_count
          FROM tables t
          INNER JOIN table_players tp ON tp.table_id = t.id
          WHERE t.club_id = ${club.id}
          GROUP BY t.id, t.name
          ORDER BY player_count DESC
          LIMIT 1
        `);
        const activeResult = (activeRows as any).rows ?? activeRows;
        if (activeResult.length > 0 && Number(activeResult[0].player_count) > 0) {
          mostActiveTable = {
            name: activeResult[0].name as string,
            playerCount: Number(activeResult[0].player_count),
          };
        }

        // 2. Top Winner This Week: highest net_result sum in last 7 days among club members
        const winnerRows = await db.execute(sql`
          SELECT u.display_name, u.username, SUM(hp.net_result)::int AS total_won
          FROM hand_players hp
          INNER JOIN game_hands gh ON gh.id = hp.hand_id
          INNER JOIN tables t ON t.id = gh.table_id
          INNER JOIN club_members cm ON cm.club_id = t.club_id AND cm.user_id = hp.user_id
          INNER JOIN users u ON u.id = hp.user_id
          WHERE t.club_id = ${club.id}
            AND gh.created_at >= NOW() - INTERVAL '7 days'
          GROUP BY hp.user_id, u.display_name, u.username
          ORDER BY total_won DESC
          LIMIT 1
        `);
        const winnerResult = (winnerRows as any).rows ?? winnerRows;
        if (winnerResult.length > 0 && Number(winnerResult[0].total_won) > 0) {
          topWinnerThisWeek = {
            displayName: (winnerResult[0].display_name || winnerResult[0].username) as string,
            amount: Number(winnerResult[0].total_won),
          };
        }

        // 3. Biggest Pot Today: largest pot in last 24 hours for this club's tables
        const potRows = await db.execute(sql`
          SELECT gh.pot_total, u.display_name, u.username
          FROM game_hands gh
          INNER JOIN tables t ON t.id = gh.table_id
          LEFT JOIN LATERAL (
            SELECT hp2.user_id
            FROM hand_players hp2
            WHERE hp2.hand_id = gh.id AND hp2.is_winner = true
            LIMIT 1
          ) w ON true
          LEFT JOIN users u ON u.id = w.user_id
          WHERE t.club_id = ${club.id}
            AND gh.created_at >= NOW() - INTERVAL '1 day'
            AND gh.pot_total > 0
          ORDER BY gh.pot_total DESC
          LIMIT 1
        `);
        const potResult = (potRows as any).rows ?? potRows;
        if (potResult.length > 0 && Number(potResult[0].pot_total) > 0) {
          biggestPotToday = {
            amount: Number(potResult[0].pot_total),
            winnerName: (potResult[0].display_name || potResult[0].username || "Unknown") as string,
          };
        }
      }

      res.json({ mostActiveTable, topWinnerThisWeek, biggestPotToday });
    } catch (err) { next(err); }
  });

  // ─── Club Rake Report (for club owners/admins, not just platform admins) ──
  app.get("/api/clubs/:id/rake-report", requireAuth, requireTier("platinum"), async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });

      // Only club owner/admin can see rake report
      const members = await storage.getClubMembers(club.id);
      const member = members.find((m: any) => m.userId === req.user!.id);
      if (!member || (member.role !== "owner" && member.role !== "admin")) {
        return res.status(403).json({ message: "Only club owner or admin can view rake reports" });
      }

      if (!hasDatabase()) {
        return res.json({ totalRake: 0, platformFees: 0, netRake: 0, byTable: [], byPlayer: [] });
      }

      const db = getDb();
      const period = (req.query.period as string) || "week"; // day, week, month
      const intervals: Record<string, string> = { day: "1 day", week: "7 days", month: "30 days" };
      const interval = intervals[period] || "7 days";

      // Total rake from club tables
      const rakeRows = await db.execute(sql`
        SELECT
          t.id AS table_id, t.name AS table_name,
          SUM(gh.total_rake)::int AS total_rake,
          COUNT(gh.id)::int AS hand_count
        FROM game_hands gh
        INNER JOIN tables t ON t.id = gh.table_id
        WHERE t.club_id = ${club.id}
          AND gh.created_at >= NOW() - CAST(${interval} AS INTERVAL)
          AND gh.total_rake > 0
        GROUP BY t.id, t.name
        ORDER BY total_rake DESC
      `);
      const rakeResult = (rakeRows as any).rows ?? rakeRows;

      // Rake by player (top contributors)
      const playerRakeRows = await db.execute(sql`
        SELECT
          u.id, u.username, u.display_name,
          ABS(SUM(tx.amount))::int AS total_rake
        FROM transactions tx
        INNER JOIN users u ON u.id = tx.user_id
        WHERE tx.type = 'rake'
          AND tx.table_id IN (SELECT id FROM tables WHERE club_id = ${club.id})
          AND tx.created_at >= NOW() - CAST(${interval} AS INTERVAL)
          AND (tx.metadata IS NULL OR tx.metadata::text NOT LIKE '%platform_fee%')
        GROUP BY u.id, u.username, u.display_name
        ORDER BY total_rake DESC
        LIMIT 20
      `);
      const playerResult = (playerRakeRows as any).rows ?? playerRakeRows;

      const totalRake = rakeResult.reduce((s: number, r: any) => s + Number(r.total_rake), 0);

      // Platform fees collected from this club's tables
      const feeRows = await db.execute(sql`
        SELECT ABS(SUM(tx.amount))::int AS total_fees
        FROM transactions tx
        WHERE tx.type = 'rake'
          AND tx.table_id IN (SELECT id FROM tables WHERE club_id = ${club.id})
          AND tx.created_at >= NOW() - CAST(${interval} AS INTERVAL)
          AND tx.metadata::text LIKE '%platform_fee%'
      `);
      const feeResult = (feeRows as any).rows ?? feeRows;
      const platformFees = feeResult.length > 0 ? Number(feeResult[0].total_fees || 0) : 0;

      res.json({
        period,
        totalRake,
        platformFees,
        netRake: totalRake - platformFees,
        byTable: rakeResult.map((r: any) => ({
          tableId: r.table_id,
          tableName: r.table_name,
          totalRake: Number(r.total_rake),
          handCount: Number(r.hand_count),
        })),
        byPlayer: playerResult.map((r: any) => ({
          userId: r.id,
          username: r.username,
          displayName: r.display_name,
          totalRake: Number(r.total_rake),
        })),
      });
    } catch (err) { next(err); }
  });

  // ─── Club Wars ──────────────────────────────────────────────────────────
  app.get("/api/club-wars", requireAuth, async (req, res, next) => {
    try {
      const { clubId, status } = req.query;
      const wars = await storage.getClubWars(
        clubId as string | undefined,
        status as string | undefined
      );
      res.json(wars);
    } catch (err) { next(err); }
  });

  app.post("/api/club-wars/matchmake", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      if (user.role !== "admin") return res.status(403).json({ message: "Admin only" });

      const allClubs = await storage.getClubs();
      if (allClubs.length < 2) return res.status(400).json({ message: "Need at least 2 clubs" });

      // Sort by ELO and pair adjacent clubs
      const sorted = [...allClubs].sort((a, b) => (a.eloRating ?? 1200) - (b.eloRating ?? 1200));
      const pairs: any[] = [];
      for (let i = 0; i + 1 < sorted.length; i += 2) {
        const c1 = sorted[i], c2 = sorted[i + 1];
        const war = await storage.createClubWar({
          club1Id: c1.id,
          club2Id: c2.id,
          club1Name: c1.name,
          club2Name: c2.name,
          status: "pending",
          winnerId: null,
          club1Score: 0,
          club2Score: 0,
          club1Elo: c1.eloRating ?? 1200,
          club2Elo: c2.eloRating ?? 1200,
          eloChange: null,
          scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          completedAt: null,
        });
        pairs.push(war);
      }
      res.json(pairs);
    } catch (err) { next(err); }
  });

  app.post("/api/club-wars/:id/complete", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      if (user.role !== "admin") return res.status(403).json({ message: "Admin only" });

      const war = await storage.getClubWars();
      const found = war.find(w => w.id === req.params.id);
      if (!found) return res.status(404).json({ message: "War not found" });
      if (found.status === "completed") return res.status(400).json({ message: "Already completed" });

      const { club1Score, club2Score } = req.body;
      if (typeof club1Score !== "number" || typeof club2Score !== "number") {
        return res.status(400).json({ message: "Scores required" });
      }

      const winnerId = club1Score > club2Score ? found.club1Id : club1Score < club2Score ? found.club2Id : null;
      const K = 32;
      const elo1 = found.club1Elo ?? 1200;
      const elo2 = found.club2Elo ?? 1200;
      const expected1 = 1 / (1 + Math.pow(10, (elo2 - elo1) / 400));
      const actual1 = club1Score > club2Score ? 1 : club1Score < club2Score ? 0 : 0.5;
      const eloChange = Math.round(K * (actual1 - expected1));

      const updated = await storage.updateClubWar(req.params.id, {
        club1Score,
        club2Score,
        winnerId,
        eloChange,
        status: "completed",
        completedAt: new Date(),
      });

      // Update club ELO ratings
      await storage.updateClub(found.club1Id, { eloRating: elo1 + eloChange });
      await storage.updateClub(found.club2Id, { eloRating: elo2 - eloChange });

      // Notify members of both clubs about war completion
      try {
        const [club1, club2] = await Promise.all([
          storage.getClub(found.club1Id),
          storage.getClub(found.club2Id),
        ]);
        const club1Name = club1?.name ?? "Club 1";
        const club2Name = club2?.name ?? "Club 2";
        const resultText = winnerId === found.club1Id
          ? `${club1Name} won!`
          : winnerId === found.club2Id
          ? `${club2Name} won!`
          : "It's a draw!";
        const notifyClub = async (clubId: string) => {
          const members = await storage.getClubMembers(clubId);
          for (const m of members) {
            await storage.createNotification(
              m.userId,
              "club_announcement",
              `Club War Complete: ${club1Name} vs ${club2Name}`,
              `${resultText} Score: ${club1Score}-${club2Score}. ELO change: ${eloChange > 0 ? "+" : ""}${eloChange}.`,
              { warId: req.params.id, club1Id: found.club1Id, club2Id: found.club2Id },
            );
          }
        };
        await Promise.all([notifyClub(found.club1Id), notifyClub(found.club2Id)]);
      } catch (_) { /* non-critical */ }

      res.json(updated);
    } catch (err) { next(err); }
  });

  // ─── Club Chat ────────────────────────────────────────────────────────────

  // GET /api/clubs/:id/chat — fetch recent club chat messages with user info
  app.get("/api/clubs/:id/chat", requireAuth, async (req, res, next) => {
    try {
      const clubId = req.params.id;
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 200);

      // Verify membership
      const members = await storage.getClubMembers(clubId);
      const isMember = members.some(m => m.userId === req.user!.id);
      if (!isMember) return res.status(403).json({ message: "Not a member of this club" });

      const messages = await storage.getClubMessages(clubId, limit);

      // Enrich with user info
      const userIds = [...new Set(messages.map(m => m.userId))];
      const userMap = new Map<string, { username: string; displayName: string | null; avatarId: string | null }>();
      await Promise.all(userIds.map(async (uid) => {
        const u = await storage.getUser(uid);
        if (u) userMap.set(uid, { username: u.username, displayName: u.displayName, avatarId: u.avatarId });
      }));

      const enriched = messages.map(m => ({
        id: m.id,
        clubId: m.clubId,
        userId: m.userId,
        message: m.message,
        createdAt: m.createdAt,
        username: userMap.get(m.userId)?.username ?? "Unknown",
        displayName: userMap.get(m.userId)?.displayName ?? null,
        avatarId: userMap.get(m.userId)?.avatarId ?? null,
      }));

      res.json(enriched);
    } catch (err) { next(err); }
  });

  // POST /api/clubs/:id/chat — send a club chat message
  app.post("/api/clubs/:id/chat", requireAuth, async (req, res, next) => {
    try {
      const clubId = req.params.id;
      const rawMessage = req.body.message;

      if (!rawMessage || typeof rawMessage !== "string") {
        return res.status(400).json({ message: "Message is required" });
      }
      const trimmed = rawMessage.trim();
      if (trimmed.length < 1 || trimmed.length > 500) {
        return res.status(400).json({ message: "Message must be 1-500 characters" });
      }

      // Verify membership
      const members = await storage.getClubMembers(clubId);
      const isMember = members.some(m => m.userId === req.user!.id);
      if (!isMember) return res.status(403).json({ message: "Not a member of this club" });

      // Sanitize
      const sanitized = trimmed.replace(/[<>&"']/g, (c: string) =>
        ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] || c)
      );

      const msg = await storage.createClubMessage({ clubId, userId: req.user!.id, message: sanitized });

      // Get user info for broadcasting
      const user = await storage.getUser(req.user!.id);
      const enriched = {
        id: msg.id,
        clubId: msg.clubId,
        userId: msg.userId,
        message: msg.message,
        createdAt: msg.createdAt,
        username: user?.username ?? "Unknown",
        displayName: user?.displayName ?? null,
        avatarId: user?.avatarId ?? null,
      };

      // Publish to Redis pub/sub for real-time delivery
      const { getPubSub } = await import("../infra/ws-pubsub");
      getPubSub().publish(`club:chat:${clubId}`, {
        type: "club_chat",
        ...enriched,
      }).catch(() => {});

      res.json(enriched);
    } catch (err) { next(err); }
  });
}
