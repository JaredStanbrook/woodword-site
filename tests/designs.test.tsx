// Every page design must still be a working product page. A design is free
// to look like anything, but it may not drop what a customer needs to buy the
// piece, or the copy and photos the owner edits in the admin.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";

import { CATALOGUE } from "../worker/config/catalogue";
import { DESIGNS } from "../worker/designs";
import { slotSource } from "../worker/designs/blocks";
import { quote, standardSelection } from "../worker/lib/furniture";
import { specOf } from "../worker/schema/product.schema";
import { parseProductForm, productToForm } from "../worker/services/product-form";
import { ProductPage } from "../worker/views/shop/ProductPage";
import { mediaUrl } from "../worker/views/shop/parts";

const DESIGN_DIR = join(__dirname, "../worker/designs");
const IMAGES = [
  "products/9/images/a.jpg",
  "products/9/images/b.jpg",
  "products/9/images/c.jpg",
  "products/9/images/d.jpg",
  "products/9/images/e.jpg",
];

/** A piece with every field filled, so a design that leaves one out shows. */
const fixture = (designId: string, photos: Record<string, string> = {}) => {
  const def = DESIGNS[designId];
  const base = CATALOGUE.find((p) => p.design.id === "splay")!;
  return {
    ...base,
    id: 9,
    name: "Fixture Piece",
    availability: "in_stock",
    description: "DESCRIPTION-TEXT about the piece.",
    images: IMAGES,
    modelKey: null,
    blendKey: null,
    modelVersion: 1,
    publishedAt: null,
    deletedAt: null,
    createdAt: "",
    updatedAt: "",
    design: {
      id: designId,
      headline: "HEADLINE-TEXT",
      intro: "INTRO-TEXT",
      story: [
        { heading: "STORY-ONE", body: "Body one." },
        { heading: "STORY-TWO", body: "Body two." },
      ],
      highlights: [{ label: "HIGHLIGHT-LABEL", value: "HIGHLIGHT-VALUE" }],
      care: "CARE-TEXT",
      extra: Object.fromEntries(def.extra.map((f) => [f.key, `EXTRA-${f.key}`])),
      photos,
    },
  } as any;
};

const render = async (p: any) => {
  const spec = specOf(p);
  const sel = standardSelection(spec);
  return String(
    await (
      <ProductPage
        product={p}
        selection={sel}
        quote={quote(spec, sel)}
        locale="en-IE"
        currency="EUR"
        purchasable
      />
    ),
  );
};

const designIds = Object.keys(DESIGNS);

describe("page designs", () => {
  it("are registered under their own id, with unique field and slot keys", () => {
    for (const [id, d] of Object.entries(DESIGNS)) {
      expect(d.id).toBe(id);
      expect(id).toMatch(/^[a-z][a-z0-9-]{0,39}$/);
      const extra = d.extra.map((f) => f.key);
      expect(new Set(extra).size, `${id} extra keys`).toBe(extra.length);
      for (const k of extra) expect(k, `${id} extra key`).toMatch(/^[a-z][a-z0-9_]*$/);
      const slots = d.photos.map((s) => s.key);
      expect(new Set(slots).size, `${id} slot keys`).toBe(slots.length);
      for (const k of slots) expect(k, `${id} slot key`).toMatch(/^photo\d+$/);
    }
  });

  it("each has a folder with a stylesheet scoped to it, imported by the site", () => {
    const folders = readdirSync(DESIGN_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    expect(new Set(folders)).toEqual(new Set(designIds));
    const site = readFileSync(join(__dirname, "../worker/index.css"), "utf8");
    for (const id of designIds) {
      expect(site, `${id} imported`).toContain(
        `@import "./designs/${id}/design.css" layer(designs);`,
      );
      // Rules sit under .design-<id>; the only at-rules allowed are fonts,
      // media and supports queries, and keyframes named for the design.
      const root = postcss.parse(readFileSync(join(DESIGN_DIR, id, "design.css"), "utf8"));
      let rules = 0;
      root.walkAtRules((at) => {
        expect(["font-face", "media", "supports", "keyframes"], `${id}: @${at.name}`).toContain(
          at.name,
        );
        if (at.name === "keyframes")
          expect(at.params, `${id}: keyframes name`).toMatch(new RegExp(`^${id}-`));
      });
      root.walkRules((rule) => {
        if (rule.parent?.type === "atrule" && (rule.parent as postcss.AtRule).name === "keyframes")
          return;
        rules++;
        for (const sel of rule.selectors) {
          expect(sel, `${id}: every rule stays under .design-${id}`).toMatch(
            new RegExp(`^\\.design-${id}(?![\\w-])`),
          );
        }
      });
      expect(rules, `${id} has rules`).toBeGreaterThan(0);
    }
  });

  for (const id of designIds) {
    describe(id, () => {
      it("carries everything a product page needs", async () => {
        const html = await render(fixture(id));
        expect(html.match(/<h1[\s>]/g)?.length, "one h1").toBe(1);
        expect(html).toMatch(/<h1[^>]*>[^<]*Fixture Piece/);
        expect(html).toContain(`class="design-${id} `);
        expect(html).toContain("<furniture-viewer");
        expect(html).toContain("<furniture-configurator");
        expect(html).toContain("data-price-roll");
        expect(html).toContain('action="/cart"');
        expect(html).toContain("Standard size and the range it can be made in");
        expect(html, "availability").toMatch(/[Rr]eady to ship|In stock/);
        for (const text of [
          "HEADLINE-TEXT",
          "INTRO-TEXT",
          "STORY-ONE",
          "STORY-TWO",
          "HIGHLIGHT-LABEL",
          "HIGHLIGHT-VALUE",
          "CARE-TEXT",
          "DESCRIPTION-TEXT",
        ]) {
          expect(html, text).toContain(text);
        }
        for (const f of DESIGNS[id].extra)
          expect(html, `extra ${f.key}`).toContain(`EXTRA-${f.key}`);
        expect(html).not.toMatch(/\$\{[^}]{0,60}\}/);
      });

      it("shows a drawing in every empty photo slot and the chosen photo in a filled one", async () => {
        const empty = await render(fixture(id));
        for (const slot of DESIGNS[id].photos) {
          expect(empty, slot.key).toContain(
            `data-slot="${slot.key}" data-fill="blueprint-${slot.fallback}"`,
          );
        }
        const chosen = Object.fromEntries(DESIGNS[id].photos.map((s, i) => [s.key, IMAGES[i]]));
        const filled = await render(fixture(id, chosen));
        DESIGNS[id].photos.forEach((slot, i) => {
          expect(filled, slot.key).toContain(`data-slot="${slot.key}" data-fill="photo"`);
          expect(filled, slot.key).toContain(`src="${mediaUrl(IMAGES[i])}"`);
        });
      });
    });
  }
});

