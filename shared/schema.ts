import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name"),
  avatarId: text("avatar_id"),
  chipBalance: integer("chip_balance").notNull().default(10000),
  role: text("role").notNull().default("guest"), // guest | member | admin
  provider: text("provider").notNull().default("local"), // local | google | discord
  providerId: text("provider_id"),
  lastDailyClaim: timestamp("last_daily_claim"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const registerUserSchema = z.object({
  username: z.string().min(3).max(20),
  password: z.string().min(6).max(100),
  displayName: z.string().min(1).max(30).optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ─── Clubs ───────────────────────────────────────────────────────────────────
export const clubs = pgTable("clubs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: varchar("owner_id").notNull().references(() => users.id),
  avatarUrl: text("avatar_url"),
  isPublic: boolean("is_public").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertClubSchema = createInsertSchema(clubs).pick({
  name: true,
  description: true,
  isPublic: true,
});

export type Club = typeof clubs.$inferSelect;
export type InsertClub = z.infer<typeof insertClubSchema>;

// ─── Club Members ────────────────────────────────────────────────────────────
export const clubMembers = pgTable("club_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clubId: varchar("club_id").notNull().references(() => clubs.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  role: text("role").notNull().default("member"), // owner | admin | member
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
}, (table) => [
  index("club_members_club_idx").on(table.clubId),
  index("club_members_user_idx").on(table.userId),
]);

export type ClubMember = typeof clubMembers.$inferSelect;

// ─── Tables ──────────────────────────────────────────────────────────────────
export const tables = pgTable("tables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clubId: varchar("club_id").references(() => clubs.id),
  name: text("name").notNull(),
  maxPlayers: integer("max_players").notNull().default(6),
  smallBlind: integer("small_blind").notNull().default(10),
  bigBlind: integer("big_blind").notNull().default(20),
  minBuyIn: integer("min_buy_in").notNull().default(200),
  maxBuyIn: integer("max_buy_in").notNull().default(2000),
  ante: integer("ante").notNull().default(0),
  timeBankSeconds: integer("time_bank_seconds").notNull().default(30),
  isPrivate: boolean("is_private").notNull().default(false),
  password: text("password"),
  status: text("status").notNull().default("waiting"), // waiting | playing
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  allowBots: boolean("allow_bots").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTableSchema = z.object({
  name: z.string().min(1).max(50),
  maxPlayers: z.number().int().min(2).max(6).default(6),
  smallBlind: z.number().int().min(1).default(10),
  bigBlind: z.number().int().min(2).default(20),
  minBuyIn: z.number().int().min(1).default(200),
  maxBuyIn: z.number().int().min(1).default(2000),
  ante: z.number().int().min(0).default(0),
  timeBankSeconds: z.number().int().min(5).max(120).default(30),
  isPrivate: z.boolean().default(false),
  password: z.string().optional(),
  clubId: z.string().optional(),
  allowBots: z.boolean().default(true),
});

export type TableRow = typeof tables.$inferSelect;
export type InsertTable = z.infer<typeof insertTableSchema>;

// ─── Table Players ───────────────────────────────────────────────────────────
export const tablePlayers = pgTable("table_players", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tableId: varchar("table_id").notNull().references(() => tables.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  seatIndex: integer("seat_index").notNull(),
  chipStack: integer("chip_stack").notNull(),
  isConnected: boolean("is_connected").notNull().default(true),
  isSittingOut: boolean("is_sitting_out").notNull().default(false),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
}, (table) => [
  index("table_players_table_idx").on(table.tableId),
]);

export type TablePlayer = typeof tablePlayers.$inferSelect;

// ─── Game Hands ──────────────────────────────────────────────────────────────
export const gameHands = pgTable("game_hands", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tableId: varchar("table_id").notNull().references(() => tables.id),
  handNumber: integer("hand_number").notNull(),
  communityCards: jsonb("community_cards"),
  potTotal: integer("pot_total").notNull().default(0),
  winnerIds: jsonb("winner_ids"),
  summary: jsonb("summary"), // full hand history for replay
  serverSeed: text("server_seed"),
  commitmentHash: text("commitment_hash"),
  deckOrder: text("deck_order"),
  playerSeeds: jsonb("player_seeds"), // multi-party entropy seeds
  vrfRequestId: text("vrf_request_id"),
  vrfRandomWord: text("vrf_random_word"),
  onChainCommitTx: text("on_chain_commit_tx"),
  onChainRevealTx: text("on_chain_reveal_tx"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("game_hands_table_idx").on(table.tableId),
]);

export type GameHand = typeof gameHands.$inferSelect;

// ─── Transactions ────────────────────────────────────────────────────────────
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // deposit | withdraw | buyin | cashout | bonus | rake
  amount: integer("amount").notNull(),
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  tableId: varchar("table_id"),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("transactions_user_idx").on(table.userId),
]);

export type Transaction = typeof transactions.$inferSelect;

// ─── Tournaments ─────────────────────────────────────────────────────────────
export const tournaments = pgTable("tournaments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clubId: varchar("club_id").references(() => clubs.id),
  name: text("name").notNull(),
  buyIn: integer("buy_in").notNull().default(100),
  startingChips: integer("starting_chips").notNull().default(1500),
  blindSchedule: jsonb("blind_schedule"), // JSON array of {level, sb, bb, ante, duration}
  maxPlayers: integer("max_players").notNull().default(50),
  status: text("status").notNull().default("registering"), // registering | running | final_table | complete
  prizePool: integer("prize_pool").notNull().default(0),
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  startAt: timestamp("start_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Tournament = typeof tournaments.$inferSelect;

// ─── Player Stats (for missions tracking) ────────────────────────────────────
export const playerStats = pgTable("player_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  handsPlayed: integer("hands_played").notNull().default(0),
  potsWon: integer("pots_won").notNull().default(0),
  bestWinStreak: integer("best_win_streak").notNull().default(0),
  currentWinStreak: integer("current_win_streak").notNull().default(0),
  totalWinnings: integer("total_winnings").notNull().default(0),
  lastResetAt: timestamp("last_reset_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("player_stats_user_idx").on(table.userId),
]);

export type PlayerStat = typeof playerStats.$inferSelect;
