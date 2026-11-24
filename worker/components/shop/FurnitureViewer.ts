// worker/components/shop/FurnitureViewer.ts
//
// <furniture-viewer>: the interactive 3D model on a product page.
//
// Loaded only on product pages (an ISLANDS entry in main.ts), and only builds
// its WebGL scene once it scrolls near the viewport. Until then, and on any
// device without WebGL, the server's line drawing stays in place.
//
// The piece is built one of two ways:
//   - from the product's GLB (exported from Blender), moving and scaling each
//     node whose name matches a component in the model record;
//   - with no GLB, from the component boxes themselves, which is also what
//     the admin preview uses before a model is uploaded.
// Either way the resizing comes from lib/furniture.ts — the same rules that
// price the piece and write the cut list — so the model never stretches as a
// whole and what is shown is what is built.
//
// It renders on demand rather than every frame: nothing is drawn while
// nothing moves, which matters on a phone.

import {
  ACESFilmicToneMapping,
  Box3,
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  RepeatWrapping,
  Scene,
  ShadowMaterial,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Material,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

import { normaliseSelection, resizeParts, chosenOptions } from "@server/lib/furniture";
import type { MaterialSlot, Selection } from "@server/schema/furniture.config";
import { furnitureStore, readFurnitureData, type FurnitureData } from "./store";

const DEFAULT_COLORS: Record<MaterialSlot, string> = {
  body: "#b98a5a",
  accent: "#3d3029",
  metal: "#6e6e6e",
  glass: "#d7e6ea",
};

const MM = 1 / 1000;

/** A pale, procedurally drawn grain, tinted by the material colour. */
function woodTexture(): CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f2f2f2";
  ctx.fillRect(0, 0, size, size);
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 90; i++) {
    const y0 = rand() * size;
    const amp = 2 + rand() * 9;
    const freq = 0.004 + rand() * 0.01;
    const phase = rand() * Math.PI * 2;
    ctx.strokeStyle = `rgba(90, 70, 50, ${0.05 + rand() * 0.12})`;
    ctx.lineWidth = 0.6 + rand() * 2.2;
    ctx.beginPath();
    for (let x = 0; x <= size; x += 8) {
      const y = y0 + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 3.1) * amp * 0.25;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  return tex;
}

interface GlbNode {
  object: Object3D;
  partIndex: number;
  origPosition: Vector3;
  origScale: Vector3;
  origCenter: Vector3;
}

class FurnitureViewer extends HTMLElement {
  private data: FurnitureData | null = null;
  private renderer?: WebGLRenderer;
  private scene?: Scene;
  private camera?: PerspectiveCamera;
  private controls?: OrbitControls;
  private light?: DirectionalLight;
  private piece = new Group();
  private materials = new Map<MaterialSlot, MeshStandardMaterial>();
  private meshes = new Map<string, Mesh>();
  private glbNodes: GlbNode[] = [];
  private disposables: { dispose(): void }[] = [];
  private frame = 0;
  private resizeObserver?: ResizeObserver;
  private intersection?: IntersectionObserver;
  private unsubscribe?: () => void;
  private abort = new AbortController();
  private fitted = false;

