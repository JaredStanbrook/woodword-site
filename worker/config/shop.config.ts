// worker/config/shop.config.ts
//
// Shop settings that are business decisions rather than secrets: delivery
// methods and how order references look. Edit here; prices are integer cents
// in APP_CURRENCY.

export interface DeliveryOption {
  id: string;
  label: string;
  description: string;
  cents: number;
  /** Days added to the workshop lead time for the estimate. */
  days: number;
}

export const DELIVERY_OPTIONS: DeliveryOption[] = [
  {
    id: "collect",
    label: "Collect from the workshop",
    description: "We will arrange a time once your piece is finished.",
    cents: 0,
    days: 0,
  },
  {
    id: "standard",
    label: "Delivered to your door",
    description: "Two-person delivery to the ground floor, blanket-wrapped.",
    cents: 9_500,
    days: 5,
  },
  {
    id: "white-glove",
    label: "Delivered and placed",
    description: "Carried to the room, assembled where needed, packaging taken away.",
    cents: 24_500,
    days: 7,
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
