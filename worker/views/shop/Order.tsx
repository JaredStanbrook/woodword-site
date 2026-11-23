// worker/views/shop/Order.tsx
//
// The customer's order page: confirmation straight after payment, and the
// place to follow the piece through the workshop afterwards.

import type { SelectOrder, SelectOrderEvent, SelectOrderItem } from "@server/schema/shop.schema";
import { STATUS_DESCRIPTIONS, STATUS_LABELS, WORKFLOW } from "@server/services/order.service";
import { formatDateShort } from "@views/lib/utils";
import { Price, buttonPrimary, inputClass, leadTimeLabel } from "./parts";

interface OrderProps {
  order: SelectOrder;
  items: SelectOrderItem[];
  events: SelectOrderEvent[];
  locale: string;
  justPaid: boolean;
  /** Dev-only: no payment provider, offer the simulated payment. */
  testPaymentUrl?: string;
}

export const OrderItems = ({
  items,
  locale,
  currency,
}: {
  items: SelectOrderItem[];
  locale: string;
  currency: string;
}) => (
  <ul class="divide-y-2 border-y-2">
    {items.map((i) => (
      <li class="flex flex-wrap justify-between gap-4 py-4">
        <div class="space-y-1">
          <p class="font-medium">
            {i.productName}
            {i.quantity > 1 ? ` × ${i.quantity}` : ""}
          </p>
          <p class="text-sm text-muted-foreground tabular-nums">
            {i.spec.dimensions.width} W × {i.spec.dimensions.depth} D × {i.spec.dimensions.height} H
            mm
          </p>
          {i.spec.options.map((o) => (
            <p class="text-sm text-muted-foreground">
              {o.groupLabel}: {o.choiceLabel}
            </p>
          ))}
        </div>
        <Price cents={i.lineTotalCents} locale={locale} currency={currency} />
      </li>
    ))}
  </ul>
);

const Progress = ({ order }: { order: SelectOrder }) => {
  if (
    order.status === "cancelled" ||
    order.status === "refunded" ||
    order.status === "pending_payment"
  ) {
    return (
      <p class="rounded-sm border-2 bg-muted p-4 text-sm">
        <strong class="font-semibold">{STATUS_LABELS[order.status]}.</strong>{" "}
        {STATUS_DESCRIPTIONS[order.status]}
      </p>
    );
  }
  const at = WORKFLOW.indexOf(order.status);
  return (
    <ol class="grid gap-3 sm:grid-cols-6" aria-label="Order progress">
      {WORKFLOW.map((s, i) => (
        <li class="flex gap-3 sm:flex-col sm:gap-2" aria-current={i === at ? "step" : undefined}>
          <span
            class={`mt-1.5 h-2 w-2 shrink-0 rounded-full sm:mt-0 sm:h-1 sm:w-full ${i <= at ? "bg-product" : "bg-border"}`}
            aria-hidden="true"
          ></span>
          <span
            class={`text-sm ${i === at ? "font-medium" : i < at ? "" : "text-muted-foreground"}`}
          >
            {STATUS_LABELS[s]}
            <span class="sr-only">{i < at ? " (done)" : i === at ? " (current)" : ""}</span>
          </span>
        </li>
      ))}
    </ol>
  );
};

