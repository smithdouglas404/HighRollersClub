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
  tauntVoice: text("taunt_voice").default("default"), // "default" | avatar id for avatar-specific voice
  chipBalance: integer("chip_balance").notNull().default(10000),
  role: text("role").notNull().default("guest"), // guest | member | admin
  provider: text("provider").notNull().default("local"), // local | google | discord
  providerId: text("provider_id"),
  twoFactorSecret: text("two_factor_secret"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  email: text("email"),
  walletAddress: text("wallet_address"),
  connectedWallets: jsonb("connected_wallets"), // [{provider, address}]
  recoveryCodes: jsonb("recovery_codes"), // hashed recovery codes [{hash, salt, used}]
  premiumUntil: timestamp("premium_until"), // premium subscription expiry
  lastDailyClaim: timestamp("last_daily_claim"),
  // Membership tier system
  tier: text("tier").notNull().default("free"), // free | bronze | silver | gold | platinum
  tierExpiresAt: timestamp("tier_expires_at"), // null for free tier
  // KYC verification
  kycStatus: text("kyc_status").notNull().default("none"), // none | pending | verified | rejected
  kycData: jsonb("kyc_data"), // { fullName, dateOfBirth, country, idType, submittedAt }
  kycVerifiedAt: timestamp("kyc_verified_at"),
  kycRejectionReason: text("kyc_rejection_reason"),
  // Blockchain member ID
  memberId: text("member_id").unique(), // HR-XXXXXXXX format
  kycBlockchainTxHash: text("kyc_blockchain_tx_hash"),
  // Responsible gambling fields
  selfExcludedUntil: timestamp("self_excluded_until"),
  depositLimitDaily: integer("deposit_limit_daily").notNull().default(0),
  depositLimitWeekly: integer("deposit_limit_weekly").notNull().default(0),
  depositLimitMonthly: integer("deposit_limit_monthly").notNull().default(0),
  sessionTimeLimitMinutes: integer("session_time_limit_minutes").notNull().default(0),
  lossLimitDaily: integer("loss_limit_daily").notNull().default(0),
  coolOffUntil: timestamp("cool_off_until"),
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
  timezone: text("timezone").notNull().default("UTC"),
  language: text("language").notNull().default("en"),
  rakePercent: integer("rake_percent").notNull().default(5),
  maxBuyInCap: integer("max_buy_in_cap").notNull().default(0),
  creditLimit: integer("credit_limit").notNull().default(0),
  require2fa: boolean("require_2fa").notNull().default(false),
  adminApprovalRequired: boolean("admin_approval_required").notNull().default(false),
  antiCollusion: boolean("anti_collusion").notNull().default(false),
  themeColor: text("theme_color").notNull().default("gold"),
  eloRating: integer("elo_rating").notNull().default(1200),
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
  tableId: varchar("table_id"), // FK to tables.id added at DB level (forward ref)
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
  straddleEnabled: boolean("straddle_enabled").notNull().default(false),
  bigBlindAnte: boolean("big_blind_ante").notNull().default(false),
  gameSpeed: text("game_speed").notNull().default("normal"), // normal | fast | turbo
  showAllHands: boolean("show_all_hands").notNull().default(true), // reveal all cards at showdown (false = winner only)
  // Extended settings (PokerNow parity)
  runItTwice: text("run_it_twice").notNull().default("ask"), // "always" | "ask" | "no"
  showdownSpeed: text("showdown_speed").notNull().default("normal"), // "fast" | "normal" | "slow"
  dealToAwayPlayers: boolean("deal_to_away_players").notNull().default(false),
  timeBankRefillHands: integer("time_bank_refill_hands").notNull().default(0), // 0 = no refill
  spectatorMode: boolean("spectator_mode").notNull().default(true),
  doubleBoard: boolean("double_board").notNull().default(false),
  sevenTwoBounty: integer("seven_two_bounty").notNull().default(0), // 0 = disabled, else chips/player
  guestChatEnabled: boolean("guest_chat_enabled").notNull().default(true),
  autoTrimExcessBets: boolean("auto_trim_excess_bets").notNull().default(false),
  pokerVariant: text("poker_variant").notNull().default("nlhe"),
  useCentsValues: boolean("use_cents_values").notNull().default(false),
  // Table management
  awayTimeoutMinutes: integer("away_timeout_minutes").notNull().default(5), // 1-60 min
  requireAdminApproval: boolean("require_admin_approval").notNull().default(false),
  allowSpectators: boolean("allow_spectators").notNull().default(true),
  clubMembersOnly: boolean("club_members_only").notNull().default(false),
  inviteCode: varchar("invite_code", { length: 8 }).unique(),
  scheduledStartTime: timestamp("scheduled_start_time"),
  scheduledEndTime: timestamp("scheduled_end_time"),
  recurringSchedule: jsonb("recurring_schedule"), // { days: string[], startTime: "HH:MM", endTime: "HH:MM" }
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("tables_club_idx").on(table.clubId),
]);

