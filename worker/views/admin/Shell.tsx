// worker/views/admin/Shell.tsx
//
// The frame every admin page sits in: section tabs, a title, and actions.

import type { Child } from "hono/jsx";

const TABS = [
  { href: "/admin", label: "Dashboard", icon: "layout-dashboard" },
  { href: "/admin/products", label: "Products", icon: "armchair" },
  { href: "/admin/orders", label: "Orders", icon: "package" },
];

export const AdminShell = ({
  title,
  children,
  actions,
  back,
  current,
}: {
  title: string;
  children?: Child;
  actions?: Child;
  back?: { href: string; label: string };
  /** Which tab is active; defaults from `back` or the title. */
  current?: string;
}) => {
  const active = current ?? back?.href ?? TABS.find((t) => t.label === title)?.href ?? "/admin";
  return (
    <div class="mx-auto max-w-7xl space-y-6 px-4 pt-8 pb-12 sm:px-6 animate-in fade-in duration-300">
      <nav
        class="-mx-4 flex gap-1 overflow-x-auto border-b-2 px-4 sm:mx-0 sm:px-0"
        aria-label="Admin sections"
      >
        {TABS.map((t) => (
          <a
            href={t.href}
            aria-current={t.href === active ? "page" : undefined}
            class={`inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors ${
              t.href === active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <i data-lucide={t.icon} class="h-4 w-4"></i>
            {t.label}
          </a>
        ))}
      </nav>
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="space-y-1">
          {back ? (
            <a
              href={back.href}
              class="inline-flex h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <i data-lucide="arrow-left" class="h-4 w-4"></i> {back.label}
            </a>
          ) : null}
          <h1 class="text-3xl">{title}</h1>
        </div>
        {actions ? <div class="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
};
