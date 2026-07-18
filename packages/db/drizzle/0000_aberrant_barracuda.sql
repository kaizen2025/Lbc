CREATE SCHEMA "cardtrade";
--> statement-breakpoint
CREATE TYPE "cardtrade"."card_condition" AS ENUM('near_mint', 'excellent', 'good', 'played', 'poor');--> statement-breakpoint
CREATE TYPE "cardtrade"."card_language" AS ENUM('en', 'fr', 'ja', 'de', 'it', 'es', 'pt', 'zh', 'ko');--> statement-breakpoint
CREATE TYPE "cardtrade"."currency" AS ENUM('EUR', 'USD');--> statement-breakpoint
CREATE TYPE "cardtrade"."dispute_status" AS ENUM('open', 'resolved_refund', 'resolved_release');--> statement-breakpoint
CREATE TYPE "cardtrade"."listing_status" AS ENUM('active', 'reserved', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "cardtrade"."listing_type" AS ENUM('sale', 'trade', 'wanted');--> statement-breakpoint
CREATE TYPE "cardtrade"."market" AS ENUM('eu', 'us');--> statement-breakpoint
CREATE TYPE "cardtrade"."offer_status" AS ENUM('pending', 'accepted', 'declined', 'countered', 'withdrawn');--> statement-breakpoint
CREATE TYPE "cardtrade"."transaction_status" AS ENUM('pending_payment', 'escrowed', 'meetup_scheduled', 'completed', 'disputed', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TABLE "cardtrade"."alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"card_id" integer,
	"sealed_product_id" integer,
	"card_language" "cardtrade"."card_language",
	"max_price_cents" integer,
	"max_distance_km" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cardtrade"."cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"set_id" integer NOT NULL,
	"number" text NOT NULL,
	"name" text NOT NULL,
	"rarity" text,
	"image_url" text
);
--> statement-breakpoint
CREATE TABLE "cardtrade"."collection_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"card_id" integer,
	"sealed_product_id" integer,
	"card_language" "cardtrade"."card_language",
	"condition" "cardtrade"."card_condition",
	"is_foil" boolean DEFAULT false NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"for_sale" boolean DEFAULT false NOT NULL,
	"for_trade" boolean DEFAULT false NOT NULL,
	"acquired_price_cents" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cardtrade"."conversation_participants" (
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "conversation_participants_conversation_id_user_id_pk" PRIMARY KEY("conversation_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "cardtrade"."conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cardtrade"."disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"opened_by_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" "cardtrade"."dispute_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cardtrade"."games" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"icon_url" text,
	CONSTRAINT "games_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "cardtrade"."listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"type" "cardtrade"."listing_type" NOT NULL,
	"status" "cardtrade"."listing_status" DEFAULT 'active' NOT NULL,
	"card_id" integer,
	"sealed_product_id" integer,
	"card_language" "cardtrade"."card_language",
	"condition" "cardtrade"."card_condition",
	"is_foil" boolean DEFAULT false NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"price_cents" integer,
	"currency" "cardtrade"."currency" DEFAULT 'EUR' NOT NULL,
	"description" text,
	"photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"city" text,
	"latitude" double precision,
	"longitude" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cardtrade"."messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cardtrade"."offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"status" "cardtrade"."offer_status" DEFAULT 'pending' NOT NULL,
	"amount_cents" integer,
	"trade_item_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"message" text,
	"parent_offer_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cardtrade"."price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"card_id" integer,
	"sealed_product_id" integer,
	"card_language" "cardtrade"."card_language",
	"condition" "cardtrade"."card_condition",
	"is_foil" boolean DEFAULT false NOT NULL,
	"market" "cardtrade"."market" NOT NULL,
	"currency" "cardtrade"."currency" NOT NULL,
	"price_cents" integer NOT NULL,
	"recorded_at" date NOT NULL,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cardtrade"."profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"avatar_url" text,
	"bio" text,
	"city" text,
	"country_code" text,
	"latitude" double precision,
	"longitude" double precision,
	"search_radius_km" integer DEFAULT 25 NOT NULL,
	"spoken_languages" text[] DEFAULT '{}'::text[] NOT NULL,
	"rating_avg" double precision,
	"trade_count" integer DEFAULT 0 NOT NULL,
	"stripe_account_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "cardtrade"."reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"reviewee_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cardtrade"."sealed_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"set_id" integer NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"image_url" text
);
--> statement-breakpoint
CREATE TABLE "cardtrade"."sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"release_date" date,
	"card_count" integer
);
--> statement-breakpoint
CREATE TABLE "cardtrade"."trade_validations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"qr_token" text NOT NULL,
	"validated_at" timestamp with time zone,
	CONSTRAINT "trade_validations_qr_token_unique" UNIQUE("qr_token")
);
--> statement-breakpoint
CREATE TABLE "cardtrade"."transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"offer_id" uuid,
	"buyer_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"status" "cardtrade"."transaction_status" DEFAULT 'pending_payment' NOT NULL,
	"amount_cents" integer NOT NULL,
	"fee_cents" integer DEFAULT 100 NOT NULL,
	"currency" "cardtrade"."currency" DEFAULT 'EUR' NOT NULL,
	"stripe_payment_intent_id" text,
	"meetup_at" timestamp with time zone,
	"meetup_place" text,
	"escrowed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cardtrade"."users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "cardtrade"."alerts" ADD CONSTRAINT "alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "cardtrade"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."alerts" ADD CONSTRAINT "alerts_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "cardtrade"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."alerts" ADD CONSTRAINT "alerts_sealed_product_id_sealed_products_id_fk" FOREIGN KEY ("sealed_product_id") REFERENCES "cardtrade"."sealed_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."cards" ADD CONSTRAINT "cards_set_id_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "cardtrade"."sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."collection_items" ADD CONSTRAINT "collection_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "cardtrade"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."collection_items" ADD CONSTRAINT "collection_items_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "cardtrade"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."collection_items" ADD CONSTRAINT "collection_items_sealed_product_id_sealed_products_id_fk" FOREIGN KEY ("sealed_product_id") REFERENCES "cardtrade"."sealed_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "cardtrade"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "cardtrade"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."conversations" ADD CONSTRAINT "conversations_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "cardtrade"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."disputes" ADD CONSTRAINT "disputes_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "cardtrade"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."disputes" ADD CONSTRAINT "disputes_opened_by_id_users_id_fk" FOREIGN KEY ("opened_by_id") REFERENCES "cardtrade"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."listings" ADD CONSTRAINT "listings_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "cardtrade"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."listings" ADD CONSTRAINT "listings_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "cardtrade"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."listings" ADD CONSTRAINT "listings_sealed_product_id_sealed_products_id_fk" FOREIGN KEY ("sealed_product_id") REFERENCES "cardtrade"."sealed_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "cardtrade"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "cardtrade"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."offers" ADD CONSTRAINT "offers_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "cardtrade"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."offers" ADD CONSTRAINT "offers_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "cardtrade"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."price_history" ADD CONSTRAINT "price_history_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "cardtrade"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."price_history" ADD CONSTRAINT "price_history_sealed_product_id_sealed_products_id_fk" FOREIGN KEY ("sealed_product_id") REFERENCES "cardtrade"."sealed_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "cardtrade"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."reviews" ADD CONSTRAINT "reviews_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "cardtrade"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."reviews" ADD CONSTRAINT "reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "cardtrade"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."reviews" ADD CONSTRAINT "reviews_reviewee_id_users_id_fk" FOREIGN KEY ("reviewee_id") REFERENCES "cardtrade"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."sealed_products" ADD CONSTRAINT "sealed_products_set_id_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "cardtrade"."sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."sets" ADD CONSTRAINT "sets_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "cardtrade"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."trade_validations" ADD CONSTRAINT "trade_validations_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "cardtrade"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."trade_validations" ADD CONSTRAINT "trade_validations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "cardtrade"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."transactions" ADD CONSTRAINT "transactions_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "cardtrade"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."transactions" ADD CONSTRAINT "transactions_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "cardtrade"."offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."transactions" ADD CONSTRAINT "transactions_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "cardtrade"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardtrade"."transactions" ADD CONSTRAINT "transactions_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "cardtrade"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_user_idx" ON "cardtrade"."alerts" USING btree ("user_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "cards_set_number_uq" ON "cardtrade"."cards" USING btree ("set_id","number");--> statement-breakpoint
CREATE INDEX "cards_name_idx" ON "cardtrade"."cards" USING btree ("name");--> statement-breakpoint
CREATE INDEX "collection_user_idx" ON "cardtrade"."collection_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "listings_geo_idx" ON "cardtrade"."listings" USING btree ("latitude","longitude");--> statement-breakpoint
CREATE INDEX "listings_card_idx" ON "cardtrade"."listings" USING btree ("card_id","status");--> statement-breakpoint
CREATE INDEX "listings_seller_idx" ON "cardtrade"."listings" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "cardtrade"."messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "offers_listing_idx" ON "cardtrade"."offers" USING btree ("listing_id","status");--> statement-breakpoint
CREATE INDEX "price_lookup_idx" ON "cardtrade"."price_history" USING btree ("card_id","card_language","condition","is_foil","market","recorded_at");--> statement-breakpoint
CREATE INDEX "price_sealed_idx" ON "cardtrade"."price_history" USING btree ("sealed_product_id","market","recorded_at");--> statement-breakpoint
CREATE INDEX "profiles_geo_idx" ON "cardtrade"."profiles" USING btree ("latitude","longitude");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_tx_reviewer_uq" ON "cardtrade"."reviews" USING btree ("transaction_id","reviewer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sealed_set_name_uq" ON "cardtrade"."sealed_products" USING btree ("set_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "sets_game_code_uq" ON "cardtrade"."sets" USING btree ("game_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "validation_tx_user_uq" ON "cardtrade"."trade_validations" USING btree ("transaction_id","user_id");--> statement-breakpoint
CREATE INDEX "transactions_buyer_idx" ON "cardtrade"."transactions" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "transactions_seller_idx" ON "cardtrade"."transactions" USING btree ("seller_id");