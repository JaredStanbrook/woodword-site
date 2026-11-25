import { describe, it, expect } from "vitest";

import { CATALOGUE } from "../worker/config/catalogue";
import { EXAMPLES } from "./fixtures/examples";

import {
  modelMismatch,
  modelSchema,
  dimensionsSchema,
  optionsSchema,
  pricingSchema,
  type FurnitureSpec,
} from "../worker/schema/furniture.config";
import {
  clampDimension,
  cutList,
  normaliseSelection,
  quote,
  paintOrder,
  resizeParts,
  selectionInputFromQuery,
  selectionToQuery,
  standardSelection,
  startingPrice,
} from "../worker/lib/furniture";
import { parseProductForm, productToForm } from "../worker/services/product-form";
import { verifyWebhook } from "../worker/lib/stripe";
import { priceGlyphs, formatPrice } from "../worker/lib/money";
import { ProductPage } from "../worker/views/shop/ProductPage";
import { DESIGNS } from "../worker/designs";

// The shop's piece plus the retired examples, which cover resizing the
// console does not (doors, spread shelves, aprons).
const PIECES = [...CATALOGUE, ...EXAMPLES];

const specOf = (p: (typeof PIECES)[number]): FurnitureSpec => ({
  dimensions: p.dimensions,
  model: p.model,
  pricing: p.pricing,
  options: p.options,
  leadDaysStandard: p.leadDaysStandard!,
  leadDaysCustom: p.leadDaysCustom!,
});

const table = specOf(EXAMPLES[0]);
const part = (spec: FurnitureSpec, sel: Parameters<typeof resizeParts>[1], name: string) =>
  resizeParts(spec, sel).find((p) => p.name === name)!;

