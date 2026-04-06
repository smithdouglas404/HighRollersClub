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

    // Users table — KYC + tier columns
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_level TEXT NOT NULL DEFAULT 'none'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS tier_plan TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_streak_days INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_last_play_date TEXT`,

    // Users table — loyalty program columns
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_points INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_level INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_multiplier NUMERIC(3,1) NOT NULL DEFAULT 1.0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_login_streak INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_reward_at TIMESTAMP`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by VARCHAR`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR`,

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

    // Shop Items — earnable_at_level column
    `ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS earnable_at_level INTEGER`,

    // Achievements table
    `CREATE TABLE IF NOT EXISTS achievements (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      requirement_type TEXT NOT NULL,
      requirement_value INTEGER NOT NULL,
      hrp_reward INTEGER NOT NULL,
      chip_reward INTEGER NOT NULL DEFAULT 0,
      badge_image_url TEXT,
      rarity TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // User Achievements table
    `CREATE TABLE IF NOT EXISTS user_achievements (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR NOT NULL REFERENCES users(id),
      achievement_id VARCHAR NOT NULL REFERENCES achievements(id),
      progress INTEGER NOT NULL DEFAULT 0,
      unlocked_at TIMESTAMP,
      claimed_at TIMESTAMP,
      UNIQUE(user_id, achievement_id)
    )`,
    `CREATE INDEX IF NOT EXISTS user_achievements_user_idx ON user_achievements(user_id)`,
    `CREATE INDEX IF NOT EXISTS user_achievements_achievement_idx ON user_achievements(achievement_id)`,

    // Battle Passes table
    `CREATE TABLE IF NOT EXISTS battle_passes (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      season_number INTEGER NOT NULL,
      starts_at TIMESTAMP NOT NULL,
      ends_at TIMESTAMP NOT NULL,
      premium_price_chips INTEGER NOT NULL DEFAULT 10000,
      premium_price_usd INTEGER NOT NULL DEFAULT 999,
      max_level INTEGER NOT NULL DEFAULT 50,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // Battle Pass Rewards table
    `CREATE TABLE IF NOT EXISTS battle_pass_rewards (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      battle_pass_id VARCHAR NOT NULL REFERENCES battle_passes(id),
      level INTEGER NOT NULL,
      track TEXT NOT NULL,
      reward_type TEXT NOT NULL,
      reward_value INTEGER NOT NULL,
      reward_item_id VARCHAR REFERENCES shop_items(id),
      description TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // User Battle Passes table
    `CREATE TABLE IF NOT EXISTS user_battle_passes (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR NOT NULL REFERENCES users(id),
      battle_pass_id VARCHAR NOT NULL REFERENCES battle_passes(id),
      current_level INTEGER NOT NULL DEFAULT 0,
      hrp_earned_this_season INTEGER NOT NULL DEFAULT 0,
      is_premium BOOLEAN NOT NULL DEFAULT false,
      premium_purchased_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, battle_pass_id)
    )`,
    `CREATE INDEX IF NOT EXISTS user_battle_passes_user_idx ON user_battle_passes(user_id)`,
    `CREATE INDEX IF NOT EXISTS user_battle_passes_bp_idx ON user_battle_passes(battle_pass_id)`,

    // Daily Login Rewards table
    `CREATE TABLE IF NOT EXISTS daily_login_rewards (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      day_number INTEGER NOT NULL,
      chip_reward INTEGER NOT NULL,
      hrp_reward INTEGER NOT NULL,
      item_reward_type TEXT,
      item_reward_rarity TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // Referrals table
    `CREATE TABLE IF NOT EXISTS referrals (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      referrer_id VARCHAR NOT NULL REFERENCES users(id),
      referred_id VARCHAR NOT NULL REFERENCES users(id),
      milestone TEXT NOT NULL,
      referrer_hrp_reward INTEGER NOT NULL,
      referrer_chip_reward INTEGER NOT NULL,
      referred_hrp_reward INTEGER NOT NULL,
      referred_chip_reward INTEGER NOT NULL,
      completed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON referrals(referrer_id)`,
    `CREATE INDEX IF NOT EXISTS referrals_referred_idx ON referrals(referred_id)`,

    // HRP Transactions table (audit log)
    `CREATE TABLE IF NOT EXISTS hrp_transactions (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR NOT NULL REFERENCES users(id),
      amount INTEGER NOT NULL,
      source TEXT NOT NULL,
      description TEXT,
      balance_after INTEGER NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS hrp_transactions_user_idx ON hrp_transactions(user_id)`,
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
