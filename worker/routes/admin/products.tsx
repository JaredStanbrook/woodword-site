// worker/routes/admin/products.tsx
//
// Product management: list, create (by hand or from a prompt), edit, upload
// images / GLB / .blend to R2, archive and delete. Mounted under the admin
// sub-app, so every route here already requires the admin role.

import { Hono, type Context } from "hono";
import { and, asc, desc, eq, isNull, ne } from "drizzle-orm";

import type { AppEnv } from "@server/types";
import { product, slugify, type SelectProduct } from "@server/schema/product.schema";
import { flashToast } from "@server/lib/htmx-helpers";
import { randomBase64Url } from "@server/lib/crypto";
import { UPLOAD_LIMITS } from "@server/config/shop.config";
import { blankProduct } from "@server/config/catalogue";
import {
  parseProductForm,
  productToForm,
  type ProductData,
  type ProductFormValues,
} from "@server/services/product-form";
import { GenerationError, generateProduct } from "@server/services/ai-product";
import { DesignFields, ProductEditorPage, ProductListPage } from "@views/admin/Products";
import { GeneratePage } from "@views/admin/Generate";

export const productsAdminRoute = new Hono<AppEnv>();

const notDeleted = isNull(product.deletedAt);

async function load(c: Context<AppEnv>, id: number) {
  const [p] = await c.var.db
    .select()
    .from(product)
    .where(and(eq(product.id, id), notDeleted));
  return p;
}

const editor = (
  c: Context<AppEnv>,
  values: ProductFormValues,
  errors: Record<string, string>,
  p?: SelectProduct,
  notice?: string,
) =>
  c.render(
    <ProductEditorPage
      product={p}
      values={values}
      errors={errors}
      locale={c.var.app.locale}
      currency={c.var.app.currency}
      notice={notice}
      r2Available={Boolean(c.env.R2)}
    />,
    { title: p ? `Edit ${p.name}` : "New product" },
  );

/** Is this slug free (ignoring `exceptId`)? Deleted products keep theirs, since the column is unique. */
async function slugTaken(c: Context<AppEnv>, slug: string, exceptId?: number) {
  const rows = await c.var.db
    .select({ id: product.id })
    .from(product)
    .where(
      exceptId ? and(eq(product.slug, slug), ne(product.id, exceptId)) : eq(product.slug, slug),
    );
  return rows.length > 0;
}

/** A slug that is free, adding -2, -3… if needed. For generated drafts only. */
async function freeSlug(c: Context<AppEnv>, base: string) {
  const root = slugify(base) || "piece";
  for (let i = 1; i < 50; i++) {
    const candidate = i === 1 ? root : `${root}-${i}`;
    if (!(await slugTaken(c, candidate))) return candidate;
  }
  return `${root}-${randomBase64Url(4)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")}`;
}

const publishedAtFor = (data: ProductData, existing?: SelectProduct) =>
  data.status === "published"
    ? (existing?.publishedAt ?? new Date().toISOString())
    : (existing?.publishedAt ?? null);

// ==========================================
// LIST
// ==========================================

productsAdminRoute.get("/", async (c) => {
  const products = await c.var.db
    .select()
    .from(product)
    .where(notDeleted)
    .orderBy(asc(product.status), asc(product.sortOrder), desc(product.updatedAt));
  return c.render(
    <ProductListPage
      products={products}
      locale={c.var.app.locale}
      currency={c.var.app.currency}
      aiEnabled={Boolean(c.env.ANTHROPIC_API_KEY)}
    />,
    { title: "Products" },
  );
});

// ==========================================
// CREATE
// ==========================================

productsAdminRoute.get("/new", (c) => editor(c, productToForm(blankProduct()), {}));

// The design part of the form, redrawn for the design just picked, keeping
// what has been typed. Posted by the Design dropdown (hx-post).
productsAdminRoute.post("/design-fields", async (c) => {
  const values = (await c.req.parseBody()) as ProductFormValues;
  const id = Number(c.req.query("id"));
  const p = Number.isInteger(id) && id > 0 ? await load(c, id) : undefined;
  return c.html(<DesignFields values={values} errors={{}} product={p} />);
});

productsAdminRoute.post("/", async (c) => {
  const values = (await c.req.parseBody()) as ProductFormValues;
  const parsed = parseProductForm(values);
  if (!parsed.ok) {
    c.status(422);
    return editor(c, values, parsed.errors);
  }
  if (await slugTaken(c, parsed.data.slug)) {
    c.status(422);
    return editor(c, values, { slug: "Another product already uses this URL" });
  }
  const [created] = await c.var.db
    .insert(product)
    .values({
      ...parsed.data,
      images: [],
      publishedAt: publishedAtFor(parsed.data),
      updatedAt: new Date().toISOString(),
    })
    .returning({ id: product.id });
  flashToast(c, "Product created");
  return c.redirect(`/admin/products/${created.id}`);
});

// ==========================================
// GENERATE FROM A PROMPT
// ==========================================

productsAdminRoute.get("/generate", (c) =>
  c.render(<GeneratePage aiEnabled={Boolean(c.env.ANTHROPIC_API_KEY)} />, {
    title: "Create from a prompt",
  }),
);

