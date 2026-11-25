import { html } from "hono/html";
import { PropsUser } from "@server/schema/auth.schema";
import type { Category } from "@server/schema/furniture.config";
import { formatPrice } from "@server/lib/money";
import { CATEGORY_LABELS } from "@views/shop/parts";

type Item = { to: string; name: string };

// --- CONFIGURATION ---
/**
 * The nav has two groups, like a shop's: first what is for sale (built from
 * the categories with something in them), then the pages about buying it.
 * These are the second group, per role. A user sees the union of the lists
 * for every role they hold, de-duplicated by href. `default` is what
 * signed-out visitors get.
 *
 * This is the main thing to edit when you add a feature area to a new site.
 */
const menuConfig: Record<string, Item[]> = {
  default: [
    { to: "/made-to-measure", name: "Made to measure" },
    { to: "/orders", name: "Track an order" },
  ],
  user: [
    { to: "/made-to-measure", name: "Made to measure" },
    { to: "/account", name: "Your orders" },
  ],
  admin: [
    { to: "/admin", name: "Dashboard" },
    { to: "/admin/products", name: "Products" },
    { to: "/admin/orders", name: "Orders" },
    { to: "/admin/access", name: "Access links" },
    { to: "/admin/logs", name: "System logs" },
  ],
};

interface NavBarProps {
  appName: string;
  user?: PropsUser | null;
  /** Path and query, so a category link can show it is the current page. */
  currentPath?: string;
  cart?: { count: number; totalCents: number };
  categories?: Category[];
  locale: string;
  currency: string;
}

const infoItems = (user: PropsUser | null | undefined) => {
  const items: Item[] = [];
  const seen = new Set<string>();
  for (const role of user?.roles ?? []) {
    for (const item of menuConfig[role] ?? []) {
      if (seen.has(item.to)) continue;
      seen.add(item.to);
      items.push(item);
    }
  }
  return items.length > 0 ? items : menuConfig.default;
};

/** One kind of piece: the collection itself. Several: one link for each. */
const shopItems = (categories: Category[]): Item[] =>
  categories.length > 1
    ? categories.map((cat) => ({ to: `/?category=${cat}`, name: CATEGORY_LABELS[cat] }))
    : [{ to: "/", name: "The collection" }];

const Wordmark = ({ appName, size }: { appName: string; size: "lg" | "sm" }) => html`
  <a
    href="/"
    class="inline-flex items-center font-display font-bold leading-none text-sidebar-foreground ${
      size === "lg" ? "text-[2.6rem]" : "h-11 text-[1.75rem]"
    }"
  >
    ${appName}
  </a>
`;

/**
 * The site's navigation: a night-dark column down the left on large
 * screens, a bar across the top on small ones whose menu drops down from it.
 * Name first, then the cart and what it comes to, then what is for sale,
 * then the pages about buying it.
 */
