// worker/views/shop/Cart.tsx

import type { CartLine } from "@server/services/cart.service";
import { chosenOptions, resizeParts, selectionToQuery } from "@server/lib/furniture";
import { specOf } from "@server/schema/product.schema";
import { MAX_QUANTITY } from "@server/config/shop.config";
import { paletteClass } from "./Gallery";
import {
  IsoDrawing,
  Price,
  buttonPrimary,
  buttonSecondary,
  leadTimeLabel,
  mediaUrl,
} from "./parts";

interface CartProps {
  lines: CartLine[];
  locale: string;
  currency: string;
}

export const LineThumb = ({ line, small = false }: { line: CartLine; small?: boolean }) => {
  const photo = line.product.images[0];
  return (
    <div
      class={`${paletteClass(line.product)} aspect-square shrink-0 overflow-hidden rounded-sm bg-product-wash ${small ? "w-16" : "w-24 sm:w-32"}`}
    >
      {photo && !line.quote.custom ? (
        <img src={mediaUrl(photo)} alt="" class="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div class={`h-full w-full ${small ? "p-1.5" : "p-3"}`}>
          <IsoDrawing parts={resizeParts(specOf(line.product), line.item.selection)} />
        </div>
      )}
    </div>
  );
};

export const LineDetails = ({ line }: { line: CartLine }) => {
  const sel = line.item.selection;
  const options = chosenOptions(specOf(line.product), sel);
  return (
    <ul class="space-y-0.5 text-sm text-muted-foreground">
      <li class="tabular-nums">
        {sel.width} W × {sel.depth} D × {sel.height} H mm
        {line.quote.custom ? <span class="italic text-product-ink">, your size</span> : null}
      </li>
      {options.map((o) => (
        <li>
          {o.groupLabel}: {o.choice.label}
        </li>
      ))}
    </ul>
  );
};

export const CartPage = ({ lines, locale, currency }: CartProps) => {
  const subtotal = lines.reduce((s, l) => s + l.lineTotalCents, 0);
  const blocked = lines.some((l) => !l.available);
  const lead = Math.max(0, ...lines.map((l) => l.quote.leadDays));

  return (
    <div class="mx-auto max-w-5xl px-4 pt-12 sm:px-6 animate-in fade-in duration-500">
      <h1 class="text-4xl">Your cart</h1>
      {lines.length === 0 ? (
        <div class="mt-10 rounded-sm border-2 border-dashed px-6 py-16 text-center">
          <p class="font-display text-xl">Nothing here yet</p>
          <p class="mt-2 text-sm text-muted-foreground">
            Choose a piece, set it to your size, and add it here.
          </p>
          <a href="/" class={`${buttonPrimary} mt-6`}>
            Browse the collection
          </a>
        </div>
      ) : (
        <div class="mt-10 grid gap-10 lg:grid-cols-[1fr_20rem]">
          <ul class="divide-y-2 border-y-2" id="cart-lines">
            {lines.map((line) => (
              <li class="flex gap-4 py-6 sm:gap-6" id={`cart-line-${line.item.id}`}>
                <LineThumb line={line} />
                <div class="min-w-0 flex-1 space-y-3">
                  <div class="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 class="font-display text-lg leading-tight">
                        <a
                          href={`/furniture/${line.product.slug}`}
                          class="hover:underline underline-offset-4"
                        >
                          {line.product.name}
                        </a>
                      </h2>
                      <LineDetails line={line} />
                    </div>
                    <p class="text-right">
                      <Price cents={line.lineTotalCents} locale={locale} currency={currency} />
                      {line.item.quantity > 1 ? (
                        <span class="block text-xs text-muted-foreground">
                          <Price
                            cents={line.quote.totalCents}
                            locale={locale}
                            currency={currency}
                          />{" "}
                          each
                        </span>
                      ) : null}
                    </p>
                  </div>
                  {!line.available ? (
                    <p class="text-sm text-destructive">
                      This piece is no longer available. Remove it to check out.
                    </p>
                  ) : null}
                  <div class="flex flex-wrap items-center gap-2">
                    <form
                      method="post"
                      action={`/cart/${line.item.id}/quantity`}
                      class="flex items-center gap-2"
                    >
                      <label class="sr-only" for={`qty-${line.item.id}`}>
                        Quantity of {line.product.name}
                      </label>
                      <input
                        id={`qty-${line.item.id}`}
                        type="number"
                        name="quantity"
                        min="1"
                        max={MAX_QUANTITY}
                        value={line.item.quantity}
                        inputmode="numeric"
                        class="h-11 w-20 rounded-sm border-2 border-input bg-background px-3 text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button
                        type="submit"
                        class="h-11 rounded-sm px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      >
                        Update
                      </button>
                    </form>
                    {line.available ? (
                      <a
                        href={`/furniture/${line.product.slug}?${selectionToQuery(line.item.selection)}&item=${line.item.id}`}
                        class="inline-flex h-11 items-center gap-1.5 rounded-sm px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      >
                        <i data-lucide="pencil" class="h-3.5 w-3.5"></i> Edit
                      </a>
                    ) : null}
                    <form method="post" action={`/cart/${line.item.id}/remove`}>
                      <button
                        type="submit"
                        class="inline-flex h-11 items-center gap-1.5 rounded-sm px-3 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <i data-lucide="trash-2" class="h-3.5 w-3.5"></i> Remove
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <aside class="h-fit space-y-4 rounded-sm border-2 bg-card p-5 text-card-foreground shadow-sm lg:sticky lg:top-8">
            <div class="flex justify-between">
              <span class="text-muted-foreground">Subtotal</span>
              <Price cents={subtotal} locale={locale} currency={currency} />
            </div>
            <p class="text-sm text-muted-foreground">
              Delivery is chosen at checkout. {leadTimeLabel(lead)} before it leaves us.
            </p>
            {blocked ? (
              <p class="text-sm text-destructive">Remove the unavailable piece to continue.</p>
            ) : (
              <a href="/checkout" class={`${buttonPrimary} w-full`}>
                Checkout
              </a>
            )}
            <a href="/" class={`${buttonSecondary} w-full`}>
              Keep browsing
            </a>
          </aside>
        </div>
      )}
    </div>
  );
};
