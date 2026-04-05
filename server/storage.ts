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
  type Wallet, type WalletType, type Payment, type WithdrawalRequest, type SupportedCurrency,
  type ChatMessage, type CollusionAlert, type PlayerNote,
  type Notification, type ClubChallenge, type ClubWar,
  type MarketplaceListing, type Stake,
  type ApiKey,
  type ClubMessage,
  type LoyaltyLog,
  walletTypeEnum,
  users, clubs, clubMembers, tables, tablePlayers, transactions, gameHands, tournaments, tournamentRegistrations, playerStats,
  clubInvitations, clubAnnouncements, clubEvents,
  missions, userMissions, handAnalyses,
  shopItems, userInventory,
  clubAlliances, leagueSeasons,
  handPlayers, handActions,
  wallets, payments, withdrawalRequests, supportedCurrencies,
  chatMessages, collusionAlerts, playerNotes, wishlists,
  notifications, clubChallenges, clubWars,
  marketplaceListings, stakes,
  apiKeys,
  clubMessages,
  loyaltyLogs,
} from "@shared/schema";
import { getLoyaltyLevel } from "./loyalty-config";
import { eq, and, desc, sql, inArray, gte, or } from "drizzle-orm";
import { randomUUID } from "crypto";
import { hasDatabase, getDb } from "./db";

/** Return the Date cutoff for a leaderboard period filter */
function periodCutoff(period: "today" | "week" | "month"): Date {
  const now = new Date();
  if (period === "today") return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (period === "week") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  // month
  return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
}

export interface IStorage {
  // System
  ensureSystemUser(): Promise<void>;

  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByWalletAddress(address: string): Promise<User | undefined>;
  getUserByFirebaseUid(uid: string): Promise<User | undefined>;
  getUserByMemberId(memberId: string): Promise<User | undefined>;
  getAllUsersByKycStatus(status: string): Promise<User[]>;
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
  getTableByInviteCode(code: string): Promise<TableRow | undefined>;
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
  getLeaderboard(metric: "chips" | "wins" | "winRate", limit?: number, period?: "today" | "week" | "month" | "all"): Promise<{ userId: string; username: string; displayName: string | null; avatarId: string | null; value: number }[]>;
  incrementPlayerStat(userId: string, field: "handsPlayed" | "potsWon" | "sngWins" | "bombPotsPlayed" | "headsUpWins" | "vpip" | "pfr" | "bluffWins" | "ploHands" | "bigPotWins" | "preflopFolds" | "tournamentHands", amount: number): Promise<void>;
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
  removeFromInventory(userId: string, itemId: string): Promise<void>;
  equipItem(id: string): Promise<void>;
  unequipItem(id: string): Promise<void>;

  // Tournaments
  getTournaments(): Promise<Tournament[]>;
  getTournament(id: string): Promise<Tournament | undefined>;
  getClubTournaments(clubId: string): Promise<Tournament[]>;
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

  // Wallets
  getWallet(userId: string, walletType: WalletType): Promise<Wallet | undefined>;
  getUserWallets(userId: string): Promise<Wallet[]>;
  createWallet(userId: string, walletType: WalletType, initialBalance?: number): Promise<Wallet>;
  ensureWallets(userId: string): Promise<Wallet[]>;

  // Wallet Atomic Operations
  atomicDeductFromWallet(userId: string, walletType: WalletType, amount: number): Promise<{ success: boolean; newBalance: number }>;
  atomicAddToWallet(userId: string, walletType: WalletType, amount: number): Promise<{ success: boolean; newBalance: number }>;
  atomicTransferBetweenWallets(userId: string, fromWallet: WalletType, toWallet: WalletType, amount: number): Promise<{ success: boolean; fromBalance: number; toBalance: number }>;

  // Wallet Aggregate
  getAllWalletBalanceSum(): Promise<number>;
  getUserTotalBalance(userId: string): Promise<number>;

  // Payments
  createPayment(data: Omit<Payment, "id" | "createdAt" | "updatedAt">): Promise<Payment>;
  getPayment(id: string): Promise<Payment | undefined>;
  getPaymentByGatewayId(provider: string, gatewayPaymentId: string): Promise<Payment | undefined>;
  getUserPayments(userId: string, limit?: number, offset?: number): Promise<Payment[]>;
  getAllPayments(limit?: number, offset?: number): Promise<Payment[]>;
  getPendingPayments(): Promise<Payment[]>;
  updatePayment(id: string, data: Partial<Payment>): Promise<Payment | undefined>;

  // Withdrawal Requests
  createWithdrawalRequest(data: Omit<WithdrawalRequest, "id" | "createdAt">): Promise<WithdrawalRequest>;
  getWithdrawalRequests(status?: string): Promise<WithdrawalRequest[]>;
  getUserWithdrawalRequests(userId: string): Promise<WithdrawalRequest[]>;
  updateWithdrawalRequest(id: string, data: Partial<WithdrawalRequest>): Promise<WithdrawalRequest | undefined>;

  // Supported Currencies
  getSupportedCurrencies(): Promise<SupportedCurrency[]>;
  upsertSupportedCurrency(data: SupportedCurrency): Promise<SupportedCurrency>;

  // Chat Messages
  saveChatMessage(tableId: string, userId: string, username: string, message: string): Promise<ChatMessage>;
  getRecentChatMessages(tableId: string, limit?: number): Promise<ChatMessage[]>;

  // Collusion Alerts
  saveCollusionAlert(data: Omit<CollusionAlert, "id" | "createdAt" | "reviewedBy" | "reviewedAt">): Promise<CollusionAlert>;
  getCollusionAlerts(status?: string): Promise<CollusionAlert[]>;
  reviewCollusionAlert(id: string, reviewerId: string, status: string): Promise<CollusionAlert | undefined>;

  // Player Notes
  getPlayerNote(authorId: string, targetId: string): Promise<PlayerNote | undefined>;
  upsertPlayerNote(authorId: string, targetId: string, note: string, color: string): Promise<PlayerNote>;
  deletePlayerNote(authorId: string, targetId: string): Promise<void>;
  getPlayerNotes(authorId: string): Promise<PlayerNote[]>;

  // Wishlists
  getWishlist(userId: string): Promise<string[]>;
  addToWishlist(userId: string, itemId: string): Promise<void>;
  removeFromWishlist(userId: string, itemId: string): Promise<void>;

  // Table Player Chips (atomicity)
  updateTablePlayerChips(tableId: string, odId: string, newChips: number): Promise<void>;

  // Notifications
  getNotifications(userId: string, limit?: number): Promise<Notification[]>;
  createNotification(userId: string, type: string, title: string, message: string, metadata?: any): Promise<Notification>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(userId: string): Promise<void>;
  getUnreadNotificationCount(userId: string): Promise<number>;

  // Club Challenges
  getClubChallenges(clubId: string): Promise<ClubChallenge[]>;
  createClubChallenge(data: Omit<ClubChallenge, "id" | "createdAt">): Promise<ClubChallenge>;
  updateChallengeProgress(id: string, increment: number): Promise<ClubChallenge | undefined>;
  completeChallenge(id: string): Promise<ClubChallenge | undefined>;

  // Club Wars
  getClubWars(clubId?: string, status?: string): Promise<ClubWar[]>;
  createClubWar(data: Omit<ClubWar, "id" | "createdAt">): Promise<ClubWar>;
  updateClubWar(id: string, data: Partial<ClubWar>): Promise<ClubWar | undefined>;
  getUpcomingClubWars(): Promise<ClubWar[]>;

  // Marketplace
  getListings(status?: string): Promise<MarketplaceListing[]>;
  createListing(data: Omit<MarketplaceListing, "id" | "createdAt">): Promise<MarketplaceListing>;
  buyListing(id: string, buyerId: string): Promise<MarketplaceListing | undefined>;
  cancelListing(id: string): Promise<MarketplaceListing | undefined>;

  // Stakes
  getStakesForPlayer(userId: string): Promise<Stake[]>;
  createStake(data: Omit<Stake, "id" | "createdAt">): Promise<Stake>;
  updateStake(id: string, data: Partial<Stake>): Promise<Stake | undefined>;
  getStake(id: string): Promise<Stake | undefined>;

