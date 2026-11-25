# Designing a piece's page

Every piece in the shop gets a product page designed for it alone. The
navigation and the footer are the shop's. **Everything between them is the
piece's own:** its colours, typefaces, shapes, patterns, buttons, sliders,
price, tables and photos. Nothing in the body should look like another page.

The pipeline:

1. **You** send photos of the piece, a description and a style.
2. **Claude** builds a named design in `worker/designs/<id>/` from this brief.
3. **You** pick that design in the admin under **Page design**, edit its
   text, upload the photos and choose which photo goes in each slot.

The design fixes the look. The words and the photos stay yours to change in
the admin at any time.

---

## 1. What to send

Copy this, fill it in, and attach the photos. Anything left blank, Claude
fills from the photos and says so.

```text
Design a page for this piece. Follow docs/designing-a-piece.md.

Piece name:
Style (e.g. maximalism, brutalism, Art Deco, Japanese minimal, 70s, "you choose"):
Design name (optional, otherwise suggest one):
Timber and finish:
One line on what makes it special:
Standard size (W × H × D mm):
Range it can be built in (min–max for each):
Price at the standard size:
Lead time (standard / custom size):
Anything the page must or must not say:

Photos:
1. at home / in use
2. a detail: grain, a joint, an edge
3. in the workshop (one or two)
(more is fine; say if one should lead)
```

---

## 2. Instructions for Claude

### Keep it short

Every page stays short. Pictures, the 3D model and the price carry it; words
only label and explain. These limits apply to the copy you draft for the
catalogue entry, and they are what the admin field hints should ask for:

| Field                 | Limit                                                      |
| --------------------- | ---------------------------------------------------------- |
| Headline              | 6 words or fewer                                           |
| Introduction          | 2 sentences, 25 words or fewer                             |
| Story                 | 3 sections at most, a 2–3 word heading and 1 sentence each |
| Highlights            | 3 or 4, values of 3 words or fewer                         |
| Care                  | 1 sentence                                                 |
| Description           | Leave empty unless the owner asks for it                   |
| A design's extra text | 1 line each                                                |

Words the design itself hard-codes (section titles, a "from") are 3 words or
fewer, and there should be no more than four of them on the page.

### The essentials: what every page must have

| What                                                     | Where it comes from                                           |
| -------------------------------------------------------- | ------------------------------------------------------------- |
| The piece's name, as the page's one `<h1>`               | `product.name`                                                |
| A short headline                                         | `design.headline` (shown when set)                            |
| The photos                                               | `<Photo slot={…}>`, once for each slot in the manifest        |
| The 3D model                                             | `<Viewer>`                                                    |
| Size, options, the live price, lead time, add to cart    | `<Configurator {...props} />`, whole                          |
| Whether it is in stock or a limited run                  | `<AvailabilityBadge>` (renders nothing for made to order)     |
| The sizes it can be built in                             | `<DimensionTable>`                                            |
| How to look after it                                     | `<CareNote>` (renders nothing when care is empty)             |
| Introduction, story, highlights, description, extra text | When set: the owner may type them, so the page must show them |

`npm test` enforces this table (`tests/designs.test.tsx`). A design that
drops a block, a field or a slot fails the build.

### Read the piece before designing anything

- **Look at every photo.** Note the timber's colour in light and in shade,
  the setting, the objects around it, and the one line or shape that makes
  the piece itself (for the oak console, the splay of its legs).
- **Take the palette from the photos.** For Splay that meant the kayak's
  cobalt, a buoy's marigold, the teapot's poppies, the matryoshka's pink, a
  green tub, the cane lamp shade and the oak. Check contrast: body text 4.5:1
  or better, large text 3:1.
- **Choose typefaces for this piece** that are not the shop's own (Grenze
  Gotisch, EB Garamond, IBM Plex Sans). Self-host them: download the
  `@fontsource/<name>` package with `npm pack` (OFL fonts only), copy the
  latin `.woff2` into `public/fonts/`, and declare `@font-face` in the
  design's CSS. Keep each file under about 60 KB, and use a weight-only
  variable file rather than one with every axis. A page loads only the fonts
  its CSS uses.
- **Commit to the style** the owner asked for, all the way through, down to
  the slider thumbs and the table rows.
- **Name the design.** A short lowercase id (`splay`), plus a display name
  for the admin dropdown.

### Build it

```
worker/designs/<id>/
  index.tsx    the manifest and the view
  design.css   the stylesheet; every rule starts with .design-<id>
```

Register it in two places:

- `worker/designs/index.ts`: add it to `DESIGNS`.
- `worker/index.css`: `@import "./designs/<id>/design.css" layer(designs);`

`worker/designs/splay/` is the worked example.

**The manifest** (`DesignDef`, see `worker/designs/types.ts`):

