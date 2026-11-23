// worker/services/order.service.ts
//
// Turning a cart into an order, confirming payment, and moving an order
// through the workshop. Every write that changes status also records an
// order_event, which is both the customer's timeline and the audit trail.

import type { Context } from "hono";
import { and, eq } from "drizzle-orm";

import type { AppEnv } from "../types";
import {
  orderEvent,
  orderItem,
  orders,
  type Address,
  type CheckoutForm,
  type ManufacturingSpec,
  type OrderStatus,
  type SelectOrder,
  type SelectOrderItem,
} from "../schema/shop.schema";
import { specOf } from "../schema/product.schema";
import { chosenOptions, cutList, resizeParts } from "../lib/furniture";
import { randomBase64Url } from "../lib/crypto";
import { formatPrice } from "../lib/money";
import { sendEmail, escapeHtml } from "../lib/email";
import { ORDER_REF_PREFIX, type DeliveryOption } from "../config/shop.config";
import type { CartLine } from "./cart.service";

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  received: "Order received",
  awaiting_production: "Awaiting production",
  in_production: "In production",
  ready_for_dispatch: "Ready for dispatch",
  dispatched: "Dispatched",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export const STATUS_DESCRIPTIONS: Record<OrderStatus, string> = {
  pending_payment: "We are waiting for payment to be confirmed.",
  received: "Payment confirmed and your configuration saved.",
  awaiting_production: "Reviewed and scheduled for the workshop.",
  in_production: "Your piece is being made.",
  ready_for_dispatch: "Finished, checked and prepared for delivery.",
  dispatched: "On its way to you, or ready to collect.",
  completed: "Delivered. Enjoy it.",
  cancelled: "This order was cancelled.",
  refunded: "This order was refunded.",
};

/** The happy path, in order — the customer's progress bar. */
export const WORKFLOW: OrderStatus[] = [
  "received",
  "awaiting_production",
  "in_production",
  "ready_for_dispatch",
  "dispatched",
  "completed",
];

const REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function newRef() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `${ORDER_REF_PREFIX}-${[...bytes].map((b) => REF_ALPHABET[b % REF_ALPHABET.length]).join("")}`;
}

export function specFor(line: CartLine): ManufacturingSpec {
  const p = line.product;
  const spec = specOf(p);
  const sel = line.item.selection;
  const parts = resizeParts(spec, sel);
  return {
    productId: p.id,
    productSlug: p.slug,
    productName: p.name,
    modelKey: p.modelKey,
    modelVersion: p.modelVersion,
    dimensions: { width: sel.width, height: sel.height, depth: sel.depth },
    standard: {
      width: spec.dimensions.width.standard,
      height: spec.dimensions.height.standard,
      depth: spec.dimensions.depth.standard,
    },
    options: chosenOptions(spec, sel).map((o) => ({
      group: o.groupId,
      groupLabel: o.groupLabel,
      choice: o.choice.id,
      choiceLabel: o.choice.label,
    })),
    parts,
    cutList: cutList(parts),
    timberCubicMetres: line.quote.timberCubicMetres,
  };
}

export async function createOrder(
  c: Context<AppEnv>,
  form: CheckoutForm,
  lines: CartLine[],
  delivery: DeliveryOption,
): Promise<SelectOrder> {
  const subtotal = lines.reduce((s, l) => s + l.lineTotalCents, 0);
  const leadDays = Math.max(0, ...lines.map((l) => l.quote.leadDays));
  const address: Address = {
    line1: form.line1,
    line2: form.line2 || undefined,
    city: form.city,
    region: form.region || undefined,
    postcode: form.postcode,
    country: form.country,
  };
  const now = new Date().toISOString();

  // A clash on the six-character reference is unlikely; retry rather than fail.
  let created: SelectOrder | undefined;
  for (let attempt = 0; attempt < 4 && !created; attempt++) {
    try {
      [created] = await c.var.db
        .insert(orders)
        .values({
          ref: newRef(),
          accessToken: randomBase64Url(24),
          userId: c.var.auth.user?.id ?? null,
          name: form.name,
          email: form.email.toLowerCase(),
          phone: form.phone || null,
          address,
          deliveryMethod: delivery.id,
          deliveryLabel: delivery.label,
          notes: form.notes || null,
          currency: c.var.app.currency,
          subtotalCents: subtotal,
          deliveryCents: delivery.cents,
          totalCents: subtotal + delivery.cents,
          leadDays,
          updatedAt: now,
        })
        .returning();
    } catch (err) {
      if (attempt === 3 || !String(err).includes("UNIQUE")) throw err;
    }
  }
  const order = created!;

  await c.var.db.batch([
    c.var.db.insert(orderItem).values(
      lines.map((l) => ({
        orderId: order.id,
        productId: l.product.id,
        productName: l.product.name,
        selection: l.item.selection,
        spec: specFor(l),
        lines: l.quote.lines,
        unitPriceCents: l.quote.totalCents,
        quantity: l.item.quantity,
        lineTotalCents: l.lineTotalCents,
        leadDays: l.quote.leadDays,
      })),
    ),
    c.var.db.insert(orderEvent).values({
      orderId: order.id,
      status: "pending_payment",
      note: "Order placed, awaiting payment",
    }),
  ]);

  return order;
}