describe("photo slots", () => {
  const slot = { key: "photo1", label: "Photo 1", fallback: "line" as const };
  it("fall back to the design's drawing for an unknown or removed photo", () => {
    const p = fixture("splay", { photo1: "products/9/images/gone.jpg" });
    expect(slotSource(p, slot)).toEqual({ blueprint: "line" });
    expect(slotSource(fixture("splay", { photo1: "blueprint:foil" }), slot)).toEqual({
      blueprint: "foil",
    });
    expect(slotSource(fixture("splay", { photo1: IMAGES[2] }), slot)).toEqual({ image: IMAGES[2] });
  });
});

describe("design form fields", () => {
  const console_ = CATALOGUE.find((p) => p.design.id === "splay")!;
  const existing = { ...console_, images: IMAGES } as any;

  it("keeps a design's own text and photo choices through the form", () => {
    const values = {
      ...productToForm(existing),
      "photo.photo1": IMAGES[1],
      "photo.photo2": "blueprint:foil",
    };
    const parsed = parseProductForm(values, existing);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.design.id).toBe("splay");
    expect(parsed.data.design.extra).toEqual(console_.design.extra);
    expect(parsed.data.design.photos).toEqual({ photo1: IMAGES[1], photo2: "blueprint:foil" });
  });

  it("keeps text from another design when switching, and clears emptied fields", () => {
    const values = { ...productToForm(existing), design: "nord", "extra.shed_note": "" };
    delete (values as any)["extra.splay_note"];
    const parsed = parseProductForm(values, existing);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.design.id).toBe("nord");
    expect(parsed.data.design.extra.splay_note).toBe(console_.design.extra.splay_note);
    expect(parsed.data.design.extra.shed_note).toBeUndefined();
  });

  it("reads story sections posted with browser (CRLF) line breaks", () => {
    const values = productToForm(existing);
    values.story = values.story.replace(/\n/g, "\r\n");
    values.highlights = values.highlights.replace(/\n/g, "\r\n");
    const parsed = parseProductForm(values, existing);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.design.story).toEqual(console_.design.story);
    expect(parsed.data.design.highlights).toEqual(console_.design.highlights);
  });

  it("refuses an unknown design, a photo not on the piece, and publishing on the draft design", () => {
    const base = productToForm(existing);
    const bad = (v: Record<string, string>) => {
      const r = parseProductForm({ ...base, ...v }, existing);
      return r.ok ? null : r.errors.design;
    };
    expect(bad({ design: "nope" })).toMatch(/no design/);
    expect(bad({ "photo.photo1": "products/1/images/other.jpg" })).toMatch(/no longer/);
    expect(bad({ "photo.photo1": "blueprint:sketch" })).toMatch(/no longer/);
    expect(bad({ design: "draft", status: "published" })).toMatch(/before publishing/);
    expect(bad({ design: "draft", status: "draft" })).toBeNull();
  });
});
