// worker/lib/furniture.ts
//
// The configurator engine: resizing, pricing and lead times for one piece of
// furniture. Pure functions over the records in schema/furniture.config.ts.
//
// The same code runs in three places, which is the point of it:
//   - the browser, so the 3D model and the price follow every slider move;
//   - the Worker, which recomputes both before anything is added to a cart or
//     charged, so a tampered request cannot set its own price;
//   - the manufacturing spec, so the workshop's cut list is the model the
//     customer saw.
//
// Type-only imports keep Zod out of the client bundle.

import type {
  Dimension,
  DimensionKey,
  FurnitureSpec,
  OptionChoice,
  Part,
  ResizeMode,
  Selection,
} from "../schema/furniture.config";

export const AXES: DimensionKey[] = ["width", "height", "depth"];

// ==========================================
// SELECTION
// ==========================================

/** Clamp to the manufacturing limits and snap to the step, counted from the minimum. */
export function clampDimension(value: number, dim: Dimension): number {
  if (!Number.isFinite(value)) return dim.standard;
  const clamped = Math.min(dim.max, Math.max(dim.min, value));
  const steps = Math.round((clamped - dim.min) / dim.step);
  return Math.min(dim.max, dim.min + steps * dim.step);
}

/**
 * Turns whatever arrived — a form post, a query string, a saved design from
 * before the product was edited — into a selection the workshop can build.
 * Out-of-range sizes are clamped and unknown options fall back to the first
 * choice, so a stale link still opens on something valid.
 */
export function normaliseSelection(
  spec: Pick<FurnitureSpec, "dimensions" | "options">,
  input: Partial<{ width: unknown; height: unknown; depth: unknown; options: unknown }>,
): Selection {
  const num = (v: unknown, dim: Dimension) =>
    clampDimension(v === undefined || v === null || v === "" ? dim.standard : Number(v), dim);

  const given = (input.options ?? {}) as Record<string, unknown>;
  const options: Record<string, string> = {};
  for (const group of spec.options) {
    const wanted = given[group.id];
    const match = group.choices.find((c) => c.id === wanted);
    options[group.id] = (match ?? group.choices[0]).id;
  }

  return {
    width: num(input.width, spec.dimensions.width),
    height: num(input.height, spec.dimensions.height),
    depth: num(input.depth, spec.dimensions.depth),
    options,
  };
}

export const standardSelection = (spec: Pick<FurnitureSpec, "dimensions" | "options">) =>
  normaliseSelection(spec, {});

export const isCustomSize = (spec: Pick<FurnitureSpec, "dimensions">, sel: Selection) =>
  AXES.some((k) => sel[k] !== spec.dimensions[k].standard);

export function chosenOptions(
  spec: Pick<FurnitureSpec, "options">,
  sel: Selection,
): { groupId: string; groupLabel: string; choice: OptionChoice }[] {
  return spec.options.map((group) => ({
    groupId: group.id,
    groupLabel: group.label,
    choice: group.choices.find((c) => c.id === sel.options[group.id]) ?? group.choices[0],
  }));
}

/** Query string for a selection: `?w=1800&h=750&d=900&o.timber=oak`. */
export function selectionToQuery(sel: Selection): string {
  const params = new URLSearchParams({
    w: String(sel.width),
    h: String(sel.height),
    d: String(sel.depth),
  });
  for (const [group, choice] of Object.entries(sel.options)) params.set(`o.${group}`, choice);
  return params.toString();
}

/** The inverse of `selectionToQuery`, for anything with `.get()` and entries. */
export function selectionInputFromQuery(query: Record<string, string | undefined>) {
  const options: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (key.startsWith("o.") && value !== undefined) options[key.slice(2)] = value;
  }
  return { width: query.w, height: query.h, depth: query.d, options };
}

// ==========================================
// RESIZING
// ==========================================

export interface ResolvedPart {
  name: string;
  label: string;
  shape: Part["shape"];
  material: Part["material"];
  /** mm */
  size: [number, number, number];
  /** mm, centre */
  position: [number, number, number];
}

const EPSILON = 1e-6;

/**
 * Where a coordinate on one axis lands when the piece goes from `from` to
 * `to` mm along it. Width and depth are centred on 0; height runs up from the
 * floor at 0.
 */
function mapCoordinate(c: number, from: number, to: number, fromFloor: boolean, mode: ResizeMode) {
  if (mode === "fixed" || from === to) return c;
  if (mode === "scale") return (c * to) / from;

  // anchor / move: keep the distance to the nearer outside face.
  const mid = fromFloor ? from / 2 : 0;
  const delta = to - from;
  if (Math.abs(c - mid) < EPSILON) return fromFloor ? (c * to) / from : 0;
  if (fromFloor) return c < mid ? c : c + delta;
  return c < 0 ? c - delta / 2 : c + delta / 2;
}