export const insertTableSchema = z.object({
  name: z.string().min(1).max(50),
  maxPlayers: z.number().int().min(2).max(10).default(6),
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
  straddleEnabled: z.boolean().default(false),
  gameSpeed: z.enum(["normal", "fast", "turbo"]).default("normal"),
  showAllHands: z.boolean().default(true),
  runItTwice: z.enum(["always", "ask", "no"]).default("ask"),
  showdownSpeed: z.enum(["fast", "normal", "slow"]).default("normal"),
  dealToAwayPlayers: z.boolean().default(false),
  timeBankRefillHands: z.number().int().min(0).default(0),
  spectatorMode: z.boolean().default(true),
  doubleBoard: z.boolean().default(false),
  sevenTwoBounty: z.number().int().min(0).default(0),
  guestChatEnabled: z.boolean().default(true),
  autoTrimExcessBets: z.boolean().default(false),
  pokerVariant: z.enum(["nlhe", "plo", "plo5", "short_deck"]).default("nlhe"),
  useCentsValues: z.boolean().default(false),
  requireAdminApproval: z.boolean().default(false),
  allowSpectators: z.boolean().default(true),
  clubMembersOnly: z.boolean().default(false),
  awayTimeoutMinutes: z.number().int().min(1).max(60).default(5),
  scheduledStartTime: z.string().datetime().optional(),
  scheduledEndTime: z.string().datetime().optional(),
  recurringSchedule: z.object({
    days: z.array(z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])).min(1),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
  }).optional(),
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
  userId: varchar("user_id").notNull().references(() => users.id),
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
  playerId: varchar("player_id").notNull().references(() => users.id),
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

// ─── Wallet Types ────────────────────────────────────────────────────────────
export const walletTypeEnum = ["main", "cash_game", "sng", "tournament", "bonus"] as const;
export type WalletType = typeof walletTypeEnum[number];

// ─── Wallets ─────────────────────────────────────────────────────────────────
export const wallets = pgTable("wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  walletType: text("wallet_type").notNull(), // main | cash_game | sng | tournament | bonus
  balance: integer("balance").notNull().default(0),
  isLocked: boolean("is_locked").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("wallets_user_idx").on(table.userId),
  uniqueIndex("wallets_user_type_idx").on(table.userId, table.walletType),
]);

export type Wallet = typeof wallets.$inferSelect;

// ─── Transactions ────────────────────────────────────────────────────────────
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // deposit | withdraw | buyin | cashout | bonus | rake | prize | transfer | rakeback | purchase | refund
  amount: integer("amount").notNull(),
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  tableId: varchar("table_id"),
  description: text("description"),
  walletType: text("wallet_type"), // which wallet this transaction affects
  relatedTransactionId: varchar("related_transaction_id"), // links transfer pairs
  paymentId: varchar("payment_id"), // link to payments table
  metadata: jsonb("metadata"), // flexible: allocation splits, exchange rates, etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("transactions_user_idx").on(table.userId),
  index("transactions_wallet_type_idx").on(table.userId, table.walletType),
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
  pokerVariant: text("poker_variant").notNull().default("nlhe"), // nlhe | plo | plo5 | short_deck
  startAt: timestamp("start_at"),
  registrationFee: integer("registration_fee").notNull().default(0),
  lateRegistration: boolean("late_registration").notNull().default(false),
  payoutStructureType: text("payout_structure_type").notNull().default("top_15"), // top_15 | top_10 | top_20 | winner_take_all
  guaranteedPrize: integer("guaranteed_prize").notNull().default(0),
  adminFeePercent: integer("admin_fee_percent").notNull().default(0),
  timeBankSeconds: integer("time_bank_seconds").notNull().default(30),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("tournaments_club_idx").on(table.clubId),
]);

export type Tournament = typeof tournaments.$inferSelect;