productsAdminRoute.post("/generate", async (c) => {
  const body = await c.req.parseBody();
  const prompt = String(body.prompt ?? "")
    .trim()
    .slice(0, 4000);
  const aiEnabled = Boolean(c.env.ANTHROPIC_API_KEY);
  if (prompt.length < 20) {
    c.status(422);
    return c.render(
      <GeneratePage
        aiEnabled={aiEnabled}
        prompt={prompt}
        error="Describe the piece in a sentence or two at least."
      />,
      { title: "Create from a prompt" },
    );
  }

  let draft: ProductData;
  try {
    draft = await generateProduct(c.env, prompt, c.var.app.currency);
  } catch (err) {
    const message =
      err instanceof GenerationError ? err.message : "Generation failed unexpectedly.";
    if (!(err instanceof GenerationError)) console.error("[generate]", err);
    c.status(502);
    return c.render(<GeneratePage aiEnabled={aiEnabled} prompt={prompt} error={message} />, {
      title: "Create from a prompt",
    });
  }

  draft.slug = await freeSlug(c, draft.name);
  // The same checks as a hand-made product. A draft that fails them opens in
  // the editor, unsaved, with the problems listed, rather than being dropped.
  const values = productToForm(draft);
  const parsed = parseProductForm(values);
  if (!parsed.ok) {
    return editor(
      c,
      values,
      parsed.errors,
      undefined,
      "Drafted from your prompt. A few values need fixing before it can be saved.",
    );
  }

  const [created] = await c.var.db
    .insert(product)
    .values({ ...parsed.data, status: "draft", images: [], updatedAt: new Date().toISOString() })
    .returning({ id: product.id });
  flashToast(c, "Draft created from your prompt", {
    description: "Check the model and prices, add photos or a GLB, then publish.",
  });
  return c.redirect(`/admin/products/${created.id}`);
});

// ==========================================
// EDIT
// ==========================================

productsAdminRoute.get("/:id", async (c) => {
  const p = await load(c, Number(c.req.param("id")));
  if (!p) return c.notFound();
  return editor(c, productToForm(p), {}, p);
});

productsAdminRoute.post("/:id", async (c) => {
  const p = await load(c, Number(c.req.param("id")));
  if (!p) return c.notFound();
  const values = (await c.req.parseBody()) as ProductFormValues;
  const parsed = parseProductForm(values, p);
  if (!parsed.ok) {
    c.status(422);
    return editor(c, values, parsed.errors, p);
  }
  if (await slugTaken(c, parsed.data.slug, p.id)) {
    c.status(422);
    return editor(c, values, { slug: "Another product already uses this URL" }, p);
  }
  await c.var.db
    .update(product)
    .set({
      ...parsed.data,
      publishedAt: publishedAtFor(parsed.data, p),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(product.id, p.id));
  flashToast(c, "Saved");
  return c.redirect(`/admin/products/${p.id}`);
});

productsAdminRoute.post("/:id/delete", async (c) => {
  const id = Number(c.req.param("id"));
  const changed = await c.var.db
    .update(product)
    .set({
      deletedAt: new Date().toISOString(),
      status: "archived",
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(product.id, id), notDeleted))
    .returning({ id: product.id });
  flashToast(c, changed.length ? "Product deleted" : "That product was already deleted", {
    type: changed.length ? "success" : "info",
  });
  return c.redirect("/admin/products");
});

// ==========================================
// UPLOADS (R2)
// ==========================================

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/** Checks the first bytes, not just the browser's claim about the type. */
function sniff(bytes: Uint8Array): string | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (ascii(1, 4) === "PNG") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp" && ascii(8, 12).startsWith("avi")) return "image/avif";
  if (ascii(0, 4) === "glTF") return "model/gltf-binary";
  if (ascii(0, 7) === "BLENDER") return "application/x-blender";
  return null;
}

const files = (v: unknown): File[] =>
  (Array.isArray(v) ? v : [v]).filter((f): f is File => f instanceof File && f.size > 0);

async function store(c: Context<AppEnv>, key: string, file: File, contentType: string) {
  await c.env.R2.put(key, await file.arrayBuffer(), { httpMetadata: { contentType } });
}

productsAdminRoute.post("/:id/images", async (c) => {
  const p = await load(c, Number(c.req.param("id")));
  if (!p) return c.notFound();
  if (!c.env.R2) return c.text("File storage is not configured", 503);

  const body = await c.req.parseBody({ all: true });
  const added: string[] = [];
  const rejected: string[] = [];
  for (const file of files(body.images)) {
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const type = sniff(head);
    if (!type || !IMAGE_TYPES[type] || file.size > UPLOAD_LIMITS.image) {
      rejected.push(file.name);
      continue;
    }
    const key = `products/${p.id}/images/${randomBase64Url(12)}.${IMAGE_TYPES[type]}`;
    await store(c, key, file, type);
    added.push(key);
  }
  if (added.length) {
    await c.var.db
      .update(product)
      .set({ images: [...p.images, ...added], updatedAt: new Date().toISOString() })
      .where(eq(product.id, p.id));
  }
  flashToast(
    c,
    added.length
      ? `${added.length} image${added.length === 1 ? "" : "s"} added`
      : "No images added",
    rejected.length
      ? {
          type: "warning",
          description: `Skipped ${rejected.join(", ")}: JPEG, PNG, WebP or AVIF up to 8 MB.`,
        }
      : undefined,
  );
  return c.redirect(`/admin/products/${p.id}`);
});

