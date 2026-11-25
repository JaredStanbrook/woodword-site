// worker/routes/checkout.tsx
//
// Checkout, payment, order pages, and the customer's account.
//
// Payment goes through Stripe Checkout when STRIPE_SECRET_KEY is set. Without
// it, a non-production site simulates payment so the whole flow can be tried
// locally; a production site refuses to take an order it cannot charge for.

import { Hono, type Context } from "hono";
import { and, asc, desc, eq, isNull } from "drizzle-orm";

import type { AppEnv } from "@server/types";
import {
  checkoutFormSchema,
  orderEvent,
  orderItem,
  orders,
  savedDesign,
  type SelectOrder,
} from "@server/schema/shop.schema";
import { product } from "@server/schema/product.schema";
import { constantTimeEqual } from "@server/lib/crypto";
import { flashToast } from "@server/lib/htmx-helpers";
import { createCheckoutSession, retrieveCheckoutSession, verifyWebhook } from "@server/lib/stripe";
import { requireUser } from "@server/middleware/guard.middleware";
import { cartLines, readCartId } from "@server/services/cart.service";
import { createOrder, markPaid, orderUrl } from "@server/services/order.service";
import { DELIVERY_AREA, deliveryOption, deliversTo } from "@server/config/shop.config";
import { CheckoutPage, type CheckoutValues } from "@views/shop/Checkout";
import { OrderLookupPage, OrderPage } from "@views/shop/Order";
import { AccountPage } from "@views/shop/Account";
import { clearCart } from "./shop";

export const checkoutRoute = new Hono<AppEnv>();

type PaymentMode = "stripe" | "test" | "none";

export const paymentMode = (c: Context<AppEnv>): PaymentMode =>
  c.env.STRIPE_SECRET_KEY ? "stripe" : c.env.ENVIRONMENT !== "production" ? "test" : "none";

const NO_PAYMENTS =
  "Online payment is not set up on this site yet, so orders cannot be placed. Please get in touch to order.";

// ==========================================
// CHECKOUT
// ==========================================

checkoutRoute.get("/checkout", async (c) => {
  const lines = await cartLines(c, readCartId(c));
  if (lines.length === 0) return c.redirect("/cart");
  if (lines.some((l) => !l.available)) return c.redirect("/cart");

  const user = c.var.auth.user;
  const mode = paymentMode(c);
  const notice =
    mode === "none"
      ? { tone: "error" as const, text: NO_PAYMENTS }
      : c.req.query("cancelled")
        ? {
            tone: "info" as const,
            text: "Payment was cancelled. Nothing was charged; your cart is as you left it.",
          }
        : undefined;

  return c.render(
    <CheckoutPage
      lines={lines}
      values={{ name: user?.displayName ?? "", email: user?.email ?? "" }}
      errors={{}}
      notice={notice}
      locale={c.var.app.locale}
      currency={c.var.app.currency}
      paymentMode={mode}
    />,
    { title: "Checkout", noindex: true },
  );
});

