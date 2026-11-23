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
 * GrainMark
 * Growth rings around an off-centre heart: the brand mark. Drawn in
 * currentColor and the product token so it follows light and dark.
 */
export const GrainMark = () => html`
  <svg viewBox="0 0 32 32" class="h-7 w-7 shrink-0" aria-hidden="true" fill="none">
    <ellipse cx="16" cy="16" rx="14" ry="13" stroke="currentColor" stroke-width="1.5" />
    <ellipse
      cx="15"
      cy="16.5"
      rx="9.5"
      ry="9"
      stroke="currentColor"
      stroke-width="1.25"
      opacity="0.7"
    />
    <ellipse
      cx="14.2"
      cy="17"
      rx="5.2"
      ry="5"
      stroke="currentColor"
      stroke-width="1"
      opacity="0.5"
    />
    <circle cx="13.6" cy="17.4" r="2" class="fill-gilt" />
  </svg>
`;

/**
 * ThemeToggle
 * Robust logic with large touch targets for mobile.
 */
export const ThemeToggle = () => html`
  <button
    type="button"
    class="theme-toggle-btn inline-flex h-11 w-11 items-center justify-center rounded-full text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
    aria-label="Switch between night, day and your device's setting"
  >
    <i data-theme-icon="light" data-lucide="sun" class="hidden w-5 h-5"></i>
    <i data-theme-icon="dark" data-lucide="moon" class="hidden w-5 h-5"></i>
    <i data-theme-icon="system" data-lucide="laptop" class="hidden w-5 h-5"></i>
  </button>

  <script>
    (function () {
      // 1. GUARD: Prevent script from running twice if component is rendered multiple times
      if (window.__theme_toggle_init) return;
      window.__theme_toggle_init = true;

      const THEMES = ["light", "dark", "system"];
      const STORAGE_KEY = "vite-ui-theme";
      const root = document.documentElement;

      function getButtons() {
        return document.querySelectorAll(".theme-toggle-btn");
      }

      let currentTheme = localStorage.getItem(STORAGE_KEY) || "dark";
      if (!THEMES.includes(currentTheme)) currentTheme = "dark";

      function applyTheme(theme) {
        root.classList.remove(...THEMES);
        if (theme === "system") {
          const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          root.classList.toggle("dark", prefersDark);
        } else {
          root.classList.add(theme);
        }
      }

      function updateIcons(theme) {
        // 2. SYNC: Update icons on ALL buttons (Desktop & Mobile)
        const buttons = getButtons();
        buttons.forEach((btn) => {
          btn.querySelectorAll("[data-theme-icon]").forEach((icon) => {
            icon.classList.toggle("hidden", icon.dataset.themeIcon !== theme);
          });
        });

        // Provided by the client bundle (worker/components/main.ts).
        if (window.renderIcons) window.renderIcons();
      }

      function setTheme(theme) {
        localStorage.setItem(STORAGE_KEY, theme);
        currentTheme = theme;
        applyTheme(theme);
        updateIcons(theme);
      }

      document.addEventListener("DOMContentLoaded", () => {
        setTheme(currentTheme);

        // 3. EVENT DELEGATION: Listen on document to catch clicks on any toggle button
        document.addEventListener("click", (e) => {
          const btn = e.target.closest(".theme-toggle-btn");
          if (!btn) return;

          const nextIdx = (THEMES.indexOf(currentTheme) + 1) % THEMES.length;
          setTheme(THEMES[nextIdx]);
        });
      });

      // hx-boost swaps the body without a new DOMContentLoaded, so the
      // fresh toggle buttons would otherwise show no icon at all.
      document.addEventListener("htmx:afterSettle", () => updateIcons(currentTheme));

      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        if (currentTheme === "system") applyTheme("system");
      });
    })();
  </script>
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
    <span class="h-px bg-gilt/70"></span>
    <span class="h-px bg-gilt/35"></span>
  </div>
`;

const Wordmark = ({ appName, size }: { appName: string; size: "lg" | "sm" }) => html`
  <a
    href="/"
    class="inline-flex items-center gap-2.5 font-display leading-none text-sidebar-foreground ${
      size === "lg" ? "text-[2.6rem]" : "h-11 text-[1.75rem]"
    }"
  >
    ${size === "sm" ? GrainMark() : ""}<span>${appName}</span>
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
          ${ThemeToggle()}
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
      <div class="mt-auto pb-8">
        ${SpineBand()}
        <div class="mt-3 flex items-center justify-between px-6">
          <span class="text-base text-sidebar-foreground/70">Night or day</span>
          ${ThemeToggle()}
        </div>
      </div>
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
