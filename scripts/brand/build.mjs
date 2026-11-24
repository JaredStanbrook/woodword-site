import { createRequire } from "module";
import fs from "fs";
const { chromium } = createRequire(import.meta.url)("playwright");
const [paths, out] = [JSON.parse(fs.readFileSync(process.argv[2])), process.argv[3]];
const C = { ink: "#2b1a14", honey: "#f1d6b4", gilt: "#e2b04d", bone: "#f8eee0", blood: "#a01c24" };

// The mark: a table seen square-on, its legs and V-brace forming an M,
// measured by a dimension line with architect's ticks. 100 × 100 units.
const mark = (
  fill,
  x = 0,
  y = 0,
  s = 1,
) => `<g transform="translate(${x} ${y}) scale(${s})" fill="${fill}">
  <rect x="12" y="12" width="76" height="15"/>
  <rect x="17" y="26.4" width="15" height="52.6"/>
  <rect x="68" y="26.4" width="15" height="52.6"/>
  <polygon points="31.4,26.4 43.5,26.4 50,37.4 56.5,26.4 68.6,26.4 68.6,43 50,72 31.4,43"/>
  <g fill="none" stroke="${fill}" stroke-width="3" stroke-linecap="round">
    <path d="M17 84V99M83 84V99M17 91.5H83M13.5 95L20.5 88M79.5 95L86.5 88"/>
  </g></g>`;
const word = (fill, x, y, size) =>
  `<path transform="translate(${x} ${y}) scale(${size / 100})" fill="${fill}" d="${paths.word.d}"/>`;
const tag = (fill, x, y, size) =>
  `<path transform="translate(${x} ${y}) scale(${size / 100})" fill="${fill}" d="${paths.tag.d}"/>`;
const ww = (size) => (paths.word.width * size) / 100;

// A dimension line under the wordmark: the shop's signature device.
const rule = (fill, x0, x1, y) =>
  `<g fill="none" stroke="${fill}" stroke-width="2.4" stroke-linecap="round"><path d="M${x0} ${y - 8}V${y + 8}M${x1} ${y - 8}V${y + 8}M${x0} ${y}H${x1}M${x0 - 4} ${y + 4}L${x0 + 4} ${y - 4}M${x1 - 4} ${y + 4}L${x1 + 4} ${y - 4}"/></g>`;

const lockups = {
  mark: (fg) => mark(fg),
  horizontal: (fg) => mark(fg, 0, -18, 1.3) + word(fg, 150, 70, 100),
  stacked: (fg) => mark(fg, ww(110) / 2 - 75, -40, 1.5) + word(fg, 0, 205, 110),
  "stacked-tagline": (fg) =>
    mark(fg, ww(110) / 2 - 75, -40, 1.5) +
    word(fg, 0, 205, 110) +
    tag(fg, (ww(110) - paths.tag.width * 0.255) / 2, 253, 25.5),
  wordmark: (fg) => word(fg, 0, 80, 110) + rule(fg, 4, ww(110) - 4, 114),
};
const ways = {
  ink: [C.ink, null],
  bone: [C.bone, null],
  "ink-on-honey": [C.ink, C.honey],
  "gilt-on-ink": [C.gilt, C.ink],
  "bone-on-blood": [C.bone, C.blood],
};

const b = await chromium.launch();
const p = await b.newPage();
const files = [];
for (const [name, build] of Object.entries(lockups)) {
  for (const [way, [fg, bg]] of Object.entries(ways)) {
    if (name === "mark" && way === "bone-on-blood") continue;
    const inner = build(fg);
    await p.setContent(
      `<svg xmlns="http://www.w3.org/2000/svg" id="s"><g id="g">${inner}</g></svg>`,
    );
    const bb = await p.evaluate(() => {
      const r = document.getElementById("g").getBBox();
      return [r.x, r.y, r.width, r.height];
    });
    const pad = bg ? Math.max(bb[2], bb[3]) * 0.14 : Math.max(bb[2], bb[3]) * 0.02;
    let [x, y, w, h] = [bb[0] - pad, bb[1] - pad, bb[2] + pad * 2, bb[3] + pad * 2];
    if (bg && name === "mark") {
      const s = Math.max(w, h);
      x -= (s - w) / 2;
      y -= (s - h) / 2;
      w = h = s;
    }
    const n = (v) => +v.toFixed(2);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(x)} ${n(y)} ${n(w)} ${n(h)}" role="img" aria-label="Mooihout">${bg ? `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${bg}"/>` : ""}${inner}</svg>\n`;
    const file = `mooihout-${name}-${way}.svg`;
    fs.writeFileSync(`${out}/${file}`, svg);
    files.push([file, w / h]);
  }
}
// PNG exports of the ones marketing needs most.
for (const [file, scale] of [
  ["mooihout-mark-gilt-on-ink.svg", 1080],
  ["mooihout-mark-ink-on-honey.svg", 1080],
  ["mooihout-horizontal-ink-on-honey.svg", 2400],
  ["mooihout-stacked-tagline-gilt-on-ink.svg", 2000],
  ["mooihout-wordmark-ink.svg", 2400],
]) {
  const ratio = files.find((f) => f[0] === file)[1];
  const W = scale,
    H = Math.round(scale / ratio);
  const pg = await b.newPage({ viewport: { width: W, height: H } });
  await pg.setContent(
    `<style>html,body{margin:0}img{display:block;width:${W}px;height:${H}px}</style><img src="data:image/svg+xml;base64,${fs.readFileSync(`${out}/${file}`).toString("base64")}">`,
  );
  await pg.screenshot({ path: `${out}/${file.replace(".svg", ".png")}`, omitBackground: true });
  await pg.close();
}
console.log(files.length, "svgs");
await b.close();
