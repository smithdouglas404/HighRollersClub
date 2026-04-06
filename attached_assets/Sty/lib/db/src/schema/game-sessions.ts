import { pgTable, serial, text, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { pokerTablesTable } from "./tables";
import { usersTable } from "./users";

export const gameSessionsTable = pgTable("game_sessions", {
  id: serial("id").primaryKey(),
  tableId: integer("table_id").notNull().references(() => pokerTablesTable.id),
  phase: text("phase").notNull().default("waiting"),
  pot: integer("pot").notNull().default(0),
  dealerSeat: integer("dealer_seat").notNull().default(0),
  currentSeat: integer("current_seat"),
  communityCards: jsonb("community_cards").notNull().default([]),
  deckState: text("deck_state"),
  handNumber: integer("hand_number").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type GameSession = typeof gameSessionsTable.$inferSelect;

export const gamePlayersTable = pgTable("game_players", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => gameSessionsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  seatIndex: integer("seat_index").notNull(),
  chips: integer("chips").notNull(),
  currentBet: integer("current_bet").notNull().default(0),
  holeCards: jsonb("hole_cards"),
  status: text("status").notNull().default("waiting"),
  isDealer: boolean("is_dealer").notNull().default(false),
  lastAction: text("last_action"),
  lastActionAmount: integer("last_action_amount"),
});

export type GamePlayer = typeof gamePlayersTable.$inferSelect;

export const handHistoryTable = pgTable("hand_history", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => gameSessionsTable.id),
  tableId: integer("table_id").notNull().references(() => pokerTablesTable.id),
  handNumber: integer("hand_number").notNull(),
  actions: jsonb("actions").notNull().default([]),
  communityCards: jsonb("community_cards"),
  potTotal: integer("pot_total"),
  winnerId: integer("winner_id").references(() => usersTable.id),
  winnerHand: text("winner_hand"),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
});

export type HandHistory = typeof handHistoryTable.$inferSelect;
