// Every page design must still be a working product page. A design is free
// to look like anything, but it may not drop what a customer needs to buy the
// piece: the name, the two lines of copy, the gallery, the 3D view and the
// configurator. And it adds nothing else that needs words.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";

import { CATALOGUE } from "../worker/config/catalogue";
import { DESIGNS } from "../worker/designs";
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
const fixture = (designId: string, images: string[] = IMAGES) => {
  const base = CATALOGUE.find((p) => p.design.id === "splay")!;
  return {
    ...base,
    id: 9,
    name: "Fixture Piece",
    availability: "in_stock",
    images,
    modelKey: null,
    blendKey: null,
    modelVersion: 1,
    publishedAt: null,
    deletedAt: null,
    createdAt: "",
    updatedAt: "",
    design: { id: designId, headline: "HEADLINE-TEXT", intro: "INTRO-TEXT" },
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
  it("are registered under their own id", () => {
    for (const [id, d] of Object.entries(DESIGNS)) {
      expect(d.id).toBe(id);
      expect(id).toMatch(/^[a-z][a-z0-9-]{0,39}$/);
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
        expect(html, "availability").toMatch(/[Rr]eady to ship|In stock/);
        for (const text of ["HEADLINE-TEXT", "INTRO-TEXT"]) expect(html, text).toContain(text);
        expect(html).not.toMatch(/\$\{[^}]{0,60}\}/);
      });

      it("shows every photo in one gallery, then the workshop drawing", async () => {
        const html = await render(fixture(id));
        expect(html.match(/data-part="gallery"/g)?.length, "one gallery").toBe(1);
        for (const key of IMAGES) expect(html, key).toContain(`src="${mediaUrl(key)}"`);
        expect(html.match(/data-gallery-pick=/g)?.length).toBe(IMAGES.length + 1);
        expect(html).toContain('data-fill="drawing"');

        const empty = await render(fixture(id, []));
        expect(empty).toContain('data-fill="drawing"');
        expect(empty, "no thumbnails for one picture").not.toContain("data-gallery-pick");
      });
    });
  }
});

describe("design form fields", () => {
  const existing = CATALOGUE.find((p) => p.design.id === "splay")!;

  it("keeps the design and its two lines through the form", () => {
    const parsed = parseProductForm(productToForm(existing));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.design).toEqual(existing.design);
  });

  it("refuses an unknown design, and publishing on the draft design", () => {
    const base = productToForm(existing);
    const bad = (v: Record<string, string>) => {
      const r = parseProductForm({ ...base, ...v });
      return r.ok ? null : r.errors.design;
    };
    expect(bad({ design: "nope" })).toMatch(/no design/);
    expect(bad({ design: "draft", status: "published" })).toMatch(/before publishing/);
    expect(bad({ design: "draft", status: "draft" })).toBeNull();
  });

  it("refuses a headline or intro longer than the page allows", () => {
    const base = productToForm(existing);
    expect(parseProductForm({ ...base, headline: "x".repeat(81) }).ok).toBe(false);
    expect(parseProductForm({ ...base, intro: "x".repeat(301) }).ok).toBe(false);
  });
});