/**
 * Every component of the piece at the selected size.
 *
 * Parts are resized one axis at a time by their own rule (see RESIZE_MODES),
 * never by stretching the whole model, so legs keep their section, rails
 * follow the legs, and a tabletop grows without its thickness changing.
 */
export function resizeParts(spec: Pick<FurnitureSpec, "dimensions" | "model">, sel: Selection) {
  const dims = spec.dimensions;
  const axes: { key: "x" | "y" | "z"; from: number; to: number; floor: boolean }[] = [
    { key: "x", from: dims.width.standard, to: sel.width, floor: false },
    { key: "y", from: dims.height.standard, to: sel.height, floor: true },
    { key: "z", from: dims.depth.standard, to: sel.depth, floor: false },
  ];

  return spec.model.parts.map((part): ResolvedPart => {
    const size: [number, number, number] = [...part.size];
    const position: [number, number, number] = [...part.position];

    axes.forEach(({ key, from, to, floor }, a) => {
      const mode = part.resize?.[key] ?? "anchor";
      if (mode === "move" || mode === "spread") {
        position[a] = mapCoordinate(
          part.position[a],
          from,
          to,
          floor,
          mode === "move" ? "anchor" : "scale",
        );
        return;
      }
      const lo = mapCoordinate(part.position[a] - part.size[a] / 2, from, to, floor, mode);
      const hi = mapCoordinate(part.position[a] + part.size[a] / 2, from, to, floor, mode);
      if (hi - lo >= 1) {
        size[a] = hi - lo;
        position[a] = (lo + hi) / 2;
      } else {
        // A small part straddling the centre would otherwise shrink to nothing
        // when the piece shrinks; scale it instead.
        size[a] = Math.max(1, (part.size[a] * to) / from);
        position[a] = (part.position[a] * to) / from;
      }
    });

    return {
      name: part.name,
      label: part.label || part.name,
      shape: part.shape ?? "box",
      material: part.material ?? "body",
      size,
      position,
    };
  });
}

/** Volume of a resolved part in cubic metres. */
export const partVolume = (p: ResolvedPart) => {
  const [x, y, z] = p.size;
  const mm3 = p.shape === "cylinder" ? Math.PI * (x / 2) * (z / 2) * y : x * y * z;
  return mm3 / 1e9;
};

// ==========================================
// PRICING
// ==========================================

export interface QuoteLine {
  label: string;
  cents: number;
}

export interface Quote {
  totalCents: number;
  lines: QuoteLine[];
  custom: boolean;
  leadDays: number;
  /** Solid timber in the finished piece, m³. Shown in the spec. */
  timberCubicMetres: number;
}

/**
 * The price of one piece as configured.
 *
 * Each line is rounded to `roundToCents` before it is added, so the
 * itemised lines the customer sees always sum to the total they pay.
 */
export function quote(spec: FurnitureSpec, sel: Selection): Quote {
  const p = spec.pricing;
  const round = (c: number) => Math.round(c / p.roundToCents) * p.roundToCents;
  const parts = resizeParts(spec, sel);
  const chosen = chosenOptions(spec, sel);
  const custom = isCustomSize(spec, sel);

  const timberParts = parts.filter((x) => x.material === "body" || x.material === "accent");
  const timberCubicMetres = timberParts.reduce((sum, x) => sum + partVolume(x), 0);
  const multiplier = chosen.reduce((m, o) => m * (o.choice.timberMultiplier ?? 1), 1);

  const footprint = (sel.width * sel.depth) / 1e6;
  const growthCm = AXES.reduce(
    (sum, k) => sum + Math.max(0, sel[k] - spec.dimensions[k].standard) / 10,
    0,
  );

  const lines: QuoteLine[] = [{ label: "Making", cents: round(p.baseCents) }];
  const add = (label: string, cents: number) => {
    const r = round(cents);
    if (r !== 0) lines.push({ label, cents: r });
  };
  add("Timber", timberCubicMetres * p.timberPerCubicMetreCents * multiplier);
  add("Surface area", footprint * p.areaPerSquareMetreCents);
  if (custom) {
    add("Extra workshop time", growthCm * p.labourPerCentimetreCents);
    add("Made to your size", p.customSurchargeCents);
  }
  for (const o of chosen) add(`${o.groupLabel}: ${o.choice.label}`, o.choice.priceCents ?? 0);

  const totalCents = Math.max(
    0,
    lines.reduce((s, l) => s + l.cents, 0),
  );
  const leadDays =
    (custom ? spec.leadDaysCustom : spec.leadDaysStandard) +
    chosen.reduce((s, o) => s + (o.choice.leadDays ?? 0), 0);

  return { totalCents, lines, custom, leadDays, timberCubicMetres };
}

/**
 * "From" price for the gallery: the cheaper of the standard size and the
 * smallest size, each with the cheapest choice in every option group.
 */
