# The Mooihout mark

**The mark** is a table drawn square-on: a top, two legs, and a V-brace
between them that turns the legs into an **M**. A workshop dimension line with
architect's ticks runs underneath. It says what the shop does — furniture,
made to a measurement — in the same drawing language as every product
drawing on the site.

**The wordmark** is _Mooihout_ (Dutch/Afrikaans: "beautiful wood") in
Grenze Gotisch Bold, outlined, so it needs no font installed.

All files are in `public/brand/`, also served at `/brand/…` on the live site.

## Lockups

| File                         | Use                                                         |
| ---------------------------- | ----------------------------------------------------------- |
| `mooihout-horizontal-*`      | Website headers, letterheads, email signatures, invoices    |
| `mooihout-stacked-*`         | Posters, packaging, the workshop sign                       |
| `mooihout-stacked-tagline-*` | Adverts and print, where the shop needs explaining          |
| `mooihout-wordmark-*`        | Wide, short spaces; the name over a dimension line          |
| `mooihout-mark-*`            | Social avatars, stamps, branding irons, labels, the favicon |

PNG exports at print-friendly sizes: the gilt-on-ink and ink-on-honey marks
(1080 px square, for social avatars), the horizontal ink-on-honey lockup, the
stacked gilt-on-ink lockup with tagline, and the ink wordmark (transparent).
`public/og.png` is the link-preview image.

## Colours

| Name       | Hex       | Use                                              |
| ---------- | --------- | ------------------------------------------------ |
| Ink        | `#2b1a14` | The mark on light grounds; the night ground      |
| Honey      | `#f1d6b4` | The light ground                                 |
| Gilt       | `#e2b04d` | The mark on ink only — it does not read on honey |
| Bone       | `#f8eee0` | The mark on photographs and dark timber          |
| Blood rose | `#a01c24` | Sparingly: a stamp, a sale, a single sticker     |

Each lockup comes in `ink`, `bone` (transparent grounds), `ink-on-honey`,
`gilt-on-ink` and `bone-on-blood`.

## Rules

- **Clear space:** keep the width of one table leg clear on every side.
- **Smallest size:** the mark alone at 16 px (it is the favicon); the
  horizontal lockup no narrower than 120 px, or the ticks fill in.
- **Don't:** stretch it, outline it, add shadows or gradients, put gilt on
  honey, set the name in another typeface, or remove the dimension line from
  the mark — it is what makes it ours.

## Changing it

`scripts/brand/` rebuilds everything from the site's own fonts:

```bash
pip install fonttools brotli
python3 scripts/brand/outline.py /tmp/paths.json     # name and tagline → paths
node scripts/brand/build.mjs /tmp/paths.json public/brand
node scripts/brand/og.mjs public/brand/mooihout-stacked-tagline-gilt-on-ink.svg public/og.png
```

The mark's geometry is in `build.mjs` (`mark`), in a 100 × 100 grid; the same
shapes are inlined in `worker/views/components/NavBar.tsx` and
`public/favicon.svg`. Change all three together.
