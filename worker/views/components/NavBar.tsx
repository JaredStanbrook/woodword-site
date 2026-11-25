import { html } from "hono/html";
import { PropsUser } from "@server/schema/auth.schema";

// --- CONFIGURATION ---
/**
 * Nav links per role. A user sees the union of the lists for every role they
 * hold, de-duplicated by href. `default` is what signed-out visitors get.
 *
 * This is the main thing to edit when you add a feature area to a new site.
 */
const menuConfig: Record<string, Array<{ to: string; name: string }>> = {
  default: [
    { to: "/", name: "The collection" },
    { to: "/made-to-measure", name: "Made to measure" },
    { to: "/orders", name: "Track an order" },
  ],
  user: [
    { to: "/", name: "The collection" },
    { to: "/made-to-measure", name: "Made to measure" },
    { to: "/account", name: "Your orders" },
  ],
  admin: [
    { to: "/", name: "The collection" },
    { to: "/admin", name: "Dashboard" },
    { to: "/admin/products", name: "Products" },
    { to: "/admin/orders", name: "Orders" },
    { to: "/admin/access", name: "Access links" },
    { to: "/admin/logs", name: "System logs" },
  ],
};

// --- COMPONENTS ---

// --- MAIN NAVBAR ---

interface NavBarProps {
  appName: string;
  user?: PropsUser | null;
  currentPath?: string;
  cartCount?: number;
}

const getMenuItems = (user: PropsUser | null | undefined) => {
  const items: { to: string; name: string }[] = [];
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
 * The site's navigation is a book spine: a night-dark column down the left
 * on large screens, a bar across the top on small ones. It stays night in
 * both themes, so the brand reads the same by day.
 */
export const NavBar = ({ appName, user, currentPath, cartCount = 0 }: NavBarProps) => {
  const menuItems = getMenuItems(user);
  const isActive = (to: string) =>
    to === "/" || to === "/admin" ? currentPath === to : Boolean(currentPath?.startsWith(to));
  const cartLabel =
    cartCount > 0 ? `Cart, ${cartCount} piece${cartCount === 1 ? "" : "s"}` : "Cart, empty";

  const link = (item: { to: string; name: string }, big = false) => html`
    <a
      href="${item.to}"
      aria-current="${isActive(item.to) ? "page" : "false"}"
      class="group flex min-h-11 items-center gap-3 px-6 ${big ? "text-xl" : "text-lg"} transition-colors ${
        isActive(item.to)
          ? "text-sidebar-foreground"
          : "text-sidebar-foreground/65 hover:text-sidebar-foreground"
      }"
    >
      <span
        class="h-1.5 w-1.5 shrink-0 rotate-45 ${isActive(item.to) ? "bg-gilt" : "bg-transparent group-hover:bg-gilt/50"}"
        aria-hidden="true"
      ></span>
      ${item.name}
    </a>
  `;

  return html`
    <!-- Small screens: a bar across the top. -->
    <header
      class="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between bg-sidebar px-3 text-sidebar-foreground lg:hidden"
    >
      ${Wordmark({ appName, size: "sm" })}
      <div class="flex items-center">
        <a
          href="/cart"
          aria-label="${cartLabel}"
          class="relative inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-sidebar-accent"
        >
          <i data-lucide="shopping-bag" class="h-5 w-5"></i>
          ${
            cartCount > 0
              ? html`<span
                  class="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-gilt px-1 text-[0.65rem] font-semibold leading-none text-sidebar tabular-nums"
                  aria-hidden="true"
                  >${cartCount > 99 ? "99+" : cartCount}</span
                >`
              : ""
          }
        </a>
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

    <!-- Large screens: the spine. -->
    <aside
      class="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-sidebar py-8 text-sidebar-foreground lg:flex"
      aria-label="Site"
    >
      <div class="px-6">${Wordmark({ appName, size: "lg" })}</div>
      <p class="mt-2 px-6 text-sm italic leading-snug text-sidebar-foreground/60">
        Furniture, made to measure
      </p>
      <nav class="mt-8 flex flex-col" aria-label="Main">
        ${menuItems.map((item) => link(item))}
        ${link({ to: "/cart", name: cartCount > 0 ? `Cart (${cartCount})` : "Cart" })}
      </nav>
      <div class="mt-auto">
        <div class="flex items-center justify-between gap-2 pl-6 pr-4">
          ${
            user
              ? html`<div class="min-w-0">
                  <a
                    href="/account"
                    class="block truncate text-base text-sidebar-foreground/80 hover:text-sidebar-foreground"
                    >${user.displayName || user.email}</a
                  >
                  <div class="flex gap-3 text-sm">
                    <a
                      href="/profile"
                      class="inline-flex h-11 items-center text-sidebar-foreground/60 hover:text-sidebar-foreground"
                      >Security</a
                    >
                    <button
                      hx-post="/web/auth/logout"
                      class="inline-flex h-11 items-center text-sidebar-foreground/60 hover:text-sidebar-foreground"
                    >
                      Sign out
                    </button>
                  </div>
                </div>`
              : html`<a
                  href="/login"
                  class="inline-flex h-11 items-center text-base text-sidebar-foreground/80 hover:text-sidebar-foreground"
                  >Sign in</a
                >`
          }
        </div>
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
        class="relative -translate-y-full bg-sidebar pb-4 text-sidebar-foreground shadow-lg transition-transform duration-300 ease-out motion-reduce:transition-none"
      >
        <div class="flex h-14 items-center justify-between px-3">
          ${Wordmark({ appName, size: "sm" })}
          <button
            id="mobile-menu-close"
            class="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-sidebar-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            aria-label="Close menu"
          >
            <i data-lucide="x" class="h-6 w-6"></i>
          </button>
        </div>
        <nav class="mt-2 flex flex-col" aria-label="Main">
          ${menuItems.map((item) => link(item, true))}
          ${link({ to: "/cart", name: cartCount > 0 ? `Cart (${cartCount})` : "Cart" }, true)}
          ${
            user
              ? html`${link({ to: "/profile", name: "Sign-in and security" }, true)}
                  <button
                    hx-post="/web/auth/logout"
                    class="flex min-h-11 items-center gap-3 px-6 text-xl text-sidebar-foreground/65"
                  >
                    <span class="h-1.5 w-1.5 shrink-0" aria-hidden="true"></span>Sign out
                  </button>`
              : link({ to: "/login", name: "Sign in" }, true)
          }
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