productsAdminRoute.post("/:id/images/remove", async (c) => {
  const p = await load(c, Number(c.req.param("id")));
  if (!p) return c.notFound();
  const body = await c.req.parseBody();
  const key = String(body.key ?? "");
  if (!p.images.includes(key)) return c.redirect(`/admin/products/${p.id}`);

  if (body.action === "first") {
    await c.var.db
      .update(product)
      .set({
        images: [key, ...p.images.filter((k) => k !== key)],
        updatedAt: new Date().toISOString(),
      })
      .where(eq(product.id, p.id));
    flashToast(c, "Gallery photo changed");
  } else {
    // A photo slot pointing at it falls back to the design's drawing.
    const photos = Object.fromEntries(
      Object.entries(p.design.photos ?? {}).filter(([, v]) => v !== key),
    );
    await c.var.db
      .update(product)
      .set({
        images: p.images.filter((k) => k !== key),
        design: { ...p.design, photos },
        updatedAt: new Date().toISOString(),
      })
      .where(eq(product.id, p.id));
    // Past orders do not reference images, so the file can go.
    await c.env.R2?.delete(key);
    flashToast(c, "Image removed");
  }
  return c.redirect(`/admin/products/${p.id}`);
});

productsAdminRoute.post("/:id/model", async (c) => {
  const p = await load(c, Number(c.req.param("id")));
  if (!p) return c.notFound();
  if (!c.env.R2) return c.text("File storage is not configured", 503);
  const [file] = files((await c.req.parseBody()).file);
  const head = file ? new Uint8Array(await file.slice(0, 16).arrayBuffer()) : new Uint8Array();
  if (!file || sniff(head) !== "model/gltf-binary" || file.size > UPLOAD_LIMITS.model) {
    flashToast(c, "That is not a GLB file", {
      type: "error",
      description: "Export from Blender as glTF Binary (.glb), up to 20 MB.",
    });
    return c.redirect(`/admin/products/${p.id}`);
  }
  // A new key per version: old orders keep pointing at the model they were sold with.
  const version = p.modelVersion + (p.modelKey ? 1 : 0);
  const key = `products/${p.id}/model-v${version}-${randomBase64Url(6)}.glb`;
  await store(c, key, file, "model/gltf-binary");
  await c.var.db
    .update(product)
    .set({ modelKey: key, modelVersion: version, updatedAt: new Date().toISOString() })
    .where(eq(product.id, p.id));
  flashToast(c, `3D model v${version} uploaded`, {
    description: "Objects named after components are resized; check the preview page.",
  });
  return c.redirect(`/admin/products/${p.id}`);
});

productsAdminRoute.post("/:id/model/remove", async (c) => {
  const p = await load(c, Number(c.req.param("id")));
  if (!p) return c.notFound();
  // The file stays in R2: orders placed with it still reference it.
  await c.var.db
    .update(product)
    .set({ modelKey: null, updatedAt: new Date().toISOString() })
    .where(eq(product.id, p.id));
  flashToast(c, "3D model removed", {
    description: "The page now builds the piece from its components.",
  });
  return c.redirect(`/admin/products/${p.id}`);
});

productsAdminRoute.post("/:id/blend", async (c) => {
  const p = await load(c, Number(c.req.param("id")));
  if (!p) return c.notFound();
  if (!c.env.R2) return c.text("File storage is not configured", 503);
  const [file] = files((await c.req.parseBody()).file);
  const head = file ? new Uint8Array(await file.slice(0, 16).arrayBuffer()) : new Uint8Array();
  // Blender saves compressed files as zstd (3.0+) or gzip (older), which hide
  // the BLENDER header, so those are accepted by extension.
  const compressed =
    (head[0] === 0x28 && head[1] === 0xb5 && head[2] === 0x2f && head[3] === 0xfd) ||
    (head[0] === 0x1f && head[1] === 0x8b);
  const isBlend =
    file &&
    (sniff(head) === "application/x-blender" ||
      (compressed && file.name.toLowerCase().endsWith(".blend")));
  if (!file || !isBlend || file.size > UPLOAD_LIMITS.blend) {
    flashToast(c, "That is not a .blend file", {
      type: "error",
      description: "A Blender .blend file up to 95 MB.",
    });
    return c.redirect(`/admin/products/${p.id}`);
  }
  const key = `private/products/${p.id}/${slugify(p.name) || "model"}-${randomBase64Url(6)}.blend`;
  await store(c, key, file, "application/x-blender");
  await c.var.db
    .update(product)
    .set({ blendKey: key, updatedAt: new Date().toISOString() })
    .where(eq(product.id, p.id));
  flashToast(c, "Blender file stored");
  return c.redirect(`/admin/products/${p.id}`);
});
