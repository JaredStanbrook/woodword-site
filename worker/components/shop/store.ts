// worker/components/shop/store.ts
//
// The one piece of state the product page's two islands share: the current
// selection. The configurator writes it; the 3D viewer reads it. Both lazily
// loaded chunks import this module, so the bundler gives them one instance,
// and whichever island loads second still starts from the right size.

import type { FurnitureSpec, Selection } from "@server/schema/furniture.config";

export interface FurnitureData extends FurnitureSpec {
  selection: Selection;
  locale: string;
  currency: string;
  name: string;
  modelUrl: string | null;
}

type Listener = (sel: Selection) => void;

let current: Selection | null = null;
const listeners = new Set<Listener>();

export const furnitureStore = {
  get: () => current,
  set(sel: Selection) {
    current = sel;
    for (const l of listeners) l(sel);
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** Forget the last page's selection after an hx-boost navigation. */
  reset() {
    current = null;
  },
};

/** The JSON the server rendered for this page, or null on any other page. */
export function readFurnitureData(): FurnitureData | null {
  const el = document.getElementById("furniture-data");
  if (!el?.textContent) return null;
  try {
    return JSON.parse(el.textContent) as FurnitureData;
  } catch {
    return null;
  }
}