export const createTournamentSchema = z.object({
  name: z.string().min(1).max(100).transform(s => s.trim()),
  clubId: z.string().optional(),
  buyIn: z.number().int().min(0).default(100),
  startingChips: z.number().int().min(100).default(1500),
  maxPlayers: z.number().int().min(2).max(1000).default(50),
  pokerVariant: z.enum(["nlhe", "plo", "plo5", "short_deck"]).default("nlhe"),
  startAt: z.string().optional(),
  blindSchedule: z.array(z.object({
    level: z.number(),
    sb: z.number(),
    bb: z.number(),
    ante: z.number().default(0),
    durationSeconds: z.number(),
  })).optional(),
  payoutStructure: z.array(z.object({
    place: z.number(),
    percentage: z.number(),
  })).optional(),
  registrationFee: z.number().int().min(0).default(0),
  lateRegistration: z.boolean().default(false),
  payoutStructureType: z.enum(["top_15", "top_10", "top_20", "winner_take_all"]).default("top_15"),
  guaranteedPrize: z.number().int().min(0).default(0),
  adminFeePercent: z.number().int().min(0).max(100).default(0),
  timeBankSeconds: z.number().int().min(0).default(30),
});

// ─── Tournament Registrations ───────────────────────────────────────────────
export const tournamentRegistrations = pgTable("tournament_registrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tournamentId: varchar("tournament_id").notNull().references(() => tournaments.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  status: text("status").notNull().default("registered"), // registered | playing | eliminated | winner
  finishPlace: integer("finish_place"),
  prizeAmount: integer("prize_amount").default(0),
  registeredAt: timestamp("registered_at").notNull().defaultNow(),
}, (table) => [
  index("tournament_reg_tournament_idx").on(table.tournamentId),
  index("tournament_reg_user_idx").on(table.userId),
  uniqueIndex("tournament_reg_unique").on(table.tournamentId, table.userId),
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
  bluffWins: integer("bluff_wins").notNull().default(0),
  ploHands: integer("plo_hands").notNull().default(0),
  bigPotWins: integer("big_pot_wins").notNull().default(0),
  preflopFolds: integer("preflop_folds").notNull().default(0),
  tournamentHands: integer("tournament_hands").notNull().default(0),
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
  baselineValue: integer("baseline_value").notNull().default(0),
}, (table) => [
  index("user_missions_user_idx").on(table.userId),
  index("user_missions_mission_idx").on(table.missionId),
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

// ─── Wishlists ──────────────────────────────────────────────────────────────
export const wishlists = pgTable("wishlists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  itemId: varchar("item_id").notNull().references(() => shopItems.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("wishlists_user_item_idx").on(table.userId, table.itemId),
  index("wishlists_user_idx").on(table.userId),
]);

export type WishlistEntry = typeof wishlists.$inferSelect;

// ─── Club Alliances ─────────────────────────────────────────────────────────
export const clubAlliances = pgTable("club_alliances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  clubIds: jsonb("club_ids").notNull(), // string[]
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ClubAlliance = typeof clubAlliances.$inferSelect;

export const createAllianceSchema = z.object({
  name: z.string().min(1).max(100).transform(s => s.trim()),
  clubId: z.string().min(1),
});

export const updateAllianceSchema = z.object({
  name: z.string().min(1).max(100).transform(s => s.trim()),
});

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

export const createLeagueSeasonSchema = z.object({
  name: z.string().min(1).max(100).transform(s => s.trim()),
  startDate: z.string().refine(d => !isNaN(Date.parse(d)), { message: "Invalid start date" }),
  endDate: z.string().refine(d => !isNaN(Date.parse(d)), { message: "Invalid end date" }),
});

export const updateLeagueSeasonSchema = z.object({
  name: z.string().min(1).max(100).transform(s => s.trim()).optional(),
  startDate: z.string().refine(d => !isNaN(Date.parse(d)), { message: "Invalid start date" }).optional(),
  endDate: z.string().refine(d => !isNaN(Date.parse(d)), { message: "Invalid end date" }).optional(),
});

export const leagueStandingsSchema = z.object({
  standings: z.array(z.object({
    clubId: z.string().min(1),
    points: z.number().int().min(0).default(0),
    wins: z.number().int().min(0).default(0),
    losses: z.number().int().min(0).default(0),
  })).min(1, { message: "At least one standing entry is required" }),
});

// ─── Payments ───────────────────────────────────────────────────────────────
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  direction: text("direction").notNull(), // deposit | withdrawal
  status: text("status").notNull().default("pending"), // pending | confirming | confirmed | credited | failed | expired
  amountFiat: integer("amount_fiat").notNull(), // in USD cents
  amountCrypto: text("amount_crypto"), // string for precision (e.g., "0.00234500")
  currency: text("currency").notNull(), // USD | BTC | ETH | USDT | SOL
  exchangeRate: text("exchange_rate"), // rate at time of transaction
  chipAmount: integer("chip_amount").notNull(), // final chip credit/debit amount
  allocation: jsonb("allocation"), // [{walletType: "cash_game", amount: 6000}, ...]
  gatewayProvider: text("gateway_provider"), // nowpayments | coinpayments | direct
  gatewayPaymentId: text("gateway_payment_id"),
  gatewayData: jsonb("gateway_data"), // raw response from gateway
  depositAddress: text("deposit_address"), // crypto address to pay to
  txHash: text("tx_hash"), // blockchain transaction hash
  confirmations: integer("confirmations").default(0),
  requiredConfirmations: integer("required_confirmations").default(1),
  withdrawalAddress: text("withdrawal_address"), // player's withdrawal address
  confirmedAt: timestamp("confirmed_at"),
  creditedAt: timestamp("credited_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("payments_user_idx").on(table.userId),
  index("payments_status_idx").on(table.status),
  index("payments_gateway_idx").on(table.gatewayProvider, table.gatewayPaymentId),
]);

