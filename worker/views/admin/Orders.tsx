// worker/views/admin/Orders.tsx
//
// Admin dashboard, order list, order detail and the manufacturing spec sheet.

import type {
  OrderStatus,
  SelectOrder,
  SelectOrderEvent,
  SelectOrderItem,
} from "@server/schema/shop.schema";
import { ORDER_STATUSES } from "@server/schema/shop.schema";
import { STATUS_LABELS, WORKFLOW } from "@server/services/order.service";
import { formatPrice } from "@server/lib/money";
import { formatDateShort } from "@views/lib/utils";
import { buttonPrimary, buttonSecondary, inputClass } from "@views/shop/parts";
import { OrderItems } from "@views/shop/Order";
import { AdminShell } from "./Shell";

/** Whole class names per status, so Tailwind generates each. */
const STATUS_TONE: Record<OrderStatus, string> = {
  pending_payment: "border-border bg-muted text-muted-foreground",
  received: "border-warning/40 bg-warning/15 text-foreground",
  awaiting_production: "border-warning/40 bg-warning/15 text-foreground",
  in_production: "border-chart-1/40 bg-chart-1/10 text-foreground",
  ready_for_dispatch: "border-chart-1/40 bg-chart-1/10 text-foreground",
  dispatched: "border-success/30 bg-success/10 text-success",
  completed: "border-success/30 bg-success/10 text-success",
  cancelled: "border-destructive/30 bg-destructive/10 text-destructive",
  refunded: "border-destructive/30 bg-destructive/10 text-destructive",
};

export const OrderStatusPill = ({ status }: { status: OrderStatus }) => (
  <span
    class={`inline-flex items-center whitespace-nowrap rounded-full border-2 px-2 py-0.5 text-xs font-medium ${STATUS_TONE[status]}`}
  >
    {STATUS_LABELS[status]}
  </span>
);

const PaymentPill = ({ status }: { status: SelectOrder["paymentStatus"] }) => (
  <span
    class={`inline-flex items-center rounded-full border-2 px-2 py-0.5 text-xs font-medium capitalize ${
      status === "paid"
        ? "border-success/30 bg-success/10 text-success"
        : status === "unpaid"
          ? "border-border bg-muted text-muted-foreground"
          : "border-destructive/30 bg-destructive/10 text-destructive"
    }`}
  >
    {status}
  </span>
);

// ==========================================
// DASHBOARD
// ==========================================

export interface DashboardData {
  revenueCents: number;
  revenue30Cents: number;
  paidOrders: number;
  averageCents: number;
  counts: Partial<Record<OrderStatus, number>>;
  months: { label: string; cents: number }[];
  recent: SelectOrder[];
  liveProducts: number;
  draftProducts: number;
}

const Tile = ({ label, value, note }: { label: string; value: string; note?: string }) => (
  <div class="rounded-sm border-2 bg-card p-5 text-card-foreground">
    <p class="text-sm italic text-muted-foreground">{label}</p>
    <p class="mt-2 font-display text-3xl tabular-nums">{value}</p>
    {note ? <p class="mt-1 text-xs text-muted-foreground">{note}</p> : null}
  </div>
);

