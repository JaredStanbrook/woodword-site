// worker/views/shop/Gallery.tsx
//
// The storefront: a short statement, the category filter and the collection.
// The furniture does the talking; the interface stays quiet around it.

import type { SelectProduct } from "@server/schema/product.schema";
import { specOf } from "@server/schema/product.schema";
import type { Category } from "@server/schema/furniture.config";
import { resizeParts, standardSelection } from "@server/lib/furniture";
import {
  AvailabilityBadge,
  CATEGORY_LABELS,
  IsoDrawing,
  Price,
  mediaUrl,
  sizeLabel,
} from "./parts";

export interface GalleryItem {
  product: SelectProduct;
  fromCents: number;
}

interface GalleryProps {
  items: GalleryItem[];
  categories: Category[];
  active: Category | null;
  locale: string;
  currency: string;
  appName: string;
  tagline: string;
}

const PALETTE_CLASS: Record<string, string> = {
  oak: "palette-oak",
  walnut: "palette-walnut",
  ash: "palette-ash",
  ebony: "palette-ebony",
  cherry: "palette-cherry",
  sage: "palette-sage",
  clay: "palette-clay",
  slate: "palette-slate",
};

export const paletteClass = (p: SelectProduct) =>
  PALETTE_CLASS[p.design?.palette ?? "oak"] ?? "palette-oak";

export const ProductCard = ({
  item,
  locale,
  currency,
}: {
  item: GalleryItem;
  locale: string;
  currency: string;
}) => {
  const p = item.product;
  const spec = specOf(p);
  const std = standardSelection(spec);
  const photo = p.images[0];

  return (
    <article class={`group relative ${paletteClass(p)}`}>
      <a href={`/furniture/${p.slug}`} class="block" tabindex={-1} aria-hidden="true">
        <div class="relative aspect-[4/3] overflow-hidden rounded-xl bg-product-wash transition-colors">
          {photo ? (
            <img
              src={mediaUrl(photo)}
              alt=""
              loading="lazy"
              decoding="async"
              class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            />
          ) : (
            <div class="absolute inset-0 p-8 transition-transform duration-700 group-hover:scale-[1.03]">
              <IsoDrawing parts={resizeParts(spec, std)} />
            </div>
          )}
          <span class="absolute left-3 top-3">
            <AvailabilityBadge availability={p.availability} />
          </span>
        </div>
      </a>
      <div class="mt-4 flex items-start justify-between gap-4">
        <div class="min-w-0 space-y-1">
          <p class="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            {CATEGORY_LABELS[p.category]}
          </p>
          <h2 class="font-display text-xl leading-tight tracking-tight">
            <a
              href={`/furniture/${p.slug}`}
              class="after:absolute after:inset-0 after:content-[''] focus:outline-none focus-visible:underline"
            >
              {p.name}
            </a>
          </h2>
          <p class="line-clamp-2 text-sm text-muted-foreground">{p.summary}</p>
        </div>
        <p class="shrink-0 text-right text-sm">
          <span class="block text-xs text-muted-foreground">From</span>
          <Price cents={item.fromCents} locale={locale} currency={currency} />
        </p>
      </div>
      <p class="mt-2 text-xs text-muted-foreground tabular-nums">Standard {sizeLabel(std)}</p>
    </article>
  );
};

export const GalleryGrid = ({
  items,
  active,
  locale,
  currency,
}: Pick<GalleryProps, "items" | "active" | "locale" | "currency">) => (
  <div id="gallery-grid" class="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
    {items.length === 0 ? (
      <div class="col-span-full rounded-xl border border-dashed px-6 py-16 text-center">
        <p class="font-display text-xl">
          {active
            ? `No ${CATEGORY_LABELS[active].toLowerCase()} just now`
            : "The collection is being made"}
        </p>
        <p class="mt-2 text-sm text-muted-foreground">
          {active ? (
            <a href="/" class="underline underline-offset-4 hover:text-foreground">
              See everything in the collection
            </a>
          ) : (
            "New pieces are on the bench. Check back soon."
          )}
        </p>
      </div>
    ) : (
      items.map((item) => <ProductCard item={item} locale={locale} currency={currency} />)
    )}
  </div>
);

const FilterLink = ({
  href,
  label,
  current,
}: {
  href: string;
  label: string;
  current: boolean;
}) => (
  <a
    href={href}
    hx-get={href}
    hx-target="#gallery-grid"
    hx-select="#gallery-grid"
    hx-swap="outerHTML"
    hx-push-url="true"
    aria-current={current ? "page" : undefined}
    class={`inline-flex h-11 shrink-0 items-center rounded-full border px-4 text-sm transition-colors ${
      current
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
    }`}
  >
    {label}
  </a>
);

export const GalleryPage = (props: GalleryProps) => (
  <div class="animate-in fade-in duration-500">
    <section class="mx-auto max-w-7xl px-4 pt-14 pb-12 sm:px-6 sm:pt-20">
      <div class="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-end">
        <div class="space-y-6">
          <p class="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Handmade furniture, made to measure
          </p>
          <h1 class="text-4xl leading-[1.05] sm:text-6xl">
            Furniture drawn for you, <em class="italic">built</em> by hand.
          </h1>
        </div>
        <div class="space-y-5 lg:pb-2">
          <p class="max-w-md text-base leading-relaxed text-muted-foreground">
            {props.tagline ||
              "Every piece in the collection can be made to the size of your room. Turn it, resize it and see the price as you go — then we make exactly that."}
          </p>
          <a
            href="/made-to-measure"
            class="inline-flex h-11 items-center gap-2 text-sm font-medium underline-offset-4 hover:underline"
          >
            How made to measure works <i data-lucide="arrow-right" class="h-4 w-4"></i>
          </a>
        </div>
      </div>
    </section>

    <section
      id="collection"
      class="mx-auto max-w-7xl px-4 sm:px-6"
      aria-labelledby="collection-heading"
    >
      <h2 id="collection-heading" class="sr-only">
        The collection
      </h2>
      <nav
        class="-mx-4 mb-10 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0"
        aria-label="Filter by category"
      >
        <FilterLink href="/" label="Everything" current={props.active === null} />
        {props.categories.map((cat) => (
          <FilterLink
            href={`/?category=${cat}`}
            label={CATEGORY_LABELS[cat]}
            current={props.active === cat}
          />
        ))}
      </nav>
      <GalleryGrid {...props} />
    </section>
  </div>
);
