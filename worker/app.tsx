import { Hono } from "hono";

import { globalRenderer } from "./middleware/renderer.middleware.tsx";
import { requireUser, requireRole } from "./middleware/guard.middleware.ts";

import { ProfilePage } from "./views/pages/Profile";
import type { SafeUser } from "./schema/auth.schema.ts";

import { apiAuth } from "./routes/api/auth";
import { analyticsApi } from "./routes/api/analytics";
import { webAuth } from "./routes/web/auth";
import { logsRoute } from "./routes/admin/logs";
import { analyticsAdminRoute } from "./routes/admin/analytics";
import { accessAdminRoute } from "./routes/admin/access.tsx";
import { accessRoute } from "./routes/access.tsx";
import { cookiesRoute } from "./routes/cookies";
import { accessGate } from "./middleware/access-gate.middleware.ts";
import { shopRoute } from "./routes/shop.tsx";
import { checkoutRoute, stripeWebhook } from "./routes/checkout.tsx";
import { productsAdminRoute } from "./routes/admin/products.tsx";
import { dashboardRoute, ordersAdminRoute } from "./routes/admin/orders.tsx";
import { seoRoute } from "./routes/seo";
import devRouter from "./routes/dev.tsx";

import type { AppEnv } from "./types";

// ==========================================
// 1. ADMIN SUB-APP (RBAC protected)
// ==========================================
// Everything mounted here is admin-only. Add feature routers below rather
// than re-declaring the role check on each one.
const admin = new Hono<AppEnv>();
admin.use("*", requireRole("admin"));
admin.route("/", dashboardRoute);
admin.route("/products", productsAdminRoute);
admin.route("/orders", ordersAdminRoute);
admin.route("/logs", logsRoute);
admin.route("/analytics", analyticsAdminRoute);
admin.route("/access", accessAdminRoute);

// ==========================================
// 2. MAIN APP
// ==========================================
const app = new Hono<AppEnv>()
  // robots.txt and sitemap.xml. Before the renderer, since neither is HTML.
  .route("/", seoRoute)

  // Database inspector. Dev-only — see routes/dev.tsx.
  .route("/dev", devRouter)

  // Global renderer (wraps SSR responses in Layout).
  .use("*", globalRenderer)

  // ACCESS_GATE: off by default. When on, every route below needs an
  // invitation link or an admin session, except the few the middleware lists
  // as open (sign-in, the link itself, /gone). See access-gate.middleware.ts.
  .use("*", accessGate)

  // Invitation links (/a/:token) and the page the gate sends everyone else to.
  .route("/", accessRoute)

  // The cookie policy, and where the banner saves a visitor's choice.
  .route("/", cookiesRoute)

  .route("/admin", admin)

  // The shop: gallery (home), product pages, saved designs, cart, media.
  .route("/", shopRoute)

  // Checkout, order pages and the customer's account.
  .route("/", checkoutRoute)

  // Login, register, logout.
  .route("/", webAuth)

  // Any signed-in user can view their own profile.
  .get("/profile", requireUser, (c) => {
    const { auth } = c.var;

    // requireUser guarantees auth.user exists.
    const props = {
      user: auth.user as SafeUser,
      config: c.var.authConfig,
    };
    return c.render(<ProfilePage {...props} />, {
      title: "Profile",
    });
  })

  // ==========================================
  // 3. JSON API
  // ==========================================
  .basePath("/api")
  .route("/auth", apiAuth)
  // Stripe posts payment events here: /api/stripe/webhook.
  .route("/stripe", stripeWebhook)
  // Page views from visitors who allowed performance cookies.
  .route("/analytics", analyticsApi);

export type AppType = typeof app;
export default app;
