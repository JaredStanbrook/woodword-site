// worker/lib/money.ts
//
// Price formatting shared by the server views and the browser islands, so the
// number the rolling display lands on is character for character the one the
// server rendered. Money is integer cents throughout.

const cache = new Map<string, Intl.NumberFormat>();

const formatter = (locale: string, currency: string, fraction: 0 | 2) => {
  const key = `${locale}|${currency}|${fraction}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: fraction,
      maximumFractionDigits: fraction,
    });
    cache.set(key, f);
  }
  return f;
};

/** €1,450 for whole amounts, €1,450.50 otherwise. */
export function formatPrice(cents: number, locale: string, currency: string): string {
  return formatter(locale, currency, cents % 100 === 0 ? 0 : 2).format(cents / 100);
}

/** The same string split into digits and everything else, for the rolling display. */
export function priceGlyphs(cents: number, locale: string, currency: string) {
  return [...formatPrice(cents, locale, currency)].map((ch) => ({
    ch,
    digit: ch >= "0" && ch <= "9" ? Number(ch) : null,
  }));
}
