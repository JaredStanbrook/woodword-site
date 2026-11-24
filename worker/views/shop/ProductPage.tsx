// worker/views/shop/ProductPage.tsx
//
// One product, presented its own way. The `design` record chooses a layout,
// a palette and a typeface, and supplies the copy; the configurator, the 3D
// view, the price and the cart form are the same components on every page,
// so buying works identically whichever layout a piece uses.
//
// Adding a layout: write a component below with the same props, add its name
// to LAYOUTS in schema/furniture.config.ts, and map it in LAYOUT_VIEWS.

import type { FC } from "hono/jsx";
import type { SelectProduct } from "@server/schema/product.schema";
import { specOf } from "@server/schema/product.schema";
import type { Layout, Selection } from "@server/schema/furniture.config";
import { resizeParts, type Quote } from "@server/lib/furniture";
import { Configurator, type ConfiguratorProps } from "./Configurator";
import { paletteClass } from "./Gallery";
import { AvailabilityBadge, IsoDrawing, mediaUrl } from "./parts";
import { Flourish } from "./ornaments";

export interface ProductPageProps extends ConfiguratorProps {
  /** Admin preview of an unpublished piece. */
  preview?: boolean;
}

const TYPE_CLASS: Record<string, string> = {
  serif: "type-serif",
  sans: "type-sans",
  display: "type-display",
};

// ==========================================
// SHARED PIECES
// ==========================================

export const Viewer = ({
  product,
  selection,
  class: cls = "",
}: {
  product: SelectProduct;
  selection: Selection;
  class?: string;
}) => (
  <furniture-viewer class={`relative block overflow-hidden bg-product-wash ${cls}`} data-viewer>
    {/* Never catches a pointer: once the 3D view loads underneath, a drag
        has to reach its canvas, and an invisible element still takes touches. */}
    <div
      class="pointer-events-none absolute inset-0 p-[8%] transition-opacity duration-500"
      data-viewer-fallback
    >
      <IsoDrawing parts={resizeParts(specOf(product), selection)} />
    </div>
    <div class="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
      <p
        class="hidden rounded-sm bg-background/80 px-3 py-1.5 text-sm italic text-muted-foreground backdrop-blur"
        data-viewer-hint
      >
        Drag to turn<span class="hidden sm:inline">, pinch or scroll to zoom</span>
      </p>
      <button
        type="button"
        class="pointer-events-auto hidden h-11 items-center gap-1.5 rounded-full bg-background/80 px-4 text-xs font-medium backdrop-blur hover:bg-background"
        data-viewer-reset
      >
        <i data-lucide="rotate-ccw" class="h-3.5 w-3.5"></i> Reset view
      </button>
    </div>
    <p class="sr-only">
      An interactive 3D model of the {product.name} that follows the size and finish chosen below.
    </p>
  </furniture-viewer>
);

const PreviewBanner = ({ product }: { product: SelectProduct }) => (
  <div class="border-b-2 border-warning/40 bg-warning/15 text-foreground">
    <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm sm:px-6">
      <p>
        <strong class="font-semibold">Preview.</strong> This page is{" "}
        {product.status === "published" ? "live" : `a ${product.status}`} — customers{" "}
        {product.status === "published" ? "see it as shown" : "cannot see it yet"}.
      </p>
      <a
        href={`/admin/products/${product.id}`}
        class="inline-flex h-11 items-center gap-1.5 font-medium underline-offset-4 hover:underline"
      >
        <i data-lucide="pencil" class="h-3.5 w-3.5"></i> Edit product
      </a>
    </div>
  </div>
);

const Photos = ({ product, class: cls = "" }: { product: SelectProduct; class?: string }) =>
  product.images.length === 0 ? null : (
    <div class={`grid gap-3 sm:grid-cols-2 ${cls}`}>
      {product.images.map((key, i) => (
        <img
          src={mediaUrl(key)}
          alt={`${product.name}, photograph ${i + 1}`}
          loading="lazy"
          decoding="async"
          class={`w-full rounded-sm object-cover ${i === 0 && product.images.length % 2 === 1 ? "sm:col-span-2 aspect-[16/9]" : "aspect-[4/3]"}`}
        />
      ))}
    </div>
  );

