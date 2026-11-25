// worker/config/shop.config.ts
//
// Shop settings that are business decisions rather than secrets: where the
// shop sells and delivers, delivery methods, and how order references look.
// Edit here; prices are integer cents in APP_CURRENCY (AUD).

export interface DeliveryOption {
  id: string;
  label: string;
  description: string;
  cents: number;
  /** Days added to the workshop lead time for the estimate. */
  days: number;
  /** Only to addresses in DELIVERY_AREA. Collection has no such limit. */
  needsDeliveryArea?: boolean;
}

// ==========================================
// WHERE WE SELL AND DELIVER
// ==========================================

/** We sell within Western Australia only: WA postcodes are 6000–6999. */
export const SELLS_IN = { state: "WA", stateName: "Western Australia", country: "Australia" };
export const isWesternAustralia = (postcode: string) => /^6\d{3}$/.test(postcode.trim());

/**
 * Where we deliver: the Perth metropolitan and Peel regions, by postcode.
 * Elsewhere in WA, customers collect from the workshop.
 *
 *   6000–6199  Perth metro, including Mandurah (6180–6182) and
 *              Serpentine-Jarrahdale (6121–6126)
 *   6207–6215  the rest of Peel: Murray (Pinjarra, the Yunderups, Dwellingup,
 *              Coolup), Mandurah's southern suburbs (Falcon, Dawesville),
 *              Waroona
 *   6390       Boddington, in Peel
 *   6556, 6558 Chidlow and Wooroloo, in the Shire of Mundaring (metro)
 *
 * Rottnest (6161) is inside the first range but has no road: excluded.
 * Check this list against where the van really goes, and edit freely.
 */
export const DELIVERY_AREA = "Perth and Peel";
export const DELIVERY_RANGES: [number, number][] = [
  [6000, 6199],
  [6207, 6215],
  [6390, 6390],
  [6556, 6556],
  [6558, 6558],
];
export const NO_ROAD = [6161];

export function deliversTo(postcode: string): boolean {
  if (!/^\d{4}$/.test(postcode.trim())) return false;
  const n = Number(postcode.trim());
  return !NO_ROAD.includes(n) && DELIVERY_RANGES.some(([lo, hi]) => n >= lo && n <= hi);
}

export const DELIVERY_OPTIONS: DeliveryOption[] = [
  {
    id: "collect",
    label: "Collect from the workshop",
    description: "Anywhere in WA. We will arrange a time once your piece is finished.",
    cents: 0,
    days: 0,
  },
  {
    id: "standard",
    label: "Delivered to your door",
    description: "Perth and Peel only. Two-person delivery to the ground floor, blanket-wrapped.",
    cents: 9_500,
    days: 5,
    needsDeliveryArea: true,
  },
  {
    id: "white-glove",
    label: "Delivered and placed",
    description:
      "Perth and Peel only. Carried to the room, assembled where needed, packaging taken away.",
    cents: 24_500,
    days: 7,
    needsDeliveryArea: true,
  },
];

export const deliveryOption = (id: string) => DELIVERY_OPTIONS.find((d) => d.id === id);

/** Prefix for order references: MH-7K3P9Q. */
export const ORDER_REF_PREFIX = "MH";

/** Most of any one configuration a single cart line may hold. */
export const MAX_QUANTITY = 20;

/** Uploads: largest file accepted per kind, in bytes. */
export const UPLOAD_LIMITS = {
  image: 8 * 1024 * 1024,
  model: 20 * 1024 * 1024,
  blend: 95 * 1024 * 1024,
};
