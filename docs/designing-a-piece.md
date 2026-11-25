# Designing a piece's page

Every piece in the shop gets a product page designed for it alone. The
navigation and the footer are the shop's. **Everything between them is the
piece's own:** its colours, typefaces, shapes, patterns, buttons, sliders and
price. Nothing in the body should look like another page.

**And the page stays small.** A customer comes to see the piece, make it
their size, and buy it. Pictures, the 3D model and the price do that work;
words only name things. A page has the five parts listed under "What a page
is" below, and nothing else: no story sections, no fact tiles, no sizes
table, no care notes, no workshop band, no long description.

The pipeline:

1. **You** send photos of the piece, a description and a style.
2. **Claude** builds a named design in `worker/designs/<id>/` from this brief.
3. **You** pick that design in the admin under **Page design**, write its two
   lines, and upload the photos.

The design fixes the look. The two lines and the photos stay yours to change
in the admin at any time.

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

Photos (the first one leads; all of them go in the gallery):
1. at home / in use
2. a detail: grain, a joint, an edge
3. in the workshop
```

---

## 2. Instructions for Claude

### What a page is

Five parts, in this order of importance. Each comes from a shared block, so
buying, sizing and the 3D view work the same on every page.

| Part                                                   | Block                                | Words                                              |
| ------------------------------------------------------ | ------------------------------------ | -------------------------------------------------- |
| The piece's name, as the page's one `<h1>`             | `product.name`                       | the name                                           |
| A short line, and up to two sentences                  | `design.headline`, `design.intro`    | headline 6 words or fewer; intro 25 words or fewer |
| Every photo, in one gallery, then the workshop drawing | `<Gallery>`                          | none                                               |
| The 3D model                                           | `<Viewer>`                           | none                                               |
| Size, options, price, lead time, add to cart           | `<Configurator {...props} />`, whole | its own labels                                     |

Plus `<AvailabilityBadge>` beside the name; it renders nothing for made to
order. The configurator already shows each size's range, so there is no
sizes table.

Words the design hard-codes itself (a section title, a "from" beside the
price) are 3 words or fewer, and there are no more than three of them on the
page. Splay has two: "Make it fit" and "from".

`npm test` enforces this (`tests/designs.test.tsx`): one `<h1>` with the
name, both lines, one gallery with every photo and the drawing, the viewer
and the configurator. The admin offers only the two lines; there is nowhere
to type more.

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
  the slider thumbs and the gallery thumbnails. Spend the boldness on those
  five parts, not on adding more.
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

**The manifest** (`DesignDef`, see `worker/designs/types.ts`): `id` (matches
the folder and the `.design-<id>` class), `name` (the admin dropdown) and
`note` (one line beside it: the style, and which piece it is for).

### Make every element its own

The view wraps everything in one root element (`<div class="<id>">`) and
arranges the five parts however the style wants. Restyling works in three
steps:

1. **Redefine the shop's tokens on that root.** `--background`,
   `--foreground`, `--card`, `--muted-foreground`, `--border`, `--input`,
   `--ring`, `--primary`, `--gilt` (drawing lines) and `--night-foreground`
   (drawing figures). Every shared block then follows.
2. **Restyle the shared blocks through their `data-part` hooks.** The
   design's CSS sits in the `designs` layer, after Tailwind's utilities, so
   its rules beat the classes the blocks carry. Select by hook, never by a
   Tailwind class name:

   | Block        | Hooks                                                                                                                                                                                                                                                                |
   | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | Gallery      | `gallery`, `gallery-main` (give it an aspect ratio, or pass `mainClass`), `gallery-thumbs`, `gallery-thumb` (the picked one is `:has(:checked)`); each picture has `data-fill="photo"` or `"drawing"`                                                                |
   | Configurator | `size`, `reset`, `dimension` (with `data-dimension="width"` etc.), `dimension-label`, `dimension-range`, `unit`, plus `[data-step-down]`, `[data-step-up]`, `[data-number]` and `input.slider`                                                                       |
   | Options      | `option-group`, `option-legend`, `choices`, `choice` (style the chosen one with `:has(:checked)`), `swatch`, `choice-name`, `choice-note`, `choice-price`                                                                                                            |
   | Price panel  | `price-panel`, `live-drawing`, `price`, `price-note`, `breakdown`, `breakdown-lines`, `lead`, `lead-note`, `buy`, `qty`, `add`, `save`, `unavailable`                                                                                                                |
   | Viewer       | `viewer`, plus `[data-viewer-hint]`, `[data-viewer-reset]` and `[data-viewer-loading]` (the "Loading 3D view" pill)                                                                                                                                                  |
   | Badge        | `availability` (with `data-availability`)                                                                                                                                                                                                                            |
   | Card         | on the collection page: `card` (the element carrying `.design-<id>`, with `data-wide="true"` when it spans two columns), `card-frame`, `card-picture`, `card-panel` (wide cards only), `card-name`, `card-summary`, `card-price`, `card-caption` (under the picture) |

   Workshop drawings are SVG: restyle `.iso-drawing .iso-top`, `.iso-left`
   and `.iso-right` (fill) and `polygon` (stroke) under the root. Don't mix
   two hues in `color-mix`: oak and blue pass through purple.

3. **Hide only filler.** A design may hide `lead-note` or `save`. It may
   never hide the price, the size controls, the options, the lead time, add
   to cart, or a gallery thumbnail.

### Rules

- **Five parts, few words.** Nothing on the page beyond the table above.
  If the style seems to need more, make the five parts bolder instead.
- **Body only.** Never touch the nav, the footer, `Layout.tsx`, or
  `worker/index.css` beyond the one `@import` line.
- **Every rule starts with `.design-<id>`.** The only at-rules allowed are
  `@font-face`, `@media`, `@supports`, and `@keyframes` named `<id>-…`. The
  test checks this.
- **Page styles go under the root** (`.design-<id> .<id>`). `.design-<id>`
  on its own also wraps the piece's collection card and cart line: put the
  palette's custom properties and the four `--product*` tokens there, so
  both can use them.
- **The collection card matches the page.** Restyle it through its hooks
  (`.design-<id>[data-part="card"]` and the parts inside it), so a customer
  recognises the piece before clicking. Splay's card wears the page's
  coloured mounts, cane weave, name, cream card and pink price.
- **All words come from the admin.** Hard-code decoration, and the three
  short labels at most.
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
   with its dimensions, components, placeholder prices, headline and intro,
   then `npm run seed:local`.
3. Upload the photos in the local admin and choose the design.
4. Screenshot the page at 390 px and 1440 px wide, with photos and with
   none (the gallery shows only the drawing). Check:
   - no horizontal scroll, and nothing clipped at the edges;
   - nothing from the shop's own look is left in the body;
   - every thumbnail switches the large picture, by click and by keyboard;
   - dragging the 3D view on a phone turns the model without scrolling the
     page;
   - the price and add to cart work.
5. Screenshot the collection page at 390 px and 1440 px: the card looks
   like the page, and with two or more photos it turns through them.

### Hand-off

Tell the owner:

- the design's name and style;
- which photo should be first (it leads the gallery and the collection
  card);
- anything to finish in the admin: real prices, and a GLB if the shape needs
  one.

---

## 3. Setting it up in the admin

1. **Products → the piece** (or **New product**; save once so photos can be
   uploaded).
2. **Images and 3D model**: upload the photos. They appear in the gallery in
   this order; **Make first** chooses the one that leads.
3. **Page design**: choose the design, and write the headline (6 words or
   fewer) and the introduction (2 sentences at most).
4. **Save**, then **Preview page**. Set Status to **published** when it is
   right. A piece still on the Draft design cannot be published.
