CREATE TABLE "account_actions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"action" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"details" jsonb,
	"automated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" varchar NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" varchar,
	"details" jsonb,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"target_audience" text DEFAULT 'all' NOT NULL,
	"delivery_style" text DEFAULT 'notification' NOT NULL,
	"club_id" varchar,
	"active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot_action_queue" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"category" text NOT NULL,
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"target_user_id" varchar,
	"target_type" text,
	"target_id" varchar,
	"action_taken" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_fingerprints" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"fingerprint" text NOT NULL,
	"user_agent" text,
	"screen_res" text,
	"ip_address" text,
	"last_seen" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ip_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip" text NOT NULL,
	"type" text NOT NULL,
	"reason" text,
	"created_by" varchar,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "music_tracks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"artist" text,
	"filename" text NOT NULL,
	"original_name" text,
	"duration" integer,
	"uploaded_by" varchar NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsorship_payouts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" text NOT NULL,
	"club_id" varchar,
	"recipient_user_id" varchar,
	"recipient_wallet" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'USDT' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"scheduled_date" timestamp,
	"processed_at" timestamp,
	"tx_hash" text,
	"notes" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"subject" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "table_ledger_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" varchar NOT NULL,
	"club_id" varchar,
	"session_date" timestamp NOT NULL,
	"entries" jsonb NOT NULL,
	"settlements" jsonb,
	"total_rake" integer DEFAULT 0 NOT NULL,
	"total_pot" integer DEFAULT 0 NOT NULL,
	"player_count" integer DEFAULT 0 NOT NULL,
	"hands_played" integer DEFAULT 0 NOT NULL,
	"settled_by" varchar,
	"settled_at" timestamp,
	"notes" text,
	"settlement_hash" text,
	"settlement_tx_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "table_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"display_name" text NOT NULL,
	"buy_in_total" integer DEFAULT 0 NOT NULL,
	"cash_out_total" integer DEFAULT 0 NOT NULL,
	"net_result" integer DEFAULT 0 NOT NULL,
	"hands_played" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"settled" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"message" text NOT NULL,
	"is_staff" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "allowed_countries" jsonb;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "allowed_states" jsonb;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "block_vpn" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "kyc_required" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "allowed_countries" jsonb;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "allowed_states" jsonb;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "block_vpn" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "kyc_required" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verification_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "firebase_uid" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "tier" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "tier_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "kyc_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "kyc_data" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "kyc_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "kyc_rejection_reason" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "member_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "kyc_blockchain_tx_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "self_excluded_until" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deposit_limit_daily" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deposit_limit_weekly" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deposit_limit_monthly" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "session_time_limit_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "loss_limit_daily" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "cool_off_until" timestamp;--> statement-breakpoint
ALTER TABLE "account_actions" ADD CONSTRAINT "account_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_fingerprints" ADD CONSTRAINT "device_fingerprints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_tracks" ADD CONSTRAINT "music_tracks_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsorship_payouts" ADD CONSTRAINT "sponsorship_payouts_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsorship_payouts" ADD CONSTRAINT "sponsorship_payouts_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_ledger_entries" ADD CONSTRAINT "table_ledger_entries_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_ledger_entries" ADD CONSTRAINT "table_ledger_entries_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_account_actions_user" ON "account_actions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_account_actions_created" ON "account_actions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_admin" ON "admin_audit_logs" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "idx_audit_action" ON "admin_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_created" ON "admin_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_bot_queue_status" ON "bot_action_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bot_queue_type" ON "bot_action_queue" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_bot_queue_created" ON "bot_action_queue" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_device_fp_user" ON "device_fingerprints" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_device_fp_hash" ON "device_fingerprints" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "idx_ip_rules_ip" ON "ip_rules" USING btree ("ip");--> statement-breakpoint
CREATE INDEX "idx_ip_rules_type" ON "ip_rules" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_music_uploaded_by" ON "music_tracks" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "idx_music_is_admin" ON "music_tracks" USING btree ("is_admin");--> statement-breakpoint
CREATE INDEX "idx_sponsorship_club" ON "sponsorship_payouts" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "idx_sponsorship_status" ON "sponsorship_payouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "support_tickets_user_idx" ON "support_tickets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "support_tickets_status_idx" ON "support_tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ledger_table" ON "table_ledger_entries" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "idx_ledger_club" ON "table_ledger_entries" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "idx_ledger_date" ON "table_ledger_entries" USING btree ("session_date");--> statement-breakpoint
CREATE INDEX "idx_table_sessions_table" ON "table_sessions" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "idx_table_sessions_user" ON "table_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_table_sessions_date" ON "table_sessions" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "ticket_messages_ticket_idx" ON "ticket_messages" USING btree ("ticket_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_firebase_uid_unique" UNIQUE("firebase_uid");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_member_id_unique" UNIQUE("member_id");