export const NavBar = ({
  appName,
  user,
  currentPath,
  cart = { count: 0, totalCents: 0 },
  categories = [],
  locale,
  currency,
}: NavBarProps) => {
  const shop = shopItems(categories);
  const info = infoItems(user);
  const isActive = (to: string) =>
    to === "/" || to === "/admin" || to.includes("?")
      ? currentPath === to
      : Boolean(currentPath?.startsWith(to));
  const total = formatPrice(cart.totalCents, locale, currency);
  const cartLabel =
    cart.count > 0
      ? `Cart, ${cart.count} piece${cart.count === 1 ? "" : "s"}, ${total}`
      : "Cart, empty";

  const CartLink = (cls: string) => html`
    <a
      href="/cart"
      aria-label="${cartLabel}"
      aria-current="${isActive("/cart") ? "page" : "false"}"
      class="inline-flex h-11 items-center gap-2.5 tabular-nums text-sidebar-foreground/85 hover:text-sidebar-foreground ${cls}"
    >
      <span aria-hidden="true">${total}</span>
      <i data-lucide="shopping-bag" class="h-5 w-5"></i>
    </a>
  `;

  const link = (item: Item, cls: string) => html`
    <a
      href="${item.to}"
      aria-current="${isActive(item.to) ? "page" : "false"}"
      class="flex min-h-10 items-center transition-colors ${cls} ${
        isActive(item.to)
          ? "text-sidebar-foreground underline decoration-gilt decoration-2 underline-offset-[6px]"
          : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
      }"
    >
      ${item.name}
    </a>
  `;

  const account = (cls: string) =>
    user
      ? html`${link({ to: "/profile", name: "Sign-in and security" }, cls)}
          <button
            hx-post="/web/auth/logout"
            class="flex min-h-10 items-center text-sidebar-foreground/70 hover:text-sidebar-foreground ${cls}"
          >
            Sign out
          </button>`
      : link({ to: "/login", name: "Sign in" }, cls);

  return html`
    <!-- Small screens: cart, name, menu. -->
    <header
      class="fixed inset-x-0 top-0 z-40 grid h-14 grid-cols-[1fr_auto_1fr] items-center bg-sidebar px-3 text-sidebar-foreground lg:hidden"
    >
      <div>${CartLink("px-1 text-base")}</div>
      ${Wordmark({ appName, size: "sm" })}
      <div class="flex justify-end">
        <button
          id="mobile-menu-toggle"
          class="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-sidebar-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          aria-label="Open menu"
          aria-controls="mobile-menu"
          aria-expanded="false"
        >
          <i data-lucide="menu" class="h-6 w-6"></i>
        </button>
      </div>
    </header>

    <!-- Large screens: the column. -->
    <aside
      class="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col overflow-y-auto bg-sidebar px-6 py-8 text-sidebar-foreground lg:flex"
      aria-label="Site"
    >
      ${Wordmark({ appName, size: "lg" })}
      <div class="mt-10">${CartLink("text-lg")}</div>
      <nav class="mt-6 flex flex-col text-lg" aria-label="Main">
        ${shop.map((item) => link(item, ""))}
        <div class="mt-6 flex flex-col font-semibold">${info.map((item) => link(item, ""))}</div>
      </nav>
      <div class="mt-auto flex flex-col pt-8 text-base">
        ${
          user
            ? html`<a
                href="/account"
                class="block truncate text-sidebar-foreground/85 hover:text-sidebar-foreground"
                >${user.displayName || user.email}</a
              >`
            : ""
        }
        ${account("")}
      </div>
    </aside>

    <!-- Small screens: the menu drops down from the top, only as tall as its
         items; the dimmed page behind it closes it. -->
    <div id="mobile-menu" class="fixed inset-0 z-[100] hidden lg:hidden">
      <div
        data-menu-backdrop
        class="absolute inset-0 bg-sidebar/50 opacity-0 transition-opacity duration-300 motion-reduce:transition-none"
      ></div>
      <div
        data-menu-panel
        class="relative -translate-y-full bg-sidebar pb-6 text-sidebar-foreground shadow-lg transition-transform duration-300 ease-out motion-reduce:transition-none"
      >
        <div class="grid h-14 grid-cols-[1fr_auto_1fr] items-center px-3">
          <div>${CartLink("px-1 text-base")}</div>
          ${Wordmark({ appName, size: "sm" })}
          <div class="flex justify-end">
            <button
              id="mobile-menu-close"
              class="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-sidebar-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              aria-label="Close menu"
            >
              <i data-lucide="x" class="h-6 w-6"></i>
            </button>
          </div>
        </div>
        <nav class="mt-3 flex flex-col items-center text-xl" aria-label="Main">
          ${shop.map((item) => link(item, "min-h-11"))}
          <div class="mt-3 flex flex-col items-center font-semibold">
            ${info.map((item) => link(item, "min-h-11"))}
          </div>
          <div class="mt-3 flex flex-col items-center text-lg">${account("min-h-11")}</div>
        </nav>
      </div>
    </div>

    <script>
      (function () {
        const menu = document.getElementById("mobile-menu");
        const panel = menu.querySelector("[data-menu-panel]");
        const backdrop = menu.querySelector("[data-menu-backdrop]");
        const toggle = document.getElementById("mobile-menu-toggle");
        const open = () => {
          menu.classList.remove("hidden");
          panel.getBoundingClientRect(); // start the slide from above
          panel.classList.remove("-translate-y-full");
          backdrop.classList.remove("opacity-0");
          toggle?.setAttribute("aria-expanded", "true");
          document.body.style.overflow = "hidden";
        };
        const close = () => {
          panel.classList.add("-translate-y-full");
          backdrop.classList.add("opacity-0");
          toggle?.setAttribute("aria-expanded", "false");
          document.body.style.overflow = "";
          const hide = () => menu.classList.add("hidden");
          if (matchMedia("(prefers-reduced-motion: reduce)").matches) hide();
          else panel.addEventListener("transitionend", hide, { once: true });
        };
        toggle?.addEventListener("click", open);
        document.getElementById("mobile-menu-close")?.addEventListener("click", close);
        backdrop.addEventListener("click", close);
        menu.addEventListener("click", (e) => {
          if (e.target.closest("a")) close();
        });
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape" && !menu.classList.contains("hidden")) close();
        });
      })();
    </script>
  `;
};