  // API Keys
  createApiKey(userId: string, keyHash: string, name: string): Promise<ApiKey>;
  getApiKeysByUser(userId: string): Promise<ApiKey[]>;
  deleteApiKey(id: string): Promise<void>;
  getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined>;
  updateApiKeyLastUsed(id: string): Promise<void>;

  // OAuth
  getUserByProvider(provider: string, providerId: string): Promise<User | undefined>;

  // Club Messages (Club Chat)
  getClubMessages(clubId: string, limit?: number): Promise<ClubMessage[]>;
  createClubMessage(data: { clubId: string; userId: string; message: string }): Promise<ClubMessage>;

  // Loyalty (HRP)
  awardLoyaltyPoints(userId: string, baseAmount: number, reason: string, tier?: string): Promise<{ newTotal: number; newLevel: number; leveledUp: boolean }>;
  getLoyaltyHistory(userId: string, limit?: number): Promise<LoyaltyLog[]>;
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
  private chatMessagesList: ChatMessage[] = [];
  private clubMessagesList: ClubMessage[] = [];
  private collusionAlertsList: CollusionAlert[] = [];
  private playerNotesList: PlayerNote[] = [];

  // Ensure "system" user exists (required for FK constraints on bot tables, scheduler, etc.)
  async ensureSystemUser(): Promise<void> {
    if (this.users.has("system")) return;
    const systemUser = await this.createUser({
      username: "system",
      password: require("crypto").randomBytes(64).toString("hex"),
      displayName: "System",
      role: "admin",
      chipBalance: 0,
      memberId: "HR-SYSTEM00",
    });
    // Override the auto-generated ID with "system"
    this.users.delete(systemUser.id);
    (systemUser as any).id = "system";
    this.users.set("system", systemUser);
  }