  connectedCallback() {
    this.data = readFurnitureData();
    if (!this.data) return;
    this.abort = new AbortController();

    // Build when it is about to be seen, not on page load.
    this.intersection = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          this.intersection?.disconnect();
          this.init().catch((err) => console.warn("[viewer] 3D view unavailable:", err));
        }
      },
      { rootMargin: "200px" },
    );
    this.intersection.observe(this);
  }

  disconnectedCallback() {
    this.abort.abort();
    this.intersection?.disconnect();
    this.resizeObserver?.disconnect();
    this.unsubscribe?.();
    cancelAnimationFrame(this.frame);
    this.controls?.dispose();
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer?.domElement.remove();
    this.renderer = undefined;
  }

  private selection(): Selection {
    const data = this.data!;
    return normaliseSelection(data, furnitureStore.get() ?? data.selection);
  }

  private async init() {
    const data = this.data!;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return; // No WebGL: the line drawing stays.
    }
    this.renderer = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    const canvas = renderer.domElement;
    canvas.className = "absolute inset-0 h-full w-full opacity-0 transition-opacity duration-700";
    canvas.setAttribute("aria-hidden", "true");
    this.insertBefore(canvas, this.firstChild);

    const scene = (this.scene = new Scene());
    const pmrem = new PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    this.disposables.push(env, pmrem);

    this.camera = new PerspectiveCamera(32, 1, 0.05, 60);

    scene.add(new HemisphereLight(0xfff6ea, 0x6b5a4a, 0.6));
    const light = (this.light = new DirectionalLight(0xffffff, 1.6));
    light.position.set(2.2, 4, 3);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.bias = -0.0004;
    light.shadow.radius = 6;
    scene.add(light, light.target);

    const groundGeo = new PlaneGeometry(30, 30);
    const groundMat = new ShadowMaterial({ opacity: 0.18 });
    const ground = new Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    this.disposables.push(groundGeo, groundMat);

    this.createMaterials();
    scene.add(this.piece);

    let usedGlb = false;
    if (data.modelUrl) usedGlb = await this.loadGlb(data.modelUrl).catch(() => false);
    if (!this.renderer) return; // disconnected while loading
    if (!usedGlb) this.buildFromParts();

    const controls = (this.controls = new OrbitControls(this.camera, canvas));
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minPolarAngle = 0.12;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.addEventListener("change", () => this.requestRender());
    // Vertical drags keep scrolling the page on a phone; sideways ones turn
    // the piece, and two fingers zoom.
    canvas.style.touchAction = "pan-y";

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this);
    this.resize();

    this.apply(this.selection());
    this.unsubscribe = furnitureStore.subscribe((sel) => this.apply(normaliseSelection(data, sel)));

    this.querySelector("[data-viewer-reset]")?.addEventListener(
      "click",
      () => {
        this.fitCamera(this.selection());
        this.requestRender();
      },
      { signal: this.abort.signal },
    );

    this.renderNow();
    canvas.classList.remove("opacity-0");
    const fallback = this.querySelector<HTMLElement>("[data-viewer-fallback]");
    if (fallback) {
      fallback.style.opacity = "0";
      // Out of the way entirely once faded, for touch and screen readers alike.
      fallback.addEventListener("transitionend", () => (fallback.hidden = true), { once: true });
    }
    for (const el of this.querySelectorAll<HTMLElement>(
      "[data-viewer-hint], [data-viewer-reset]",
    )) {
      el.classList.remove("hidden");
      el.classList.add(el.matches("button") ? "inline-flex" : "block");
    }
  }

  private createMaterials() {
    const grain = woodTexture();
    this.disposables.push(grain);
    const wood = (color: string) =>
      new MeshStandardMaterial({ color, map: grain, roughness: 0.62, metalness: 0 });
    this.materials.set("body", wood(DEFAULT_COLORS.body));
    this.materials.set("accent", wood(DEFAULT_COLORS.accent));
    this.materials.set(
      "metal",
      new MeshStandardMaterial({ color: DEFAULT_COLORS.metal, roughness: 0.35, metalness: 0.85 }),
    );
    this.materials.set(
      "glass",
      new MeshPhysicalMaterial({
        color: DEFAULT_COLORS.glass,
        roughness: 0.05,
        metalness: 0,
        transparent: true,
        opacity: 0.35,
      }),
    );
    for (const m of this.materials.values()) this.disposables.push(m);
  }

  private buildFromParts() {
    const box = new BoxGeometry(1, 1, 1);
    const cylinder = new CylinderGeometry(0.5, 0.5, 1, 32);
    this.disposables.push(box, cylinder);
    for (const part of this.data!.model.parts) {
      const mesh = new Mesh(
        part.shape === "cylinder" ? cylinder : box,
        this.materials.get(part.material ?? "body"),
      );
      mesh.name = part.name;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.meshes.set(part.name, mesh);
      this.piece.add(mesh);
    }
  }

  /** True when the GLB loaded and at least one node matched a component. */
  private async loadGlb(url: string): Promise<boolean> {
    const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([
      import("three/examples/jsm/loaders/GLTFLoader.js"),
      import("three/examples/jsm/loaders/DRACOLoader.js"),
    ]);
    const loader = new GLTFLoader();
    const draco = new DRACOLoader().setDecoderPath("/draco/");
    loader.setDRACOLoader(draco);
    this.disposables.push(draco);

    const gltf = await loader.loadAsync(url);
    const root = gltf.scene;
    root.updateMatrixWorld(true);

    const parts = this.data!.model.parts;
    parts.forEach((part, partIndex) => {
      const object = root.getObjectByName(part.name);
      if (!object) return;
      const bounds = new Box3().setFromObject(object);
      this.glbNodes.push({
        object,
        partIndex,
        origPosition: object.position.clone(),
        origScale: object.scale.clone(),
        origCenter: bounds.getCenter(new Vector3()),
      });
      object.traverse((child) => {
        if (child instanceof Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.userData.slot = part.material ?? "body";
        }
      });
    });
    if (this.glbNodes.length === 0) {
      console.warn("[viewer] no GLB node is named after a component; building from the parts list");
      return false;
    }
    root.traverse((child) => {
      if (child instanceof Mesh) {
        this.disposables.push(child.geometry);
        const mats: Material[] = Array.isArray(child.material) ? child.material : [child.material];
        for (const m of mats) this.disposables.push(m);
      }
    });
    this.piece.add(root);
    return true;
  }

  private apply(sel: Selection) {
    if (!this.renderer || !this.data) return;
    const data = this.data;
    const resolved = resizeParts(data, sel);

    if (this.glbNodes.length) {
      for (const node of this.glbNodes) {
        const std = data.model.parts[node.partIndex];
        const now = resolved[node.partIndex];
        const ratio = new Vector3(
          now.size[0] / std.size[0],
          now.size[1] / std.size[1],
          now.size[2] / std.size[2],
        );
        const center = new Vector3(
          now.position[0] * MM,
          now.position[1] * MM,
          now.position[2] * MM,
        );
        // Keep the node's offset from its own centre, scaled with it, so a
        // node whose origin is not at its middle still lands in the right place.
        const offset = node.origPosition.clone().sub(node.origCenter).multiply(ratio);
        node.object.position.copy(center.add(offset));
        node.object.scale.copy(node.origScale.clone().multiply(ratio));
      }
    } else {
      for (const part of resolved) {
        const mesh = this.meshes.get(part.name);
        if (!mesh) continue;
        mesh.scale.set(part.size[0] * MM, part.size[1] * MM, part.size[2] * MM);
        mesh.position.set(part.position[0] * MM, part.position[1] * MM, part.position[2] * MM);
      }
    }

    // Colour each material slot from the option that paints it.
    const paints = new Map<MaterialSlot, string>();
    for (const o of chosenOptions(data, sel)) {
      const group = data.options.find((g) => g.id === o.groupId);
      if (group?.paints && o.choice.color) paints.set(group.paints, o.choice.color);
    }
    for (const [slot, mat] of this.materials) {
      mat.color = new Color(paints.get(slot) ?? DEFAULT_COLORS[slot]);
    }
    if (this.glbNodes.length && paints.size) {
      this.piece.traverse((child) => {
        if (child instanceof Mesh && paints.has(child.userData.slot)) {
          const mats: Material[] = Array.isArray(child.material)
            ? child.material
            : [child.material];
          for (const m of mats) {
            if ("color" in m && m.color instanceof Color)
              m.color.set(paints.get(child.userData.slot)!);
          }
        }
      });
    }

    this.updateShadowBounds(sel);
    if (!this.fitted) {
      this.fitCamera(sel);
      this.fitted = true;
    } else {
      // Follow the piece's middle as it grows, without moving the camera.
      this.controls?.target.set(0, (sel.height * MM) / 2, 0);
      this.controls?.update();
    }
    this.requestRender();
  }

  private updateShadowBounds(sel: Selection) {
    const light = this.light!;
    const r = (Math.max(sel.width, sel.depth, sel.height) * MM) / 2 + 0.6;
    const cam = light.shadow.camera;
    cam.left = cam.bottom = -r;
    cam.right = cam.top = r;
    cam.near = 0.1;
    cam.far = 12;
    cam.updateProjectionMatrix();
    light.target.position.set(0, 0, 0);
  }

  private fitCamera(sel: Selection) {
    const camera = this.camera!;
    const w = sel.width * MM;
    const h = sel.height * MM;
    const d = sel.depth * MM;
    const radius = Math.sqrt(w * w + h * h + d * d) / 2;
    const fov = (camera.fov * Math.PI) / 180;
    const fitHeight = radius / Math.sin(fov / 2);
    const fitWidth = fitHeight / Math.min(1, camera.aspect);
    const distance = Math.max(fitHeight, fitWidth) * 1.02;
    const target = new Vector3(0, h / 2, 0);
    const dir = new Vector3(1, 0.62, 1.35).normalize();
    camera.position.copy(target.clone().add(dir.multiplyScalar(distance)));
    camera.near = distance / 100;
    camera.far = distance * 20;
    camera.updateProjectionMatrix();
    if (this.controls) {
      this.controls.target.copy(target);
      this.controls.minDistance = radius * 1.2;
      this.controls.maxDistance = distance * 2.5;
      this.controls.update();
    }
  }

  private resize() {
    if (!this.renderer || !this.camera) return;
    const { width, height } = this.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  private requestRender() {
    if (this.frame || !this.renderer) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      // update() reports whether damping is still moving the camera.
      const moving = this.controls?.update() ?? false;
      this.renderNow();
      if (moving) this.requestRender();
    });
  }

  private renderNow() {
    if (this.renderer && this.scene && this.camera) this.renderer.render(this.scene, this.camera);
  }
}

if (!customElements.get("furniture-viewer")) {
  customElements.define("furniture-viewer", FurnitureViewer);
}