export const OrderPage = ({
  order,
  items,
  events,
  locale,
  justPaid,
  testPaymentUrl,
}: OrderProps) => (
  <div class="mx-auto max-w-3xl px-4 pt-12 sm:px-6 animate-in fade-in duration-500">
    <p class="text-sm italic text-muted-foreground">Order {order.ref}</p>
    <h1 class="mt-3 text-4xl">
      {order.paymentStatus === "paid" && justPaid
        ? `Thank you, ${order.name.split(" ")[0]}.`
        : STATUS_LABELS[order.status]}
    </h1>
    <p class="mt-3 text-muted-foreground">
      {order.paymentStatus === "paid" && justPaid
        ? "Your order is confirmed and the exact configuration you chose is saved for the workshop. Keep this page's link to follow its progress."
        : STATUS_DESCRIPTIONS[order.status]}
    </p>

    {testPaymentUrl && order.paymentStatus === "unpaid" ? (
      <form
        method="post"
        action={testPaymentUrl}
        class="mt-6 rounded-sm border-2 border-warning/40 bg-warning/15 p-4"
      >
        <p class="text-sm">
          No payment provider is configured, so this development site can simulate a successful
          payment.
        </p>
        <button type="submit" class={`${buttonPrimary} mt-3`}>
          Simulate payment
        </button>
      </form>
    ) : null}

    <section class="mt-10 space-y-4">
      <h2 class="font-display text-xl">Progress</h2>
      <Progress order={order} />
      <p class="text-sm text-muted-foreground">
        {leadTimeLabel(order.leadDays)} once the order is confirmed. Then:{" "}
        {order.deliveryLabel.toLowerCase()}.
      </p>
    </section>

    <section class="mt-10 space-y-4">
      <h2 class="font-display text-xl">What you ordered</h2>
      <OrderItems items={items} locale={locale} currency={order.currency} />
      <dl class="space-y-1.5 text-sm">
        <div class="flex justify-between">
          <dt class="text-muted-foreground">Subtotal</dt>
          <dd>
            <Price cents={order.subtotalCents} locale={locale} currency={order.currency} />
          </dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-muted-foreground">{order.deliveryLabel}</dt>
          <dd>
            <Price cents={order.deliveryCents} locale={locale} currency={order.currency} />
          </dd>
        </div>
        <div class="flex justify-between border-t-2 pt-2 text-base font-medium">
          <dt>Total</dt>
          <dd>
            <Price cents={order.totalCents} locale={locale} currency={order.currency} />
          </dd>
        </div>
      </dl>
    </section>

    <section class="mt-10 grid gap-8 sm:grid-cols-2">
      <div class="space-y-1 text-sm">
        <h2 class="mb-2 font-display text-xl">Delivering to</h2>
        <p>{order.name}</p>
        <p class="text-muted-foreground">{order.address.line1}</p>
        {order.address.line2 ? <p class="text-muted-foreground">{order.address.line2}</p> : null}
        <p class="text-muted-foreground">
          {order.address.city}
          {order.address.region ? `, ${order.address.region}` : ""} {order.address.postcode}
        </p>
        <p class="text-muted-foreground">{order.address.country}</p>
      </div>
      <div class="space-y-2 text-sm">
        <h2 class="mb-2 font-display text-xl">History</h2>
        <ol class="space-y-2">
          {[...events].reverse().map((e) => (
            <li>
              <span class="font-medium">{STATUS_LABELS[e.status]}</span>
              <span class="text-muted-foreground">, {formatDateShort(e.createdAt, locale)}</span>
              {e.note ? <span class="block text-muted-foreground">{e.note}</span> : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  </div>
);

export const OrderLookupPage = ({ error, ref }: { error?: string; ref?: string }) => (
  <div class="mx-auto max-w-md px-4 pt-16 sm:px-6">
    <h1 class="text-4xl">Track an order</h1>
    <p class="mt-3 text-muted-foreground">
      Your order reference is in your confirmation email, and starts with MH.
    </p>
    <form method="post" action="/orders/lookup" class="mt-8 space-y-4">
      <div class="space-y-1.5">
        <label for="ref" class="text-sm font-medium">
          Order reference
        </label>
        <input
          id="ref"
          name="ref"
          required
          value={ref ?? ""}
          autocomplete="off"
          class={`${inputClass} uppercase`}
        />
      </div>
      <div class="space-y-1.5">
        <label for="email" class="text-sm font-medium">
          Email used for the order
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autocomplete="email"
          class={inputClass}
        />
      </div>
      {error ? (
        <p class="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" class={`${buttonPrimary} w-full`}>
        Find my order
      </button>
    </form>
  </div>
);
