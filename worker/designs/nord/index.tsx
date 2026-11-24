// worker/designs/nord/index.tsx
//
// A spec sheet: grid, hairlines, numbered sections. Gilt amber. Made for the Nord Dining Table.
// Ported unchanged from the shop's first architectural layout.

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
// ARCHITECTURAL — a spec sheet: grid, hairlines, numbered sections
// ==========================================

const Architectural: FC<DesignProps> = (props) => {
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
      <PhotoGrid product={p} class="mt-16" />
    </div>
  );
};

export const nord: DesignDef = {
  id: "nord",
  name: "Nord",
  note: "A spec sheet: grid, hairlines, numbered sections. Gilt amber. Made for the Nord Dining Table.",
  view: Architectural,
  extra: [],
  photos: [],
};
