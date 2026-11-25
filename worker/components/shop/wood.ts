// worker/components/shop/wood.ts
//
// What makes the 3D piece read as timber rather than painted boxes:
//
//   - a grain drawn at real scale (one tile is 400 mm of board) and laid
//     along each part's longest side, as a board is cut, so a leg's grain
//     runs up the leg and a top's runs along the top;
//   - edges eased with a 2.5 mm radius, so they catch the light the way a
//     sanded arris does;
//   - the same grain as a faint relief (bump), so the oiled surface shows
//     texture where the light rakes across it.
//
// The grain is drawn pale and neutral; each finish's colour tints it.

import {
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  NoColorSpace,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** Metres of board one texture tile covers. */
const TILE = 0.4;
const EASE = 0.0025;

function drawGrain(size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  let seed = 11;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  ctx.fillStyle = "#f3eee8";
  ctx.fillRect(0, 0, size, size);

  // Broad bands of lighter and darker wood across the board's width.
  for (let i = 0; i < 14; i++) {
    const y = rand() * size;
    const h = size * (0.04 + rand() * 0.12);
    ctx.fillStyle = `rgba(${rand() < 0.5 ? "120, 90, 60" : "255, 250, 240"}, ${0.06 + rand() * 0.1})`;
    ctx.fillRect(0, y, size, h);
  }

  // Fine fibres: long, gently wandering lines along the board.
  for (let i = 0; i < 260; i++) {
    const y0 = rand() * size;
    const amp = 1 + rand() * 6;
    const freq = (Math.PI * 2 * (1 + Math.floor(rand() * 3))) / size;
    const phase = rand() * Math.PI * 2;
    ctx.strokeStyle = `rgba(80, 58, 38, ${0.05 + rand() * 0.16})`;
    ctx.lineWidth = 0.4 + rand() * 1.6;
    ctx.beginPath();
    for (let x = 0; x <= size; x += 6) {
      const y = y0 + Math.sin(x * freq + phase) * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // A few "cathedral" arches, where the saw cut across growth rings.
  for (let i = 0; i < 5; i++) {
    const cx = rand() * size;
    const cy = rand() * size;
    for (let k = 0; k < 7; k++) {
      const rx = size * (0.12 + k * 0.035);
      const ry = size * (0.03 + k * 0.012);
      ctx.strokeStyle = `rgba(90, 64, 40, ${0.08 + rand() * 0.08})`;
      ctx.lineWidth = 1 + rand() * 1.5;
      // Drawn three times along x so the arch tiles cleanly.
      for (const dx of [-size, 0, size]) {
        ctx.beginPath();
        ctx.ellipse(cx + dx, cy, rx, ry, 0, Math.PI * 0.95, Math.PI * 2.05);
        ctx.stroke();
      }
    }
  }

  // Flecks: short pores along the fibres.
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(70, 50, 32, ${0.08 + rand() * 0.12})`;
    ctx.fillRect(rand() * size, rand() * size, 2 + rand() * 6, 1);
  }
  return canvas;
}

/** The grain as a colour map, and the same drawing as a relief map. */
export function grainTextures() {
  const canvas = drawGrain(1024);
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  const bump = new CanvasTexture(canvas);
  bump.colorSpace = NoColorSpace;
  for (const t of [map, bump]) {
    t.wrapS = t.wrapT = RepeatWrapping;
    t.anisotropy = 8;
  }
  return { map, bump };
}

/** A small, stable number from a part's name, so no two legs share the same grain. */
const offsetFor = (name: string) => {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h % 1000) / 1000;
};

/**
 * A board at its real size in metres, edges eased, with texture coordinates
 * in metres along its length, so the grain is never stretched.
 */
export function woodBox(size: [number, number, number], name: string) {
  const [w, h, d] = size;
  const radius = Math.min(EASE, Math.min(w, h, d) / 4);
  const geo = new RoundedBoxGeometry(w, h, d, 2, radius);
  const pos = geo.getAttribute("position");
  const nor = geo.getAttribute("normal");
  const uv = geo.getAttribute("uv");
  const grain = size.indexOf(Math.max(w, h, d));
  const shift = offsetFor(name);
  for (let i = 0; i < pos.count; i++) {
    const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const n = [Math.abs(nor.getX(i)), Math.abs(nor.getY(i)), Math.abs(nor.getZ(i))];
    const facing = n.indexOf(Math.max(...n));
    const across = [0, 1, 2].filter((a) => a !== facing);
    // Along the grain where the face shows it; the end grain shows rings.
    const [ua, va] = across.includes(grain)
      ? [grain, across.find((a) => a !== grain)!]
      : (across as [number, number]);
    uv.setXY(i, p[ua] / TILE + shift, p[va] / TILE + shift * 0.37);
  }
  uv.needsUpdate = true;
  return geo;
}

/**
 * The darkening right where a piece meets the floor: a soft-edged shadow
 * under its footprint, which a shadow map alone draws too faintly. Scale it
 * to the piece's width and depth (in metres) plus a margin.
 */
export function contactShadow() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  // Rectangles stacked from the edge inwards, each faint: dark in the
  // middle, fading to nothing at the edges. (Not ctx.filter, which older
  // Safari does not support.)
  const steps = 24;
  for (let i = 0; i < steps; i++) {
    const inset = (size * 0.4 * i) / steps;
    ctx.fillStyle = "rgba(40, 28, 18, 0.07)";
    ctx.fillRect(inset, inset, size - inset * 2, size - inset * 2);
  }
  const map = new CanvasTexture(canvas);
  const material = new MeshBasicMaterial({
    map,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const geometry = new PlaneGeometry(1, 1);
  const mesh = new Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.0015;
  mesh.renderOrder = 1;
  return { mesh, dispose: () => [map, material, geometry].forEach((d) => d.dispose()) };
}
