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

/**
 * The Mooihout mark: a table seen square-on, its legs and V-brace forming
 * an M, over a dimension line with architect's ticks. The same drawing as
 * public/brand/; drawn in currentColor so it follows its surroundings.
 */
export const GrainMark = (cls = "h-8 w-7") => html`
  <svg viewBox="10 10 80 91" class="${cls} shrink-0" aria-hidden="true" fill="currentColor">
    <rect x="12" y="12" width="76" height="15" />
    <rect x="17" y="26.4" width="15" height="52.6" />
    <rect x="68" y="26.4" width="15" height="52.6" />
    <polygon points="31.4,26.4 43.5,26.4 50,37.4 56.5,26.4 68.6,26.4 68.6,43 50,72 31.4,43" />
    <path
      d="M17 84V99M83 84V99M17 91.5H83M13.5 95L20.5 88M79.5 95L86.5 88"
      fill="none"
      stroke="currentColor"
      stroke-width="4"
      stroke-linecap="round"
    />
  </svg>
`;

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

/** A gilt double rule: the bands stamped across a book's spine. */
const SpineBand = () => html`
  <div class="flex flex-col gap-[3px] px-6" aria-hidden="true">
    <span class="h-0.5 bg-gilt/70"></span>
    <span class="h-0.5 bg-gilt/35"></span>
  </div>
`;

const Wordmark = ({ appName, size }: { appName: string; size: "lg" | "sm" }) => html`
  <a
    href="/"
    class="inline-flex items-center gap-2.5 font-display font-bold leading-none text-sidebar-foreground ${
      size === "lg" ? "text-[2.6rem]" : "h-11 text-[1.75rem]"
    }"
  >
    <span class="text-gilt">${size === "sm" ? GrainMark() : GrainMark("h-11 w-10")}</span
    ><span>${appName}</span>
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
      <div class="mt-7">${SpineBand()}</div>
      <nav class="mt-5 flex flex-col" aria-label="Main">
        ${menuItems.map((item) => link(item))}
        ${link({ to: "/cart", name: cartCount > 0 ? `Cart (${cartCount})` : "Cart" })}
      </nav>
      <div class="mt-auto">
        ${SpineBand()}
        <div class="mt-4 flex items-center justify-between gap-2 pl-6 pr-4">
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

    <div
      id="mobile-menu"
      class="fixed inset-0 z-[100] hidden flex-col bg-sidebar text-sidebar-foreground lg:hidden"
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
      <div class="mt-4">${SpineBand()}</div>
      <nav class="mt-4 flex flex-col" aria-label="Main">
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
      <div class="mt-auto pb-8">${SpineBand()}</div>
    </div>

    <script>
      (function () {
        const menu = document.getElementById("mobile-menu");
        const open = () => {
          menu.classList.remove("hidden");
          menu.classList.add("flex");
          document.body.style.overflow = "hidden";
        };
        const close = () => {
          menu.classList.add("hidden");
          menu.classList.remove("flex");
          document.body.style.overflow = "";
        };
        document.getElementById("mobile-menu-toggle")?.addEventListener("click", open);
        document.getElementById("mobile-menu-close")?.addEventListener("click", close);
        menu.addEventListener("click", (e) => {
          if (e.target.closest("a")) close();
        });
      })();
    </script>
  `;
};