describe("catalogue", () => {
  it("every example is valid and its model fills its standard size", () => {
    for (const p of PIECES) {
      expect(dimensionsSchema.safeParse(p.dimensions).success, p.name).toBe(true);
      expect(modelSchema.safeParse(p.model).success, p.name).toBe(true);
      expect(pricingSchema.safeParse(p.pricing).success, p.name).toBe(true);
      expect(optionsSchema.safeParse(p.options).success, p.name).toBe(true);
      expect(modelMismatch(p.dimensions, p.model), p.name).toEqual([]);
    }
  });

  it("gives each example its own registered design", () => {
    const ids = CATALOGUE.map((p) => p.design.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(DESIGNS[id], id).toBeDefined();
  });

  it("stays inside its size at the largest and smallest size", () => {
    for (const p of PIECES) {
      const spec = specOf(p);
      for (const end of ["min", "max"] as const) {
        const sel = normaliseSelection(spec, {
          width: p.dimensions.width[end],
          height: p.dimensions.height[end],
          depth: p.dimensions.depth[end],
        });
        const resized = { parts: resizeParts(spec, sel).map((r) => ({ ...r, resize: {} })) };
        const dims = {
          width: { ...p.dimensions.width, standard: sel.width },
          height: { ...p.dimensions.height, standard: sel.height },
          depth: { ...p.dimensions.depth, standard: sel.depth },
        };
        expect(modelMismatch(dims, resized), `${p.name} at ${end}`).toEqual([]);
        for (const r of resized.parts)
          for (const s of r.size) expect(s, `${p.name} ${r.name}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("resizing by component", () => {
  const wide = normaliseSelection(table, { width: 2400, height: 750, depth: 900 });

  it("grows the tabletop without thickening it", () => {
    const top = part(table, wide, "top");
    expect(top.size).toEqual([2400, 30, 900]);
    expect(top.position[1]).toBe(735);
  });

  it("moves legs out with the corners and keeps their section", () => {
    const leg = part(table, wide, "leg_1");
    expect(leg.size).toEqual([60, 720, 60]);
    expect(leg.position[0]).toBe(820 + 300); // still 50 mm in from the edge
  });

  it("lengthens the aprons between the legs", () => {
    expect(part(table, wide, "apron_long_1").size[0]).toBe(1580 + 600);
    expect(part(table, wide, "apron_short_1").position[0]).toBe(839 + 300);
  });

  it("raises the top and lengthens the legs when it gets taller", () => {
    const tall = normaliseSelection(table, { height: 800 });
    expect(part(table, tall, "top").position[1]).toBe(785);
    expect(part(table, tall, "top").size[1]).toBe(30);
    expect(part(table, tall, "leg_1").size[1]).toBe(770);
    expect(part(table, tall, "leg_1").position[1]).toBe(385);
  });

  it("spreads middle shelves evenly and keeps them their thickness", () => {
    const shelves = specOf(EXAMPLES[2]);
    const tall = normaliseSelection(shelves, { height: 2400 });
    const ys = [1, 2, 3, 4, 5].map((i) => part(shelves, tall, `shelf_${i}`));
    for (const s of ys) expect(s.size[1]).toBe(24);
    expect(ys[0].position[1]).toBe(60);
    expect(ys[4].position[1]).toBe(2388);
    expect(ys[2].position[1]).toBeCloseTo((924 * 2400) / 1800);
  });

  it("keeps cabinet doors meeting in the middle and handles by the meeting line", () => {
    const cab = specOf(EXAMPLES[1]);
    const wider = normaliseSelection(cab, { width: 2200 });
    const right = part(cab, wider, "door_right");
    expect(right.position[0] - right.size[0] / 2).toBe(0);
    expect(right.position[0] + right.size[0] / 2).toBe(1080);
    expect(part(cab, wider, "handle_right").position[0]).toBe(40);
  });
});

describe("workshop drawing", () => {
  it("paints each part after the parts it hides", () => {
    const spec = specOf(CATALOGUE.find((p) => p.slug === "splay-console")!);
    const names = paintOrder(resizeParts(spec, standardSelection(spec))).map((p) => p.name);
    const at = (n: string) => names.indexOf(n);
    // The aprons sit under the top, the shelf behind the front legs.
    for (const n of names.filter((n) => n.startsWith("apron")))
      expect(at(n), n).toBeLessThan(at("top"));
    expect(at("shelf")).toBeLessThan(at("leg_1"));
  });
});

describe("selection", () => {
  it("clamps to the limits and snaps to the step", () => {
    const d = table.dimensions.width;
    expect(clampDimension(99999, d)).toBe(2400);
    expect(clampDimension(5, d)).toBe(1200);
    expect(clampDimension(1834, d)).toBe(1830);
    expect(clampDimension(Number.NaN, d)).toBe(1800);
  });

  it("falls back to the first choice for unknown options", () => {
    const sel = normaliseSelection(table, { options: { timber: "unobtainium", bogus: "x" } });
    expect(sel.options).toEqual({ timber: "oak", finish: "oil" });
  });

  it("round-trips through a query string", () => {
    const sel = normaliseSelection(table, {
      width: 2000,
      height: 760,
      depth: 1000,
      options: { timber: "walnut", finish: "soap" },
    });
    const query = Object.fromEntries(new URLSearchParams(selectionToQuery(sel)));
    expect(normaliseSelection(table, selectionInputFromQuery(query))).toEqual(sel);
  });
});

describe("pricing", () => {
  it("lines always sum to the total", () => {
    for (const p of PIECES) {
      const spec = specOf(p);
      for (const sel of [
        standardSelection(spec),
        normaliseSelection(spec, { width: p.dimensions.width.max, depth: p.dimensions.depth.min }),
      ]) {
        const q = quote(spec, sel);
        expect(q.lines.reduce((s, l) => s + l.cents, 0)).toBe(q.totalCents);
        expect(q.totalCents % p.pricing.roundToCents).toBe(0);
      }
    }
  });

  it("charges more for a bigger piece and for a dearer timber", () => {
    const std = quote(table, standardSelection(table)).totalCents;
    const big = quote(table, normaliseSelection(table, { width: 2400 })).totalCents;
    const walnut = quote(
      table,
      normaliseSelection(table, { options: { timber: "walnut" } }),
    ).totalCents;
    expect(big).toBeGreaterThan(std);
    expect(walnut).toBeGreaterThan(std);
  });

  it("adds custom-size lead time only for a custom size", () => {
    expect(quote(table, standardSelection(table)).leadDays).toBe(21);
    expect(quote(table, normaliseSelection(table, { width: 1900 })).leadDays).toBe(35);
    expect(
      quote(table, normaliseSelection(table, { options: { timber: "walnut" } })).leadDays,
    ).toBe(28);
  });

  it("gives a starting price no higher than the standard price", () => {
    for (const p of PIECES) {
      const spec = specOf(p);
      expect(startingPrice(spec)).toBeLessThanOrEqual(
        quote(spec, standardSelection(spec)).totalCents,
      );
    }
  });

  it("formats the rolling price as the same string as the static one", () => {
    const glyphs = priceGlyphs(145000, "en-IE", "EUR")
      .map((g) => g.ch)
      .join("");
    expect(glyphs).toBe(formatPrice(145000, "en-IE", "EUR"));
    expect(glyphs).toBe("€1,450");
  });
});

describe("manufacturing", () => {
  it("groups identical components in the cut list, longest dimension first", () => {
    const rows = cutList(resizeParts(table, standardSelection(table)));
    const legs = rows.find((r) => r.label === "Leg")!;
    expect(legs.quantity).toBe(4);
    expect(legs.dims).toEqual([720, 60, 60]);
    expect(rows.find((r) => r.label === "Tabletop")!.dims).toEqual([1800, 900, 30]);
  });
});

describe("admin product form", () => {
  it("round-trips every example through the form", () => {
    for (const p of PIECES) {
      const parsed = parseProductForm(productToForm(p));
      expect(parsed.ok, p.name).toBe(true);
      if (parsed.ok) {
        expect(parsed.data.model).toEqual(p.model);
        expect(parsed.data.pricing).toEqual(p.pricing);
        expect(parsed.data.design).toEqual(p.design);
      }
    }
  });

  it("refuses a model that does not fill the standard size", () => {
    const values = productToForm(EXAMPLES[0]);
    values.widthStandard = "2000";
    values.widthMax = "2400";
    const parsed = parseProductForm(values);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.parts).toMatch(/width/);
  });

  it("reports bad JSON instead of throwing", () => {
    const values = { ...productToForm(EXAMPLES[0]), parts: "[{oops" };
    const parsed = parseProductForm(values);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.parts).toMatch(/JSON/);
  });
});

describe("product page designs", () => {
  it("renders every example with the configurator, the viewer and the rolling price", async () => {
    for (const [i, p] of PIECES.entries()) {
      const full = {
        ...p,
        id: i + 1,
        images: [],
        modelKey: null,
        blendKey: null,
        modelVersion: 1,
        publishedAt: null,
        deletedAt: null,
        createdAt: "",
        updatedAt: "",
      } as any;
      const spec = specOf(p);
      const sel = standardSelection(spec);
      const html = String(
        await (
          <ProductPage
            product={full}
            selection={sel}
            quote={quote(spec, sel)}
            locale="en-IE"
            currency="EUR"
            purchasable
          />
        ),
      );
      expect(html, p.name).toContain("<furniture-configurator");
      expect(html, p.name).toContain("<furniture-viewer");
      expect(html, p.name).toContain("data-price-roll");
      expect(html, p.name).toContain(`design-${p.design.id}`);
      expect(html.match(/<h1/g)?.length, `${p.name} has one h1`).toBe(1);
      expect(html, p.name).not.toMatch(/\$\{[^}]{0,60}\}/);
    }
  });
});

describe("stripe webhook signature", () => {
  const secret = "whsec_test";
  const body = JSON.stringify({
    id: "evt_1",
    type: "checkout.session.completed",
    data: { object: {} },
  });
  const sign = async (t: number, payload: string, key = secret) => {
    const k = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(key),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${t}.${payload}`));
    return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  it("accepts a correctly signed, recent event", async () => {
    const t = Math.floor(Date.now() / 1000);
    expect(await verifyWebhook(secret, `t=${t},v1=${await sign(t, body)}`, body)).not.toBeNull();
  });

  it("rejects a tampered body, a wrong secret and an old timestamp", async () => {
    const t = Math.floor(Date.now() / 1000);
    expect(await verifyWebhook(secret, `t=${t},v1=${await sign(t, body)}`, body + " ")).toBeNull();
    expect(
      await verifyWebhook(secret, `t=${t},v1=${await sign(t, body, "whsec_other")}`, body),
    ).toBeNull();
    const old = t - 3600;
    expect(await verifyWebhook(secret, `t=${old},v1=${await sign(old, body)}`, body)).toBeNull();
    expect(await verifyWebhook(secret, undefined, body)).toBeNull();
  });
});

describe("collection layout", () => {
  it("fills every row of three exactly, with the first piece wide", async () => {
    const { collectionLayout } = await import("../worker/views/shop/Gallery");
    for (let n = 1; n <= 20; n++) {
      const layout = collectionLayout(n);
      expect(layout).toHaveLength(n);
      const cells = layout.reduce((sum, l) => sum + (l.wide ? 2 : 1), 0);
      if (n >= 3) {
        expect(cells % 3, `${n} pieces`).toBe(0);
        // Walk the rows: none may overflow three cells.
        let row = 0;
        for (const l of layout) {
          row += l.wide ? 2 : 1;
          expect(row, `${n} pieces`).toBeLessThanOrEqual(3);
          if (row === 3) row = 0;
        }
      }
      if (n >= 4) expect(layout[0].wide, `${n} pieces`).toBe(true);
    }
  });
});
