// worker/views/shop/Configurator.tsx
//
// The configurator, server-rendered complete: every control, the price and
// its breakdown are in the HTML. Without JavaScript the form still works —
// "Update price" reloads the page with the new size, and "Add to cart" posts
// it. With JavaScript, <furniture-configurator> (components/shop/) takes over
// the same markup: controls stay in step, the price rolls, and the 3D view
// follows every change.
//
// The server never trusts what this form sends. /cart re-normalises the
// selection and recomputes the price from the product.

import type { SelectProduct } from "@server/schema/product.schema";
import { specOf } from "@server/schema/product.schema";
import type { DimensionKey, Selection } from "@server/schema/furniture.config";
import { AXES, chosenOptions, type Quote } from "@server/lib/furniture";
import { formatPrice } from "@server/lib/money";
import { RollingPrice, buttonPrimary, buttonSecondary, leadTimeLabel } from "./parts";

const AXIS_LABEL: Record<DimensionKey, string> = {
  width: "Width",
  height: "Height",
  depth: "Depth",
};
const AXIS_PARAM: Record<DimensionKey, string> = { width: "w", height: "h", depth: "d" };

/** JSON for a <script type="application/json">, safe against `</script>`. */
export const scriptJson = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

export interface ConfiguratorProps {
  product: SelectProduct;
  selection: Selection;
  quote: Quote;
  locale: string;
  currency: string;
  /** Set when editing a line already in the cart. */
  editingItemId?: number;
  purchasable: boolean;
  /** Absolute URL of a just-saved design, to show for copying. */
  savedLink?: string;
}

const fillPercent = (value: number, min: number, max: number) =>
  max === min ? 100 : Math.round(((value - min) / (max - min)) * 100);

const DimensionControl = ({
  axis,
  product,
  value,
}: {
  axis: DimensionKey;
  product: SelectProduct;
  value: number;
}) => {
  const dim = product.dimensions[axis];
  const fixed = dim.min === dim.max;
  const id = `dim-${axis}`;
  const label = AXIS_LABEL[axis];

  return (
    <div class="space-y-1" data-dimension={axis}>
      <div class="flex items-baseline justify-between gap-3">
        <label for={id} class="text-sm font-medium">
          {label}
        </label>
        <span class="text-xs text-muted-foreground tabular-nums" id={`${id}-range`}>
          {fixed ? "Fixed size" : `${dim.min} to ${dim.max} mm, standard ${dim.standard}`}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          data-step-down
          class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border-2 border-input hover:bg-accent hover:text-accent-foreground disabled:opacity-40 transition-colors"
          aria-label={`Decrease ${label.toLowerCase()} by ${dim.step} mm`}
          disabled={fixed || value <= dim.min}
        >
          <i data-lucide="minus" class="h-4 w-4"></i>
        </button>
        <div class="relative flex-1">
          <input
            id={id}
            name={AXIS_PARAM[axis]}
            type="number"
            inputmode="numeric"
            min={dim.min}
            max={dim.max}
            step={dim.step}
            value={value}
            readonly={fixed}
            aria-describedby={`${id}-range`}
            data-number
            class="flex h-11 w-full rounded-sm border-2 border-input bg-background pl-3 pr-12 text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            mm
          </span>
        </div>
        <button
          type="button"
          data-step-up
          class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border-2 border-input hover:bg-accent hover:text-accent-foreground disabled:opacity-40 transition-colors"
          aria-label={`Increase ${label.toLowerCase()} by ${dim.step} mm`}
          disabled={fixed || value >= dim.max}
        >
          <i data-lucide="plus" class="h-4 w-4"></i>
        </button>
      </div>
      {fixed ? null : (
        <input
          type="range"
          class="slider w-full"
          min={dim.min}
          max={dim.max}
          step={dim.step}
          value={value}
          aria-label={`${label} in millimetres`}
          data-range
          style={`--fill: ${fillPercent(value, dim.min, dim.max)}%`}
        />
      )}
    </div>
  );
};

export const Breakdown = ({
  quote,
  locale,
  currency,
}: {
  quote: Quote;
  locale: string;
  currency: string;
}) => (
  <dl class="space-y-1.5 text-sm" data-breakdown>
    {quote.lines.map((line) => (
      <div class="flex justify-between gap-4">
        <dt class="text-muted-foreground">{line.label}</dt>
        <dd class="tabular-nums">{formatPrice(line.cents, locale, currency)}</dd>
      </div>
    ))}
  </dl>
);