const DimensionTable = ({ product }: { product: SelectProduct }) => (
  <div class="overflow-x-auto">
    <table class="w-full text-sm tabular-nums">
      <caption class="sr-only">Standard size and the range it can be made in</caption>
      <thead>
        <tr class="border-b-2 text-left text-sm italic text-muted-foreground">
          <th scope="col" class="py-2 pr-4 font-medium">
            Dimension
          </th>
          <th scope="col" class="py-2 pr-4 font-medium">
            Standard
          </th>
          <th scope="col" class="py-2 pr-4 font-medium">
            Minimum
          </th>
          <th scope="col" class="py-2 font-medium">
            Maximum
          </th>
        </tr>
      </thead>
      <tbody>
        {(["width", "height", "depth"] as const).map((k) => (
          <tr class="border-b-2 last:border-0">
            <th scope="row" class="py-2.5 pr-4 text-left font-medium capitalize">
              {k}
            </th>
            <td class="py-2.5 pr-4">{product.dimensions[k].standard} mm</td>
            <td class="py-2.5 pr-4 text-muted-foreground">{product.dimensions[k].min} mm</td>
            <td class="py-2.5 text-muted-foreground">{product.dimensions[k].max} mm</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Paragraphs = ({ text, class: cls = "" }: { text: string; class?: string }) => (
  <>
    {text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => (
        <p class={cls}>{p}</p>
      ))}
  </>
);

const CareNote = ({ product }: { product: SelectProduct }) =>
  product.design.care ? (
    <div class="space-y-2">
      <h2 class="font-heading text-lg">Living with it</h2>
      <Paragraphs
        text={product.design.care}
        class="text-sm leading-relaxed text-muted-foreground"
      />
    </div>
  ) : null;

// ==========================================
// ARCHITECTURAL — a spec sheet: grid, hairlines, numbered sections
// ==========================================

const Architectural: FC<ProductPageProps> = (props) => {
  const { product: p } = props;
  const d = p.design;
  return (
    <div class="mx-auto max-w-7xl px-4 sm:px-6">
      <div class="grid gap-10 pt-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-14 lg:pt-12">
        <div class="lg:sticky lg:top-8 lg:self-start">
          <Viewer
            product={p}
            selection={props.selection}
            class="aspect-[4/3] rounded-sm border-2"
          />
        </div>
        <div class="space-y-8">
          <header class="space-y-4 border-b-2 pb-8">
            <AvailabilityBadge availability={p.availability} />
            <h1 class="text-4xl leading-none sm:text-5xl">{p.name}</h1>
            {d.headline ? <p class="text-lg leading-snug text-product-ink">{d.headline}</p> : null}
            <p class="leading-relaxed text-muted-foreground">{d.intro || p.summary}</p>
          </header>
          <Configurator {...props} />
        </div>
      </div>

      <section class="mt-24 grid gap-px overflow-hidden border-2 bg-border sm:grid-cols-2 lg:grid-cols-3">
        {d.highlights.map((h) => (
          <div class="bg-background p-6">
            <p class="text-sm italic text-muted-foreground">{h.label}</p>
            <p class="mt-2 font-heading text-2xl">{h.value}</p>
          </div>
        ))}
      </section>

      <section class="mt-16 grid gap-12 lg:grid-cols-[1fr_2fr]">
        <div class="space-y-6">
          <h2 class="font-heading text-2xl">Dimensions</h2>
          <DimensionTable product={p} />
          <CareNote product={p} />
        </div>
        <div class="divide-y-2 border-y-2">
          {d.story.map((s) => (
            <article class="grid gap-3 py-8 sm:grid-cols-[4rem_1fr]">
              <span class="pt-2" aria-hidden="true">
                <span class="inline-block h-2.5 w-2.5 rotate-45 bg-foreground"></span>
              </span>
              <div class="space-y-3">
                <h3 class="font-heading text-xl">{s.heading}</h3>
                <Paragraphs text={s.body} class="leading-relaxed text-muted-foreground" />
              </div>
            </article>
          ))}
          {p.description ? (
            <div class="space-y-4 py-8">
              <Paragraphs text={p.description} class="leading-relaxed text-muted-foreground" />
            </div>
          ) : null}
        </div>
      </section>
      <Photos product={p} class="mt-16" />
    </div>
  );
};

// ==========================================
// HERITAGE — warm and centred: serif, ornament, a washed band
// ==========================================

const Ornament = () => <Flourish class="mx-auto max-w-xs" />;

const Heritage: FC<ProductPageProps> = (props) => {
  const { product: p } = props;
  const d = p.design;
  return (
    <div>
      <header class="mx-auto max-w-3xl space-y-6 px-4 pt-14 pb-12 text-center sm:px-6 sm:pt-20">
        <h1 class="text-5xl leading-[1.02] sm:text-7xl">{p.name}</h1>
        <Ornament />
        {d.headline ? <p class="font-heading text-xl italic leading-snug">{d.headline}</p> : null}
        <p class="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground">
          {d.intro || p.summary}
        </p>
        <div class="flex justify-center">
          <AvailabilityBadge availability={p.availability} />
        </div>
      </header>

      <section class="bg-product-wash py-10 sm:py-14">
        <div class="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div class="lg:sticky lg:top-8 lg:self-start">
            <Viewer
              product={p}
              selection={props.selection}
              class="aspect-square rounded-sm border-[3px] border-foreground sm:aspect-[5/4]"
            />
          </div>
          <div class="rounded-sm bg-background p-5 sm:p-8">
            <Configurator {...props} />
          </div>
        </div>
      </section>

      <section class="mx-auto max-w-5xl space-y-16 px-4 pt-20 sm:px-6">
        {d.story.map((s, i) => (
          <article class={`grid items-start gap-6 md:grid-cols-2 md:gap-14`}>
            <h2
              class={`font-heading text-3xl italic leading-tight text-product-ink ${i % 2 === 1 ? "md:order-2" : ""}`}
            >
              {s.heading}
            </h2>
            <div class="space-y-4">
              <Paragraphs text={s.body} class="text-lg leading-relaxed text-muted-foreground" />
            </div>
          </article>
        ))}
        {p.description ? (
          <div class="mx-auto max-w-2xl space-y-4 text-center">
            <Ornament />
            <Paragraphs
              text={p.description}
              class="text-lg leading-relaxed text-muted-foreground"
            />
          </div>
        ) : null}
      </section>

      <section class="mx-auto mt-20 grid max-w-5xl gap-10 px-4 sm:px-6 md:grid-cols-2">
        <div class="min-w-0 rounded-sm border-2 p-6 sm:p-8">
          <h2 class="mb-4 font-heading text-2xl">Sizes</h2>
          <DimensionTable product={p} />
        </div>
        <div class="min-w-0 space-y-6 rounded-sm border-[3px] border-foreground bg-card p-6 sm:p-8">
          {d.highlights.length ? (
            <dl class="grid grid-cols-2 gap-5">
              {d.highlights.map((h) => (
                <div>
                  <dt class="text-sm italic text-muted-foreground">{h.label}</dt>
                  <dd class="font-heading text-xl">{h.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <CareNote product={p} />
        </div>
      </section>
      <div class="mx-auto max-w-5xl px-4 sm:px-6">
        <Photos product={p} class="mt-16" />
      </div>
    </div>
  );
};

// ==========================================
// GEOMETRIC — blocks and big numbers, an extended face
// ==========================================

const Geometric: FC<ProductPageProps> = (props) => {
  const { product: p } = props;
  const d = p.design;
  return (
    <div>
      <section class="border-b-[3px] border-foreground bg-product-wash text-night-foreground">
        <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
          <AvailabilityBadge availability={p.availability} />
          <h1 class="mt-6 max-w-4xl break-words text-5xl leading-[1.02] sm:text-7xl">{p.name}</h1>
          {d.headline ? (
            <p class="mt-6 max-w-2xl text-lg text-night-foreground/85">{d.headline}</p>
          ) : null}
        </div>
      </section>

      <div class="mx-auto max-w-7xl px-4 sm:px-6">
        <div class="grid border-x-2 border-b-2 lg:grid-cols-2">
          <div class="border-b-2 lg:border-b-0 lg:border-r-2">
            <div class="lg:sticky lg:top-0">
              <Viewer product={p} selection={props.selection} class="aspect-square" />
            </div>
          </div>
          <div class="space-y-8 p-5 sm:p-8">
            <p class="leading-relaxed text-muted-foreground">{d.intro || p.summary}</p>
            <Configurator {...props} />
          </div>
        </div>

        {d.highlights.length ? (
          <section class="grid grid-cols-2 border-x-2 border-b-2 md:grid-cols-3">
            {d.highlights.map((h) => (
              <div class="border-b-2 border-r-2 p-6 [&:nth-child(2n)]:border-r-0 md:[&:nth-child(2n)]:border-r md:[&:nth-child(3n)]:border-r-0">
                <p class="font-heading text-2xl leading-tight">{h.value}</p>
                <p class="mt-2 text-sm italic text-muted-foreground">{h.label}</p>
              </div>
            ))}
          </section>
        ) : null}

        <section class="mt-16 grid gap-6 md:grid-cols-3">
          {d.story.map((s) => (
            <article class="space-y-3 border-t-4 border-product pt-5">
              <h2 class="font-heading text-xl">{s.heading}</h2>
              <Paragraphs text={s.body} class="text-sm leading-relaxed text-muted-foreground" />
            </article>
          ))}
        </section>

        <section class="mt-16 grid gap-10 md:grid-cols-[2fr_1fr]">
          <div class="space-y-4">
            <h2 class="font-heading text-xl">Size range</h2>
            <DimensionTable product={p} />
            {p.description ? (
              <div class="space-y-4 pt-6">
                <Paragraphs text={p.description} class="leading-relaxed text-muted-foreground" />
              </div>
            ) : null}
          </div>
          <CareNote product={p} />
        </section>
        <Photos product={p} class="mt-16" />
      </div>
    </div>
  );
};

// ==========================================
// EDITORIAL — a magazine spread: image first, columns, a drop cap
// ==========================================

const Editorial: FC<ProductPageProps> = (props) => {
  const { product: p } = props;
  const d = p.design;
  const photo = p.images[0];
  return (
    <div>
      <section class="relative">
        {photo ? (
          <img
            src={mediaUrl(photo)}
            alt={`${p.name}`}
            class="h-[62vh] min-h-[22rem] w-full object-cover"
          />
        ) : (
          <div class="h-[52vh] min-h-[20rem] w-full bg-product-wash p-[6%]">
            <IsoDrawing
              parts={resizeParts(specOf(p), props.selection)}
              size={props.selection}
              dims
            />
          </div>
        )}
      </section>
      <div class="mx-auto max-w-6xl px-4 sm:px-6">
        <header class="-mt-16 relative bg-background px-2 pt-10 sm:-mt-24 sm:px-10">
          <h1 class="text-5xl leading-[0.98] sm:text-7xl">{p.name}</h1>
          {d.headline ? (
            <p class="mt-6 max-w-3xl font-heading text-2xl leading-snug text-muted-foreground">
              {d.headline}
            </p>
          ) : null}
        </header>

        <section class="mt-12 gap-10 px-2 sm:px-10 md:columns-2">
          <p class="mb-6 break-inside-avoid text-lg leading-relaxed first-letter:float-left first-letter:mr-3 first-letter:font-heading first-letter:text-7xl first-letter:leading-[0.8] first-letter:text-product">
            {d.intro || p.summary}
          </p>
          {d.story.map((s) => (
            <div class="mb-6 break-inside-avoid space-y-2">
              <h2 class="font-heading text-xl">{s.heading}</h2>
              <Paragraphs text={s.body} class="leading-relaxed text-muted-foreground" />
            </div>
          ))}
          {p.description ? (
            <div class="mb-6 break-inside-avoid space-y-3">
              <Paragraphs text={p.description} class="leading-relaxed text-muted-foreground" />
            </div>
          ) : null}
        </section>

        <section class="mt-16 border-t-2 pt-12">
          <div class="mb-8 flex flex-wrap items-end justify-between gap-4 px-2 sm:px-10">
            <h2 class="font-heading text-4xl">Make it yours</h2>
            <AvailabilityBadge availability={p.availability} />
          </div>
          <div class="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div class="lg:sticky lg:top-8 lg:self-start">
              <Viewer product={p} selection={props.selection} class="aspect-[4/3] rounded-sm" />
            </div>
            <Configurator {...props} />
          </div>
        </section>

        <section class="mt-16 grid gap-10 border-t-2 pt-12 md:grid-cols-3">
          <div class="md:col-span-2">
            <DimensionTable product={p} />
          </div>
          <div class="space-y-6">
            {d.highlights.map((h) => (
              <p class="border-l-2 border-product pl-4">
                <span class="block text-sm italic text-muted-foreground">{h.label}</span>
                <span class="font-heading text-lg">{h.value}</span>
              </p>
            ))}
            <CareNote product={p} />
          </div>
        </section>
        <Photos product={p} class="mt-16" />
      </div>
    </div>
  );
};

const LAYOUT_VIEWS: Record<Layout, FC<ProductPageProps>> = {
  architectural: Architectural,
  heritage: Heritage,
  geometric: Geometric,
  editorial: Editorial,
};

export const ProductPage: FC<ProductPageProps> = (props) => {
  const { product } = props;
  const View = LAYOUT_VIEWS[product.design.layout] ?? Architectural;
  const type = TYPE_CLASS[product.design.typeface] ?? "type-serif";
  return (
    <div class={`${paletteClass(product)} ${type} animate-in fade-in duration-500`}>
      {props.preview ? <PreviewBanner product={product} /> : null}
      <View {...props} />
    </div>
  );
};

export type { Quote };
