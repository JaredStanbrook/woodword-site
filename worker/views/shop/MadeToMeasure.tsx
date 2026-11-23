// worker/views/shop/MadeToMeasure.tsx
//
// How ordering a custom size works, in plain words. Public, indexed.

import { buttonPrimary } from "./parts";

const steps = [
  {
    n: "01",
    title: "Choose a piece",
    body: "Every design in the collection has a standard size it was drawn at, and a range it can be built in. The range is set by the joinery: how far a top can span, how tall a frame stays rigid.",
  },
  {
    n: "02",
    title: "Set it to your room",
    body: "Change the width, height and depth with the sliders or type the exact millimetres. The 3D model rebuilds as you go — a wider table gets a wider top and its legs move out to carry it; they do not get fatter.",
  },
  {
    n: "03",
    title: "See the price as you go",
    body: "The price follows every change, worked out from the timber the piece will use and the extra time in the workshop. Open the breakdown to see each part of it.",
  },
  {
    n: "04",
    title: "We build exactly that",
    body: "Your order saves the configuration you chose — every component at its final size — and that is what goes to the bench. You can follow it from received to delivered.",
  },
];

export const MadeToMeasurePage = () => (
  <div class="mx-auto max-w-5xl px-4 pt-14 sm:px-6 sm:pt-20 animate-in fade-in duration-500">
    <p class="text-xs uppercase tracking-[0.2em] text-muted-foreground">Made to measure</p>
    <h1 class="mt-4 max-w-3xl text-4xl leading-tight sm:text-6xl">
      The size your room needs, not the size a factory picked.
    </h1>
    <ol class="mt-16 divide-y border-y">
      {steps.map((s) => (
        <li class="grid gap-3 py-8 sm:grid-cols-[5rem_1fr_2fr]">
          <span class="font-mono text-sm text-product tabular-nums">{s.n}</span>
          <h2 class="font-display text-2xl">{s.title}</h2>
          <p class="leading-relaxed text-muted-foreground">{s.body}</p>
        </li>
      ))}
    </ol>
    <section class="mt-16 grid gap-8 sm:grid-cols-2">
      <div class="space-y-2">
        <h2 class="font-display text-xl">How long it takes</h2>
        <p class="text-sm leading-relaxed text-muted-foreground">
          Each piece shows its workshop time. Standard sizes are quicker; custom sizes and some
          finishes add time, and the estimate on the product page updates to say so.
        </p>
      </div>
      <div class="space-y-2">
        <h2 class="font-display text-xl">Save it for later</h2>
        <p class="text-sm leading-relaxed text-muted-foreground">
          Save a configuration to come back to, or send the link to someone — they see exactly the
          size and finish you chose.
        </p>
      </div>
    </section>
    <a href="/" class={`${buttonPrimary} mt-14`}>
      Browse the collection
    </a>
  </div>
);
