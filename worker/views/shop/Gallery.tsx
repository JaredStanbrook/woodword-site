// worker/views/shop/Gallery.tsx
//
// The storefront. One loud thing — the cover: a night panel in a heavy gilt
// frame, the first piece engraved on it in foil under a crescent moon — then
// the collection as square jewel-toned tiles beneath it.

import type { SelectProduct } from "@server/schema/product.schema";
import { specOf } from "@server/schema/product.schema";
import type { Category } from "@server/schema/furniture.config";
import { resizeParts, standardSelection } from "@server/lib/furniture";
import { formatPrice } from "@server/lib/money";
import { AVAILABILITY_STYLES, CATEGORY_LABELS, IsoDrawing, buttonPrimary, mediaUrl } from "./parts";
import { CoverFrame, Fleuron, NightSky } from "./ornaments";

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
  const ready = p.availability === "in_stock";
  const unavailable = p.availability === "sold_out";

  return (
    <article class={`group relative ${paletteClass(p)}`}>
      <div class="relative aspect-square overflow-hidden rounded-sm border-[3px] border-foreground bg-product-wash shadow">
        {photo ? (
          <img
            src={mediaUrl(photo)}
            alt=""
            loading="lazy"
            decoding="async"
            class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        ) : (
          <div class="absolute inset-0 p-[11%] transition-transform duration-700 group-hover:-translate-y-1">
            <IsoDrawing parts={resizeParts(spec, std)} />
          </div>
        )}
      </div>
      <div class="mt-5 space-y-1.5 text-center">
        <h2 class="font-display text-[2rem] font-bold leading-none">
          <a
            href={`/furniture/${p.slug}`}
            class="after:absolute after:inset-0 after:content-[''] focus:outline-none focus-visible:underline decoration-2 underline-offset-4"
          >
            {p.name}
          </a>
        </h2>
        <p class="mx-auto max-w-xs text-base leading-snug text-muted-foreground">{p.summary}</p>
        <p class="flex items-center justify-center gap-2 pt-1 text-base">
          <span class="font-semibold italic">
            from {formatPrice(item.fromCents, locale, currency)}
          </span>
          {ready || unavailable ? (
            <>
              <Fleuron class="h-1.5 w-1.5" />
              <span class={`font-semibold ${unavailable ? "text-destructive" : "text-success"}`}>
                {AVAILABILITY_STYLES[p.availability].label}
              </span>
            </>
          ) : null}
        </p>
      </div>
    </article>
  );
};

export const GalleryGrid = ({
  items,
  active,
  locale,
  currency,
}: Pick<GalleryProps, "items" | "active" | "locale" | "currency">) => (
  <div id="gallery-grid" class="grid gap-x-10 gap-y-16 sm:grid-cols-2 xl:grid-cols-3">
    {items.length === 0 ? (
      <div class="col-span-full py-16 text-center">
        <p class="font-display text-3xl">
          {active
            ? `No ${CATEGORY_LABELS[active].toLowerCase()} just now`
            : "The collection is being made"}
        </p>
        <p class="mt-3 text-muted-foreground">
          {active ? (
            <a href="/" class="underline decoration-2 underline-offset-4 hover:text-foreground">
              See everything in the collection
            </a>
          ) : (
            "New pieces are on the bench. Come back soon."
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
    aria-current={current ? "page" : undefined}
    class={`inline-flex h-11 shrink-0 items-center gap-2 text-lg font-semibold italic transition-colors ${
      current ? "text-foreground" : "text-muted-foreground hover:text-foreground"
    }`}
  >
    {current ? <Fleuron class="h-1.5 w-1.5" /> : null}
    {label}
  </a>
);

/**
 * The cover. The first piece in the collection, drawn in gold foil on a
 * night panel under a crescent moon, inside a heavy gilt frame that draws
 * itself in once, on arrival. It is the only motion on the page.
 */
const Cover = ({
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
  return (
    <figure class={`${paletteClass(p)} mx-auto w-full max-w-md`}>
      <a
        href={`/furniture/${p.slug}`}
        class="group relative block focus:outline-none"
        aria-label={p.name}
      >
        <div class="relative aspect-[4/5] overflow-hidden rounded-sm border-[3px] border-foreground bg-night shadow-lg">
          <div class="absolute inset-x-[18%] top-[12%] h-[24%]">
            <NightSky />
          </div>
          <div class="absolute inset-x-[12%] bottom-[11%] top-[36%] transition-transform duration-700 group-hover:-translate-y-1">
            <IsoDrawing parts={resizeParts(spec, standardSelection(spec))} class="iso-foil" />
          </div>
          <CoverFrame ratio={4 / 5} draw />
        </div>
      </a>
      <figcaption class="mt-4 text-center text-base italic text-muted-foreground">
        <a href={`/furniture/${p.slug}`} class="hover:text-foreground">
          {p.name}, from {formatPrice(item.fromCents, locale, currency)}
        </a>
      </figcaption>
    </figure>
  );
};

export const GalleryPage = (props: GalleryProps) => {
  const featured = props.items[0];
  return (
    <div>
      {props.active ? null : (
        <section class="mx-auto grid max-w-6xl items-center gap-14 px-5 pt-12 pb-20 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:pt-20">
          <div class="space-y-8">
            <h1 class="text-[3.4rem] leading-[0.95] sm:text-7xl xl:text-[5.5rem]">
              Made to measure, meant to outlast you.
            </h1>
            <p class="max-w-[34rem] text-xl leading-relaxed text-muted-foreground">
              Tables, cabinets and shelves built by hand to the size of your room. Turn each piece,
              change its measurements, and watch the price follow before you commit to a thing.
            </p>
            <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
              <a href="#collection" class={buttonPrimary}>
                Browse the collection
              </a>
              <a
                href="/made-to-measure"
                class="inline-flex h-11 items-center text-lg font-semibold italic underline decoration-2 underline-offset-[6px]"
              >
                How made to measure works
              </a>
            </div>
          </div>
          {featured ? (
            <Cover item={featured} locale={props.locale} currency={props.currency} />
          ) : null}
        </section>
      )}

      <section
        id="collection"
        class={`mx-auto max-w-6xl scroll-mt-16 px-5 sm:px-8 ${props.active ? "pt-12 lg:pt-20" : ""}`}
        aria-labelledby="collection-heading"
      >
        <div class="mb-12 flex flex-wrap items-end justify-between gap-x-10 gap-y-4 border-b-[3px] border-foreground pb-4">
          {props.active ? (
            <h1 id="collection-heading" class="text-6xl">
              {CATEGORY_LABELS[props.active]}
            </h1>
          ) : (
            <h2 id="collection-heading" class="font-display text-5xl font-bold leading-none">
              The collection
            </h2>
          )}
          <nav
            class="-mb-1 flex max-w-full gap-x-6 overflow-x-auto"
            aria-label="Filter by kind of piece"
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
        </div>
        <GalleryGrid {...props} />
      </section>
    </div>
  );
};
