// worker/designs/types.ts
//
// What a page design is: a view for the body of one product page and its own
// stylesheet (design.css beside it, every rule under `.design-<id>`).
// docs/designing-a-piece.md is the brief for making one.

import type { FC } from "hono/jsx";
import type { ConfiguratorProps } from "@views/shop/Configurator";

export interface DesignProps extends ConfiguratorProps {
  /** Admin preview of an unpublished piece. */
  preview?: boolean;
}

export interface DesignDef {
  id: string;
  /** In the admin dropdown. */
  name: string;
  /** One line beside the name: what it looks like, which piece it is for. */
  note: string;
  view: FC<DesignProps>;
  /** Only for pieces still being set up: it cannot be published. */
  draft?: boolean;
}
