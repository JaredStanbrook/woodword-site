# Running the shop

What the site does, and the few things only the owner can set up.

## What is where

| Page                                    | Path                                                                    |
| --------------------------------------- | ----------------------------------------------------------------------- |
| Collection (home), category filter      | `/`, `/?category=tables`                                                |
| A product, its configurator and 3D view | `/furniture/<slug>`                                                     |
| A configuration someone saved or shared | `/d/<token>`                                                            |
| Cart, checkout                          | `/cart`, `/checkout`                                                    |
| Order confirmation and tracking         | `/orders/<ref>?t=<token>` (link in the email), `/orders` to look one up |
| Customer account: orders, saved designs | `/account`                                                              |
| Admin dashboard, products, orders       | `/admin`, `/admin/products`, `/admin/orders`                            |

## Adding a product

1. **Products → Create from a prompt** (needs `ANTHROPIC_API_KEY`), or **New
   product** to start from a form.
2. A generated product is saved as a **draft**: copy, dimensions, components
   with resize rules, prices, options and the page copy. It is checked exactly
   like a hand-made one. Read it, fix the prices to yours.
3. Model it in Blender to match the components — see [blender.md](blender.md)
   — then paste the exported components, upload the GLB, the `.blend`, and
   photographs.
4. Its page is designed for it: send the photos and a description, and a new
   design is built in code ([designing-a-piece.md](designing-a-piece.md)).
   Until then the piece uses the plain **Draft** design, which cannot be
   published.
5. Under **Page design**, pick the piece's design and write its two lines.
   Every uploaded photo appears in the page's gallery, in upload order,
   followed by the workshop drawing.
6. **View page** shows it as customers will see it (only admins can). Set
   Status to **published** when it is right.

Buying, sizing and the 3D view work the same on every design. On the
collection page, a piece's card turns slowly through all its photos, starting
with the first ("Make first" under Images).

## Prices

Price = making + timber + surface area + custom-size charges + option prices.

- **Timber** is the volume of the resized components (body and accent) times
  the rate per m³, times the chosen timber's multiplier. It grows with the
  piece automatically.
- **Per cm larger than standard** pays for extra workshop time; it applies
  only to growth, not to a smaller piece.
- **Custom size charge** applies to any size other than the standard one.
- Each line is rounded to "Round each line to", so the lines the customer sees
  add up to the total exactly.

The server recalculates every price before it reaches the cart and again at
checkout; the browser's number is only ever a preview.

## Orders

Paid orders arrive as **Order received**. Move them along with **Move to: …**
on the order: awaiting production → in production → ready for dispatch →
dispatched → completed. Each change (with an optional note) appears on the
customer's tracking page. **Manufacturing spec** is the printable cut list;
**Spec JSON** feeds the Blender script.

**Refunded** records a refund; issue the money itself from the Stripe
dashboard. Orders left at **Awaiting payment** are checkouts that never paid;
they are not counted in sales.

## Setup only the owner can do

All in the Cloudflare dashboard under the Worker → Settings → Variables and
Secrets, type **Secret**:

| Secret                  | For                                                     | Without it                                                                 |
| ----------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------- |
| `JWT_SECRET`            | Sign-in sessions                                        | The site refuses to run                                                    |
| `STRIPE_SECRET_KEY`     | Taking payment                                          | Checkout is closed on production                                           |
| `STRIPE_WEBHOOK_SECRET` | Confirming payments even if the customer closes the tab | Payment is still confirmed when they return to the site, but not otherwise |
| `ANTHROPIC_API_KEY`     | Create from a prompt                                    | Products are created with the form only                                    |
| `RESEND_API_KEY`        | Order confirmation emails (also set `EMAIL_FROM`)       | No emails; the order page is the confirmation                              |

**Stripe webhook:** Stripe dashboard → Developers → Webhooks → Add endpoint
`https://<your-domain>/api/stripe/webhook`, events
`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`. Copy its signing secret into
`STRIPE_WEBHOOK_SECRET`.

**Delivery options** and the order reference prefix are in
`worker/config/shop.config.ts`. **Currency and locale** are `APP_CURRENCY`
and `APP_LOCALE` in `wrangler.jsonc`.

## Local development

```bash
cp .dev.vars.example .dev.vars   # set JWT_SECRET; ENVIRONMENT=development simulates payment
npm run migrate:local
npm run seed:local               # the Splay console
npm run create-admin:local -- --email you@example.com --password '…'
npm run dev                      # or: npm run build && npx wrangler dev
```

With no Stripe key and `ENVIRONMENT` not `production`, checkout places a test
order with a **Simulate payment** button, so the whole flow can be tried.
