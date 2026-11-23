// worker/views/shop/ornaments.tsx
//
// The small set of ornaments the night-court theme uses, all drawn in the
// gilt token so they follow day and night. Kept deliberately few: the pointed
// arch, a crescent, a diamond fleuron and a flourish rule.

/** A four-pointed diamond, the site's bullet and keystone. */
export const Fleuron = ({ class: cls = "h-2 w-2" }: { class?: string }) => (
  <span class={`inline-block shrink-0 rotate-45 bg-gilt ${cls}`} aria-hidden="true"></span>
);

/** A hairline with a fleuron in the middle, between sections. */
export const Flourish = ({ class: cls = "" }: { class?: string }) => (
  <div class={`flex items-center gap-3 text-gilt ${cls}`} aria-hidden="true">
    <span class="h-px flex-1 bg-gradient-to-r from-transparent to-gilt/60"></span>
    <svg viewBox="0 0 40 12" class="h-3 w-10" fill="none" stroke="currentColor" stroke-width="1">
      <path d="M0 6 H13 M27 6 H40" />
      <path d="M20 1 L25 6 L20 11 L15 6 Z" fill="currentColor" />
      <circle cx="9" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="31" cy="6" r="1.2" fill="currentColor" stroke="none" />
    </svg>
    <span class="h-px flex-1 bg-gradient-to-l from-transparent to-gilt/60"></span>
  </div>
);

/**
 * The pointed arch as a path, in a box `w` wide and `h` tall, inset by `i`.
 * The same curve as #arch-clip in Layout.tsx, which is in 0–1 box units.
 */
const archPath = (w: number, h: number, i: number) => {
  const x = (f: number) => (i + f * (w - 2 * i)).toFixed(2);
  const y = (f: number) => (i + f * (h - i)).toFixed(2);
  return `M${x(0)},${h} V${y(0.34)} C${x(0)},${y(0.16)} ${x(0.28)},${y(0.05)} ${x(0.5)},${y(0)} C${x(0.72)},${y(0.05)} ${x(1)},${y(0.16)} ${x(1)},${y(0.34)} V${h}`;
};

/**
 * The arch's gilt outline, for laying over an `.arch` element of the same
 * aspect ratio (width / height). Drawn in the element's own proportions
 * rather than stretched, so the line keeps an even weight and the draw-in
 * dash measures correctly.
 */
export const ArchLine = ({ ratio, draw = false }: { ratio: number; draw?: boolean }) => {
  const w = 100;
  const h = 100 / ratio;
  return (
    <svg
      viewBox={`0 0 ${w} ${h.toFixed(2)}`}
      class="pointer-events-none absolute inset-0 h-full w-full text-gilt"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d={archPath(w, h, 0.4)}
        stroke-width="0.45"
        pathLength={1}
        class={draw ? "draw-in" : ""}
      />
      <path
        d={archPath(w, h, 3)}
        stroke-width="0.22"
        opacity="0.55"
        pathLength={1}
        class={draw ? "draw-in" : ""}
      />
    </svg>
  );
};

/** A crescent moon and a scatter of stars, for the top of a cover. */
export const NightSky = () => (
  <svg viewBox="0 0 200 120" class="h-full w-full text-gilt" aria-hidden="true">
    <defs>
      <mask id="crescent-cut">
        <rect width="200" height="120" fill="white" />
        <circle cx="111" cy="38" r="19" fill="black" />
      </mask>
    </defs>
    <circle cx="100" cy="44" r="20" fill="currentColor" mask="url(#crescent-cut)" />
    {[
      [42, 52, 1.4],
      [64, 30, 0.9],
      [150, 40, 1.2],
      [168, 72, 0.8],
      [30, 86, 0.8],
      [88, 70, 0.7],
      [136, 92, 0.9],
    ].map(([x, y, r]) => (
      <circle cx={x} cy={y} r={r} fill="currentColor" opacity="0.75" />
    ))}
    <path
      d="M58 64 l2 -6 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 Z"
      fill="currentColor"
      opacity="0.8"
    />
  </svg>
);
