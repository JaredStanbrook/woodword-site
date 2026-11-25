// worker/components/shop/room.ts
//
// The living room the 3D piece stands in, so a customer can judge its size
// against things everyone knows. Everything is at real size, in metres:
//
//   walls      2.6 m high (a common ceiling), 120 mm thick
//   door       820 × 2040 mm leaf, handle at 1 m
//   sofa       2.0 m long, 0.9 m deep, seat at 450 mm, back at 850 mm
//   coffee     1.0 × 0.55 m, 420 mm high
//   windows    800 mm wide, sill at 950 mm, arched top at 2.35 m
//   plant      300 mm pot, 400 mm high, leaves to about 1 m
//   picture    500 × 700 mm, hung 250 mm above a low piece
//
// Two walls only, back (-z) and left (-x): a cut-away seen from the open
// corner, like a doll's house. The piece stands against the back wall when
// it is shallow (a console, a sideboard, shelving) and in the middle of the
// room when it is deep (a dining table). The room grows if the piece would
// not fit, so a piece never pokes through a wall.

import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Path,
  RepeatWrapping,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  SRGBColorSpace,
  type BufferGeometry,
  type Material,
} from "three";

const WALL = 0.12;
const SLAB = 0.06;
const GAP = 0.03; // between a piece and the wall behind it

/** Floorboards: pale oak planks, 180 mm wide, drawn once and tiled. */
function plankTexture(): CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f4f4f4";
  ctx.fillRect(0, 0, size, size);
  // One metre of floor per tile: five or six boards, ends staggered.
  const board = size * 0.18;
  let seed = 11;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let row = 0; row * board < size; row++) {
    const y = row * board;
    ctx.fillStyle = `rgba(120, 90, 60, ${0.03 + rand() * 0.06})`;
    ctx.fillRect(0, y, size, board);
    ctx.fillStyle = "rgba(80, 60, 40, 0.28)";
    ctx.fillRect(0, y, size, 2);
    const end = rand() * size;
    ctx.fillRect(end, y, 2, board);
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  return tex;
}

/** A window opening: a rectangle with a round top, `w` wide, `h` to the springing. */
function archShape(w: number, h: number, inset = 0): Shape | Path {
  const r = w / 2 - inset;
  const s = inset ? new Path() : new Shape();
  s.moveTo(-r, inset);
  s.lineTo(r, inset);
  s.lineTo(r, h);
  s.absarc(0, h, r, 0, Math.PI, false);
  s.lineTo(-r, inset);
  return s;
}

export interface RoomLayout {
  /** Where the room's centre is, in world metres, for the camera. */
  center: [number, number, number];
  /** Half the room's diagonal, for fitting the camera and the shadows. */
  radius: number;
}

/**
 * The room, rebuilt around a piece of the given size (mm). The piece stays
 * at the origin, as the viewer places it; the room moves around it.
 */
export class Room {
  readonly group = new Group();
  private disposables: { dispose(): void }[] = [];
  private box = new BoxGeometry(1, 1, 1);
  private cylinder = new CylinderGeometry(0.5, 0.5, 1, 32);
  private leaf = new SphereGeometry(1, 12, 8);
  private planks = plankTexture();
  private glassGeo: BufferGeometry;
  private frameGeo: BufferGeometry;
  private m: Record<string, Material>;
  private key = "";

  constructor() {
    const std = (color: string, roughness = 0.9) =>
      new MeshStandardMaterial({ color, roughness, metalness: 0 });
    this.m = {
      wall: std("#e8ddca"),
      wallTop: std("#cfc2ad"),
      skirting: std("#d8cab2", 0.7),
      floor: new MeshStandardMaterial({ color: "#d9bd94", map: this.planks, roughness: 0.75 }),
      slabEdge: std("#c9a97c"),
      door: std("#f4efe6", 0.6),
      doorFrame: std("#cdbfa7", 0.6),
      metal: new MeshStandardMaterial({ color: "#8a857c", roughness: 0.35, metalness: 0.8 }),
      sofa: std("#e9e3d8", 1),
      cushion: std("#d8cdb9", 1),
      table: std("#b58b5e", 0.7),
      rug: std("#cbc0ad", 1),
      pot: std("#c46f4e", 0.85),
      leaf: std("#4f8a3f", 0.7),
      frame: std("#3b3128", 0.6),
      mat: std("#f6f1e7", 1),
      art: std("#93a283", 1),
      glass: new MeshBasicMaterial({ color: "#fdf8ea" }),
      sash: std("#b89062", 0.7),
    };
    // Window: 800 mm wide, 1.0 m of straight side above the sill, then the arch.
    this.glassGeo = new ShapeGeometry(archShape(0.8, 1.0) as Shape, 24);
    const frame = archShape(0.8, 1.0) as Shape;
    frame.holes.push(archShape(0.8, 1.0, 0.05) as Path);
    this.frameGeo = new ExtrudeGeometry(frame, {
      depth: 0.04,
      bevelEnabled: false,
      curveSegments: 24,
    });
    this.disposables.push(
      this.box,
      this.cylinder,
      this.leaf,
      this.planks,
      this.glassGeo,
      this.frameGeo,
      ...Object.values(this.m),
    );
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
  }

