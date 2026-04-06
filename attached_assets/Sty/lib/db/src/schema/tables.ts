import { pgTable, serial, text, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clubsTable } from "./clubs";

export const pokerTablesTable = pgTable("poker_tables", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  gameType: text("game_type").notNull().default("texas_holdem"),
  stakes: text("stakes").notNull().default("1/2"),
  smallBlind: integer("small_blind").notNull().default(1),
  bigBlind: integer("big_blind").notNull().default(2),
  minBuyIn: integer("min_buy_in"),
  maxBuyIn: integer("max_buy_in"),
  maxPlayers: integer("max_players").notNull().default(9),
  currentPlayers: integer("current_players").notNull().default(0),
  status: text("status").notNull().default("waiting"),
  isPrivate: boolean("is_private").notNull().default(false),
  clubId: integer("club_id").references(() => clubsTable.id),
});

export const insertPokerTableSchema = createInsertSchema(pokerTablesTable).omit({ id: true, currentPlayers: true });
export type InsertPokerTable = z.infer<typeof insertPokerTableSchema>;
export type PokerTable = typeof pokerTablesTable.$inferSelect;
