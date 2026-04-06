import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tournamentsTable = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  gameType: text("game_type").notNull().default("texas_holdem"),
  buyIn: integer("buy_in").notNull(),
  prizePool: integer("prize_pool"),
  maxPlayers: integer("max_players").notNull(),
  registeredPlayers: integer("registered_players").notNull().default(0),
  startTime: timestamp("start_time"),
  status: text("status").notNull().default("registration"),
  blindStructure: text("blind_structure"),
  startingChips: integer("starting_chips"),
  levels: integer("levels"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTournamentSchema = createInsertSchema(tournamentsTable).omit({ id: true, createdAt: true, registeredPlayers: true });
export type InsertTournament = z.infer<typeof insertTournamentSchema>;
export type Tournament = typeof tournamentsTable.$inferSelect;
