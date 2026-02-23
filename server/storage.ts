import {
  type User, type InsertUser,
  type Club, type InsertClub,
  type TableRow, type InsertTable,
  type TablePlayer, type ClubMember,
  type Transaction, type GameHand, type Tournament,
  users, clubs, clubMembers, tables, tablePlayers, transactions, gameHands, tournaments,
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { hasDatabase, getDb } from "./db";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: Partial<User> & Pick<User, "username" | "password">): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;

  // Clubs
  getClub(id: string): Promise<Club | undefined>;
  getClubs(): Promise<Club[]>;
  createClub(club: InsertClub & { ownerId: string }): Promise<Club>;
  getClubMembers(clubId: string): Promise<(ClubMember & { user?: User })[]>;
  addClubMember(clubId: string, userId: string, role?: string): Promise<ClubMember>;
  removeClubMember(clubId: string, userId: string): Promise<void>;

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
  getTransactions(userId: string, limit?: number): Promise<Transaction[]>;

  // Game Hands
  createGameHand(hand: Omit<GameHand, "id" | "createdAt">): Promise<GameHand>;
  getGameHands(tableId: string, limit?: number): Promise<GameHand[]>;
}

// ─── In-Memory Storage (fallback when no DATABASE_URL) ───────────────────────
export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private clubs: Map<string, Club> = new Map();
  private clubMembersList: ClubMember[] = [];
  private tablesList: Map<string, TableRow> = new Map();
  private tablePlayersList: TablePlayer[] = [];
  private transactionsList: Transaction[] = [];
  private gameHandsList: GameHand[] = [];

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

  // Clubs
  async getClub(id: string) { return this.clubs.get(id); }
  async getClubs() { return Array.from(this.clubs.values()); }
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
  async getTransactions(userId: string, limit = 50) {
    return this.transactionsList
      .filter(t => t.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
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

  // Clubs
  async getClub(id: string) {
    const [club] = await this.db.select().from(clubs).where(eq(clubs.id, id));
    return club;
  }
  async getClubs() {
    return this.db.select().from(clubs).orderBy(desc(clubs.createdAt));
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
  async getTransactions(userId: string, limit = 50) {
    return this.db.select().from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt))
      .limit(limit);
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
}

// Export singleton - use DatabaseStorage if DATABASE_URL exists, otherwise MemStorage
export const storage: IStorage = hasDatabase() ? new DatabaseStorage() : new MemStorage();
