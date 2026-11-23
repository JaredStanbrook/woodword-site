// worker/services/product-form.ts
//
// The admin product form, both ways: a product row to form values, and posted
// form values back to a validated product. Story sections and highlights are
// edited as plain text (see the format notes beside each); components and
// options as JSON, because that is what the Blender export script and the AI
// generator produce.

import { z } from "zod";

import {
  AVAILABILITY,
  CATEGORIES,
  PRODUCT_STATUSES,
  designSchema,
  dimensionsSchema,
  modelMismatch,
  modelSchema,
  optionProblems,
  optionsSchema,
  pricingSchema,
  type Design,
  type Dimensions,
  type Model,
  type Options,
  type Pricing,
} from "../schema/furniture.config";
import {
  productSlugSchema,
  slugify,
  type InsertProduct,
  type SelectProduct,
} from "../schema/product.schema";

export type ProductFormValues = Record<string, string>;

const centsToMoney = (cents: number) => (cents / 100).toFixed(2).replace(/\.00$/, "");
const moneyToCents = (v: string | undefined) => {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};

/**
 * Story format: one section per block, the heading on a line starting `# `.
 *
 *   # Joinery
 *   Through-tenons, wedged and pinned…
 */
export const storyToText = (story: Design["story"]) =>
  story.map((s) => `# ${s.heading}\n${s.body}`).join("\n\n");

export const textToStory = (text: string): Design["story"] => {
  const sections: Design["story"] = [];
  let current: { heading: string; body: string[] } | null = null;
  for (const line of text.split("\n")) {
    const m = line.match(/^#\s+(.+)$/);
    if (m) {
      if (current)
        sections.push({ heading: current.heading, body: current.body.join("\n").trim() });
      current = { heading: m[1].trim(), body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  if (current) sections.push({ heading: current.heading, body: current.body.join("\n").trim() });
  return sections.filter((s) => s.body);
};

/** Highlights format: `Label: Value`, one per line. */
export const highlightsToText = (h: Design["highlights"]) =>
  h.map((x) => `${x.label}: ${x.value}`).join("\n");

export const textToHighlights = (text: string): Design["highlights"] =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf(":");
      return i < 0
        ? { label: l, value: "" }
        : { label: l.slice(0, i).trim(), value: l.slice(i + 1).trim() };
    });

export function productToForm(
  p: Partial<SelectProduct> &
    Pick<SelectProduct, "dimensions" | "model" | "pricing" | "options" | "design">,
): ProductFormValues {
  const v: ProductFormValues = {
    name: p.name ?? "",
    slug: p.slug ?? "",
    category: p.category ?? "tables",
    status: p.status ?? "draft",
    availability: p.availability ?? "made_to_order",
    summary: p.summary ?? "",
    description: p.description ?? "",
    leadDaysStandard: String(p.leadDaysStandard ?? 14),
    leadDaysCustom: String(p.leadDaysCustom ?? 28),
    sortOrder: String(p.sortOrder ?? 0),
    prompt: p.prompt ?? "",

    layout: p.design.layout,
    palette: p.design.palette,
    typeface: p.design.typeface,
    headline: p.design.headline,
    intro: p.design.intro,
    care: p.design.care,
    story: storyToText(p.design.story),
    highlights: highlightsToText(p.design.highlights),

    base: centsToMoney(p.pricing.baseCents),
    timberPerCubicMetre: centsToMoney(p.pricing.timberPerCubicMetreCents),
    areaPerSquareMetre: centsToMoney(p.pricing.areaPerSquareMetreCents),
    labourPerCentimetre: centsToMoney(p.pricing.labourPerCentimetreCents),
    customSurcharge: centsToMoney(p.pricing.customSurchargeCents),
    roundTo: centsToMoney(p.pricing.roundToCents),

    parts: JSON.stringify(p.model.parts, null, 2),
    options: JSON.stringify(p.options, null, 2),
  };
  for (const k of ["width", "height", "depth"] as const) {
    v[`${k}Standard`] = String(p.dimensions[k].standard);
    v[`${k}Min`] = String(p.dimensions[k].min);
    v[`${k}Max`] = String(p.dimensions[k].max);
    v[`${k}Step`] = String(p.dimensions[k].step);
  }
  return v;
}

const metaSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  slug: productSlugSchema,
  category: z.enum(CATEGORIES),
  status: z.enum(PRODUCT_STATUSES),
  availability: z.enum(AVAILABILITY),
  summary: z.string().trim().max(300),
  description: z.string().trim().max(10_000),
  leadDaysStandard: z.coerce.number().int().min(0).max(730),
  leadDaysCustom: z.coerce.number().int().min(0).max(730),
  sortOrder: z.coerce.number().int().min(-10_000).max(10_000),
});

