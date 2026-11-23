// worker/schema/product.schema.ts
//
// A furniture design. The structured parts — dimensions, model, pricing,
// options, page design — are JSON columns typed by schema/furniture.config.ts,
// because each piece has its own shape of them and none is ever queried by
// field. Everything a listing filters or sorts on is a real column.

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { z } from "zod";

import { timestampColumns } from "./common";
import {
  AVAILABILITY,
  CATEGORIES,
  PRODUCT_STATUSES,
  type Design,
  type Dimensions,
  type FurnitureSpec,
  type Model,
  type Options,
  type Pricing,
} from "./furniture.config";

export const product = sqliteTable(
  "product",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    category: text("category", { enum: CATEGORIES }).notNull(),
    status: text("status", { enum: PRODUCT_STATUSES }).default("draft").notNull(),
    availability: text("availability", { enum: AVAILABILITY }).default("made_to_order").notNull(),
    summary: text("summary").notNull().default(""),
    description: text("description").notNull().default(""),

    dimensions: text("dimensions", { mode: "json" }).$type<Dimensions>().notNull(),
    model: text("model", { mode: "json" }).$type<Model>().notNull(),
    pricing: text("pricing", { mode: "json" }).$type<Pricing>().notNull(),
    options: text("options", { mode: "json" }).$type<Options>().notNull(),
    design: text("design", { mode: "json" }).$type<Design>().notNull(),

    leadDaysStandard: integer("lead_days_standard").default(14).notNull(),
    leadDaysCustom: integer("lead_days_custom").default(28).notNull(),

    /** R2 keys. The first image is the gallery photo; without one the line drawing stands in. */
    images: text("images", { mode: "json" }).$type<string[]>().default([]).notNull(),
    /** The GLB the 3D view loads. Null: the view builds the piece from `model.parts`. */
    modelKey: text("model_key"),
    /** The Blender source, kept so the piece can be changed later. */
    blendKey: text("blend_key"),
    /** Bumped on every model upload, and recorded on each order's spec. */
    modelVersion: integer("model_version").default(1).notNull(),

    /** The prompt the design was generated from, if any. */
    prompt: text("prompt"),
    sortOrder: integer("sort_order").default(0).notNull(),
    publishedAt: text("published_at"),
    deletedAt: text("deleted_at"),
    ...timestampColumns,
  },
  (table) => [
    index("product_status_idx").on(table.status, table.deletedAt),
    index("product_category_idx").on(table.category),
  ],
);

export type SelectProduct = typeof product.$inferSelect;
export type InsertProduct = typeof product.$inferInsert;

export const specOf = (p: SelectProduct): FurnitureSpec => ({
  dimensions: p.dimensions,
  model: p.model,
  pricing: p.pricing,
  options: p.options,
  leadDaysStandard: p.leadDaysStandard,
  leadDaysCustom: p.leadDaysCustom,
});

/** URL-safe, lowercase, hyphenated. */
export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

export const productSlugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, digits and single hyphens");
