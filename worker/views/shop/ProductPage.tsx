// worker/views/shop/ProductPage.tsx
//
// One product page: the piece's own design (worker/designs/) inside the
// shop's navigation and footer. The design draws the body; the configurator,
// 3D view, price and cart form inside it are the shared blocks, so buying
// works the same on every page.

import type { FC } from "hono/jsx";
import { designFor } from "@server/designs";
import { designClass, PreviewBanner } from "@server/designs/blocks";
import type { DesignProps } from "@server/designs/types";
import type { Quote } from "@server/lib/furniture";

export type ProductPageProps = DesignProps;

export const ProductPage: FC<ProductPageProps> = (props) => {
  const { product } = props;
  const View = designFor(product).view;
  return (
    <div class={`${designClass(product)} animate-in fade-in duration-500`}>
      {props.preview ? <PreviewBanner product={product} /> : null}
      <View {...props} />
    </div>
  );
};

export type { Quote };