const parseJson = (text: string, field: string, errors: Record<string, string>) => {
  try {
    return JSON.parse(text || "null");
  } catch (err) {
    errors[field] = `Not valid JSON: ${(err as Error).message}`;
    return undefined;
  }
};

const firstIssue = (e: z.ZodError) => {
  const i = e.issues[0];
  return `${i.path.length ? `${i.path.join(".")}: ` : ""}${i.message}`;
};

export type ProductData = Omit<InsertProduct, "id" | "createdAt" | "updatedAt" | "images">;

/** Validates the whole form. Returns the product to save, or field errors. */
export function parseProductForm(
  values: ProductFormValues,
): { ok: true; data: ProductData } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const v: ProductFormValues = {
    ...values,
    slug: values.slug?.trim() || slugify(values.name ?? ""),
  };

  const meta = metaSchema.safeParse(v);
  if (!meta.success) {
    for (const issue of meta.error.issues) errors[String(issue.path[0])] ??= issue.message;
  }

  let dimensions: Dimensions | undefined;
  const dims = dimensionsSchema.safeParse({
    width: { standard: v.widthStandard, min: v.widthMin, max: v.widthMax, step: v.widthStep || 10 },
    height: {
      standard: v.heightStandard,
      min: v.heightMin,
      max: v.heightMax,
      step: v.heightStep || 10,
    },
    depth: { standard: v.depthStandard, min: v.depthMin, max: v.depthMax, step: v.depthStep || 10 },
  });
  if (dims.success) dimensions = dims.data;
  else errors.dimensions = firstIssue(dims.error);

  let pricing: Pricing | undefined;
  const pr = pricingSchema.safeParse({
    baseCents: moneyToCents(v.base),
    timberPerCubicMetreCents: moneyToCents(v.timberPerCubicMetre || "0"),
    areaPerSquareMetreCents: moneyToCents(v.areaPerSquareMetre || "0"),
    labourPerCentimetreCents: moneyToCents(v.labourPerCentimetre || "0"),
    customSurchargeCents: moneyToCents(v.customSurcharge || "0"),
    roundToCents: moneyToCents(v.roundTo || "1"),
  });
  if (pr.success) pricing = pr.data;
  else errors.pricing = firstIssue(pr.error);

  let model: Model | undefined;
  const partsJson = parseJson(v.parts ?? "", "parts", errors);
  if (partsJson !== undefined) {
    const m = modelSchema.safeParse({ parts: partsJson });
    if (m.success) model = m.data;
    else errors.parts = firstIssue(m.error);
  }
  if (model) {
    const names = new Set<string>();
    for (const part of model.parts) {
      if (names.has(part.name)) errors.parts ??= `Two components are called "${part.name}"`;
      names.add(part.name);
    }
  }
  if (model && dimensions && !errors.parts) {
    const mismatch = modelMismatch(dimensions, model);
    if (mismatch.length) {
      errors.parts = `The components do not fill the standard size. ${mismatch.join("; ")}.`;
    }
  }

  let options: Options | undefined;
  const optionsJson = parseJson(v.options ?? "", "options", errors);
  if (optionsJson !== undefined) {
    const o = optionsSchema.safeParse(optionsJson ?? []);
    if (o.success) {
      options = o.data;
      const problems = optionProblems(options);
      if (problems.length) errors.options = problems.join("; ");
    } else errors.options = firstIssue(o.error);
  }

  let design: Design | undefined;
  const d = designSchema.safeParse({
    layout: v.layout,
    palette: v.palette,
    typeface: v.typeface,
    headline: v.headline ?? "",
    intro: v.intro ?? "",
    care: v.care ?? "",
    story: textToStory(v.story ?? ""),
    highlights: textToHighlights(v.highlights ?? ""),
  });
  if (d.success) design = d.data;
  else errors.design = firstIssue(d.error);

  if (
    Object.keys(errors).length ||
    !meta.success ||
    !dimensions ||
    !pricing ||
    !model ||
    !options ||
    !design
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      ...meta.data,
      dimensions,
      pricing,
      model,
      options,
      design,
      prompt: values.prompt?.trim() || null,
    },
  };
}
