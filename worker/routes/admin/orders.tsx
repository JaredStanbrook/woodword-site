// worker/routes/admin/orders.tsx
//
// Admin dashboard and order management. Mounted under the admin sub-app.

import { Hono } from "hono";
import { and, asc, count, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";

import type { AppEnv } from "@server/types";
import {
  ORDER_STATUSES,
  orderEvent,
  orderItem,
  orders,
  type OrderStatus,
} from "@server/schema/shop.schema";
import { product } from "@server/schema/product.schema";
import { flashToast } from "@server/lib/htmx-helpers";
import { setStatus } from "@server/services/order.service";
import { DashboardPage, OrderDetailPage, OrderListPage, SpecSheet } from "@views/admin/Orders";

export const ordersAdminRoute = new Hono<AppEnv>();
export const dashboardRoute = new Hono<AppEnv>();

const OPEN: OrderStatus[] = [
  "received",
  "awaiting_production",
  "in_production",
  "ready_for_dispatch",
  "dispatched",
];

async function statusCounts(db: AppEnv["Variables"]["db"]) {
  const rows = await db
    .select({ status: orders.status, n: count() })
    .from(orders)
    .groupBy(orders.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<
    Record<OrderStatus, number>
  >;
}

// ==========================================
// DASHBOARD
// ==========================================

dashboardRoute.get("/", async (c) => {
  const db = c.var.db;
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1)).toISOString();
  const paid = eq(orders.paymentStatus, "paid");

  const [totals, last30, byMonth, counts, recent, products] = await Promise.all([
    db
      .select({ cents: sql<number>`coalesce(sum(${orders.totalCents}), 0)`, n: count() })
      .from(orders)
      .where(paid),
    db
      .select({ cents: sql<number>`coalesce(sum(${orders.totalCents}), 0)` })
      .from(orders)
      .where(and(paid, gte(orders.paidAt, since30))),
    db
      .select({
        month: sql<string>`substr(${orders.paidAt}, 1, 7)`,
        cents: sql<number>`sum(${orders.totalCents})`,
      })
      .from(orders)
      .where(and(paid, gte(orders.paidAt, start)))
      .groupBy(sql`substr(${orders.paidAt}, 1, 7)`),
    statusCounts(db),
    db
      .select()
      .from(orders)
      .where(inArray(orders.status, [...OPEN, "completed"]))
      .orderBy(desc(orders.id))
      .limit(8),
    db
      .select({ status: product.status, n: count() })
      .from(product)
      .where(isNull(product.deletedAt))
      .groupBy(product.status),
  ]);

  const monthCents = new Map(byMonth.map((m) => [m.month, Number(m.cents)]));
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1));
    const key = d.toISOString().slice(0, 7);
    return {
      label: d.toLocaleDateString(c.var.app.locale, { month: "short", timeZone: "UTC" }),
      cents: monthCents.get(key) ?? 0,
    };
  });

  const revenueCents = Number(totals[0]?.cents ?? 0);
  const paidOrders = Number(totals[0]?.n ?? 0);
  const productCount = (s: string) => Number(products.find((p) => p.status === s)?.n ?? 0);

  return c.render(
    <DashboardPage
      data={{
        revenueCents,
        revenue30Cents: Number(last30[0]?.cents ?? 0),
        paidOrders,
        averageCents: paidOrders ? Math.round(revenueCents / paidOrders) : 0,
        counts,
        months,
        recent,
        liveProducts: productCount("published"),
        draftProducts: productCount("draft"),
      }}
      locale={c.var.app.locale}
      currency={c.var.app.currency}
    />,
    { title: "Dashboard" },
  );
});

// ==========================================
// ORDERS
// ==========================================

ordersAdminRoute.get("/", async (c) => {
  const wanted = c.req.query("status") ?? "open";
  const status = (
    wanted === "all" || wanted === "open" || (ORDER_STATUSES as readonly string[]).includes(wanted)
      ? wanted
      : "open"
  ) as OrderStatus | "open" | "all";
  const where =
    status === "all"
      ? undefined
      : status === "open"
        ? inArray(orders.status, OPEN)
        : eq(orders.status, status);
  const [list, counts] = await Promise.all([
    c.var.db.select().from(orders).where(where).orderBy(desc(orders.id)).limit(200),
    statusCounts(c.var.db),
  ]);
  return c.render(
    <OrderListPage orders={list} status={status} counts={counts} locale={c.var.app.locale} />,
    {
      title: "Orders",
    },
  );
});

async function loadOrder(db: AppEnv["Variables"]["db"], id: number) {
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  if (!order) return undefined;
  const [items, events] = await Promise.all([
    db.select().from(orderItem).where(eq(orderItem.orderId, id)).orderBy(asc(orderItem.id)),
    db.select().from(orderEvent).where(eq(orderEvent.orderId, id)).orderBy(asc(orderEvent.id)),
  ]);
  return { order, items, events };
}

ordersAdminRoute.get("/:id", async (c) => {
  const found = await loadOrder(c.var.db, Number(c.req.param("id")));
  if (!found) return c.notFound();
  const [sameEmail] = await c.var.db
    .select({ n: count() })
    .from(orders)
    .where(and(eq(orders.email, found.order.email), eq(orders.paymentStatus, "paid")));
  return c.render(
    <OrderDetailPage
      {...found}
      locale={c.var.app.locale}
      customerOrders={Number(sameEmail?.n ?? 0)}
    />,
    { title: `Order ${found.order.ref}` },
  );
});

ordersAdminRoute.post("/:id/status", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.parseBody();
  const status = String(body.status ?? "");
  if (!(ORDER_STATUSES as readonly string[]).includes(status)) {
    flashToast(c, "Unknown status", { type: "error" });
    return c.redirect(`/admin/orders/${id}`);
  }
  const note =
    String(body.note ?? "")
      .trim()
      .slice(0, 500) || null;
  const ok = await setStatus(c, id, status as OrderStatus, note);
  if (!ok) return c.notFound();
  flashToast(c, "Status updated");
  return c.redirect(`/admin/orders/${id}`);
});

ordersAdminRoute.get("/:id/spec", async (c) => {
  const found = await loadOrder(c.var.db, Number(c.req.param("id")));
  if (!found) return c.notFound();
  return c.render(<SpecSheet order={found.order} items={found.items} locale={c.var.app.locale} />, {
    title: `Spec ${found.order.ref}`,
    bare: true,
  });
});

/**
 * The machine-readable spec: every component with its final size and
 * position, for scripts/blender/apply_spec.py to rebuild the piece in Blender.
 */
ordersAdminRoute.get("/:id/spec.json", async (c) => {
  const found = await loadOrder(c.var.db, Number(c.req.param("id")));
  if (!found) return c.notFound();
  const { order, items } = found;
  const body = {
    format: "furniture-spec/1",
    units: "mm",
    axes: "x width, y height (floor at 0), z depth; positions are component centres",
    order: {
      ref: order.ref,
      placedAt: order.createdAt,
      customer: order.name,
      delivery: order.deliveryLabel,
    },
    items: items.map((i) => ({ quantity: i.quantity, ...i.spec })),
  };
  return c.body(JSON.stringify(body, null, 2), 200, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Disposition": `attachment; filename="${order.ref}-spec.json"`,
  });
});
