import { users, authLogs } from "../../worker/schema/auth.schema";
import { product } from "../../worker/schema/product.schema";
import {
  cartItem,
  orderEvent,
  orderItem,
  orders,
  savedDesign,
} from "../../worker/schema/shop.schema";
import { CATALOGUE } from "../../worker/config/catalogue";

/**
 * A hand-rolled stand-in for a Drizzle D1 client.
 *
 * It is deliberately dumb: it records which table a query selected `from` and
 * replays a fixture array. That is enough to smoke-test that every page
 * renders, without a real D1 binding. For query-shape assertions, use
 * `wrangler d1 execute --local` against a real migration instead.
 */

export type MockData = {
  users: any[];
  products: any[];
  orders: any[];
  orderItems: any[];
  orderEvents: any[];
  cartItems: any[];
  authLogs: any[];
};

type QueryState = {
  fields?: Record<string, any> | undefined;
  fromTable?: unknown;
};

const resolveSelect = (data: MockData, state: QueryState) => {
  const fields = state.fields || {};

  // Joined selections are keyed by alias — match on the alias set.
  if ("log" in fields && "user" in fields) {
    return data.authLogs.map((log) => ({ log, user: data.users[0] ?? null }));
  }

  // Aggregates (cart count, dashboard totals): one plausible row.
  if ("count" in fields || "n" in fields || "cents" in fields) {
    return [{ count: 1, n: 1, cents: 0, status: "published", month: "2026-01" }];
  }

  // Joined selections keyed by alias.
  if ("item" in fields && "product" in fields) {
    return data.cartItems.map((item) => ({ item, product: data.products[0] }));
  }
  if ("design" in fields && "product" in fields) return [];

  switch (state.fromTable) {
    case users:
      return data.users;
    case product:
      return data.products;
    case orders:
      return data.orders;
    case orderItem:
      return data.orderItems;
    case orderEvent:
      return data.orderEvents;
    case cartItem:
      return data.cartItems;
    case savedDesign:
      return [];
    case authLogs:
      return data.authLogs;
    default:
      return [];
  }
};

const createQuery = (data: MockData, fields?: Record<string, any>) => {
  const state: QueryState = { fields };
  const query: any = {
    from(table: unknown) {
      state.fromTable = table;
      return query;
    },
    where: () => query,
    innerJoin: () => query,
    leftJoin: () => query,
    groupBy: () => query,
    orderBy: () => query,
    limit: () => query,
    offset: () => query,
    get() {
      return Promise.resolve(resolveSelect(data, state)[0]);
    },
    returning() {
      return Promise.resolve(resolveSelect(data, state));
    },
    then(resolve: any, reject: any) {
      return Promise.resolve(resolveSelect(data, state)).then(resolve, reject);
    },
  };
  return query;
};

export const createFakeDb = (data: MockData) => ({
  select(fields?: Record<string, any>) {
    return createQuery(data, fields);
  },
  insert() {
    return {
      values() {
        return {
          returning() {
            return Promise.resolve([]);
          },
          then(resolve: any, reject: any) {
            return Promise.resolve([]).then(resolve, reject);
          },
        };
      },
    };
  },
  update() {
    return {
      set() {
        return {
          where() {
            return Promise.resolve([]);
          },
        };
      },
    };
  },
  delete() {
    return {
      where() {
        return Promise.resolve([]);
      },
    };
  },
  /** Each query resolves as it would on its own, as `db.batch` returns them. */
  batch(queries: PromiseLike<unknown>[]) {
    return Promise.all(queries);
  },
});

export const createMockData = (): MockData => {
  const now = new Date().toISOString();
  const userId = "user-1";

  return {
    users: [
      {
        id: userId,
        username: "testuser",
        email: "test@example.com",
        displayName: "Test User",
        totpEnabled: false,
        isActive: true,
        emailVerified: true,
        phoneNumber: null,
        phoneVerified: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: now,
        createdAt: now,
        updatedAt: now,
        roles: ["admin"],
        permissions: ["orders.read", "designs.read", "designs.create", "designs.delete"],
      },
    ],
    products: CATALOGUE.map((p, i) => ({
      ...p,
      id: i + 1,
      images: [],
      modelKey: null,
      blendKey: null,
      modelVersion: 1,
      publishedAt: now,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    })),
    orders: [
      {
        id: 1,
        ref: "HW-TEST01",
        accessToken: "token",
        userId,
        status: "in_production",
        paymentStatus: "paid",
        name: "Test User",
        email: "test@example.com",
        phone: null,
        address: { line1: "1 Bench Lane", city: "Perth", postcode: "6000", country: "Australia" },
        deliveryMethod: "standard",
        deliveryLabel: "Delivered to your door",
        notes: null,
        currency: "AUD",
        subtotalCents: 129000,
        deliveryCents: 9500,
        totalCents: 138500,
        leadDays: 21,
        stripeSessionId: null,
        stripePaymentIntent: null,
        paidAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ],
    orderItems: [],
    orderEvents: [
      {
        id: 1,
        orderId: 1,
        status: "received",
        note: "Payment confirmed",
        actorId: null,
        createdAt: now,
      },
    ],
    cartItems: [
      {
        id: 1,
        cartId: "cart-cart-cart-cart-cart-1",
        productId: 1,
        selection: { width: 2000, height: 750, depth: 900, options: { timber: "walnut" } },
        quantity: 2,
        createdAt: now,
        updatedAt: now,
      },
    ],
    authLogs: [
      {
        id: "log-1",
        userId,
        event: "login.success",
        method: "password",
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
        metadata: null,
        createdAt: now,
      },
    ],
  };
};
