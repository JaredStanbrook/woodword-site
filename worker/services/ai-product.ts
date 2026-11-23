// worker/services/ai-product.ts
//
// Drafts a product from a written brief with Claude.
//
// The model returns a configuration — copy, dimensions, components with
// their resize rules, pricing, options, and a page design picked from the
// fixed set of layouts and palettes — never code. Structured outputs hold it
// to the schema below; the result then goes through the same validation as
// the admin form (parseProductForm), so a generated piece is checked exactly
// like a hand-entered one, and is saved as a draft for a person to review.

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";

import {
  CATEGORIES,
  LAYOUTS,
  MATERIAL_SLOTS,
  PALETTES,
  RESIZE_MODES,
  TYPEFACES,
} from "../schema/furniture.config";
import type { ProductData } from "./product-form";

export const DEFAULT_AI_MODEL = "claude-opus-5-5";

const xyz = z.object({ x: z.number(), y: z.number(), z: z.number() });
const dim = z.object({
  standard: z.number().int(),
  min: z.number().int(),
  max: z.number().int(),
  step: z.number().int(),
});
const mode = z.enum(RESIZE_MODES);

const GeneratedProduct = z.object({
  name: z.string(),
  summary: z.string().describe("One sentence for the gallery card, under 140 characters."),
  description: z
    .string()
    .describe("Two short paragraphs on construction and materials, separated by a blank line."),
  category: z.enum(CATEGORIES),
  leadDaysStandard: z.number().int(),
  leadDaysCustom: z.number().int(),
  dimensions: z.object({ width: dim, height: dim, depth: dim }),
  parts: z.array(
    z.object({
      name: z
        .string()
        .describe("Unique snake_case id, e.g. leg_1. This becomes the Blender object name."),
      label: z.string().describe("Workshop name shared by identical pieces, e.g. Leg."),
      shape: z.enum(["box", "cylinder"]),
      size: xyz.describe("Width (x), height (y), depth (z) in mm at the standard size."),
      position: xyz.describe(
        "Centre in mm. y is up from the floor (y=0); x and z are centred on 0.",
      ),
      material: z.enum(MATERIAL_SLOTS),
      resize: z.object({ x: mode, y: mode, z: mode }),
    }),
  ),
  pricing: z.object({
    baseCents: z.number().int(),
    timberPerCubicMetreCents: z.number().int(),
    areaPerSquareMetreCents: z.number().int(),
    labourPerCentimetreCents: z.number().int(),
    customSurchargeCents: z.number().int(),
    roundToCents: z.number().int(),
  }),
  options: z.array(
    z.object({
      id: z.string().describe("lowercase-hyphenated"),
      label: z.string(),
      paints: z.enum([...MATERIAL_SLOTS, "none"]),
      choices: z.array(
        z.object({
          id: z.string().describe("lowercase-hyphenated"),
          label: z.string(),
          description: z.string(),
          priceCents: z.number().int(),
          timberMultiplier: z.number(),
          leadDays: z.number().int(),
          color: z.string().describe("#rrggbb colour of the material, or an empty string"),
        }),
      ),
    }),
  ),
  design: z.object({
    layout: z.enum(LAYOUTS),
    palette: z.enum(PALETTES),
    typeface: z.enum(TYPEFACES),
    headline: z.string(),
    intro: z.string(),
    story: z.array(z.object({ heading: z.string(), body: z.string() })),
    highlights: z.array(z.object({ label: z.string(), value: z.string() })),
    care: z.string(),
  }),
});

type Generated = z.infer<typeof GeneratedProduct>;

