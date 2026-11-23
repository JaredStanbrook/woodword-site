// worker/views/shop/Checkout.tsx

import type { CartLine } from "@server/services/cart.service";
import { DELIVERY_OPTIONS } from "@server/config/shop.config";
import { LineDetails, LineThumb } from "./Cart";
import { Price, buttonPrimary, inputClass, leadTimeLabel } from "./parts";

export interface CheckoutValues {
  name?: string;
  email?: string;
  phone?: string;
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postcode?: string;
  country?: string;
  delivery?: string;
  notes?: string;
}

interface CheckoutProps {
  lines: CartLine[];
  values: CheckoutValues;
  errors: Record<string, string>;
  /** A message above the form: payment not set up, a cancelled payment, a failure. */
  notice?: { tone: "info" | "error"; text: string };
  locale: string;
  currency: string;
  /** How payment will be taken, said on the button. */
  paymentMode: "stripe" | "test" | "none";
}

const Field = ({
  name,
  label,
  values,
  errors,
  type = "text",
  autocomplete,
  required = true,
  class: cls = "",
}: {
  name: keyof CheckoutValues;
  label: string;
  values: CheckoutValues;
  errors: Record<string, string>;
  type?: string;
  autocomplete?: string;
  required?: boolean;
  class?: string;
}) => (
  <div class={`space-y-1.5 ${cls}`}>
    <label for={`f-${name}`} class="text-sm font-medium">
      {label}
      {required ? null : <span class="font-normal text-muted-foreground"> (optional)</span>}
    </label>
    <input
      id={`f-${name}`}
      name={name}
      type={type}
      value={values[name] ?? ""}
      autocomplete={autocomplete}
      required={required}
      aria-invalid={errors[name] ? "true" : undefined}
      aria-describedby={errors[name] ? `f-${name}-error` : undefined}
      class={inputClass}
    />
    {errors[name] ? (
      <p id={`f-${name}-error`} class="text-sm text-destructive">
        {errors[name]}
      </p>
    ) : null}
  </div>
);

