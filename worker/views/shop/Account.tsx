// worker/views/shop/Account.tsx

import type { SelectOrder, SelectSavedDesign } from "@server/schema/shop.schema";
import type { SelectProduct } from "@server/schema/product.schema";
import { STATUS_LABELS, orderUrl } from "@server/services/order.service";
import { selectionToQuery } from "@server/lib/furniture";
import { formatDateShort } from "@views/lib/utils";
import { Price, buttonSecondary } from "./parts";

interface AccountProps {
  name: string;
  orders: SelectOrder[];
  designs: { design: SelectSavedDesign; product: SelectProduct }[];
  locale: string;
}

export const AccountPage = ({ name, orders, designs, locale }: AccountProps) => (
  <div class="mx-auto max-w-5xl px-4 pt-12 sm:px-6 animate-in fade-in duration-500">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <h1 class="text-4xl">Hello{name ? `, ${name}` : ""}</h1>
      <a href="/profile" class={buttonSecondary}>
        Sign-in and security
      </a>
    </div>

    <section class="mt-12 space-y-4" aria-labelledby="orders-heading">
      <h2 id="orders-heading" class="font-display text-2xl">
        Your orders
      </h2>
      {orders.length === 0 ? (
        <p class="text-sm text-muted-foreground">
          Orders you place while signed in appear here. For an order placed as a guest, use the link
          in its confirmation email, or{" "}
          <a href="/orders" class="underline underline-offset-4">
            track it by reference
          </a>
          .
        </p>
      ) : (
        <ul class="divide-y border-y">
          {orders.map((o) => (
            <li>
              <a
                href={orderUrl("", o)}
                class="flex flex-wrap items-center justify-between gap-3 py-4 hover:bg-accent/40 -mx-2 px-2 rounded"
              >
                <span>
                  <span class="font-medium">{o.ref}</span>
                  <span class="text-sm text-muted-foreground">
                    {" "}
                    · {formatDateShort(o.createdAt, locale)}
                  </span>
                </span>
                <span class="flex items-center gap-4 text-sm">
                  <span class="text-muted-foreground">{STATUS_LABELS[o.status]}</span>
                  <Price cents={o.totalCents} locale={locale} currency={o.currency} />
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>

    <section class="mt-12 space-y-4" aria-labelledby="designs-heading">
      <h2 id="designs-heading" class="font-display text-2xl">
        Saved designs
      </h2>
      {designs.length === 0 ? (
        <p class="text-sm text-muted-foreground">
          Use "Save or share this design" on any piece to keep a configuration here.
        </p>
      ) : (
        <ul class="grid gap-4 sm:grid-cols-2">
          {designs.map(({ design, product }) => (
            <li class="flex items-start justify-between gap-3 rounded-xl border bg-card p-4 text-card-foreground">
              <a
                href={`/furniture/${product.slug}?${selectionToQuery(design.selection)}`}
                class="min-w-0 space-y-1"
              >
                <span class="block font-medium hover:underline underline-offset-4">
                  {product.name}
                </span>
                <span class="block text-sm text-muted-foreground tabular-nums">
                  {design.selection.width} × {design.selection.depth} × {design.selection.height} mm
                </span>
                <span class="block text-xs text-muted-foreground">
                  Saved {formatDateShort(design.createdAt, locale)} ·{" "}
                  {`share link /d/${design.id.slice(0, 6)}…`}
                </span>
              </a>
              <form method="post" action={`/designs/${design.id}/delete`}>
                <button
                  type="submit"
                  aria-label={`Remove saved ${product.name}`}
                  class="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <i data-lucide="trash-2" class="h-4 w-4"></i>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  </div>
);