export const Configurator = (props: ConfiguratorProps) => {
  const { product, selection, quote, locale, currency } = props;
  const spec = specOf(product);
  const chosen = chosenOptions(spec, selection);
  const clientData = {
    ...spec,
    selection,
    locale,
    currency,
    modelUrl: product.modelKey ? `/media/${product.modelKey}?v=${product.modelVersion}` : null,
  };

  return (
    <furniture-configurator class="block">
      <script
        type="application/json"
        id="furniture-data"
        dangerouslySetInnerHTML={{ __html: scriptJson(clientData) }}
      ></script>

      <form method="post" action="/cart" class="space-y-8" data-configurator-form>
        <input type="hidden" name="productId" value={String(product.id)} />
        {props.editingItemId ? (
          <input type="hidden" name="item" value={String(props.editingItemId)} />
        ) : null}

        <fieldset class="space-y-5">
          <legend class="mb-4 flex w-full items-baseline justify-between text-sm italic text-muted-foreground">
            <span>Size</span>
            <button
              type="button"
              data-reset-size
              class="inline-flex h-11 items-center gap-1.5 normal-case tracking-normal text-sm text-muted-foreground hover:text-foreground"
            >
              <i data-lucide="rotate-ccw" class="h-3.5 w-3.5"></i> Standard size
            </button>
          </legend>
          {AXES.map((axis) => (
            <DimensionControl axis={axis} product={product} value={selection[axis]} />
          ))}
        </fieldset>

        {spec.options.map((group) => (
          <fieldset class="space-y-3">
            <legend class="mb-3 flex w-full items-baseline justify-between gap-3 text-sm italic text-muted-foreground">
              <span>{group.label}</span>
              <span
                class="normal-case tracking-normal text-sm text-foreground"
                data-option-label={group.id}
              >
                {chosen.find((c) => c.groupId === group.id)?.choice.label}
              </span>
            </legend>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {group.choices.map((choice) => (
                <label class="group/choice relative flex min-h-11 cursor-pointer items-center gap-3 rounded-sm border-2 border-input px-3 py-2.5 transition-colors hover:bg-accent has-[:checked]:border-foreground has-[:checked]:bg-card has-[:checked]:shadow-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                  <input
                    type="radio"
                    name={`o.${group.id}`}
                    value={choice.id}
                    checked={selection.options[group.id] === choice.id}
                    class="sr-only"
                    data-option={group.id}
                    data-choice-label={choice.label}
                  />
                  {choice.color ? (
                    <span
                      class="h-6 w-6 shrink-0 rounded-full border-2 border-foreground/15 shadow-xs"
                      style={`background-color: ${choice.color}`}
                      aria-hidden="true"
                    ></span>
                  ) : null}
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm font-medium">{choice.label}</span>
                    {choice.description ? (
                      <span class="block text-xs text-muted-foreground">{choice.description}</span>
                    ) : null}
                  </span>
                  {choice.priceCents ? (
                    <span class="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {choice.priceCents > 0 ? "+" : "−"}
                      {formatPrice(Math.abs(choice.priceCents), locale, currency)}
                    </span>
                  ) : null}
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <noscript>
          <button
            type="submit"
            formmethod="get"
            formaction={`/furniture/${product.slug}`}
            class={buttonSecondary}
          >
            Update price
          </button>
        </noscript>

        <section
          class="on-night space-y-5 rounded-sm border-[3px] border-night p-6 shadow-lg"
          aria-label="Price"
        >
          <div>
            <p class="text-sm italic text-muted-foreground">Current configuration price</p>
            <p class="mt-2 font-serif text-6xl font-semibold text-gilt">
              <RollingPrice cents={quote.totalCents} locale={locale} currency={currency} />
            </p>
            <p class="mt-2 text-sm text-muted-foreground">
              <span data-size-label>
                {selection.width} × {selection.depth} × {selection.height} mm
              </span>
              {", "}
              <span data-custom-label>{quote.custom ? "made to your size" : "standard size"}</span>
            </p>
          </div>

          <details class="group border-t-2 pt-4">
            <summary class="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-medium [&::-webkit-details-marker]:hidden">
              How this price is made up
              <i
                data-lucide="chevron-down"
                class="h-4 w-4 transition-transform group-open:rotate-180"
              ></i>
            </summary>
            <div class="pt-3">
              <Breakdown quote={quote} locale={locale} currency={currency} />
            </div>
          </details>

          <p class="flex items-start gap-2 border-t-2 pt-4 text-sm">
            <i data-lucide="clock" class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"></i>
            <span>
              <span data-lead-label>{leadTimeLabel(quote.leadDays)}</span>
              <span class="block text-xs text-muted-foreground">
                Delivery is arranged once it is finished. Custom sizes take longer to make.
              </span>
            </span>
          </p>

          {props.purchasable ? (
            <div class="flex flex-col gap-3 border-t-2 pt-5 sm:flex-row sm:items-center">
              <label class="flex items-center gap-2 text-sm">
                <span class="text-muted-foreground">Qty</span>
                <input
                  type="number"
                  name="quantity"
                  min="1"
                  max="20"
                  value="1"
                  inputmode="numeric"
                  class="h-11 w-20 rounded-sm border-2 border-input bg-background px-3 text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <button type="submit" class={`${buttonPrimary} w-full sm:w-auto sm:flex-1`}>
                <i data-lucide="shopping-bag" class="h-4 w-4"></i>
                {props.editingItemId ? "Update cart" : "Add to cart"}
              </button>
            </div>
          ) : (
            <p class="border-t-2 pt-5 text-sm text-muted-foreground">
              This piece is not available to order at the moment.
            </p>
          )}

          <div class="flex flex-wrap gap-2 border-t-2 pt-4" id="save-design">
            <button
              type="submit"
              formaction="/designs"
              formmethod="post"
              class="inline-flex h-11 items-center gap-2 rounded-sm px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <i data-lucide="bookmark" class="h-4 w-4"></i> Save or share this design
            </button>
          </div>
          {props.savedLink ? (
            <div class="space-y-2 rounded-sm bg-muted p-3 text-sm" role="status">
              <p class="font-medium">
                Design saved. Anyone with this link sees exactly this configuration:
              </p>
              <input
                readonly
                value={props.savedLink}
                aria-label="Link to this design"
                class="h-11 w-full rounded-sm border-2 border-input bg-background px-3 text-sm"
                onclick="this.select()"
              />
            </div>
          ) : null}
        </section>
      </form>
    </furniture-configurator>
  );
};