  /** Lays the room out around a piece `w` × `h` × `d` mm. Cheap to call again. */
  update(w: number, h: number, d: number): RoomLayout {
    const W_ = w / 1000;
    const H_ = h / 1000;
    const D_ = d / 1000;
    const againstWall = d < 600;

    // Room size: a real living room, grown if the piece needs more.
    const H = Math.max(2.6, H_ + 0.4);
    const clearLeft = 1.7; // sofa (0.9) plus a way past it
    let W: number, D: number, xc: number, zc: number;
    if (againstWall) {
      xc = Math.max(clearLeft + W_ / 2, 2.3);
      W = Math.max(4.6, xc + W_ / 2 + 1.5); // door on the right
      D = 3.8;
      zc = GAP + D_ / 2;
    } else {
      xc = Math.max(clearLeft + 0.9 + W_ / 2, 2.6);
      W = Math.max(4.6, xc + W_ / 2 + 1.2);
      D = Math.max(3.8, D_ + 2.4);
      zc = Math.max(D / 2, 1.2 + D_ / 2);
    }

    const key = [W, D, H, xc, zc, againstWall, H_].join();
    if (key !== this.key) {
      this.key = key;
      this.build(W, D, H, xc, H_, againstWall);
    }
    this.planks.repeat.set(W + WALL, D + WALL);
    // Room space puts the corner of the walls at x = 0, z = 0; the piece sits
    // at (xc, zc) in it and at the origin in the world.
    this.group.position.set(-xc, 0, -zc);
    return {
      center: [W / 2 - xc, H / 2, D / 2 - zc],
      radius: Math.hypot(W, D, H) / 2,
    };
  }

