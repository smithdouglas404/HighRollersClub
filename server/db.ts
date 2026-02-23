import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const databaseUrl = process.env.DATABASE_URL;

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let pool: pg.Pool | null = null;

export function getDb() {
  if (!db) {
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = new pg.Pool({ connectionString: databaseUrl });
    db = drizzle(pool, { schema });
  }
  return db;
}

export function getPool() {
  if (!pool) {
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = new pg.Pool({ connectionString: databaseUrl });
  }
  return pool;
}

export function hasDatabase(): boolean {
  return !!databaseUrl;
}

export type Database = ReturnType<typeof getDb>;
