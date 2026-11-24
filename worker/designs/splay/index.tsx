// worker/designs/splay/index.tsx
//
// Splay, made for the oak console with legs that lean out both ways. The
// piece goes from a tin shed to a plastered hallway, and the page follows it:
// the hero is plaster, its photo cut to the console's own splayed outline;
// the workshop photos are prints pinned over shed pavers; every section is
// marked by a leg set at the splay.

import type { FC } from "hono/jsx";
import {
  AvailabilityBadge,
  CareNote,
  Configurator,
  DimensionTable,
  Paragraphs,
  Photo,
  Viewer,
} from "../blocks";
import type { DesignDef, DesignProps, SlotDef } from "../types";

const HOME: SlotDef = {
  key: "photo1",
  label: "Photo 1: the piece at home, beside the name (portrait)",
  fallback: "measured",
};
const SHED_A: SlotDef = {
  key: "photo2",
  label: "Photo 2: first workshop print",
  fallback: "line",
};
const SHED_B: SlotDef = {
  key: "photo3",
  label: "Photo 3: second workshop print",
  fallback: "foil",
};
const DETAIL: SlotDef = {
  key: "photo4",
  label: "Photo 4: a close detail (grain, a joint, an edge) beside the story",
  fallback: "measured",
};

/** The console seen end-on: a top, two legs leaning out. Decoration only. */
const SplayMark = ({ class: cls = "" }: { class?: string }) => (
  <svg
    viewBox="0 0 64 40"
    class={cls}
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    stroke-width="3"
    stroke-linecap="square"
  >
    <path d="M6 4h52M16 4 10 38M48 4l6 34M13 24h38" />
  </svg>
);

const Splay: FC<DesignProps> = (props) => {
  const { product: p, selection } = props;
  const d = p.design;
  const x = d.extra ?? {};
  return (
    <div class="splay">
      <section class="splay-plaster border-b-[3px] border-foreground">
        <div class="mx-auto grid max-w-7xl lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <div class="px-4 pt-6 sm:px-6 lg:py-12 lg:pl-8">
            <Photo
              product={p}
              selection={selection}
              slot={HOME}
              eager
              class="splay-outline aspect-[4/5] w-full lg:aspect-auto lg:h-full lg:min-h-[38rem]"
            />
          </div>
          <header class="flex min-w-0 flex-col justify-end gap-6 px-5 pt-8 pb-12 sm:px-10 lg:py-16">
            <AvailabilityBadge availability={p.availability} />
            <h1 class="break-words text-6xl leading-[0.9] sm:text-7xl xl:text-8xl">{p.name}</h1>
            <p class="flex items-center gap-3 text-base italic text-muted-foreground">
              <SplayMark class="h-6 w-10 shrink-0 text-foreground" />
              <span>{x.splay_note || "Legs splayed outward, both ways"}</span>
            </p>
            {d.headline ? (
              <p class="max-w-xl font-heading text-2xl leading-snug">{d.headline}</p>
            ) : null}
            <p class="max-w-xl text-lg leading-relaxed text-muted-foreground">
              {d.intro || p.summary}
            </p>
          </header>
        </div>
      </section>

      <section class="mx-auto max-w-7xl px-4 pt-14 sm:px-6 lg:pt-20" aria-label="Size and order">
        <div class="grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-14">
          <div class="lg:sticky lg:top-8 lg:self-start">
            <Viewer
              product={p}
              selection={selection}
              class="aspect-[4/3] rounded-sm border-[3px] border-foreground"
            />
          </div>
          <Configurator {...props} />
        </div>
      </section>

      <section class="splay-pavers mt-20 border-y-[3px] border-foreground">
        <div class="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <h2 class="splay-leg font-heading text-4xl leading-tight sm:text-5xl">
            {x.shed_heading || "From the shed"}
          </h2>
          <div class="mt-12 grid gap-12 sm:grid-cols-2 sm:gap-10">
            <div class="splay-print splay-print-a">
              <Photo product={p} selection={selection} slot={SHED_A} class="aspect-[3/4]" />
            </div>
            <div class="splay-print splay-print-b sm:mt-16">
              <Photo product={p} selection={selection} slot={SHED_B} class="aspect-[3/4]" />
            </div>
          </div>
          {x.shed_note ? (
            <div class="splay-plaster mt-12 max-w-2xl space-y-3 border-2 border-foreground px-5 py-4 text-lg italic leading-relaxed">
              <Paragraphs text={x.shed_note} />
            </div>
          ) : null}
        </div>
      </section>

      <section class="mx-auto grid max-w-7xl gap-12 px-4 pt-20 sm:px-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
        <div class="md:sticky md:top-8 md:self-start">
          <Photo
            product={p}
            selection={selection}
            slot={DETAIL}
            class="splay-outline aspect-[4/5] w-full"
          />
        </div>
        <div class="space-y-12">
          {d.story.map((s) => (
            <article class="splay-step space-y-3">
              <h2 class="font-heading text-2xl">{s.heading}</h2>
              <Paragraphs text={s.body} class="text-lg leading-relaxed text-muted-foreground" />
            </article>
          ))}
          {p.description ? (
            <div class="space-y-4">
              <Paragraphs
                text={p.description}
                class="text-lg leading-relaxed text-muted-foreground"
              />
            </div>
          ) : null}
        </div>
      </section>

      <section class="mx-auto mt-20 max-w-7xl px-4 sm:px-6">
        {d.highlights.length ? (
          <dl class="grid border-t-[3px] border-foreground sm:grid-cols-2 lg:grid-cols-4">
            {d.highlights.map((h) => (
              <div class="splay-tally border-b-2 py-5 sm:pr-6">
                <dt class="text-sm italic text-muted-foreground">{h.label}</dt>
                <dd class="mt-1 font-heading text-xl">{h.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <div class="mt-14 grid gap-12 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div class="min-w-0 space-y-4">
            <h2 class="font-heading text-2xl">Sizes it can be built in</h2>
            <DimensionTable product={p} />
          </div>
          <div class="splay-plaster self-start border-[3px] border-foreground p-6 sm:p-8">
            <CareNote product={p} />
          </div>
        </div>
      </section>
    </div>
  );
};

export const splay: DesignDef = {
  id: "splay",
  name: "Splay",
  note: "Plaster and shed pavers, photos cut to a splayed outline. Made for the oak console.",
  view: Splay,
  labels: {
    story: { hint: "Each section is marked by a leaning leg. Two or three read best." },
    highlights: { hint: "Four fit in one row on a wide screen. One per line, as Label: Value." },
  },
  extra: [
    {
      key: "splay_note",
      label: "Line beside the splay mark",
      hint: "Under the name. Empty: 'Legs splayed outward, both ways'.",
      rows: 1,
      max: 80,
    },
    {
      key: "shed_heading",
      label: "Workshop band heading",
      hint: "Over the two workshop prints. Empty: 'From the shed'.",
      rows: 1,
      max: 60,
    },
    {
      key: "shed_note",
      label: "Workshop band caption",
      hint: "Under the prints. Leave empty to show none.",
      rows: 3,
      max: 600,
    },
  ],
  photos: [HOME, SHED_A, SHED_B, DETAIL],
};
