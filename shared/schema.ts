import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
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

// ─── Club Invitations ────────────────────────────────────────────────────────
export const clubInvitations = pgTable("club_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clubId: varchar("club_id").notNull().references(() => clubs.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull().default("invite"), // invite | request
  status: text("status").notNull().default("pending"), // pending | accepted | declined
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("club_invitations_club_idx").on(table.clubId),
]);

export type ClubInvitation = typeof clubInvitations.$inferSelect;

// ─── Club Announcements ─────────────────────────────────────────────────────
export const clubAnnouncements = pgTable("club_announcements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clubId: varchar("club_id").notNull().references(() => clubs.id),
  authorId: varchar("author_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  pinned: boolean("pinned").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("club_announcements_club_idx").on(table.clubId),
]);

export type ClubAnnouncement = typeof clubAnnouncements.$inferSelect;

// ─── Club Events ─────────────────────────────────────────────────────────────
export const clubEvents = pgTable("club_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clubId: varchar("club_id").notNull().references(() => clubs.id),
  eventType: text("event_type").notNull(), // tournament | cash_game | special
  tableId: varchar("table_id"),
  name: text("name").notNull(),
  description: text("description"),
  startTime: timestamp("start_time"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("club_events_club_idx").on(table.clubId),
]);

export type ClubEvent = typeof clubEvents.$inferSelect;

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
  replaceBots: boolean("replace_bots").notNull().default(true),
  // Game format fields
  gameFormat: text("game_format").notNull().default("cash"), // cash | sng | heads_up | tournament | bomb_pot
  blindSchedule: jsonb("blind_schedule"), // JSON array of {level, sb, bb, ante, durationSeconds}
  bombPotFrequency: integer("bomb_pot_frequency").default(0), // every Nth hand, 0 = disabled
  bombPotAnte: integer("bomb_pot_ante").default(0),
  buyInAmount: integer("buy_in_amount").default(0), // fixed buy-in for SNG/tournament
  startingChips: integer("starting_chips").default(1500),
  payoutStructure: jsonb("payout_structure"), // JSON array of {place, percentage}
  tournamentId: varchar("tournament_id"),
  // Rake configuration
  rakePercent: integer("rake_percent").notNull().default(0), // rake % (e.g., 5 = 5%), 0 = no rake
  rakeCap: integer("rake_cap").notNull().default(0), // max rake per hand in chips, 0 = no cap
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
  replaceBots: z.boolean().default(true),
  gameFormat: z.enum(["cash", "sng", "heads_up", "tournament", "bomb_pot"]).default("cash"),
  blindSchedule: z.array(z.object({
    level: z.number(),
    sb: z.number(),
    bb: z.number(),
    ante: z.number().default(0),
    durationSeconds: z.number(),
  })).optional(),
  bombPotFrequency: z.number().int().min(0).default(0),
  bombPotAnte: z.number().int().min(0).default(0),
  buyInAmount: z.number().int().min(0).default(0),
  startingChips: z.number().int().min(100).default(1500),
  payoutStructure: z.array(z.object({
    place: z.number(),
    percentage: z.number(),
  })).optional(),
  rakePercent: z.number().int().min(0).max(10).default(0),
  rakeCap: z.number().int().min(0).default(0),
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
  dealerSeat: integer("dealer_seat"),
  communityCards: jsonb("community_cards"),
  potTotal: integer("pot_total").notNull().default(0),
  totalRake: integer("total_rake").notNull().default(0),
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

// ─── Hand Players (per-player participation record) ─────────────────────────
export const handPlayers = pgTable("hand_players", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  handId: varchar("hand_id").notNull().references(() => gameHands.id),
  userId: varchar("user_id").notNull(),
  seatIndex: integer("seat_index").notNull(),
  holeCards: jsonb("hole_cards"), // [CardType, CardType]
  startStack: integer("start_stack").notNull(),
  endStack: integer("end_stack").notNull(),
  netResult: integer("net_result").notNull().default(0), // end - start
  isWinner: boolean("is_winner").notNull().default(false),
  finalAction: text("final_action"), // fold | showdown | all-in
}, (table) => [
  index("hand_players_hand_idx").on(table.handId),
  index("hand_players_user_idx").on(table.userId),
]);

export type HandPlayer = typeof handPlayers.$inferSelect;

// ─── Hand Actions (immutable action-by-action log) ──────────────────────────
export const handActions = pgTable("hand_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  handId: varchar("hand_id").notNull().references(() => gameHands.id),
  playerId: varchar("player_id").notNull(),
  street: text("street").notNull(), // preflop | flop | turn | river | showdown
  actionType: text("action_type").notNull(), // fold | check | call | raise | all_in | blind | ante
  amount: integer("amount").default(0),
  timeSpent: integer("time_spent_ms"), // milliseconds taken to act (for bot detection)
  sequenceNum: integer("sequence_num").notNull(), // ordering within the hand
}, (table) => [
  index("hand_actions_hand_idx").on(table.handId),
  index("hand_actions_player_idx").on(table.playerId),
]);

export type HandAction = typeof handActions.$inferSelect;

