// worker/designs/blocks.tsx
//
// The pieces every product page is built from. A design arranges and styles
// these however it likes, but it does not rebuild them: buying, sizing and the
// 3D view must work the same on every page, and tests/designs.test.tsx checks
// that each design still carries all of them.

import type { SelectProduct } from "@server/schema/product.schema";
import { specOf } from "@server/schema/product.schema";
import type { Selection } from "@server/schema/furniture.config";
import { resizeParts } from "@server/lib/furniture";
import { AvailabilityBadge, IsoDrawing, mediaUrl } from "@views/shop/parts";
import { Configurator } from "@views/shop/Configurator";

export { AvailabilityBadge, Configurator };

/** The class that gives a piece its design's colours, anywhere it appears. */
export const designClass = (p: SelectProduct) => `design-${p.design?.id || "draft"}`;

// ==========================================
// THE GALLERY
// ==========================================

/** As many pictures as the gallery's CSS can switch between (worker/index.css). */
export const GALLERY_MAX = 12;

/**
 * Every photo of the piece in one place, in upload order, and last the
 * workshop drawing at the size chosen. One large picture with a row of
 * thumbnails under it; a thumbnail is a radio button, so switching needs no
 * script and works from the keyboard. Hooks for a design's CSS: data-part
 * gallery, gallery-main, gallery-thumbs, gallery-thumb; each picture has
 * data-fill "photo" or "drawing".
 */
export const Gallery = ({
  product,
  selection,
  class: cls = "",
  mainClass = "aspect-[4/5]",
}: {
  product: SelectProduct;
  selection: Selection;
  class?: string;
  /** Sizes the large picture; give it a fixed aspect ratio. */
  mainClass?: string;
}) => {
  const photos = product.images.slice(0, GALLERY_MAX - 1);
  const count = photos.length + 1;
  const name = `gallery-${product.id ?? 0}`;
  const parts = resizeParts(specOf(product), selection);
  const drawing = (dims: boolean) => (
    <div class="absolute inset-0 bg-product-wash p-[8%]">
      <IsoDrawing
        parts={parts}
        size={selection}
        dims={dims}
        label={`Workshop drawing of the ${product.name}`}
      />
    </div>
  );
  return (
    <div class={`photo-gallery ${cls}`} data-part="gallery">
      <div class={`relative overflow-hidden ${mainClass}`} data-part="gallery-main">
        {photos.map((key, i) => (
          <figure class="absolute inset-0" data-gallery-item={i} data-fill="photo">
            <img
              src={mediaUrl(key)}
              alt={`${product.name}, photo ${i + 1} of ${photos.length}`}
              loading={i === 0 ? "eager" : "lazy"}
              decoding="async"
              class="h-full w-full object-cover"
            />
          </figure>
        ))}
        <figure class="absolute inset-0" data-gallery-item={photos.length} data-fill="drawing">
          {drawing(true)}
        </figure>
      </div>
      {count > 1 ? (
        <fieldset class="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-5" data-part="gallery-thumbs">
          <legend class="sr-only">Pictures of the {product.name}</legend>
          {photos.map((key, i) => (
            <label
              class="relative block aspect-square cursor-pointer overflow-hidden"
              data-part="gallery-thumb"
            >
              <input
                type="radio"
                name={name}
                value={i}
                checked={i === 0}
                class="sr-only"
                data-gallery-pick={i}
                aria-label={`Photo ${i + 1}`}
              />
              <img
                src={mediaUrl(key)}
                alt=""
                loading="lazy"
                decoding="async"
                class="h-full w-full object-cover"
              />
            </label>
          ))}
          <label
            class="relative block aspect-square cursor-pointer overflow-hidden"
            data-part="gallery-thumb"
          >
            <input
              type="radio"
              name={name}
              value={photos.length}
              checked={photos.length === 0}
              class="sr-only"
              data-gallery-pick={photos.length}
              aria-label="Workshop drawing"
            />
            {drawing(false)}
          </label>
        </fieldset>
      ) : null}
    </div>
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
  <furniture-viewer
    class={`relative block overflow-hidden bg-product-wash ${cls}`}
    data-viewer
    data-part="viewer"
  >
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