checkoutRoute.post("/checkout", async (c) => {
  const body = (await c.req.parseBody()) as Record<string, string>;
  const lines = await cartLines(c, readCartId(c));
  if (lines.length === 0) return c.redirect("/cart");

  const mode = paymentMode(c);
  const values = body as CheckoutValues;
  const rerender = (
    errors: Record<string, string>,
    notice?: { tone: "info" | "error"; text: string },
  ) =>
    c.render(
      <CheckoutPage
        lines={lines}
        values={values}
        errors={errors}
        notice={notice}
        locale={c.var.app.locale}
        currency={c.var.app.currency}
        paymentMode={mode}
      />,
      { title: "Checkout", noindex: true },
    );

  if (mode === "none") return rerender({}, { tone: "error", text: NO_PAYMENTS });
  if (lines.some((l) => !l.available)) return c.redirect("/cart");

  const parsed = checkoutFormSchema.safeParse(body);
  const delivery = deliveryOption(String(body.delivery ?? ""));
  // Delivery goes to Perth and Peel only; elsewhere in WA, collection.
  const outOfArea =
    parsed.success && delivery?.needsDeliveryArea && !deliversTo(parsed.data.postcode);
  if (!parsed.success || !delivery || outOfArea) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.success ? [] : parsed.error.issues) {
      const key = String(issue.path[0]);
      errors[key] ??= issue.message;
    }
    if (!delivery) errors.delivery = "Choose how you would like it delivered";
    if (outOfArea) {
      errors.delivery = `We deliver within ${DELIVERY_AREA} only, and ${parsed.data.postcode} is outside it. Choose collection from the workshop, or a delivery address in ${DELIVERY_AREA}.`;
    }
    c.status(422);
    return rerender(errors, { tone: "error", text: "A few details need another look." });
  }

  const order = await createOrder(c, parsed.data, lines, delivery);
  const origin = c.var.app.origin;

  if (mode === "test") return c.redirect(orderUrl("", order), 303);

  try {
    const session = await createCheckoutSession(c.env.STRIPE_SECRET_KEY!, {
      orderRef: order.ref,
      currency: c.var.app.currency,
      email: order.email,
      idempotencyKey: `checkout-${order.ref}`,
      successUrl: `${orderUrl(origin, order)}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/checkout?cancelled=1`,
      lines: [
        ...lines.map((l) => ({
          name: l.product.name,
          description: `${l.item.selection.width} × ${l.item.selection.depth} × ${l.item.selection.height} mm`,
          unitAmountCents: l.quote.totalCents,
          quantity: l.item.quantity,
        })),
        ...(delivery.cents > 0
          ? [{ name: delivery.label, unitAmountCents: delivery.cents, quantity: 1 }]
          : []),
      ],
    });
    await c.var.db
      .update(orders)
      .set({ stripeSessionId: session.id, updatedAt: new Date().toISOString() })
      .where(eq(orders.id, order.id));
    if (!session.url) throw new Error("Stripe returned no checkout URL");
    return c.redirect(session.url, 303);
  } catch (err) {
    console.error(`[checkout] ${order.ref}: ${err}`);
    c.status(502);
    return rerender(
      {},
      {
        tone: "error",
        text: "We could not reach the payment provider. Nothing was charged — please try again in a moment.",
      },
    );
  }
});

// ==========================================
// ORDERS
// ==========================================

/** The order, if this request may see it: its secret link, its owner, or an admin. */
async function visibleOrder(c: Context<AppEnv>, ref: string): Promise<SelectOrder | undefined> {
  const [order] = await c.var.db.select().from(orders).where(eq(orders.ref, ref.toUpperCase()));
  if (!order) return undefined;
  const token = c.req.query("t") ?? "";
  const user = c.var.auth.user;
  if (token && constantTimeEqual(token, order.accessToken)) return order;
  if (user && (user.id === order.userId || user.roles.includes("admin"))) return order;
  return undefined;
}

checkoutRoute.get("/orders", (c) =>
  c.render(<OrderLookupPage />, { title: "Track an order", noindex: true }),
);

checkoutRoute.post("/orders/lookup", async (c) => {
  const body = await c.req.parseBody();
  const ref = String(body.ref ?? "")
    .trim()
    .toUpperCase();
  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const [order] = ref
    ? await c.var.db
        .select()
        .from(orders)
        .where(and(eq(orders.ref, ref), eq(orders.email, email)))
    : [];
  if (!order) {
    c.status(404);
    // One message for "no such order" and "wrong email", so the form cannot
    // be used to find out which references exist.
    return c.render(
      <OrderLookupPage
        ref={ref}
        error="We could not find an order with that reference and email."
      />,
      { title: "Track an order", noindex: true },
    );
  }
  return c.redirect(orderUrl("", order));
});

