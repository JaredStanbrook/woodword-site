import { createRequire } from "module";
import fs from "fs";
const { chromium } = createRequire(import.meta.url)("playwright");
const [src, out] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
const svg = fs.readFileSync(src).toString("base64");
await p.setContent(`<style>html,body{margin:0;width:1200px;height:630px;background:#2b1a14;display:grid;place-items:center}
img{height:500px}</style><img src="data:image/svg+xml;base64,${svg}">`);
await p.waitForTimeout(200);
await p.screenshot({ path: out });
await b.close();
