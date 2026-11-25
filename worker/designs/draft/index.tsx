// worker/designs/draft/index.tsx
//
// The page a new piece has before its own design is made: every block a
// product page needs, stacked plainly. Good enough to check copy, sizes and
// prices in preview. It cannot be published (services/product-form.ts).

import type { FC } from "hono/jsx";
import { AvailabilityBadge, Configurator, Gallery, Viewer } from "../blocks";
import type { DesignDef, DesignProps } from "../types";

const Draft: FC<DesignProps> = (props) => {
  const { product: p, selection } = props;
  const d = p.design;
  return (
    <div class="mx-auto max-w-5xl space-y-10 px-4 py-10 sm:px-6">
      <div class="grid gap-10 lg:grid-cols-2">
        <header class="space-y-4">
          <AvailabilityBadge availability={p.availability} />
          <h1 class="text-5xl">{p.name || "Untitled piece"}</h1>
          {d.headline ? <p class="text-xl leading-snug">{d.headline}</p> : null}
          {d.intro ? <p class="leading-relaxed text-muted-foreground">{d.intro}</p> : null}
        </header>
        <Gallery product={p} selection={selection} mainClass="aspect-[4/3]" />
      </div>
      <div class="grid gap-10 lg:grid-cols-2">
        <Viewer product={p} selection={selection} class="aspect-[4/3] rounded-sm border-2" />
        <Configurator {...props} />
      </div>
    </div>
  );
};

export const draft: DesignDef = {
  id: "draft",
  name: "Draft (not for publishing)",
  note: "Every block stacked plainly, until this piece's own design is made.",
  view: Draft,
  draft: true,
};