  // Users
  async getUser(id: string) { return this.users.get(id); }
  async getUserByUsername(username: string) {
    return Array.from(this.users.values()).find(u => u.username === username);
  }
  async getUserByEmail(email: string) {
    return Array.from(this.users.values()).find(u => u.email === email);
  }
  async getUserByWalletAddress(address: string) {
    return Array.from(this.users.values()).find(u => u.walletAddress?.toLowerCase() === address.toLowerCase());
  }
  async getUserByFirebaseUid(uid: string) {
    return Array.from(this.users.values()).find(u => u.firebaseUid === uid);
  }
  async getUserByMemberId(memberId: string) {
    return Array.from(this.users.values()).find(u => u.memberId === memberId);
  }
  async getAllUsersByKycStatus(status: string) {
    return Array.from(this.users.values()).filter(u => u.kycStatus === status);
  }
  async createUser(data: Partial<User> & Pick<User, "username" | "password">): Promise<User> {
    const id = randomUUID();
    const user: User = {
      id,
      username: data.username,
      password: data.password,
      displayName: data.displayName || null,
      avatarId: data.avatarId || null,
      tauntVoice: data.tauntVoice || "default",
      chipBalance: data.chipBalance ?? 10000,
      role: data.role || "guest",
      provider: data.provider || "local",
      providerId: data.providerId || null,
      email: data.email || null,
      walletAddress: data.walletAddress || null,
      twoFactorSecret: data.twoFactorSecret || null,
      twoFactorEnabled: data.twoFactorEnabled ?? false,
      firebaseUid: data.firebaseUid ?? null,
      connectedWallets: data.connectedWallets ?? null,
      recoveryCodes: data.recoveryCodes ?? null,
      premiumUntil: data.premiumUntil ?? null,
      lastDailyClaim: null,
      tier: data.tier || "free",
      tierExpiresAt: data.tierExpiresAt ?? null,
      kycLevel: (data as any).kycLevel || "none",
      kycStatus: data.kycStatus || "none",
      kycData: data.kycData ?? null,
      kycVerifiedAt: data.kycVerifiedAt ?? null,
      kycRejectionReason: data.kycRejectionReason ?? null,
      memberId: data.memberId ?? null,
      kycBlockchainTxHash: data.kycBlockchainTxHash ?? null,
      emailVerified: (data as any).emailVerified ?? false,
      emailVerificationToken: (data as any).emailVerificationToken ?? null,
      selfExcludedUntil: data.selfExcludedUntil ?? null,
      depositLimitDaily: data.depositLimitDaily ?? 0,
      depositLimitWeekly: data.depositLimitWeekly ?? 0,
      depositLimitMonthly: data.depositLimitMonthly ?? 0,
      sessionTimeLimitMinutes: data.sessionTimeLimitMinutes ?? 0,
      lossLimitDaily: data.lossLimitDaily ?? 0,
      coolOffUntil: data.coolOffUntil ?? null,
      loyaltyPoints: data.loyaltyPoints ?? 0,
      loyaltyLevel: data.loyaltyLevel ?? 1,
      loyaltyStreakDays: data.loyaltyStreakDays ?? 0,
      loyaltyLastPlayDate: data.loyaltyLastPlayDate ?? null,
      loyaltyMultiplier: (data as any).loyaltyMultiplier ?? 100,
      dailyLoginStreak: (data as any).dailyLoginStreak ?? 0,
      lastLoginRewardAt: (data as any).lastLoginRewardAt ?? null,
      referredBy: (data as any).referredBy ?? null,
      referralCode: (data as any).referralCode ?? null,
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
      timezone: "UTC",
      language: "en",
      rakePercent: 5,
      maxBuyInCap: 0,
      creditLimit: 0,
      require2fa: false,
      adminApprovalRequired: false,
      antiCollusion: false,
      themeColor: "gold",
      eloRating: 1200,
      allowedCountries: null,
      allowedStates: null,
      blockVpn: false,
      kycRequired: "none",
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
  async getTableByInviteCode(code: string) {
    return Array.from(this.tablesList.values()).find(t => t.inviteCode === code);
  }
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
      bigBlindAnte: (data as any).bigBlindAnte ?? false,
      gameSpeed: data.gameSpeed || "normal",
      showAllHands: data.showAllHands !== false,
      runItTwice: data.runItTwice || "ask",
      showdownSpeed: data.showdownSpeed || "normal",
      dealToAwayPlayers: data.dealToAwayPlayers ?? false,
      timeBankRefillHands: data.timeBankRefillHands ?? 0,
      spectatorMode: data.spectatorMode ?? true,
      doubleBoard: data.doubleBoard ?? false,
      sevenTwoBounty: data.sevenTwoBounty ?? 0,
      guestChatEnabled: data.guestChatEnabled ?? true,
      autoTrimExcessBets: data.autoTrimExcessBets ?? false,
      pokerVariant: data.pokerVariant || "nlhe",
      useCentsValues: data.useCentsValues ?? false,
      requireAdminApproval: data.requireAdminApproval ?? false,
      allowSpectators: data.allowSpectators ?? true,
      clubMembersOnly: data.clubMembersOnly ?? false,
      awayTimeoutMinutes: data.awayTimeoutMinutes ?? 5,
      inviteCode: this.generateMemInviteCode(),
      scheduledStartTime: data.scheduledStartTime ? new Date(data.scheduledStartTime) : null,
      scheduledEndTime: data.scheduledEndTime ? new Date(data.scheduledEndTime) : null,
      recurringSchedule: data.recurringSchedule || null,
      allowedCountries: null,
      allowedStates: null,
      blockVpn: false,
      kycRequired: null,
      createdAt: new Date(),
    };
    this.tablesList.set(id, table);
    return table;
  }
  private generateMemInviteCode(): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
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
      .sort((a, b) => b.handId.localeCompare(a.handId))
      .slice(0, limit);
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
  async getLeaderboard(metric: "chips" | "wins" | "winRate", limit = 50, period: "today" | "week" | "month" | "all" = "all") {
    const allUsers = Array.from(this.users.values());
    const result: { userId: string; username: string; displayName: string | null; avatarId: string | null; value: number }[] = [];

    // For period-filtered queries, aggregate from handPlayers + gameHands
    if (period !== "all") {
      const cutoff = periodCutoff(period);
      // Build a map of handId -> gameHand for hands within the period
      const recentHandIds = new Set<string>();
      for (const gh of this.gameHandsList) {
        if (gh.createdAt >= cutoff) recentHandIds.add(gh.id);
      }
      // Aggregate per-user stats from handPlayers in those hands
      const userWins = new Map<string, number>();
      const userHands = new Map<string, number>();
      const userChips = new Map<string, number>();
      for (const hp of this.handPlayersList) {
        if (!recentHandIds.has(hp.handId)) continue;
        userHands.set(hp.userId, (userHands.get(hp.userId) || 0) + 1);
        if (hp.isWinner) userWins.set(hp.userId, (userWins.get(hp.userId) || 0) + 1);
        userChips.set(hp.userId, (userChips.get(hp.userId) || 0) + hp.netResult);
      }
      for (const u of allUsers) {
        let value = 0;
        const wins = userWins.get(u.id) || 0;
        const hands = userHands.get(u.id) || 0;
        if (metric === "chips") value = userChips.get(u.id) || 0;
        else if (metric === "wins") value = wins;
        else if (metric === "winRate") value = hands >= 10 ? Math.round((wins / hands) * 100) : 0;
        if (hands > 0 || metric === "chips") {
          result.push({ userId: u.id, username: u.username, displayName: u.displayName, avatarId: u.avatarId, value });
        }
      }
      result.sort((a, b) => b.value - a.value);
      return result.slice(0, limit);
    }

    for (const u of allUsers) {
      const stats = this.playerStatsList.get(u.id);
      let value = 0;
      if (metric === "chips") value = u.chipBalance;
      else if (metric === "wins") value = stats?.potsWon ?? 0;
      else if (metric === "winRate") value = stats && stats.handsPlayed >= 10 ? Math.round((stats.potsWon / stats.handsPlayed) * 100) : 0;
      result.push({ userId: u.id, username: u.username, displayName: u.displayName, avatarId: u.avatarId, value });
    }
    result.sort((a, b) => b.value - a.value);
    return result.slice(0, limit);
  }
  async incrementPlayerStat(userId: string, field: "handsPlayed" | "potsWon" | "sngWins" | "bombPotsPlayed" | "headsUpWins" | "vpip" | "pfr" | "bluffWins" | "ploHands" | "bigPotWins" | "preflopFolds" | "tournamentHands", amount: number) {
    let stats = this.playerStatsList.get(userId);
    if (!stats) {
      stats = {
        id: randomUUID(), userId,
        handsPlayed: 0, potsWon: 0,
        bestWinStreak: 0, currentWinStreak: 0, totalWinnings: 0,
        vpip: 0, pfr: 0, showdownCount: 0,
        sngWins: 0, bombPotsPlayed: 0, headsUpWins: 0,
        bluffWins: 0, ploHands: 0, bigPotWins: 0, preflopFolds: 0, tournamentHands: 0,
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
  async removeFromInventory(userId: string, itemId: string): Promise<void> {
    const idx = this.userInventoryList.findIndex(i => i.userId === userId && i.itemId === itemId);
    if (idx !== -1) this.userInventoryList.splice(idx, 1);
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
  async getClubTournaments(clubId: string) {
    return this.tournamentsList
      .filter(t => t.clubId === clubId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
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

  // ── Wallets ──────────────────────────────────────────────────────────
  private walletsList: Wallet[] = [];
  private paymentsList: Payment[] = [];
  private withdrawalRequestsList: WithdrawalRequest[] = [];
  private supportedCurrenciesList: SupportedCurrency[] = [];

  async getWallet(userId: string, walletType: WalletType) {
    return this.walletsList.find(w => w.userId === userId && w.walletType === walletType);
  }
  async getUserWallets(userId: string) {
    return this.walletsList.filter(w => w.userId === userId);
  }
  async createWallet(userId: string, walletType: WalletType, initialBalance = 0): Promise<Wallet> {
    const w: Wallet = {
      id: randomUUID(), userId, walletType, balance: initialBalance,
      isLocked: false, createdAt: new Date(), updatedAt: new Date(),
    };
    this.walletsList.push(w);
    return w;
  }
  async ensureWallets(userId: string): Promise<Wallet[]> {
    const existing = this.walletsList.filter(w => w.userId === userId);
    const existingTypes = new Set(existing.map(w => w.walletType));
    for (const wt of walletTypeEnum) {
      if (!existingTypes.has(wt)) {
        await this.createWallet(userId, wt, 0);
      }
    }
    return this.walletsList.filter(w => w.userId === userId);
  }

  async atomicDeductFromWallet(userId: string, walletType: WalletType, amount: number): Promise<{ success: boolean; newBalance: number }> {
    const w = this.walletsList.find(w => w.userId === userId && w.walletType === walletType);
    if (!w || w.isLocked || w.balance < amount) {
      return { success: false, newBalance: w?.balance ?? 0 };
    }
    w.balance -= amount;
    w.updatedAt = new Date();
    return { success: true, newBalance: w.balance };
  }
  async atomicAddToWallet(userId: string, walletType: WalletType, amount: number): Promise<{ success: boolean; newBalance: number }> {
    const w = this.walletsList.find(w => w.userId === userId && w.walletType === walletType);
    if (!w || w.isLocked) return { success: false, newBalance: w?.balance ?? 0 };
    w.balance += amount;
    w.updatedAt = new Date();
    return { success: true, newBalance: w.balance };
  }
  async atomicTransferBetweenWallets(userId: string, fromWallet: WalletType, toWallet: WalletType, amount: number): Promise<{ success: boolean; fromBalance: number; toBalance: number }> {
    if (fromWallet === "bonus") return { success: false, fromBalance: 0, toBalance: 0 };
    const from = this.walletsList.find(w => w.userId === userId && w.walletType === fromWallet);
    const to = this.walletsList.find(w => w.userId === userId && w.walletType === toWallet);
    if (!from || !to || from.isLocked || to.isLocked || from.balance < amount) {
      return { success: false, fromBalance: from?.balance ?? 0, toBalance: to?.balance ?? 0 };
    }
    from.balance -= amount;
    to.balance += amount;
    from.updatedAt = new Date();
    to.updatedAt = new Date();
    return { success: true, fromBalance: from.balance, toBalance: to.balance };
  }

  async getAllWalletBalanceSum() {
    return this.walletsList.reduce((sum, w) => sum + w.balance, 0);
  }
  async getUserTotalBalance(userId: string) {
    return this.walletsList.filter(w => w.userId === userId).reduce((sum, w) => sum + w.balance, 0);
  }

  // ── Payments ──────────────────────────────────────────────────────────
  async createPayment(data: Omit<Payment, "id" | "createdAt" | "updatedAt">): Promise<Payment> {
    const p: Payment = { ...data, id: randomUUID(), createdAt: new Date(), updatedAt: new Date() };
    this.paymentsList.push(p);
    return p;
  }
  async getPayment(id: string) { return this.paymentsList.find(p => p.id === id); }
  async getPaymentByGatewayId(provider: string, gatewayPaymentId: string) {
    return this.paymentsList.find(p => p.gatewayProvider === provider && p.gatewayPaymentId === gatewayPaymentId);
  }
  async getUserPayments(userId: string, limit = 50, offset = 0) {
    return this.paymentsList.filter(p => p.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(offset, offset + limit);
  }
  async getAllPayments(limit = 200, offset = 0) {
    return [...this.paymentsList]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(offset, offset + limit);
  }
  async getPendingPayments() {
    const pendingStatuses = ["pending", "confirming", "waiting"];
    return this.paymentsList.filter(p => p.direction === "deposit" && pendingStatuses.includes(p.status));
  }
  async updatePayment(id: string, data: Partial<Payment>) {
    const p = this.paymentsList.find(p => p.id === id);
    if (!p) return undefined;
    Object.assign(p, data, { updatedAt: new Date() });
    return p;
  }

  // ── Withdrawal Requests ───────────────────────────────────────────────
  async createWithdrawalRequest(data: Omit<WithdrawalRequest, "id" | "createdAt">): Promise<WithdrawalRequest> {
    const r: WithdrawalRequest = { ...data, id: randomUUID(), createdAt: new Date() };
    this.withdrawalRequestsList.push(r);
    return r;
  }
  async getWithdrawalRequests(status?: string) {
    if (status) return this.withdrawalRequestsList.filter(r => r.status === status);
    return this.withdrawalRequestsList;
  }
  async getUserWithdrawalRequests(userId: string) {
    return this.withdrawalRequestsList.filter(r => r.userId === userId);
  }
  async updateWithdrawalRequest(id: string, data: Partial<WithdrawalRequest>) {
    const r = this.withdrawalRequestsList.find(r => r.id === id);
    if (!r) return undefined;
    Object.assign(r, data);
    return r;
  }

  // ── Supported Currencies ──────────────────────────────────────────────
  async getSupportedCurrencies() {
    return this.supportedCurrenciesList.filter(c => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  }
  async upsertSupportedCurrency(data: SupportedCurrency): Promise<SupportedCurrency> {
    const idx = this.supportedCurrenciesList.findIndex(c => c.id === data.id);
    if (idx >= 0) { this.supportedCurrenciesList[idx] = data; return data; }
    this.supportedCurrenciesList.push(data);
    return data;
  }

  // ── Chat Messages ──────────────────────────────────────────────────────
  async saveChatMessage(tableId: string, userId: string, username: string, message: string) {
    const msg: ChatMessage = { id: randomUUID(), tableId, userId, username, message, createdAt: new Date() };
    this.chatMessagesList.push(msg);
    return msg;
  }
  async getRecentChatMessages(tableId: string, limit = 50) {
    return this.chatMessagesList.filter(m => m.tableId === tableId).slice(-limit);
  }

  // ── Club Messages (Club Chat) ─────────────────────────────────────────
  async getClubMessages(clubId: string, limit = 50) {
    return this.clubMessagesList
      .filter(m => m.clubId === clubId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(-limit);
  }
  async createClubMessage(data: { clubId: string; userId: string; message: string }) {
    const msg: ClubMessage = { id: randomUUID(), clubId: data.clubId, userId: data.userId, message: data.message, createdAt: new Date() };
    this.clubMessagesList.push(msg);
    return msg;
  }

  // ── Collusion Alerts ───────────────────────────────────────────────────
  async saveCollusionAlert(data: Omit<CollusionAlert, "id" | "createdAt" | "reviewedBy" | "reviewedAt">) {
    const alert: CollusionAlert = { ...data, id: randomUUID(), reviewedBy: null, reviewedAt: null, createdAt: new Date() };
    this.collusionAlertsList.push(alert);
    return alert;
  }
  async getCollusionAlerts(status?: string) {
    const filtered = status ? this.collusionAlertsList.filter(a => a.status === status) : this.collusionAlertsList;
    return filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async reviewCollusionAlert(id: string, reviewerId: string, status: string) {
    const alert = this.collusionAlertsList.find(a => a.id === id);
    if (!alert) return undefined;
    alert.status = status;
    alert.reviewedBy = reviewerId;
    alert.reviewedAt = new Date();
    return alert;
  }

  // ── Player Notes ───────────────────────────────────────────────────────
  async getPlayerNote(authorId: string, targetId: string) {
    return this.playerNotesList.find(n => n.authorUserId === authorId && n.targetUserId === targetId);
  }
  async upsertPlayerNote(authorId: string, targetId: string, note: string, color: string) {
    const existing = this.playerNotesList.find(n => n.authorUserId === authorId && n.targetUserId === targetId);
    if (existing) {
      existing.note = note;
      existing.color = color;
      existing.updatedAt = new Date();
      return existing;
    }
    const pn: PlayerNote = { id: randomUUID(), authorUserId: authorId, targetUserId: targetId, note, color, createdAt: new Date(), updatedAt: new Date() };
    this.playerNotesList.push(pn);
    return pn;
  }
  async deletePlayerNote(authorId: string, targetId: string) {
    this.playerNotesList = this.playerNotesList.filter(n => !(n.authorUserId === authorId && n.targetUserId === targetId));
  }
  async getPlayerNotes(authorId: string) {
    return this.playerNotesList.filter(n => n.authorUserId === authorId);
  }

  // ── Table Player Chips ─────────────────────────────────────────────────
  async updateTablePlayerChips(tableId: string, odId: string, newChips: number) {
    const tp = this.tablePlayersList.find(p => p.tableId === tableId && p.userId === odId);
    if (tp) tp.chipStack = newChips;
  }

  // ── Wishlists ──────────────────────────────────────────────────────────
  private wishlistMap = new Map<string, Set<string>>();
  async getWishlist(userId: string) {
    return [...(this.wishlistMap.get(userId) || [])];
  }
  async addToWishlist(userId: string, itemId: string) {
    if (!this.wishlistMap.has(userId)) this.wishlistMap.set(userId, new Set());
    this.wishlistMap.get(userId)!.add(itemId);
  }
  async removeFromWishlist(userId: string, itemId: string) {
    this.wishlistMap.get(userId)?.delete(itemId);
  }

  // ── Notifications ──────────────────────────────────────────────────────
  private notificationsList: Notification[] = [];

  async getNotifications(userId: string, limit = 20) {
    return this.notificationsList
      .filter(n => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }
  async createNotification(userId: string, type: string, title: string, message: string, metadata?: any): Promise<Notification> {
    const n: Notification = {
      id: randomUUID(),
      userId,
      type,
      title,
      message,
      read: false,
      metadata: metadata ?? null,
      createdAt: new Date(),
    };
    this.notificationsList.push(n);
    return n;
  }
  async markNotificationRead(id: string) {
    const n = this.notificationsList.find(n => n.id === id);
    if (n) n.read = true;
  }
  async markAllNotificationsRead(userId: string) {
    this.notificationsList.filter(n => n.userId === userId).forEach(n => { n.read = true; });
  }
  async getUnreadNotificationCount(userId: string) {
    return this.notificationsList.filter(n => n.userId === userId && !n.read).length;
  }

  // ── Club Challenges ────────────────────────────────────────────────────
  private clubChallengesList: ClubChallenge[] = [];
  async getClubChallenges(clubId: string) {
    return this.clubChallengesList.filter(c => c.clubId === clubId);
  }
  async createClubChallenge(data: Omit<ClubChallenge, "id" | "createdAt">) {
    const challenge: ClubChallenge = {
      ...data,
      id: randomUUID(),
      createdAt: new Date(),
    };
    this.clubChallengesList.push(challenge);
    return challenge;
  }
  async updateChallengeProgress(id: string, increment: number) {
    const c = this.clubChallengesList.find(ch => ch.id === id);
    if (!c) return undefined;
    c.currentValue = c.currentValue + increment;
    if (c.currentValue >= c.targetValue && !c.completedAt) {
      c.completedAt = new Date();
    }
    return c;
  }
  async completeChallenge(id: string) {
    const c = this.clubChallengesList.find(ch => ch.id === id);
    if (!c) return undefined;
    c.completedAt = new Date();
    return c;
  }

  // ── Club Wars ──────────────────────────────────────────────────────────
  private clubWarsList: ClubWar[] = [];
  async getClubWars(clubId?: string, status?: string) {
    let result = this.clubWarsList;
    if (clubId) result = result.filter(w => w.club1Id === clubId || w.club2Id === clubId);
    if (status) result = result.filter(w => w.status === status);
    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async createClubWar(data: Omit<ClubWar, "id" | "createdAt">) {
    const war: ClubWar = { ...data, id: randomUUID(), createdAt: new Date() };
    this.clubWarsList.push(war);
    return war;
  }
  async updateClubWar(id: string, data: Partial<ClubWar>) {
    const w = this.clubWarsList.find(w => w.id === id);
    if (!w) return undefined;
    Object.assign(w, data);
    return w;
  }
  async getUpcomingClubWars() {
    const now = new Date();
    return this.clubWarsList
      .filter(w => w.status === "pending" && w.scheduledAt > now)
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  }

  // ── Marketplace ─────────────────────────────────────────────────────
  private marketplaceListingsList: MarketplaceListing[] = [];
  async getListings(status?: string) {
    let result = this.marketplaceListingsList;
    if (status) result = result.filter(l => l.status === status);
    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async createListing(data: Omit<MarketplaceListing, "id" | "createdAt">) {
    const listing: MarketplaceListing = { ...data, id: randomUUID(), createdAt: new Date() };
    this.marketplaceListingsList.push(listing);
    return listing;
  }
  async buyListing(id: string, buyerId: string) {
    const listing = this.marketplaceListingsList.find(l => l.id === id);
    if (!listing || listing.status !== "active") return undefined;
    listing.status = "sold";
    listing.buyerId = buyerId;
    listing.soldAt = new Date();
    return listing;
  }
  async cancelListing(id: string) {
    const listing = this.marketplaceListingsList.find(l => l.id === id);
    if (!listing || listing.status !== "active") return undefined;
    listing.status = "cancelled";
    return listing;
  }

  // ── Stakes ─────────────────────────────────────────────────────────
  private stakesList: Stake[] = [];
  async getStakesForPlayer(userId: string) {
    return this.stakesList.filter(s => s.backerId === userId || s.playerId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async createStake(data: Omit<Stake, "id" | "createdAt">) {
    const stake: Stake = { ...data, id: randomUUID(), createdAt: new Date() };
    this.stakesList.push(stake);
    return stake;
  }
  async updateStake(id: string, data: Partial<Stake>) {
    const s = this.stakesList.find(s => s.id === id);
    if (!s) return undefined;
    Object.assign(s, data);
    return s;
  }
  async getStake(id: string) {
    return this.stakesList.find(s => s.id === id);
  }

  // ── API Keys ────────────────────────────────────────────────────────────
  private apiKeysList: ApiKey[] = [];
  async createApiKey(userId: string, keyHash: string, name: string) {
    const key: ApiKey = { id: randomUUID(), userId, keyHash, name, lastUsed: null, createdAt: new Date() };
    this.apiKeysList.push(key);
    return key;
  }
  async getApiKeysByUser(userId: string) {
    return this.apiKeysList.filter(k => k.userId === userId);
  }
  async deleteApiKey(id: string) {
    this.apiKeysList = this.apiKeysList.filter(k => k.id !== id);
  }
  async getApiKeyByHash(keyHash: string) {
    return this.apiKeysList.find(k => k.keyHash === keyHash);
  }
  async updateApiKeyLastUsed(id: string) {
    const key = this.apiKeysList.find(k => k.id === id);
    if (key) key.lastUsed = new Date();
  }

  // ── OAuth ──────────────────────────────────────────────────────────────
  async getUserByProvider(provider: string, providerId: string) {
    return Array.from(this.users.values()).find(u => u.provider === provider && u.providerId === providerId);
  }

  // ── Loyalty (HRP) ─────────────────────────────────────────────────────
  private loyaltyLogsList: LoyaltyLog[] = [];

  async awardLoyaltyPoints(userId: string, baseAmount: number, reason: string, tier?: string) {
    const { calculateHRP } = await import("./loyalty-config");
    const multiplier = tier ? (await import("./loyalty-config")).TIER_HRP_MULTIPLIER[tier] ?? 1.0 : 1.0;
    const finalAmount = calculateHRP(baseAmount, tier ?? "free");

    const user = this.users.get(userId);
    if (!user) return { newTotal: 0, newLevel: 1, leveledUp: false };

    const oldLevel = user.loyaltyLevel;
    const newTotal = user.loyaltyPoints + finalAmount;
    const newLevelDef = getLoyaltyLevel(newTotal);

    user.loyaltyPoints = newTotal;
    user.loyaltyLevel = newLevelDef.level;

    this.loyaltyLogsList.push({
      id: randomUUID(),
      userId,
      amount: finalAmount,
      reason,
      multiplier: Math.round(multiplier * 100),
      baseAmount,
      newTotal,
      newLevel: newLevelDef.level,
      createdAt: new Date(),
    } as any);

    return { newTotal, newLevel: newLevelDef.level, leveledUp: newLevelDef.level > oldLevel };
  }

  async getLoyaltyHistory(userId: string, limit = 20) {
    return this.loyaltyLogsList
      .filter(l => l.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }
}

// ─── Database Storage (when DATABASE_URL is set) ─────────────────────────────
export class DatabaseStorage implements IStorage {
  private get db() { return getDb(); }

  async ensureSystemUser(): Promise<void> {
    const existing = await this.getUser("system");
    if (existing) return;
    try {
      await this.db.insert(users).values({
        id: "system",
        username: "system",
        password: require("crypto").randomBytes(64).toString("hex"),
        displayName: "System",
        role: "admin",
        chipBalance: 0,
        memberId: "HR-SYSTEM00",
      });
      console.log("[init] System user created successfully");
    } catch (err: any) {
      // Only suppress duplicate key / unique constraint violations
      const msg = err?.message || "";
      if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("already exists")) {
        // System user was created by a concurrent startup — this is fine
        return;
      }
      // Any other error is a real problem — rethrow so callers know
      console.error("[init] Failed to create system user:", msg);
      throw err;
    }
  }

  // Users
  async getUser(id: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByUsername(username: string) {
    const [user] = await this.db.select().from(users).where(eq(users.username, username));
    return user;
  }
  async getUserByEmail(email: string) {
    const [user] = await this.db.select().from(users).where(eq(users.email, email));
    return user;
  }
  async getUserByWalletAddress(address: string) {
    const [user] = await this.db.select().from(users).where(sql`LOWER(${users.walletAddress}) = LOWER(${address})`);
    return user;
  }
  async getUserByFirebaseUid(uid: string) {
    const [user] = await this.db.select().from(users).where(eq(users.firebaseUid, uid));
    return user;
  }
  async getUserByMemberId(memberId: string) {
    const [user] = await this.db.select().from(users).where(eq(users.memberId, memberId));
    return user;
  }
  async getAllUsersByKycStatus(status: string) {
    return await this.db.select().from(users).where(eq(users.kycStatus, status));
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
      firebaseUid: data.firebaseUid,
      email: data.email,
      memberId: data.memberId,
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
      awayTimeoutMinutes: data.awayTimeoutMinutes ?? 5,
      inviteCode: this.generateInviteCode(),
      scheduledStartTime: data.scheduledStartTime ? new Date(data.scheduledStartTime) : null,
      scheduledEndTime: data.scheduledEndTime ? new Date(data.scheduledEndTime) : null,
      recurringSchedule: data.recurringSchedule || null,
      runItTwice: data.runItTwice || "ask",
      showdownSpeed: data.showdownSpeed || "normal",
      dealToAwayPlayers: data.dealToAwayPlayers ?? false,
      timeBankRefillHands: data.timeBankRefillHands ?? 0,
      spectatorMode: data.spectatorMode ?? true,
      doubleBoard: data.doubleBoard ?? false,
      sevenTwoBounty: data.sevenTwoBounty ?? 0,
      guestChatEnabled: data.guestChatEnabled ?? true,
      autoTrimExcessBets: data.autoTrimExcessBets ?? false,
      pokerVariant: data.pokerVariant || "nlhe",
      useCentsValues: data.useCentsValues ?? false,
      requireAdminApproval: data.requireAdminApproval ?? false,
      allowSpectators: data.allowSpectators ?? true,
      clubMembersOnly: data.clubMembersOnly ?? false,
    }).returning();
    return table;
  }

  private generateInviteCode(): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }
  async getTableByInviteCode(code: string) {
    const [table] = await this.db.select().from(tables).where(eq(tables.inviteCode, code));
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
  async getLeaderboard(metric: "chips" | "wins" | "winRate", limit = 50, period: "today" | "week" | "month" | "all" = "all") {
    // For period-filtered queries, aggregate directly from handPlayers + gameHands
    if (period !== "all") {
      const cutoff = periodCutoff(period);
      if (metric === "chips") {
        const rows = await this.db.select({
          userId: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarId: users.avatarId,
          value: sql<number>`COALESCE(SUM(${handPlayers.netResult}), 0)`.as("value"),
        }).from(handPlayers)
          .innerJoin(gameHands, eq(gameHands.id, handPlayers.handId))
          .innerJoin(users, eq(users.id, handPlayers.userId))
          .where(gte(gameHands.createdAt, cutoff))
          .groupBy(users.id, users.username, users.displayName, users.avatarId)
          .orderBy(sql`COALESCE(SUM(${handPlayers.netResult}), 0) DESC`)
          .limit(limit);
        return rows.map(r => ({ ...r, value: Number(r.value) }));
      }
      if (metric === "wins") {
        const rows = await this.db.select({
          userId: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarId: users.avatarId,
          value: sql<number>`SUM(CASE WHEN ${handPlayers.isWinner} THEN 1 ELSE 0 END)`.as("value"),
        }).from(handPlayers)
          .innerJoin(gameHands, eq(gameHands.id, handPlayers.handId))
          .innerJoin(users, eq(users.id, handPlayers.userId))
          .where(gte(gameHands.createdAt, cutoff))
          .groupBy(users.id, users.username, users.displayName, users.avatarId)
          .orderBy(sql`SUM(CASE WHEN ${handPlayers.isWinner} THEN 1 ELSE 0 END) DESC`)
          .limit(limit);
        return rows.map(r => ({ ...r, value: Number(r.value) }));
      }
      // winRate
      const rows = await this.db.select({
        userId: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarId: users.avatarId,
        handsPlayed: sql<number>`COUNT(*)`.as("hands_played"),
        wins: sql<number>`SUM(CASE WHEN ${handPlayers.isWinner} THEN 1 ELSE 0 END)`.as("wins"),
      }).from(handPlayers)
        .innerJoin(gameHands, eq(gameHands.id, handPlayers.handId))
        .innerJoin(users, eq(users.id, handPlayers.userId))
        .where(gte(gameHands.createdAt, cutoff))
        .groupBy(users.id, users.username, users.displayName, users.avatarId)
        .having(sql`COUNT(*) >= 10`)
        .orderBy(sql`(SUM(CASE WHEN ${handPlayers.isWinner} THEN 1 ELSE 0 END)::float / COUNT(*)::float) DESC`)
        .limit(limit);
      return rows.map(r => ({
        userId: r.userId,
        username: r.username,
        displayName: r.displayName,
        avatarId: r.avatarId,
        value: Math.round((Number(r.wins) / Number(r.handsPlayed)) * 100),
      }));
    }

    // period === "all": use cumulative playerStats
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
    // winRate
    const rows = await this.db.select({
      userId: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarId: users.avatarId,
      handsPlayed: playerStats.handsPlayed,
      potsWon: playerStats.potsWon,
    }).from(playerStats).innerJoin(users, eq(users.id, playerStats.userId))
      .where(sql`${playerStats.handsPlayed} >= 10`)
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
  async incrementPlayerStat(userId: string, field: "handsPlayed" | "potsWon" | "sngWins" | "bombPotsPlayed" | "headsUpWins" | "vpip" | "pfr" | "bluffWins" | "ploHands" | "bigPotWins" | "preflopFolds" | "tournamentHands", amount: number) {
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
      bluffWins: "bluff_wins",
      ploHands: "plo_hands",
      bigPotWins: "big_pot_wins",
      preflopFolds: "preflop_folds",
      tournamentHands: "tournament_hands",
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
  async removeFromInventory(userId: string, itemId: string): Promise<void> {
    await this.db.delete(userInventory).where(and(eq(userInventory.userId, userId), eq(userInventory.itemId, itemId)));
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
  async getClubTournaments(clubId: string) {
    return this.db.select().from(tournaments)
      .where(eq(tournaments.clubId, clubId))
      .orderBy(desc(tournaments.createdAt));
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

  // ── Wallets ──────────────────────────────────────────────────────────
  async getWallet(userId: string, walletType: WalletType) {
    const [w] = await this.db.select().from(wallets)
      .where(and(eq(wallets.userId, userId), eq(wallets.walletType, walletType)));
    return w;
  }
  async getUserWallets(userId: string) {
    return this.db.select().from(wallets).where(eq(wallets.userId, userId));
  }
  async createWallet(userId: string, walletType: WalletType, initialBalance = 0): Promise<Wallet> {
    const [w] = await this.db.insert(wallets).values({
      userId, walletType, balance: initialBalance,
    }).returning();
    return w;
  }
  async ensureWallets(userId: string): Promise<Wallet[]> {
    // Insert all 5 wallet types, skip any that already exist (ON CONFLICT DO NOTHING)
    for (const wt of walletTypeEnum) {
      await this.db.execute(sql`
        INSERT INTO wallets (id, user_id, wallet_type, balance)
        VALUES (gen_random_uuid(), ${userId}, ${wt}, 0)
        ON CONFLICT (user_id, wallet_type) DO NOTHING
      `);
    }
    return this.getUserWallets(userId);
  }

  async atomicDeductFromWallet(userId: string, walletType: WalletType, amount: number): Promise<{ success: boolean; newBalance: number }> {
    const result = await this.db.execute(sql`
      UPDATE wallets SET balance = balance - ${amount}, updated_at = NOW()
      WHERE user_id = ${userId} AND wallet_type = ${walletType}
        AND balance >= ${amount} AND is_locked = false
      RETURNING balance
    `);
    const rows = result.rows as any[];
    if (rows.length === 0) {
      const w = await this.getWallet(userId, walletType);
      return { success: false, newBalance: w?.balance ?? 0 };
    }
    return { success: true, newBalance: Number(rows[0].balance) };
  }
  async atomicAddToWallet(userId: string, walletType: WalletType, amount: number): Promise<{ success: boolean; newBalance: number }> {
    const result = await this.db.execute(sql`
      UPDATE wallets SET balance = balance + ${amount}, updated_at = NOW()
      WHERE user_id = ${userId} AND wallet_type = ${walletType} AND is_locked = false
      RETURNING balance
    `);
    const rows = result.rows as any[];
    if (rows.length === 0) return { success: false, newBalance: 0 };
    return { success: true, newBalance: Number(rows[0].balance) };
  }
  async atomicTransferBetweenWallets(userId: string, fromWallet: WalletType, toWallet: WalletType, amount: number): Promise<{ success: boolean; fromBalance: number; toBalance: number }> {
    if (fromWallet === "bonus") {
      return { success: false, fromBalance: 0, toBalance: 0 };
    }
    // Use a CTE to atomically deduct and add in one statement
    const result = await this.db.execute(sql`
      WITH deducted AS (
        UPDATE wallets SET balance = balance - ${amount}, updated_at = NOW()
        WHERE user_id = ${userId} AND wallet_type = ${fromWallet}
          AND balance >= ${amount} AND is_locked = false
        RETURNING balance AS from_balance
      ),
      added AS (
        UPDATE wallets SET balance = balance + ${amount}, updated_at = NOW()
        WHERE user_id = ${userId} AND wallet_type = ${toWallet}
          AND is_locked = false
          AND EXISTS (SELECT 1 FROM deducted)
        RETURNING balance AS to_balance
      )
      SELECT d.from_balance, a.to_balance
      FROM deducted d, added a
    `);
    const rows = result.rows as any[];
    if (rows.length === 0) {
      const fromW = await this.getWallet(userId, fromWallet);
      const toW = await this.getWallet(userId, toWallet);
      return { success: false, fromBalance: fromW?.balance ?? 0, toBalance: toW?.balance ?? 0 };
    }
    return { success: true, fromBalance: Number(rows[0].from_balance), toBalance: Number(rows[0].to_balance) };
  }

  async getAllWalletBalanceSum() {
    const rows = await this.db.execute(sql`
      SELECT COALESCE(SUM(balance), 0) AS total FROM wallets
    `);
    return Number((rows.rows as any[])[0]?.total || 0);
  }
  async getUserTotalBalance(userId: string) {
    const rows = await this.db.execute(sql`
      SELECT COALESCE(SUM(balance), 0) AS total FROM wallets WHERE user_id = ${userId}
    `);
    return Number((rows.rows as any[])[0]?.total || 0);
  }

  // ── Payments ──────────────────────────────────────────────────────────
  async createPayment(data: Omit<Payment, "id" | "createdAt" | "updatedAt">): Promise<Payment> {
    const [p] = await this.db.insert(payments).values(data).returning();
    return p;
  }
  async getPayment(id: string) {
    const [p] = await this.db.select().from(payments).where(eq(payments.id, id));
    return p;
  }
  async getPaymentByGatewayId(provider: string, gatewayPaymentId: string) {
    const [p] = await this.db.select().from(payments)
      .where(and(eq(payments.gatewayProvider, provider), eq(payments.gatewayPaymentId, gatewayPaymentId)));
    return p;
  }
  async getUserPayments(userId: string, limit = 50, offset = 0) {
    return this.db.select().from(payments)
      .where(eq(payments.userId, userId))
      .orderBy(desc(payments.createdAt))
      .limit(limit)
      .offset(offset);
  }
  async getAllPayments(limit = 200, offset = 0) {
    return this.db.select().from(payments)
      .orderBy(desc(payments.createdAt))
      .limit(limit)
      .offset(offset);
  }
  async getPendingPayments() {
    return this.db.select().from(payments)
      .where(
        and(
          eq(payments.direction, "deposit"),
          inArray(payments.status, ["pending", "confirming", "waiting"]),
        ),
      );
  }
  async updatePayment(id: string, data: Partial<Payment>) {
    const [p] = await this.db.update(payments).set({ ...data, updatedAt: new Date() })
      .where(eq(payments.id, id)).returning();
    return p;
  }

  // ── Withdrawal Requests ───────────────────────────────────────────────
  async createWithdrawalRequest(data: Omit<WithdrawalRequest, "id" | "createdAt">): Promise<WithdrawalRequest> {
    const [r] = await this.db.insert(withdrawalRequests).values(data).returning();
    return r;
  }
  async getWithdrawalRequests(status?: string) {
    if (status) {
      return this.db.select().from(withdrawalRequests)
        .where(eq(withdrawalRequests.status, status))
        .orderBy(desc(withdrawalRequests.createdAt));
    }
    return this.db.select().from(withdrawalRequests).orderBy(desc(withdrawalRequests.createdAt));
  }
  async getUserWithdrawalRequests(userId: string) {
    return this.db.select().from(withdrawalRequests)
      .where(eq(withdrawalRequests.userId, userId))
      .orderBy(desc(withdrawalRequests.createdAt));
  }
  async updateWithdrawalRequest(id: string, data: Partial<WithdrawalRequest>) {
    const [r] = await this.db.update(withdrawalRequests).set(data)
      .where(eq(withdrawalRequests.id, id)).returning();
    return r;
  }

  // ── Supported Currencies ──────────────────────────────────────────────
  async getSupportedCurrencies() {
    return this.db.select().from(supportedCurrencies)
      .where(eq(supportedCurrencies.isActive, true))
      .orderBy(supportedCurrencies.sortOrder);
  }
  async upsertSupportedCurrency(data: SupportedCurrency): Promise<SupportedCurrency> {
    const [c] = await this.db.insert(supportedCurrencies).values(data)
      .onConflictDoUpdate({
        target: supportedCurrencies.id,
        set: {
          name: data.name,
          symbol: data.symbol,
          network: data.network,
          minDeposit: data.minDeposit,
          minWithdrawal: data.minWithdrawal,
          confirmationsRequired: data.confirmationsRequired,
          isActive: data.isActive,
          sortOrder: data.sortOrder,
        },
      }).returning();
    return c;
  }

  // ── Chat Messages ──────────────────────────────────────────────────────
  async saveChatMessage(tableId: string, userId: string, username: string, message: string) {
    const [msg] = await this.db.insert(chatMessages).values({ tableId, userId, username, message }).returning();
    return msg;
  }
  async getRecentChatMessages(tableId: string, limit = 50) {
    return this.db.select().from(chatMessages)
      .where(eq(chatMessages.tableId, tableId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
  }

  // ── Club Messages (Club Chat) ─────────────────────────────────────────
  async getClubMessages(clubId: string, limit = 50) {
    return this.db.select().from(clubMessages)
      .where(eq(clubMessages.clubId, clubId))
      .orderBy(desc(clubMessages.createdAt))
      .limit(limit)
      .then(rows => rows.reverse()); // return in chronological order
  }
  async createClubMessage(data: { clubId: string; userId: string; message: string }) {
    const [msg] = await this.db.insert(clubMessages).values(data).returning();
    return msg;
  }

  // ── Collusion Alerts ───────────────────────────────────────────────────
  async saveCollusionAlert(data: Omit<CollusionAlert, "id" | "createdAt" | "reviewedBy" | "reviewedAt">) {
    const [alert] = await this.db.insert(collusionAlerts).values(data).returning();
    return alert;
  }
  async getCollusionAlerts(status?: string) {
    if (status) {
      return this.db.select().from(collusionAlerts)
        .where(eq(collusionAlerts.status, status))
        .orderBy(desc(collusionAlerts.createdAt));
    }
    return this.db.select().from(collusionAlerts).orderBy(desc(collusionAlerts.createdAt));
  }
  async reviewCollusionAlert(id: string, reviewerId: string, status: string) {
    const [alert] = await this.db.update(collusionAlerts)
      .set({ status, reviewedBy: reviewerId, reviewedAt: new Date() })
      .where(eq(collusionAlerts.id, id)).returning();
    return alert;
  }

  // ── Player Notes ───────────────────────────────────────────────────────
  async getPlayerNote(authorId: string, targetId: string) {
    const [note] = await this.db.select().from(playerNotes)
      .where(and(eq(playerNotes.authorUserId, authorId), eq(playerNotes.targetUserId, targetId)));
    return note;
  }
  async upsertPlayerNote(authorId: string, targetId: string, note: string, color: string) {
    const [pn] = await this.db.insert(playerNotes)
      .values({ authorUserId: authorId, targetUserId: targetId, note, color })
      .onConflictDoUpdate({
        target: [playerNotes.authorUserId, playerNotes.targetUserId],
        set: { note, color, updatedAt: new Date() },
      }).returning();
    return pn;
  }
  async deletePlayerNote(authorId: string, targetId: string) {
    await this.db.delete(playerNotes)
      .where(and(eq(playerNotes.authorUserId, authorId), eq(playerNotes.targetUserId, targetId)));
  }
  async getPlayerNotes(authorId: string) {
    return this.db.select().from(playerNotes).where(eq(playerNotes.authorUserId, authorId));
  }

  // ── Table Player Chips ─────────────────────────────────────────────────
  async updateTablePlayerChips(tableId: string, odId: string, newChips: number) {
    await this.db.update(tablePlayers)
      .set({ chipStack: newChips })
      .where(and(eq(tablePlayers.tableId, tableId), eq(tablePlayers.userId, odId)));
  }

  // ── Wishlists ──────────────────────────────────────────────────────────
  async getWishlist(userId: string) {
    const rows = await this.db.select({ itemId: wishlists.itemId })
      .from(wishlists)
      .where(eq(wishlists.userId, userId));
    return rows.map(r => r.itemId);
  }
  async addToWishlist(userId: string, itemId: string) {
    await this.db.insert(wishlists)
      .values({ userId, itemId })
      .onConflictDoNothing();
  }
  async removeFromWishlist(userId: string, itemId: string) {
    await this.db.delete(wishlists)
      .where(and(eq(wishlists.userId, userId), eq(wishlists.itemId, itemId)));
  }

  // ── Notifications ──────────────────────────────────────────────────────
  async getNotifications(userId: string, limit = 20) {
    return this.db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }
  async createNotification(userId: string, type: string, title: string, message: string, metadata?: any): Promise<Notification> {
    const [n] = await this.db.insert(notifications).values({
      userId,
      type,
      title,
      message,
      metadata: metadata ?? null,
    }).returning();
    return n;
  }
  async markNotificationRead(id: string) {
    await this.db.update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, id));
  }
  async markAllNotificationsRead(userId: string) {
    await this.db.update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  }
  async getUnreadNotificationCount(userId: string) {
    const [result] = await this.db.select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
    return result?.count ?? 0;
  }

  // ── Club Challenges ────────────────────────────────────────────────────
  async getClubChallenges(clubId: string) {
    return this.db.select().from(clubChallenges)
      .where(eq(clubChallenges.clubId, clubId))
      .orderBy(desc(clubChallenges.createdAt));
  }
  async createClubChallenge(data: Omit<ClubChallenge, "id" | "createdAt">) {
    const [challenge] = await this.db.insert(clubChallenges)
      .values(data)
      .returning();
    return challenge;
  }
  async updateChallengeProgress(id: string, increment: number) {
    const [updated] = await this.db.update(clubChallenges)
      .set({
        currentValue: sql`${clubChallenges.currentValue} + ${increment}`,
      })
      .where(eq(clubChallenges.id, id))
      .returning();
    if (updated && updated.currentValue >= updated.targetValue && !updated.completedAt) {
      const [completed] = await this.db.update(clubChallenges)
        .set({ completedAt: new Date() })
        .where(eq(clubChallenges.id, id))
        .returning();
      return completed;
    }
    return updated;
  }
  async completeChallenge(id: string) {
    const [challenge] = await this.db.update(clubChallenges)
      .set({ completedAt: new Date() })
      .where(eq(clubChallenges.id, id))
      .returning();
    return challenge;
  }

  // ── Club Wars ──────────────────────────────────────────────────────────
  async getClubWars(clubId?: string, status?: string) {
    const conditions = [];
    if (clubId) conditions.push(or(eq(clubWars.club1Id, clubId), eq(clubWars.club2Id, clubId)));
    if (status) conditions.push(eq(clubWars.status, status));
    const query = this.db.select().from(clubWars);
    if (conditions.length > 0) {
      return query.where(and(...conditions)).orderBy(desc(clubWars.createdAt));
    }
    return query.orderBy(desc(clubWars.createdAt));
  }
  async createClubWar(data: Omit<ClubWar, "id" | "createdAt">) {
    const [war] = await this.db.insert(clubWars).values(data).returning();
    return war;
  }
  async updateClubWar(id: string, data: Partial<ClubWar>) {
    const [war] = await this.db.update(clubWars).set(data).where(eq(clubWars.id, id)).returning();
    return war;
  }
  async getUpcomingClubWars() {
    return this.db.select().from(clubWars)
      .where(and(eq(clubWars.status, "pending"), gte(clubWars.scheduledAt, new Date())))
      .orderBy(clubWars.scheduledAt);
  }

  // ── Marketplace ─────────────────────────────────────────────────────
  async getListings(status?: string) {
    if (status) {
      return this.db.select().from(marketplaceListings)
        .where(eq(marketplaceListings.status, status))
        .orderBy(desc(marketplaceListings.createdAt));
    }
    return this.db.select().from(marketplaceListings).orderBy(desc(marketplaceListings.createdAt));
  }
  async createListing(data: Omit<MarketplaceListing, "id" | "createdAt">) {
    const [listing] = await this.db.insert(marketplaceListings).values(data).returning();
    return listing;
  }
  async buyListing(id: string, buyerId: string) {
    const [listing] = await this.db.update(marketplaceListings)
      .set({ status: "sold", buyerId, soldAt: new Date() })
      .where(and(eq(marketplaceListings.id, id), eq(marketplaceListings.status, "active")))
      .returning();
    return listing;
  }
  async cancelListing(id: string) {
    const [listing] = await this.db.update(marketplaceListings)
      .set({ status: "cancelled" })
      .where(and(eq(marketplaceListings.id, id), eq(marketplaceListings.status, "active")))
      .returning();
    return listing;
  }

  // ── Stakes ─────────────────────────────────────────────────────────
  async getStakesForPlayer(userId: string) {
    return this.db.select().from(stakes)
      .where(or(eq(stakes.backerId, userId), eq(stakes.playerId, userId)))
      .orderBy(desc(stakes.createdAt));
  }
  async createStake(data: Omit<Stake, "id" | "createdAt">) {
    const [stake] = await this.db.insert(stakes).values(data).returning();
    return stake;
  }
  async updateStake(id: string, data: Partial<Stake>) {
    const [stake] = await this.db.update(stakes).set(data).where(eq(stakes.id, id)).returning();
    return stake;
  }
  async getStake(id: string) {
    const [stake] = await this.db.select().from(stakes).where(eq(stakes.id, id));
    return stake;
  }

  // ── API Keys ────────────────────────────────────────────────────────────
  async createApiKey(userId: string, keyHash: string, name: string) {
    const [key] = await this.db.insert(apiKeys).values({ userId, keyHash, name }).returning();
    return key;
  }
  async getApiKeysByUser(userId: string) {
    return this.db.select().from(apiKeys).where(eq(apiKeys.userId, userId)).orderBy(desc(apiKeys.createdAt));
  }
  async deleteApiKey(id: string) {
    await this.db.delete(apiKeys).where(eq(apiKeys.id, id));
  }
  async getApiKeyByHash(keyHash: string) {
    const [key] = await this.db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash));
    return key;
  }
  async updateApiKeyLastUsed(id: string) {
    await this.db.update(apiKeys).set({ lastUsed: new Date() }).where(eq(apiKeys.id, id));
  }

  // ── OAuth ──────────────────────────────────────────────────────────────
  async getUserByProvider(provider: string, providerId: string) {
    const [user] = await this.db.select().from(users)
      .where(and(eq(users.provider, provider), eq(users.providerId, providerId)));
    return user;
  }

  // ── Loyalty (HRP) ─────────────────────────────────────────────────────
  async awardLoyaltyPoints(userId: string, baseAmount: number, reason: string, tier?: string) {
    const { calculateHRP, TIER_HRP_MULTIPLIER } = await import("./loyalty-config");
    const multiplier = tier ? (TIER_HRP_MULTIPLIER[tier] ?? 1.0) : 1.0;
    const finalAmount = calculateHRP(baseAmount, tier ?? "free");

    // Atomically increment loyalty_points and update level
    const [updated] = await this.db.update(users)
      .set({
        loyaltyPoints: sql`${users.loyaltyPoints} + ${finalAmount}`,
      })
      .where(eq(users.id, userId))
      .returning({
        loyaltyPoints: users.loyaltyPoints,
        loyaltyLevel: users.loyaltyLevel,
      });

    if (!updated) return { newTotal: 0, newLevel: 1, leveledUp: false };

    const newTotal = updated.loyaltyPoints;
    const newLevelDef = getLoyaltyLevel(newTotal);
    const oldLevel = updated.loyaltyLevel;
    const leveledUp = newLevelDef.level > oldLevel;

    // Update level if changed
    if (leveledUp) {
      await this.db.update(users)
        .set({ loyaltyLevel: newLevelDef.level })
        .where(eq(users.id, userId));
    }

    // Log the award
    await this.db.insert(loyaltyLogs).values({
      userId,
      amount: finalAmount,
      reason,
      multiplier: Math.round(multiplier * 100),
      baseAmount,
      newTotal,
      newLevel: newLevelDef.level,
    });

    return { newTotal, newLevel: newLevelDef.level, leveledUp };
  }

  async getLoyaltyHistory(userId: string, limit = 20) {
    return this.db.select().from(loyaltyLogs)
      .where(eq(loyaltyLogs.userId, userId))
      .orderBy(desc(loyaltyLogs.createdAt))
      .limit(limit);
  }
}

// Export singleton - use DatabaseStorage if DATABASE_URL exists, otherwise MemStorage
// In production, refuse to run without a database — in-memory storage loses all data on restart
if (!hasDatabase() && process.env.NODE_ENV === "production") {
  throw new Error("FATAL: DATABASE_URL must be set in production. In-memory storage is not safe for real users.");
}
export const storage: IStorage = hasDatabase() ? new DatabaseStorage() : new MemStorage();
