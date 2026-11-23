"""
Export a furniture model's components for the shop.

Reads every mesh object in the "Components" collection (or every visible
mesh, if there is no such collection) and prints the JSON list the admin's
"Components" field takes, plus the overall size to enter as the standard
dimensions. Run it whenever the model changes, then paste the output into the
product and upload the GLB.

    # In Blender: Scripting tab, open this file, Run Script (output in the
    # system console, and in components.json next to the .blend).
    # Or from a terminal:
    blender table.blend --background --python scripts/blender/export_components.py

Conventions (see docs/blender.md):
- One object per physical piece, named as it should appear in the GLB:
  leg_1, top, door_left... Names must be unique.
- Rotation and scale applied (Ctrl+A > All Transforms). The shop resizes along
  the world axes.
- The piece stands on the world origin: floor at Z = 0, centred on X and Y.
- Optional custom properties on an object (Object > Custom Properties):
    label     workshop name shared by identical pieces, e.g. "Leg"
    shape     "box" (default) or "cylinder" (upright, along Z)
    material  "body" (default), "accent", "metal" or "glass"
    resize_x / resize_y / resize_z
              "anchor" (default), "move", "spread", "scale" or "fixed",
              for the shop's width / height / depth.
  Shop axes: x = Blender X, y (height) = Blender Z, z (depth) = Blender -Y.
"""

import json
import os
import re
import sys

import bpy
from mathutils import Vector

RESIZE_MODES = {"anchor", "move", "spread", "scale", "fixed"}
SHAPES = {"box", "cylinder"}
MATERIALS = {"body", "accent", "metal", "glass"}


def objects():
    coll = bpy.data.collections.get("Components")
    source = coll.all_objects if coll else bpy.context.scene.objects
    return sorted(
        (o for o in source if o.type == "MESH" and (coll or o.visible_get())),
        key=lambda o: o.name,
    )


def world_bounds(obj):
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    lo = Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners)))
    hi = Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners)))
    return lo, hi


def prop(obj, key, allowed, default):
    value = str(obj.get(key, default)).strip().lower()
    if value not in allowed:
        print(f"  ! {obj.name}: {key} = {value!r} is not one of {sorted(allowed)}; using {default!r}")
        return default
    return value


def main():
    scale = bpy.context.scene.unit_settings.scale_length or 1.0
    to_mm = 1000.0 * scale
    parts = []
    lo_all = Vector((float("inf"),) * 3)
    hi_all = Vector((float("-inf"),) * 3)

    for obj in objects():
        if any(abs(r) > 1e-4 for r in obj.rotation_euler):
            print(f"  ! {obj.name} is rotated. Apply rotation (Ctrl+A) so its box lines up with the axes.")
        lo, hi = world_bounds(obj)
        lo_all = Vector([min(a, b) for a, b in zip(lo_all, lo)])
        hi_all = Vector([max(a, b) for a, b in zip(hi_all, hi)])
        size_b = (hi - lo) * to_mm
        centre_b = (hi + lo) / 2 * to_mm
        part = {
            "name": obj.name,
            "label": str(obj.get("label", re.sub(r"[\s_.-]*\d+$", "", obj.name).replace("_", " ").capitalize())),
            "shape": prop(obj, "shape", SHAPES, "box"),
            # Shop: x = X, y = Z (up), z = -Y (towards the viewer).
            "size": [round(size_b.x, 1), round(size_b.z, 1), round(size_b.y, 1)],
            "position": [round(centre_b.x, 1), round(centre_b.z, 1), round(-centre_b.y, 1)],
            "material": prop(obj, "material", MATERIALS, "body"),
            "resize": {},
        }
        for axis in "xyz":
            mode = prop(obj, f"resize_{axis}", RESIZE_MODES, "anchor")
            if mode != "anchor":
                part["resize"][axis] = mode
        parts.append(part)

    if not parts:
        print("No mesh objects found. Put the pieces in a collection called 'Components'.")
        return

    width = (hi_all.x - lo_all.x) * to_mm
    depth = (hi_all.y - lo_all.y) * to_mm
    height = (hi_all.z - lo_all.z) * to_mm
    print(f"\n{len(parts)} components. Overall: width {width:.0f} mm, height {height:.0f} mm, depth {depth:.0f} mm")
    if abs(lo_all.z) * to_mm > 1:
        print(f"  ! The lowest point is at Z = {lo_all.z * to_mm:.0f} mm; move the piece so it stands on Z = 0.")
    for axis, lo_v, hi_v in (("X", lo_all.x, hi_all.x), ("Y", lo_all.y, hi_all.y)):
        if abs(lo_v + hi_v) * to_mm > 2:
            print(f"  ! The piece is not centred on {axis}; centre it on the origin.")

    out = json.dumps(parts, indent=2)
    print("\nPaste into the product's Components field:\n")
    print(out)
    if bpy.data.filepath:
        path = os.path.join(os.path.dirname(bpy.data.filepath), "components.json")
        with open(path, "w") as fh:
            fh.write(out + "\n")
        print(f"\nAlso written to {path}")


main()
