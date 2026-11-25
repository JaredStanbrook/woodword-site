// worker/designs/splay/index.tsx
//
// Splay, for the oak console with legs that lean out both ways.
//
// Maximalism, built from what is in the photos: the blue kayak and tarp, the
// yellow buoys, the chintz teapot, the matryoshka dolls, the green tub, the
// cane lamp shade and the shed's pavers. Pattern on pattern, colour on
// colour, flowers stuck over everything, and very few words.
//
// Every element is this design's own. The shared blocks (viewer,
// configurator, sizes, care) keep their markup and behaviour; design.css
// restyles them through their data-part hooks.

import type { FC } from "hono/jsx";
import { specOf } from "@server/schema/product.schema";
import { startingPrice } from "@server/lib/furniture";
import { formatPrice } from "@server/lib/money";
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
  label: "Photo 1: the piece at home, in the big frame (portrait)",
  fallback: "measured",
};
const DETAIL: SlotDef = {
  key: "photo2",
  label: "Photo 2: a close detail, in the round medallion",
  fallback: "foil",
};
const SHED_A: SlotDef = {
  key: "photo3",
  label: "Photo 3: first workshop snapshot",
  fallback: "line",
};
const SHED_B: SlotDef = {
  key: "photo4",
  label: "Photo 4: second workshop snapshot",
  fallback: "line",
};

/** A chintz flower, like the ones on the teapot. Decoration only. */
const Bloom = ({ class: cls = "", petal = "var(--sp-poppy)", heart = "var(--sp-marigold)" }) => (
  <svg viewBox="0 0 100 100" class={`sp-bloom ${cls}`} aria-hidden="true">
    <path d="M50 52 C30 70 14 88 6 96 C24 92 40 78 50 52Z" fill="var(--sp-leaf)" />
    <path d="M52 50 C72 66 88 70 98 66 C90 52 74 44 52 50Z" fill="var(--sp-leaf)" />
    {[0, 72, 144, 216, 288].map((r) => (
      <ellipse
        cx="50"
        cy="27"
        rx="15"
        ry="22"
        fill={petal}
        stroke="var(--sp-ink)"
        stroke-width="3"
        transform={`rotate(${r} 50 50)`}
      />
    ))}
    <circle cx="50" cy="50" r="13" fill={heart} stroke="var(--sp-ink)" stroke-width="3" />
    <circle cx="50" cy="50" r="4" fill="var(--sp-ink)" />
  </svg>
);

const Splay: FC<DesignProps> = (props) => {
  const { product: p, selection, locale, currency } = props;
  const d = p.design;
  const x = d.extra ?? {};
  const from = formatPrice(startingPrice(specOf(p)), locale, currency);
  return (
    <div class="splay">
      <section class="sp-hero">
        <Bloom class="sp-bloom-a" />
        <Bloom class="sp-bloom-b" petal="var(--sp-pink)" />
        <Bloom class="sp-bloom-c" petal="var(--sp-marigold)" heart="var(--sp-poppy)" />
        <div class="sp-hero-grid">
          <div class="sp-hero-title">
            <AvailabilityBadge availability={p.availability} />
            <h1 class="sp-name">{p.name}</h1>
            {d.headline ? <p class="sp-ribbon">{d.headline}</p> : null}
          </div>
          <div class="sp-frame">
            <Photo product={p} selection={selection} slot={HOME} eager class="sp-frame-photo" />
          </div>
          <div class="sp-hero-side">
            <p class="sp-intro">{d.intro || p.summary}</p>
            <div class="sp-hero-badges">
              <div class="sp-medallion">
                <Photo product={p} selection={selection} slot={DETAIL} class="sp-medallion-photo" />
              </div>
              <a href="#sp-build" class="sp-burst">
                <span class="sp-burst-from">from</span>
                <span class="sp-burst-price">{from}</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="sp-build" class="sp-build" aria-labelledby="sp-build-title">
        <Bloom class="sp-bloom-d" petal="var(--sp-pink)" />
        <h2 id="sp-build-title" class="sp-h2">
          Make it fit
        </h2>
        <div class="sp-build-grid">
          <div class="sp-viewer-frame">
            <Viewer product={p} selection={selection} class="sp-viewer" />
          </div>
          <div class="sp-config">
            <Configurator {...props} />
          </div>
        </div>
      </section>

      <section class="sp-shed" aria-labelledby="sp-shed-title">
        <h2 id="sp-shed-title" class="sp-h2 sp-h2-light">
          {x.shed_heading || "From the shed"}
        </h2>
        <div class="sp-snaps">
          <div class="sp-snap sp-snap-a">
            <Photo product={p} selection={selection} slot={SHED_A} class="sp-snap-photo" />
          </div>
          <div class="sp-snap sp-snap-b">
            <Photo product={p} selection={selection} slot={SHED_B} class="sp-snap-photo" />
          </div>
        </div>
        {x.shed_note ? (
          <div class="sp-tape">
            <Paragraphs text={x.shed_note} />
          </div>
        ) : null}
      </section>

      <section class="sp-facts" aria-label="About this piece">
        {d.highlights.length ? (
          <dl class="sp-tiles">
            {d.highlights.map((h) => (
              <div class="sp-tile">
                <dt>{h.label}</dt>
                <dd>{h.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {d.story.length || p.description ? (
          <div class="sp-blobs">
            {d.story.map((s) => (
              <article class="sp-blob">
                <h2>{s.heading}</h2>
                <Paragraphs text={s.body} />
              </article>
            ))}
            {p.description ? (
              <div class="sp-blob">
                <Paragraphs text={p.description} />
              </div>
            ) : null}
          </div>
        ) : null}
        <div class="sp-last">
          <div class="sp-ticket">
            <h2>Sizes</h2>
            <DimensionTable product={p} />
          </div>
          {d.care ? (
            <div class="sp-care">
              <CareNote product={p} />
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
};

export const splay: DesignDef = {
  id: "splay",
  name: "Splay",
  note: "Maximalist: cobalt cane weave, chintz flowers, candy colours. Made for the oak console.",
  view: Splay,
  labels: {
    headline: { label: "Ribbon", hint: "On the red ribbon under the name. 6 words or fewer." },
    intro: { hint: "On the cream card. 2 sentences, 25 words or fewer." },
    story: {
      label: "Story blobs",
      hint: "Up to 3. Start each with '# ' and a 2–3 word heading, then 1 sentence.",
    },
    highlights: {
      label: "Tiles",
      hint: "3 or 4, one per line as Label: Value. Values of 3 words or fewer.",
    },
    care: { hint: "1 sentence, on the pink sticker." },
  },
  extra: [
    {
      key: "shed_heading",
      label: "Workshop heading",
      hint: "Over the workshop snapshots, 3 words or fewer. Empty: 'From the shed'.",
      rows: 1,
      max: 40,
    },
    {
      key: "shed_note",
      label: "Workshop caption",
      hint: "One line on the tape under the snapshots. Leave empty for none.",
      rows: 1,
      max: 120,
    },
  ],
  photos: [HOME, DETAIL, SHED_A, SHED_B],
};
