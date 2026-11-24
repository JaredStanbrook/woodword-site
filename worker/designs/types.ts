// worker/designs/types.ts
//
// What a page design is: a view for the body of one product page, its own
// stylesheet (design.css beside it, every rule under `.design-<id>`), and a
// manifest telling the admin which text and which photos it uses.
// docs/designing-a-piece.md is the brief for making one.

import type { FC } from "hono/jsx";
import type { Blueprint } from "@server/schema/furniture.config";
import type { ConfiguratorProps } from "@views/shop/Configurator";

export interface DesignProps extends ConfiguratorProps {
  /** Admin preview of an unpublished piece. */
  preview?: boolean;
}

/** The copy every design shows; a design may relabel these in the admin. */
export type CoreField = "headline" | "intro" | "story" | "highlights" | "care";

export interface FieldDef {
  /** Stored as design.extra[key]. Lowercase, no spaces. */
  key: string;
  label: string;
  hint?: string;
  /** 1 for a single line; more for a paragraph box. */
  rows?: number;
  max?: number;
}

export interface SlotDef {
  /** "photo1", "photo2"… */
  key: string;
  /** Where it appears on the page, shown in the admin. */
  label: string;
  /** Shown while no photo is chosen. */
  fallback: Blueprint;
}

export interface DesignDef {
  id: string;
  /** In the admin dropdown. */
  name: string;
  /** One line under the dropdown: what it looks like, which piece it is for. */
  note: string;
  view: FC<DesignProps>;
  /** Admin labels or hints for the shared copy, where this design uses it differently. */
  labels?: Partial<Record<CoreField, { label?: string; hint?: string }>>;
  extra: FieldDef[];
  photos: SlotDef[];
  /** Only for pieces still being set up: it cannot be published. */
  draft?: boolean;
}
