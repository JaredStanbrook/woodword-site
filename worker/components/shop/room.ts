// worker/components/shop/room.ts
//
// The living room the 3D piece stands in, so a customer can judge its size
// against things everyone knows. Everything is at real size, in metres:
//
//   room       square, 4.4 m a side; walls 2.6 m high (a common ceiling)
//   door       820 × 2040 mm leaf, handle at 1 m
//   sofa       2.0 m long, 0.9 m deep, seat at 450 mm, back at 850 mm
//   coffee     1.0 × 0.55 m, 420 mm high, a book on it
//   windows    800 mm wide, sill at 950 mm, arched top at 2.35 m
//   lamp       1.6 m floor lamp
//   shelf      800 mm, at 1.5 m, books 180–240 mm tall
//   plant      300 mm pot, 420 mm high, leaves to about 1.1 m
//   picture    500 × 700 mm, hung 250 mm above a low piece
//
// Two walls only, back (-z) and left (-x): a cut-away seen from the open
// corner, like a doll's house. The piece stands against the back wall when
// it is shallow (a console, a sideboard, shelving) and in the middle of the
// room when it is deep (a dining table). The room grows, staying square, if
// the piece would not fit, so a piece never pokes through a wall.

import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
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
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

const WALL = 0.12;
const SLAB = 0.1;
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
    ctx.fillStyle = `rgba(120, 90, 60, ${0.02 + rand() * 0.05})`;
    ctx.fillRect(0, y, size, board);
    // A few long grain streaks per board.
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = `rgba(110, 80, 50, ${0.03 + rand() * 0.04})`;
      ctx.fillRect(0, y + rand() * board, size, 1 + rand() * 2);
    }
    ctx.fillStyle = "rgba(80, 60, 40, 0.22)";
    ctx.fillRect(0, y, size, 2);
    ctx.fillRect(rand() * size, y, 2, board);
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.anisotropy = 4;
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

type V3 = [number, number, number];

/**
 * The room, rebuilt around a piece of the given size (mm). The piece stays
 * at the origin, as the viewer places it; the room moves around it.
 */
export class Room {
  readonly group = new Group();
  private disposables: { dispose(): void }[] = [];
  /** Geometry made for one layout, freed when the room is laid out again. */
  private built: { dispose(): void }[] = [];
  private box = new BoxGeometry(1, 1, 1);
  private cylinder = new CylinderGeometry(0.5, 0.5, 1, 32);
  private pot = new CylinderGeometry(0.5, 0.38, 1, 32);
  private shade = new CylinderGeometry(0.36, 0.5, 1, 32, 1, true);
  private leaf = new SphereGeometry(1, 14, 10);
  private planks = plankTexture();
  private glassGeo: BufferGeometry;
  private frameGeo: BufferGeometry;
  private m: Record<string, Material>;
  private floorMats: Material[];
  private wallMats: Material[];
  private key = "";

