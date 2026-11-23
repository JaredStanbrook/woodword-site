# Blender models

Each product has a component model: a list of named pieces (top, legs, doors),
each with its size, position and **resize rules**. That list drives the 3D
view, the price (timber volume) and the workshop cut list. A GLB exported from
Blender is optional on top: when a product has one, the 3D view shows it and
resizes each object named after a component; without one, it draws the
components as boxes and cylinders.

## Modelling conventions

1. **One object per physical piece.** Give each a unique name: `top`,
   `leg_1`…`leg_4`, `door_left`. These names are how the shop finds the
   object in the GLB, so do not rename them after uploading.
2. **Apply rotation and scale** (Ctrl+A → All Transforms). Resizing works
   along the world axes; a rotated object would be stretched the wrong way.
3. **Stand the piece on the origin.** Floor at Z = 0, centred on X and Y.
   Width runs along X, depth along Y, height along Z. Metres, unit scale 1.
4. **Keep it low-poly.** The 3D view runs on phones. Bevels are fine; a
   few thousand triangles for the whole piece is plenty.
5. Optional, per object (Object Properties → Custom Properties):

   | Property                             | Values                                               | Default                 |
   | ------------------------------------ | ---------------------------------------------------- | ----------------------- |
   | `label`                              | Workshop name shared by identical pieces, e.g. `Leg` | name without its number |
   | `shape`                              | `box`, `cylinder` (upright)                          | `box`                   |
   | `material`                           | `body`, `accent`, `metal`, `glass`                   | `body`                  |
   | `resize_x` / `resize_y` / `resize_z` | see below                                            | `anchor`                |

   `resize_x` is width, `resize_y` is **height**, `resize_z` is depth (the
   shop's axes, not Blender's).

## Resize rules

How a piece follows a change in one dimension:

- **anchor** (default) — each end keeps its distance to the nearer outside
  face. A top or rail that crosses the middle grows; a leg near one side moves
  with that side at its original section; a leg from floor to near the top
  gets taller. Right for most parts.
- **move** — keeps its size; its centre is anchored the same way.
- **spread** — keeps its size; its centre moves in proportion. Middle shelves,
  so they stay evenly spaced.
- **scale** — size and position in proportion.
- **fixed** — never changes. For a small part sitting on the centre line, such
  as a handle where two doors meet (anchor would stretch it).

Two doors that meet in the middle: model each door's inner edge exactly on
X = 0, and they widen correctly.

The product editor shows the piece at its standard and largest size side by
side — check the largest one looks right before publishing.

## Export → shop

1. Run `scripts/blender/export_components.py` (Scripting tab → Run Script, or
   `blender piece.blend --background --python scripts/blender/export_components.py`).
   It prints the components JSON and the overall size, warns about rotated or
   off-centre objects, and writes `components.json` next to the `.blend`.
2. In the admin product editor, paste the JSON into **Components**, and enter
   the printed width/height/depth as the **standard** dimensions. Saving
   refuses a model that does not fill the standard size, so a mismatch shows up
   here rather than in the workshop.
3. File → Export → glTF 2.0: format **glTF Binary (.glb)**, Include → Selected
   or Visible objects, Transform → **+Y Up** (the default), Mesh → Apply
   Modifiers; Compression (Draco) on for anything over ~1 MB. Upload it under
   **Images and 3D model**. Each upload is a new version; past orders keep the
   one they were sold with.
4. Upload the `.blend` too. It is stored privately for later changes.

Materials in the GLB are kept, but an option that paints a slot (a timber
choice painting `body`) tints the objects of that slot to the chosen colour.
Use light, mostly neutral textures so the tint reads true.

## Order → Blender

Each order has **Manufacturing spec** (printable cut list) and **Spec JSON**
buttons. The JSON has every component's final size and position. To get a
Blender file of exactly what was ordered:

```bash
blender piece.blend --background --python scripts/blender/apply_spec.py -- HW-7K3P9Q-spec.json
# an order with several pieces: add the item number (1-based)
blender piece.blend --background --python scripts/blender/apply_spec.py -- HW-7K3P9Q-spec.json 2
```

It saves `piece-HW-7K3P9Q-1.blend` beside the original and leaves the original
untouched. Objects the spec does not name (decoration, a floor plane) are not
moved.
