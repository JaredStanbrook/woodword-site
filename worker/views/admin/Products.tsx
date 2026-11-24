// worker/views/admin/Products.tsx
//
// Admin product list and the product editor.

import type { SelectProduct } from "@server/schema/product.schema";
import { specOf } from "@server/schema/product.schema";
import {
  AVAILABILITY,
  BLUEPRINTS,
  CATEGORIES,
  PRODUCT_STATUSES,
} from "@server/schema/furniture.config";
import { DESIGNS, type DesignDef } from "@server/designs";
import type { ProductFormValues } from "@server/services/product-form";
import {
  cutList,
  quote,
  resizeParts,
  standardSelection,
  startingPrice,
} from "@server/lib/furniture";
import { formatPrice } from "@server/lib/money";
import { formatDateShort } from "@views/lib/utils";
import { designClass } from "@server/designs/blocks";
import {
  AVAILABILITY_STYLES,
  CATEGORY_LABELS,
  IsoDrawing,
  buttonPrimary,
  buttonSecondary,
  inputClass,
  mediaUrl,
} from "@views/shop/parts";
import { AdminShell } from "./Shell";

const STATUS_STYLES: Record<string, string> = {
  draft: "border-border bg-muted text-muted-foreground",
  published: "border-success/30 bg-success/10 text-success",
  archived: "border-warning/40 bg-warning/15 text-foreground",
};

export const StatusPill = ({ status }: { status: string }) => (
  <span
    class={`inline-flex items-center rounded-full border-2 px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status] ?? STATUS_STYLES.draft}`}
  >
    {status}
  </span>
);

// ==========================================
// LIST
// ==========================================

