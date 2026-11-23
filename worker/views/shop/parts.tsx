// worker/views/shop/parts.tsx
//
// Small pieces the shop pages share: the isometric line drawing, the rolling
// price, availability badges and the product image URL.

import type { ResolvedPart } from "@server/lib/furniture";
import { isoDrawing } from "@server/lib/furniture";
import { priceGlyphs, formatPrice } from "@server/lib/money";
import type { Availability, Category } from "@server/schema/furniture.config";

export const mediaUrl = (key: string) =>
  `/media/${key.split("/").map(encodeURIComponent).join("/")}`;

export const CATEGORY_LABELS: Record<Category, string> = {
  tables: "Tables",
  chairs: "Chairs",
  benches: "Benches",
  desks: "Desks",
  cabinets: "Cabinets",
  shelving: "Shelving",
  beds: "Beds",
  storage: "Storage",
};

/** Whole class names, so Tailwind generates every one. */
export const AVAILABILITY_STYLES: Record<Availability, { label: string; class: string }> = {
  made_to_order: {
    label: "Made to order",
    class: "border-border bg-muted text-muted-foreground",
  },
  in_stock: { label: "Ready to ship", class: "border-success/30 bg-success/10 text-success" },
  limited: { label: "Limited run", class: "border-warning/40 bg-warning/15 text-foreground" },
  sold_out: {
    label: "Not available",
    class: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

export const AvailabilityBadge = ({ availability }: { availability: Availability }) => {
  const style = AVAILABILITY_STYLES[availability] ?? AVAILABILITY_STYLES.made_to_order;
  return (
    <span
      class={`inline-flex items-center rounded-sm border px-2 py-0.5 text-sm italic ${style.class}`}
    >
      {style.label}
    </span>
  );
};

const FACE_CLASS = {
  top: "iso-top",
  left: "iso-left",
  right: "iso-right",
} as const;

const MATERIAL_CLASS = {
  body: "",
  accent: "iso-accent",
  metal: "iso-metal",
  glass: "iso-glass",
} as const;

/** The piece as an isometric line drawing. Decorative: pages describe it in words. */
export const IsoDrawing = ({
  parts,
  class: cls = "",
}: {
  parts: ResolvedPart[];
  class?: string;
}) => {
  const drawing = isoDrawing(parts);
  return (
    <svg
      viewBox={drawing.viewBox}
      class={`iso-drawing h-full w-full ${cls}`}
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      {drawing.faces.map((f) => (
        <polygon
          points={f.points}
          class={`${FACE_CLASS[f.face]} ${MATERIAL_CLASS[f.material]}`}
          stroke-width={drawing.stroke}
        />
      ))}
    </svg>
  );
};

/**
 * The price as rolling digits, server-rendered at its starting value so it
 * reads correctly before (and without) JavaScript. The visible digits are
 * hidden from assistive tech; the sr-only text beside them is the price that
 * gets announced.
 */
export const RollingPrice = ({
  cents,
  locale,
  currency,
}: {
  cents: number;
  locale: string;
  currency: string;
}) => (
  <span class="relative inline-block" data-rolling-price>
    <span class="price-roll" aria-hidden="true" data-price-roll>
      {priceGlyphs(cents, locale, currency).map((g) =>
        g.digit === null ? (
          <span>{g.ch}</span>
        ) : (
          <span class="digit">
            <span style={`transform: translateY(calc(var(--roll-h) * -${g.digit}))`}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                <span>{d}</span>
              ))}
            </span>
          </span>
        ),
      )}
    </span>
    <span class="sr-only" aria-live="polite" aria-atomic="true" data-price-text>
      {formatPrice(cents, locale, currency)}
    </span>
  </span>
);

export const Price = ({
  cents,
  locale,
  currency,
}: {
  cents: number;
  locale: string;
  currency: string;
}) => <span class="tabular-nums">{formatPrice(cents, locale, currency)}</span>;

export const leadTimeLabel = (days: number) => {
  if (days <= 0) return "Ready now";
  if (days < 14) return `About ${days} day${days === 1 ? "" : "s"} in the workshop`;
  const weeks = Math.round(days / 7);
  return `About ${weeks} week${weeks === 1 ? "" : "s"} in the workshop`;
};

export const mm = (n: number) => `${Math.round(n).toLocaleString("en")} mm`;

export const sizeLabel = (s: { width: number; height: number; depth: number }) =>
  `${Math.round(s.width)} × ${Math.round(s.depth)} × ${Math.round(s.height)} mm`;

/** Shared input styling. */
export const inputClass =
  "flex h-11 w-full rounded-sm border border-input bg-card px-3 py-2 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

export const buttonPrimary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-primary px-6 text-base font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50";

export const buttonSecondary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-sm border border-gilt/50 bg-transparent px-5 text-base font-medium hover:bg-accent hover:text-accent-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export const buttonGhost =
  "inline-flex h-11 items-center justify-center gap-2 rounded-sm px-3 text-base font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
