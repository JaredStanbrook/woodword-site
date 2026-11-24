// worker/designs/index.ts
//
// Every page design the shop has. Adding one: make its folder (index.tsx and
// design.css, see docs/designing-a-piece.md), add it to DESIGNS below, and
// @import its design.css in worker/index.css. tests/designs.test.tsx then
// checks it carries everything a product page needs.

import type { SelectProduct } from "@server/schema/product.schema";
import type { DesignDef } from "./types";
import { draft } from "./draft";
import { grid } from "./grid";
import { hearth } from "./hearth";
import { nord } from "./nord";
import { settle } from "./settle";
import { splay } from "./splay";

export const DESIGNS: Record<string, DesignDef> = Object.fromEntries(
  [splay, nord, hearth, grid, settle, draft].map((d) => [d.id, d]),
);

/** A piece's design, or the draft one if its design has gone. */
export const designFor = (p: Pick<SelectProduct, "design">): DesignDef =>
  DESIGNS[p.design?.id] ?? draft;

export type { DesignDef, DesignProps, FieldDef, SlotDef } from "./types";
