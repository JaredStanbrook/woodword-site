// worker/designs/splay/index.tsx
//
// Splay, for the oak console with legs that lean out both ways.
//
// Maximalism, built from what is in the photos: the blue kayak and tarp, the
// yellow buoys, the chintz teapot, the matryoshka dolls, the green tub, the
// cane lamp shade. Pattern on pattern, colour on colour, flowers stuck over
// everything, and very few words: the name, a ribbon, two sentences, the
// photos in one gallery, the 3D model and the configurator. Nothing else.
//
// Every element is this design's own. The shared blocks (viewer,
// gallery, configurator) keep their markup and behaviour; design.css
// restyles them through their data-part hooks.

import type { FC } from "hono/jsx";
import { specOf } from "@server/schema/product.schema";
import { startingPrice } from "@server/lib/furniture";
import { formatPrice } from "@server/lib/money";
import { AvailabilityBadge, Configurator, Gallery, Viewer } from "../blocks";
import type { DesignDef, DesignProps } from "../types";

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
          <Gallery product={p} selection={selection} class="sp-gallery" />
          <div class="sp-hero-side">
            {d.intro ? <p class="sp-intro">{d.intro}</p> : null}
            <a href="#sp-build" class="sp-burst">
              <span class="sp-burst-from">from</span>
              <span class="sp-burst-price">{from}</span>
            </a>
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
    </div>
  );
};

export const splay: DesignDef = {
  id: "splay",
  name: "Splay",
  note: "Maximalist: cobalt cane weave, chintz flowers, candy colours. Made for the oak console.",
  view: Splay,
};