| Field    | What it is                                                                                                                                                              |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`     | Matches the folder name and the `.design-<id>` class.                                                                                                                   |
| `name`   | Shown in the admin's Design dropdown.                                                                                                                                   |
| `note`   | One line under the dropdown: the style, and which piece it is for.                                                                                                      |
| `photos` | The photo slots, `photo1`, `photo2`… in page order. Each `label` says where it appears; each `fallback` is the drawing shown while empty: `line`, `measured` or `foil`. |
| `extra`  | Text the design adds of its own (a band heading, a caption). Keep it to one or two fields.                                                                              |
| `labels` | Admin labels and hints for the shared copy. Put the word limits from the table above in the hints, so the owner keeps the page short too.                               |

### Make every element its own

The view wraps everything in one root element (`<div class="<id>">`) and
arranges the blocks however the style wants. Restyling works in three steps:

1. **Redefine the shop's tokens on that root.** `--background`,
   `--foreground`, `--card`, `--muted-foreground`, `--border`, `--input`,
   `--ring`, `--primary`, `--gilt` (drawing lines) and `--night-foreground`
   (drawing figures). Every shared block then follows.
2. **Restyle the shared blocks through their `data-part` hooks.** The
   design's CSS sits in the `designs` layer, after Tailwind's utilities, so
   its rules beat the classes the blocks carry. Select by hook, never by a
   Tailwind class name:

   | Block           | Hooks                                                                                                                                                                                          |
   | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | Configurator    | `size`, `reset`, `dimension` (with `data-dimension="width"` etc.), `dimension-label`, `dimension-range`, `unit`, plus `[data-step-down]`, `[data-step-up]`, `[data-number]` and `input.slider` |
   | Options         | `option-group`, `option-legend`, `choices`, `choice` (style the chosen one with `:has(:checked)`), `swatch`, `choice-name`, `choice-note`, `choice-price`                                      |
   | Price panel     | `price-panel`, `live-drawing`, `price`, `price-note`, `breakdown`, `breakdown-lines`, `lead`, `lead-note`, `buy`, `qty`, `add`, `save`, `unavailable`                                          |
   | Viewer          | `viewer`, plus `[data-viewer-hint]` and `[data-viewer-reset]`                                                                                                                                  |
   | Everything else | `sizes`, `care`, `availability` (with `data-availability`); photo slots are `[data-slot]` with `data-fill="photo"` or `"blueprint-…"`                                                          |

   Workshop drawings are SVG: restyle `.iso-drawing .iso-top`, `.iso-left`
   and `.iso-right` (fill) and `polygon` (stroke) under the root. Don't mix
   two hues in `color-mix`: oak and blue pass through purple.

3. **Hide only filler.** A design may hide `lead-note` or `save`. It may
   never hide the price, the size controls, the options, the lead time, add
   to cart, the sizes table or the care note.

### Rules

- **Body only.** Never touch the nav, the footer, `Layout.tsx`, or
  `worker/index.css` beyond the one `@import` line.
- **Every rule starts with `.design-<id>`.** The only at-rules allowed are
  `@font-face`, `@media`, `@supports`, and `@keyframes` named `<id>-…`. The
  test checks this.
- **Page styles go under the root** (`.design-<id> .<id>`). `.design-<id>`
  on its own also wraps the piece's collection card and cart line, so it
  sets only the four `--product*` tokens that colour those.
- **All words come from the admin.** Hard-code decoration only.
- **Photos fill their box** (`object-cover`). Give every slot a fixed aspect
  ratio, so an empty one (a drawing) holds the same space.
- **Keep it usable.** Visible keyboard focus, buttons and inputs at least
  44 px, no horizontal scroll at 390 px, and nothing decorative over a
  control. Decoration gets `aria-hidden` and `pointer-events: none`.
- **Motion:** little or none. Anything that moves stops under
  `prefers-reduced-motion`.
- **The 3D model** comes from the product's components (or its GLB). Boxes
  cannot lean or curve, so if the piece has splayed legs, curves or tapers,
  say in the hand-off that a Blender GLB is needed for the 3D view to match
  (`docs/blender.md`).

### Check it

1. `npm run build` and `npm test` pass.
2. Run locally and add the piece: in `worker/config/catalogue.ts` as a draft
   with its dimensions, components, placeholder prices and short copy, then
   `npm run seed:local`.
3. Upload the photos in the local admin, choose the design, assign the
   slots.
4. Screenshot the page at 390 px and 1440 px wide, with every slot filled
   and with every slot empty (drawings). Check:
   - no horizontal scroll, and nothing clipped at the edges;
   - nothing from the shop's own look is left in the body;
   - dragging the 3D view on a phone turns the model without scrolling the
     page;
   - the price and add to cart work.
5. Screenshot the other product pages before and after. Shared-block hooks
   must not change them.
6. Check the collection card: its colours come from `.design-<id>`, and with
   two or more photos it turns through them.

### Hand-off

Tell the owner:

- the design's name and style;
- which photo goes in which slot;
- which text fields it adds;
- anything to finish in the admin: real prices, and a GLB if the shape needs
  one.

---

## 3. Setting it up in the admin

1. **Products → the piece** (or **New product**; save once so photos can be
   uploaded).
2. **Images and 3D model**: upload the photos. They are numbered; the first
   leads on the collection card.
3. **Page design**:
   - choose the design;
   - edit the text, keeping to the lengths in each field's hint;
   - fill in the design's own fields;
   - for each photo slot, pick a photo by number, or leave it on a drawing.
4. **Save**, then **Preview page**. Set Status to **published** when it is
   right. A piece still on the Draft design cannot be published.

Switching to another design and back keeps everything typed. Removing a
photo puts any slot that used it back to its drawing.
