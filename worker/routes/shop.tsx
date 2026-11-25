// worker/routes/shop.tsx
//
// The public storefront: gallery, product pages, saved designs, the cart and
// the media files products point at.

import { Hono, type Context } from "hono";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import type { AppEnv } from "@server/types";
import { product, specOf, type SelectProduct } from "@server/schema/product.schema";
import { cartItem, savedDesign } from "@server/schema/shop.schema";
import { CATEGORIES, type Category, type Selection } from "@server/schema/furniture.config";
import {
  normaliseSelection,
  quote,
  selectionInputFromQuery,
  selectionToQuery,
  startingPrice,
} from "@server/lib/furniture";
import { randomBase64Url } from "@server/lib/crypto";
import { flashToast } from "@server/lib/htmx-helpers";
import {
  cartLines,
  clampQuantity,
  ensureCartId,
  isPurchasable,
  purchasableProduct,
  readCartId,
} from "@server/services/cart.service";
import { GalleryPage } from "@views/shop/Gallery";
import { ProductPage } from "@views/shop/ProductPage";
import { CartPage } from "@views/shop/Cart";
import { MadeToMeasurePage } from "@views/shop/MadeToMeasure";
import { mediaUrl } from "@views/shop/parts";
import { websiteSchema } from "@server/lib/structured-data";

export const shopRoute = new Hono<AppEnv>();

const live = and(eq(product.status, "published"), isNull(product.deletedAt));

const isAdmin = (c: Context<AppEnv>) => Boolean(c.var.auth.user?.roles.includes("admin"));

/** Form fields (w, h, d, o.*) to an engine input. */
function selectionInputFromForm(body: Record<string, unknown>) {
  const query: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(body)) if (typeof v === "string") query[k] = v;
  return selectionInputFromQuery(query);
}

const sameSelection = (a: Selection, b: Selection) =>
  a.width === b.width &&
  a.height === b.height &&
  a.depth === b.depth &&
  JSON.stringify(Object.entries(a.options).sort()) ===
    JSON.stringify(Object.entries(b.options).sort());

// ==========================================
// GALLERY
// ==========================================

shopRoute.get("/", async (c) => {
  const wanted = c.req.query("category");
  const active = (CATEGORIES as readonly string[]).includes(wanted ?? "")
    ? (wanted as Category)
    : null;

  const all = await c.var.db
    .select()
    .from(product)
    .where(live)
    .orderBy(asc(product.sortOrder), desc(product.publishedAt));

  const items = all
    .filter((p) => !active || p.category === active)
    .map((p) => ({ product: p, fromCents: startingPrice(specOf(p)) }));

  const { app } = c.var;
  return c.render(
    <GalleryPage items={items} active={active} locale={app.locale} currency={app.currency} />,
    {
      // The home page's title says what the site is, not only its name.
      title: active
        ? `${categoryTitle(active)} made to measure`
        : app.tagline || "Handmade furniture, made to measure",
      description:
        "Handmade furniture you can resize to your room. Turn each piece in 3D, set the exact size, and see the price as you go.",
      // A category view is a real page worth finding, not a filtered duplicate.
      noindex: false,
      canonical: active ? `${app.origin}/?category=${active}` : undefined,
      jsonLd: active ? [] : [websiteSchema(app)],
    },
  );
});

const categoryTitle = (c: Category) => c.charAt(0).toUpperCase() + c.slice(1);

shopRoute.get("/made-to-measure", async (c) => {
  // The first piece in the collection, drawn at two sizes, shows what
  // resizing does better than a paragraph can.
  const [example] = await c.var.db
    .select()
    .from(product)
    .where(live)
    .orderBy(asc(product.sortOrder), desc(product.publishedAt))
    .limit(1);
  return c.render(<MadeToMeasurePage example={example} />, {
    title: "Made to measure",
    description:
      "How ordering furniture in your own size works: choose a piece, set the dimensions, see the price, and we build exactly that.",
  });
});

// ==========================================
// PRODUCT
// ==========================================

async function findProduct(c: Context<AppEnv>, slug: string): Promise<SelectProduct | undefined> {
  const [p] = await c.var.db
    .select()
    .from(product)
    .where(and(eq(product.slug, slug), isNull(product.deletedAt)));
  if (!p) return undefined;
  // Drafts and archived pieces are visible to admins only, as a preview.
  if (p.status !== "published" && !isAdmin(c)) return undefined;
  return p;
}

