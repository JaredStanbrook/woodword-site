import { html, raw } from "hono/html";
import type { FC, Child } from "hono/jsx";
import { type PropsUser } from "@server/schema/auth.schema";
import type { AppConfig } from "@server/config/app.config";
import { jsonLdScript, type ResolvedMeta } from "@server/lib/seo";
import { NavBar } from "./components/NavBar";
import type { Category } from "@server/schema/furniture.config";

interface LayoutProps {
  meta: ResolvedMeta;
  children?: Child;
  app: AppConfig;
  user?: PropsUser | null;
  currentPath?: string;
  /** Pieces in the visitor's cart, for the badge in the nav. */
  cart?: { count: number; totalCents: number };
  categories?: Category[];
  headExtra?: Child;
  /**
   * Appended to the stylesheet URL so each deploy gets a new one. Its file
   * name is fixed (`static/main.css`), so without it the stylesheet could not
   * be cached for long; with it, `public/_headers` caches it for a year and a
   * deploy still reaches every browser at once. See lib/asset-version.ts.
   *
   * Not appended to `client.js`: the lazily loaded chunks import shared code
   * back from `/static/client.js` by that exact URL, and a browser treats
   * `client.js?v=…` as a different module — so it would run the bundle twice,
   * and the second run fails to re-register its custom elements.
   */
  assetVersion: string;
}

export const Layout: FC<LayoutProps> = (props) => {
  const isProd = import.meta.env ? import.meta.env.PROD : true;

  return html`
    <!DOCTYPE html>
    <html lang="${props.meta.locale}">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${props.meta.title}</title>
        ${
          props.meta.description
            ? html`<meta name="description" content="${props.meta.description}" />`
            : ""
        }

        <!-- Points every variant of this page (trailing slash, ?q=…, utm tags)
             at one address, so a crawler ranks one page instead of splitting
             its signals across near-duplicates. -->
        <link rel="canonical" href="${props.meta.canonical}" />
        ${props.meta.noindex ? html`<meta name="robots" content="noindex, follow" />` : ""}

        <!-- Link previews. Without these a shared URL renders as a bare link. -->
        <meta property="og:type" content="${props.meta.type}" />
        <meta property="og:title" content="${props.meta.title}" />
        <meta property="og:url" content="${props.meta.canonical}" />
        <meta property="og:site_name" content="${props.meta.siteName}" />
        <meta property="og:locale" content="${props.meta.locale.replace("-", "_")}" />
        ${
          props.meta.description
            ? html`<meta property="og:description" content="${props.meta.description}" />`
            : ""
        }
        ${
          props.meta.image
            ? html`<meta property="og:image" content="${props.meta.image}" />
                <meta property="og:image:alt" content="${props.meta.siteName}" />
                <meta name="twitter:card" content="summary_large_image" />`
            : html`<meta name="twitter:card" content="summary" />`
        }
        <meta name="twitter:title" content="${props.meta.title}" />
        ${
          props.meta.description
            ? html`<meta name="twitter:description" content="${props.meta.description}" />`
            : ""
        }
        ${props.meta.jsonLd.map(
          (data) =>
            html`<script type="application/ld+json">
              ${raw(jsonLdScript(data))}
            </script>`,
        )}

        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <!-- The two faces above the fold. Without a preload the browser only
             discovers them after parsing the stylesheet, and the headline
             visibly swaps. crossorigin is required even same-origin. -->
        <link
          rel="preload"
          href="/fonts/grenze-gotisch-var.woff2"
          as="font"
          type="font/woff2"
          crossorigin
        />
        <link
          rel="preload"
          href="/fonts/eb-garamond-var.woff2"
          as="font"
          type="font/woff2"
          crossorigin
        />
        ${
          isProd
            ? html`<link rel="stylesheet" href="/static/main.css?v=${props.assetVersion}" />`
            : html`<link rel="stylesheet" href="/worker/index.css" />`
        }
        <script
          type="module"
          src="${isProd ? "/static/client.js" : "/worker/components/main.ts"}"
        ></script>
        ${props.headExtra}
      </head>
      <body class="bg-background text-foreground antialiased min-h-screen font-sans flex flex-col">
        ${
          props.meta.bare
            ? html`<header class="border-b-2">
                <div class="flex h-14 items-center px-4 font-display text-xl tracking-tight">
                  ${props.app.name}
                </div>
              </header>`
            : NavBar({
                appName: props.app.name,
                user: props.user,
                currentPath: props.currentPath,
                cart: props.cart,
                categories: props.categories ?? [],
                locale: props.app.locale,
                currency: props.app.currency,
              })
        }

        <!-- pt-14 clears the FIXED NavBar (h-14). Without it the top of every
             page renders underneath the bar. A bare page has no NavBar, so it
             needs no offset. -->
        <main
          hx-boost="true"
          id="main-content"
          class="relative flex-grow w-full ${props.meta.bare ? "" : "pt-14 lg:pt-0 lg:pl-60"}"
        >
          ${props.children}
        </main>
        <div id="modal-container"></div>
        <!-- The pointed arch the .arch utility clips to (worker/index.css). -->
        <svg width="0" height="0" class="absolute" aria-hidden="true" focusable="false">
          <defs>
            <clipPath id="arch-clip" clipPathUnits="objectBoundingBox">
              <path d="M0,1 V0.34 C0,0.16 0.28,0.05 0.5,0 C0.72,0.05 1,0.16 1,0.34 V1 Z" />
            </clipPath>
          </defs>
        </svg>

        <app-toaster></app-toaster>

        ${
          props.meta.bare
            ? ""
            : html`<footer class="mt-28 border-t-2 lg:ml-60">
                <!-- One line. The spine (or the menu on a phone) already holds
                     the navigation; the footer only says whose shop this is
                     and where to find an order. -->
                <div
                  class="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-x-8 gap-y-3 px-5 py-8 sm:px-8"
                >
                  <p class="font-display text-3xl font-bold leading-none">${props.app.name}</p>
                  <a
                    href="/orders"
                    class="inline-flex h-11 items-center text-base font-semibold italic underline decoration-2 underline-offset-4"
                    >Track an order</a
                  >
                  <p class="text-sm text-muted-foreground">
                    &copy; ${new Date().getFullYear()} ${props.app.name}
                  </p>
                </div>
              </footer>`
        }
      </body>
    </html>
  `;
};
