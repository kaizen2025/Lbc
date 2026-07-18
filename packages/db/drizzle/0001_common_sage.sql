CREATE TYPE "cardtrade"."plan" AS ENUM('free', 'pro');--> statement-breakpoint
CREATE TYPE "cardtrade"."subscription_interval" AS ENUM('month', 'year');--> statement-breakpoint
CREATE TYPE "cardtrade"."subscription_provider" AS ENUM('stripe', 'apple', 'google');--> statement-breakpoint
CREATE TYPE "cardtrade"."subscription_status" AS ENUM('active', 'trialing', 'past_due', 'canceled');--> statement-breakpoint
CREATE TABLE "cardtrade"."subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan" "cardtrade"."plan" DEFAULT 'pro' NOT NULL,
	"status" "cardtrade"."subscription_status" NOT NULL,
	"interval" "cardtrade"."subscription_interval" NOT NULL,
	"provider" "cardtrade"."subscription_provider" NOT NULL,
	"provider_subscription_id" text,
	"price_cents" integer NOT NULL,
	"currency" "cardtrade"."currency" DEFAULT 'EUR' NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cardtrade"."subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "cardtrade"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscriptions_user_idx" ON "cardtrade"."subscriptions" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_provider_uq" ON "cardtrade"."subscriptions" USING btree ("provider","provider_subscription_id");