CREATE TABLE `product` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`availability` text DEFAULT 'made_to_order' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`dimensions` text NOT NULL,
	`model` text NOT NULL,
	`pricing` text NOT NULL,
	`options` text NOT NULL,
	`design` text NOT NULL,
	`lead_days_standard` integer DEFAULT 14 NOT NULL,
	`lead_days_custom` integer DEFAULT 28 NOT NULL,
	`images` text DEFAULT '[]' NOT NULL,
	`model_key` text,
	`blend_key` text,
	`model_version` integer DEFAULT 1 NOT NULL,
	`prompt` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`published_at` text,
	`deleted_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_slug_unique` ON `product` (`slug`);--> statement-breakpoint
CREATE INDEX `product_status_idx` ON `product` (`status`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `product_category_idx` ON `product` (`category`);--> statement-breakpoint
CREATE TABLE `cart_item` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cart_id` text NOT NULL,
	`product_id` integer NOT NULL,
	`selection` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cart_item_cart_idx` ON `cart_item` (`cart_id`);--> statement-breakpoint
CREATE TABLE `order_event` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`status` text NOT NULL,
	`note` text,
	`actor_id` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `order_event_order_idx` ON `order_event` (`order_id`);--> statement-breakpoint
CREATE TABLE `order_item` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`product_id` integer,
	`product_name` text NOT NULL,
	`selection` text NOT NULL,
	`spec` text NOT NULL,
	`lines` text NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`quantity` integer NOT NULL,
	`line_total_cents` integer NOT NULL,
	`lead_days` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `order_item_order_idx` ON `order_item` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ref` text NOT NULL,
	`access_token` text NOT NULL,
	`user_id` text,
	`status` text DEFAULT 'pending_payment' NOT NULL,
	`payment_status` text DEFAULT 'unpaid' NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`address` text NOT NULL,
	`delivery_method` text NOT NULL,
	`delivery_label` text NOT NULL,
	`notes` text,
	`currency` text NOT NULL,
	`subtotal_cents` integer NOT NULL,
	`delivery_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`lead_days` integer NOT NULL,
	`stripe_session_id` text,
	`stripe_payment_intent` text,
	`paid_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_ref_unique` ON `orders` (`ref`);--> statement-breakpoint
CREATE INDEX `orders_user_idx` ON `orders` (`user_id`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `orders_created_idx` ON `orders` (`created_at`);--> statement-breakpoint
CREATE TABLE `saved_design` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`product_id` integer NOT NULL,
	`selection` text NOT NULL,
	`label` text,
	`deleted_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `saved_design_user_idx` ON `saved_design` (`user_id`);--> statement-breakpoint
DROP TABLE `note`;