checkoutRoute.get("/orders/:ref", async (c) => {
  let order = await visibleOrder(c, c.req.param("ref"));
  if (!order) return c.notFound();

  // Back from Stripe: confirm with Stripe directly rather than waiting for the
  // webhook, so the customer sees "confirmed" straight away.
  const sessionId = c.req.query("session_id");
  let justPaid = false;
  if (sessionId && order.paymentStatus === "unpaid" && c.env.STRIPE_SECRET_KEY) {
    try {
      const session = await retrieveCheckoutSession(c.env.STRIPE_SECRET_KEY, sessionId);
      if (session.metadata?.order_ref === order.ref && session.payment_status === "paid") {
        await markPaid(c, order.ref, {
          sessionId: session.id,
          paymentIntent: session.payment_intent,
        });
      }
    } catch (err) {
      console.warn(`[orders] could not confirm ${order.ref} with Stripe: ${err}`);
    }
    [order] = await c.var.db.select().from(orders).where(eq(orders.id, order.id));
  }
  if (sessionId && order.paymentStatus === "paid") justPaid = true;

  const [items, events] = await Promise.all([
    c.var.db.select().from(orderItem).where(eq(orderItem.orderId, order.id)),
    c.var.db
      .select()
      .from(orderEvent)
      .where(eq(orderEvent.orderId, order.id))
      .orderBy(asc(orderEvent.id)),
  ]);

  if (justPaid || c.req.query("paid")) {
    justPaid = order.paymentStatus === "paid";
    if (justPaid) await clearCart(c, items.map((i) => i.productId!).filter(Boolean));
  }

  const testPaymentUrl =
    paymentMode(c) === "test"
      ? `/orders/${order.ref}/test-payment?t=${order.accessToken}`
      : undefined;

  return c.render(
    <OrderPage
      order={order}
      items={items}
      events={events}
      locale={c.var.app.locale}
      justPaid={justPaid}
      testPaymentUrl={testPaymentUrl}
    />,
    { title: `Order ${order.ref}`, noindex: true },
  );
});

/** Development only: stands in for Stripe when no key is configured. */
checkoutRoute.post("/orders/:ref/test-payment", async (c) => {
  if (paymentMode(c) !== "test") return c.notFound();
  const order = await visibleOrder(c, c.req.param("ref"));
  if (!order) return c.notFound();
  await markPaid(c, order.ref, { note: "Payment simulated (development, no payment provider)" });
  return c.redirect(`${orderUrl("", order)}&paid=1`);
});

// ==========================================
// ACCOUNT
// ==========================================

checkoutRoute.get("/account", requireUser, async (c) => {
  const user = c.var.auth.user!;
  const [mine, designs] = await Promise.all([
    c.var.db.select().from(orders).where(eq(orders.userId, user.id)).orderBy(desc(orders.id)),
    c.var.db
      .select({ design: savedDesign, product })
      .from(savedDesign)
      .innerJoin(product, eq(savedDesign.productId, product.id))
      .where(
        and(
          eq(savedDesign.userId, user.id),
          isNull(savedDesign.deletedAt),
          isNull(product.deletedAt),
          eq(product.status, "published"),
        ),
      )
      .orderBy(desc(savedDesign.createdAt)),
  ]);
  return c.render(
    <AccountPage
      name={user.displayName ?? ""}
      orders={mine.filter((o) => o.paymentStatus !== "unpaid" || o.status !== "pending_payment")}
      designs={designs}
      locale={c.var.app.locale}
    />,
    { title: "Your account", noindex: true },
  );
});

checkoutRoute.post("/designs/:id/delete", requireUser, async (c) => {
  const user = c.var.auth.user!;
  const removed = await c.var.db
    .update(savedDesign)
    .set({ deletedAt: new Date().toISOString() })
    .where(
      and(
        eq(savedDesign.id, c.req.param("id")),
        eq(savedDesign.userId, user.id),
        isNull(savedDesign.deletedAt),
      ),
    )
    .returning({ id: savedDesign.id });
  flashToast(c, removed.length ? "Design removed" : "That design was already removed", {
    type: removed.length ? "success" : "info",
  });
  return c.redirect("/account");
});

// ==========================================
// STRIPE WEBHOOK  (mounted under /api)
// ==========================================

export const stripeWebhook = new Hono<AppEnv>();

stripeWebhook.post("/webhook", async (c) => {
  const secret = c.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return c.json({ error: "Webhook secret not configured" }, 503);

  const raw = await c.req.text();
  const event = await verifyWebhook(secret, c.req.header("Stripe-Signature"), raw);
  if (!event) return c.json({ error: "Invalid signature" }, 400);

  const session = event.data.object;
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      if (session.payment_status === "paid" && session.metadata?.order_ref) {
        await markPaid(c, session.metadata.order_ref, {
          sessionId: session.id,
          paymentIntent: session.payment_intent,
        });
      }
      break;
    case "checkout.session.async_payment_failed":
      if (session.metadata?.order_ref) {
        await c.var.db
          .update(orders)
          .set({ paymentStatus: "failed", updatedAt: new Date().toISOString() })
          .where(
            and(eq(orders.ref, session.metadata.order_ref), eq(orders.paymentStatus, "unpaid")),
          );
      }
      break;
  }
  // Stripe retries anything but a 2xx; unknown event types are acknowledged.
  return c.json({ received: true });
});
