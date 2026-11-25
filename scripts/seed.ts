// scripts/seed.ts
//
// Loads the shop's piece from worker/config/catalogue.ts into D1.
//
//   npm run seed:local                 local database, published
//   npm run seed -- --remote               production database, as drafts
//   npm run seed -- --remote --published   production database, live in the shop
//
// Skips any product whose slug already exists, so it is safe to run twice
// and never overwrites a product someone has edited.

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CATALOGUE } from "../worker/config/catalogue";

const args = process.argv.slice(2);
const remote = args.includes("--remote");
// Remote seeding makes drafts unless asked to publish: a production shop
// should not grow pieces with placeholder prices by accident.
const drafts = args.includes("--drafts") || (remote && !args.includes("--published"));

const q = (v: unknown) =>
  v === null || v === undefined
    ? "NULL"
    : typeof v === "number"
      ? String(v)
      : `'${String(v).replace(/'/g, "''")}'`;
const json = (v: unknown) => q(JSON.stringify(v));

const now = new Date().toISOString();
const statements = CATALOGUE.map((p) => {
  const status = drafts ? "draft" : p.status;
  const columns = {
    slug: q(p.slug),
    name: q(p.name),
    category: q(p.category),
    status: q(status),
    availability: q(p.availability),
    summary: q(p.summary),
    description: q(p.description),
    dimensions: json(p.dimensions),
    model: json(p.model),
    pricing: json(p.pricing),
    options: json(p.options),
    design: json(p.design),
    lead_days_standard: q(p.leadDaysStandard),
    lead_days_custom: q(p.leadDaysCustom),
    images: json([]),
    sort_order: q(p.sortOrder),
    published_at: status === "published" ? q(now) : "NULL",
    updated_at: q(now),
  };
  return `INSERT INTO product (${Object.keys(columns).join(", ")}) SELECT ${Object.values(columns).join(", ")} WHERE NOT EXISTS (SELECT 1 FROM product WHERE slug = ${q(p.slug)});`;
});

const file = join(mkdtempSync(join(tmpdir(), "seed-")), "seed.sql");
writeFileSync(file, statements.join("\n") + "\n");

console.log(
  `Seeding ${CATALOGUE.length} products ${remote ? "REMOTELY" : "locally"}${drafts ? " as drafts" : ""}…`,
);
execFileSync(
  "npx",
  ["wrangler", "d1", "execute", "DB", remote ? "--remote" : "--local", `--file=${file}`],
  {
    stdio: "inherit",
  },
);