export function startingPrice(spec: FurnitureSpec): number {
  const cheapest: Record<string, string> = {};
  for (const group of spec.options) {
    let best = group.choices[0];
    let bestCost = Infinity;
    for (const choice of group.choices) {
      const sel = normaliseSelection(spec, { options: { ...cheapest, [group.id]: choice.id } });
      const cost = quote(spec, sel).totalCents;
      if (cost < bestCost) [best, bestCost] = [choice, cost];
    }
    cheapest[group.id] = best.id;
  }
  const standard = normaliseSelection(spec, { options: cheapest });
  const smallest = normaliseSelection(spec, {
    width: spec.dimensions.width.min,
    height: spec.dimensions.height.min,
    depth: spec.dimensions.depth.min,
    options: cheapest,
  });
  return Math.min(quote(spec, standard).totalCents, quote(spec, smallest).totalCents);
}

// ==========================================
// MANUFACTURING
// ==========================================

export interface CutListRow {
  label: string;
  names: string[];
  shape: ResolvedPart["shape"];
  material: ResolvedPart["material"];
  /** Rounded to the millimetre, longest first: length × width × thickness. */
  dims: [number, number, number];
  quantity: number;
}

/**
 * Components grouped into a cut list: identical pieces (four legs) become one
 * row with a quantity. Dimensions are sorted longest first, which is how a
 * workshop reads a board — length, width, thickness — whatever its
 * orientation in the assembled piece.
 */
export function cutList(parts: ResolvedPart[]): CutListRow[] {
  const rows = new Map<string, CutListRow>();
  for (const part of parts) {
    const dims = part.size.map((v) => Math.round(v)).sort((a, b) => b - a) as [
      number,
      number,
      number,
    ];
    const baseLabel = part.label.replace(/[\s_-]*\d+$/, "") || part.label;
    const key = `${baseLabel}|${part.shape}|${part.material}|${dims.join("x")}`;
    const row = rows.get(key);
    if (row) {
      row.quantity++;
      row.names.push(part.name);
    } else {
      rows.set(key, {
        label: baseLabel,
        names: [part.name],
        shape: part.shape,
        material: part.material,
        dims,
        quantity: 1,
      });
    }
  }
  return [...rows.values()];
}

// ==========================================
// ISOMETRIC PREVIEW
// ==========================================

export interface IsoFace {
  points: string;
  face: "top" | "left" | "right";
  material: ResolvedPart["material"];
}

/**
 * A line drawing of the piece, for gallery cards and as the placeholder the
 * 3D view loads over. Each component is drawn as a box seen from above and
 * to the front-right, back to front. No JavaScript, no image file, and it
 * follows the theme because the faces are styled from CSS tokens.
 */
export function isoDrawing(parts: ResolvedPart[]) {
  const cos = Math.cos(Math.PI / 6);
  const sin = Math.sin(Math.PI / 6);
  const project = (x: number, y: number, z: number): [number, number] => [
    (x - z) * cos,
    (x + z) * sin - y,
  ];

  const ordered = [...parts].sort(
    (a, b) =>
      a.position[0] +
      a.position[1] +
      a.position[2] -
      (b.position[0] + b.position[1] + b.position[2]),
  );

  const faces: IsoFace[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const part of ordered) {
    const [sx, sy, sz] = part.size;
    const [cx, cy, cz] = part.position;
    const x0 = cx - sx / 2;
    const x1 = cx + sx / 2;
    const y0 = cy - sy / 2;
    const y1 = cy + sy / 2;
    const z0 = cz - sz / 2;
    const z1 = cz + sz / 2;

    const poly = (pts: [number, number, number][]) =>
      pts
        .map(([x, y, z]) => {
          const [px, py] = project(x, y, z);
          minX = Math.min(minX, px);
          maxX = Math.max(maxX, px);
          minY = Math.min(minY, py);
          maxY = Math.max(maxY, py);
          return `${px.toFixed(1)},${py.toFixed(1)}`;
        })
        .join(" ");

    faces.push(
      {
        face: "left", // the +z face, which faces down-left on screen
        material: part.material,
        points: poly([
          [x0, y0, z1],
          [x1, y0, z1],
          [x1, y1, z1],
          [x0, y1, z1],
        ]),
      },
      {
        face: "right", // the +x face
        material: part.material,
        points: poly([
          [x1, y0, z1],
          [x1, y0, z0],
          [x1, y1, z0],
          [x1, y1, z1],
        ]),
      },
      {
        face: "top",
        material: part.material,
        points: poly([
          [x0, y1, z0],
          [x1, y1, z0],
          [x1, y1, z1],
          [x0, y1, z1],
        ]),
      },
    );
  }

  const pad = Math.max(maxX - minX, maxY - minY) * 0.06;
  return {
    faces,
    viewBox: `${(minX - pad).toFixed(1)} ${(minY - pad).toFixed(1)} ${(maxX - minX + pad * 2).toFixed(1)} ${(maxY - minY + pad * 2).toFixed(1)}`,
    /** Stroke width that reads the same whatever the piece's size. */
    stroke: (Math.max(maxX - minX, maxY - minY) / 120).toFixed(2),
  };
}
