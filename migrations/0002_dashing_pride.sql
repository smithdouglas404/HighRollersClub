CREATE TABLE "achievements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"requirement_type" text NOT NULL,
	"requirement_value" integer NOT NULL,
	"hrp_reward" integer NOT NULL,
	"chip_reward" integer DEFAULT 0 NOT NULL,
	"badge_image_url" text,
	"rarity" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "achievements_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "battle_pass_rewards" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"battle_pass_id" varchar NOT NULL,
	"level" integer NOT NULL,
	"track" text NOT NULL,
	"reward_type" text NOT NULL,
	"reward_value" integer NOT NULL,
	"reward_item_id" varchar,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "battle_passes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"season_number" integer NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"premium_price_chips" integer DEFAULT 10000 NOT NULL,
	"premium_price_usd" integer DEFAULT 999 NOT NULL,
	"max_level" integer DEFAULT 50 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_login_rewards" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day_number" integer NOT NULL,
	"chip_reward" integer NOT NULL,
	"hrp_reward" integer NOT NULL,
	"item_reward_type" text,
	"item_reward_rarity" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hrp_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"amount" integer NOT NULL,
	"source" text NOT NULL,
	"description" text,
	"balance_after" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"multiplier_x100" integer DEFAULT 100 NOT NULL,
	"base_amount" integer NOT NULL,
	"new_total" integer NOT NULL,
	"new_level" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_id" varchar NOT NULL,
	"referred_id" varchar NOT NULL,
	"milestone" text NOT NULL,
	"referrer_hrp_reward" integer NOT NULL,
	"referrer_chip_reward" integer NOT NULL,
	"referred_hrp_reward" integer NOT NULL,
	"referred_chip_reward" integer NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"achievement_id" varchar NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"unlocked_at" timestamp,
	"claimed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_battle_passes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"battle_pass_id" varchar NOT NULL,
	"current_level" integer DEFAULT 0 NOT NULL,
	"hrp_earned_this_season" integer DEFAULT 0 NOT NULL,
	"is_premium" boolean DEFAULT false NOT NULL,
	"premium_purchased_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shop_items" ADD COLUMN "earnable_at_level" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "kyc_level" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "loyalty_points" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "loyalty_level" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "loyalty_multiplier" numeric(3, 1) DEFAULT '1.0' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "daily_login_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_reward_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referred_by" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referral_code" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "loyalty_streak_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "loyalty_last_play_date" text;--> statement-breakpoint
ALTER TABLE "battle_pass_rewards" ADD CONSTRAINT "battle_pass_rewards_battle_pass_id_battle_passes_id_fk" FOREIGN KEY ("battle_pass_id") REFERENCES "public"."battle_passes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_pass_rewards" ADD CONSTRAINT "battle_pass_rewards_reward_item_id_shop_items_id_fk" FOREIGN KEY ("reward_item_id") REFERENCES "public"."shop_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_messages" ADD CONSTRAINT "club_messages_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_messages" ADD CONSTRAINT "club_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hrp_transactions" ADD CONSTRAINT "hrp_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_logs" ADD CONSTRAINT "loyalty_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_id_users_id_fk" FOREIGN KEY ("referred_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_battle_passes" ADD CONSTRAINT "user_battle_passes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_battle_passes" ADD CONSTRAINT "user_battle_passes_battle_pass_id_battle_passes_id_fk" FOREIGN KEY ("battle_pass_id") REFERENCES "public"."battle_passes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_club_messages_club" ON "club_messages" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "idx_club_messages_created" ON "club_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "hrp_transactions_user_idx" ON "hrp_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_loyalty_logs_user" ON "loyalty_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_loyalty_logs_created" ON "loyalty_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "referrals_referrer_idx" ON "referrals" USING btree ("referrer_id");--> statement-breakpoint
CREATE INDEX "referrals_referred_idx" ON "referrals" USING btree ("referred_id");--> statement-breakpoint
CREATE INDEX "user_achievements_user_idx" ON "user_achievements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_achievements_achievement_idx" ON "user_achievements" USING btree ("achievement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_achievements_unique" ON "user_achievements" USING btree ("user_id","achievement_id");--> statement-breakpoint
CREATE INDEX "user_battle_passes_user_idx" ON "user_battle_passes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_battle_passes_bp_idx" ON "user_battle_passes" USING btree ("battle_pass_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_battle_passes_unique" ON "user_battle_passes" USING btree ("user_id","battle_pass_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code");