export type Payment = typeof payments.$inferSelect;

// ─── Withdrawal Requests ────────────────────────────────────────────────────
export const withdrawalRequests = pgTable("withdrawal_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  paymentId: varchar("payment_id").references(() => payments.id),
  amount: integer("amount").notNull(), // chips to withdraw
  amountFiat: integer("amount_fiat"), // USD cents equivalent
  currency: text("currency").notNull().default("USDT"),
  withdrawalAddress: text("withdrawal_address").notNull(),
  status: text("status").notNull().default("pending"), // pending | processing | completed | failed | cancelled
  reviewedBy: varchar("reviewed_by"), // admin user ID
  reviewNote: text("review_note"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("withdrawal_requests_user_idx").on(table.userId),
  index("withdrawal_requests_status_idx").on(table.status),
]);

export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;

// ─── Supported Currencies ───────────────────────────────────────────────────
export const supportedCurrencies = pgTable("supported_currencies", {
  id: varchar("id").primaryKey(), // BTC, ETH, USDT, SOL
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  network: text("network"), // ERC20, TRC20, SOL, BTC
  minDeposit: text("min_deposit").notNull(),
  minWithdrawal: text("min_withdrawal").notNull(),
  confirmationsRequired: integer("confirmations_required").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export type SupportedCurrency = typeof supportedCurrencies.$inferSelect;

// ─── Validation Schemas for Wallet Operations ───────────────────────────────
export const walletTransferSchema = z.object({
  from: z.enum(walletTypeEnum),
  to: z.enum(walletTypeEnum),
  amount: z.number().int().min(1),
});

export const depositAllocationSchema = z.object({
  walletType: z.enum(walletTypeEnum),
  amount: z.number().int().min(0),
});

export const initiateDepositSchema = z.object({
  amount: z.number().int().min(100), // min $1.00 in cents
  currency: z.string().min(1),
  gateway: z.enum(["nowpayments", "coinpayments", "direct"]),
  allocation: z.array(depositAllocationSchema).min(1),
});

export const initiateWithdrawalSchema = z.object({
  amount: z.number().int().min(1), // chips
  currency: z.string().min(1),
  address: z.string().min(10),
});

// ─── Chat Messages ─────────────────────────────────────────────────────────
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tableId: varchar("table_id").notNull().references(() => tables.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  username: text("username").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("chat_messages_table_idx").on(table.tableId),
]);

export type ChatMessage = typeof chatMessages.$inferSelect;

// ─── Collusion Alerts ──────────────────────────────────────────────────────
export const collusionAlerts = pgTable("collusion_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tableId: varchar("table_id").notNull(),
  player1Id: varchar("player1_id").notNull(),
  player2Id: varchar("player2_id").notNull(),
  alertType: text("alert_type").notNull(),
  severity: text("severity").notNull(), // low | medium | high
  details: jsonb("details"),
  status: text("status").notNull().default("pending"), // pending | reviewed | dismissed
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("collusion_alerts_status_idx").on(table.status),
  index("collusion_alerts_table_idx").on(table.tableId),
]);

export type CollusionAlert = typeof collusionAlerts.$inferSelect;

// ─── Player Notes ──────────────────────────────────────────────────────────
export const playerNotes = pgTable("player_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  authorUserId: varchar("author_user_id").notNull().references(() => users.id),
  targetUserId: varchar("target_user_id").notNull().references(() => users.id),
  note: text("note").notNull(),
  color: text("color").notNull().default("gray"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("player_notes_unique").on(table.authorUserId, table.targetUserId),
  index("player_notes_author_idx").on(table.authorUserId),
]);

export type PlayerNote = typeof playerNotes.$inferSelect;

