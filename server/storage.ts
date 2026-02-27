import {
  type User, type InsertUser,
  type Club, type InsertClub,
  type TableRow, type InsertTable,
  type TablePlayer, type ClubMember,
  type Transaction, type GameHand, type Tournament, type PlayerStat,
  type ClubInvitation, type ClubAnnouncement, type ClubEvent,
  type Mission, type UserMission, type HandAnalysis,
  type ShopItem, type UserInventoryItem,
  type ClubAlliance, type LeagueSeason,
  type HandPlayer, type HandAction, type TournamentRegistration,
  users, clubs, clubMembers, tables, tablePlayers, transactions, gameHands, tournaments, tournamentRegistrations, playerStats,
  clubInvitations, clubAnnouncements, clubEvents,
  missions, userMissions, handAnalyses,
  shopItems, userInventory,
  clubAlliances, leagueSeasons,
  handPlayers, handActions,
} from "@shared/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { hasDatabase, getDb } from "./db";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: Partial<User> & Pick<User, "username" | "password">): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;

  // Users (atomic)
  atomicDeductChips(userId: string, amount: number): Promise<{ success: boolean; newBalance: number }>;
  atomicAddChips(userId: string, amount: number): Promise<{ success: boolean; newBalance: number }>;

  // Clubs
  getClub(id: string): Promise<Club | undefined>;
  getClubs(): Promise<Club[]>;
  createClub(club: InsertClub & { ownerId: string }): Promise<Club>;
  updateClub(id: string, data: Partial<Club>): Promise<Club | undefined>;
  deleteClub(id: string): Promise<void>;
  getClubMembers(clubId: string): Promise<(ClubMember & { user?: User })[]>;
  addClubMember(clubId: string, userId: string, role?: string): Promise<ClubMember>;
  removeClubMember(clubId: string, userId: string): Promise<void>;
  updateClubMemberRole(clubId: string, userId: string, role: string): Promise<void>;

  // User's Clubs
  getUserClubs(userId: string): Promise<Club[]>;

  // Club Invitations
  getClubInvitation(id: string): Promise<ClubInvitation | undefined>;
  getClubInvitations(clubId: string): Promise<ClubInvitation[]>;
  getUserPendingRequests(userId: string): Promise<ClubInvitation[]>;
  createClubInvitation(data: Omit<ClubInvitation, "id" | "createdAt">): Promise<ClubInvitation>;
  updateClubInvitation(id: string, data: Partial<ClubInvitation>): Promise<ClubInvitation | undefined>;

  // Club Announcements
  getClubAnnouncements(clubId: string): Promise<ClubAnnouncement[]>;
  createClubAnnouncement(data: Omit<ClubAnnouncement, "id" | "createdAt">): Promise<ClubAnnouncement>;

  // Club Events
  getClubEvents(clubId: string): Promise<ClubEvent[]>;
  createClubEvent(data: Omit<ClubEvent, "id" | "createdAt">): Promise<ClubEvent>;

  // Tables
  getTable(id: string): Promise<TableRow | undefined>;
  getTables(): Promise<TableRow[]>;
  createTable(table: InsertTable & { createdById: string }): Promise<TableRow>;
  updateTable(id: string, data: Partial<TableRow>): Promise<TableRow | undefined>;
  deleteTable(id: string): Promise<void>;

  // Table Players
  getTablePlayers(tableId: string): Promise<TablePlayer[]>;
  addTablePlayer(tableId: string, userId: string, seatIndex: number, chipStack: number): Promise<TablePlayer>;
  removeTablePlayer(tableId: string, userId: string): Promise<void>;
  updateTablePlayer(tableId: string, userId: string, data: Partial<TablePlayer>): Promise<void>;

  // Transactions
  createTransaction(tx: Omit<Transaction, "id" | "createdAt">): Promise<Transaction>;
  getTransactions(userId: string, limit?: number, offset?: number): Promise<Transaction[]>;
  getSessionSummaries(userId: string, limit?: number): Promise<{ tableId: string; netResult: number; sessionStart: Date; sessionEnd: Date; handsPlayed: number }[]>;
  getTransactionTotals(): Promise<{ type: string; total: number }[]>;
  getAllPlayerBalanceSum(): Promise<number>;
  getRakeReport(days?: number): Promise<{ tableId: string; handsPlayed: number; totalRake: number; reportDate: string }[]>;
  getRakeByPlayer(days?: number): Promise<{ userId: string; totalRake: number; handsPlayed: number }[]>;

  // Game Hands
  createGameHand(hand: Omit<GameHand, "id" | "createdAt">): Promise<GameHand>;
  getGameHands(tableId: string, limit?: number): Promise<GameHand[]>;
  getGameHand(id: string): Promise<GameHand | undefined>;

  // Hand Players & Actions (relational hand history)
  createHandPlayers(records: Omit<HandPlayer, "id">[]): Promise<void>;
  getHandPlayers(handId: string): Promise<HandPlayer[]>;
  getPlayerHandHistory(userId: string, limit?: number): Promise<HandPlayer[]>;
  createHandActions(records: Omit<HandAction, "id">[]): Promise<void>;
  getHandActions(handId: string): Promise<HandAction[]>;

  // Player Stats
  getPlayerStats(userId: string): Promise<PlayerStat | undefined>;
  getPlayerStatsBatch(userIds: string[]): Promise<Map<string, PlayerStat>>;
  getLeaderboard(metric: "chips" | "wins" | "winRate", limit?: number): Promise<{ userId: string; username: string; displayName: string | null; avatarId: string | null; value: number }[]>;
  incrementPlayerStat(userId: string, field: "handsPlayed" | "potsWon" | "sngWins" | "bombPotsPlayed" | "headsUpWins" | "vpip" | "pfr", amount: number): Promise<void>;
  resetDailyStats(userId: string): Promise<void>;

  // Missions
  getMissions(): Promise<Mission[]>;
  createMission(data: Omit<Mission, "id" | "createdAt">): Promise<Mission>;
  getUserMissions(userId: string): Promise<UserMission[]>;
  createUserMission(data: Omit<UserMission, "id">): Promise<UserMission>;
  updateUserMission(id: string, data: Partial<UserMission>): Promise<UserMission | undefined>;

  // Hand Analyses
  createHandAnalysis(data: Omit<HandAnalysis, "id" | "createdAt">): Promise<HandAnalysis>;
  getUserHandAnalyses(userId: string, limit?: number): Promise<HandAnalysis[]>;

  // Shop
  getShopItems(category?: string): Promise<ShopItem[]>;
  getShopItem(id: string): Promise<ShopItem | undefined>;
  createShopItem(data: Omit<ShopItem, "id" | "createdAt">): Promise<ShopItem>;
  getUserInventory(userId: string): Promise<UserInventoryItem[]>;
  addToInventory(userId: string, itemId: string): Promise<UserInventoryItem>;
  equipItem(id: string): Promise<void>;
  unequipItem(id: string): Promise<void>;

  // Tournaments
  getTournaments(): Promise<Tournament[]>;
  getTournament(id: string): Promise<Tournament | undefined>;
  createTournament(data: Omit<Tournament, "id" | "createdAt">): Promise<Tournament>;
  updateTournament(id: string, data: Partial<Tournament>): Promise<Tournament | undefined>;
  getTournamentRegistrations(tournamentId: string): Promise<TournamentRegistration[]>;
  registerForTournament(data: Omit<TournamentRegistration, "id" | "registeredAt">): Promise<TournamentRegistration>;
  registerForTournamentAtomic(tournamentId: string, userId: string, maxPlayers: number): Promise<TournamentRegistration | null>;
  updateTournamentRegistration(id: string, data: Partial<TournamentRegistration>): Promise<TournamentRegistration | undefined>;

  // Alliances & Leagues
  getClubAlliances(): Promise<ClubAlliance[]>;
  getClubAlliance(id: string): Promise<ClubAlliance | undefined>;
  createClubAlliance(data: Omit<ClubAlliance, "id" | "createdAt">): Promise<ClubAlliance>;
  updateClubAlliance(id: string, data: Partial<ClubAlliance>): Promise<ClubAlliance | undefined>;
  deleteClubAlliance(id: string): Promise<void>;
  getClubAllianceByClubId(clubId: string): Promise<ClubAlliance | undefined>;
  getLeagueSeasons(): Promise<LeagueSeason[]>;
  getLeagueSeason(id: string): Promise<LeagueSeason | undefined>;
  createLeagueSeason(data: Omit<LeagueSeason, "id" | "createdAt">): Promise<LeagueSeason>;
  updateLeagueSeason(id: string, data: Partial<LeagueSeason>): Promise<LeagueSeason | undefined>;
  deleteLeagueSeason(id: string): Promise<void>;
  getActiveLeagueSeason(): Promise<LeagueSeason | undefined>;
  updateLeagueStandings(seasonId: string, standings: any[]): Promise<void>;
}

