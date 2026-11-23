// worker/components/shop/FurnitureConfigurator.ts
//
// <furniture-configurator> enhances the server-rendered configurator form
// (views/shop/Configurator.tsx). It adds no markup of its own: it keeps each
// slider, number box and +/- pair in step, clamps to the manufacturing limits,
// prices the piece with the same engine the server uses, rolls the price, and
// tells the 3D view what changed.
//
// Light DOM, no Lit: the markup is the server's, and stays usable if this
// never loads.

import {
  AXES,
  clampDimension,
  drawingLabel,
  isoSvg,
  normaliseSelection,
  quote,
  resizeParts,
} from "@server/lib/furniture";
import { formatPrice, priceGlyphs } from "@server/lib/money";
import type { DimensionKey, Selection } from "@server/schema/furniture.config";
import { furnitureStore, readFurnitureData, type FurnitureData } from "./store";

const leadTimeLabel = (days: number) => {
  if (days <= 0) return "Ready now";
  if (days < 14) return `About ${days} day${days === 1 ? "" : "s"} in the workshop`;
  const weeks = Math.round(days / 7);
  return `About ${weeks} week${weeks === 1 ? "" : "s"} in the workshop`;
};

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

class FurnitureConfigurator extends HTMLElement {
  private data: FurnitureData | null = null;
  private selection!: Selection;
  private lastPrice = -1;
  private abort = new AbortController();

  connectedCallback() {
    this.data = readFurnitureData();
    if (!this.data) return;
    this.abort = new AbortController();
    const { signal } = this.abort;

    furnitureStore.reset();
    this.selection = normaliseSelection(this.data, this.data.selection);
    this.lastPrice = quote(this.data, this.selection).totalCents;

    this.addEventListener("input", (e) => this.onInput(e), { signal });
    this.addEventListener("change", (e) => this.onChange(e), { signal });
    this.addEventListener("click", (e) => this.onClick(e), { signal });

    furnitureStore.set(this.selection);
  }

  disconnectedCallback() {
    this.abort.abort();
  }

  private row(axis: DimensionKey) {
    return this.querySelector<HTMLElement>(`[data-dimension="${axis}"]`);
  }

  private axisOf(el: Element): DimensionKey | null {
    const axis = el.closest<HTMLElement>("[data-dimension]")?.dataset.dimension;
    return axis && (AXES as string[]).includes(axis) ? (axis as DimensionKey) : null;
  }

  private onInput(e: Event) {
    const t = e.target as HTMLInputElement;
    const axis = this.axisOf(t);
    if (axis && t.matches("[data-range]")) {
      this.setDimension(axis, Number(t.value));
    } else if (axis && t.matches("[data-number]")) {
      // While typing, only accept a value already in range — "8" on the way
      // to "800" must not snap to the minimum. The change event clamps.
      const dim = this.data!.dimensions[axis];
      const v = Number(t.value);
      if (t.value !== "" && v >= dim.min && v <= dim.max) this.setDimension(axis, v, false);
    }
  }

  private onChange(e: Event) {
    const t = e.target as HTMLInputElement;
    const axis = this.axisOf(t);
    if (axis && t.matches("[data-number]")) {
      this.setDimension(axis, Number(t.value));
    } else if (t.matches("[data-option]")) {
      const group = t.dataset.option!;
      this.selection = {
        ...this.selection,
        options: { ...this.selection.options, [group]: t.value },
      };
      const label = this.querySelector(`[data-option-label="${CSS.escape(group)}"]`);
      if (label) label.textContent = t.dataset.choiceLabel ?? "";
      this.render();
    }
  }

  private onClick(e: Event) {
    const btn = (e.target as Element).closest<HTMLButtonElement>("button");
    if (!btn) return;
    if (btn.matches("[data-reset-size]")) {
      for (const axis of AXES)
        this.setDimension(axis, this.data!.dimensions[axis].standard, true, false);
      this.render();
      return;
    }
    const axis = this.axisOf(btn);
    if (!axis) return;
    const step = this.data!.dimensions[axis].step;
    if (btn.matches("[data-step-up]")) this.setDimension(axis, this.selection[axis] + step);
    if (btn.matches("[data-step-down]")) this.setDimension(axis, this.selection[axis] - step);
  }

