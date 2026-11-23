"""
Rebuild a product's Blender model at the size a customer ordered.

Takes the JSON from an order's "Spec JSON" button (/admin/orders/<id>/spec.json),
moves and scales each named object to the size and position the shop
calculated, and saves a copy of the file next to the original. The original
is not changed.

    blender table.blend --background --python scripts/blender/apply_spec.py -- MH-7K3P9Q-spec.json
    # An order with several pieces: pick one (1-based, default 1)
    blender table.blend --background --python scripts/blender/apply_spec.py -- MH-7K3P9Q-spec.json 2

The model must follow the conventions in docs/blender.md (rotation applied,
standing on the origin), the same ones export_components.py checks. Objects
not named in the spec are left where they are.
"""

import json
import os
import sys

import bpy
from mathutils import Vector


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if not argv:
        raise SystemExit("Usage: blender file.blend --background --python apply_spec.py -- spec.json [item]")
    return argv[0], int(argv[1]) if len(argv) > 1 else 1


def world_bounds(obj):
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    lo = Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners)))
    hi = Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners)))
    return lo, hi


def main():
    spec_path, item_no = args()
    with open(spec_path) as fh:
        spec = json.load(fh)
    items = spec.get("items", [])
    if not 1 <= item_no <= len(items):
        raise SystemExit(f"The spec has {len(items)} item(s); asked for {item_no}.")
    item = items[item_no - 1]

    scale = bpy.context.scene.unit_settings.scale_length or 1.0
    from_mm = 1.0 / (1000.0 * scale)
    missing = []

    for part in item["parts"]:
        obj = bpy.data.objects.get(part["name"])
        if obj is None:
            missing.append(part["name"])
            continue
        # Shop axes to Blender: x = X, y (up) = Z, z (depth) = -Y.
        sx, sy, sz = part["size"]
        px, py, pz = part["position"]
        want_size = Vector((sx, sz, sy)) * from_mm
        want_centre = Vector((px, -pz, py)) * from_mm

        bpy.context.view_layer.update()
        lo, hi = world_bounds(obj)
        have_size = hi - lo
        ratio = Vector(
            (
                want_size.x / have_size.x if have_size.x else 1,
                want_size.y / have_size.y if have_size.y else 1,
                want_size.z / have_size.z if have_size.z else 1,
            )
        )
        obj.scale = Vector((obj.scale.x * ratio.x, obj.scale.y * ratio.y, obj.scale.z * ratio.z))
        bpy.context.view_layer.update()
        lo, hi = world_bounds(obj)
        obj.location += want_centre - (lo + hi) / 2

    bpy.context.view_layer.update()
    dims = item["dimensions"]
    ref = spec.get("order", {}).get("ref", "order")
    base = os.path.splitext(bpy.data.filepath)[0] if bpy.data.filepath else os.path.abspath(ref)
    out = f"{base}-{ref}-{item_no}.blend"
    bpy.ops.wm.save_as_mainfile(filepath=out, copy=True)

    print(f"\n{item['productName']} for {ref}: {dims['width']} W x {dims['depth']} D x {dims['height']} H mm")
    for o in item.get("options", []):
        print(f"  {o['groupLabel']}: {o['choiceLabel']}")
    if missing:
        print(f"  ! Not in this file, so not changed: {', '.join(missing)}")
    print(f"Saved {out}")


main()
