// worker/views/shop/MadeToMeasure.tsx
//
// How ordering a custom size works, in plain words. Public, indexed.

import type { SelectProduct } from "@server/schema/product.schema";
import { specOf } from "@server/schema/product.schema";
import { drawingLabel, normaliseSelection, resizeParts } from "@server/lib/furniture";
import { designClass } from "@server/designs/blocks";
import { IsoDrawing, buttonPrimary } from "./parts";

/**
 * One piece at its standard size and at its widest, both measured. The
 * difference between the two drawings is the whole idea of the shop.
 */
const Resized = ({ product }: { product: SelectProduct }) => {
  const spec = specOf(product);
  const standard = normaliseSelection(spec, {});
  const widest = normaliseSelection(spec, { width: spec.dimensions.width.max });
  if (widest.width === standard.width) return null;
  const panel = (sel: typeof standard, caption: string) => (
    <figure class="space-y-3">
      <div class="aspect-[4/3] rounded-sm border-[3px] border-foreground bg-product-wash p-[5%]">
        <IsoDrawing
          parts={resizeParts(spec, sel)}
          size={sel}
          dims
          label={drawingLabel(product.name, sel)}
        />
      </div>
      <figcaption class="text-base italic">{caption}</figcaption>
    </figure>
  );
  return (
    <section
      class={`${designClass(product)} mt-14 space-y-5`}
      aria-label="The same piece at two sizes"
    >
      <div class="grid gap-6 sm:grid-cols-2">
        {panel(standard, `The ${product.name} as drawn, ${standard.width} mm long.`)}
        {panel(widest, `The same piece at ${widest.width} mm.`)}
      </div>
      <p class="max-w-2xl text-lg leading-relaxed">
        Nothing is stretched. The top grows, the rails between the legs lengthen, and the legs move
        out to carry it at the same section. The cut list your order sends to the workshop is these
        drawings, piece by piece.
      </p>
    </section>
  );
};

const steps = [
  {
    n: "I",
    title: "Choose a piece",
    body: "Every design in the collection has a standard size it was drawn at, and a range it can be built in. The range is set by the joinery: how far a top can span, how tall a frame stays rigid.",
  },
  {
    n: "II",
    title: "Set it to your room",
    body: "Change the width, height and depth with the sliders or type the exact millimetres. The 3D model rebuilds as you go — a wider table gets a wider top and its legs move out to carry it; they do not get fatter.",
  },
  {
    n: "III",
    title: "See the price as you go",
    body: "The price follows every change, worked out from the timber the piece will use and the extra time in the workshop. Open the breakdown to see each part of it.",
  },
  {
    n: "IV",
    title: "We build exactly that",
    body: "Your order saves the configuration you chose — every component at its final size — and that is what goes to the bench. You can follow it from received to delivered.",
  },
];

export const MadeToMeasurePage = ({ example }: { example?: SelectProduct }) => (
  <div class="mx-auto max-w-5xl px-4 pt-8 sm:px-6 lg:pt-12 animate-in fade-in duration-500">
    <h1 class="font-display text-3xl font-bold leading-none">Made to measure</h1>
    {example ? <Resized product={example} /> : null}
    <ol class="mt-16 divide-y-2 border-y-2">
      {steps.map((s) => (
        <li class="grid gap-3 py-8 sm:grid-cols-[5rem_1fr_2fr]">
          <span class="font-serif text-5xl font-semibold italic leading-none text-primary">
            {s.n}
          </span>
          <h2 class="font-display text-2xl">{s.title}</h2>
          <p class="leading-relaxed text-muted-foreground">{s.body}</p>
        </li>
      ))}
    </ol>
    <section class="mt-16 grid gap-8 sm:grid-cols-2">
      <div class="space-y-2">
        <h2 class="font-display text-xl">How long it takes</h2>
        <p class="text-sm leading-relaxed text-muted-foreground">
          Each piece shows its workshop time. Standard sizes are quicker; custom sizes and some
          finishes add time, and the estimate on the product page updates to say so.
        </p>
      </div>
      <div class="space-y-2">
        <h2 class="font-display text-xl">Save it for later</h2>
        <p class="text-sm leading-relaxed text-muted-foreground">
          Save a configuration to come back to, or send the link to someone — they see exactly the
          size and finish you chose.
        </p>
      </div>
    </section>
    <a href="/" class={`${buttonPrimary} mt-14`}>
      Browse the collection
    </a>
  </div>
);