export const ProductListPage = ({
  products,
  locale,
  currency,
  aiEnabled,
}: {
  products: SelectProduct[];
  locale: string;
  currency: string;
  aiEnabled: boolean;
}) => (
  <AdminShell
    title="Products"
    actions={
      <>
        <a href="/admin/products/generate" class={buttonSecondary}>
          <i data-lucide="sparkles" class="h-4 w-4"></i>{" "}
          {aiEnabled ? "Create from a prompt" : "Prompt (set up AI)"}
        </a>
        <a href="/admin/products/new" class={buttonPrimary}>
          <i data-lucide="plus" class="h-4 w-4"></i> New product
        </a>
      </>
    }
  >
    {products.length === 0 ? (
      <div class="rounded-sm border-2 border-dashed px-6 py-16 text-center">
        <p class="font-display text-xl">No products yet</p>
        <p class="mt-2 text-sm text-muted-foreground">
          Describe a piece and let the generator draft it, or start from a blank form.
        </p>
      </div>
    ) : (
      <div class="overflow-x-auto rounded-sm border-2 bg-card text-card-foreground">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b-2 text-left text-sm italic text-muted-foreground">
              <th class="p-3 font-medium" scope="col">
                Piece
              </th>
              <th class="p-3 font-medium" scope="col">
                Status
              </th>
              <th class="hidden p-3 font-medium md:table-cell" scope="col">
                Category
              </th>
              <th class="hidden p-3 font-medium sm:table-cell" scope="col">
                From
              </th>
              <th class="hidden p-3 font-medium lg:table-cell" scope="col">
                3D model
              </th>
              <th class="hidden p-3 font-medium lg:table-cell" scope="col">
                Updated
              </th>
              <th class="p-3" scope="col">
                <span class="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr class="border-b-2 last:border-0">
                <td class="p-3">
                  <a
                    href={`/admin/products/${p.id}`}
                    class="flex items-center gap-3 hover:underline underline-offset-4"
                  >
                    <span
                      class={`${designClass(p)} block h-12 w-12 shrink-0 overflow-hidden rounded bg-product-wash p-1`}
                    >
                      {p.images[0] ? (
                        <img
                          src={mediaUrl(p.images[0])}
                          alt=""
                          class="h-full w-full rounded-sm object-cover"
                        />
                      ) : (
                        <IsoDrawing parts={resizeParts(specOf(p), standardSelection(specOf(p)))} />
                      )}
                    </span>
                    <span>
                      <span class="block font-medium">{p.name}</span>
                      <span class="block text-xs text-muted-foreground">/{p.slug}</span>
                    </span>
                  </a>
                </td>
                <td class="p-3">
                  <StatusPill status={p.status} />
                </td>
                <td class="hidden p-3 md:table-cell">{CATEGORY_LABELS[p.category]}</td>
                <td class="hidden p-3 tabular-nums sm:table-cell">
                  {formatPrice(startingPrice(specOf(p)), locale, currency)}
                </td>
                <td class="hidden p-3 lg:table-cell">
                  {p.modelKey ? (
                    <span class="text-success">GLB v{p.modelVersion}</span>
                  ) : (
                    <span class="text-muted-foreground">Built from components</span>
                  )}
                </td>
                <td class="hidden p-3 text-muted-foreground lg:table-cell">
                  {formatDateShort(p.updatedAt, locale)}
                </td>
                <td class="p-3 text-right">
                  <a
                    href={`/furniture/${p.slug}`}
                    class="inline-flex h-11 items-center gap-1.5 rounded-sm px-3 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <i data-lucide="eye" class="h-4 w-4"></i>
                    <span class="hidden sm:inline">
                      {p.status === "published" ? "View" : "Preview"}
                    </span>
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </AdminShell>
);

// ==========================================
// EDITOR
// ==========================================

const Err = ({ errors, name }: { errors: Record<string, string>; name: string }) =>
  errors[name] ? (
    <p class="text-sm text-destructive" id={`${name}-error`}>
      {errors[name]}
    </p>
  ) : null;

const Text = ({
  name,
  label,
  values,
  errors,
  hint,
  type = "text",
  class: cls = "",
}: {
  name: string;
  label: string;
  values: ProductFormValues;
  errors: Record<string, string>;
  hint?: string;
  type?: string;
  class?: string;
}) => (
  <div class={`space-y-1.5 ${cls}`}>
    <label for={`p-${name}`} class="text-sm font-medium">
      {label}
    </label>
    <input
      id={`p-${name}`}
      name={name}
      type={type}
      value={values[name] ?? ""}
      step={type === "number" ? "any" : undefined}
      class={inputClass}
      aria-invalid={errors[name] ? "true" : undefined}
    />
    {hint ? <p class="text-xs text-muted-foreground">{hint}</p> : null}
    <Err errors={errors} name={name} />
  </div>
);

const Area = ({
  name,
  label,
  values,
  errors,
  hint,
  rows = 4,
  mono = false,
}: {
  name: string;
  label: string;
  values: ProductFormValues;
  errors: Record<string, string>;
  hint?: string;
  rows?: number;
  mono?: boolean;
}) => (
  <div class="space-y-1.5">
    <label for={`p-${name}`} class="text-sm font-medium">
      {label}
    </label>
    {hint ? <p class="text-xs text-muted-foreground">{hint}</p> : null}
    <textarea
      id={`p-${name}`}
      name={name}
      rows={rows}
      spellcheck={mono ? false : undefined}
      class={`${inputClass} h-auto ${mono ? "font-mono text-xs leading-relaxed" : ""}`}
      aria-invalid={errors[name] ? "true" : undefined}
    >
      {values[name] ?? ""}
    </textarea>
    <Err errors={errors} name={name} />
  </div>
);

const Select = ({
  name,
  label,
  values,
  options,
  labels,
}: {
  name: string;
  label: string;
  values: ProductFormValues;
  options: readonly string[];
  labels?: Record<string, string>;
}) => (
  <div class="space-y-1.5">
    <label for={`p-${name}`} class="text-sm font-medium">
      {label}
    </label>
    <select id={`p-${name}`} name={name} class={inputClass}>
      {options.map((o) => (
        <option value={o} selected={values[name] === o}>
          {labels?.[o] ?? o.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  </div>
);

const Section = ({
  title,
  children,
  hint,
}: {
  title: string;
  hint?: string;
  children?: unknown;
}) => (
  <section class="space-y-5 rounded-sm border-2 bg-card p-5 text-card-foreground sm:p-6">
    <div>
      <h2 class="font-display text-xl">{title}</h2>
      {hint ? <p class="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
    </div>
    {children}
  </section>
);

const BLUEPRINT_LABELS: Record<string, string> = {
  line: "Drawing",
  measured: "Drawing with measurements",
  foil: "Gilt drawing on night",
};

/**
 * The chosen design and everything it lets the owner fill in: the shared
 * copy (labelled the way this design uses it), its own text fields, and a
 * choice for each photo slot. Swapped in place when the design changes, so
 * the labels and slots always match the design picked.
 */
export const DesignFields = ({
  values,
  errors,
  product,
}: {
  values: ProductFormValues;
  errors: Record<string, string>;
  product?: SelectProduct;
}) => {
  const current = values.design || "draft";
  const def: DesignDef = DESIGNS[current] ?? DESIGNS.draft;
  const label = (k: keyof NonNullable<DesignDef["labels"]>, fallback: string) =>
    def.labels?.[k]?.label ?? fallback;
  const hint = (k: keyof NonNullable<DesignDef["labels"]>, fallback?: string) =>
    def.labels?.[k]?.hint ?? fallback;
  const images = product?.images ?? [];
  // Text and photo choices that belong to other designs ride along unseen,
  // so switching design and back, or saving, loses none of them.
  const shown = new Set([
    ...def.extra.map((f) => `extra.${f.key}`),
    ...def.photos.map((slot) => `photo.${slot.key}`),
  ]);
  const carried = Object.entries(values).filter(
    ([k, v]) => (k.startsWith("extra.") || k.startsWith("photo.")) && !shown.has(k) && v,
  );
  return (
    <div id="design-fields" class="space-y-5">
      {carried.map(([k, v]) => (
        <input type="hidden" name={k} value={v} />
      ))}
      <Err errors={errors} name="design" />
      <div class="space-y-1.5">
        <label for="p-design" class="text-sm font-medium">
          Design
        </label>
        <select
          id="p-design"
          name="design"
          class={inputClass}
          hx-post={`/admin/products/design-fields${product ? `?id=${product.id}` : ""}`}
          hx-trigger="change"
          hx-target="#design-fields"
          hx-swap="outerHTML"
        >
          {Object.values(DESIGNS).map((d) => (
            <option value={d.id} selected={d.id === def.id}>
              {d.name}
            </option>
          ))}
        </select>
        <p class="text-xs text-muted-foreground">{def.note}</p>
      </div>

      <Text
        name="headline"
        label={label("headline", "Headline")}
        hint={hint("headline")}
        values={values}
        errors={errors}
      />
      <Area
        name="intro"
        label={label("intro", "Introduction")}
        hint={hint("intro")}
        values={values}
        errors={errors}
        rows={3}
      />
      <Area
        name="story"
        label={label("story", "Story sections")}
        values={values}
        errors={errors}
        rows={8}
        hint={hint("story", "Start each section with a line beginning '# ' for its heading.")}
      />
      <Area
        name="highlights"
        label={label("highlights", "Highlights")}
        values={values}
        errors={errors}
        rows={4}
        hint={hint("highlights", "One per line, as Label: Value — e.g. Seats: Six")}
      />
      <Area
        name="care"
        label={label("care", "Care")}
        hint={hint("care")}
        values={values}
        errors={errors}
        rows={3}
      />
      {def.extra.map((f) =>
        (f.rows ?? 1) > 1 ? (
          <Area
            name={`extra.${f.key}`}
            label={f.label}
            hint={f.hint}
            values={values}
            errors={errors}
            rows={f.rows}
          />
        ) : (
          <Text
            name={`extra.${f.key}`}
            label={f.label}
            hint={f.hint}
            values={values}
            errors={errors}
          />
        ),
      )}

      {def.photos.length ? (
        <fieldset class="space-y-4 border-t-2 pt-5">
          <legend class="sr-only">Photos</legend>
          <p class="text-sm font-medium">Photos</p>
          <p class="text-xs text-muted-foreground">
            {images.length
              ? "Numbers match the uploads under Images and 3D model. A slot left on a drawing shows the piece's workshop drawing at the size the customer picks."
              : product
                ? "Upload photos under Images and 3D model, then choose them here. Until then each slot shows a workshop drawing."
                : "Save the piece first, then upload photos and choose them here. Until then each slot shows a workshop drawing."}
          </p>
          <div class="grid gap-4 sm:grid-cols-2">
            {def.photos.map((slot) => {
              const chosen = values[`photo.${slot.key}`] ?? "";
              const id = `p-photo-${slot.key}`;
              return (
                <div class="space-y-1.5">
                  <label for={id} class="text-sm font-medium">
                    {slot.label}
                  </label>
                  <select id={id} name={`photo.${slot.key}`} class={inputClass}>
                    <option value="" selected={!chosen}>
                      {BLUEPRINT_LABELS[slot.fallback]} (design default)
                    </option>
                    {BLUEPRINTS.filter((b) => b !== slot.fallback).map((b) => (
                      <option value={`blueprint:${b}`} selected={chosen === `blueprint:${b}`}>
                        {BLUEPRINT_LABELS[b]}
                      </option>
                    ))}
                    {images.map((key, i) => (
                      <option value={key} selected={chosen === key}>
                        Photo {i + 1}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <p class="border-t-2 pt-5 text-xs text-muted-foreground">
          This design has no photo slots: uploaded photos appear together at the foot of the page.
        </p>
      )}
    </div>
  );
};

interface EditorProps {
  product?: SelectProduct;
  values: ProductFormValues;
  errors: Record<string, string>;
  locale: string;
  currency: string;
  /** Shown above the form, e.g. after generating from a prompt. */
  notice?: string;
  r2Available: boolean;
}

const UploadForms = ({
  product,
  r2Available,
}: {
  product: SelectProduct;
  r2Available: boolean;
}) => (
  <Section
    title="Images and 3D model"
    hint="Uploads save straight away. Choose where each photo goes under Page design. On the collection page the card turns through every photo, starting with the first; with none, it shows the drawing."
  >
    {!r2Available ? (
      <p class="text-sm text-destructive">
        File storage (the R2 binding) is not configured, so uploads are unavailable.
      </p>
    ) : null}
    <div class="grid grid-cols-3 gap-3 sm:grid-cols-4">
      {product.images.map((key, i) => (
        <figure class="space-y-1">
          <div class="relative">
            <img
              src={mediaUrl(key)}
              alt={`Photo ${i + 1}`}
              class="aspect-square w-full rounded-sm object-cover"
            />
            <span class="absolute top-1 left-1 rounded-sm bg-background/90 px-1.5 text-xs font-semibold tabular-nums">
              {i + 1}
            </span>
          </div>
          <form
            method="post"
            action={`/admin/products/${product.id}/images/remove`}
            class="flex gap-1"
          >
            <input type="hidden" name="key" value={key} />
            {i > 0 ? (
              <button
                name="action"
                value="first"
                class="h-11 flex-1 rounded-sm text-xs text-muted-foreground hover:bg-accent"
              >
                Make first
              </button>
            ) : (
              <span class="flex h-11 flex-1 items-center justify-center text-xs text-muted-foreground">
                First on the card
              </span>
            )}
            <button
              name="action"
              value="remove"
              aria-label={`Remove image ${i + 1}`}
              class="inline-flex h-11 w-11 items-center justify-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <i data-lucide="trash-2" class="h-4 w-4"></i>
            </button>
          </form>
        </figure>
      ))}
    </div>
    <form
      method="post"
      action={`/admin/products/${product.id}/images`}
      enctype="multipart/form-data"
      class="flex flex-wrap items-center gap-3"
      hx-boost="false"
    >
      <label class="sr-only" for="images">
        Product images
      </label>
      <input
        id="images"
        type="file"
        name="images"
        multiple
        accept="image/jpeg,image/png,image/webp,image/avif"
        class="text-sm file:mr-3 file:h-11 file:rounded-lg file:border-2 file:border-input file:bg-background file:px-4 file:text-sm"
      />
      <button type="submit" class={buttonSecondary} disabled={!r2Available}>
        <i data-lucide="upload" class="h-4 w-4"></i> Upload images
      </button>
    </form>

    <div class="grid gap-6 border-t-2 pt-5 md:grid-cols-2">
      <form
        method="post"
        action={`/admin/products/${product.id}/model`}
        enctype="multipart/form-data"
        class="space-y-3"
        hx-boost="false"
      >
        <p class="text-sm font-medium">3D model (GLB)</p>
        <p class="text-sm text-muted-foreground">
          {product.modelKey
            ? `Version ${product.modelVersion} is live. Objects named like the components below are resized; others are left as they are.`
            : "None yet — the 3D view builds the piece from the components below. Export from Blender as glTF Binary (.glb); see docs/blender.md."}
        </p>
        <input
          type="file"
          name="file"
          accept=".glb,model/gltf-binary"
          aria-label="GLB model file"
          class="text-sm file:mr-3 file:h-11 file:rounded-lg file:border-2 file:border-input file:bg-background file:px-4 file:text-sm"
        />
        <div class="flex flex-wrap gap-2">
          <button type="submit" class={buttonSecondary} disabled={!r2Available}>
            <i data-lucide="upload" class="h-4 w-4"></i> Upload GLB
          </button>
          {product.modelKey ? (
            <button
              type="submit"
              formaction={`/admin/products/${product.id}/model/remove`}
              class="inline-flex h-11 items-center gap-2 rounded-sm px-3 text-sm text-destructive hover:bg-destructive/10"
            >
              Remove model
            </button>
          ) : null}
        </div>
      </form>
      <form
        method="post"
        action={`/admin/products/${product.id}/blend`}
        enctype="multipart/form-data"
        class="space-y-3"
        hx-boost="false"
      >
        <p class="text-sm font-medium">Blender source (.blend)</p>
        <p class="text-sm text-muted-foreground">
          {product.blendKey ? (
            <>
              Stored privately.{" "}
              <a href={mediaUrl(product.blendKey)} class="underline underline-offset-4">
                Download
              </a>
            </>
          ) : (
            "Kept privately for future changes. Never shown to customers."
          )}
        </p>
        <input
          type="file"
          name="file"
          accept=".blend"
          aria-label="Blender file"
          class="text-sm file:mr-3 file:h-11 file:rounded-lg file:border-2 file:border-input file:bg-background file:px-4 file:text-sm"
        />
        <button type="submit" class={buttonSecondary} disabled={!r2Available}>
          <i data-lucide="upload" class="h-4 w-4"></i> Upload .blend
        </button>
      </form>
    </div>
  </Section>
);

const StandardPreview = ({
  product,
  locale,
  currency,
}: {
  product: SelectProduct;
  locale: string;
  currency: string;
}) => {
  const spec = specOf(product);
  const std = standardSelection(spec);
  const parts = resizeParts(spec, std);
  const q = quote(spec, std);
  const max = {
    width: spec.dimensions.width.max,
    height: spec.dimensions.height.max,
    depth: spec.dimensions.depth.max,
    options: std.options,
  };
  return (
    <Section
      title="Check the model"
      hint="The saved components at the standard size and at the largest size. If the large one looks wrong, a component needs a different resize rule."
    >
      <div class={`${designClass(product)} grid grid-cols-2 gap-3`}>
        <figure class="space-y-1">
          <div class="aspect-square rounded-sm bg-product-wash p-4">
            <IsoDrawing parts={parts} size={std} dims />
          </div>
          <figcaption class="text-xs text-muted-foreground">
            Standard · {formatPrice(q.totalCents, locale, currency)}
          </figcaption>
        </figure>
        <figure class="space-y-1">
          <div class="aspect-square rounded-sm bg-product-wash p-4">
            <IsoDrawing parts={resizeParts(spec, max)} size={max} dims />
          </div>
          <figcaption class="text-xs text-muted-foreground">
            Largest · {formatPrice(quote(spec, max).totalCents, locale, currency)}
          </figcaption>
        </figure>
      </div>
      <details>
        <summary class="flex min-h-11 cursor-pointer items-center text-sm font-medium">
          Cut list at standard size
        </summary>
        <table class="mt-2 w-full text-xs tabular-nums">
          <tbody>
            {cutList(parts).map((r) => (
              <tr class="border-b-2 last:border-0">
                <td class="py-1.5 pr-2">{r.label}</td>
                <td class="py-1.5 pr-2 text-muted-foreground">× {r.quantity}</td>
                <td class="py-1.5 text-right">{r.dims.join(" × ")} mm</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Section>
  );
};

export const ProductEditorPage = ({
  product,
  values,
  errors,
  locale,
  currency,
  notice,
  r2Available,
}: EditorProps) => {
  const isEdit = Boolean(product);
  const action = isEdit ? `/admin/products/${product!.id}` : "/admin/products";
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <AdminShell
      title={isEdit ? product!.name : "New product"}
      back={{ href: "/admin/products", label: "Products" }}
      actions={
        isEdit ? (
          <a href={`/furniture/${product!.slug}`} class={buttonSecondary}>
            <i data-lucide="eye" class="h-4 w-4"></i>{" "}
            {product!.status === "published" ? "View page" : "Preview page"}
          </a>
        ) : null
      }
    >
      {notice ? (
        <p class="rounded-sm border-2 border-success/30 bg-success/10 p-4 text-sm" role="status">
          {notice}
        </p>
      ) : null}
      {hasErrors ? (
        <div
          class="rounded-sm border-2 border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
          role="alert"
        >
          <p class="font-medium">Not saved — fix these first:</p>
          <ul class="mt-1 list-disc pl-5">
            {Object.entries(errors).map(([k, v]) => (
              <li>
                <span class="capitalize">{k.replace(/([A-Z])/g, " $1").toLowerCase()}</span>: {v}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <form method="post" action={action} class="space-y-6" hx-boost="false">
          <Section title="Basics">
            <div class="grid gap-4 sm:grid-cols-2">
              <Text name="name" label="Name" values={values} errors={errors} />
              <Text
                name="slug"
                label="URL"
                values={values}
                errors={errors}
                hint="/furniture/… — leave empty to make one from the name. Changing it breaks old links."
              />
              <Select
                name="category"
                label="Category"
                values={values}
                options={CATEGORIES}
                labels={CATEGORY_LABELS}
              />
              <Select name="status" label="Status" values={values} options={PRODUCT_STATUSES} />
              <Select
                name="availability"
                label="Availability"
                values={values}
                options={AVAILABILITY}
                labels={Object.fromEntries(
                  AVAILABILITY.map((a) => [a, AVAILABILITY_STYLES[a].label]),
                )}
              />
              <Text
                name="sortOrder"
                label="Order in the gallery"
                type="number"
                values={values}
                errors={errors}
                hint="Lower comes first."
              />
            </div>
            <Text
              name="summary"
              label="Summary"
              values={values}
              errors={errors}
              hint="One line for the gallery card and search results."
            />
            <Area
              name="description"
              label="Description"
              values={values}
              errors={errors}
              rows={5}
              hint="Longer copy. Blank lines start new paragraphs."
            />
            <div class="grid gap-4 sm:grid-cols-2">
              <Text
                name="leadDaysStandard"
                label="Workshop days, standard size"
                type="number"
                values={values}
                errors={errors}
              />
              <Text
                name="leadDaysCustom"
                label="Workshop days, custom size"
                type="number"
                values={values}
                errors={errors}
              />
            </div>
          </Section>

          <Section
            title="Dimensions"
            hint="Millimetres. The model's components must fill the standard size exactly; customers can choose anything from minimum to maximum in steps."
          >
            <Err errors={errors} name="dimensions" />
            <div class="overflow-x-auto">
              <table class="w-full min-w-[28rem] text-sm">
                <thead>
                  <tr class="text-left text-sm italic text-muted-foreground">
                    <th class="pb-2 font-medium"></th>
                    <th class="pb-2 font-medium">Standard</th>
                    <th class="pb-2 font-medium">Min</th>
                    <th class="pb-2 font-medium">Max</th>
                    <th class="pb-2 font-medium">Step</th>
                  </tr>
                </thead>
                <tbody>
                  {(["width", "height", "depth"] as const).map((k) => (
                    <tr>
                      <th class="py-1 pr-3 text-left font-medium capitalize">{k}</th>
                      {(["Standard", "Min", "Max", "Step"] as const).map((f) => (
                        <td class="py-1 pr-2">
                          <input
                            name={`${k}${f}`}
                            type="number"
                            min="1"
                            value={values[`${k}${f}`] ?? ""}
                            aria-label={`${k} ${f.toLowerCase()}`}
                            class={`${inputClass} tabular-nums`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section
            title="Pricing"
            hint={`In ${currency}. Price = making + timber (by volume of the resized components, times the timber option's multiplier) + surface area + custom-size charges + option prices. Each line is rounded.`}
          >
            <Err errors={errors} name="pricing" />
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Text name="base" label="Making (fixed)" values={values} errors={errors} />
              <Text
                name="timberPerCubicMetre"
                label="Timber per m³"
                values={values}
                errors={errors}
              />
              <Text
                name="areaPerSquareMetre"
                label="Per m² of footprint"
                values={values}
                errors={errors}
              />
              <Text
                name="labourPerCentimetre"
                label="Per cm larger than standard"
                values={values}
                errors={errors}
              />
              <Text
                name="customSurcharge"
                label="Custom size charge"
                values={values}
                errors={errors}
              />
              <Text
                name="roundTo"
                label="Round each line to"
                values={values}
                errors={errors}
                hint="1 for whole units."
              />
            </div>
          </Section>

          <Section
            title="Components"
            hint='JSON list from the Blender export script (scripts/blender/export_components.py) or the generator. Each: name (the Blender object name), label, shape ("box"/"cylinder"), size [w,h,d] and position [x,y,z] in mm at the standard size, material ("body"/"accent"/"metal"/"glass"), and resize rules per axis: "anchor" (default — ends follow the nearest outside face), "move", "scale" or "fixed".'
          >
            <Area
              name="parts"
              label="Components (JSON)"
              values={values}
              errors={errors}
              rows={16}
              mono
            />
          </Section>

          <Section
            title="Options"
            hint='JSON list of groups: { id, label, paints?: "body"|"accent"|"metal"|"glass", choices: [{ id, label, description?, priceCents, timberMultiplier, leadDays, color: "#rrggbb" }] }. The first choice is the default.'
          >
            <Area
              name="options"
              label="Options (JSON)"
              values={values}
              errors={errors}
              rows={12}
              mono
            />
          </Section>

          <Section
            title="Page design"
            hint="Each piece has a page designed for it. Pick it here; the text and photos below are what that design shows, and can be changed any time."
          >
            <DesignFields values={values} errors={errors} product={product} />
          </Section>

          {values.prompt ? (
            <Section title="Generated from">
              <input type="hidden" name="prompt" value={values.prompt} />
              <p class="whitespace-pre-line text-sm text-muted-foreground">{values.prompt}</p>
            </Section>
          ) : null}

          <div class="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-3 border-t-2 bg-background/95 px-1 py-4 backdrop-blur">
            <button type="submit" class={buttonPrimary}>
              {isEdit ? "Save changes" : "Create product"}
            </button>
            <a href="/admin/products" class={buttonSecondary}>
              Cancel
            </a>
          </div>
        </form>

        {isEdit ? (
          <div class="space-y-6">
            <StandardPreview product={product!} locale={locale} currency={currency} />
            <UploadForms product={product!} r2Available={r2Available} />
            <Section title="Remove">
              <p class="text-sm text-muted-foreground">
                Archiving hides it from the shop and keeps it editable. Deleting removes it from the
                admin too; past orders keep their copy.
              </p>
              <form method="post" action={`/admin/products/${product!.id}/delete`} hx-boost="false">
                <button
                  type="submit"
                  class="inline-flex h-11 items-center gap-2 rounded-sm border-2 border-destructive/40 px-4 text-sm font-medium text-destructive hover:bg-destructive/10"
                  onclick="return confirm('Delete this product? It disappears from the shop and the admin.')"
                >
                  <i data-lucide="trash-2" class="h-4 w-4"></i> Delete product
                </button>
              </form>
            </Section>
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
};
