// worker/config/catalogue.ts
//
// The shop's seeded piece, with its own page design (worker/designs/).
// `npm run seed:local` loads it into the local database; `scripts/seed.ts`
// can load it remotely too. It is also the starting point for a new product
// in the admin.
//
// Coordinates: millimetres, y up from the floor, x/z centred. Each model's
// components fill its standard size exactly (tests/furniture.test.ts checks).

import type { ProductData } from "../services/product-form";
import type { Options, Part } from "../schema/furniture.config";

export const TIMBERS: Options[number] = {
  id: "timber",
  label: "Timber",
  paints: "body",
  choices: [
    {
      id: "oak",
      label: "European oak",
      description: "Pale gold, strong open grain",
      priceCents: 0,
      timberMultiplier: 1,
      leadDays: 0,
      color: "#c49a6c",
    },
    {
      id: "ash",
      label: "Ash",
      description: "Light and lively, fine figure",
      priceCents: 0,
      timberMultiplier: 0.9,
      leadDays: 0,
      color: "#dcc7a1",
    },
    {
      id: "walnut",
      label: "Black walnut",
      description: "Deep brown, slow to source",
      priceCents: 0,
      timberMultiplier: 1.7,
      leadDays: 7,
      color: "#6b4a35",
    },
  ],
};

export const FINISHES: Options[number] = {
  id: "finish",
  label: "Finish",
  choices: [
    {
      id: "oil",
      label: "Hard-wax oil",
      description: "Matte, easy to refresh at home",
      priceCents: 0,
      timberMultiplier: 1,
      leadDays: 0,
    },
    {
      id: "soap",
      label: "Soap finish",
      description: "Raw-looking, very pale",
      priceCents: 6000,
      timberMultiplier: 1,
      leadDays: 2,
    },
    {
      id: "lacquer",
      label: "Satin lacquer",
      description: "Most protective, for busy homes",
      priceCents: 12000,
      timberMultiplier: 1,
      leadDays: 3,
    },
  ],
};
// ---------------------------------------------------------------------------
// A console: a narrow top on four legs, aprons under the top, and a low shelf
// on two rails that runs past the legs at each end. The real piece's legs
// splay outward both ways; boxes cannot lean, so this model stands them
// straight until a Blender GLB is uploaded.
// ---------------------------------------------------------------------------
const consoleParts: Part[] = [
  {
    name: "top",
    label: "Top",
    shape: "box",
    size: [1100, 25, 300],
    position: [0, 787.5, 0],
    material: "body",
    resize: {},
  },
  ...[
    [440, 110],
    [-440, 110],
    [440, -110],
    [-440, -110],
  ].map(([x, z], i): Part => ({
    name: `leg_${i + 1}`,
    label: "Leg",
    shape: "box",
    size: [40, 775, 40],
    position: [x, 387.5, z],
    material: "body",
    resize: {},
  })),
  ...[105, -105].map((z, i): Part => ({
    name: `apron_long_${i + 1}`,
    label: "Long apron",
    shape: "box",
    size: [840, 70, 20],
    position: [0, 740, z],
    material: "body",
    resize: {},
  })),
  ...[440, -440].map((x, i): Part => ({
    name: `apron_short_${i + 1}`,
    label: "Short apron",
    shape: "box",
    size: [20, 70, 180],
    position: [x, 740, 0],
    material: "body",
    resize: {},
  })),
  ...[105, -105].map((z, i): Part => ({
    name: `shelf_rail_${i + 1}`,
    label: "Shelf rail",
    shape: "box",
    size: [840, 50, 20],
    position: [0, 185, z],
    material: "body",
    resize: {},
  })),
  {
    name: "shelf",
    label: "Lower shelf",
    shape: "box",
    size: [1000, 20, 260],
    position: [0, 220, 0],
    material: "body",
    resize: {},
  },
];
export const CATALOGUE: ProductData[] = [
  {
    name: "Splay Console",
    slug: "splay-console",
    category: "tables",
    status: "published",
    availability: "made_to_order",
    summary: "A solid oak console with splayed legs and a low shelf.",
    description: "",
    leadDaysStandard: 21,
    leadDaysCustom: 35,
    sortOrder: 0,
    prompt: null,
    dimensions: {
      width: { standard: 1100, min: 800, max: 1600, step: 10 },
      height: { standard: 800, min: 700, max: 900, step: 5 },
      depth: { standard: 300, min: 250, max: 400, step: 10 },
    },
    model: { parts: consoleParts },
    // Placeholder prices, to be set in the admin.
    pricing: {
      baseCents: 38_000,
      timberPerCubicMetreCents: 650_000,
      areaPerSquareMetreCents: 8_000,
      labourPerCentimetreCents: 300,
      customSurchargeCents: 12_000,
      roundToCents: 1000,
    },
    options: [TIMBERS, FINISHES],
    design: {
      id: "splay",
      headline: "Leans out. Stands firm.",
      intro:
        "Solid oak, legs splayed both ways, a low shelf running past them. Built to fit your wall.",
    },
  },
];

/** The admin's blank form: the first example, as a draft, with its copy cleared. */
export const blankProduct = (): ProductData => ({
  ...CATALOGUE[0],
  name: "",
  slug: "",
  status: "draft",
  summary: "",
  description: "",
  sortOrder: 0,
  design: {
    id: "draft",
    headline: "",
    intro: "",
  },
});
