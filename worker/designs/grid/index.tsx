// worker/designs/grid/index.tsx
//
// Blocks and big numbers under a blackletter band. Midnight. Made for the Grid Shelving.
// Ported unchanged from the shop's first geometric layout.

import type { FC } from "hono/jsx";
import {
  AvailabilityBadge,
  CareNote,
  Configurator,
  DimensionTable,
  Paragraphs,
  PhotoGrid,
  Viewer,
} from "../blocks";
import type { DesignDef, DesignProps } from "../types";

// ==========================================
// GEOMETRIC — blocks and big numbers, an extended face
// ==========================================

const Geometric: FC<DesignProps> = (props) => {
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
        <PhotoGrid product={p} class="mt-16" />
      </div>
    </div>
  );
};

export const grid: DesignDef = {
  id: "grid",
  name: "Grid",
  note: "Blocks and big numbers under a blackletter band. Midnight. Made for the Grid Shelving.",
  view: Geometric,
  extra: [],
  photos: [],
};