async function renderProduct(
  c: Context<AppEnv>,
  p: SelectProduct,
  input: Parameters<typeof normaliseSelection>[1],
  extra: { editingItemId?: number; savedLink?: string; noindex?: boolean } = {},
) {
  const spec = specOf(p);
  const selection = normaliseSelection(spec, input);
  const q = quote(spec, selection);
  const { app } = c.var;
  const image = p.images[0] ? mediaUrl(p.images[0]) : undefined;

  return c.render(
    <ProductPage
      product={p}
      selection={selection}
      quote={q}
      locale={app.locale}
      currency={app.currency}
      purchasable={isPurchasable(p)}
      editingItemId={extra.editingItemId}
      savedLink={extra.savedLink}
      preview={p.status !== "published" || isAdmin(c)}
    />,
    {
      title: p.name,
      description: (p.summary || p.design.intro).slice(0, 160),
      image,
      type: "article",
      // Every configuration is the same page: point them all at the bare URL.
      canonical: `${app.origin}/furniture/${p.slug}`,
      noindex: extra.noindex ?? p.status !== "published",
      jsonLd:
        p.status === "published"
          ? [
              {
                "@context": "https://schema.org",
                "@type": "Product",
                name: p.name,
                description: p.summary,
                category: p.category,
                ...(image ? { image: new URL(image, app.origin).toString() } : {}),
                offers: {
                  "@type": "Offer",
                  price: (q.totalCents / 100).toFixed(2),
                  priceCurrency: app.currency,
                  availability:
                    p.availability === "sold_out"
                      ? "https://schema.org/OutOfStock"
                      : p.availability === "in_stock"
                        ? "https://schema.org/InStock"
                        : "https://schema.org/PreOrder",
                  url: `${app.origin}/furniture/${p.slug}`,
                },
              },
            ]
          : [],
    },
  );
}

shopRoute.get("/furniture/:slug", async (c) => {
  const p = await findProduct(c, c.req.param("slug"));
  if (!p) return c.notFound();

  const query = c.req.query();
  // Editing a cart line: only one in this visitor's own cart.
  let editingItemId: number | undefined;
  const itemId = Number(query.item);
  const cartId = readCartId(c);
  if (itemId && cartId) {
    const [line] = await c.var.db
      .select({ id: cartItem.id })
      .from(cartItem)
      .where(
        and(eq(cartItem.id, itemId), eq(cartItem.cartId, cartId), eq(cartItem.productId, p.id)),
      );
    editingItemId = line?.id;
  }

  let savedLink: string | undefined;
  if (query.saved && /^[A-Za-z0-9_-]{16,40}$/.test(query.saved)) {
    savedLink = `${c.var.app.origin}/d/${query.saved}`;
  }

  return renderProduct(c, p, selectionInputFromQuery(query), { editingItemId, savedLink });
});

// ==========================================
// SAVED & SHARED DESIGNS
// ==========================================

shopRoute.post("/designs", async (c) => {
  const body = await c.req.parseBody();
  const p = await liveProduct(c, Number(body.productId));
  if (!p) return c.notFound();

  const selection = normaliseSelection(specOf(p), selectionInputFromForm(body));
  const id = randomBase64Url(16);
  await c.var.db.insert(savedDesign).values({
    id,
    productId: p.id,
    selection,
    userId: c.var.auth.user?.id ?? null,
  });

  flashToast(c, c.var.auth.user ? "Saved to your account" : "Design saved", {
    description: "Copy the link to share it.",
  });
  return c.redirect(`/furniture/${p.slug}?${selectionToQuery(selection)}&saved=${id}#save-design`);
});

async function liveProduct(c: Context<AppEnv>, id: number) {
  if (!id) return undefined;
  const [p] = await c.var.db
    .select()
    .from(product)
    .where(and(eq(product.id, id), live));
  return p;
}

shopRoute.get("/d/:token", async (c) => {
  const token = c.req.param("token");
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(token)) return c.notFound();
  const [row] = await c.var.db
    .select({ design: savedDesign, product })
    .from(savedDesign)
    .innerJoin(product, eq(savedDesign.productId, product.id))
    .where(and(eq(savedDesign.id, token), isNull(savedDesign.deletedAt), live));
  if (!row) return c.notFound();
  return renderProduct(c, row.product, row.design.selection, { noindex: true });
});

// ==========================================
// CART
// ==========================================

