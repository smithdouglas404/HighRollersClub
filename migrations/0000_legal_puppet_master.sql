CREATE TABLE "api_keys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"key_hash" text NOT NULL,
	"name" text NOT NULL,
	"last_used" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"username" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_alliances" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"club_ids" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_announcements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" varchar NOT NULL,
	"author_id" varchar NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_challenges" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"target_value" integer NOT NULL,
	"current_value" integer DEFAULT 0 NOT NULL,
	"reward_chips" integer DEFAULT 0 NOT NULL,
	"reward_description" text,
	"type" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" varchar NOT NULL,
	"event_type" text NOT NULL,
	"table_id" varchar,
	"name" text NOT NULL,
	"description" text,
	"start_time" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_invitations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text DEFAULT 'invite' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_wars" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club1_id" varchar NOT NULL,
	"club2_id" varchar NOT NULL,
	"club1_name" text NOT NULL,
	"club2_name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"winner_id" varchar,
	"club1_score" integer DEFAULT 0 NOT NULL,
	"club2_score" integer DEFAULT 0 NOT NULL,
	"club1_elo" integer,
	"club2_elo" integer,
	"elo_change" integer,
	"scheduled_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clubs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"owner_id" varchar NOT NULL,
	"avatar_url" text,
	"is_public" boolean DEFAULT true NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"rake_percent" integer DEFAULT 5 NOT NULL,
	"max_buy_in_cap" integer DEFAULT 0 NOT NULL,
	"credit_limit" integer DEFAULT 0 NOT NULL,
	"require_2fa" boolean DEFAULT false NOT NULL,
	"admin_approval_required" boolean DEFAULT false NOT NULL,
	"anti_collusion" boolean DEFAULT false NOT NULL,
	"theme_color" text DEFAULT 'gold' NOT NULL,
	"elo_rating" integer DEFAULT 1200 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collusion_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" varchar NOT NULL,
	"player1_id" varchar NOT NULL,
	"player2_id" varchar NOT NULL,
	"alert_type" text NOT NULL,
	"severity" text NOT NULL,
	"details" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_hands" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" varchar NOT NULL,
	"hand_number" integer NOT NULL,
	"dealer_seat" integer,
	"community_cards" jsonb,
	"pot_total" integer DEFAULT 0 NOT NULL,
	"total_rake" integer DEFAULT 0 NOT NULL,
	"winner_ids" jsonb,
	"summary" jsonb,
	"server_seed" text,
	"commitment_hash" text,
	"deck_order" text,
	"player_seeds" jsonb,
	"vrf_request_id" text,
	"vrf_random_word" text,
	"on_chain_commit_tx" text,
	"on_chain_reveal_tx" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hand_actions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hand_id" varchar NOT NULL,
	"player_id" varchar NOT NULL,
	"street" text NOT NULL,
	"action_type" text NOT NULL,
	"amount" integer DEFAULT 0,
	"time_spent_ms" integer,
	"sequence_num" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hand_analyses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"hand_id" varchar,
	"hole_cards" jsonb NOT NULL,
	"community_cards" jsonb,
	"pot" integer DEFAULT 0 NOT NULL,
	"position" text,
	"analysis" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hand_players" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hand_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"seat_index" integer NOT NULL,
	"hole_cards" jsonb,
	"start_stack" integer NOT NULL,
	"end_stack" integer NOT NULL,
	"net_result" integer DEFAULT 0 NOT NULL,
	"is_winner" boolean DEFAULT false NOT NULL,
	"final_action" text
);
--> statement-breakpoint
CREATE TABLE "league_seasons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"standings" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplace_listings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" varchar NOT NULL,
	"item_id" varchar NOT NULL,
	"price" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"buyer_id" varchar,
	"platform_fee" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sold_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "missions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"target" integer NOT NULL,
	"reward" integer NOT NULL,
	"period_type" text DEFAULT 'daily' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"direction" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"amount_fiat" integer NOT NULL,
	"amount_crypto" text,
	"currency" text NOT NULL,
	"exchange_rate" text,
	"chip_amount" integer NOT NULL,
	"allocation" jsonb,
	"gateway_provider" text,
	"gateway_payment_id" text,
	"gateway_data" jsonb,
	"deposit_address" text,
	"tx_hash" text,
	"confirmations" integer DEFAULT 0,
	"required_confirmations" integer DEFAULT 1,
	"withdrawal_address" text,
	"confirmed_at" timestamp,
	"credited_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_user_id" varchar NOT NULL,
	"target_user_id" varchar NOT NULL,
	"note" text NOT NULL,
	"color" text DEFAULT 'gray' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_stats" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"hands_played" integer DEFAULT 0 NOT NULL,
	"pots_won" integer DEFAULT 0 NOT NULL,
	"best_win_streak" integer DEFAULT 0 NOT NULL,
	"current_win_streak" integer DEFAULT 0 NOT NULL,
	"total_winnings" integer DEFAULT 0 NOT NULL,
	"vpip" integer DEFAULT 0 NOT NULL,
	"pfr" integer DEFAULT 0 NOT NULL,
	"showdown_count" integer DEFAULT 0 NOT NULL,
	"sng_wins" integer DEFAULT 0 NOT NULL,
	"bomb_pots_played" integer DEFAULT 0 NOT NULL,
	"heads_up_wins" integer DEFAULT 0 NOT NULL,
	"bluff_wins" integer DEFAULT 0 NOT NULL,
	"plo_hands" integer DEFAULT 0 NOT NULL,
	"big_pot_wins" integer DEFAULT 0 NOT NULL,
	"preflop_folds" integer DEFAULT 0 NOT NULL,
	"tournament_hands" integer DEFAULT 0 NOT NULL,
	"last_reset_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"rarity" text DEFAULT 'common' NOT NULL,
	"price" integer NOT NULL,
	"currency" text DEFAULT 'chips' NOT NULL,
	"image_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stakes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"backer_id" varchar NOT NULL,
	"player_id" varchar NOT NULL,
	"tournament_id" varchar NOT NULL,
	"stake_percent" integer NOT NULL,
	"buy_in_share" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payout" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supported_currencies" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"network" text,
	"min_deposit" text NOT NULL,
	"min_withdrawal" text NOT NULL,
	"confirmations_required" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "table_players" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"seat_index" integer NOT NULL,
	"chip_stack" integer NOT NULL,
	"is_connected" boolean DEFAULT true NOT NULL,
	"is_sitting_out" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tables" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" varchar,
	"name" text NOT NULL,
	"max_players" integer DEFAULT 6 NOT NULL,
	"small_blind" integer DEFAULT 10 NOT NULL,
	"big_blind" integer DEFAULT 20 NOT NULL,
	"min_buy_in" integer DEFAULT 200 NOT NULL,
	"max_buy_in" integer DEFAULT 2000 NOT NULL,
	"ante" integer DEFAULT 0 NOT NULL,
	"time_bank_seconds" integer DEFAULT 30 NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"password" text,
	"status" text DEFAULT 'waiting' NOT NULL,
	"created_by_id" varchar NOT NULL,
	"allow_bots" boolean DEFAULT true NOT NULL,
	"replace_bots" boolean DEFAULT true NOT NULL,
	"game_format" text DEFAULT 'cash' NOT NULL,
	"blind_schedule" jsonb,
	"bomb_pot_frequency" integer DEFAULT 0,
	"bomb_pot_ante" integer DEFAULT 0,
	"buy_in_amount" integer DEFAULT 0,
	"starting_chips" integer DEFAULT 1500,
	"payout_structure" jsonb,
	"tournament_id" varchar,
	"rake_percent" integer DEFAULT 0 NOT NULL,
	"rake_cap" integer DEFAULT 0 NOT NULL,
	"straddle_enabled" boolean DEFAULT false NOT NULL,
	"big_blind_ante" boolean DEFAULT false NOT NULL,
	"game_speed" text DEFAULT 'normal' NOT NULL,
	"show_all_hands" boolean DEFAULT true NOT NULL,
	"run_it_twice" text DEFAULT 'ask' NOT NULL,
	"showdown_speed" text DEFAULT 'normal' NOT NULL,
	"deal_to_away_players" boolean DEFAULT false NOT NULL,
	"time_bank_refill_hands" integer DEFAULT 0 NOT NULL,
	"spectator_mode" boolean DEFAULT true NOT NULL,
	"double_board" boolean DEFAULT false NOT NULL,
	"seven_two_bounty" integer DEFAULT 0 NOT NULL,
	"guest_chat_enabled" boolean DEFAULT true NOT NULL,
	"auto_trim_excess_bets" boolean DEFAULT false NOT NULL,
	"poker_variant" text DEFAULT 'nlhe' NOT NULL,
	"use_cents_values" boolean DEFAULT false NOT NULL,
	"away_timeout_minutes" integer DEFAULT 5 NOT NULL,
	"require_admin_approval" boolean DEFAULT false NOT NULL,
	"allow_spectators" boolean DEFAULT true NOT NULL,
	"club_members_only" boolean DEFAULT false NOT NULL,
	"invite_code" varchar(8),
	"scheduled_start_time" timestamp,
	"scheduled_end_time" timestamp,
	"recurring_schedule" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tables_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "tournament_registrations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"status" text DEFAULT 'registered' NOT NULL,
	"finish_place" integer,
	"prize_amount" integer DEFAULT 0,
	"registered_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" varchar,
	"name" text NOT NULL,
	"buy_in" integer DEFAULT 100 NOT NULL,
	"starting_chips" integer DEFAULT 1500 NOT NULL,
	"blind_schedule" jsonb,
	"max_players" integer DEFAULT 50 NOT NULL,
	"status" text DEFAULT 'registering' NOT NULL,
	"prize_pool" integer DEFAULT 0 NOT NULL,
	"created_by_id" varchar NOT NULL,
	"poker_variant" text DEFAULT 'nlhe' NOT NULL,
	"start_at" timestamp,
	"registration_fee" integer DEFAULT 0 NOT NULL,
	"late_registration" boolean DEFAULT false NOT NULL,
	"payout_structure_type" text DEFAULT 'top_15' NOT NULL,
	"guaranteed_prize" integer DEFAULT 0 NOT NULL,
	"admin_fee_percent" integer DEFAULT 0 NOT NULL,
	"time_bank_seconds" integer DEFAULT 30 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"balance_before" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"table_id" varchar,
	"description" text,
	"wallet_type" text,
	"related_transaction_id" varchar,
	"payment_id" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_inventory" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"item_id" varchar NOT NULL,
	"equipped_at" timestamp,
	"purchased_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_missions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"mission_id" varchar NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp,
	"claimed_at" timestamp,
	"period_start" timestamp DEFAULT now() NOT NULL,
	"baseline_value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"display_name" text,
	"avatar_id" text,
	"taunt_voice" text DEFAULT 'default',
	"chip_balance" integer DEFAULT 10000 NOT NULL,
	"role" text DEFAULT 'guest' NOT NULL,
	"provider" text DEFAULT 'local' NOT NULL,
	"provider_id" text,
	"two_factor_secret" text,
	"two_factor_enabled" boolean DEFAULT false,
	"email" text,
	"wallet_address" text,
	"connected_wallets" jsonb,
	"recovery_codes" jsonb,
	"premium_until" timestamp,
	"last_daily_claim" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"wallet_type" text NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wishlists" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"item_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "withdrawal_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"payment_id" varchar,
	"amount" integer NOT NULL,
	"amount_fiat" integer,
	"currency" text DEFAULT 'USDT' NOT NULL,
	"withdrawal_address" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" varchar,
	"review_note" text,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_announcements" ADD CONSTRAINT "club_announcements_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_announcements" ADD CONSTRAINT "club_announcements_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_challenges" ADD CONSTRAINT "club_challenges_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_events" ADD CONSTRAINT "club_events_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_invitations" ADD CONSTRAINT "club_invitations_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_invitations" ADD CONSTRAINT "club_invitations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_members" ADD CONSTRAINT "club_members_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_members" ADD CONSTRAINT "club_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_wars" ADD CONSTRAINT "club_wars_club1_id_clubs_id_fk" FOREIGN KEY ("club1_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_wars" ADD CONSTRAINT "club_wars_club2_id_clubs_id_fk" FOREIGN KEY ("club2_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_hands" ADD CONSTRAINT "game_hands_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hand_actions" ADD CONSTRAINT "hand_actions_hand_id_game_hands_id_fk" FOREIGN KEY ("hand_id") REFERENCES "public"."game_hands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hand_actions" ADD CONSTRAINT "hand_actions_player_id_users_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hand_analyses" ADD CONSTRAINT "hand_analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hand_players" ADD CONSTRAINT "hand_players_hand_id_game_hands_id_fk" FOREIGN KEY ("hand_id") REFERENCES "public"."game_hands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hand_players" ADD CONSTRAINT "hand_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_item_id_shop_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."shop_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_notes" ADD CONSTRAINT "player_notes_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_notes" ADD CONSTRAINT "player_notes_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stakes" ADD CONSTRAINT "stakes_backer_id_users_id_fk" FOREIGN KEY ("backer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stakes" ADD CONSTRAINT "stakes_player_id_users_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stakes" ADD CONSTRAINT "stakes_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_players" ADD CONSTRAINT "table_players_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_players" ADD CONSTRAINT "table_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_inventory" ADD CONSTRAINT "user_inventory_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_inventory" ADD CONSTRAINT "user_inventory_item_id_shop_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."shop_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_missions" ADD CONSTRAINT "user_missions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_missions" ADD CONSTRAINT "user_missions_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_item_id_shop_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."shop_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_keys_user_idx" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_keys_hash_idx" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "chat_messages_table_idx" ON "chat_messages" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "club_announcements_club_idx" ON "club_announcements" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "club_challenges_club_idx" ON "club_challenges" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "club_events_club_idx" ON "club_events" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "club_invitations_club_idx" ON "club_invitations" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "club_members_club_idx" ON "club_members" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "club_members_user_idx" ON "club_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "collusion_alerts_status_idx" ON "collusion_alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "collusion_alerts_table_idx" ON "collusion_alerts" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "game_hands_table_idx" ON "game_hands" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "hand_actions_hand_idx" ON "hand_actions" USING btree ("hand_id");--> statement-breakpoint
CREATE INDEX "hand_actions_player_idx" ON "hand_actions" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "hand_analyses_user_idx" ON "hand_analyses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "hand_players_hand_idx" ON "hand_players" USING btree ("hand_id");--> statement-breakpoint
CREATE INDEX "hand_players_user_idx" ON "hand_players" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "marketplace_listings_status_idx" ON "marketplace_listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "marketplace_listings_seller_idx" ON "marketplace_listings" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read");--> statement-breakpoint
CREATE INDEX "payments_user_idx" ON "payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_gateway_idx" ON "payments" USING btree ("gateway_provider","gateway_payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "player_notes_unique" ON "player_notes" USING btree ("author_user_id","target_user_id");--> statement-breakpoint
CREATE INDEX "player_notes_author_idx" ON "player_notes" USING btree ("author_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "player_stats_user_idx" ON "player_stats" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stakes_backer_idx" ON "stakes" USING btree ("backer_id");--> statement-breakpoint
CREATE INDEX "stakes_player_idx" ON "stakes" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "table_players_table_idx" ON "table_players" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "tables_club_idx" ON "tables" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "tournament_reg_tournament_idx" ON "tournament_registrations" USING btree ("tournament_id");--> statement-breakpoint
CREATE INDEX "tournament_reg_user_idx" ON "tournament_registrations" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_reg_unique" ON "tournament_registrations" USING btree ("tournament_id","user_id");--> statement-breakpoint
CREATE INDEX "tournaments_club_idx" ON "tournaments" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "transactions_user_idx" ON "transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transactions_wallet_type_idx" ON "transactions" USING btree ("user_id","wallet_type");--> statement-breakpoint
CREATE INDEX "user_inventory_user_idx" ON "user_inventory" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_missions_user_idx" ON "user_missions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_missions_mission_idx" ON "user_missions" USING btree ("mission_id");--> statement-breakpoint
CREATE INDEX "wallets_user_idx" ON "wallets" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_user_type_idx" ON "wallets" USING btree ("user_id","wallet_type");--> statement-breakpoint
CREATE UNIQUE INDEX "wishlists_user_item_idx" ON "wishlists" USING btree ("user_id","item_id");--> statement-breakpoint
CREATE INDEX "wishlists_user_idx" ON "wishlists" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "withdrawal_requests_user_idx" ON "withdrawal_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "withdrawal_requests_status_idx" ON "withdrawal_requests" USING btree ("status");