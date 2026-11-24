// worker/designs/hearth/index.tsx
//
// Warm and centred: serif headings, ornament, a washed band. Oxblood. Made for the Hearth Sideboard.
// Ported unchanged from the shop's first heritage layout.

import type { FC } from "hono/jsx";
import { Flourish } from "@views/shop/ornaments";
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
// HERITAGE — warm and centred: serif, ornament, a washed band
// ==========================================

const Ornament = () => <Flourish class="mx-auto max-w-xs" />;

const Heritage: FC<DesignProps> = (props) => {
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
        <PhotoGrid product={p} class="mt-16" />
      </div>
    </div>
  );
};

export const hearth: DesignDef = {
  id: "hearth",
  name: "Hearth",
  note: "Warm and centred: serif headings, ornament, a washed band. Oxblood. Made for the Hearth Sideboard.",
  view: Heritage,
  extra: [],
  photos: [],
};
