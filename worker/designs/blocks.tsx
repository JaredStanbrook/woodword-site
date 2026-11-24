// worker/designs/blocks.tsx
//
// The pieces every product page is built from. A design arranges and styles
// these however it likes, but it does not rebuild them: buying, sizing and the
// 3D view must work the same on every page, and tests/designs.test.tsx checks
// that each design still carries all of them.

import type { SelectProduct } from "@server/schema/product.schema";
import { specOf } from "@server/schema/product.schema";
import { BLUEPRINTS, type Blueprint, type Selection } from "@server/schema/furniture.config";
import { resizeParts } from "@server/lib/furniture";
import { AvailabilityBadge, IsoDrawing, mediaUrl } from "@views/shop/parts";
import { Configurator } from "@views/shop/Configurator";
import type { SlotDef } from "./types";

export { AvailabilityBadge, Configurator };

/** The class that gives a piece its design's colours, anywhere it appears. */
export const designClass = (p: SelectProduct) => `design-${p.design?.id || "draft"}`;

// ==========================================
// PHOTO SLOTS
// ==========================================

export type SlotSource = { image: string } | { blueprint: Blueprint };

/** What fills a slot: the chosen photo, a chosen drawing, or the design's own fallback. */
export function slotSource(p: SelectProduct, slot: SlotDef): SlotSource {
  const v = p.design?.photos?.[slot.key];
  if (v && p.images.includes(v)) return { image: v };
  const kind = v?.startsWith("blueprint:") ? v.slice("blueprint:".length) : "";
  if ((BLUEPRINTS as readonly string[]).includes(kind)) return { blueprint: kind as Blueprint };
  return { blueprint: slot.fallback };
}

/**
 * One photo slot. A photo fills the box (object-cover); a drawing sits on the
 * product's dark panel, or on the night panel in gilt. Size the box with
 * `class`; `data-slot` and `data-fill` are there for a design's CSS to hook.
 */
export const Photo = ({
  product,
  selection,
  slot,
  alt,
  class: cls = "",
  imgClass = "",
  eager = false,
}: {
  product: SelectProduct;
  selection: Selection;
  slot: SlotDef;
  alt?: string;
  class?: string;
  imgClass?: string;
  /** Load straight away (a hero), rather than lazily. */
  eager?: boolean;
}) => {
  const src = slotSource(product, slot);
  if ("image" in src) {
    return (
      <figure class={`relative overflow-hidden ${cls}`} data-slot={slot.key} data-fill="photo">
        <img
          src={mediaUrl(src.image)}
          alt={alt ?? `${product.name}, ${slot.label.toLowerCase()}`}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          class={`h-full w-full object-cover ${imgClass}`}
        />
      </figure>
    );
  }
  const foil = src.blueprint === "foil";
  return (
    <figure
      class={`relative overflow-hidden ${foil ? "bg-night" : "bg-product-wash"} ${cls}`}
      data-slot={slot.key}
      data-fill={`blueprint-${src.blueprint}`}
    >
      <div class="absolute inset-0 p-[7%]">
        <IsoDrawing
          parts={resizeParts(specOf(product), selection)}
          size={selection}
          dims={src.blueprint !== "line"}
          foil={foil}
          label={`Workshop drawing of the ${product.name}`}
        />
      </div>
    </figure>
  );
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

export const PreviewBanner = ({ product }: { product: SelectProduct }) => (
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

export const PhotoGrid = ({
  product,
  class: cls = "",
}: {
  product: SelectProduct;
  class?: string;
}) =>
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

export const DimensionTable = ({ product }: { product: SelectProduct }) => (
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

export const Paragraphs = ({ text, class: cls = "" }: { text: string; class?: string }) => (
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

export const CareNote = ({ product }: { product: SelectProduct }) =>
  product.design.care ? (
    <div class="space-y-2">
      <h2 class="font-heading text-lg">Living with it</h2>
      <Paragraphs
        text={product.design.care}
        class="text-sm leading-relaxed text-muted-foreground"
      />
    </div>
  ) : null;