/** One series, so one colour and no legend; the heading names it. */
const RevenueChart = ({
  months,
  money,
}: {
  months: DashboardData["months"];
  money: (c: number) => string;
}) => {
  const W = 600;
  const H = 220;
  const pad = { top: 16, right: 8, bottom: 28, left: 8 };
  const max = Math.max(1, ...months.map((m) => m.cents));
  const slot = (W - pad.left - pad.right) / months.length;
  const barW = Math.min(56, slot * 0.56);
  const plotH = H - pad.top - pad.bottom;
  const peak = months.reduce((best, m, i) => (m.cents > months[best].cents ? i : best), 0);
  return (
    <figure class="rounded-sm border-2 bg-card p-5 text-card-foreground">
      <figcaption class="mb-3 flex items-baseline justify-between">
        <span class="text-sm font-medium">Paid revenue by month</span>
        <span class="text-xs text-muted-foreground">last {months.length} months</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        class="w-full"
        role="img"
        aria-label="Paid revenue by month; values in the table below"
      >
        {[0.5, 1].map((f) => (
          <line
            x1={pad.left}
            x2={W - pad.right}
            y1={pad.top + plotH * (1 - f)}
            y2={pad.top + plotH * (1 - f)}
            class="stroke-border"
            stroke-dasharray="2 4"
          />
        ))}
        <line
          x1={pad.left}
          x2={W - pad.right}
          y1={pad.top + plotH}
          y2={pad.top + plotH}
          class="stroke-border"
        />
        {months.map((m, i) => {
          const h = Math.max(m.cents > 0 ? 2 : 0, (m.cents / max) * plotH);
          const x = pad.left + slot * i + (slot - barW) / 2;
          const y = pad.top + plotH - h;
          const r = Math.min(4, h / 2, barW / 2);
          // Rounded at the data end only; square on the baseline.
          const d =
            h > 0
              ? `M${x},${pad.top + plotH} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${pad.top + plotH} Z`
              : "";
          return (
            <g>
              <rect
                x={pad.left + slot * i}
                y={pad.top}
                width={slot}
                height={plotH}
                fill="transparent"
              >
                <title>{`${m.label}: ${money(m.cents)}`}</title>
              </rect>
              {d ? (
                <path d={d} class="fill-chart-1 pointer-events-none">
                  <title>{`${m.label}: ${money(m.cents)}`}</title>
                </path>
              ) : null}
              {i === peak && m.cents > 0 ? (
                <text
                  x={x + barW / 2}
                  y={y - 6}
                  text-anchor="middle"
                  class="fill-foreground text-[11px] tabular-nums"
                >
                  {money(m.cents)}
                </text>
              ) : null}
              <text
                x={pad.left + slot * i + slot / 2}
                y={H - 8}
                text-anchor="middle"
                class="fill-muted-foreground text-[11px]"
              >
                {m.label}
              </text>
            </g>
          );
        })}
      </svg>
      <details class="mt-2">
        <summary class="flex min-h-11 cursor-pointer items-center text-xs text-muted-foreground">
          Show as a table
        </summary>
        <table class="w-full text-sm tabular-nums">
          <tbody>
            {months.map((m) => (
              <tr class="border-b-2 last:border-0">
                <th scope="row" class="py-1.5 text-left font-normal text-muted-foreground">
                  {m.label}
                </th>
                <td class="py-1.5 text-right">{money(m.cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
};

export const OrderTable = ({ orders, locale }: { orders: SelectOrder[]; locale: string }) =>
  orders.length === 0 ? (
    <p class="rounded-sm border-2 border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
      No orders here.
    </p>
  ) : (
    <div class="overflow-x-auto rounded-sm border-2 bg-card text-card-foreground">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b-2 text-left text-sm italic text-muted-foreground">
            <th class="p-3 font-medium" scope="col">
              Order
            </th>
            <th class="p-3 font-medium" scope="col">
              Customer
            </th>
            <th class="p-3 font-medium" scope="col">
              Status
            </th>
            <th class="hidden p-3 font-medium sm:table-cell" scope="col">
              Payment
            </th>
            <th class="p-3 text-right font-medium" scope="col">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr class="border-b-2 last:border-0">
              <td class="p-3">
                <a
                  href={`/admin/orders/${o.id}`}
                  class="font-medium hover:underline underline-offset-4"
                >
                  {o.ref}
                </a>
                <span class="block text-xs text-muted-foreground">
                  {formatDateShort(o.createdAt, locale)}
                </span>
              </td>
              <td class="p-3">
                <span class="block">{o.name}</span>
                <span class="block text-xs text-muted-foreground">{o.email}</span>
              </td>
              <td class="p-3">
                <OrderStatusPill status={o.status} />
              </td>
              <td class="hidden p-3 sm:table-cell">
                <PaymentPill status={o.paymentStatus} />
              </td>
              <td class="p-3 text-right tabular-nums">
                {formatPrice(o.totalCents, locale, o.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

export const DashboardPage = ({
  data,
  locale,
  currency,
}: {
  data: DashboardData;
  locale: string;
  currency: string;
}) => {
  const money = (c: number) => formatPrice(c, locale, currency);
  const pipeline: OrderStatus[] = [
    "received",
    "awaiting_production",
    "in_production",
    "ready_for_dispatch",
    "dispatched",
  ];
  return (
    <AdminShell
      title="Dashboard"
      actions={
        <a href="/admin/products/new" class={buttonSecondary}>
          <i data-lucide="plus" class="h-4 w-4"></i> New product
        </a>
      }
    >
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Total sales"
          value={money(data.revenueCents)}
          note="Paid orders, less refunds"
        />
        <Tile label="Last 30 days" value={money(data.revenue30Cents)} />
        <Tile
          label="Paid orders"
          value={String(data.paidOrders)}
          note={`Average ${money(data.averageCents)}`}
        />
        <Tile
          label="In the shop"
          value={String(data.liveProducts)}
          note={
            data.draftProducts
              ? `${data.draftProducts} draft${data.draftProducts === 1 ? "" : "s"} waiting`
              : "No drafts"
          }
        />
      </div>

      <div class="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <RevenueChart months={data.months} money={money} />
        <section
          class="rounded-sm border-2 bg-card p-5 text-card-foreground"
          aria-labelledby="pipeline-heading"
        >
          <h2 id="pipeline-heading" class="mb-3 text-sm font-medium">
            Workshop pipeline
          </h2>
          <ul class="divide-y-2">
            {pipeline.map((s) => (
              <li>
                <a
                  href={`/admin/orders?status=${s}`}
                  class="flex min-h-11 items-center justify-between gap-3 py-2 text-sm hover:text-foreground"
                >
                  <span class="text-muted-foreground">{STATUS_LABELS[s]}</span>
                  <span class="font-display text-xl tabular-nums">{data.counts[s] ?? 0}</span>
                </a>
              </li>
            ))}
            <li>
              <a
                href="/admin/orders?status=completed"
                class="flex min-h-11 items-center justify-between gap-3 py-2 text-sm"
              >
                <span class="text-muted-foreground">Completed</span>
                <span class="tabular-nums">{data.counts.completed ?? 0}</span>
              </a>
            </li>
            <li>
              <a
                href="/admin/orders?status=cancelled"
                class="flex min-h-11 items-center justify-between gap-3 py-2 text-sm"
              >
                <span class="text-muted-foreground">Cancelled / refunded</span>
                <span class="tabular-nums">
                  {(data.counts.cancelled ?? 0) + (data.counts.refunded ?? 0)}
                </span>
              </a>
            </li>
          </ul>
        </section>
      </div>

      <section class="space-y-3">
        <div class="flex items-baseline justify-between">
          <h2 class="font-display text-xl">Recent orders</h2>
          <a
            href="/admin/orders"
            class="inline-flex h-11 items-center text-sm text-muted-foreground hover:text-foreground"
          >
            All orders
          </a>
        </div>
        <OrderTable orders={data.recent} locale={locale} />
      </section>
    </AdminShell>
  );
};

// ==========================================
// LIST
// ==========================================

export const OrderListPage = ({
  orders,
  status,
  counts,
  locale,
}: {
  orders: SelectOrder[];
  status: OrderStatus | "open" | "all";
  counts: Partial<Record<OrderStatus, number>>;
  locale: string;
}) => {
  const tabs: { id: OrderStatus | "open" | "all"; label: string; count?: number }[] = [
    {
      id: "open",
      label: "Open",
      count: [
        "received",
        "awaiting_production",
        "in_production",
        "ready_for_dispatch",
        "dispatched",
      ].reduce((s, k) => s + (counts[k as OrderStatus] ?? 0), 0),
    },
    ...ORDER_STATUSES.map((s) => ({ id: s, label: STATUS_LABELS[s], count: counts[s] ?? 0 })),
    { id: "all", label: "All" },
  ];
  return (
    <AdminShell title="Orders">
      <nav
        class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        aria-label="Filter orders"
      >
        {tabs.map((t) => (
          <a
            href={`/admin/orders?status=${t.id}`}
            aria-current={t.id === status ? "page" : undefined}
            class={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full border-2 px-4 text-sm ${
              t.id === status
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {t.count !== undefined ? (
              <span class="text-xs tabular-nums opacity-70">{t.count}</span>
            ) : null}
          </a>
        ))}
      </nav>
      <OrderTable orders={orders} locale={locale} />
    </AdminShell>
  );
};

// ==========================================
// DETAIL
// ==========================================

export const OrderDetailPage = ({
  order,
  items,
  events,
  locale,
  customerOrders,
}: {
  order: SelectOrder;
  items: SelectOrderItem[];
  events: SelectOrderEvent[];
  locale: string;
  customerOrders: number;
}) => {
  const money = (c: number) => formatPrice(c, locale, order.currency);
  const next = WORKFLOW[WORKFLOW.indexOf(order.status) + 1];
  return (
    <AdminShell
      title={`Order ${order.ref}`}
      back={{ href: "/admin/orders", label: "Orders" }}
      actions={
        <>
          <a href={`/admin/orders/${order.id}/spec`} class={buttonSecondary}>
            <i data-lucide="ruler" class="h-4 w-4"></i> Manufacturing spec
          </a>
          <a href={`/admin/orders/${order.id}/spec.json`} class={buttonSecondary}>
            <i data-lucide="download" class="h-4 w-4"></i> Spec JSON
          </a>
        </>
      }
    >
      <div class="flex flex-wrap items-center gap-2">
        <OrderStatusPill status={order.status} />
        <PaymentPill status={order.paymentStatus} />
        <span class="text-sm text-muted-foreground">
          Placed {formatDateShort(order.createdAt, locale)}
          {order.paidAt ? ` · paid ${formatDateShort(order.paidAt, locale)}` : ""}
        </span>
      </div>

      <div class="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div class="space-y-6">
          <section class="rounded-sm border-2 bg-card p-5 text-card-foreground">
            <h2 class="mb-3 font-display text-xl">Pieces</h2>
            <OrderItems items={items} locale={locale} currency={order.currency} />
            <dl class="mt-3 space-y-1 text-sm">
              <div class="flex justify-between">
                <dt class="text-muted-foreground">Subtotal</dt>
                <dd class="tabular-nums">{money(order.subtotalCents)}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-muted-foreground">{order.deliveryLabel}</dt>
                <dd class="tabular-nums">{money(order.deliveryCents)}</dd>
              </div>
              <div class="flex justify-between border-t-2 pt-2 font-medium">
                <dt>Total</dt>
                <dd class="tabular-nums">{money(order.totalCents)}</dd>
              </div>
            </dl>
            <p class="mt-3 text-xs text-muted-foreground">
              Longest workshop time in this order: {order.leadDays} days.
              {order.stripePaymentIntent ? ` Stripe payment ${order.stripePaymentIntent}.` : ""}
            </p>
          </section>

          <section class="rounded-sm border-2 bg-card p-5 text-card-foreground">
            <h2 class="mb-3 font-display text-xl">History</h2>
            <ol class="space-y-3 text-sm">
              {[...events].reverse().map((e) => (
                <li class="flex gap-3">
                  <span
                    class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-product"
                    aria-hidden="true"
                  ></span>
                  <span>
                    <span class="font-medium">{STATUS_LABELS[e.status]}</span>
                    <span class="text-muted-foreground">
                      {" "}
                      · {formatDateShort(e.createdAt, locale)}
                    </span>
                    {e.note ? <span class="block text-muted-foreground">{e.note}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div class="space-y-6">
          <section class="space-y-4 rounded-sm border-2 bg-card p-5 text-card-foreground">
            <h2 class="font-display text-xl">Update status</h2>
            {order.paymentStatus !== "paid" && order.status === "pending_payment" ? (
              <p class="text-sm text-muted-foreground">
                Payment has not been confirmed. Do not start work until it is.
              </p>
            ) : null}
            {next && order.paymentStatus === "paid" ? (
              <form method="post" action={`/admin/orders/${order.id}/status`}>
                <input type="hidden" name="status" value={next} />
                <button type="submit" class={`${buttonPrimary} w-full`}>
                  Move to: {STATUS_LABELS[next]}
                </button>
              </form>
            ) : null}
            <form
              method="post"
              action={`/admin/orders/${order.id}/status`}
              class="space-y-3 border-t-2 pt-4"
            >
              <label for="status" class="text-sm font-medium">
                Set any status
              </label>
              <select id="status" name="status" class={inputClass}>
                {ORDER_STATUSES.map((s) => (
                  <option value={s} selected={s === order.status}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <label for="note" class="sr-only">
                Note
              </label>
              <textarea
                id="note"
                name="note"
                rows={2}
                placeholder="Note for the customer's timeline (optional)"
                class={`${inputClass} h-auto`}
              ></textarea>
              <button type="submit" class={`${buttonSecondary} w-full`}>
                Save status
              </button>
              <p class="text-xs text-muted-foreground">
                "Refunded" records the refund here; issue the money back from the Stripe dashboard.
              </p>
            </form>
          </section>

          <section class="space-y-1 rounded-sm border-2 bg-card p-5 text-sm text-card-foreground">
            <h2 class="mb-2 font-display text-xl">Customer</h2>
            <p class="font-medium">{order.name}</p>
            <p>
              <a href={`mailto:${order.email}`} class="underline underline-offset-4">
                {order.email}
              </a>
            </p>
            {order.phone ? <p>{order.phone}</p> : null}
            <p class="pt-2 text-muted-foreground">{order.address.line1}</p>
            {order.address.line2 ? (
              <p class="text-muted-foreground">{order.address.line2}</p>
            ) : null}
            <p class="text-muted-foreground">
              {order.address.city}
              {order.address.region ? `, ${order.address.region}` : ""} {order.address.postcode}
            </p>
            <p class="text-muted-foreground">{order.address.country}</p>
            <p class="pt-2 text-xs text-muted-foreground">
              {order.userId ? "Has an account. " : "Guest checkout. "}
              {customerOrders > 1
                ? `${customerOrders} orders with this email.`
                : "First order with this email."}
            </p>
            {order.notes ? (
              <p class="mt-3 rounded-sm bg-muted p-3 whitespace-pre-line">{order.notes}</p>
            ) : null}
          </section>
        </div>
      </div>
    </AdminShell>
  );
};

// ==========================================
// MANUFACTURING SPEC (printable)
// ==========================================

export const SpecSheet = ({
  order,
  items,
  locale,
}: {
  order: SelectOrder;
  items: SelectOrderItem[];
  locale: string;
}) => (
  <div class="mx-auto max-w-4xl space-y-10 px-4 py-8 sm:px-6 print:max-w-none print:p-0">
    <header class="flex flex-wrap items-end justify-between gap-4 border-b-2 pb-4">
      <div>
        <p class="text-sm italic text-muted-foreground">Manufacturing specification</p>
        <h1 class="text-3xl">Order {order.ref}</h1>
        <p class="text-sm text-muted-foreground">
          {order.name} · placed {formatDateShort(order.createdAt, locale)} · {order.deliveryLabel}
        </p>
      </div>
      <button type="button" onclick="window.print()" class={`${buttonSecondary} print:hidden`}>
        <i data-lucide="printer" class="h-4 w-4"></i> Print
      </button>
    </header>
    {items.map((item, n) => (
      <section class="space-y-4 break-inside-avoid">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h2 class="font-display text-2xl">
            {n + 1}. {item.productName} {item.quantity > 1 ? `× ${item.quantity}` : ""}
          </h2>
          <p class="text-xs text-muted-foreground">
            Product #{item.spec.productId} ({item.spec.productSlug}) · model{" "}
            {item.spec.modelKey
              ? `v${item.spec.modelVersion}: ${item.spec.modelKey}`
              : "built from components"}
          </p>
        </div>
        <table class="w-full text-sm tabular-nums">
          <thead>
            <tr class="border-b-2 text-left text-sm italic text-muted-foreground">
              <th class="py-2" scope="col">
                Overall
              </th>
              <th class="py-2" scope="col">
                Ordered
              </th>
              <th class="py-2" scope="col">
                Standard
              </th>
            </tr>
          </thead>
          <tbody>
            {(["width", "depth", "height"] as const).map((k) => (
              <tr class="border-b-2">
                <th scope="row" class="py-1.5 text-left font-medium capitalize">
                  {k}
                </th>
                <td class="py-1.5 font-semibold">{item.spec.dimensions[k]} mm</td>
                <td class="py-1.5 text-muted-foreground">{item.spec.standard[k]} mm</td>
              </tr>
            ))}
          </tbody>
        </table>
        {item.spec.options.length ? (
          <p class="text-sm">
            {item.spec.options.map((o) => (
              <span class="mr-4 inline-block">
                <span class="text-muted-foreground">{o.groupLabel}:</span>{" "}
                <strong class="font-semibold">{o.choiceLabel}</strong>{" "}
                <span class="text-xs text-muted-foreground">({o.choice})</span>
              </span>
            ))}
          </p>
        ) : null}
        <div>
          <h3 class="mb-1 text-sm font-medium">Cut list (finished sizes, per piece)</h3>
          <table class="w-full text-sm tabular-nums">
            <thead>
              <tr class="border-b-2 text-left text-sm italic text-muted-foreground">
                <th class="py-2" scope="col">
                  Component
                </th>
                <th class="py-2" scope="col">
                  Qty
                </th>
                <th class="py-2" scope="col">
                  L × W × T (mm)
                </th>
                <th class="py-2" scope="col">
                  Material
                </th>
                <th class="hidden py-2 sm:table-cell" scope="col">
                  Objects
                </th>
              </tr>
            </thead>
            <tbody>
              {item.spec.cutList.map((r) => (
                <tr class="border-b-2">
                  <td class="py-1.5">
                    {r.label}
                    {r.shape === "cylinder" ? " (round)" : ""}
                  </td>
                  <td class="py-1.5">{r.quantity * item.quantity}</td>
                  <td class="py-1.5 font-semibold">{r.dims.join(" × ")}</td>
                  <td class="py-1.5 capitalize">{r.material}</td>
                  <td class="hidden py-1.5 text-xs text-muted-foreground sm:table-cell">
                    {r.names.join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p class="mt-2 text-xs text-muted-foreground">
            Solid timber in the finished piece: {item.spec.timberCubicMetres.toFixed(3)} m³ each.
            Quantities include the order quantity. Positions for each object are in the JSON export,
            for the Blender script.
          </p>
        </div>
      </section>
    ))}
    {order.notes ? (
      <section class="break-inside-avoid">
        <h2 class="font-display text-xl">Customer notes</h2>
        <p class="whitespace-pre-line text-sm">{order.notes}</p>
      </section>
    ) : null}
  </div>
);