/**
 * Records a confirmed payment. Safe to call more than once — the webhook and
 * the return from Stripe can both arrive — because only an unpaid order
 * changes, and only a change sends the emails.
 */
export async function markPaid(
  c: Context<AppEnv>,
  ref: string,
  payment: { sessionId?: string | null; paymentIntent?: string | null; note?: string },
): Promise<boolean> {
  const now = new Date().toISOString();
  const changed = await c.var.db
    .update(orders)
    .set({
      paymentStatus: "paid",
      status: "received",
      paidAt: now,
      stripePaymentIntent: payment.paymentIntent ?? null,
      updatedAt: now,
    })
    .where(and(eq(orders.ref, ref), eq(orders.paymentStatus, "unpaid")))
    .returning();
  if (changed.length === 0) return false;

  const order = changed[0];
  await c.var.db.insert(orderEvent).values({
    orderId: order.id,
    status: "received",
    note: payment.note ?? "Payment confirmed",
  });

  const items = await c.var.db.select().from(orderItem).where(eq(orderItem.orderId, order.id));
  const send = Promise.all([
    sendEmail(c.env, confirmationEmail(c, order, items)),
    c.env.ORDERS_EMAIL
      ? sendEmail(c.env, { ...workshopEmail(c, order, items), to: c.env.ORDERS_EMAIL })
      : Promise.resolve(false),
  ]);
  try {
    c.executionCtx.waitUntil(send);
  } catch {
    await send; // No execution context (tests, scripts).
  }
  return true;
}

export async function setStatus(
  c: Context<AppEnv>,
  orderId: number,
  status: OrderStatus,
  note: string | null,
): Promise<boolean> {
  const now = new Date().toISOString();
  const changed = await c.var.db
    .update(orders)
    .set({
      status,
      updatedAt: now,
      ...(status === "refunded" ? { paymentStatus: "refunded" as const } : {}),
    })
    .where(eq(orders.id, orderId))
    .returning({ id: orders.id });
  if (changed.length === 0) return false;
  await c.var.db.insert(orderEvent).values({
    orderId,
    status,
    note,
    actorId: c.var.auth.user?.id ?? null,
  });
  return true;
}

export const orderUrl = (origin: string, o: Pick<SelectOrder, "ref" | "accessToken">) =>
  `${origin}/orders/${o.ref}?t=${o.accessToken}`;

const describeLine = (i: SelectOrderItem) =>
  `${i.productName} — ${i.spec.dimensions.width} × ${i.spec.dimensions.depth} × ${i.spec.dimensions.height} mm` +
  (i.spec.options.length ? `, ${i.spec.options.map((o) => o.choiceLabel).join(", ")}` : "") +
  (i.quantity > 1 ? ` (× ${i.quantity})` : "");

function confirmationEmail(c: Context<AppEnv>, order: SelectOrder, items: SelectOrderItem[]) {
  const { locale, currency, name: shop, origin } = c.var.app;
  const money = (cents: number) => formatPrice(cents, locale, currency);
  const link = orderUrl(origin, order);
  const lines = items.map((i) => `${describeLine(i)}: ${money(i.lineTotalCents)}`);
  const text = [
    `Thank you, ${order.name}.`,
    ``,
    `Your order ${order.ref} is confirmed and your configuration is saved exactly as you chose it:`,
    ``,
    ...lines,
    `Delivery (${order.deliveryLabel}): ${money(order.deliveryCents)}`,
    `Total paid: ${money(order.totalCents)}`,
    ``,
    `Follow its progress through the workshop: ${link}`,
    ``,
    shop,
  ].join("\n");
  const html = `<div style="font-family:Georgia,serif;font-size:16px;line-height:1.5;color:#2b2520;max-width:560px">
<p>Thank you, ${escapeHtml(order.name)}.</p>
<p>Your order <strong>${escapeHtml(order.ref)}</strong> is confirmed and your configuration is saved exactly as you chose it:</p>
<ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>
<p>Delivery (${escapeHtml(order.deliveryLabel)}): ${escapeHtml(money(order.deliveryCents))}<br><strong>Total paid: ${escapeHtml(money(order.totalCents))}</strong></p>
<p><a href="${escapeHtml(link)}">Follow its progress through the workshop</a></p>
<p>${escapeHtml(shop)}</p></div>`;
  return { to: order.email, subject: `Your order ${order.ref} is confirmed`, text, html };
}

function workshopEmail(c: Context<AppEnv>, order: SelectOrder, items: SelectOrderItem[]) {
  const { locale, currency, origin } = c.var.app;
  const link = `${origin}/admin/orders/${order.id}`;
  const text = [
    `New paid order ${order.ref} from ${order.name} <${order.email}>`,
    ...items.map(describeLine),
    `Total ${formatPrice(order.totalCents, locale, currency)}`,
    link,
  ].join("\n");
  return {
    subject: `New order ${order.ref}`,
    text,
    html: `<pre style="font:14px/1.5 monospace">${escapeHtml(text)}</pre>`,
  };
}