  private add(
    material: Material,
    size: [number, number, number],
    pos: [number, number, number],
    geo: BufferGeometry = this.box,
    shadow = true,
  ) {
    const mesh = new Mesh(geo, material);
    mesh.scale.set(...size);
    mesh.position.set(...pos);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  private build(W: number, D: number, H: number, xc: number, pieceH: number, againstWall: boolean) {
    this.group.clear();
    const m = this.m;

    // Floor: a slab with its top at y = 0, running under both walls.
    this.add(
      m.floor,
      [W + WALL, SLAB, D + WALL],
      [(W - WALL) / 2, -SLAB / 2, (D - WALL) / 2],
    ).castShadow = false;
    // Walls cast no shadow: the light comes in over them, as through windows.
    this.add(m.wall, [W + WALL, H, WALL], [(W - WALL) / 2, H / 2, -WALL / 2], this.box, false);
    this.add(m.wall, [WALL, H, D], [-WALL / 2, H / 2, D / 2], this.box, false);
    this.add(
      m.wallTop,
      [W + WALL, 0.004, WALL],
      [(W - WALL) / 2, H + 0.002, -WALL / 2],
      this.box,
      false,
    );
    this.add(m.wallTop, [WALL, 0.004, D], [-WALL / 2, H + 0.002, D / 2], this.box, false);
    // Skirting, 90 mm high.
    this.add(m.skirting, [W, 0.09, 0.015], [W / 2, 0.045, 0.0075]);
    this.add(m.skirting, [0.015, 0.09, D], [0.0075, 0.045, D / 2]);

    // Door, near the right-hand end of the back wall.
    const dx = W - 0.95;
    this.add(m.door, [0.82, 2.04, 0.04], [dx, 1.02, 0.02]);
    this.add(m.doorFrame, [0.07, 2.11, 0.03], [dx - 0.445, 1.055, 0.015]);
    this.add(m.doorFrame, [0.07, 2.11, 0.03], [dx + 0.445, 1.055, 0.015]);
    this.add(m.doorFrame, [0.96, 0.07, 0.03], [dx, 2.075, 0.015]);
    // Two raised panels on the leaf.
    this.add(m.doorFrame, [0.56, 0.62, 0.008], [dx, 1.62, 0.043]);
    this.add(m.doorFrame, [0.56, 0.78, 0.008], [dx, 0.6, 0.043]);
    this.add(m.metal, [0.02, 0.06, 0.02], [dx - 0.33, 1.0, 0.06], this.cylinder);
    this.add(m.metal, [0.12, 0.02, 0.02], [dx - 0.3, 1.0, 0.075]);

    // Two arched windows in the left wall, over the sofa.
    for (const z of [D * 0.38, D * 0.72]) {
      const glass = this.add(m.glass, [1, 1, 1], [0.003, 0.95, z], this.glassGeo, false);
      glass.rotation.y = Math.PI / 2;
      const frame = this.add(m.sash, [1, 1, 1], [0.0, 0.95, z], this.frameGeo);
      frame.rotation.y = Math.PI / 2;
      // Glazing bars: one upright, two across.
      this.add(m.sash, [0.02, 1.4, 0.03], [0.02, 0.95 + 0.7, z]);
      this.add(m.sash, [0.02, 0.03, 0.75], [0.02, 1.3, z]);
      this.add(m.sash, [0.02, 0.03, 0.75], [0.02, 1.65, z]);
    }

    // Sofa against the left wall, facing into the room.
    const sz = D * 0.55;
    const sx = 0.45;
    this.add(m.sofa, [0.9, 0.3, 2.0], [sx, 0.21, sz]); // base, on 60 mm feet
    this.add(m.sofa, [0.2, 0.79, 2.0], [0.1, 0.455, sz]); // back to 850 mm
    this.add(m.sofa, [0.9, 0.62, 0.18], [sx, 0.37, sz - 0.91]); // arms
    this.add(m.sofa, [0.9, 0.62, 0.18], [sx, 0.37, sz + 0.91]);
    for (const dz of [-0.41, 0.41]) {
      this.add(m.cushion, [0.68, 0.09, 0.8], [0.54, 0.405, sz + dz]); // seat, top at 450 mm
      this.add(m.cushion, [0.16, 0.38, 0.78], [0.29, 0.64, sz + dz]); // back cushion
    }
    for (const dz of [-0.95, 0.95])
      for (const x of [0.08, 0.82])
        this.add(m.table, [0.04, 0.06, 0.04], [x, 0.03, sz + dz], this.cylinder);

    // Rug, and a coffee table in front of the sofa when the middle is free.
    this.add(m.rug, [1.7, 0.01, 2.3], [1.25, 0.005, sz]).castShadow = false;
    if (againstWall) {
      this.add(m.table, [0.55, 0.03, 1.0], [1.45, 0.405, sz]);
      for (const dx2 of [-0.24, 0.24])
        for (const dz of [-0.46, 0.46])
          this.add(m.table, [0.035, 0.39, 0.035], [1.45 + dx2, 0.195, sz + dz]);
      // A book on it: 240 × 170 × 30 mm.
      this.add(m.art, [0.17, 0.03, 0.24], [1.4, 0.435, sz - 0.2]);
    }

    // Plant in a pot by the end of the sofa.
    const px = 0.45;
    const pz = sz + 1.35;
    this.add(m.pot, [0.3, 0.4, 0.3], [px, 0.2, pz], this.cylinder);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const tilt = 0.25 + (i % 3) * 0.15;
      const leaf = this.add(m.leaf, [0.045, 0.34, 0.012], [px, 0.68, pz], this.leaf);
      leaf.rotation.set(Math.cos(a) * tilt, a, Math.sin(a) * tilt, "YXZ");
      leaf.position.x += Math.sin(a) * 0.06;
      leaf.position.z += Math.cos(a) * 0.06;
    }

    // A picture over a low piece against the wall: 500 × 700 mm, 250 mm up.
    const bottom = pieceH + 0.25;
    if (againstWall && bottom + 0.7 < H - 0.1) {
      this.add(m.frame, [0.5, 0.7, 0.03], [xc, bottom + 0.35, 0.015]);
      this.add(m.mat, [0.42, 0.62, 0.005], [xc, bottom + 0.35, 0.032], this.box, false);
      this.add(m.art, [0.28, 0.44, 0.005], [xc, bottom + 0.35, 0.036], this.box, false);
    }
  }
}
