// worker/schema/furniture.config.ts
//
// The structured record every furniture design is made of. A product row
// stores these as JSON columns; this file is the one contract between the
// admin form, the AI generator, the Blender export script, the 3D viewer, the
// pricing engine and the manufacturing spec.
//
// Units: millimetres for every length, integer cents for every price.
// Axes: x = width, y = height, z = depth. y = 0 is the floor and x/z are
// centred on the piece, which is also the origin the Blender model must use
// (see docs/blender.md).
//
// The engine that reads these lives in worker/lib/furniture.ts. It imports
// only the types from here, so Zod never reaches the browser bundle.

import { z } from "zod";

export const DIMENSION_KEYS = ["width", "height", "depth"] as const;
export type DimensionKey = (typeof DIMENSION_KEYS)[number];

export const CATEGORIES = [
  "tables",
  "chairs",
  "benches",
  "desks",
  "cabinets",
  "shelving",
  "beds",
  "storage",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const PRODUCT_STATUSES = ["draft", "published", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const AVAILABILITY = ["made_to_order", "in_stock", "limited", "sold_out"] as const;
export type Availability = (typeof AVAILABILITY)[number];

// ==========================================
// DIMENSIONS
// ==========================================

const mm = z.coerce.number().int().min(1).max(10_000);

export const dimensionSchema = z
  .object({
    standard: mm,
    min: mm,
    max: mm,
    step: z.coerce.number().int().min(1).max(500).default(10),
  })
  .refine((d) => d.min <= d.standard && d.standard <= d.max, {
    message: "Standard must sit between the minimum and the maximum",
  });

export const dimensionsSchema = z.object({
  width: dimensionSchema,
  height: dimensionSchema,
  depth: dimensionSchema,
});

// ==========================================
// MODEL: named components and how each one resizes
// ==========================================

/**
 * How a component follows a change in one dimension.
 *
 * - `anchor` (default): each end of the component keeps its distance to the
 *   nearer outside face of the piece. A tabletop spanning the full width
 *   grows with it; a leg near one edge moves with that edge at its original
 *   thickness; a leg running floor-to-top grows in height. This is what most
 *   joinery wants, and it is why legs do not get fatter on a wider table.
 * - `move`: the component keeps its size; only its centre is anchored.
 * - `spread`: the component keeps its size and its centre moves in
 *   proportion — the middle shelves of a bookcase, which stay evenly spaced
 *   and keep their thickness as it gets taller.
 * - `scale`: size and position scale in proportion.
 * - `fixed`: unaffected. Right for small parts at the centre line (a handle
 *   where two doors meet), which `anchor` would otherwise stretch.
 */
export const RESIZE_MODES = ["anchor", "move", "spread", "scale", "fixed"] as const;
export type ResizeMode = (typeof RESIZE_MODES)[number];

export const MATERIAL_SLOTS = ["body", "accent", "metal", "glass"] as const;
export type MaterialSlot = (typeof MATERIAL_SLOTS)[number];

const vec3 = z.tuple([z.number(), z.number(), z.number()]);

export const partSchema = z.object({
  /** Matches the object name in the Blender file and the node in the GLB. */
  name: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[A-Za-z0-9_.-]+$/, "Use letters, digits, dot, dash or underscore"),
  label: z.string().max(80).optional(),
  shape: z.enum(["box", "cylinder"]).default("box"),
  /** Width, height, depth of the component at the standard size, in mm. */
  size: z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]),
  /** Centre of the component at the standard size, in mm. */
  position: vec3,
  material: z.enum(MATERIAL_SLOTS).default("body"),
  resize: z
    .object({
      x: z.enum(RESIZE_MODES).optional(),
      y: z.enum(RESIZE_MODES).optional(),
      z: z.enum(RESIZE_MODES).optional(),
    })
    .default({}),
});

export const modelSchema = z.object({
  parts: z.array(partSchema).min(1).max(120),
});

// ==========================================
// PRICING
// ==========================================

const cents = z.coerce.number().int().min(0).max(100_000_000);

export const pricingSchema = z.object({
  /** Fixed cost of making the piece at all: setup, joinery, finishing. */
  baseCents: cents,
  /** Timber cost per cubic metre of finished components. */
  timberPerCubicMetreCents: cents.default(0),
  /** Cost per square metre of footprint (width × depth). */
  areaPerSquareMetreCents: cents.default(0),
  /** Extra workshop time per centimetre a dimension grows past standard. */
  labourPerCentimetreCents: cents.default(0),
  /** Flat charge for any size other than the standard one. */
  customSurchargeCents: cents.default(0),
  /** Every price line is rounded to this step, so the total is a clean number. */
  roundToCents: z.coerce.number().int().min(1).max(100_000).default(100),
});