  constructor() {
    const std = (color: string, roughness = 0.9) =>
      new MeshStandardMaterial({ color, roughness, metalness: 0 });
    this.m = {
      wall: std("#ede4d3"),
      wallTop: std("#cbbda5"),
      skirting: std("#e2d6c1", 0.7),
      floor: new MeshStandardMaterial({ color: "#dcc19a", map: this.planks, roughness: 0.7 }),
      slabEdge: std("#b58f62", 0.8),
      door: std("#f5f0e7", 0.55),
      doorFrame: std("#d6c9b2", 0.6),
      metal: new MeshStandardMaterial({ color: "#a39a8b", roughness: 0.3, metalness: 0.85 }),
      sofa: std("#e6ded0", 1),
      cushion: std("#d6c9b2", 1),
      throw: std("#a9b59a", 1),
      wood: std("#b9905f", 0.65),
      rug: std("#d1c6b3", 1),
      pot: std("#c9734f", 0.8),
      soil: std("#5a4636", 1),
      leaf: std("#5a9348", 0.6),
      frame: std("#3d3229", 0.6),
      mat: std("#f7f2e8", 1),
      art: std("#9aa88a", 1),
      art2: std("#d9a97f", 1),
      glass: new MeshBasicMaterial({ color: "#fffaf0" }),
      sash: std("#b88f61", 0.65),
      shade: new MeshStandardMaterial({
        color: "#f6eedc",
        emissive: "#ffe6b8",
        emissiveIntensity: 0.35,
        roughness: 1,
        side: DoubleSide,
      }),
      sun: new MeshBasicMaterial({
        color: "#fff0c4",
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
      books: std("#c98f8f", 1),
      books2: std("#9fb3c8", 1),
      books3: std("#e2c47c", 1),
      books4: std("#b7a7c9", 1),
    };
    // BoxGeometry faces: +x, -x, +y, -y, +z, -z. Oak planks on top of the
    // floor slab, end grain round its sides; a darker cap on top of a wall.
    const m = this.m;
    this.floorMats = [m.slabEdge, m.slabEdge, m.floor, m.slabEdge, m.slabEdge, m.slabEdge];
    this.wallMats = [m.wall, m.wall, m.wallTop, m.wall, m.wall, m.wall];
    // Window: 800 mm wide, 1.0 m of straight side above the sill, then the arch.
    this.glassGeo = new ShapeGeometry(archShape(0.8, 1.0) as Shape, 24);
    const frame = archShape(0.8, 1.0) as Shape;
    frame.holes.push(archShape(0.8, 1.0, 0.05) as Path);
    this.frameGeo = new ExtrudeGeometry(frame, {
      depth: 0.05,
      bevelEnabled: false,
      curveSegments: 24,
    });
    this.disposables.push(
      this.box,
      this.cylinder,
      this.pot,
      this.shade,
      this.leaf,
      this.planks,
      this.glassGeo,
      this.frameGeo,
      ...Object.values(this.m),
    );
  }

  dispose() {
    for (const d of [...this.disposables, ...this.built]) d.dispose();
  }

  /** Lays the room out around a piece `w` × `h` × `d` mm. Cheap to call again. */
  update(w: number, h: number, d: number): RoomLayout {
    const pw = w / 1000;
    const ph = h / 1000;
    const pd = d / 1000;
    const againstWall = d < 600;

    // A square room of a real living room's size, grown if the piece needs
    // more. The sofa and a way past it (1.7 m) keep the left of the room.
    const H = Math.max(2.6, ph + 0.4);
    let S: number, xc: number, zc: number;
    if (againstWall) {
      xc = Math.max(1.75 + pw / 2, 2.3);
      S = Math.max(4.4, xc + pw / 2 + 1.5); // the door to the right of it
      zc = GAP + pd / 2;
    } else {
      xc = Math.max(2.6 + pw / 2, 2.6);
      S = Math.max(4.4, xc + pw / 2 + 1.2, pd + 2.4);
      zc = S / 2;
    }

    const key = [S, H, xc, againstWall, ph].join();
    if (key !== this.key) {
      this.key = key;
      this.build(S, H, xc, ph, againstWall);
    }
    this.planks.repeat.set(S + WALL, S + WALL);
    // Room space puts the corner of the walls at x = 0, z = 0; the piece sits
    // at (xc, zc) in it and at the origin in the world.
    this.group.position.set(-xc, 0, -zc);
    return {
      center: [S / 2 - xc, H / 2, S / 2 - zc],
      radius: Math.hypot(S, S, H) / 2,
    };
  }

  private add(
    material: Material | Material[],
    size: V3,
    pos: V3,
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

  /** A soft-edged block at its true size (rounded corners do not scale well). */
  private soft(material: Material, size: V3, pos: V3, radius = 0.05) {
    const geo = new RoundedBoxGeometry(...size, 4, Math.min(radius, Math.min(...size) / 2));
    this.built.push(geo);
    return this.add(material, [1, 1, 1], pos, geo);
  }

  private build(S: number, H: number, xc: number, pieceH: number, againstWall: boolean) {
    this.group.clear();
    for (const g of this.built) g.dispose();
    this.built = [];
    const m = this.m;

    // Floor: an oak slab, its top at y = 0, running under both walls.
    const floor = this.add(
      this.floorMats,
      [S + WALL, SLAB, S + WALL],
      [(S - WALL) / 2, -SLAB / 2, (S - WALL) / 2],
    );
    floor.castShadow = false;
    // Walls cast no shadow: the light comes in over them, as through windows.
    this.add(
      this.wallMats,
      [S + WALL, H, WALL],
      [(S - WALL) / 2, H / 2, -WALL / 2],
      this.box,
      false,
    );
    this.add(this.wallMats, [WALL, H, S], [-WALL / 2, H / 2, S / 2], this.box, false);
    // Skirting, 90 mm high.
    this.add(m.skirting, [S, 0.09, 0.016], [S / 2, 0.045, 0.008]);
    this.add(m.skirting, [0.016, 0.09, S], [0.008, 0.045, S / 2]);

    this.door(S - 0.95);
    for (const z of [S * 0.42, S * 0.74]) this.window(z);
    this.sunlight(S);

    // Sofa against the left wall, facing into the room.
    const sz = S * 0.58;
    this.sofa(sz);
    // Rug, and a coffee table in front of the sofa when the middle is free.
    this.soft(m.rug, [1.8, 0.012, 2.4], [1.3, 0.006, sz], 0.006).castShadow = false;
    if (againstWall) this.coffeeTable(1.5, sz);
    this.lamp(0.32, sz - 1.32);
    this.plant(0.42, sz + 1.38);

    // A shelf of books on the back wall, between the corner and the piece.
    if (xc > 1.9) this.shelf(Math.min(0.95, xc - 1.2), 1.45);

    // A picture over a low piece against the wall: 500 × 700 mm, 250 mm up.
    const bottom = pieceH + 0.25;
    if (againstWall && bottom + 0.7 < H - 0.1) {
      const y = bottom + 0.35;
      this.add(m.frame, [0.5, 0.7, 0.03], [xc, y, 0.015]);
      this.add(m.mat, [0.43, 0.63, 0.004], [xc, y, 0.032], this.box, false);
      this.add(m.art, [0.28, 0.42, 0.004], [xc, y + 0.03, 0.035], this.box, false);
      this.add(m.art2, [0.12, 0.12, 0.004], [xc + 0.06, y - 0.1, 0.037], this.box, false);
    }
  }

  private door(dx: number) {
    const m = this.m;
    this.add(m.door, [0.82, 2.04, 0.04], [dx, 1.02, 0.02]);
    // Architrave, and two raised panels on the leaf.
    this.add(m.doorFrame, [0.07, 2.11, 0.03], [dx - 0.445, 1.055, 0.015]);
    this.add(m.doorFrame, [0.07, 2.11, 0.03], [dx + 0.445, 1.055, 0.015]);
    this.add(m.doorFrame, [0.96, 0.07, 0.03], [dx, 2.075, 0.015]);
    this.add(m.doorFrame, [0.56, 0.62, 0.008], [dx, 1.62, 0.043]);
    this.add(m.doorFrame, [0.56, 0.78, 0.008], [dx, 0.6, 0.043]);
    // Lever handle at 1 m.
    this.add(m.metal, [0.05, 0.05, 0.012], [dx - 0.33, 1.0, 0.05], this.cylinder).rotation.x =
      Math.PI / 2;
    this.add(m.metal, [0.13, 0.018, 0.018], [dx - 0.3, 1.0, 0.07]);
  }

  private window(z: number) {
    const m = this.m;
    const glass = this.add(m.glass, [1, 1, 1], [0.003, 0.95, z], this.glassGeo, false);
    glass.rotation.y = Math.PI / 2;
    const frame = this.add(m.sash, [1, 1, 1], [0, 0.95, z], this.frameGeo);
    frame.rotation.y = Math.PI / 2;
    // Glazing bars: one upright, two across; and a sill.
    this.add(m.sash, [0.025, 1.4, 0.03], [0.02, 1.65, z]);
    this.add(m.sash, [0.025, 0.03, 0.74], [0.02, 1.3, z]);
    this.add(m.sash, [0.025, 0.03, 0.74], [0.02, 1.65, z]);
    this.add(m.sash, [0.08, 0.03, 0.96], [0.04, 0.935, z]);
  }

  /** Daylight from each window, falling past the sofa onto the rug and floor. */
  private sunlight(S: number) {
    for (const z of [S * 0.42, S * 0.74]) {
      const patch = this.add(
        this.m.sun,
        [1.1, 1.3, 1],
        [0.95, 0.014, z + 0.3],
        this.glassGeo,
        false,
      );
      patch.receiveShadow = false;
      // Lie flat, the arch pointing into the room and a little towards the front.
      patch.rotation.set(-Math.PI / 2, 0, -Math.PI / 2 - 0.3);
    }
  }

  private sofa(z: number) {
    const m = this.m;
    this.soft(m.sofa, [0.9, 0.3, 2.0], [0.45, 0.21, z], 0.06); // base, on 60 mm feet
    this.soft(m.sofa, [0.22, 0.79, 2.0], [0.11, 0.455, z], 0.08); // back, to 850 mm
    for (const dz of [-0.9, 0.9]) this.soft(m.sofa, [0.9, 0.62, 0.2], [0.45, 0.37, z + dz], 0.08);
    for (const dz of [-0.4, 0.4]) {
      this.soft(m.cushion, [0.68, 0.1, 0.79], [0.55, 0.405, z + dz], 0.045); // seat, top at 450
      this.soft(m.cushion, [0.17, 0.42, 0.77], [0.3, 0.66, z + dz], 0.07);
    }
    // A throw over one arm, and a scatter cushion.
    this.soft(m.throw, [0.7, 0.04, 0.24], [0.5, 0.69, z + 0.9], 0.02);
    const pillow = this.soft(m.throw, [0.12, 0.38, 0.38], [0.36, 0.62, z - 0.6], 0.06);
    pillow.rotation.y = 0.25;
    for (const dz of [-0.95, 0.95])
      for (const x of [0.08, 0.82])
        this.add(m.wood, [0.04, 0.06, 0.04], [x, 0.03, z + dz], this.cylinder);
  }

  private coffeeTable(x: number, z: number) {
    const m = this.m;
    this.soft(m.wood, [0.55, 0.03, 1.0], [x, 0.405, z], 0.012);
    for (const dx of [-0.23, 0.23])
      for (const dz of [-0.45, 0.45])
        this.add(m.wood, [0.035, 0.39, 0.035], [x + dx, 0.195, z + dz], this.cylinder);
    // A book, 240 × 170 × 30 mm, and a cup.
    this.add(m.books2, [0.17, 0.03, 0.24], [x - 0.05, 0.435, z - 0.22]).rotation.y = 0.2;
    this.add(m.mat, [0.08, 0.09, 0.08], [x + 0.1, 0.465, z + 0.2], this.cylinder);
  }

  private lamp(x: number, z: number) {
    const m = this.m;
    this.add(m.metal, [0.3, 0.025, 0.3], [x, 0.0125, z], this.cylinder);
    this.add(m.metal, [0.022, 1.32, 0.022], [x, 0.68, z], this.cylinder);
    this.add(m.shade, [0.44, 0.3, 0.44], [x, 1.46, z], this.shade, false);
  }

  private plant(x: number, z: number) {
    const m = this.m;
    this.add(m.pot, [0.3, 0.42, 0.3], [x, 0.21, z], this.pot);
    this.add(m.soil, [0.27, 0.01, 0.27], [x, 0.41, z], this.cylinder, false);
    // Long arching leaves, each tipped out a different way.
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + (i % 2) * 0.3;
      const tilt = 0.2 + ((i * 7) % 5) * 0.09;
      const len = 0.28 + ((i * 3) % 4) * 0.04;
      const leaf = this.add(m.leaf, [0.05, len, 0.012], [x, 0.42 + len * 0.95, z], this.leaf);
      leaf.rotation.set(Math.cos(a) * tilt, a, Math.sin(a) * tilt, "YXZ");
      leaf.position.x += Math.sin(a) * tilt * len;
      leaf.position.z += Math.cos(a) * tilt * len;
    }
  }

  private shelf(x: number, y: number) {
    const m = this.m;
    this.add(m.wood, [0.8, 0.025, 0.2], [x, y, 0.1]);
    const covers = [m.books, m.books2, m.books3, m.books4, m.books2, m.books];
    let bx = x - 0.36;
    covers.forEach((cover, i) => {
      const bh = 0.18 + ((i * 5) % 4) * 0.02;
      const bt = 0.03 + (i % 3) * 0.008;
      this.add(cover, [bt, bh, 0.16], [bx + bt / 2, y + 0.0125 + bh / 2, 0.1]);
      bx += bt + 0.004;
    });
    // The last one leaning.
    this.add(m.books3, [0.03, 0.2, 0.15], [bx + 0.05, y + 0.11, 0.1]).rotation.z = -0.35;
    // A small vase at the other end.
    this.add(m.pot, [0.09, 0.16, 0.09], [x + 0.28, y + 0.0925, 0.1], this.pot);
  }
}