const SYSTEM = `You design pieces for a handmade-furniture workshop's online shop. From the owner's brief you produce one product configuration: copy, dimensions, a component model, pricing and the product page's design. The shop renders it with fixed, shared components, so you only choose values.

COMPONENT MODEL — this is the most important part; it drives the 3D view, the price and the workshop cut list.
- Units are millimetres. y is up, the floor is y = 0. x is width and z is depth, both centred on 0. Positions are component centres.
- At the standard size the components together must span exactly x from -width/2 to +width/2, y from 0 to height, z from -depth/2 to +depth/2. Nothing may stick out past those bounds (handles included: keep them inside the depth).
- Model each physical piece of timber or hardware as one box or cylinder (cylinders stand upright along y; x and z sizes are the diameter). Use realistic sections: legs 40–80 mm, tabletops 25–40 mm, carcass panels 18–25 mm. Give identical pieces the same label (four "Leg") and unique names (leg_1…leg_4). Keep it low-poly: 4–40 components.
- material: "body" for the main timber, "accent" for a contrasting timber part, "metal" for hardware, "glass" for glass.
- Resize rule per axis decides how a component follows a change in that dimension:
  "anchor": each end keeps its distance to the nearer outside face. A part spanning the centre line grows (tabletops, aprons, rails between legs); a part on one side moves with that side and keeps its size (legs, side panels). A leg running from the floor to near the top grows in height. This is the right default for most parts.
  "move": keeps its size, centre anchored like above.
  "spread": keeps its size, centre moves in proportion — use for middle shelves and intermediate rails so spacing stays even.
  "scale": size and position scale in proportion.
  "fixed": unchanged — use on an axis where a small part sits on the centre line (a handle where two doors meet, a centred stretcher's depth) because "anchor" would stretch it.
- Two doors meeting in the middle: make each door's inner edge exactly x = 0 so they widen correctly.

DIMENSIONS: standard is the size drawn; min/max are what joinery allows (a top spans further than a carcass stays rigid); step is 5 or 10 mm. Seating heights stay within a narrow range.

PRICING (integer cents, the shop's currency): baseCents is fixed making cost; timberPerCubicMetreCents is applied to the volume of the resized body+accent components (typical solid hardwood 500000–900000); areaPerSquareMetreCents to the width×depth footprint (0 if not meaningful); labourPerCentimetreCents per cm grown beyond standard; customSurchargeCents for any non-standard size; roundToCents 500 or 1000. Aim for a believable handmade price.

OPTIONS: up to four groups. A timber group should paint "body" with a colour per species and use timberMultiplier for dearer species (walnut ~1.6–1.8). Finishes usually paint "none". The first choice is the default. Use "" for colour when there is none.

PAGE DESIGN: choose the layout that suits the brief — "architectural" (minimal, technical spec-sheet), "heritage" (warm, traditional, centred serif), "geometric" (contemporary, blocky, bold), "editorial" (magazine-like, image-led). Pick palette and typeface ("serif", "sans", or "display" = extended geometric) to match. Write in plain, specific British English about how it is made — no superlatives, no claims the brief does not support, no invented certifications. Story: two to four short sections. Highlights: three or four short label/value facts.`;

function toProductData(g: Generated, prompt: string): ProductData {
  const t = (v: { x: number; y: number; z: number }) => [v.x, v.y, v.z] as [number, number, number];
  return {
    name: g.name,
    slug: "",
    category: g.category,
    status: "draft",
    availability: "made_to_order",
    summary: g.summary,
    description: g.description,
    leadDaysStandard: g.leadDaysStandard,
    leadDaysCustom: g.leadDaysCustom,
    sortOrder: 0,
    prompt,
    dimensions: g.dimensions,
    model: {
      parts: g.parts.map((p) => ({
        name: p.name,
        label: p.label,
        shape: p.shape,
        size: t(p.size),
        position: t(p.position),
        material: p.material,
        resize: p.resize,
      })),
    },
    pricing: g.pricing,
    options: g.options.map((o) => ({
      id: o.id,
      label: o.label,
      paints: o.paints === "none" ? undefined : o.paints,
      choices: o.choices.map((c) => ({
        id: c.id,
        label: c.label,
        description: c.description || undefined,
        priceCents: c.priceCents,
        timberMultiplier: c.timberMultiplier,
        leadDays: c.leadDays,
        color: /^#[0-9a-fA-F]{6}$/.test(c.color) ? c.color : undefined,
      })),
    })),
    design: g.design,
  };
}

export class GenerationError extends Error {}

/** A draft product from a brief. Throws GenerationError with a message fit to show the admin. */
export async function generateProduct(
  env: { ANTHROPIC_API_KEY?: string; AI_MODEL?: string },
  prompt: string,
  currency: string,
): Promise<ProductData> {
  if (!env.ANTHROPIC_API_KEY) throw new GenerationError("ANTHROPIC_API_KEY is not set.");
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1 });

  let response;
  try {
    response = await client.beta.messages.parse({
      model: env.AI_MODEL || DEFAULT_AI_MODEL,
      max_tokens: 16000,
      // If the primary model declines, the API retries on a fallback model it
      // picks for that kind of refusal, within the same request.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(GeneratedProduct) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Prices are in ${currency}.\n\nThe owner's brief:\n\n${prompt}`,
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError)
      throw new GenerationError("The Claude API key was rejected.");
    if (err instanceof Anthropic.RateLimitError)
      throw new GenerationError("Rate limited by the Claude API — try again in a minute.");
    if (err instanceof Anthropic.APIError)
      throw new GenerationError(`Claude API error ${err.status}: ${err.message}`);
    throw new GenerationError(`Could not reach the Claude API: ${(err as Error).message}`);
  }

  if (response.stop_reason === "refusal") {
    throw new GenerationError("The model declined this brief. Try rewording it.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new GenerationError(
      "The design came back incomplete. Try a simpler piece, or fewer options.",
    );
  }
  if (!response.parsed_output)
    throw new GenerationError("The model's answer did not match the product format.");

  return toProductData(response.parsed_output, prompt);
}