// ==========================================
// OPTIONS: timber species, finishes, hardware
// ==========================================

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "A colour like #b98a5a");

export const optionChoiceSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/),
  label: z.string().min(1).max(60),
  description: z.string().max(200).optional(),
  /** Added to the price as is. */
  priceCents: z.coerce.number().int().min(-10_000_000).max(10_000_000).default(0),
  /** Multiplies the timber cost — a dearer species costs more per cubic metre. */
  timberMultiplier: z.coerce.number().min(0.1).max(10).default(1),
  /** Extra workshop days. */
  leadDays: z.coerce.number().int().min(0).max(365).default(0),
  /** Colour of the material in the 3D view and the swatch. */
  color: hex.optional(),
});

export const optionGroupSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/),
  label: z.string().min(1).max(60),
  /** Which 3D material slot the colour of the chosen option paints, if any. */
  paints: z.enum(MATERIAL_SLOTS).optional(),
  choices: z.array(optionChoiceSchema).min(1).max(16),
});

export const optionsSchema = z.array(optionGroupSchema).max(8);

// ==========================================
// PAGE DESIGN: what makes each product page its own
// ==========================================

/**
 * A product page's design. `id` names one of the bespoke designs in
 * worker/designs/, each made for one piece. The page's words are only these
 * two: a short line, and up to two sentences. Older rows may carry more
 * keys (story, highlights, care, photo slots); nothing reads them.
 */
export const designSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z][a-z0-9-]{0,39}$/)
    .default("draft"),
  /** A short line under the name. */
  headline: z.string().max(80).default(""),
  /** Up to two sentences. */
  intro: z.string().max(300).default(""),
});

// ==========================================
// A CUSTOMER'S CONFIGURATION
// ==========================================

export const selectionSchema = z.object({
  width: z.number().int(),
  height: z.number().int(),
  depth: z.number().int(),
  /** groupId → choiceId */
  options: z.record(z.string(), z.string()).default({}),
});

// ==========================================
// TYPES
// ==========================================

export type Dimension = z.infer<typeof dimensionSchema>;
export type Dimensions = z.infer<typeof dimensionsSchema>;
export type Part = z.infer<typeof partSchema>;
export type Model = z.infer<typeof modelSchema>;
export type Pricing = z.infer<typeof pricingSchema>;
export type OptionChoice = z.infer<typeof optionChoiceSchema>;
export type OptionGroup = z.infer<typeof optionGroupSchema>;
export type Options = z.infer<typeof optionsSchema>;
export type Design = z.infer<typeof designSchema>;
export type Selection = z.infer<typeof selectionSchema>;

/** Everything the engine needs to know about one piece. */
export interface FurnitureSpec {
  dimensions: Dimensions;
  model: Model;
  pricing: Pricing;
  options: Options;
  leadDaysStandard: number;
  leadDaysCustom: number;
}

/**
 * Checks that the model agrees with the dimensions it claims: at the standard
 * size the components must fill the stated width, height and depth.
 *
 * A model that disagrees is exactly the failure the brief warns about — the
 * site would show and price one size and the workshop would build another —
 * so the admin form refuses to save one.
 */
export function modelMismatch(dimensions: Dimensions, model: Model, toleranceMm = 2): string[] {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const part of model.parts) {
    for (let a = 0; a < 3; a++) {
      lo[a] = Math.min(lo[a], part.position[a] - part.size[a] / 2);
      hi[a] = Math.max(hi[a], part.position[a] + part.size[a] / 2);
    }
  }
  const problems: string[] = [];
  const expect: [DimensionKey, number, number, number][] = [
    ["width", 0, -dimensions.width.standard / 2, dimensions.width.standard / 2],
    ["height", 1, 0, dimensions.height.standard],
    ["depth", 2, -dimensions.depth.standard / 2, dimensions.depth.standard / 2],
  ];
  for (const [key, a, wantLo, wantHi] of expect) {
    if (Math.abs(lo[a] - wantLo) > toleranceMm || Math.abs(hi[a] - wantHi) > toleranceMm) {
      problems.push(
        `${key}: the components span ${Math.round(lo[a])} to ${Math.round(hi[a])} mm, ` +
          `expected ${wantLo} to ${wantHi} mm`,
      );
    }
  }
  return problems;
}

/** Every option group must name distinct choice ids, or a selection is ambiguous. */
export function optionProblems(options: Options): string[] {
  const problems: string[] = [];
  const groups = new Set<string>();
  for (const group of options) {
    if (groups.has(group.id)) problems.push(`Option group "${group.id}" appears twice`);
    groups.add(group.id);
    const ids = new Set<string>();
    for (const choice of group.choices) {
      if (ids.has(choice.id)) problems.push(`"${group.id}" has two choices called "${choice.id}"`);
      ids.add(choice.id);
    }
  }
  return problems;
}
