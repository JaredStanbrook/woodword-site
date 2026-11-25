// worker/config/catalogue.ts
//
// The example pieces, each with its own page design (worker/designs/). `npm run seed:local` loads them
// into the local database so the shop has something in it while you build;
// `scripts/seed.ts` can load them remotely too, as drafts, for the owner to
// edit or delete. The first one is also the starting point for a new product
// in the admin.
//
// Coordinates: millimetres, y up from the floor, x/z centred. Each model's
// components fill its standard size exactly (tests/furniture.test.ts checks).

import type { ProductData } from "../services/product-form";
import type { Options, Part } from "../schema/furniture.config";

const TIMBERS: Options[number] = {
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

const FINISHES: Options[number] = {
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
// A dining table: top, four legs, aprons. Legs keep their section and move
// out with the corners; the aprons span between them.
// ---------------------------------------------------------------------------
const tableParts: Part[] = [
  {
    name: "top",
    label: "Tabletop",
    shape: "box",
    size: [1800, 30, 900],
    position: [0, 735, 0],
    material: "body",
    resize: {},
  },
  ...[
    [820, 370],
    [-820, 370],
    [820, -370],
    [-820, -370],
  ].map(([x, z], i): Part => ({
    name: `leg_${i + 1}`,
    label: "Leg",
    shape: "box",
    size: [60, 720, 60],
    position: [x, 360, z],
    material: "body",
    resize: {},
  })),
  ...[389, -389].map((z, i): Part => ({
    name: `apron_long_${i + 1}`,
    label: "Long apron",
    shape: "box",
    size: [1580, 90, 22],
    position: [0, 675, z],
    material: "body",
    resize: {},
  })),
  ...[839, -839].map((x, i): Part => ({
    name: `apron_short_${i + 1}`,
    label: "Short apron",
    shape: "box",
    size: [22, 90, 680],
    position: [x, 675, 0],
    material: "body",
    resize: {},
  })),
];

// ---------------------------------------------------------------------------
// A sideboard: carcass, plinth, shelf, two doors meeting in the middle, and
// handles that stay by the meeting line however wide it gets.
// ---------------------------------------------------------------------------
const cabinetParts: Part[] = [
  {
    name: "plinth",
    label: "Plinth",
    shape: "box",
    size: [1560, 80, 410],
    position: [0, 40, 0],
    material: "accent",
    resize: {},
  },
  {
    name: "bottom",
    label: "Bottom panel",
    shape: "box",
    size: [1600, 20, 450],
    position: [0, 90, 0],
    material: "body",
    resize: {},
  },
  {
    name: "top",
    label: "Top panel",
    shape: "box",
    size: [1600, 25, 450],
    position: [0, 787.5, 0],
    material: "body",
    resize: {},
  },
  {
    name: "side_left",
    label: "Side",
    shape: "box",
    size: [20, 675, 450],
    position: [-790, 437.5, 0],
    material: "body",
    resize: {},
  },
  {
    name: "side_right",
    label: "Side",
    shape: "box",
    size: [20, 675, 450],
    position: [790, 437.5, 0],
    material: "body",
    resize: {},
  },
  {
    name: "back",
    label: "Back panel",
    shape: "box",
    size: [1560, 675, 12],
    position: [0, 437.5, -219],
    material: "body",
    resize: {},
  },
  {
    name: "shelf",
    label: "Shelf",
    shape: "box",
    size: [1560, 18, 400],
    position: [0, 437.5, 0],
    material: "body",
    resize: { y: "spread" },
  },
  {
    name: "door_left",
    label: "Door",
    shape: "box",
    size: [780, 671, 20],
    position: [-390, 437.5, 215],
    material: "body",
    resize: {},
  },
  {
    name: "door_right",
    label: "Door",
    shape: "box",
    size: [780, 671, 20],
    position: [390, 437.5, 215],
    material: "body",
    resize: {},
  },
  {
    name: "handle_left",
    label: "Handle",
    shape: "cylinder",
    size: [14, 160, 6],
    position: [-40, 470, 222],
    material: "metal",
    resize: { x: "fixed", y: "spread" },
  },
  {
    name: "handle_right",
    label: "Handle",
    shape: "cylinder",
    size: [14, 160, 6],
    position: [40, 470, 222],
    material: "metal",
    resize: { x: "fixed", y: "spread" },
  },
];

// ---------------------------------------------------------------------------
// Open shelving: two uprights, five shelves. The bottom and top shelves stay
// at the ends; the middle three spread evenly as it gets taller.
// ---------------------------------------------------------------------------
const shelfParts: Part[] = [
  {
    name: "upright_left",
    label: "Upright",
    shape: "box",
    size: [24, 1800, 350],
    position: [-488, 900, 0],
    material: "body",
    resize: {},
  },
  {
    name: "upright_right",
    label: "Upright",
    shape: "box",
    size: [24, 1800, 350],
    position: [488, 900, 0],
    material: "body",
    resize: {},
  },
  ...[60, 492, 924, 1356, 1788].map((y, i, all): Part => ({
    name: `shelf_${i + 1}`,
    label: "Shelf",
    shape: "box",
    size: [952, 24, 330],
    position: [0, y, -10],
    material: "body",
    resize: i === 0 || i === all.length - 1 ? {} : { y: "spread" },
  })),
  ...[300, 1500].map((y, i): Part => ({
    name: `rail_${i + 1}`,
    label: "Back rail",
    shape: "box",
    size: [952, 60, 18],
    position: [0, y, -166],
    material: "accent",
    resize: { y: "spread" },
  })),
];

// ---------------------------------------------------------------------------
// A bench: seat, two slab ends, a stretcher that keeps its section.
// ---------------------------------------------------------------------------
const benchParts: Part[] = [
  {
    name: "seat",
    label: "Seat",
    shape: "box",
    size: [1400, 40, 380],
    position: [0, 430, 0],
    material: "body",
    resize: {},
  },
  {
    name: "end_left",
    label: "Slab end",
    shape: "box",
    size: [40, 410, 320],
    position: [-600, 205, 0],
    material: "body",
    resize: {},
  },
  {
    name: "end_right",
    label: "Slab end",
    shape: "box",
    size: [40, 410, 320],
    position: [600, 205, 0],
    material: "body",
    resize: {},
  },
  {
    name: "stretcher",
    label: "Stretcher",
    shape: "box",
    size: [1160, 60, 40],
    position: [0, 150, 0],
    material: "accent",
    resize: { z: "fixed" },
  },
];

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
    name: "Nord Dining Table",
    slug: "nord-dining-table",
    category: "tables",
    status: "published",
    availability: "made_to_order",
    summary: "A solid-wood dining table with a thick top and square legs, drawn to seat six.",
    description:
      "The top is edge-jointed from wide boards and left thick, so it can be resurfaced for decades. Legs are mortised into the aprons and drawbored, so the frame stays tight without metal.",
    leadDaysStandard: 21,
    leadDaysCustom: 35,
    sortOrder: 1,
    prompt: null,
    dimensions: {
      width: { standard: 1800, min: 1200, max: 2400, step: 10 },
      height: { standard: 750, min: 700, max: 800, step: 5 },
      depth: { standard: 900, min: 700, max: 1100, step: 10 },
    },
    model: { parts: tableParts },
    pricing: {
      baseCents: 65_000,
      timberPerCubicMetreCents: 650_000,
      areaPerSquareMetreCents: 12_000,
      labourPerCentimetreCents: 400,
      customSurchargeCents: 15_000,
      roundToCents: 1000,
    },
    options: [TIMBERS, FINISHES],
    design: {
      id: "nord",
      extra: {},
      photos: {},
      headline: "A table built like a building: one thick slab, four posts, nothing extra.",
      intro:
        "Drawn around a 30 mm solid top and square legs set in from the corners. Make it as long as your room allows — the legs move out to carry it and stay the same section.",
      story: [
        {
          heading: "The top",
          body: "Boards are chosen in sequence from the same log, so the grain runs on across the joints.",
        },
        {
          heading: "The frame",
          body: "Mortise-and-tenon aprons, drawbored with oak pegs. No screws, no brackets, nothing to work loose.",
        },
        {
          heading: "Your size",
          body: "From a 1200 mm table for four to 2400 mm for ten. The aprons and legs are recalculated for the size you choose.",
        },
      ],
      highlights: [
        { label: "Seats", value: "Six at standard size" },
        { label: "Top thickness", value: "30 mm solid" },
        { label: "Joinery", value: "Drawbored mortise and tenon" },
      ],
      care: "Wipe with a damp cloth. Refresh the oil once a year, or when water stops beading on the surface.",
    },
  },
  {
    name: "Hearth Sideboard",
    slug: "hearth-sideboard",
    category: "cabinets",
    status: "published",
    availability: "made_to_order",
    summary: "A low cabinet with two doors and a shelf, on a shadow plinth.",
    description:
      "Dovetailed carcass, frame-and-panel back, and doors hung on solid brass knife hinges. Made for a dining room, at home under a television.",
    leadDaysStandard: 28,
    leadDaysCustom: 42,
    sortOrder: 2,
    prompt: null,
    dimensions: {
      width: { standard: 1600, min: 1000, max: 2200, step: 10 },
      height: { standard: 800, min: 600, max: 950, step: 10 },
      depth: { standard: 450, min: 380, max: 550, step: 10 },
    },
    model: { parts: cabinetParts },
    pricing: {
      baseCents: 120_000,
      timberPerCubicMetreCents: 700_000,
      areaPerSquareMetreCents: 25_000,
      labourPerCentimetreCents: 600,
      customSurchargeCents: 20_000,
      roundToCents: 1000,
    },
    options: [
      { ...TIMBERS, choices: [TIMBERS.choices[2], TIMBERS.choices[0], TIMBERS.choices[1]] },
      {
        id: "plinth",
        label: "Plinth",
        paints: "accent",
        choices: [
          {
            id: "ebonised",
            label: "Ebonised",
            description: "Near-black, the cabinet floats",
            priceCents: 0,
            timberMultiplier: 1,
            leadDays: 0,
            color: "#2d2622",
          },
          {
            id: "matching",
            label: "Matching timber",
            priceCents: 0,
            timberMultiplier: 1,
            leadDays: 0,
            color: "#8a6446",
          },
        ],
      },
      FINISHES,
    ],
    design: {
      id: "hearth",
      extra: {},
      photos: {},
      headline: "For the good plates, the board games, and the bottle saved for later.",
      intro:
        "A sideboard in the old way: dovetailed at the corners, a shelf inside, two doors that meet in the middle on brass hinges. It sits on a dark plinth, so it seems to hover.",
      story: [
        {
          heading: "Hand-cut dovetails",
          body: "Each corner is sawn and chopped by hand, and left visible on the top, where it can be seen and felt.",
        },
        {
          heading: "Doors that close with a breath",
          body: "The doors are fitted to a gap the thickness of a coin, so they close on a cushion of air.",
        },
      ],
      highlights: [
        { label: "Shelf", value: "One, full depth" },
        { label: "Hinges", value: "Solid brass knife" },
        { label: "Back", value: "Frame and panel" },
        { label: "Plinth", value: "Ebonised or matching" },
      ],
      care: "Dust with a dry cloth. Keep it out of direct sun for the first months while the timber settles into its colour.",
    },
  },
  {
    name: "Grid Shelving",
    slug: "grid-shelving",
    category: "shelving",
    status: "published",
    availability: "made_to_order",
    summary:
      "Open shelving with five shelves between two uprights. Taller or wider, the shelves stay even.",
    description:
      "Shelves are housed into the uprights and locked with two hidden back rails, so the unit stands on its own without wall fixings at standard height.",
    leadDaysStandard: 14,
    leadDaysCustom: 24,
    sortOrder: 3,
    prompt: null,
    dimensions: {
      width: { standard: 1000, min: 600, max: 1400, step: 10 },
      height: { standard: 1800, min: 1200, max: 2400, step: 10 },
      depth: { standard: 350, min: 250, max: 450, step: 10 },
    },
    model: { parts: shelfParts },
    pricing: {
      baseCents: 45_000,
      timberPerCubicMetreCents: 600_000,
      areaPerSquareMetreCents: 0,
      labourPerCentimetreCents: 250,
      customSurchargeCents: 10_000,
      roundToCents: 1000,
    },
    options: [
      { ...TIMBERS, choices: [TIMBERS.choices[1], TIMBERS.choices[0], TIMBERS.choices[2]] },
      {
        id: "rails",
        label: "Back rails",
        paints: "accent",
        choices: [
          {
            id: "graphite",
            label: "Graphite",
            priceCents: 0,
            timberMultiplier: 1,
            leadDays: 0,
            color: "#3b3f45",
          },
          {
            id: "self",
            label: "Same timber",
            priceCents: 0,
            timberMultiplier: 1,
            leadDays: 0,
            color: "#cdb48e",
          },
        ],
      },
    ],
    design: {
      id: "grid",
      extra: {},
      photos: {},
      headline: "Five planes, two posts. A grid you can stretch to the wall you have.",
      intro:
        "Housed joints and two hidden rails hold it square. Change the height and the middle shelves spread evenly; change the width and the shelves lengthen while the uprights stay put.",
      story: [
        {
          heading: "Housed shelves",
          body: "Each shelf sits in a 6 mm groove in both uprights, glued along its full depth.",
        },
        {
          heading: "Hidden rails",
          body: "Two rails at the back resist racking, so the unit stays square when loaded.",
        },
        {
          heading: "Even spacing",
          body: "The gaps between shelves are recalculated for the height you choose, never left uneven.",
        },
      ],
      highlights: [
        { label: "Shelves", value: "5" },
        { label: "Load per shelf", value: "25 kg" },
        { label: "Thickness", value: "24 mm" },
      ],
      care: "Above 2000 mm tall, fix it to the wall with the bracket we include.",
    },
  },
  {
    name: "Settle Bench",
    slug: "settle-bench",
    category: "benches",
    status: "published",
    availability: "in_stock",
    summary: "A plain bench on slab ends, for a hallway or the long side of a table.",
    description:
      "The ends are through-tenoned into the seat and wedged, so the joint is visible on top. A low stretcher stops it racking.",
    leadDaysStandard: 3,
    leadDaysCustom: 18,
    sortOrder: 4,
    prompt: null,
    dimensions: {
      width: { standard: 1400, min: 800, max: 2200, step: 10 },
      height: { standard: 450, min: 420, max: 480, step: 5 },
      depth: { standard: 380, min: 300, max: 450, step: 10 },
    },
    model: { parts: benchParts },
    pricing: {
      baseCents: 28_000,
      timberPerCubicMetreCents: 650_000,
      areaPerSquareMetreCents: 0,
      labourPerCentimetreCents: 300,
      customSurchargeCents: 9_000,
      roundToCents: 500,
    },
    options: [
      TIMBERS,
      {
        id: "stretcher",
        label: "Stretcher",
        paints: "accent",
        choices: [
          {
            id: "matching",
            label: "Matching timber",
            priceCents: 0,
            timberMultiplier: 1,
            leadDays: 0,
            color: "#a47b55",
          },
          {
            id: "ebonised",
            label: "Ebonised",
            priceCents: 2500,
            timberMultiplier: 1,
            leadDays: 1,
            color: "#2d2622",
          },
        ],
      },
    ],
    design: {
      id: "settle",
      extra: {},
      photos: {},
      headline: "Somewhere to sit and take your boots off.",
      intro:
        "Three boards and a stretcher. The ends go right through the seat and are wedged from above, the oldest way to make a bench that does not wobble.",
      story: [
        {
          heading: "Through-wedged",
          body: "Each end passes through the seat in two tenons, split and wedged with a contrasting timber.",
        },
        {
          heading: "Ready to go",
          body: "The standard size is usually in the workshop, finished, and can leave within days.",
        },
      ],
      highlights: [
        { label: "Seats", value: "Two to three" },
        { label: "Seat thickness", value: "40 mm" },
      ],
      care: "Oil it when it looks dry. It is meant to be sat on, stood on, and to get better for it.",
    },
  },
  {
    name: "Splay Console",
    slug: "splay-console",
    category: "tables",
    status: "draft",
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
      story: [
        {
          heading: "The splay",
          body: "Legs lean out to the floor, so a narrow table never rocks.",
        },
        {
          heading: "The shelf",
          body: "It runs past the legs, with room for books or a basket.",
        },
        {
          heading: "Your size",
          body: "Any length from 800 to 1600 mm, cut to fit your wall.",
        },
      ],
      highlights: [
        { label: "Timber", value: "Solid oak" },
        { label: "Legs", value: "Splayed both ways" },
        { label: "Shelf", value: "Past the legs" },
      ],
      care: "Dust it dry and oil the top when it looks thirsty.",
      extra: {
        shed_heading: "From the shed",
        shed_note: "Built in a tin shed, door open to the lawn.",
      },
      photos: {},
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
    story: [],
    highlights: [],
    care: "",
    extra: {},
    photos: {},
  },
});
