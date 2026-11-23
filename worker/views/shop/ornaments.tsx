// worker/views/shop/ornaments.tsx
//
// The small set of ornaments the night-court theme uses, all drawn in the
// gilt token so they follow day and night. Kept deliberately few: the pointed
// arch, a crescent, a diamond fleuron and a flourish rule.

/** A four-pointed diamond, the site's bullet and keystone. */
export const Fleuron = ({ class: cls = "h-2 w-2" }: { class?: string }) => (
  <span class={`inline-block shrink-0 rotate-45 bg-current ${cls}`} aria-hidden="true"></span>
);

/** A hairline with a fleuron in the middle, between sections. */
export const Flourish = ({ class: cls = "" }: { class?: string }) => (
  <div class={`flex items-center gap-3 text-foreground ${cls}`} aria-hidden="true">
    <span class="h-0.5 flex-1 bg-current"></span>
    <svg viewBox="0 0 40 12" class="h-3.5 w-11" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M0 6 H13 M27 6 H40" />
      <path d="M20 1 L25 6 L20 11 L15 6 Z" fill="currentColor" />
      <circle cx="9" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="31" cy="6" r="1.2" fill="currentColor" stroke="none" />
    </svg>
    <span class="h-0.5 flex-1 bg-current"></span>
  </div>
);

/**
 * A book-cover frame: a heavy gilt rule with a fine one inside it and a
 * diamond at each corner, laid over a panel of aspect `ratio` (width /
 * height). Drawn in the panel's proportions so the rules keep an even weight.
 * With `draw`, the rules draw themselves in once, on arrival.
 */
export const CoverFrame = ({ ratio, draw = false }: { ratio: number; draw?: boolean }) => {
  const w = 100;
  const h = 100 / ratio;
  const rect = (inset: number) => `M${inset},${inset} H${w - inset} V${h - inset} H${inset} Z`;
  const corners = [
    [4.5, 4.5],
    [w - 4.5, 4.5],
    [w - 4.5, h - 4.5],
    [4.5, h - 4.5],
  ];
  return (
    <svg
      viewBox={`0 0 ${w} ${h.toFixed(2)}`}
      class="pointer-events-none absolute inset-0 h-full w-full text-gilt"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path d={rect(4.5)} stroke-width="1.6" pathLength={1} class={draw ? "draw-in" : ""} />
      <path d={rect(7.5)} stroke-width="0.5" pathLength={1} class={draw ? "draw-in" : ""} />
      {corners.map(([x, y]) => (
        <path
          d={`M${x},${y - 2.6} L${x + 2.6},${y} L${x},${y + 2.6} L${x - 2.6},${y} Z`}
          fill="currentColor"
          stroke="none"
        />
      ))}
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
