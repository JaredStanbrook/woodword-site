// worker/schema/shop.schema.ts
//
// Carts, saved designs and orders.
//
// An order keeps a full snapshot of what was bought: the product's name, the
// configuration, the resized components and the price lines. Products change
// after they are sold; the order must still say exactly what to build.

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { z } from "zod";

import { users } from "./auth.schema";
import { product } from "./product.schema";
import { timestampColumns } from "./common";
import type { Selection } from "./furniture.config";
import type { CutListRow, QuoteLine, ResolvedPart } from "../lib/furniture";

// ==========================================
// CART
// ==========================================

/**
 * A line in a cart. Carts are anonymous: `cartId` is the random value in the
 * visitor's `cart` cookie, so a cart works before anyone signs in, and every
 * query is scoped by it.
 */
export const cartItem = sqliteTable(
  "cart_item",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    cartId: text("cart_id").notNull(),
    productId: integer("product_id")
      .references(() => product.id, { onDelete: "cascade" })
      .notNull(),
    selection: text("selection", { mode: "json" }).$type<Selection>().notNull(),
    quantity: integer("quantity").default(1).notNull(),
    ...timestampColumns,
  },
  (table) => [index("cart_item_cart_idx").on(table.cartId)],
);

export type SelectCartItem = typeof cartItem.$inferSelect;

// ==========================================
// SAVED DESIGNS
// ==========================================

/**
 * A configuration someone wanted to keep or send. The id is the share token,
 * long and random, so a link can be passed around without an account.
 * `userId` is set when a signed-in customer saves it, which is what lists it
 * under their account.
 */
export const savedDesign = sqliteTable(
  "saved_design",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    productId: integer("product_id")
      .references(() => product.id, { onDelete: "cascade" })
      .notNull(),
    selection: text("selection", { mode: "json" }).$type<Selection>().notNull(),
    label: text("label"),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at")
      .default(sql`(current_timestamp)`)
      .notNull(),
  },
  (table) => [index("saved_design_user_idx").on(table.userId)],
);

export type SelectSavedDesign = typeof savedDesign.$inferSelect;

// ==========================================
// ORDERS
// ==========================================

/** The workshop's order workflow, in order. */
export const ORDER_STATUSES = [
  "pending_payment",
  "received",
  "awaiting_production",
  "in_production",
  "ready_for_dispatch",
  "dispatched",
  "completed",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["unpaid", "paid", "refunded", "failed"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postcode: string;
  country: string;
}

export const orders = sqliteTable(
  "orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** Human-readable reference, e.g. HW-7K3P9Q. */
    ref: text("ref").notNull().unique(),
    /** Secret in the confirmation link, so a guest can see their order. */
    accessToken: text("access_token").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    status: text("status", { enum: ORDER_STATUSES }).default("pending_payment").notNull(),
    paymentStatus: text("payment_status", { enum: PAYMENT_STATUSES }).default("unpaid").notNull(),

    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    address: text("address", { mode: "json" }).$type<Address>().notNull(),
    deliveryMethod: text("delivery_method").notNull(),
    deliveryLabel: text("delivery_label").notNull(),
    notes: text("notes"),

    currency: text("currency").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    deliveryCents: integer("delivery_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    /** The longest workshop time in the order, in days, when it was placed. */
    leadDays: integer("lead_days").notNull(),

    stripeSessionId: text("stripe_session_id"),
    stripePaymentIntent: text("stripe_payment_intent"),
    paidAt: text("paid_at"),
    ...timestampColumns,
  },
  (table) => [
    index("orders_user_idx").on(table.userId),
    index("orders_status_idx").on(table.status),
    index("orders_created_idx").on(table.createdAt),
  ],
);

export type SelectOrder = typeof orders.$inferSelect;

/** Everything the workshop needs to build one line, frozen at purchase. */
export interface ManufacturingSpec {
  productId: number;
  productSlug: string;
  productName: string;
  modelKey: string | null;
  modelVersion: number;
  dimensions: { width: number; height: number; depth: number };
  standard: { width: number; height: number; depth: number };
  options: { group: string; groupLabel: string; choice: string; choiceLabel: string }[];
  parts: ResolvedPart[];
  cutList: CutListRow[];
  timberCubicMetres: number;
}

export const orderItem = sqliteTable(
  "order_item",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id")
      .references(() => orders.id, { onDelete: "cascade" })
      .notNull(),
    productId: integer("product_id"),
    productName: text("product_name").notNull(),
    selection: text("selection", { mode: "json" }).$type<Selection>().notNull(),
    spec: text("spec", { mode: "json" }).$type<ManufacturingSpec>().notNull(),
    lines: text("lines", { mode: "json" }).$type<QuoteLine[]>().notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotalCents: integer("line_total_cents").notNull(),
    leadDays: integer("lead_days").notNull(),
  },
  (table) => [index("order_item_order_idx").on(table.orderId)],
);

export type SelectOrderItem = typeof orderItem.$inferSelect;

/** Every status change, so the customer sees a timeline and the workshop an audit trail. */
export const orderEvent = sqliteTable(
  "order_event",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id")
      .references(() => orders.id, { onDelete: "cascade" })
      .notNull(),
    status: text("status", { enum: ORDER_STATUSES }).notNull(),
    note: text("note"),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: text("created_at")
      .default(sql`(current_timestamp)`)
      .notNull(),
  },
  (table) => [index("order_event_order_idx").on(table.orderId)],
);

export type SelectOrderEvent = typeof orderEvent.$inferSelect;

// ==========================================
// FORMS
// ==========================================

const trimmed = (max: number) => z.string().trim().max(max);

export const checkoutFormSchema = z.object({
  name: trimmed(120).min(1, "Your name is needed for delivery"),
  email: trimmed(200).email("That email address does not look right"),
  phone: trimmed(40).optional().default(""),
  line1: trimmed(200).min(1, "Street address is required"),
  line2: trimmed(200).optional().default(""),
  city: trimmed(120).min(1, "Town or city is required"),
  region: trimmed(120).optional().default(""),
  postcode: trimmed(20).min(1, "Postcode is required"),
  country: trimmed(80).min(1, "Country is required"),
  delivery: trimmed(40).min(1),
  notes: trimmed(1000).optional().default(""),
});

export type CheckoutForm = z.infer<typeof checkoutFormSchema>;
