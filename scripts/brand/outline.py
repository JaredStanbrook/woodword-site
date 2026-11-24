"""Outline text from the shop's self-hosted fonts into SVG path data."""
import sys, json
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

def outline(font_path, text, wght, size):
    f = TTFont(font_path)
    if "fvar" in f:
        f = instancer.instantiateVariableFont(f, {"wght": wght})
    gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f["head"].unitsPerEm
    hmtx = f["hmtx"]; scale = size / upm
    # Pair kerning from GPOS is skipped; the faces are spaced well enough at display sizes.
    pen = SVGPathPen(gs); x = 0
    for ch in text:
        g = cmap[ord(ch)]
        gs[g].draw(TransformPen(pen, (scale, 0, 0, -scale, x, 0)))
        x += hmtx[g][0] * scale
    asc = f["hhea"].ascent * scale; desc = -f["hhea"].descent * scale
    cap = getattr(f["OS/2"], "sCapHeight", 0) * scale
    return {"d": pen.getCommands(), "width": round(x, 2), "ascent": round(asc, 2), "descent": round(desc, 2), "cap": round(cap, 2)}

import os
fonts = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "public", "fonts") + "/"
out = {
  "word": outline(fonts + "grenze-gotisch-var.woff2", "Mooihout", 700, 100),
  "tag": outline(fonts + "eb-garamond-var-italic.woff2", "Handmade furniture, made to measure", 500, 100),
}
json.dump(out, open(sys.argv[1], "w"))
print({k: (v["width"], v["ascent"], v["cap"]) for k, v in out.items()})
