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

/**
 * Auto-migrate: Add any missing columns to existing tables.
 * This handles the case where schema.ts has new columns but the DB hasn't been migrated.
 * Safe to run multiple times — uses IF NOT EXISTS / catches already-exists errors.
 */
export async function autoMigrate(): Promise<void> {
  if (!databaseUrl) return;

  const p = getPool();

  const migrations = [
    // Users table — new columns (some may have been added by Drizzle, some manually)
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS connected_wallets JSONB`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_codes JSONB`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_until TIMESTAMP`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_daily_claim TIMESTAMP`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS tier_expires_at TIMESTAMP`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'none'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_data JSONB`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMP`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_rejection_reason TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS member_id TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_blockchain_tx_hash TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS self_excluded_until TIMESTAMP`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS deposit_limit_daily INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS deposit_limit_weekly INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS deposit_limit_monthly INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS session_time_limit_minutes INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS loss_limit_daily INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS cool_off_until TIMESTAMP`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_address TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS taunt_voice TEXT DEFAULT 'default'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token TEXT`,

    // Clubs table — geofence columns
    `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS allowed_countries JSONB`,
    `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS allowed_states JSONB`,
    `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS block_vpn BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS kyc_required TEXT NOT NULL DEFAULT 'none'`,

    // Tables table — geofence columns
    `ALTER TABLE tables ADD COLUMN IF NOT EXISTS allowed_countries JSONB`,
    `ALTER TABLE tables ADD COLUMN IF NOT EXISTS allowed_states JSONB`,
    `ALTER TABLE tables ADD COLUMN IF NOT EXISTS block_vpn BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE tables ADD COLUMN IF NOT EXISTS kyc_required TEXT`,

    // IP Rules table
    `CREATE TABLE IF NOT EXISTS ip_rules (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      ip TEXT NOT NULL,
      type TEXT NOT NULL,
      reason TEXT,
      created_by VARCHAR,
      expires_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // Device Fingerprints table
    `CREATE TABLE IF NOT EXISTS device_fingerprints (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR NOT NULL,
      fingerprint TEXT NOT NULL,
      user_agent TEXT,
      screen_res TEXT,
      ip_address TEXT,
      last_seen TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // Account Actions table
    `CREATE TABLE IF NOT EXISTS account_actions (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR NOT NULL,
      action TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      message TEXT NOT NULL,
      details JSONB,
      automated BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // Platform Settings table
    `CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_by VARCHAR,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // Bot Action Queue table
    `CREATE TABLE IF NOT EXISTS bot_action_queue (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      target_user_id VARCHAR,
      target_type TEXT,
      target_id VARCHAR,
      action_taken TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by VARCHAR,
      reviewed_at TIMESTAMP,
      details JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // Admin Audit Logs table
    `CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      admin_id VARCHAR NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id VARCHAR,
      details JSONB,
      ip_address TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // Music Tracks table
    `CREATE TABLE IF NOT EXISTS music_tracks (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      artist TEXT,
      filename TEXT NOT NULL,
      original_name TEXT,
      duration INTEGER,
      uploaded_by VARCHAR NOT NULL,
      is_admin BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // Table Sessions (Ledger)
    `CREATE TABLE IF NOT EXISTS table_sessions (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      table_id VARCHAR NOT NULL,
      user_id VARCHAR NOT NULL,
      display_name TEXT NOT NULL,
      buy_in_total INTEGER NOT NULL DEFAULT 0,
      cash_out_total INTEGER NOT NULL DEFAULT 0,
      net_result INTEGER NOT NULL DEFAULT 0,
      hands_played INTEGER NOT NULL DEFAULT 0,
      started_at TIMESTAMP NOT NULL DEFAULT NOW(),
      ended_at TIMESTAMP,
      settled BOOLEAN NOT NULL DEFAULT false
    )`,

    // Table Ledger Entries
    `CREATE TABLE IF NOT EXISTS table_ledger_entries (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      table_id VARCHAR NOT NULL,
      club_id VARCHAR,
      session_date TIMESTAMP NOT NULL,
      entries JSONB NOT NULL,
      settlements JSONB,
      total_rake INTEGER NOT NULL DEFAULT 0,
      total_pot INTEGER NOT NULL DEFAULT 0,
      player_count INTEGER NOT NULL DEFAULT 0,
      hands_played INTEGER NOT NULL DEFAULT 0,
      settled_by VARCHAR,
      settled_at TIMESTAMP,
      notes TEXT,
      settlement_hash TEXT,
      settlement_tx_hash TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // Sponsorship Payouts
    `CREATE TABLE IF NOT EXISTS sponsorship_payouts (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      transaction_id TEXT NOT NULL,
      club_id VARCHAR,
      recipient_user_id VARCHAR,
      recipient_wallet TEXT NOT NULL,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USDT',
      status TEXT NOT NULL DEFAULT 'pending',
      scheduled_date TIMESTAMP,
      processed_at TIMESTAMP,
      tx_hash TEXT,
      notes TEXT,
      created_by VARCHAR NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // Announcements
    `CREATE TABLE IF NOT EXISTS announcements (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      target_audience TEXT NOT NULL DEFAULT 'all',
      delivery_style TEXT NOT NULL DEFAULT 'notification',
      club_id VARCHAR,
      active BOOLEAN NOT NULL DEFAULT true,
      expires_at TIMESTAMP,
      created_by VARCHAR NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
  ];

  let migrated = 0;
  for (const sql of migrations) {
    try {
      await p.query(sql);
      migrated++;
    } catch (err: any) {
      // Ignore "already exists" errors
      if (!err.message?.includes("already exists") && !err.message?.includes("duplicate")) {
        console.warn(`[migration] Warning: ${err.message?.slice(0, 100)}`);
      }
    }
  }
  console.log(`[migration] Auto-migrate complete: ${migrated}/${migrations.length} statements executed`);
}