  /**
   * One way in for every control. `syncNumber` is false while the person is
   * typing in the number box, so it is not rewritten under their cursor.
   */
  private setDimension(axis: DimensionKey, raw: number, syncNumber = true, render = true) {
    const dim = this.data!.dimensions[axis];
    const value = clampDimension(raw, dim);
    this.selection = { ...this.selection, [axis]: value };

    const row = this.row(axis);
    if (row) {
      const range = row.querySelector<HTMLInputElement>("[data-range]");
      const number = row.querySelector<HTMLInputElement>("[data-number]");
      if (range) {
        range.value = String(value);
        const pct = dim.max === dim.min ? 100 : ((value - dim.min) / (dim.max - dim.min)) * 100;
        range.style.setProperty("--fill", `${pct}%`);
      }
      if (number && syncNumber) number.value = String(value);
      const down = row.querySelector<HTMLButtonElement>("[data-step-down]");
      const up = row.querySelector<HTMLButtonElement>("[data-step-up]");
      if (down) down.disabled = value <= dim.min;
      if (up) up.disabled = value >= dim.max;
    }
    document
      .querySelectorAll(`[data-axis-readout="${axis}"]`)
      .forEach((el) => (el.textContent = String(value)));

    if (render) this.render();
  }

  private render() {
    const data = this.data!;
    const q = quote(data, this.selection);
    const s = this.selection;

    const size = this.querySelector("[data-size-label]");
    if (size) size.textContent = `${s.width} × ${s.depth} × ${s.height} mm`;
    const custom = this.querySelector("[data-custom-label]");
    if (custom) custom.textContent = q.custom ? "Made to your size" : "The standard size";
    const lead = this.querySelector("[data-lead-label]");
    if (lead) lead.textContent = leadTimeLabel(q.leadDays);

    const drawing = this.querySelector("[data-live-drawing]");
    if (drawing) {
      drawing.innerHTML = isoSvg(resizeParts(data, s), {
        dims: true,
        size: s,
        label: drawingLabel(data.name, s),
      });
    }

    const breakdown = this.querySelector("[data-breakdown]");
    if (breakdown) {
      breakdown.innerHTML = q.lines
        .map(
          (l) =>
            `<div class="flex justify-between gap-4"><dt class="text-muted-foreground">${escapeHtml(l.label)}</dt><dd class="tabular-nums">${escapeHtml(formatPrice(l.cents, data.locale, data.currency))}</dd></div>`,
        )
        .join("");
    }

    if (q.totalCents !== this.lastPrice) {
      this.rollPrice(q.totalCents);
      this.lastPrice = q.totalCents;
    }
    furnitureStore.set(s);
  }

  /**
   * Rebuilds the digit columns when the number of characters changes (€980 to
   * €1,020), starting each new column at the old digit in the same place from
   * the right so the change still reads as a roll, then moves every column to
   * its new digit on the next frame.
   */
  private rollPrice(cents: number) {
    const data = this.data!;
    const roll = this.querySelector<HTMLElement>("[data-price-roll]");
    const text = this.querySelector<HTMLElement>("[data-price-text]");
    if (text) text.textContent = formatPrice(cents, data.locale, data.currency);
    if (!roll) return;

    const next = priceGlyphs(cents, data.locale, data.currency);
    const sameShape =
      roll.children.length === next.length &&
      next.every((g, i) => (g.digit === null) === !roll.children[i].classList.contains("digit"));

    if (!sameShape) {
      const prev = priceGlyphs(this.lastPrice, data.locale, data.currency);
      const prevDigits = prev.filter((g) => g.digit !== null).map((g) => g.digit!);
      const nextDigitCount = next.filter((g) => g.digit !== null).length;
      let k = 0;
      roll.innerHTML = next
        .map((g) => {
          if (g.digit === null) return `<span>${escapeHtml(g.ch)}</span>`;
          const fromRight = nextDigitCount - 1 - k++;
          const start = prevDigits[prevDigits.length - 1 - fromRight] ?? 0;
          return `<span class="digit"><span style="transform: translateY(calc(var(--roll-h) * -${start}))">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<span>${d}</span>`).join("")}</span></span>`;
        })
        .join("");
      // Force layout so the start position is painted before it moves.
      void roll.offsetWidth;
    }

    const cols = roll.querySelectorAll<HTMLElement>(".digit > span");
    let i = 0;
    requestAnimationFrame(() => {
      for (const g of next) {
        if (g.digit === null) continue;
        const col = cols[i++];
        if (col) col.style.transform = `translateY(calc(var(--roll-h) * -${g.digit}))`;
      }
    });
  }
}

if (!customElements.get("furniture-configurator")) {
  customElements.define("furniture-configurator", FurnitureConfigurator);
}
