// worker/views/shop/Gallery.tsx
//
// The storefront. One loud thing — the cover: a night panel in a heavy gilt
// frame, the first piece engraved on it in foil under a crescent moon — then
// the collection as square jewel-toned tiles beneath it.

import type { SelectProduct } from "@server/schema/product.schema";
import { specOf } from "@server/schema/product.schema";
import type { Category, Selection } from "@server/schema/furniture.config";
import { resizeParts, standardSelection } from "@server/lib/furniture";
import { formatPrice } from "@server/lib/money";
import { CATEGORY_LABELS, IsoDrawing, buttonPrimary, mediaUrl } from "./parts";
import { CoverFrame, Fleuron, NightSky } from "./ornaments";
import { designClass } from "@server/designs/blocks";

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

/**
 * How the collection is laid out, in rows of three on wide screens: a row is
 * either one wide piece beside an ordinary one, or three ordinary ones. As
 * many rows as possible get a wide piece, the wide one switching sides from
 * row to row, so the page reads as a spread rather than a grid of identical
 * cards. Pieces keep their order; the first is always wide.
 */
export function collectionLayout(count: number): { wide: boolean }[] {
  let wideRows = Math.floor(count / 2);
  while (wideRows > 0 && (count - wideRows * 2) % 3 !== 0) wideRows--;
  const plainRows = (count - wideRows * 2) / 3;
  if (!Number.isInteger(plainRows)) return Array.from({ length: count }, () => ({ wide: false }));

  const rows: boolean[][] = [];
  let left = true;
  let plain = plainRows;
  for (let r = 0; r < wideRows; r++) {
    rows.push(left ? [true, false] : [false, true]);
    left = !left;
    // A row of three ordinary pieces after every second wide row.
    if (r % 2 === 1 && plain > 0) {
      rows.push([false, false, false]);
      plain--;
    }
  }
  while (plain-- > 0) rows.push([false, false, false]);
  return rows.flat().map((wide) => ({ wide }));
}

const priceLine = (item: GalleryItem, locale: string, currency: string) => {
  const a = item.product.availability;
  const note = a === "in_stock" ? ", ready to ship" : a === "sold_out" ? ", not available" : "";
  return `from ${formatPrice(item.fromCents, locale, currency)}${note}`;
};

const photoClass = "h-full w-full object-cover group-hover:scale-[1.03]";

/**
 * A card's picture: the drawing with no photos, the photo with one, and with
 * more a stack that <photo-cycle> turns through (components/shop/PhotoCycle.ts).
 * Only the first loads with the page; the island loads each next one just
 * before it is shown.
 */
const Picture = ({ item, std }: { item: GalleryItem; std: Selection }) => {
  const p = item.product;
  const [first, ...rest] = p.images;
  if (!first) {
    return (
      <div class="absolute inset-0 p-[7%] transition-transform duration-700 group-hover:-translate-y-1">
        <IsoDrawing parts={resizeParts(specOf(p), std)} size={std} dims />
      </div>
    );
  }
  if (!rest.length) {
    return (
      <img
        src={mediaUrl(first)}
        alt=""
        loading="lazy"
        decoding="async"
        class={`${photoClass} transition-transform duration-700`}
      />
    );
  }
  return (
    <photo-cycle class="absolute inset-0 block">
      <img
        src={mediaUrl(first)}
        alt=""
        loading="lazy"
        decoding="async"
        class={`absolute inset-0 opacity-100 transition-[opacity,scale] duration-1000 ${photoClass}`}
      />
      {rest.map((key) => (
        <img
          data-src={mediaUrl(key)}
          alt=""
          decoding="async"
          class={`absolute inset-0 opacity-0 transition-[opacity,scale] duration-1000 ${photoClass}`}
        />
      ))}
    </photo-cycle>
  );
};

export const ProductCard = ({
  item,
  locale,
  currency,
  wide = false,
}: {
  item: GalleryItem;
  locale: string;
  currency: string;
  wide?: boolean;
}) => {
  const p = item.product;
  const std = standardSelection(specOf(p));
  const href = `/furniture/${p.slug}`;
  const name = (
    <a
      href={href}
      class="after:absolute after:inset-0 after:content-[''] focus:outline-none focus-visible:underline decoration-2 underline-offset-4"
    >
      {p.name}
    </a>
  );

  if (wide) {
    return (
      <article class={`group relative sm:col-span-2 ${designClass(p)}`}>
        <div class="relative overflow-hidden rounded-sm border-[3px] border-foreground bg-product-wash text-night-foreground shadow transition-[transform,box-shadow] duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lg sm:grid sm:aspect-[2/1] sm:grid-cols-[1.4fr_1fr]">
          <div class="relative aspect-square sm:aspect-auto">
            <Picture item={item} std={std} />
          </div>
          <div class="hidden flex-col justify-end gap-3 border-l-2 border-night-foreground/15 p-7 sm:flex">
            <h2 class="font-display text-4xl font-bold leading-[0.95] xl:text-5xl">{name}</h2>
            <p class="text-base leading-snug text-night-foreground/80">{p.summary}</p>
            <p class="text-lg font-semibold italic text-gilt">
              {priceLine(item, locale, currency)}
            </p>
          </div>
        </div>
        {/* Small screens: the same one-line caption as every other piece. */}
        <div class="mt-3 flex items-baseline justify-between gap-4 sm:hidden">
          <h2 class="font-display text-[1.75rem] font-bold leading-none">{name}</h2>
          <p class="shrink-0 text-base font-semibold italic">{priceLine(item, locale, currency)}</p>
        </div>
      </article>
    );
  }

  return (
    <article class={`group relative ${designClass(p)}`}>
      <div class="relative aspect-square overflow-hidden rounded-sm border-[3px] border-foreground bg-product-wash shadow transition-[transform,box-shadow] duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lg">
        <Picture item={item} std={std} />
      </div>
      <div class="mt-3 flex items-baseline justify-between gap-4">
        <h2 class="font-display text-[1.75rem] font-bold leading-none">{name}</h2>
        <p class="shrink-0 text-base font-semibold italic">{priceLine(item, locale, currency)}</p>
      </div>
    </article>
  );
};

export const GalleryGrid = ({
  items,
  active,
  locale,
  currency,
}: Pick<GalleryProps, "items" | "active" | "locale" | "currency">) => {
  const layout = collectionLayout(items.length);
  return (
    <div
      id="gallery-grid"
      class="grid gap-x-8 gap-y-12 sm:grid-flow-dense sm:grid-cols-2 xl:grid-cols-3"
    >
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
        items.map((item, i) => (
          <ProductCard item={item} locale={locale} currency={currency} wide={layout[i]?.wide} />
        ))
      )}
    </div>
  );
};

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
    <figure class={`${designClass(p)} mx-auto w-full max-w-md`}>
      <a
        href={`/furniture/${p.slug}`}
        class="group relative block focus:outline-none"
        aria-label={p.name}
      >
        <div class="relative aspect-[4/5] overflow-hidden rounded-sm border-[3px] border-foreground bg-night shadow transition-[transform,box-shadow] duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lg">
          <div class="absolute inset-x-[18%] top-[12%] h-[24%]">
            <NightSky />
          </div>
          <div class="absolute inset-x-[10%] bottom-[10%] top-[33%] transition-transform duration-700 group-hover:-translate-y-1">
            <IsoDrawing
              parts={resizeParts(spec, standardSelection(spec))}
              size={standardSelection(spec)}
              foil
              dims
            />
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
          <nav class="-mb-1 flex max-w-full flex-wrap gap-x-6" aria-label="Filter by kind of piece">
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
