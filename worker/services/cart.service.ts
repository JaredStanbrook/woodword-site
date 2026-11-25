// worker/services/cart.service.ts
//
// Anonymous carts. The visitor's `cart` cookie holds a random id; every
// query below is scoped by it in the `where` clause, so one visitor's cart can
// never load another's line.
//
// Prices are never stored on a cart line. They are recomputed from the
// product on every read, so a cart always shows what checkout will charge.

import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { and, eq, isNull } from "drizzle-orm";

import type { AppEnv } from "../types";
import { cartItem, type SelectCartItem } from "../schema/shop.schema";
import { product, specOf, type SelectProduct } from "../schema/product.schema";
import { normaliseSelection, quote, type Quote } from "../lib/furniture";
import { randomBase64Url } from "../lib/crypto";
import { MAX_QUANTITY } from "../config/shop.config";

const COOKIE = "cart";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 60; // 60 days
const ID_PATTERN = /^[A-Za-z0-9_-]{22,64}$/;

/** The visitor's cart id, or null when they have none yet. */
export function readCartId(c: Context<AppEnv>): string | null {
  const id = getCookie(c, COOKIE);
  return id && ID_PATTERN.test(id) ? id : null;
}

/** The visitor's cart id, creating one (and its cookie) if needed. */
export function ensureCartId(c: Context<AppEnv>): string {
  const existing = readCartId(c);
  if (existing) return existing;
  const id = randomBase64Url(24);
  setCookie(c, COOKIE, id, {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    secure: new URL(c.req.url).protocol === "https:",
    maxAge: COOKIE_MAX_AGE,
  });
  return id;
}

export interface CartLine {
  item: SelectCartItem;
  product: SelectProduct;
  quote: Quote;
  lineTotalCents: number;
  /** False when the product is no longer for sale; checkout refuses the cart. */
  available: boolean;
}

export const isPurchasable = (p: SelectProduct) =>
  p.status === "published" && !p.deletedAt && p.availability !== "sold_out";

export async function cartLines(c: Context<AppEnv>, cartId: string | null): Promise<CartLine[]> {
  if (!cartId) return [];
  const rows = await c.var.db
    .select({ item: cartItem, product })
    .from(cartItem)
    .innerJoin(product, eq(cartItem.productId, product.id))
    .where(eq(cartItem.cartId, cartId))
    .orderBy(cartItem.id);

  return rows.map(({ item, product: p }) => {
    const spec = specOf(p);
    // Re-normalise against the product as it is now: an edited product may
    // have narrowed its limits since this line was added.
    const selection = normaliseSelection(spec, item.selection);
    const q = quote(spec, selection);
    return {
      item: { ...item, selection },
      product: p,
      quote: q,
      lineTotalCents: q.totalCents * item.quantity,
      available: isPurchasable(p),
    };
  });
}

/** Pieces in the visitor's cart and what they come to, for the nav. */
export async function cartSummary(
  c: Context<AppEnv>,
): Promise<{ count: number; totalCents: number }> {
  const lines = await cartLines(c, readCartId(c));
  return {
    count: lines.reduce((n, l) => n + l.item.quantity, 0),
    totalCents: lines.reduce((n, l) => n + l.lineTotalCents, 0),
  };
}

/** A published, buyable product by id, or undefined. */
export async function purchasableProduct(c: Context<AppEnv>, id: number) {
  const [p] = await c.var.db
    .select()
    .from(product)
    .where(and(eq(product.id, id), eq(product.status, "published"), isNull(product.deletedAt)));
  return p && isPurchasable(p) ? p : undefined;
}

export const clampQuantity = (q: unknown) =>
  Math.min(MAX_QUANTITY, Math.max(1, Math.floor(Number(q)) || 1));
