# Designing a piece's page

Every piece in the shop gets a product page designed for it alone: its own
layout, its own stylesheet, its own name. The navigation and the footer stay
the shop's. Only the body between them is the design.

The pipeline:

1. **You** send photos of the piece and a description (template below).
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
Design name (optional, otherwise suggest one):
Timber and finish:
What it is for, and where it lives:
How it is made (joints, details worth pointing at):
Standard size (W × H × D mm):
Range it can be built in (min–max for each):
Price at the standard size:
Lead time (standard / custom size):
Style direction (a mood, a reference, a colour, or "you choose"):
Anything the page must or must not say:

Photos:
1. at home / in use
2. in the workshop
3. a detail: grain, a joint, an edge
(more is fine; say if one should lead)
```

Good photos for a design: one of the piece in a room, one or two from the
workshop, and one close detail. Portrait or landscape both work. Phone photos
are fine.

---

## 2. Instructions for Claude

### Read the piece before designing anything

- **Look at every photo.** Note the timber's colour in light and in shade,
  the setting (walls, floor, light), and the one line or shape that makes
  this piece itself. For the oak console that line is the splay of its legs.
  That line becomes the page's motif.
- **Sample a palette from the photos**, not from a preset. That means the
  `--product` accent, the `--product-wash` dark panel the drawings sit on,
  `--product-ink`, and one or two colours of the page's own. Check contrast:
  body text 4.5:1 or better, large text 3:1.
- **Choose a voice for the headings** (`--font-heading`): `--font-serif`
  (EB Garamond), `--font-modern` (IBM Plex Sans) or `--font-display`
  (Grenze Gotisch). The product name is always the shop's blackletter `h1`.
- **Name the design.** A short lowercase id (`splay`), plus a display name
  for the admin dropdown.

### Build it

```
worker/designs/<id>/
  index.tsx    the manifest and the view
  design.css   the stylesheet; every rule starts with .design-<id>
```

Then register it in two places:

- `worker/designs/index.ts`: add it to `DESIGNS`.
- `worker/index.css`: `@import "./designs/<id>/design.css" layer(components);`

`worker/designs/splay/` is the worked example; start from a copy of it.

**The manifest** (`DesignDef`, see `worker/designs/types.ts`):

| Field    | What it is                                                                                                                                                                                                            |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`     | Matches the folder name and the `.design-<id>` class.                                                                                                                                                                 |
| `name`   | Shown in the admin's Design dropdown.                                                                                                                                                                                 |
| `note`   | One line under the dropdown: what it looks like, which piece it is for.                                                                                                                                               |
| `photos` | The photo slots, `photo1`, `photo2`… in page order. Each has a `label` saying where it appears ("Photo 1: the piece at home, beside the name") and a `fallback` drawing: `line`, `measured` or `foil`.                |
| `extra`  | Text the design adds beyond the shared copy (a caption, a band heading). Each has a `key`, a `label` and a `hint`, and `rows: 1` for a line or more for a paragraph. The view gives every one a sensible empty state. |
| `labels` | Optional relabelling or hints for the shared copy fields in the admin.                                                                                                                                                |

**The view** composes the shared blocks from `worker/designs/blocks.tsx`.
It arranges and styles them freely, but never rebuilds them:

| Block                                                    | Must appear                                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| One `<h1>` with `product.name`                           | Always (the blackletter is applied globally).                                   |
| `<Viewer>`                                               | Always: the 3D model.                                                           |
| `<Configurator {...props} />`                            | Always: sizes, options, the rolling price, add to cart, save and share.         |
| `<AvailabilityBadge>`                                    | Always (it renders nothing for made-to-order).                                  |
| `design.headline`, `design.intro` (or `product.summary`) | When set.                                                                       |
| `design.story` sections, `product.description`           | When set, rendered with `<Paragraphs>`.                                         |
| `design.highlights`                                      | When set.                                                                       |
| `<DimensionTable>`                                       | Always.                                                                         |
| `<CareNote>`                                             | Always (it renders nothing when care is empty).                                 |
| `<Photo slot={…}>`                                       | Once per slot in the manifest. It shows the chosen photo or the slot's drawing. |
| Every `extra` field                                      | Wherever the design puts it.                                                    |

`npm test` enforces this table (`tests/designs.test.tsx`). A design that
drops a block, a field or a slot, or writes a CSS rule outside
`.design-<id>`, fails the build.

### Rules

- **Body only.** Never touch the nav, the footer, `Layout.tsx`, or
  `worker/index.css` beyond the one `@import` line.
- **All words come from the admin.** Hard-code decoration only: no copy that
  the owner could not change. Extra text goes in `extra`.
- **Use the theme tokens** for anything the shop shares: `--foreground`,
  `--border`, `--muted-foreground`, the ink shadows, and `.on-night` panels.
  Add the design's own colours as `--<id>-*` custom properties on
  `.design-<id>`.
- **Keep the house manner.** 2–3 px ink borders. Hard ink offset shadows only
  on things that press or float. No caps eyebrows, no middle-dot separators.
- **Photos fill their box** (`object-cover`). Give every slot a fixed aspect
  ratio so an empty one (a drawing) holds the same space.
- **Motion:** none needed. Any motion must stop under
  `prefers-reduced-motion`.
- **The 3D model** comes from the product's components (or its GLB). Boxes
  cannot lean or curve, so if the piece has splayed legs, curves or tapers,
  say in the hand-off that a Blender GLB is needed for the 3D view to match
  (`docs/blender.md`).

### Check it

1. `npm run build` and `npm test` pass.
2. Run locally and add the piece: in `worker/config/catalogue.ts` as a draft
   with its dimensions, components, placeholder prices and copy, then
   `npm run seed:local`.
3. Upload the photos in the local admin, choose the design, assign the
   slots.
4. Screenshot the page at 390 px and 1440 px wide, both with every slot
   filled and with every slot empty (drawings). Check:
   - no horizontal scroll;
   - nothing overlaps the configurator;
   - dragging the 3D view on a phone turns the model without scrolling the
     page;
   - the price and add-to-cart work.
5. Check the collection card: its colours come from `.design-<id>`, and with
   two or more photos it turns through them.

### Hand-off

Tell the owner:

- the design's name;
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
   - edit the headline, introduction, story, highlights and care;
   - fill in the design's own fields;
   - for each photo slot, pick a photo by number, or leave it on a drawing.
4. **Save**, then **Preview page**. Set Status to **published** when it is
   right. A piece still on the Draft design cannot be published.

Switching to another design and back keeps everything typed. Removing a
photo puts any slot that used it back to its drawing.