shopRoute.get("/cart", async (c) => {
  const lines = await cartLines(c, readCartId(c));
  return c.render(
    <CartPage lines={lines} locale={c.var.app.locale} currency={c.var.app.currency} />,
    {
      title: "Your cart",
      noindex: true,
    },
  );
});

/** Add a configuration, or replace one line's configuration when `item` is sent. */
shopRoute.post("/cart", async (c) => {
  const body = await c.req.parseBody();
  const p = await purchasableProduct(c, Number(body.productId));
  if (!p) {
    flashToast(c, "That piece cannot be ordered right now.", { type: "error" });
    return c.redirect("/");
  }

  const selection = normaliseSelection(specOf(p), selectionInputFromForm(body));
  const quantity = clampQuantity(body.quantity);
  const cartId = ensureCartId(c);
  const now = new Date().toISOString();
  const itemId = Number(body.item);

  if (itemId) {
    const changed = await c.var.db
      .update(cartItem)
      .set({ selection, quantity, updatedAt: now })
      .where(
        and(eq(cartItem.id, itemId), eq(cartItem.cartId, cartId), eq(cartItem.productId, p.id)),
      )
      .returning({ id: cartItem.id });
    if (changed.length > 0) {
      flashToast(c, "Cart updated");
      return c.redirect("/cart");
    }
    // The line is gone (another tab removed it): add it as new below.
  }

  const existing = await c.var.db
    .select()
    .from(cartItem)
    .where(and(eq(cartItem.cartId, cartId), eq(cartItem.productId, p.id)));
  const twin = existing.find((line) =>
    sameSelection(normaliseSelection(specOf(p), line.selection), selection),
  );

  if (twin) {
    await c.var.db
      .update(cartItem)
      .set({ quantity: clampQuantity(twin.quantity + quantity), updatedAt: now })
      .where(and(eq(cartItem.id, twin.id), eq(cartItem.cartId, cartId)));
  } else {
    await c.var.db
      .insert(cartItem)
      .values({ cartId, productId: p.id, selection, quantity, updatedAt: now });
  }

  flashToast(c, `${p.name} added to your cart`);
  return c.redirect("/cart");
});

shopRoute.post("/cart/:id/quantity", async (c) => {
  const cartId = readCartId(c);
  const body = await c.req.parseBody();
  if (cartId) {
    await c.var.db
      .update(cartItem)
      .set({ quantity: clampQuantity(body.quantity), updatedAt: new Date().toISOString() })
      .where(and(eq(cartItem.id, Number(c.req.param("id"))), eq(cartItem.cartId, cartId)));
  }
  return c.redirect("/cart");
});

shopRoute.post("/cart/:id/remove", async (c) => {
  const cartId = readCartId(c);
  const removed = cartId
    ? await c.var.db
        .delete(cartItem)
        .where(and(eq(cartItem.id, Number(c.req.param("id"))), eq(cartItem.cartId, cartId)))
        .returning({ id: cartItem.id })
    : [];
  flashToast(c, removed.length ? "Removed from your cart" : "That item was already gone", {
    type: removed.length ? "success" : "info",
  });
  return c.redirect("/cart");
});

/** Empty the visitor's cart after a paid order. */
export async function clearCart(c: Context<AppEnv>, productIds?: number[]) {
  const cartId = readCartId(c);
  if (!cartId) return;
  await c.var.db
    .delete(cartItem)
    .where(
      and(
        eq(cartItem.cartId, cartId),
        productIds?.length ? inArray(cartItem.productId, productIds) : undefined,
      ),
    );
}

// ==========================================
// MEDIA (R2)
// ==========================================

/**
 * Product images and GLB models. Only keys under `products/` are public; the
 * Blender source files live under `private/` and are only served to admins.
 */
shopRoute.get("/media/*", async (c) => {
  const key = decodeURIComponent(c.req.path.slice("/media/".length));
  const isPrivate = key.startsWith("private/");
  if (key.includes("..") || (!key.startsWith("products/") && !isPrivate)) return c.notFound();
  if (isPrivate && !isAdmin(c)) return c.notFound();
  if (!c.env.R2) return c.notFound();

  const object = await c.env.R2.get(key);
  if (!object) return c.notFound();

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  // Keys are never reused (each upload gets a new random name), so a year is safe.
  headers.set(
    "Cache-Control",
    isPrivate ? "private, no-store" : "public, max-age=31536000, immutable",
  );
  if (isPrivate) {
    headers.set("Content-Disposition", `attachment; filename="${key.split("/").pop()}"`);
  }
  return new Response(object.body, { headers });
});