// ─── Transactions ────────────────────────────────────────────────────────────
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // deposit | withdraw | buyin | cashout | bonus | rake | prize
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
  blindSchedule: jsonb("blind_schedule"), // JSON array of {level, sb, bb, ante, durationSeconds}
  maxPlayers: integer("max_players").notNull().default(50),
  status: text("status").notNull().default("registering"), // registering | running | final_table | complete
  prizePool: integer("prize_pool").notNull().default(0),
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  startAt: timestamp("start_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Tournament = typeof tournaments.$inferSelect;

// ─── Tournament Registrations ───────────────────────────────────────────────
export const tournamentRegistrations = pgTable("tournament_registrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tournamentId: varchar("tournament_id").notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  status: text("status").notNull().default("registered"), // registered | playing | eliminated | winner
  finishPlace: integer("finish_place"),
  prizeAmount: integer("prize_amount").default(0),
  registeredAt: timestamp("registered_at").notNull().defaultNow(),
}, (table) => [
  index("tournament_reg_tournament_idx").on(table.tournamentId),
  index("tournament_reg_user_idx").on(table.userId),
]);

export type TournamentRegistration = typeof tournamentRegistrations.$inferSelect;

// ─── Player Stats (for missions tracking) ────────────────────────────────────
export const playerStats = pgTable("player_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  handsPlayed: integer("hands_played").notNull().default(0),
  potsWon: integer("pots_won").notNull().default(0),
  bestWinStreak: integer("best_win_streak").notNull().default(0),
  currentWinStreak: integer("current_win_streak").notNull().default(0),
  totalWinnings: integer("total_winnings").notNull().default(0),
  vpip: integer("vpip").notNull().default(0), // voluntarily put in pot count
  pfr: integer("pfr").notNull().default(0), // pre-flop raise count
  showdownCount: integer("showdown_count").notNull().default(0),
  sngWins: integer("sng_wins").notNull().default(0),
  bombPotsPlayed: integer("bomb_pots_played").notNull().default(0),
  headsUpWins: integer("heads_up_wins").notNull().default(0),
  lastResetAt: timestamp("last_reset_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("player_stats_user_idx").on(table.userId),
]);

export type PlayerStat = typeof playerStats.$inferSelect;

// ─── Missions ────────────────────────────────────────────────────────────────
export const missions = pgTable("missions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // hands_played | pots_won | win_streak | sng_win | bomb_pot | heads_up_win | consecutive_wins
  label: text("label").notNull(),
  description: text("description"),
  target: integer("target").notNull(),
  reward: integer("reward").notNull(),
  periodType: text("period_type").notNull().default("daily"), // daily | weekly
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Mission = typeof missions.$inferSelect;

// ─── User Missions ──────────────────────────────────────────────────────────
export const userMissions = pgTable("user_missions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  missionId: varchar("mission_id").notNull().references(() => missions.id),
  progress: integer("progress").notNull().default(0),
  completedAt: timestamp("completed_at"),
  claimedAt: timestamp("claimed_at"),
  periodStart: timestamp("period_start").notNull().defaultNow(),
}, (table) => [
  index("user_missions_user_idx").on(table.userId),
]);

export type UserMission = typeof userMissions.$inferSelect;

// ─── Hand Analyses ──────────────────────────────────────────────────────────
export const handAnalyses = pgTable("hand_analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  handId: varchar("hand_id"),
  holeCards: jsonb("hole_cards").notNull(),
  communityCards: jsonb("community_cards"),
  pot: integer("pot").notNull().default(0),
  position: text("position"),
  analysis: jsonb("analysis"), // {rating, ev, leaks, recommendations}
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("hand_analyses_user_idx").on(table.userId),
]);

export type HandAnalysis = typeof handAnalyses.$inferSelect;

// ─── Shop Items ─────────────────────────────────────────────────────────────
export const shopItems = pgTable("shop_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(), // avatar | table_theme | emote | premium
  rarity: text("rarity").notNull().default("common"), // common | uncommon | rare | epic | legendary
  price: integer("price").notNull(),
  currency: text("currency").notNull().default("chips"), // chips | premium
  imageUrl: text("image_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ShopItem = typeof shopItems.$inferSelect;

// ─── User Inventory ─────────────────────────────────────────────────────────
export const userInventory = pgTable("user_inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  itemId: varchar("item_id").notNull().references(() => shopItems.id),
  equippedAt: timestamp("equipped_at"),
  purchasedAt: timestamp("purchased_at").notNull().defaultNow(),
}, (table) => [
  index("user_inventory_user_idx").on(table.userId),
]);

export type UserInventoryItem = typeof userInventory.$inferSelect;

// ─── Club Alliances ─────────────────────────────────────────────────────────
export const clubAlliances = pgTable("club_alliances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  clubIds: jsonb("club_ids").notNull(), // string[]
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ClubAlliance = typeof clubAlliances.$inferSelect;

// ─── League Seasons ─────────────────────────────────────────────────────────
export const leagueSeasons = pgTable("league_seasons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  standings: jsonb("standings"), // {clubId, points, wins, losses}[]
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type LeagueSeason = typeof leagueSeasons.$inferSelect;