// ─── Club Challenges ──────────────────────────────────────────────────────
export const clubChallenges = pgTable("club_challenges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clubId: varchar("club_id").notNull().references(() => clubs.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  targetValue: integer("target_value").notNull(),
  currentValue: integer("current_value").notNull().default(0),
  rewardChips: integer("reward_chips").notNull().default(0),
  rewardDescription: text("reward_description"),
  type: text("type").notNull(), // hands_played, tournaments_won, members_active, pots_won, total_chips_won
  expiresAt: timestamp("expires_at").notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("club_challenges_club_idx").on(table.clubId),
]);

export type ClubChallenge = typeof clubChallenges.$inferSelect;

// ─── Notifications ────────────────────────────────────────────────────────
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // tournament_starting, leaderboard_change, club_announcement, friend_playing, challenge_complete
  title: text("title").notNull(),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  metadata: jsonb("metadata"), // optional extra data (clubId, tournamentId, etc.)
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("notifications_user_idx").on(table.userId),
  index("notifications_user_read_idx").on(table.userId, table.read),
]);

export type Notification = typeof notifications.$inferSelect;

// ─── Club Wars ───────────────────────────────────────────────────────────
export const clubWars = pgTable("club_wars", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  club1Id: varchar("club1_id").notNull().references(() => clubs.id),
  club2Id: varchar("club2_id").notNull().references(() => clubs.id),
  club1Name: text("club1_name").notNull(),
  club2Name: text("club2_name").notNull(),
  status: text("status").notNull().default("pending"), // pending, active, completed
  winnerId: varchar("winner_id"),
  club1Score: integer("club1_score").notNull().default(0),
  club2Score: integer("club2_score").notNull().default(0),
  club1Elo: integer("club1_elo"),
  club2Elo: integer("club2_elo"),
  eloChange: integer("elo_change"),
  scheduledAt: timestamp("scheduled_at").notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ClubWar = typeof clubWars.$inferSelect;

// ─── Marketplace Listings ────────────────────────────────────────────────────
export const marketplaceListings = pgTable("marketplace_listings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sellerId: varchar("seller_id").notNull().references(() => users.id),
  itemId: varchar("item_id").notNull().references(() => shopItems.id),
  price: integer("price").notNull(),
  status: text("status").notNull().default("active"), // active, sold, cancelled
  buyerId: varchar("buyer_id").references(() => users.id),
  platformFee: integer("platform_fee"), // 10% cut
  createdAt: timestamp("created_at").notNull().defaultNow(),
  soldAt: timestamp("sold_at"),
}, (table) => [
  index("marketplace_listings_status_idx").on(table.status),
  index("marketplace_listings_seller_idx").on(table.sellerId),
]);

export type MarketplaceListing = typeof marketplaceListings.$inferSelect;

// ─── Stakes ─────────────────────────────────────────────────────────────────
export const stakes = pgTable("stakes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  backerId: varchar("backer_id").notNull().references(() => users.id),
  playerId: varchar("player_id").notNull().references(() => users.id),
  tournamentId: varchar("tournament_id").notNull().references(() => tournaments.id),
  stakePercent: integer("stake_percent").notNull(),
  buyInShare: integer("buy_in_share").notNull(),
  status: text("status").notNull().default("pending"), // pending, accepted, active, settled, cancelled
  payout: integer("payout"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("stakes_backer_idx").on(table.backerId),
  index("stakes_player_idx").on(table.playerId),
]);

export type Stake = typeof stakes.$inferSelect;

// ─── API Keys ───────────────────────────────────────────────────────────────
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  keyHash: text("key_hash").notNull(), // SHA-256 hash of the actual key
  name: text("name").notNull(), // user-given label
  lastUsed: timestamp("last_used"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("api_keys_user_idx").on(table.userId),
  index("api_keys_hash_idx").on(table.keyHash),
]);

export type ApiKey = typeof apiKeys.$inferSelect;

// ─── Support Tickets ──────────────────────────────────────────────────────
export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("open"), // open | in-progress | resolved | closed
  priority: text("priority").notNull().default("medium"), // low | medium | high | urgent
  category: text("category").notNull().default("other"), // account | payment | game | technical | other
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
}, (table) => [
  index("support_tickets_user_idx").on(table.userId),
  index("support_tickets_status_idx").on(table.status),
]);

export type SupportTicket = typeof supportTickets.$inferSelect;

// ─── Ticket Messages ──────────────────────────────────────────────────────
export const ticketMessages = pgTable("ticket_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => supportTickets.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  isStaff: boolean("is_staff").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("ticket_messages_ticket_idx").on(table.ticketId),
]);

export type TicketMessage = typeof ticketMessages.$inferSelect;
