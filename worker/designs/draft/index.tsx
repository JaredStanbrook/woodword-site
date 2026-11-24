// worker/designs/draft/index.tsx
//
// The page a new piece has before its own design is made: every block a
// product page needs, stacked plainly. Good enough to check copy, sizes and
// prices in preview. It cannot be published (services/product-form.ts).

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

const SLOTS: SlotDef[] = [
  { key: "photo1", label: "Photo 1", fallback: "measured" },
  { key: "photo2", label: "Photo 2", fallback: "line" },
];

const Draft: FC<DesignProps> = (props) => {
  const { product: p, selection } = props;
  const d = p.design;
  return (
    <div class="mx-auto max-w-5xl space-y-12 px-4 py-10 sm:px-6">
      <header class="space-y-4 border-b-2 pb-8">
        <AvailabilityBadge availability={p.availability} />
        <h1 class="text-5xl">{p.name || "Untitled piece"}</h1>
        {d.headline ? <p class="text-xl leading-snug">{d.headline}</p> : null}
        <p class="leading-relaxed text-muted-foreground">{d.intro || p.summary}</p>
      </header>
      <div class="grid gap-10 lg:grid-cols-2">
        <Viewer product={p} selection={selection} class="aspect-[4/3] rounded-sm border-2" />
        <Configurator {...props} />
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        {SLOTS.map((slot) => (
          <Photo product={p} selection={selection} slot={slot} class="aspect-[4/3] rounded-sm" />
        ))}
      </div>
      {d.story.map((s) => (
        <section class="space-y-3">
          <h2 class="font-heading text-2xl">{s.heading}</h2>
          <Paragraphs text={s.body} class="leading-relaxed text-muted-foreground" />
        </section>
      ))}
      {p.description ? (
        <Paragraphs text={p.description} class="leading-relaxed text-muted-foreground" />
      ) : null}
      {d.highlights.length ? (
        <dl class="grid grid-cols-2 gap-5 border-y-2 py-6">
          {d.highlights.map((h) => (
            <div>
              <dt class="text-sm italic text-muted-foreground">{h.label}</dt>
              <dd class="font-heading text-xl">{h.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <DimensionTable product={p} />
      <CareNote product={p} />
    </div>
  );
};

export const draft: DesignDef = {
  id: "draft",
  name: "Draft (not for publishing)",
  note: "Every block stacked plainly, until this piece's own design is made.",
  view: Draft,
  extra: [],
  photos: SLOTS,
  draft: true,
};