export const CheckoutPage = (props: CheckoutProps) => {
  const { lines, values, errors, locale, currency } = props;
  const subtotal = lines.reduce((s, l) => s + l.lineTotalCents, 0);
  const lead = Math.max(0, ...lines.map((l) => l.quote.leadDays));
  const chosen = values.delivery ?? DELIVERY_OPTIONS[0].id;

  return (
    <div class="mx-auto max-w-6xl px-4 pt-12 sm:px-6 animate-in fade-in duration-500">
      <h1 class="text-4xl">Checkout</h1>
      {props.notice ? (
        <p
          role={props.notice.tone === "error" ? "alert" : "status"}
          class={`mt-6 rounded-sm border-2 p-4 text-sm ${
            props.notice.tone === "error"
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-border bg-muted text-foreground"
          }`}
        >
          {props.notice.text}
        </p>
      ) : null}

      <form
        method="post"
        action="/checkout"
        class="mt-10 grid gap-10 lg:grid-cols-[1fr_24rem]"
        hx-boost="false"
      >
        <div class="space-y-10">
          <fieldset class="space-y-4">
            <legend class="mb-2 font-display text-xl">Contact</legend>
            <div class="grid gap-4 sm:grid-cols-2">
              <Field
                name="name"
                label="Full name"
                values={values}
                errors={errors}
                autocomplete="name"
              />
              <Field
                name="email"
                label="Email"
                type="email"
                values={values}
                errors={errors}
                autocomplete="email"
              />
              <Field
                name="phone"
                label="Phone, for delivery"
                type="tel"
                values={values}
                errors={errors}
                autocomplete="tel"
                required={false}
              />
            </div>
          </fieldset>

          <fieldset class="space-y-4">
            <legend class="mb-2 font-display text-xl">Delivery address</legend>
            <div class="grid gap-4 sm:grid-cols-2">
              <Field
                name="line1"
                label="Street address"
                values={values}
                errors={errors}
                autocomplete="address-line1"
                class="sm:col-span-2"
              />
              <Field
                name="line2"
                label="Apartment, floor, access notes"
                values={values}
                errors={errors}
                autocomplete="address-line2"
                required={false}
                class="sm:col-span-2"
              />
              <Field
                name="city"
                label="Town or city"
                values={values}
                errors={errors}
                autocomplete="address-level2"
              />
              <Field
                name="region"
                label="County, state or region"
                values={values}
                errors={errors}
                autocomplete="address-level1"
                required={false}
              />
              <Field
                name="postcode"
                label="Postcode"
                values={values}
                errors={errors}
                autocomplete="postal-code"
              />
              <Field
                name="country"
                label="Country"
                values={values}
                errors={errors}
                autocomplete="country-name"
              />
            </div>
          </fieldset>

          <fieldset class="space-y-3">
            <legend class="mb-2 font-display text-xl">Delivery</legend>
            {DELIVERY_OPTIONS.map((d) => (
              <label class="flex min-h-11 cursor-pointer items-start gap-3 rounded-sm border-2 border-input p-4 transition-colors hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-accent/60 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                <input
                  type="radio"
                  name="delivery"
                  value={d.id}
                  checked={chosen === d.id}
                  class="mt-1 h-4 w-4 accent-primary"
                />
                <span class="flex-1">
                  <span class="block text-sm font-medium">{d.label}</span>
                  <span class="block text-sm text-muted-foreground">{d.description}</span>
                </span>
                <span class="text-sm tabular-nums">
                  {d.cents === 0 ? (
                    "Free"
                  ) : (
                    <Price cents={d.cents} locale={locale} currency={currency} />
                  )}
                </span>
              </label>
            ))}
            {errors.delivery ? <p class="text-sm text-destructive">{errors.delivery}</p> : null}
          </fieldset>

          <div class="space-y-1.5">
            <label for="f-notes" class="text-sm font-medium">
              Anything we should know{" "}
              <span class="font-normal text-muted-foreground">(optional)</span>
            </label>
            <textarea id="f-notes" name="notes" rows={3} class={`${inputClass} h-auto`}>
              {values.notes ?? ""}
            </textarea>
          </div>
        </div>

        <aside class="h-fit space-y-5 rounded-sm border-2 bg-card p-5 text-card-foreground shadow-sm lg:sticky lg:top-8">
          <h2 class="font-display text-xl">Your order</h2>
          <ul class="space-y-4">
            {lines.map((line) => (
              <li class="flex gap-3">
                <LineThumb line={line} small />
                <div class="min-w-0 flex-1 text-sm">
                  <p class="font-medium">
                    {line.product.name}
                    {line.item.quantity > 1 ? ` × ${line.item.quantity}` : ""}
                  </p>
                  <LineDetails line={line} />
                </div>
                <Price cents={line.lineTotalCents} locale={locale} currency={currency} />
              </li>
            ))}
          </ul>
          <dl class="space-y-2 border-t-2 pt-4 text-sm">
            <div class="flex justify-between">
              <dt class="text-muted-foreground">Subtotal</dt>
              <dd>
                <Price cents={subtotal} locale={locale} currency={currency} />
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-muted-foreground">Delivery</dt>
              <dd class="text-muted-foreground">added from your choice</dd>
            </div>
          </dl>
          <p class="flex items-start gap-2 border-t-2 pt-4 text-sm text-muted-foreground">
            <i data-lucide="clock" class="mt-0.5 h-4 w-4 shrink-0"></i>
            {leadTimeLabel(lead)}, then delivery as chosen. We confirm a date when it is finished.
          </p>
          <button
            type="submit"
            class={`${buttonPrimary} w-full`}
            disabled={props.paymentMode === "none"}
          >
            <i data-lucide="lock" class="h-4 w-4"></i>
            {props.paymentMode === "stripe"
              ? "Continue to secure payment"
              : props.paymentMode === "test"
                ? "Place test order"
                : "Payments unavailable"}
          </button>
          <p class="text-xs text-muted-foreground">
            {props.paymentMode === "stripe"
              ? "You pay on Stripe's secure page. Card details never reach this site."
              : props.paymentMode === "test"
                ? "Development mode: no payment provider is set up, so payment is simulated."
                : "Online payment is not set up yet. Please contact us to order."}
          </p>
        </aside>
      </form>
    </div>
  );
};
