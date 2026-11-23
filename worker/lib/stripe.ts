// worker/lib/stripe.ts
//
// The three Stripe calls the shop makes, over fetch: create a Checkout
// Session, read one back, and verify a webhook signature. No SDK — it would be
// the largest dependency in the Worker for three requests.
//
// Card details never touch this site: the customer pays on Stripe's hosted
// Checkout page and comes back to /orders/:ref.

const API = "https://api.stripe.com/v1";

export interface CheckoutLine {
  name: string;
  description?: string;
  unitAmountCents: number;
  quantity: number;
}

export interface CheckoutSession {
  id: string;
  url: string | null;
  status: "open" | "complete" | "expired";
  payment_status: "paid" | "unpaid" | "no_payment_required";
  payment_intent: string | null;
  metadata: Record<string, string>;
  client_reference_id: string | null;
}

/** Stripe's form encoding: nested keys as `line_items[0][price_data][currency]`. */
function encode(params: Record<string, unknown>, prefix = "", out = new URLSearchParams()) {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((v, i) =>
        typeof v === "object"
          ? encode(v, `${name}[${i}]`, out)
          : out.append(`${name}[${i}]`, String(v)),
      );
    } else if (typeof value === "object") {
      encode(value as Record<string, unknown>, name, out);
    } else {
      out.append(name, String(value));
    }
  }
  return out;
}

async function call<T>(
  secretKey: string,
  method: "GET" | "POST",
  path: string,
  body?: URLSearchParams,
  headers: Record<string, string> = {},
) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2024-06-20",
      ...headers,
    },
    body,
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`Stripe ${path}: ${json.error?.message ?? res.status}`);
  return json as T;
}

export function createCheckoutSession(
  secretKey: string,
  opts: {
    orderRef: string;
    currency: string;
    email: string;
    lines: CheckoutLine[];
    successUrl: string;
    cancelUrl: string;
    /** Stops a retried request creating a second session for one order. */
    idempotencyKey: string;
  },
) {
  const body = encode({
    mode: "payment",
    customer_email: opts.email,
    client_reference_id: opts.orderRef,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    metadata: { order_ref: opts.orderRef },
    payment_intent_data: { metadata: { order_ref: opts.orderRef } },
    line_items: opts.lines.map((l) => ({
      quantity: l.quantity,
      price_data: {
        currency: opts.currency.toLowerCase(),
        unit_amount: l.unitAmountCents,
        product_data: { name: l.name, description: l.description || undefined },
      },
    })),
  });
  return call<CheckoutSession>(secretKey, "POST", "/checkout/sessions", body, {
    "Idempotency-Key": opts.idempotencyKey,
  });
}

export const retrieveCheckoutSession = (secretKey: string, id: string) =>
  call<CheckoutSession>(secretKey, "GET", `/checkout/sessions/${encodeURIComponent(id)}`);

const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/**
 * Checks a `Stripe-Signature` header against the raw request body.
 *
 * Stripe signs `${timestamp}.${body}` with the endpoint's secret (HMAC
 * SHA-256). The timestamp must be recent, so a captured request cannot be
 * replayed later. Returns the parsed event, or null if anything is off.
 */
export async function verifyWebhook(
  secret: string,
  header: string | undefined,
  rawBody: string,
  toleranceSeconds = 300,
  now = Date.now(),
): Promise<{ id: string; type: string; data: { object: any } } | null> {
  if (!header) return null;
  const fields = header.split(",").map((kv) => kv.split("=") as [string, string]);
  const timestamp = fields.find(([k]) => k === "t")?.[1];
  const signatures = fields.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!timestamp || signatures.length === 0) return null;
  if (Math.abs(now / 1000 - Number(timestamp)) > toleranceSeconds) return null;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = hex(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`)),
  );

  // Constant-time comparison, against every v1 signature (Stripe sends more
  // than one while a secret is being rolled).
  const match = signatures.some((sig) => {
    if (sig.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  });
  if (!match) return null;

  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
}