// ─── In-Memory Storage (fallback when no DATABASE_URL) ───────────────────────
export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private clubs: Map<string, Club> = new Map();
  private clubMembersList: ClubMember[] = [];
  private clubInvitationsList: ClubInvitation[] = [];
  private clubAnnouncementsList: ClubAnnouncement[] = [];
  private clubEventsList: ClubEvent[] = [];
  private tablesList: Map<string, TableRow> = new Map();
  private tablePlayersList: TablePlayer[] = [];
  private transactionsList: Transaction[] = [];
  private gameHandsList: GameHand[] = [];
  private handPlayersList: HandPlayer[] = [];
  private handActionsList: HandAction[] = [];
  private playerStatsList: Map<string, PlayerStat> = new Map();
  private missionsList: Mission[] = [];
  private userMissionsList: UserMission[] = [];
  private handAnalysesList: HandAnalysis[] = [];
  private shopItemsList: ShopItem[] = [];
  private userInventoryList: UserInventoryItem[] = [];
  private tournamentsList: Tournament[] = [];
  private tournamentRegsList: TournamentRegistration[] = [];
  private clubAlliancesList: ClubAlliance[] = [];
  private leagueSeasonsList: LeagueSeason[] = [];

  // Users
  async getUser(id: string) { return this.users.get(id); }
  async getUserByUsername(username: string) {
    return Array.from(this.users.values()).find(u => u.username === username);
  }
  async createUser(data: Partial<User> & Pick<User, "username" | "password">): Promise<User> {
    const id = randomUUID();
    const user: User = {
      id,
      username: data.username,
      password: data.password,
      displayName: data.displayName || null,
      avatarId: data.avatarId || null,
      chipBalance: data.chipBalance ?? 10000,
      role: data.role || "guest",
      provider: data.provider || "local",
      providerId: data.providerId || null,
      lastDailyClaim: null,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }
  async updateUser(id: string, data: Partial<User>) {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...data };
    this.users.set(id, updated);
    return updated;
  }

  async atomicDeductChips(userId: string, amount: number): Promise<{ success: boolean; newBalance: number }> {
    const user = this.users.get(userId);
    if (!user || user.chipBalance < amount) {
      return { success: false, newBalance: user?.chipBalance ?? 0 };
    }
    user.chipBalance -= amount;
    return { success: true, newBalance: user.chipBalance };
  }

  async atomicAddChips(userId: string, amount: number): Promise<{ success: boolean; newBalance: number }> {
    const user = this.users.get(userId);
    if (!user) return { success: false, newBalance: 0 };
    user.chipBalance += amount;
    return { success: true, newBalance: user.chipBalance };
  }

  // Clubs
  async getClub(id: string) { return this.clubs.get(id); }
  async getClubs() { return Array.from(this.clubs.values()); }
  async getUserClubs(userId: string): Promise<Club[]> {
    const memberClubIds = this.clubMembersList
      .filter(m => m.userId === userId)
      .map(m => m.clubId);
    return Array.from(this.clubs.values()).filter(c => memberClubIds.includes(c.id));
  }
  async createClub(data: InsertClub & { ownerId: string }): Promise<Club> {
    const id = randomUUID();
    const club: Club = {
      id,
      name: data.name,
      description: data.description || null,
      ownerId: data.ownerId,
      avatarUrl: null,
      isPublic: data.isPublic ?? true,
      createdAt: new Date(),
    };
    this.clubs.set(id, club);
    await this.addClubMember(id, data.ownerId, "owner");
    return club;
  }
  async updateClub(id: string, data: Partial<Club>) {
    const club = this.clubs.get(id);
    if (!club) return undefined;
    const updated = { ...club, ...data };
    this.clubs.set(id, updated);
    return updated;
  }
  async deleteClub(id: string) {
    this.clubAnnouncementsList = this.clubAnnouncementsList.filter(a => a.clubId !== id);
    this.clubEventsList = this.clubEventsList.filter(e => e.clubId !== id);
    this.clubInvitationsList = this.clubInvitationsList.filter(i => i.clubId !== id);
    this.clubMembersList = this.clubMembersList.filter(m => m.clubId !== id);
    // Nullify tables associated with this club
    for (const [, table] of this.tablesList) {
      if (table.clubId === id) table.clubId = null;
    }
    this.clubs.delete(id);
  }
  async getClubMembers(clubId: string) {
    return this.clubMembersList.filter(m => m.clubId === clubId);
  }
  async addClubMember(clubId: string, userId: string, role = "member"): Promise<ClubMember> {
    const member: ClubMember = {
      id: randomUUID(),
      clubId, userId, role,
      joinedAt: new Date(),
    };
    this.clubMembersList.push(member);
    return member;
  }
  async removeClubMember(clubId: string, userId: string) {
    this.clubMembersList = this.clubMembersList.filter(
      m => !(m.clubId === clubId && m.userId === userId)
    );
  }
  async updateClubMemberRole(clubId: string, userId: string, role: string) {
    const member = this.clubMembersList.find(m => m.clubId === clubId && m.userId === userId);
    if (member) member.role = role;
  }

  // Club Invitations
  async getClubInvitation(id: string) {
    return this.clubInvitationsList.find(i => i.id === id);
  }
  async getClubInvitations(clubId: string) {
    return this.clubInvitationsList.filter(i => i.clubId === clubId);
  }
  async getUserPendingRequests(userId: string) {
    return this.clubInvitationsList.filter(
      i => i.userId === userId && i.type === "request" && i.status === "pending"
    );
  }
  async createClubInvitation(data: Omit<ClubInvitation, "id" | "createdAt">): Promise<ClubInvitation> {
    const inv: ClubInvitation = { ...data, id: randomUUID(), createdAt: new Date() };
    this.clubInvitationsList.push(inv);
    return inv;
  }
  async updateClubInvitation(id: string, data: Partial<ClubInvitation>) {
    const idx = this.clubInvitationsList.findIndex(i => i.id === id);
    if (idx === -1) return undefined;
    this.clubInvitationsList[idx] = { ...this.clubInvitationsList[idx], ...data };
    return this.clubInvitationsList[idx];
  }

  // Club Announcements
  async getClubAnnouncements(clubId: string) {
    return this.clubAnnouncementsList.filter(a => a.clubId === clubId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async createClubAnnouncement(data: Omit<ClubAnnouncement, "id" | "createdAt">): Promise<ClubAnnouncement> {
    const ann: ClubAnnouncement = { ...data, id: randomUUID(), createdAt: new Date() };
    this.clubAnnouncementsList.push(ann);
    return ann;
  }

  // Club Events
  async getClubEvents(clubId: string) {
    return this.clubEventsList.filter(e => e.clubId === clubId)
      .sort((a, b) => (b.startTime?.getTime() || 0) - (a.startTime?.getTime() || 0));
  }
  async createClubEvent(data: Omit<ClubEvent, "id" | "createdAt">): Promise<ClubEvent> {
    const ev: ClubEvent = { ...data, id: randomUUID(), createdAt: new Date() };
    this.clubEventsList.push(ev);
    return ev;
  }

  // Tables
  async getTable(id: string) { return this.tablesList.get(id); }
  async getTables() { return Array.from(this.tablesList.values()); }
  async createTable(data: InsertTable & { createdById: string }): Promise<TableRow> {
    const id = randomUUID();
    const table: TableRow = {
      id,
      name: data.name,
      clubId: data.clubId || null,
      maxPlayers: data.maxPlayers ?? 6,
      smallBlind: data.smallBlind ?? 10,
      bigBlind: data.bigBlind ?? 20,
      minBuyIn: data.minBuyIn ?? 200,
      maxBuyIn: data.maxBuyIn ?? 2000,
      ante: data.ante ?? 0,
      timeBankSeconds: data.timeBankSeconds ?? 30,
      isPrivate: data.isPrivate ?? false,
      password: data.password || null,
      status: "waiting",
      createdById: data.createdById,
      allowBots: data.allowBots ?? true,
      replaceBots: data.replaceBots ?? true,
      gameFormat: data.gameFormat || "cash",
      blindSchedule: data.blindSchedule || null,
      bombPotFrequency: data.bombPotFrequency ?? 0,
      bombPotAnte: data.bombPotAnte ?? 0,
      buyInAmount: data.buyInAmount ?? 0,
      startingChips: data.startingChips ?? 1500,
      payoutStructure: data.payoutStructure || null,
      tournamentId: null,
      rakePercent: data.rakePercent ?? 0,
      rakeCap: data.rakeCap ?? 0,
      straddleEnabled: data.straddleEnabled ?? false,
      gameSpeed: data.gameSpeed || "normal",
      createdAt: new Date(),
    };
    this.tablesList.set(id, table);
    return table;
  }
  async updateTable(id: string, data: Partial<TableRow>) {
    const table = this.tablesList.get(id);
    if (!table) return undefined;
    const updated = { ...table, ...data };
    this.tablesList.set(id, updated);
    return updated;
  }
  async deleteTable(id: string) {
    this.tablesList.delete(id);
    this.tablePlayersList = this.tablePlayersList.filter(p => p.tableId !== id);
  }

  // Table Players
  async getTablePlayers(tableId: string) {
    return this.tablePlayersList.filter(p => p.tableId === tableId);
  }
  async addTablePlayer(tableId: string, userId: string, seatIndex: number, chipStack: number): Promise<TablePlayer> {
    const player: TablePlayer = {
      id: randomUUID(),
      tableId, userId, seatIndex, chipStack,
      isConnected: true,
      isSittingOut: false,
      joinedAt: new Date(),
    };
    this.tablePlayersList.push(player);
    return player;
  }
  async removeTablePlayer(tableId: string, userId: string) {
    this.tablePlayersList = this.tablePlayersList.filter(
      p => !(p.tableId === tableId && p.userId === userId)
    );
  }
  async updateTablePlayer(tableId: string, userId: string, data: Partial<TablePlayer>) {
    const idx = this.tablePlayersList.findIndex(
      p => p.tableId === tableId && p.userId === userId
    );
    if (idx >= 0) {
      this.tablePlayersList[idx] = { ...this.tablePlayersList[idx], ...data };
    }
  }

  // Transactions
  async createTransaction(tx: Omit<Transaction, "id" | "createdAt">): Promise<Transaction> {
    const transaction: Transaction = {
      ...tx,
      id: randomUUID(),
      createdAt: new Date(),
    };
    this.transactionsList.push(transaction);
    return transaction;
  }
  async getTransactions(userId: string, limit = 50, offset = 0) {
    return this.transactionsList
      .filter(t => t.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(offset, offset + limit);
  }
  async getSessionSummaries(userId: string, limit = 20) {
    const tableTxs = this.transactionsList
      .filter(t => t.userId === userId && t.tableId && ["buyin", "cashout", "withdraw", "prize"].includes(t.type));
    const groups = new Map<string, { net: number; start: Date; end: Date; count: number }>();
    for (const tx of tableTxs) {
      const key = tx.tableId!;
      const existing = groups.get(key);
      if (existing) {
        existing.net += tx.amount;
        if (tx.createdAt < existing.start) existing.start = tx.createdAt;
        if (tx.createdAt > existing.end) existing.end = tx.createdAt;
        existing.count++;
      } else {
        groups.set(key, { net: tx.amount, start: tx.createdAt, end: tx.createdAt, count: 1 });
      }
    }
    return Array.from(groups.entries())
      .map(([tableId, g]) => ({ tableId, netResult: g.net, sessionStart: g.start, sessionEnd: g.end, handsPlayed: g.count }))
      .sort((a, b) => b.sessionEnd.getTime() - a.sessionEnd.getTime())
      .slice(0, limit);
  }
  async getTransactionTotals() {
    const map = new Map<string, number>();
    for (const tx of this.transactionsList) {
      map.set(tx.type, (map.get(tx.type) || 0) + tx.amount);
    }
    return Array.from(map.entries()).map(([type, total]) => ({ type, total }));
  }
  async getAllPlayerBalanceSum() {
    let sum = 0;
    for (const u of this.users.values()) sum += u.chipBalance;
    return sum;
  }
  async getRakeReport(_days = 30) {
    // Group game hands by tableId and date
    const groups = new Map<string, { handsPlayed: number; totalRake: number }>();
    for (const h of this.gameHandsList) {
      const dateStr = h.createdAt.toISOString().split("T")[0];
      const key = `${h.tableId}:${dateStr}`;
      const existing = groups.get(key);
      if (existing) {
        existing.handsPlayed++;
        existing.totalRake += h.totalRake;
      } else {
        groups.set(key, { handsPlayed: 1, totalRake: h.totalRake });
      }
    }
    return Array.from(groups.entries()).map(([key, g]) => {
      const [tableId, reportDate] = key.split(":");
      return { tableId, handsPlayed: g.handsPlayed, totalRake: g.totalRake, reportDate };
    });
  }
  async getRakeByPlayer(_days = 30) {
    const map = new Map<string, { totalRake: number; handsPlayed: number }>();
    for (const tx of this.transactionsList) {
      if (tx.type !== "rake") continue;
      const existing = map.get(tx.userId);
      const rakeAbs = Math.abs(tx.amount);
      if (existing) {
        existing.totalRake += rakeAbs;
        existing.handsPlayed++;
      } else {
        map.set(tx.userId, { totalRake: rakeAbs, handsPlayed: 1 });
      }
    }
    return Array.from(map.entries()).map(([userId, g]) => ({ userId, ...g }));
  }

  // Game Hands
  async createGameHand(hand: Omit<GameHand, "id" | "createdAt">): Promise<GameHand> {
    const gameHand: GameHand = {
      ...hand,
      id: randomUUID(),
      createdAt: new Date(),
    };
    this.gameHandsList.push(gameHand);
    return gameHand;
  }
  async getGameHands(tableId: string, limit = 20) {
    return this.gameHandsList
      .filter(h => h.tableId === tableId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
  async getGameHand(id: string) {
    return this.gameHandsList.find(h => h.id === id);
  }

  // Hand Players & Actions
  async createHandPlayers(records: Omit<HandPlayer, "id">[]) {
    for (const r of records) {
      this.handPlayersList.push({ ...r, id: randomUUID() } as HandPlayer);
    }
  }
  async getHandPlayers(handId: string) {
    return this.handPlayersList.filter(hp => hp.handId === handId);
  }
  async getPlayerHandHistory(userId: string, limit = 50) {
    return this.handPlayersList
      .filter(hp => hp.userId === userId)
      .slice(-limit)
      .reverse();
  }
  async createHandActions(records: Omit<HandAction, "id">[]) {
    for (const r of records) {
      this.handActionsList.push({ ...r, id: randomUUID() } as HandAction);
    }
  }
  async getHandActions(handId: string) {
    return this.handActionsList
      .filter(a => a.handId === handId)
      .sort((a, b) => a.sequenceNum - b.sequenceNum);
  }

  // Player Stats
  async getPlayerStats(userId: string) {
    return this.playerStatsList.get(userId);
  }
  async getPlayerStatsBatch(userIds: string[]) {
    const result = new Map<string, PlayerStat>();
    for (const uid of userIds) {
      const stats = this.playerStatsList.get(uid);
      if (stats) result.set(uid, stats);
    }
    return result;
  }
  async getLeaderboard(metric: "chips" | "wins" | "winRate", limit = 50) {
    const allUsers = Array.from(this.users.values());
    const result: { userId: string; username: string; displayName: string | null; avatarId: string | null; value: number }[] = [];
    for (const u of allUsers) {
      const stats = this.playerStatsList.get(u.id);
      let value = 0;
      if (metric === "chips") value = u.chipBalance;
      else if (metric === "wins") value = stats?.potsWon ?? 0;
      else if (metric === "winRate") value = stats && stats.handsPlayed > 0 ? Math.round((stats.potsWon / stats.handsPlayed) * 100) : 0;
      result.push({ userId: u.id, username: u.username, displayName: u.displayName, avatarId: u.avatarId, value });
    }
    result.sort((a, b) => b.value - a.value);
    return result.slice(0, limit);
  }
  async incrementPlayerStat(userId: string, field: "handsPlayed" | "potsWon" | "sngWins" | "bombPotsPlayed" | "headsUpWins" | "vpip" | "pfr", amount: number) {
    let stats = this.playerStatsList.get(userId);
    if (!stats) {
      stats = {
        id: randomUUID(), userId,
        handsPlayed: 0, potsWon: 0,
        bestWinStreak: 0, currentWinStreak: 0, totalWinnings: 0,
        vpip: 0, pfr: 0, showdownCount: 0,
        sngWins: 0, bombPotsPlayed: 0, headsUpWins: 0,
        lastResetAt: new Date(), updatedAt: new Date(),
      };
      this.playerStatsList.set(userId, stats);
    }
    (stats as any)[field] = ((stats as any)[field] || 0) + amount;
    if (field === "potsWon") {
      stats.currentWinStreak += amount;
      if (stats.currentWinStreak > stats.bestWinStreak) {
        stats.bestWinStreak = stats.currentWinStreak;
      }
    }
    stats.updatedAt = new Date();
  }
  async resetDailyStats(userId: string) {
    const stats = this.playerStatsList.get(userId);
    if (stats) {
      stats.handsPlayed = 0;
      stats.potsWon = 0;
      stats.currentWinStreak = 0;
      stats.lastResetAt = new Date();
      stats.updatedAt = new Date();
    }
  }

  // Missions
  async getMissions() { return this.missionsList.filter(m => m.isActive); }
  async createMission(data: Omit<Mission, "id" | "createdAt">): Promise<Mission> {
    const mission: Mission = { ...data, id: randomUUID(), createdAt: new Date() };
    this.missionsList.push(mission);
    return mission;
  }
  async getUserMissions(userId: string) {
    return this.userMissionsList.filter(m => m.userId === userId);
  }
  async createUserMission(data: Omit<UserMission, "id">): Promise<UserMission> {
    const um: UserMission = { ...data, id: randomUUID() };
    this.userMissionsList.push(um);
    return um;
  }
  async updateUserMission(id: string, data: Partial<UserMission>) {
    const idx = this.userMissionsList.findIndex(m => m.id === id);
    if (idx === -1) return undefined;
    this.userMissionsList[idx] = { ...this.userMissionsList[idx], ...data };
    return this.userMissionsList[idx];
  }

  // Hand Analyses
  async createHandAnalysis(data: Omit<HandAnalysis, "id" | "createdAt">): Promise<HandAnalysis> {
    const ha: HandAnalysis = { ...data, id: randomUUID(), createdAt: new Date() };
    this.handAnalysesList.push(ha);
    return ha;
  }
  async getUserHandAnalyses(userId: string, limit = 20) {
    return this.handAnalysesList
      .filter(h => h.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  // Shop
  async getShopItems(category?: string) {
    return this.shopItemsList.filter(i => i.isActive && (!category || i.category === category));
  }
  async getShopItem(id: string) {
    return this.shopItemsList.find(i => i.id === id);
  }
  async createShopItem(data: Omit<ShopItem, "id" | "createdAt">): Promise<ShopItem> {
    const item: ShopItem = { ...data, id: randomUUID(), createdAt: new Date() };
    this.shopItemsList.push(item);
    return item;
  }
  async getUserInventory(userId: string) {
    return this.userInventoryList.filter(i => i.userId === userId);
  }
  async addToInventory(userId: string, itemId: string): Promise<UserInventoryItem> {
    const inv: UserInventoryItem = { id: randomUUID(), userId, itemId, equippedAt: null, purchasedAt: new Date() };
    this.userInventoryList.push(inv);
    return inv;
  }
  async equipItem(id: string) {
    const item = this.userInventoryList.find(i => i.id === id);
    if (item) item.equippedAt = new Date();
  }
  async unequipItem(id: string) {
    const item = this.userInventoryList.find(i => i.id === id);
    if (item) item.equippedAt = null;
  }

  // Tournaments
  async getTournaments() { return this.tournamentsList; }
  async getTournament(id: string) { return this.tournamentsList.find(t => t.id === id); }
  async createTournament(data: Omit<Tournament, "id" | "createdAt">): Promise<Tournament> {
    const t: Tournament = { ...data, id: randomUUID(), createdAt: new Date() };
    this.tournamentsList.push(t);
    return t;
  }
  async updateTournament(id: string, data: Partial<Tournament>): Promise<Tournament | undefined> {
    const t = this.tournamentsList.find(t => t.id === id);
    if (!t) return undefined;
    Object.assign(t, data);
    return t;
  }
  async getTournamentRegistrations(tournamentId: string) {
    return this.tournamentRegsList.filter(r => r.tournamentId === tournamentId);
  }
  async registerForTournament(data: Omit<TournamentRegistration, "id" | "registeredAt">): Promise<TournamentRegistration> {
    const r: TournamentRegistration = { ...data, id: randomUUID(), registeredAt: new Date() };
    this.tournamentRegsList.push(r);
    return r;
  }
  async registerForTournamentAtomic(tournamentId: string, userId: string, maxPlayers: number): Promise<TournamentRegistration | null> {
    const existing = this.tournamentRegsList.filter(r => r.tournamentId === tournamentId);
    if (existing.some(r => r.userId === userId)) return null;
    if (existing.length >= maxPlayers) return null;
    return this.registerForTournament({ tournamentId, userId, status: "registered", finishPlace: null, prizeAmount: 0 });
  }
  async updateTournamentRegistration(id: string, data: Partial<TournamentRegistration>): Promise<TournamentRegistration | undefined> {
    const r = this.tournamentRegsList.find(r => r.id === id);
    if (!r) return undefined;
    Object.assign(r, data);
    return r;
  }

  // Alliances & Leagues
  async getClubAlliances() { return this.clubAlliancesList; }
  async getClubAlliance(id: string) {
    return this.clubAlliancesList.find(a => a.id === id);
  }
  async createClubAlliance(data: Omit<ClubAlliance, "id" | "createdAt">): Promise<ClubAlliance> {
    const a: ClubAlliance = { ...data, id: randomUUID(), createdAt: new Date() };
    this.clubAlliancesList.push(a);
    return a;
  }
  async updateClubAlliance(id: string, data: Partial<ClubAlliance>) {
    const a = this.clubAlliancesList.find(a => a.id === id);
    if (!a) return undefined;
    Object.assign(a, data);
    return a;
  }
  async deleteClubAlliance(id: string) {
    this.clubAlliancesList = this.clubAlliancesList.filter(a => a.id !== id);
  }
  async getClubAllianceByClubId(clubId: string) {
    return this.clubAlliancesList.find(a => (a.clubIds as string[]).includes(clubId));
  }
  async getLeagueSeasons() { return this.leagueSeasonsList; }
  async getLeagueSeason(id: string) {
    return this.leagueSeasonsList.find(s => s.id === id);
  }
  async createLeagueSeason(data: Omit<LeagueSeason, "id" | "createdAt">): Promise<LeagueSeason> {
    const s: LeagueSeason = { ...data, id: randomUUID(), createdAt: new Date() };
    this.leagueSeasonsList.push(s);
    return s;
  }
  async updateLeagueSeason(id: string, data: Partial<LeagueSeason>) {
    const s = this.leagueSeasonsList.find(s => s.id === id);
    if (!s) return undefined;
    Object.assign(s, data);
    return s;
  }
  async deleteLeagueSeason(id: string) {
    this.leagueSeasonsList = this.leagueSeasonsList.filter(s => s.id !== id);
  }
  async getActiveLeagueSeason(): Promise<LeagueSeason | undefined> {
    const now = new Date();
    return this.leagueSeasonsList.find(s => new Date(s.startDate) <= now && new Date(s.endDate) >= now);
  }
  async updateLeagueStandings(seasonId: string, standings: any[]) {
    const season = this.leagueSeasonsList.find(s => s.id === seasonId);
    if (season) season.standings = standings;
  }
}

// ─── Database Storage (when DATABASE_URL is set) ─────────────────────────────
export class DatabaseStorage implements IStorage {
  private get db() { return getDb(); }

  // Users
  async getUser(id: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByUsername(username: string) {
    const [user] = await this.db.select().from(users).where(eq(users.username, username));
    return user;
  }
  async createUser(data: Partial<User> & Pick<User, "username" | "password">): Promise<User> {
    const [user] = await this.db.insert(users).values({
      username: data.username,
      password: data.password,
      displayName: data.displayName,
      avatarId: data.avatarId,
      chipBalance: data.chipBalance ?? 10000,
      role: data.role || "guest",
      provider: data.provider || "local",
      providerId: data.providerId,
    }).returning();
    return user;
  }
  async updateUser(id: string, data: Partial<User>) {
    const [user] = await this.db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }

  async atomicDeductChips(userId: string, amount: number): Promise<{ success: boolean; newBalance: number }> {
    const result = await this.db.execute(sql`
      UPDATE users SET chip_balance = chip_balance - ${amount}
      WHERE id = ${userId} AND chip_balance >= ${amount}
      RETURNING chip_balance
    `);
    const rows = result.rows as any[];
    if (rows.length === 0) {
      const user = await this.getUser(userId);
      return { success: false, newBalance: user?.chipBalance ?? 0 };
    }
    return { success: true, newBalance: Number(rows[0].chip_balance) };
  }

  async atomicAddChips(userId: string, amount: number): Promise<{ success: boolean; newBalance: number }> {
    const result = await this.db.execute(sql`
      UPDATE users SET chip_balance = chip_balance + ${amount}
      WHERE id = ${userId}
      RETURNING chip_balance
    `);
    const rows = result.rows as any[];
    if (rows.length === 0) {
      return { success: false, newBalance: 0 };
    }
    return { success: true, newBalance: Number(rows[0].chip_balance) };
  }

  // Clubs
  async getClub(id: string) {
    const [club] = await this.db.select().from(clubs).where(eq(clubs.id, id));
    return club;
  }
  async getClubs() {
    return this.db.select().from(clubs).orderBy(desc(clubs.createdAt));
  }
  async getUserClubs(userId: string): Promise<Club[]> {
    const rows = await this.db
      .select({ club: clubs })
      .from(clubMembers)
      .innerJoin(clubs, eq(clubMembers.clubId, clubs.id))
      .where(eq(clubMembers.userId, userId));
    return rows.map(r => r.club);
  }
  async createClub(data: InsertClub & { ownerId: string }): Promise<Club> {
    const [club] = await this.db.insert(clubs).values({
      name: data.name,
      description: data.description,
      ownerId: data.ownerId,
      isPublic: data.isPublic ?? true,
    }).returning();
    await this.addClubMember(club.id, data.ownerId, "owner");
    return club;
  }
  async updateClub(id: string, data: Partial<Club>) {
    const [club] = await this.db.update(clubs).set(data).where(eq(clubs.id, id)).returning();
    return club;
  }
  async deleteClub(id: string) {
    await this.db.delete(clubAnnouncements).where(eq(clubAnnouncements.clubId, id));
    await this.db.delete(clubEvents).where(eq(clubEvents.clubId, id));
    await this.db.delete(clubInvitations).where(eq(clubInvitations.clubId, id));
    await this.db.delete(clubMembers).where(eq(clubMembers.clubId, id));
    await this.db.update(tables).set({ clubId: null }).where(eq(tables.clubId, id));
    await this.db.delete(clubs).where(eq(clubs.id, id));
  }
  async getClubMembers(clubId: string) {
    return this.db.select().from(clubMembers).where(eq(clubMembers.clubId, clubId));
  }
  async addClubMember(clubId: string, userId: string, role = "member"): Promise<ClubMember> {
    const [member] = await this.db.insert(clubMembers).values({ clubId, userId, role }).returning();
    return member;
  }
  async removeClubMember(clubId: string, userId: string) {
    await this.db.delete(clubMembers).where(
      and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId))
    );
  }
  async updateClubMemberRole(clubId: string, userId: string, role: string) {
    await this.db.update(clubMembers).set({ role }).where(
      and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId))
    );
  }

  // Club Invitations
  async getClubInvitation(id: string) {
    const rows = await this.db.select().from(clubInvitations).where(eq(clubInvitations.id, id));
    return rows[0];
  }
  async getClubInvitations(clubId: string) {
    return this.db.select().from(clubInvitations).where(eq(clubInvitations.clubId, clubId))
      .orderBy(desc(clubInvitations.createdAt));
  }
  async getUserPendingRequests(userId: string) {
    return this.db.select().from(clubInvitations).where(
      and(
        eq(clubInvitations.userId, userId),
        eq(clubInvitations.type, "request"),
        eq(clubInvitations.status, "pending"),
      )
    );
  }
  async createClubInvitation(data: Omit<ClubInvitation, "id" | "createdAt">): Promise<ClubInvitation> {
    const [inv] = await this.db.insert(clubInvitations).values(data).returning();
    return inv;
  }
  async updateClubInvitation(id: string, data: Partial<ClubInvitation>) {
    const [inv] = await this.db.update(clubInvitations).set(data).where(eq(clubInvitations.id, id)).returning();
    return inv;
  }

  // Club Announcements
  async getClubAnnouncements(clubId: string) {
    return this.db.select().from(clubAnnouncements).where(eq(clubAnnouncements.clubId, clubId))
      .orderBy(desc(clubAnnouncements.createdAt));
  }
  async createClubAnnouncement(data: Omit<ClubAnnouncement, "id" | "createdAt">): Promise<ClubAnnouncement> {
    const [ann] = await this.db.insert(clubAnnouncements).values(data).returning();
    return ann;
  }

  // Club Events
  async getClubEvents(clubId: string) {
    return this.db.select().from(clubEvents).where(eq(clubEvents.clubId, clubId))
      .orderBy(desc(clubEvents.createdAt));
  }
  async createClubEvent(data: Omit<ClubEvent, "id" | "createdAt">): Promise<ClubEvent> {
    const [ev] = await this.db.insert(clubEvents).values(data).returning();
    return ev;
  }

  // Tables
  async getTable(id: string) {
    const [table] = await this.db.select().from(tables).where(eq(tables.id, id));
    return table;
  }
  async getTables() {
    return this.db.select().from(tables).orderBy(desc(tables.createdAt));
  }
  async createTable(data: InsertTable & { createdById: string }): Promise<TableRow> {
    const [table] = await this.db.insert(tables).values({
      name: data.name,
      clubId: data.clubId,
      maxPlayers: data.maxPlayers ?? 6,
      smallBlind: data.smallBlind ?? 10,
      bigBlind: data.bigBlind ?? 20,
      minBuyIn: data.minBuyIn ?? 200,
      maxBuyIn: data.maxBuyIn ?? 2000,
      ante: data.ante ?? 0,
      timeBankSeconds: data.timeBankSeconds ?? 30,
      isPrivate: data.isPrivate ?? false,
      password: data.password,
      status: "waiting",
      createdById: data.createdById,
      allowBots: data.allowBots ?? true,
      replaceBots: data.replaceBots ?? true,
      gameFormat: data.gameFormat || "cash",
      blindSchedule: data.blindSchedule || null,
      bombPotFrequency: data.bombPotFrequency ?? 0,
      bombPotAnte: data.bombPotAnte ?? 0,
      buyInAmount: data.buyInAmount ?? 0,
      startingChips: data.startingChips ?? 1500,
      payoutStructure: data.payoutStructure || null,
      gameSpeed: data.gameSpeed || "normal",
    }).returning();
    return table;
  }
  async updateTable(id: string, data: Partial<TableRow>) {
    const [table] = await this.db.update(tables).set(data).where(eq(tables.id, id)).returning();
    return table;
  }
  async deleteTable(id: string) {
    await this.db.delete(tablePlayers).where(eq(tablePlayers.tableId, id));
    await this.db.delete(tables).where(eq(tables.id, id));
  }

  // Table Players
  async getTablePlayers(tableId: string) {
    return this.db.select().from(tablePlayers).where(eq(tablePlayers.tableId, tableId));
  }
  async addTablePlayer(tableId: string, userId: string, seatIndex: number, chipStack: number): Promise<TablePlayer> {
    const [player] = await this.db.insert(tablePlayers).values({
      tableId, userId, seatIndex, chipStack,
    }).returning();
    return player;
  }
  async removeTablePlayer(tableId: string, userId: string) {
    await this.db.delete(tablePlayers).where(
      and(eq(tablePlayers.tableId, tableId), eq(tablePlayers.userId, userId))
    );
  }
  async updateTablePlayer(tableId: string, userId: string, data: Partial<TablePlayer>) {
    await this.db.update(tablePlayers).set(data).where(
      and(eq(tablePlayers.tableId, tableId), eq(tablePlayers.userId, userId))
    );
  }

  // Transactions
  async createTransaction(tx: Omit<Transaction, "id" | "createdAt">): Promise<Transaction> {
    const [transaction] = await this.db.insert(transactions).values(tx).returning();
    return transaction;
  }
  async getTransactions(userId: string, limit = 50, offset = 0) {
    return this.db.select().from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt))
      .limit(limit)
      .offset(offset);
  }
  async getSessionSummaries(userId: string, limit = 20) {
    const rows = await this.db.execute(sql`
      SELECT
        table_id AS "tableId",
        SUM(amount) AS "netResult",
        MIN(created_at) AS "sessionStart",
        MAX(created_at) AS "sessionEnd",
        COUNT(*) AS "handsPlayed"
      FROM transactions
      WHERE user_id = ${userId}
        AND table_id IS NOT NULL
        AND type IN ('buyin', 'cashout', 'withdraw', 'prize')
      GROUP BY table_id
      ORDER BY MAX(created_at) DESC
      LIMIT ${limit}
    `);
    return (rows.rows as any[]).map(r => ({
      tableId: r.tableId,
      netResult: Number(r.netResult),
      sessionStart: new Date(r.sessionStart),
      sessionEnd: new Date(r.sessionEnd),
      handsPlayed: Number(r.handsPlayed),
    }));
  }
  async getTransactionTotals() {
    const rows = await this.db.execute(sql`
      SELECT type, SUM(amount) AS total
      FROM transactions
      GROUP BY type
    `);
    return (rows.rows as any[]).map(r => ({ type: r.type as string, total: Number(r.total) }));
  }
  async getAllPlayerBalanceSum() {
    const rows = await this.db.execute(sql`
      SELECT COALESCE(SUM(chip_balance), 0) AS total FROM users
    `);
    return Number((rows.rows as any[])[0]?.total || 0);
  }
  async getRakeReport(days = 30) {
    const rows = await this.db.execute(sql`
      SELECT
        table_id AS "tableId",
        COUNT(*) AS "handsPlayed",
        COALESCE(SUM(total_rake), 0) AS "totalRake",
        DATE(created_at)::text AS "reportDate"
      FROM game_hands
      WHERE created_at >= NOW() - INTERVAL '1 day' * ${days}
        AND total_rake > 0
      GROUP BY table_id, DATE(created_at)
      ORDER BY DATE(created_at) DESC, SUM(total_rake) DESC
    `);
    return (rows.rows as any[]).map(r => ({
      tableId: r.tableId as string,
      handsPlayed: Number(r.handsPlayed),
      totalRake: Number(r.totalRake),
      reportDate: r.reportDate as string,
    }));
  }
  async getRakeByPlayer(days = 30) {
    const rows = await this.db.execute(sql`
      SELECT
        user_id AS "userId",
        COALESCE(SUM(ABS(amount)), 0) AS "totalRake",
        COUNT(*) AS "handsPlayed"
      FROM transactions
      WHERE type = 'rake'
        AND created_at >= NOW() - INTERVAL '1 day' * ${days}
      GROUP BY user_id
      ORDER BY SUM(ABS(amount)) DESC
    `);
    return (rows.rows as any[]).map(r => ({
      userId: r.userId as string,
      totalRake: Number(r.totalRake),
      handsPlayed: Number(r.handsPlayed),
    }));
  }

  // Game Hands
  async createGameHand(hand: Omit<GameHand, "id" | "createdAt">): Promise<GameHand> {
    const [gameHand] = await this.db.insert(gameHands).values(hand).returning();
    return gameHand;
  }
  async getGameHands(tableId: string, limit = 20) {
    return this.db.select().from(gameHands)
      .where(eq(gameHands.tableId, tableId))
      .orderBy(desc(gameHands.createdAt))
      .limit(limit);
  }
  async getGameHand(id: string) {
    const [hand] = await this.db.select().from(gameHands).where(eq(gameHands.id, id));
    return hand;
  }

  // Hand Players & Actions
  async createHandPlayers(records: Omit<HandPlayer, "id">[]) {
    if (records.length === 0) return;
    await this.db.insert(handPlayers).values(records);
  }
  async getHandPlayers(handId: string) {
    return this.db.select().from(handPlayers).where(eq(handPlayers.handId, handId));
  }
  async getPlayerHandHistory(userId: string, limit = 50) {
    return this.db.select().from(handPlayers)
      .where(eq(handPlayers.userId, userId))
      .orderBy(desc(handPlayers.handId))
      .limit(limit);
  }
  async createHandActions(records: Omit<HandAction, "id">[]) {
    if (records.length === 0) return;
    await this.db.insert(handActions).values(records);
  }
  async getHandActions(handId: string) {
    return this.db.select().from(handActions)
      .where(eq(handActions.handId, handId))
      .orderBy(handActions.sequenceNum);
  }

  // Player Stats
  async getPlayerStats(userId: string) {
    const [stats] = await this.db.select().from(playerStats).where(eq(playerStats.userId, userId));
    return stats;
  }
  async getPlayerStatsBatch(userIds: string[]) {
    const result = new Map<string, PlayerStat>();
    if (userIds.length === 0) return result;
    const rows = await this.db.select().from(playerStats).where(inArray(playerStats.userId, userIds));
    for (const row of rows) {
      result.set(row.userId, row);
    }
    return result;
  }
  async getLeaderboard(metric: "chips" | "wins" | "winRate", limit = 50) {
    if (metric === "chips") {
      const rows = await this.db.select({
        userId: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarId: users.avatarId,
        value: users.chipBalance,
      }).from(users).orderBy(sql`${users.chipBalance} DESC`).limit(limit);
      return rows.map(r => ({ ...r, displayName: r.displayName, avatarId: r.avatarId }));
    }
    // For wins and winRate, join with playerStats and sort in SQL
    if (metric === "wins") {
      const rows = await this.db.select({
        userId: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarId: users.avatarId,
        value: playerStats.potsWon,
      }).from(playerStats).innerJoin(users, eq(users.id, playerStats.userId))
        .orderBy(sql`${playerStats.potsWon} DESC`).limit(limit);
      return rows;
    }
    // winRate: compute in SQL, sort, then limit
    const rows = await this.db.select({
      userId: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarId: users.avatarId,
      handsPlayed: playerStats.handsPlayed,
      potsWon: playerStats.potsWon,
    }).from(playerStats).innerJoin(users, eq(users.id, playerStats.userId))
      .where(sql`${playerStats.handsPlayed} > 0`)
      .orderBy(sql`(${playerStats.potsWon}::float / ${playerStats.handsPlayed}::float) DESC`)
      .limit(limit);

    return rows.map(r => ({
      userId: r.userId,
      username: r.username,
      displayName: r.displayName,
      avatarId: r.avatarId,
      value: Math.round((r.potsWon / r.handsPlayed) * 100),
    }));
  }
  async incrementPlayerStat(userId: string, field: "handsPlayed" | "potsWon" | "sngWins" | "bombPotsPlayed" | "headsUpWins" | "vpip" | "pfr", amount: number) {
    // Use raw SQL upsert to avoid race conditions when two concurrent
    // increments fire for the same user
    const colMap: Record<string, string> = {
      handsPlayed: "hands_played",
      potsWon: "pots_won",
      sngWins: "sng_wins",
      bombPotsPlayed: "bomb_pots_played",
      headsUpWins: "heads_up_wins",
      vpip: "vpip",
      pfr: "pfr",
    };
    const colName = colMap[field];
    if (field === "potsWon") {
      await this.db.execute(sql`
        INSERT INTO player_stats (id, user_id, ${sql.raw(colName)}, current_win_streak, best_win_streak)
        VALUES (gen_random_uuid(), ${userId}, ${amount}, ${amount}, ${amount})
        ON CONFLICT (user_id) DO UPDATE SET
          ${sql.raw(colName)} = player_stats.${sql.raw(colName)} + ${amount},
          current_win_streak = player_stats.current_win_streak + ${amount},
          best_win_streak = GREATEST(player_stats.best_win_streak, player_stats.current_win_streak + ${amount}),
          updated_at = NOW()
      `);
    } else {
      await this.db.execute(sql`
        INSERT INTO player_stats (id, user_id, ${sql.raw(colName)})
        VALUES (gen_random_uuid(), ${userId}, ${amount})
        ON CONFLICT (user_id) DO UPDATE SET
          ${sql.raw(colName)} = player_stats.${sql.raw(colName)} + ${amount},
          updated_at = NOW()
      `);
    }
  }
  async resetDailyStats(userId: string) {
    const existing = await this.getPlayerStats(userId);
    if (existing) {
      await this.db.update(playerStats).set({
        handsPlayed: 0, potsWon: 0, currentWinStreak: 0,
        lastResetAt: new Date(), updatedAt: new Date(),
      }).where(eq(playerStats.id, existing.id));
    }
  }

  // Missions
  async getMissions() {
    return this.db.select().from(missions).where(eq(missions.isActive, true));
  }
  async createMission(data: Omit<Mission, "id" | "createdAt">): Promise<Mission> {
    const [mission] = await this.db.insert(missions).values(data).returning();
    return mission;
  }
  async getUserMissions(userId: string) {
    return this.db.select().from(userMissions).where(eq(userMissions.userId, userId));
  }
  async createUserMission(data: Omit<UserMission, "id">): Promise<UserMission> {
    const [um] = await this.db.insert(userMissions).values(data).returning();
    return um;
  }
  async updateUserMission(id: string, data: Partial<UserMission>) {
    const [um] = await this.db.update(userMissions).set(data).where(eq(userMissions.id, id)).returning();
    return um;
  }

  // Hand Analyses
  async createHandAnalysis(data: Omit<HandAnalysis, "id" | "createdAt">): Promise<HandAnalysis> {
    const [ha] = await this.db.insert(handAnalyses).values(data).returning();
    return ha;
  }
  async getUserHandAnalyses(userId: string, limit = 20) {
    return this.db.select().from(handAnalyses)
      .where(eq(handAnalyses.userId, userId))
      .orderBy(desc(handAnalyses.createdAt))
      .limit(limit);
  }

  // Shop
  async getShopItems(category?: string) {
    if (category) {
      return this.db.select().from(shopItems)
        .where(and(eq(shopItems.isActive, true), eq(shopItems.category, category)));
    }
    return this.db.select().from(shopItems).where(eq(shopItems.isActive, true));
  }
  async getShopItem(id: string) {
    const [item] = await this.db.select().from(shopItems).where(eq(shopItems.id, id));
    return item;
  }
  async createShopItem(data: Omit<ShopItem, "id" | "createdAt">): Promise<ShopItem> {
    const [item] = await this.db.insert(shopItems).values(data).returning();
    return item;
  }
  async getUserInventory(userId: string) {
    return this.db.select().from(userInventory).where(eq(userInventory.userId, userId));
  }
  async addToInventory(userId: string, itemId: string): Promise<UserInventoryItem> {
    const [inv] = await this.db.insert(userInventory).values({ userId, itemId }).returning();
    return inv;
  }
  async equipItem(id: string) {
    await this.db.update(userInventory).set({ equippedAt: new Date() }).where(eq(userInventory.id, id));
  }
  async unequipItem(id: string) {
    await this.db.update(userInventory).set({ equippedAt: null }).where(eq(userInventory.id, id));
  }

  // Tournaments
  async getTournaments() {
    return this.db.select().from(tournaments).orderBy(desc(tournaments.createdAt));
  }
  async getTournament(id: string) {
    const [t] = await this.db.select().from(tournaments).where(eq(tournaments.id, id));
    return t;
  }
  async createTournament(data: Omit<Tournament, "id" | "createdAt">): Promise<Tournament> {
    const [t] = await this.db.insert(tournaments).values(data).returning();
    return t;
  }
  async updateTournament(id: string, data: Partial<Tournament>): Promise<Tournament | undefined> {
    const [t] = await this.db.update(tournaments).set(data).where(eq(tournaments.id, id)).returning();
    return t;
  }
  async getTournamentRegistrations(tournamentId: string) {
    return this.db.select().from(tournamentRegistrations)
      .where(eq(tournamentRegistrations.tournamentId, tournamentId));
  }
  async registerForTournament(data: Omit<TournamentRegistration, "id" | "registeredAt">): Promise<TournamentRegistration> {
    const [r] = await this.db.insert(tournamentRegistrations).values(data).returning();
    return r;
  }
  async registerForTournamentAtomic(tournamentId: string, userId: string, maxPlayers: number): Promise<TournamentRegistration | null> {
    // Atomic INSERT: only succeeds if count < maxPlayers AND user not already registered
    // Uses INSERT ... SELECT with a WHERE clause that checks both conditions
    const result = await this.db.execute(sql`
      INSERT INTO tournament_registrations (id, tournament_id, user_id, status, prize_amount, registered_at)
      SELECT gen_random_uuid(), ${tournamentId}, ${userId}, 'registered', 0, NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM tournament_registrations WHERE tournament_id = ${tournamentId} AND user_id = ${userId}
      )
      AND (SELECT COUNT(*) FROM tournament_registrations WHERE tournament_id = ${tournamentId}) < ${maxPlayers}
      RETURNING *
    `);
    const rows = result.rows || result;
    if (!rows || (rows as any[]).length === 0) return null;
    return (rows as any[])[0] as TournamentRegistration;
  }
  async updateTournamentRegistration(id: string, data: Partial<TournamentRegistration>): Promise<TournamentRegistration | undefined> {
    const [r] = await this.db.update(tournamentRegistrations).set(data)
      .where(eq(tournamentRegistrations.id, id)).returning();
    return r;
  }

  // Alliances & Leagues
  async getClubAlliances() {
    return this.db.select().from(clubAlliances);
  }
  async getClubAlliance(id: string) {
    const [a] = await this.db.select().from(clubAlliances).where(eq(clubAlliances.id, id));
    return a;
  }
  async createClubAlliance(data: Omit<ClubAlliance, "id" | "createdAt">): Promise<ClubAlliance> {
    const [a] = await this.db.insert(clubAlliances).values(data).returning();
    return a;
  }
  async updateClubAlliance(id: string, data: Partial<ClubAlliance>) {
    const [a] = await this.db.update(clubAlliances).set(data).where(eq(clubAlliances.id, id)).returning();
    return a;
  }
  async deleteClubAlliance(id: string) {
    await this.db.delete(clubAlliances).where(eq(clubAlliances.id, id));
  }
  async getClubAllianceByClubId(clubId: string) {
    const [row] = await this.db.select().from(clubAlliances)
      .where(sql`${clubAlliances.clubIds} @> ${JSON.stringify([clubId])}::jsonb`)
      .limit(1);
    return row;
  }
  async getLeagueSeasons() {
    return this.db.select().from(leagueSeasons).orderBy(desc(leagueSeasons.startDate));
  }
  async getLeagueSeason(id: string) {
    const [s] = await this.db.select().from(leagueSeasons).where(eq(leagueSeasons.id, id));
    return s;
  }
  async createLeagueSeason(data: Omit<LeagueSeason, "id" | "createdAt">): Promise<LeagueSeason> {
    const [s] = await this.db.insert(leagueSeasons).values(data).returning();
    return s;
  }
  async updateLeagueSeason(id: string, data: Partial<LeagueSeason>) {
    const [s] = await this.db.update(leagueSeasons).set(data).where(eq(leagueSeasons.id, id)).returning();
    return s;
  }
  async deleteLeagueSeason(id: string) {
    await this.db.delete(leagueSeasons).where(eq(leagueSeasons.id, id));
  }
  async getActiveLeagueSeason(): Promise<LeagueSeason | undefined> {
    const now = new Date();
    const [season] = await this.db.select().from(leagueSeasons)
      .where(and(
        sql`${leagueSeasons.startDate} <= ${now}`,
        sql`${leagueSeasons.endDate} >= ${now}`,
      ))
      .limit(1);
    return season;
  }
  async updateLeagueStandings(seasonId: string, standings: any[]) {
    await this.db.update(leagueSeasons)
      .set({ standings })
      .where(eq(leagueSeasons.id, seasonId));
  }
}

// Export singleton - use DatabaseStorage if DATABASE_URL exists, otherwise MemStorage
export const storage: IStorage = hasDatabase() ? new DatabaseStorage() : new MemStorage();
