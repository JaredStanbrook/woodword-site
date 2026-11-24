// worker/designs/settle/index.tsx
//
// A magazine spread: picture first, columns, a drop cap. Verdigris. Made for the Settle Bench.
// Ported unchanged from the shop's first editorial layout.

import type { FC } from "hono/jsx";
import { specOf } from "@server/schema/product.schema";
import { resizeParts } from "@server/lib/furniture";
import { IsoDrawing, mediaUrl } from "@views/shop/parts";
import {
  slotSource,
  AvailabilityBadge,
  CareNote,
  Configurator,
  DimensionTable,
  Paragraphs,
  PhotoGrid,
  Viewer,
} from "../blocks";
import type { DesignDef, DesignProps, SlotDef } from "../types";

const HERO: SlotDef = {
  key: "photo1",
  label: "Photo 1: the picture across the top",
  fallback: "measured",
};

// ==========================================
// EDITORIAL — a magazine spread: image first, columns, a drop cap
// ==========================================

const Editorial: FC<DesignProps> = (props) => {
  const { product: p } = props;
  const d = p.design;
  const hero = slotSource(p, HERO);
  const photo = "image" in hero ? hero.image : undefined;
  const drawing = "blueprint" in hero ? hero.blueprint : "measured";
  return (
    <div>
      <section class="relative">
        {photo ? (
          <img
            src={mediaUrl(photo)}
            alt={`${p.name}`}
            class="h-[62vh] min-h-[22rem] w-full object-cover"
            data-slot={HERO.key}
            data-fill="photo"
          />
        ) : (
          <div
            class={`h-[52vh] min-h-[20rem] w-full p-[6%] ${drawing === "foil" ? "bg-night" : "bg-product-wash"}`}
            data-slot={HERO.key}
            data-fill={`blueprint-${drawing}`}
          >
            <IsoDrawing
              parts={resizeParts(specOf(p), props.selection)}
              size={props.selection}
              dims={drawing !== "line"}
              foil={drawing === "foil"}
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
        <PhotoGrid product={p} class="mt-16" />
      </div>
    </div>
  );
};

export const settle: DesignDef = {
  id: "settle",
  name: "Settle",
  note: "A magazine spread: picture first, columns, a drop cap. Verdigris. Made for the Settle Bench.",
  view: Editorial,
  extra: [],
  photos: [HERO],
};
