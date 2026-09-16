import {civicSites,civicPlacementReason} from './civic-sites.js';
import {cartFactor} from './villager-life.js';
import { colorBatchMaterial } from './models.js';
import {beaconTarget} from './command-dispatch.js';
import {setBeaconRealm} from './beacon-light.js';
import {landRemovalReason} from './land-management.js';
import {gardenSites,gardenPlacementReason,gardenObjects,gardenObject,paintTerrainReason,terrainSites} from './garden.js';
import {HOME_BY_ID} from './housing-data.js';
import {homeModel,homePreview} from './housing-models.js';
import {housingSites,housingPlacementReason} from './housing.js';
import {natureModel,naturePreview,terrainPreview} from './garden-models.js';
import { terrainAt, terrainPalette } from './terrain-data.js';
import { canHoldMine } from './mining-combo.js';
import { EasterEggWorld } from "./easter-egg-world.js";
import { OUTDOOR_ACTORS, fitOutdoorModel, outdoorPreview, outdoorPlacementArea, placementSurface, placementCue, PLACEMENT_STYLE } from './construction-preview.js';
import { createFreightView } from "./dimensional-view.js";
import { transportTopology, routePoint, routeGrid } from "./routing.js";
import { createRailPath } from "./rail-path.js";
import { drawRailTracks } from "./rail-model.js";
import { createRailTrafficView } from './rail-traffic-view.js';
import { upgradeLevel, upgradeMultiplier } from "./upgrades.js";
import {
  gridConnection,
  POWER_FACILITIES,
} from "./power.js";
import { controlGuide } from "./input-guidance.js";
import { createTouchCamera } from "./touch-camera.js";
import { projectWorldPoint } from "./world-projection.js";
import { makeResident, makeCopper } from "./companion-models.js";
import { studioResidents, activeHost, JOBS } from "./residents.js";
import { studioStaffPlaces } from "./studio-staff-layout.js";
import {
  COMPANION_RADIUS,
  companionNavigation,
  companionTarget,
  prepareCompanionPositions,
  visibleCompanions,
} from "./operations.js";
import { pixelRingGeometry } from "./voxel-geometry.js";
import {
  createPickaxe,
  pickColor,
  pickPose,
  PICK_TIP,
  PICK_CONTACT,
  PICK_DURATION,
} from "./pickaxe.js";
import { AtmosphereView } from "./atmosphere.js";
import { STUDIO, STUDIO_DEVICE_IDS } from "./studio-layout.js";
import { studioSpec, studioSites, canPlaceStudio } from "./studio-placement.js";
import { extraEnabled, COLLECTION_BY_ID } from "./collection.js";
import { studioDeviceModel } from "./studio-device-models.js";
import { decorateStudio } from "./studio-decoration.js";
import * as T from "three";
import { blockBatchMaterial } from "./block-materials.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { footprint, worldScenery, sceneryObstacle, districtAt, DISTRICTS, onLand, canPlace } from "./layout.js";
import { cottage, broadcastHouse } from "./village-models.js";
import { Navigation, bodyRadius } from "./navigation.js";
import {
  buildingObstacles,
  sceneryVisible,
} from "./layout.js";
import { CATALOG, ITEMS, REALMS } from "./catalog.js";
import { n, rates, sites, frontier } from "./game.js";
import { ModelKit, box, cube, group, mat, hardBox, P } from "./models.js";
import { makeObject, makeActor } from "./objects.js";
const rand = (i) => (((Math.sin(i * 71.13 + 42.7) * 43758.54) % 1) + 1) % 1;
const terrain = {
  overworld: {
    bg: "#e5eadc",
    top: "#829b60",
    edge: "#87775d",
    rock: "#aab0a0",
  },
  nether: { bg: "#473e3d", top: "#976553", edge: "#694f49", rock: "#805b55" },
  end: { bg: "#292f43", top: "#b6b695", edge: "#888b86", rock: "#6c7184" },
};
const mobile = () => innerWidth < 760;

function eachVisibleCaptureMesh(graph, include) {
  const instance = new T.Matrix4(),
    world = new T.Matrix4();
  function visit(object) {
    if (!object.visible || object.userData.captureBackdrop) return;
    if (object.isMesh) {
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      if (object.isInstancedMesh) {
        for (let i = 0; i < object.count; i++) {
          object.getMatrixAt(i, instance);
          // Zero-scale matrices are the renderer's hidden-instance convention.
          if (!instance.determinant()) continue;
          world.multiplyMatrices(object.matrixWorld, instance);
          include(object.geometry.boundingBox, world);
        }
      } else include(object.geometry.boundingBox, object.matrixWorld);
    }
    for (const child of object.children) visit(child);
  }
  visit(graph);
}

export function visibleSceneBounds(graph) {
  const bounds = new T.Box3(),
    local = new T.Box3();
  eachVisibleCaptureMesh(graph, (box, matrix) => {
    local.copy(box).applyMatrix4(matrix);
    if ([...local.min.toArray(), ...local.max.toArray()].every(Number.isFinite))
      bounds.union(local);
  });
  if (bounds.isEmpty()) throw new Error("当前场景还没有可拍摄的内容");
  return bounds;
}

export function fittedSceneCamera(
  bounds,
  direction,
  width,
  height,
  graph = null,
) {
  if (
    bounds.isEmpty() ||
    ![width, height].every((v) => Number.isFinite(v) && v > 0)
  )
    throw new Error("截图取景范围无效");
  const center = bounds.getCenter(new T.Vector3()),
    distance = Math.max(20, bounds.getSize(new T.Vector3()).length() * 2 + 10),
    camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, distance * 4);
  camera.position
    .copy(center)
    .addScaledVector(direction.clone().normalize(), distance);
  camera.lookAt(center);
  camera.updateMatrixWorld(true);
  const projected = new T.Box3();
  function include(box, matrix = null) {
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          const point = new T.Vector3(x, y, z);
          if (matrix) point.applyMatrix4(matrix);
          projected.expandByPoint(
            point.applyMatrix4(camera.matrixWorldInverse),
          );
        }
  }
  if (graph) eachVisibleCaptureMesh(graph, include);
  else include(bounds);
  const aspect = width / height,
    halfHeight =
      Math.max(
        0.5,
        (projected.max.y - projected.min.y) / 2,
        (projected.max.x - projected.min.x) / (2 * aspect),
      ) * 1.085,
    centerX = (projected.min.x + projected.max.x) / 2,
    centerY = (projected.min.y + projected.max.y) / 2;
  camera.left = centerX - halfHeight * aspect;
  camera.right = centerX + halfHeight * aspect;
  camera.top = centerY + halfHeight;
  camera.bottom = centerY - halfHeight;
  camera.updateProjectionMatrix();
  return camera;
}
export class World {
  constructor(container, onAction, { autoStart = true } = {}) {
    this.container = container;
    this.onAction = onAction;
    this.animations = [];
    this.batch = [];
    this.pointers = new Map();
    this.time = 0;
    this.last = performance.now();
    this.view = "overworld";
    this.active = true;
    this.landFlashMaterial = new T.MeshBasicMaterial({
      color: "#e7efb0",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: T.DoubleSide,
    });
    this.landFlashGeometry = new T.PlaneGeometry(4.98, 4.98);
    this.mode = null;
    this.signature = "";
    this.zoom = 1;
    this.yaw = 0;
    this.displayYaw = 0;
    this.cameraStates = new Map();
    this.cameraContext = "overworld";
    this.pan = new T.Vector3();
    this.target = new T.Vector3();
    this.graph = new T.Group();
    this.caches = new Map();
    this.zeroMatrix = new T.Matrix4().makeScale(0, 0, 0);
    this.cameraOffset = new T.Vector3(13, 13, 16);
    this.rotatedOffset = new T.Vector3();
    this.upAxis = new T.Vector3(0, 1, 0);
    this.floorPlane = new T.Plane(new T.Vector3(0, 1, 0), -STUDIO.floorY);
    this.wallPlane = new T.Plane(new T.Vector3(0, 0, 1), 1.25);
    this.floorPoint = new T.Vector3();
    this.aim = new T.Vector3();
    this.markerGroup = new T.Group();
    this.scene = new T.Scene();
    this.scene.add(this.markerGroup);
    this.easterEggView=new EasterEggWorld(this.scene);
    this.camera = new T.OrthographicCamera(-8, 8, 8, -8, 0.1, 200);
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: false,
    });
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, mobile() ? 1.4 : 1.7),
    );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    const canvas = this.renderer.domElement;
    canvas.setAttribute("aria-label", "方块世界：" + controlGuide());
    canvas.style.touchAction = "none";
    container.append(canvas);
    this.hemi = new T.HemisphereLight("#fff3d9", "#7c8f74", 1.8);
    this.scene.add(this.hemi);
    this.atmosphereView = new AtmosphereView(this.scene);
    this.sun = new T.DirectionalLight("#fff1d9", 3.2);
    this.sun.position.set(-8, 20, 12);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, {
      left: -24,
      right: 24,
      top: 24,
      bottom: -24,
      near: 0.5,
      far: 75,
    });
    this.sun.shadow.normalBias = 0.012;
    this.sun.shadow.bias = -0.00012;
    this.scene.add(this.sun);
    const fill = (this.fill = new T.DirectionalLight("#d4e3ef", 0.8));
    fill.position.set(12, 5, -12);
    this.scene.add(fill);
    this.shadow = new T.Mesh(
      new T.PlaneGeometry(250, 250),
      new T.ShadowMaterial({ opacity: 0.1 }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = -0.9;
    this.shadow.receiveShadow = true;
    this.scene.add(this.shadow);
    this.ray = new T.Raycaster();
    this.pointer = new T.Vector2();
    this.selectRing = new T.Mesh(
      pixelRingGeometry(1, 0.18, 0.1, 0.028),
      new T.MeshBasicMaterial({ color: "#f2cf85", side: T.DoubleSide }),
    );
    this.selectRing.rotation.x = -Math.PI / 2;
    this.selectRing.position.y = 0.23;
    this.selectRing.visible = false;
    this.scene.add(this.selectRing);
    this.studioCue = placementCue();
    this.studioGhost = this.studioCue.fill;
    this.studioOutline = this.studioCue.outline;
    this.contextLost = false;
    this.onContextLost = (event) => {
      event.preventDefault();this.contextLost=true;this.halt();
      window.MCBoot?.fail('CONTEXT_LOST');
    };
    this.onContextRestored = () => {
      // A reload restores a single renderer/event graph and resets the foreground clock.
      // Do not restart loops behind the recovery screen.
      if(this.fatal)return;
      try {this.contextLost=false;this.renderer.shadowMap.needsUpdate=true;this.refreshSurface();}
      catch(error){this.halt();window.MCBoot?.fail('CONTEXT_RESTORE',error);}
    };
    canvas.addEventListener("webglcontextlost", this.onContextLost);
    canvas.addEventListener("webglcontextrestored", this.onContextRestored);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    canvas.addEventListener("pointerdown", (e) => this.down(e));
    canvas.addEventListener("pointermove", (e) => this.drag(e));
    // Pointer handlers open panels on release. Suppress the compatibility click:
    // WebKit can retarget it onto a newly opened panel button under the finger.
    canvas.addEventListener("touchstart", (e) => e.preventDefault(), {passive:false});
    canvas.addEventListener("pointerup", (e) => this.up(e));
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("pointercancel", (e) => {
      this.cancelPointers();
    });
    canvas.addEventListener("lostpointercapture", (e) => {
      if (this.pointers.has(e.pointerId)) this.cancelPointers();
    });
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.zoom = T.MathUtils.clamp(
          this.zoom * Math.exp(e.deltaY * 0.001),
          this.minimumZoom(),
          2.5,
        );
        this.resize();
      },
      { passive: false },
    );
    this.frame = () => {
      if(this.fatal || window.MCBoot?.failed())return;
      try {
      this.update();
      this.raf = requestAnimationFrame(this.frame);
      }catch(error){this.halt();window.MCBoot?.fail('RENDER',error);}
    };
    if (autoStart) this.frame();
  }
  // A mobile sheet can uncover an unchanged-size canvas after WebKit discarded
  // its composited surface. Resize alone won't redraw that surface. Repaint
  // after layout settles, with dt=0: no camera reset or game-time advancement.
  refreshSurface() {
    cancelAnimationFrame(this.surfaceFrame);
    this.surfaceFrame = requestAnimationFrame(() => {
      if (this.fatal || this.disposed || this.contextLost || document.hidden) return;
      this.resize(false);
      this.renderer.shadowMap.needsUpdate = true;
      this.update(false, true);
    });
  }
  minimumZoom() {return typeof window!=='undefined'&&window.innerWidth<=760?0.18:0.45;}
  resize(repaint = true) {
    // Menu layout moves the controls, never the canvas. Keep the same world
    // viewport underneath drawers, including mobile expanded/collapsed sheets.
    const host = this.container.closest?.('#game');
    if (host) {
      const area = host.getBoundingClientRect(), parent = this.container.parentElement.getBoundingClientRect();
      Object.assign(this.container.style, {width:area.width+'px',height:area.height+'px',left:(area.left-parent.left)+'px',top:(area.top-parent.top)+'px'});
    }
    const r = this.container.getBoundingClientRect();
    if (
      !Number.isFinite(r.width) ||
      !Number.isFinite(r.height) ||
      r.width < 1 ||
      r.height < 1
    )
      return;
    // Layout can briefly expand and return to ResizeObserver's last reported
    // size in one purchase. The observer then has no new size to deliver, even
    // though an explicit resize used the intermediate dimensions. Verify the
    // final CSS size before drawing; unchanged frames do not resize the buffer.
    if (
      !repaint &&
      r.width === this.viewportWidth &&
      r.height === this.viewportHeight
    )
      return;
    this.viewportWidth = r.width;
    this.viewportHeight = r.height;
    const width = Math.round(r.width),
      height = Math.round(r.height);
    const resized = this.renderWidth !== width || this.renderHeight !== height;
    if (resized) {
      this.renderWidth = width;
      this.renderHeight = height;
      this.renderer.setSize(width, height, false);
    }
    const a = r.width / r.height;
    this.baseSize = this.shot
      ? 3.6 / Math.min(1.1, Math.max(0.7, a))
      : this.starter
        ? 3.8 / Math.min(1.2, Math.max(0.65, a))
        : Math.max(5.4, Math.min(15, (this.span || 5) * 0.53 + 2.2)) /
          Math.min(1.25, Math.max(0.48, a));
    this.aspect = a;
    const size = this.displaySize ?? this.baseSize * this.zoom;
    this.camera.left = -size * a;
    this.camera.right = size * a;
    this.camera.top = size;
    this.camera.bottom = -size;
    this.camera.updateProjectionMatrix();
    // Resizing clears WebGL's drawing buffer. Restore the already-built frame
    // before the browser paints, without advancing simulation or animation.
    if (
      repaint &&
      resized &&
      this.hasRenderedFrame &&
      this.graph &&
      !document.hidden
    )
      this.update(false, true);
  }
  setView(view) {
    if (this.view !== view) {
      this.view = view;
      this.switchCameraContext();
      this.signature = "";
      if (this.state) this.sync(this.state);
    }
  }
  setStudio(active) {
    if (!!this.studio === !!active) return;
    const wasInterior = this.interior;
    this.studio = !!active;
    this.switchCameraContext();
    if (wasInterior !== this.interior && this.state) {
      this.signature = "";
      this.sync(this.state);
    }
  }
  get interior() {
    return !!(this.studio && this.shot === "L2");
  }
  switchCameraContext() {
    const context = this.interior ? "studio" : this.view;
    if (context === this.cameraContext) return false;
    this.cameraStates.set(this.cameraContext, this.captureCamera());
    const saved = this.cameraStates.get(context);
    this.restoreCamera(saved);
    this.cameraContext = context;
    this.selectRing.visible = false;
    return true;
  }
  setShot(id) {
    if (this.shot === id) return;
    const roomChanged = this.studio && (this.shot === "L2" || id === "L2");
    this.shot = id;
    const changedContext = this.switchCameraContext();
    if (roomChanged && this.state) {
      this.signature = "";
      this.sync(this.state);
    }
    if (!changedContext && id && !this.interior) {
      this.focusPoint = null;
      this.zoom = 1;
      this.pan.set(0, 0, 0);
      this.focusId = null;
    }
    if (id && !this.interior) this.focusId = null;
    this.resize();
  }
  home() {
    this.pan.set(0, 0, 0);
    this.zoom = 1;
    this.yaw = 0;
    this.focusId = null;
    this.focusPoint = null;
    this.resize();
  }
  revealLand(land) {
    this.landBuild = { ...land, started: this.time };
  }
  revealBuilding(id) {
    const root = this.roots[id];
    if (!root || this.state.reducedMotion) return;
    this.constructionEffect?.group.removeFromParent();
    const g = new T.Group(),
      f = root.userData.footprint || footprint(id);
    g.position.copy(root.position);
    g.position.y = 0.23;
    for (let j = 0; j < 8; j++) {
      const angle = (j * Math.PI) / 4;
      const p = cube(
        g,
        "#e4c879",
        (Math.cos(angle) * (f.w + 0.3)) / 2,
        0,
        (Math.sin(angle) * (f.d + 0.3)) / 2,
        0.1,
        0.1,
        0.1,
      );
      p.castShadow = false;
    }
    this.scene.add(g);
    this.constructionEffect = {
      group: g,
      at: this.time,
      context: this.cameraContext,
    };
  }
  setMode(mode) {
    const signature = JSON.stringify([
      mode?.id,
      mode?.kind,
      mode?.key,
      mode?.type,
      mode?.brush,
      mode?.rotation,
      mode?.site?.x,
      mode?.site?.z,
      mode?.site?.rotation,
    ]);
    if (this.modeSignature === signature) return;
    this.modeSignature = signature;
    this.mode = mode;
    this.refreshMarkers();
  }
  refreshMarkers() {
    if (this.state && this.interior && this.mode?.kind.startsWith("studio-")) {
      this.clearOutdoorPreview();
      this.refreshStudioMarkers();
      return;
    }
    this.clearStudioPreview();
    this.studioMarkerKey = null;
    this.markerGroup.clear();
    this.markers = [];
    if(this.state && this.mode?.kind === 'garden-edit') {
      this.clearOutdoorPreview();this.clearPlacementSurface();
      const p=gardenObject(this.state,this.mode.key);
      if(p){this.outdoorCue ||= placementCue();this.markerGroup.add(this.outdoorCue.root);this.outdoorCue.root.visible=true;this.outdoorCue.place(p,p.w,p.d,.21,true);}
      return;
    }
    if (
      !this.mode ||
      !this.state ||
      !["expand", "land-store", "build", "move", "garden-build", "garden-move", "terrain-paint", "home-build", "home-move", "civic-build", "civic-move"].includes(this.mode.kind)
    ) {
      this.clearOutdoorPreview();
      this.clearPlacementSurface();
      return;
    }
    const expand = ["expand","land-store"].includes(this.mode.kind), terrain=this.mode.kind==='terrain-paint', gardening=this.mode.kind.startsWith("garden-"), civic=this.mode.kind.startsWith("civic-"), housing=this.mode.kind.startsWith("home-");
    const key = JSON.stringify([
      this.view,
      this.mode.kind,
      this.mode.id,
      this.mode.type,
      this.mode.brush,
      this.state.layoutRevision,
      this.state.counts[this.mode.id],
      this.mode.rotation, this.mode.moveId,
    ]);
    if (this.surfaceKey !== key) {
      this.clearPlacementSurface();
      this.placementSites = expand
        ? (this.mode.kind==='land-store'?this.state.chunks[this.view]:frontier(this.state, this.view)).map((p) => ({
            ...p,
            x: p.x * 5,
            z: p.z * 5,
          }))
        : terrain ? terrainSites(this.state, this.mode.brush||1)
        : civic ? civicSites(this.state,this.mode.type,this.mode.rotation,this.mode.moveId) : housing ? housingSites(this.state,this.mode.type,this.mode.rotation,this.mode.moveId) : gardening ? gardenSites(this.state,this.mode.type,this.mode.rotation,this.mode.moveId) : sites(
            this.state,
            this.view,
            this.mode.kind === "move" ? this.mode.id : null,
            this.mode.id, this.mode.rotation||0,
          );
      this.outdoorArea = expand
        ? null
        : terrain
          ? (() => {
              const list = this.placementSites;
              const lookup = new Map(list.map((p) => [`${Math.round(p.x)},${Math.round(p.z)}`, p]));
              return {
                sites: list,
                step: 1,
                siteAt(point) {
                  return lookup.get(`${Math.round(point.x)},${Math.round(point.z)}`) || null;
                },
              };
            })()
        : outdoorPlacementArea(
            this.state,
            this.placementSites,
            this.mode.kind === "move" ? this.mode.id : null,
          );
      this.availableSurface = placementSurface(
        this.outdoorArea?.sites || this.placementSites,
        { step: expand ? 5 : terrain ? 1 : this.outdoorArea.step },
      );
      this.surfaceKey = key;
    }
    this.markerGroup.add(this.availableSurface.root);
    this.availableSurface.root.visible = true;
    this.outdoorCue ||= placementCue();
    this.markerGroup.add(this.outdoorCue.root);
    this.outdoorCue.root.visible = false;
    if (!expand) {
      const ghostKey =
        this.mode.id + ":" + this.mode.kind + ":" + (this.mode.type||'') + ":" + (this.mode.brush||1) + ":" + n(this.state, this.mode.id)+":"+(this.mode.rotation||0);
      if (this.outdoorPreviewKey !== ghostKey) {
        this.clearOutdoorPreview();
        this.outdoorGhost = terrain ? terrainPreview(this.mode.type, this.mode.brush||1)
          : housing ? homePreview(this.mode.type,this.mode.rotation,this.state.housing.homes.find(h=>h.id===this.mode.moveId)?.variant??this.state.housing.storedVariants?.[this.mode.type]?.[0]??0) : gardening ? naturePreview(this.mode.type,this.mode.rotation) : outdoorPreview(
          this.state,
          this.mode.id,
          (this.mode.kind === "move" || civic),
          false, this.mode.rotation||0,
        );
        this.outdoorPreviewKey = ghostKey;
      }
      this.markerGroup.add(this.outdoorGhost.root);
      this.outdoorGhost.root.visible = false;
    } else this.clearOutdoorPreview();
    if (this.mode.site) this.showOutdoorGhost(this.mode.site);
    this.markerGroup.updateMatrixWorld(true);
  }
  clearPlacementSurface() {
    this.availableSurface?.dispose();
    this.availableSurface = null;
    this.outdoorArea = null;
    this.surfaceKey = null;
  }
  clearOutdoorPreview() {
    this.outdoorGhost?.dispose();
    this.outdoorGhost = null;
    this.outdoorPreviewKey = null;
  }
  outdoorSiteAt(e) {
    if (!this.mode || !["expand", "land-store", "build", "move", "garden-build", "garden-move", "terrain-paint", "home-build", "home-move", "civic-build", "civic-move"].includes(this.mode.kind))
      return null;
    this.pointerRay(e);
    const point = this.ray.ray.intersectPlane(
      new T.Plane(new T.Vector3(0, 1, 0), -0.19),
      new T.Vector3(),
    );
    if (!point) return null;
    if (!["expand","land-store"].includes(this.mode.kind)) {
      const legal = this.outdoorArea?.siteAt(point);
      if (legal) return { x: legal.x, z: legal.z, realm: this.view, rotation:this.mode.rotation||0 };
    }
    const step = ["expand","land-store"].includes(this.mode.kind) ? 5 : this.mode.kind==='terrain-paint' ? 1 : 0.5;
    return {
      x: Math.round(point.x / step) * (step === 5 ? 1 : step),
      z: Math.round(point.z / step) * (step === 5 ? 1 : step),
      realm: this.view, rotation:this.mode.rotation||0,
    };
  }
  showOutdoorGhost(site) {
    const expand = ["expand","land-store"].includes(this.mode.kind),
      p = {
        ...site,
        x: site.x * (expand ? 5 : 1),
        z: site.z * (expand ? 5 : 1),
      };
    const terrain=this.mode.kind==='terrain-paint',gardening=this.mode.kind.startsWith("garden-"),civic=this.mode.kind.startsWith("civic-"), housing=this.mode.kind.startsWith("home-");
    const brush=this.mode.brush||1;
    const valid = this.mode.kind==='land-store' ? !landRemovalReason(this.state,site) : terrain ? !paintTerrainReason(this.state,this.mode.type,site,brush) : civic ? !civicPlacementReason(this.state,this.mode.type,{...site,rotation:this.mode.rotation||0},this.mode.moveId) : housing ? !housingPlacementReason(this.state,this.mode.type,{...site,rotation:this.mode.rotation||0},this.mode.moveId) : gardening ? !gardenPlacementReason(this.state,this.mode.type,{...site,rotation:this.mode.rotation||0},this.mode.moveId) : expand
      ? this.placementSites.some((s) => s.x === p.x && s.z === p.z)
      : canPlace(
          this.state,
          this.mode.id,
          site,
          this.mode.kind === "move" ? this.mode.id : null,
        );
    let f = expand ? { w: 5, d: 5 } : terrain ? { w: brush===2?2:brush===3?3:1, d: brush===2?2:brush===3?3:1 } : footprint(this.mode.id,(gardening||housing)?null:this.mode);
    if((gardening||housing) && this.mode.rotation%2)f={w:f.d,d:f.w};
    this.outdoorCue.root.visible = true;
    this.outdoorCue.place(p, f.w, f.d, 0.21, valid);
    this.outdoorCue.fill.userData.valid = valid;
    this.outdoorCue.fill.userData.site = { ...site };
    if (this.outdoorGhost) {
      const ghost = this.outdoorGhost.root;
      ghost.visible = true;
      ghost.position.x = p.x;
      ghost.position.z = p.z;
      ghost.userData.site = { ...site };
      ghost.userData.valid = valid;
      this.outdoorGhost.setValid(valid);
      ghost.updateMatrixWorld(true);
    }
    this.availableSurface.root.visible = true;
  }
  refreshStudioMarkers() {
    const spec = studioSpec(this.mode?.key);
    if (!spec) return;
    const grid = STUDIO.grid || 0.25;
    const key = JSON.stringify([
      "studio",
      this.mode.kind,
      this.mode.key,
      this.mode.id,
      this.mode.rotation,
      this.state.studio.revision,
    ]);
    if (this.surfaceKey !== key) {
      this.clearPlacementSurface();
      this.studioCandidates = studioSites(this.state, this.mode.key, {
        ignoreKey: this.mode.key,
        rotation: this.mode.rotation ?? this.mode.site?.rotation ?? 0,
      });
      this.availableSurface = placementSurface(this.studioCandidates, {
        step: grid,
        y: (spec.y ?? STUDIO.floorY) + 0.018,
        wall: spec.layer.startsWith("wall"),
      });
      this.surfaceKey = key;
    }
    this.markerGroup.clear();
    this.markers = [];
    this.studioMarkerKey = key;
    this.markerGroup.add(this.availableSurface.root, this.studioCue.root);
    this.studioCue.root.visible = false;
    this.ensureStudioPreview();
    this.studioModelGhost.visible = false;
    this.availableSurface.root.visible = true;
    if (this.mode.site) this.showStudioGhost(this.mode.site);
    this.markerGroup.updateMatrixWorld(true);
  }
  clearStudioPreview() {
    this.studioModelGhost?.removeFromParent();
    for (const material of this.studioPreviewMaterials || [])
      material.dispose();
    this.studioPreviewMaterials = [];
    this.studioModelGhost = null;
    this.studioPreviewKey = null;
  }
  ensureStudioPreview() {
    const spec = studioSpec(this.mode?.key);
    if (!spec) return;
    const extra =
      COLLECTION_BY_ID[this.mode.id] ||
      COLLECTION_BY_ID[this.state.scenery?.equipped?.[spec.key]];
    const level = ITEMS[spec.id]
      ? Math.min(
          ITEMS[spec.id].max,
          Math.max(
            1,
            n(this.state, spec.id) +
              (this.mode.kind === "studio-build" ? 1 : 0),
          ),
        )
      : 0;
    const signature = `${spec.key}:${extra?.id || spec.id}:${level}`;
    if (this.studioPreviewKey === signature && this.studioModelGhost) {
      this.markerGroup.add(this.studioModelGhost);
      return;
    }
    this.clearStudioPreview();
    const preview = new T.Group();
    preview.userData.studioPreview = true;
    preview.userData.studioKey = spec.key;
    preview.userData.previewId = extra?.id || spec.id;
    if (extra) {
      // Construct only the chosen design on an isolated presentation state. No
      // purchases, positions or equipped choices in the live save are changed.
      const presentation = {
        counts: { L2: 1 },
        scenery: {
          owned: { [extra.id]: true },
          equipped: { [spec.key]: extra.id },
        },
        studio: {
          version: 1,
          placements: { [spec.key]: { ...spec.default } },
          revision: 0,
        },
      };
      const shell = new T.Group();
      decorateStudio(shell, presentation);
      let design;
      shell.traverse((o) => {
        if (o.userData.studioDecoration === extra.id) design = o;
      });
      if (design) {
        preview.add(design);
        design.position.x -= spec.default.x;
        design.position.z -= spec.default.z;
        design.rotation.y = 0;
      }
    } else {
      const presentation = structuredClone(this.state),
        animations = [];
      presentation.counts[spec.id] = level;
      studioDeviceModel(preview, spec.id, presentation, animations);
      // Freeze a representative pose. Placement does not run production or add
      // an extra set of animation callbacks to the live room.
      animations.forEach((animate) => animate(0));
    }
    const clones = new Map();
    preview.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = false;
      o.receiveShadow = false;
      o.renderOrder = 4;
      const ghostMaterial = (source) => {
        if (!clones.has(source)) {
          const material = source.clone();
          material.transparent = true;
          material.opacity = PLACEMENT_STYLE.ghostOpacity;
          material.depthWrite = false;
          material.polygonOffset = true;
          material.polygonOffsetFactor = -2;
          material.polygonOffsetUnits = -2;
          material.userData.previewColor = source.color?.clone();
          clones.set(source, material);
        }
        return clones.get(source);
      };
      o.material = Array.isArray(o.material)
        ? o.material.map(ghostMaterial)
        : ghostMaterial(o.material);
    });
    this.studioPreviewMaterials = [...clones.values()];
    this.studioModelGhost = preview;
    this.studioPreviewKey = signature;
    this.markerGroup.add(preview);
  }
  showStudioGhost(site) {
    const spec = studioSpec(this.mode?.key);
    if (!spec || !site) return;
    const rotation = (((site.rotation ?? this.mode.rotation ?? 0) % 4) + 4) % 4,
      w = rotation % 2 ? spec.d : spec.w,
      d = rotation % 2 ? spec.w : spec.d,
      valid = canPlaceStudio(
        this.state,
        this.mode.key,
        { ...site, rotation },
        { ignoreKey: this.mode.key },
      ),
      wall = spec.layer.startsWith("wall") || spec.key === "studioWall";
    const baseY = spec.y ?? STUDIO.floorY;
    this.ensureStudioPreview();
    this.studioCue.root.visible = true;
    this.studioCue.place(site, w, d, baseY + 0.03, valid, wall);
    if (this.availableSurface)
      this.availableSurface.root.visible = true;
    this.studioGhost.userData.valid = valid;
    this.studioGhost.userData.site = { x: site.x, z: site.z, rotation };
    if (this.studioModelGhost) {
      this.studioModelGhost.visible = true;
      this.studioModelGhost.position.set(site.x, 0, site.z);
      this.studioModelGhost.rotation.y = (rotation * Math.PI) / 2;
      this.studioModelGhost.userData.valid = valid;
      this.studioModelGhost.userData.site = { x: site.x, z: site.z, rotation };
      const tint = this.studioGhost.material.color;
      for (const material of this.studioPreviewMaterials) {
        // An invalid candidate must remain legible even inside the furniture
        // which blocks it; valid previews keep the room's normal occlusion.
        material.depthTest = valid;
        if (material.userData.previewColor)
          material.color
            .copy(material.userData.previewColor)
            .lerp(tint, valid ? 0 : 0.65);
      }
      this.studioModelGhost.updateMatrixWorld(true);
    }
    this.studioGhost.updateMatrixWorld(true);
    this.studioOutline.updateMatrixWorld(true);
  }
  studioSiteAt(e) {
    const spec = studioSpec(this.mode?.key);
    if (!spec) return null;
    const rotation = this.mode.rotation ?? this.mode.site?.rotation ?? 0;
    if (spec.movable === false) return { ...spec.default, rotation };
    this.pointerRay(e);
    const wall = spec.layer.startsWith("wall");
    if (wall) this.wallPlane.constant = -spec.default.z;
    else
      this.floorPlane.constant = -(spec.layer === "ceiling"
        ? spec.y
        : STUDIO.floorY);
    if (
      !this.ray.ray.intersectPlane(
        wall ? this.wallPlane : this.floorPlane,
        this.floorPoint,
      )
    )
      return null;
    const grid = STUDIO.grid || 0.25,
      x = Math.round(this.floorPoint.x / grid) * grid,
      z = wall ? spec.default.z : Math.round(this.floorPoint.z / grid) * grid;
    return { x, z, rotation };
  }
  snapshot() {
    return Object.fromEntries(
      [
        "graph",
        "batch",
        "animations",
        "targets",
        "gardenTargets",
        "roots",
        "statusLights",
        "hero",
        "heroBase",
        "pickTool",
        "pile",
        "railTraffic",
        "starter",
        "span",
        "center",
        "dynamicRoots",
        "walkers",
        "navigation",
        "navigationKey",
        "colliders",
        "roofHeight",
        "studioWalls",
      ]
        .map((k) => [k, this[k]])
        .concat([["signature", this.builtSignature]]),
    );
  }
  disposeCache(cache) {
    for (const b of cache.batch || []) {
      this.scene.remove(b.mesh);
      b.mesh.dispose();
    }
  }
  sync(state) {
    if (!state) return;
    if (this.state && this.state !== state) {
      this.clearOutdoorPreview();
      this.clearStudioPreview();
      this.clearPlacementSurface();
      for (const c of this.caches.values()) this.disposeCache(c);
      this.caches.clear();
      this.renderedView = null;
      this.signature = "";
    }
    this.state = state;
    this.easterEggView.sync(state,this.view,this.interior);
    const signature = JSON.stringify([
      this.view,
      state.community?.revision,
      state.garden?.revision,
      state.housing?.revision, state.life?.sites?.map(p=>[p.id,p.type,p.x,p.z,p.rotation,p.stored]),
      this.focusedCompanion,
      !!(this.studio && this.shot === "L2"),
      Object.entries(state.counts).filter(
        ([id]) =>
          ITEMS[id]?.place ||
          ["actor", "tool", "expansion"].includes(ITEMS[id]?.model) ||
          ["V12", "V13", "X6", "X8", ...STUDIO_DEVICE_IDS].includes(id),
      ),
      state.placements,
      state.editing?.lines,
      state.upgrades?.revision,
      state.environment?.modules,
      state.studio,
      state.chunks,
      [state.scenery?.equipped.flag, extraEnabled(state, "garden")],
      state.crops?.selected,
      ["studioDesk", "studioWall", "studioSign", "studioShelf"].map(
        (slot) => state.scenery?.equipped[slot],
      ),
    ]);
    if (signature === this.signature) return;
    if (this.renderedView) this.caches.set(this.renderedView, this.snapshot());
    for (const b of this.batch) this.scene.remove(b.mesh);
    this.signature = signature;
    this.builtSignature = signature;
    const sceneKey = this.studio && this.shot === "L2" ? "studio" : this.view;
    const cached = this.caches.get(sceneKey);
    if (this.renderedView && this.renderedView !== sceneKey) {
      const canvas = this.renderer.domElement;
      canvas.getAnimations().forEach((a) => a.cancel());
      if (!state.reducedMotion)
        canvas.animate([{ opacity: 0.15 }, { opacity: 1 }], {
          duration: 380,
          easing: "cubic-bezier(.22,.8,.24,1)",
        });
    }
    this.renderedView = sceneKey;
    this.setTheme(state);
    if (cached?.signature === signature) {
      Object.assign(this, cached);
      this.signature = signature;
      this.builtSignature = signature;
      for (const b of this.batch) this.scene.add(b.mesh);
      this.current = null;
      this.refreshMarkers();
      this.renderer.shadowMap.needsUpdate = true;
      this.resize();
      return;
    }
    if (cached) this.disposeCache(cached);
    this.batch = [];
    this.graph = new T.Group();
    this.animations = [];
    this.targets = [];
    this.gardenTargets = [];
    this.roots = {};
    this.markers = [];
    this.statusLights = [];
    this.walkers = [];
    this.colliders = [];
    this.roofHeight = 1.5;
    this.studioWalls = [];
    if (sceneKey === "studio") {
      const room = group(this.graph);
      broadcastHouse(room, this.animations, true, state);
      room.scale.setScalar(STUDIO.interiorScale);
      this.roots.L2 = room;
      room.traverse((o) => {
        if (o.userData.studioWallFace) this.studioWalls.push(o);
        const key = o.userData.studioKey || o.userData.studioEntity;
        if (!key) return;
        o.userData.studioKey = key;
        o.userData.studioId = studioSpec(key)?.id || o.userData.studioEquipment;
        this.roots[key] = o;
        this.targets.push(o);
      });
      const staff = studioResidents(state),
        places = studioStaffPlaces(state, staff);
      for (const resident of staff) {
        const place = places.get(resident.id);
        if (!place) continue;
        const person = makeResident(room, resident, this.animations, {
          indoor: true,
          scale: 1,
          speaking: () =>
            activeHost(state)?.id === resident.id && state.live.host > 0,
        });
        person.position.set(place.x, place.y, place.z);
        person.rotation.y = place.yaw;
        person.userData.room = "studio";
        this.roots[resident.id] = person;
        this.targets.push(person);
      }
      this.center = new T.Vector3(
        STUDIO.view.center.x,
        STUDIO.view.center.y,
        STUDIO.view.center.z,
      );
      this.span = STUDIO.view.span;
      this.starter = false;
      this.hero = null;
      this.pile = [];
      this.navigation = new Navigation([{ x: 0, z: 0 }], []);
      this.buildInstances();
      this.caches.set(sceneKey, this.snapshot());
      this.refreshMarkers();
      this.current = null;
      this.renderer.shadowMap.needsUpdate = true;
      this.resize();
      return;
    }
    const theme = terrain[this.view];
    const chunks = state.chunks[this.view];
    const starter = this.view === "overworld" && !n(state, "V1");
    let minX = 0,
      maxX = 0,
      minZ = 0,
      maxZ = 0;
    for (const c of chunks) {
      minX = Math.min(minX, c.x * 5 - 2);
      maxX = Math.max(maxX, c.x * 5 + 2);
      minZ = Math.min(minZ, c.z * 5 - 2);
      maxZ = Math.max(maxZ, c.z * 5 + 2);
      if (starter) continue;
      const ground = group(this.graph, c.x * 5, 0, c.z * 5);
      ground.userData.land = { x: c.x, z: c.z, realm: this.view };
      const building = this.landBuild;
      if (
        building &&
        building.realm === this.view &&
        building.x === c.x &&
        building.z === c.z &&
        this.time - building.started < 1 &&
        !state.reducedMotion
      ) {
        ground.userData.dynamic = true;
        const glow = new T.Mesh(this.landFlashGeometry, this.landFlashMaterial);
        glow.rotation.x = -Math.PI / 2;
        glow.position.y = 0.184;
        glow.userData.nonSolid = true;
        ground.add(glow);
        this.animations.push(() => {
          const age = Math.min(1, (this.time - building.started) / 0.9),
            ease = 1 - Math.pow(1 - age, 3);
          ground.position.y =
            -0.65 * (1 - ease) + Math.sin(age * Math.PI) * 0.065;
          this.landFlashMaterial.opacity = Math.sin(age * Math.PI) * 0.3;
          glow.visible = age < 1;
        });
      }
      for (let x = -2; x <= 2; x++)
        for (let z = -2; z <= 2; z++) {
          const xx = c.x * 5 + x,
            zz = c.z * 5 + z,
            k = xx * 33 + zz;
          const painted = this.view === "overworld" ? terrainAt(state, xx, zz) : null,
            paintedPalette = painted ? terrainPalette(painted, theme) : null;
          const zone = !paintedPalette ? districtAt(state, this.view, xx, zz) : null,
            palette = paintedPalette || (zone ? DISTRICTS[zone] : null);
          const topY = paintedPalette?.y ?? 0.08;
          cube(ground, paintedPalette?.edge || theme.edge, x, -0.28, z, 0.995, 0.64, 0.995);
          cube(
            ground,
            palette ? palette.ground : rand(k) > 0.6 ? theme.rock : theme.top,
            x,
            topY,
            z,
            1,
            paintedPalette?.water ? 0.1 : 0.16,
            1,
          );
          // Flecks only on expand / painted grass. Districts, sand, dirt and
          // water keep their own maps — extra cubes read as dirt on the tile.
          if (
            !zone &&
            !paintedPalette?.water &&
            paintedPalette?.style !== "sand" &&
            paintedPalette?.style !== "dirt" &&
            paintedPalette?.style !== "district" &&
            rand(k + 3) > 0.65
          ) {
            cube(
              ground,
              palette
                ? palette.detail
                : this.view === "overworld"
                  ? "#a7b77e"
                  : theme.rock,
              x + 0.17,
              topY + 0.088,
              z - 0.2,
              0.28,
              0.014,
              0.2,
            );
          }
        }
    }
    this.starter = starter;
    this.span = Math.max(maxX - minX, maxZ - minZ);
    this.center = new T.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    const span = Math.max(maxX - minX, maxZ - minZ);
    const aspect =
      this.container.clientWidth / Math.max(1, this.container.clientHeight);
    this.baseSize = starter
      ? 3.8
      : Math.max(mobile() ? 5.2 : 5.4, Math.min(15, span * 0.53 + 2.2)) /
        Math.min(1.25, Math.max(0.65, aspect));
    const heroGroup = group(this.graph);
    heroGroup.userData.dynamic = true;
    const kit = new ModelKit(heroGroup, this.animations, state);
    this.hero = kit.block();
    this.hero.position.y = 0.16;
    this.hero.scale.setScalar(starter ? 1 : 0.67);
    this.heroBase = starter ? 1 : 0.67;
    if (this.view !== "overworld") {
      this.hero.children[0].material = mat(theme.edge);
      this.hero.children[1].material = mat(theme.top);
      this.hero.children.slice(2).forEach((m) => {
        if (m.isMesh) m.material = mat(theme.rock);
      });
    }
    this.hero.userData.action = "mine";
    this.targets.push(this.hero);
    if (n(state, "T1")) {
      const scale = this.heroBase,
        pick = createPickaxe(pickColor(state.counts));
      heroGroup.add(pick);
      pick.scale.setScalar(scale);
      pick.userData.action = "mine";
      this.targets.push(pick);
      this.pickTool = pick;
      const tip = new T.Vector3(),
        axis = new T.Vector3(0, 0, 1);
      this.animations.push(() => {
        const pose = pickPose(
          state.reducedMotion ? -1 : this.time - (this.hitAt ?? -10),
        );
        pick.rotation.z = pose.angle;
        tip
          .copy(PICK_TIP)
          .applyAxisAngle(axis, pose.angle)
          .multiplyScalar(scale);
        // Anchor the tooth to a point on the near face of the block, not its centre.
        pick.position.set(
          -tip.x,
          0.16 +
            1.26 * scale * (1 - this.hitPulse() * 0.025) +
            pose.lift * scale -
            tip.y,
          0.3 * scale * (1 + this.hitPulse() * 0.02),
        );
      });
    }

    this.colliders.push({ minX: -0.72, maxX: 0.72, minZ: -0.72, maxZ: 0.72 });
    for (const [id, p] of Object.entries(state.placements)) {
      if (p.realm !== this.view || !n(state, id)) continue;
      const item = ITEMS[id],
        anchor = group(this.graph, p.x, 0, p.z),
        animations = [];

      if (starter) {
        box(this.graph, theme.edge, p.x, -0.2, p.z, 1.5, 0.45, 1.5);
        box(this.graph, theme.top, p.x, 0.04, p.z, 1.55, 0.09, 1.55);
      }
      const object = OUTDOOR_ACTORS.has(id)
        ? makeActor(anchor, id, animations, 0, state)
        : makeObject(anchor, item, state, animations);
      anchor.userData.dynamic =
        (id !== "L2" && animations.length > 0) ||
        ["M19", "Z2", "N6", "N9", "E9", "N8", "E3"].includes(id);
      if (id === "M19") {
        // The actual lamp face shows grid status. A separate world-space dot
        // used to float above the small block and distort its fitting bounds.
        let on, off;
        object.traverse((part) => {
          if (part.userData.facilityPart === "lamp-on") on = part;
          if (part.userData.facilityPart === "lamp-off") off = part;
        });
        if (on && off) this.statusLights.push({ on, off, realm: p.realm });
      }
      fitOutdoorModel(anchor, id, state, starter);
      this.roots[id] = anchor;
      anchor.userData.item = id;
      this.targets.push(anchor);
      if (["N3", "N5", "N8", "E3"].includes(id))
        this.walkers.push({
          root: anchor,
          id,
          radius: this.actorRadius(anchor),
          groundY: anchor.position.y,
          roam: ["N3", "N5"].includes(id) ? 3 : 5,
          home: p,
          index: this.walkers.length,
        });
      else if (!["N6", "N9", "E9"].includes(id)) this.addCollider(anchor, id);
      const freightView = createFreightView(object, id, state);
      const networkTerminals = [];
      object.traverse((part) => {
        if (part.userData.facilityPart === "network-terminal")
          networkTerminals.push(part);
      });
      const beaconBeam =
        id === "N10" ? object.getObjectByName("beacon-light-column") : null;
      let phase = 0,
        lastTick = this.time;
      this.animations.push((t) => {
        const elapsed = Math.max(0, Math.min(0.08, t - lastTick));
        lastTick = t;
        let speed = ["M", "N", "E"].includes(id[0])
          ? (this.current?.electricity.perDevice[id] ??
            this.current?.power[p.realm] ??
            1)
          : 1;
        const generation =
          this.current?.electricity?.sources?.find((source) => source.id === id)
            ?.rate || 0;
        if (id === "M5") speed = state.grid.crank > 0 ? 1 : 0;
        if (id === "M7" || id === "E8") speed = 1;
        if (id === "M15") speed = generation > 0 ? 1 : 0;
        for (const terminal of networkTerminals)
          terminal.visible =
            id === "M5"
              ? state.grid.crank > 0 ||
                (this.current?.electricity?.supply || 0) > 0
              : generation > 0;
        if (id === "M3" && !n(state, "M8"))
          speed = state.harvest.piston > 0 ? 0.3 : 0;
        const levelTempo = 1 + Math.min(1.3, (n(state, id) - 1) * 0.06);
        object.userData.activity = speed > 0.1 ? "work" : "idle";
        if (beaconBeam) {beaconBeam.userData.power = speed;setBeaconRealm(beaconBeam,beaconTarget(state));}
        // Living creatures still breathe and look around when their machine
        // has no power; production itself remains governed by the simulation.
        phase += elapsed * (item.model === "actor" ? 1 : speed) * levelTempo;
        for (const fn of animations) fn(phase);
        if (freightView) freightView.update(t, anchor, p, this.roofHeight);
        else if (id === "N9") {
          anchor.position.y = this.roofHeight + (id === "E9" ? 0.65 : 0);
          object.position.y = Math.sin(t * 0.7) * 0.12;
          object.rotation.y = t * 0.15;
        }
      });
      if (id === "Z2") {
        anchor.scale.y =
          anchor.userData.nominalScale *
          (0.3 + Math.min(1, state.project / 180000) * 0.7);
        anchor.position.y = 0.16 - anchor.userData.baseMinY * anchor.scale.y;
      }
    }
    if (this.view === "overworld") {
      prepareCompanionPositions(state);
      const visible = visibleCompanions(state, this.focusedCompanion);
      const residents = visible.filter((a) => a.id.startsWith("resident-"));
      for (const [j, r] of residents.entries()) {
        const worker = makeResident(this.graph, r, this.animations, {cart:()=>cartFactor(this.state,r)>1});
        this.targets.push(worker);
        const c = chunks[j % chunks.length];
        this.walkers.push({
          root: worker,
          id: "V2",
          person: r,
          radius: COMPANION_RADIUS,
          home: { x: c.x * 5, z: c.z * 5 },
          index: this.walkers.length,
        });
      }
      for (const a of visible.filter((a) => a.id.startsWith("golem-"))) {
        const actor = makeCopper(this.graph, a, this.animations);
        this.targets.push(actor);
        this.walkers.push({
          root: actor,
          id: "V15",
          person: a,
          radius: COMPANION_RADIUS,
          home: { x: 1.4, z: 1.4 },
          index: this.walkers.length,
        });
      }
      for (const id of ["V8", "V9", "V10", "V16"])
        for (let j = 0; j < Math.min(3, n(state, id)); j++) {
          const actor = makeActor(this.graph, id, this.animations, j, state);
          actor.userData.dynamic = true;
          this.targets.push(actor);
          this.walkers.push({
            root: actor,
            id,
            radius: this.actorRadius(actor),
            home: state.placements.V7 || { x: -1.5, z: 1.5 },
            index: this.walkers.length,
          });
        }

      if (n(state, "V1"))
        for (const p of worldScenery(state, this.view)) {
          if (!sceneryVisible(state, p, this.view)) continue;
          const g = group(this.graph, p.x, 0.16, p.z);
          const parcel = this.graph.children.find(
            (o) =>
              o.userData.land &&
              Math.abs(o.position.x - p.x) < 2.5 &&
              Math.abs(o.position.z - p.z) < 2.5,
          );
          if (parcel?.userData.dynamic) parcel.attach(g);
          if(p.kind === 'civic') {
            const localState={...state,harvest:p.production?.harvest||state.harvest,placements:{...state.placements,[p.type]:p}};
            g.position.y=0;makeObject(g,ITEMS[p.type],localState,this.animations);fitOutdoorModel(g,p.type,localState,false);
            if(p.type==='V7'){const ids=['V8','V9','V10'].filter(id=>n(state,id));ids.forEach((id,i)=>{const a=makeActor(g,id,this.animations,i,localState);a.scale.setScalar(.35);a.position.set(-.48+i*.46,.12,0);});}
            g.traverse(o=>{delete o.userData.item;});
            g.userData.dynamic=true;g.userData.action='civic-select';g.userData.civicId=p.id;g.userData.footprint={w:p.w,d:p.d};
            this.targets.push(g);this.roots[p.id]=g;this.colliders.push(...sceneryObstacle(p));
          } else if(p.kind === 'housing') {
            const house=['legacy','cottage'].includes(p.type)?cottage(g,p.variant):homeModel(HOME_BY_ID[p.type]);
            if(['legacy','cottage'].includes(p.type))house.scale.setScalar(.7);else g.add(house);
            house.rotation.y=(p.rotation||0)*Math.PI/2;
            g.userData.dynamic=true;g.userData.action='housing-select';g.userData.homeId=p.id;
            g.userData.footprint={w:p.w,d:p.d};
            this.targets.push(g);this.roots[p.id]=g;this.colliders.push(...sceneryObstacle(p));
          } else if (p.kind === "house") {
            if (n(state, "V2") < 3) continue;
            const h = cottage(g, p.variant);
            h.scale.setScalar(0.7);
            this.addCollider(g, "house");
          } else {
            if(p.kind === 'tree') {
              const localKit = new ModelKit(g, this.animations, state), tree = localKit.tree(0, 0, p.scale||0.55);
              tree.position.y = 0;
              tree.rotation.y=(p.rotation||0)*Math.PI/2;
            } else { const plant=natureModel(p.type);plant.rotation.y=(p.rotation||0)*Math.PI/2;g.add(plant); }
            g.userData.dynamic = true;
            g.userData.action = 'garden-select';g.userData.gardenId=p.id;
            this.gardenTargets.push(g);this.roots[p.id]=g;
            this.colliders.push(...sceneryObstacle(p));
          }
        }
    } else
      for (let j = 0; j < 25; j++) {
        const star = cube(
          this.graph,
          this.view === "end" ? "#d0ceb5" : "#dc9b62",
          (rand(j) * 2 - 1) * 15,
          2 + rand(j + 19) * 5,
          -7 - rand(j + 10) * 12,
          0.04,
          0.04,
          0.04,
        );
        star.userData.dynamic = true;
        star.userData.captureBackdrop = true;
        this.animations.push((t) =>
          star.scale.setScalar(0.03 + Math.abs(Math.sin(t * 0.5 + j)) * 0.025),
        );
      }
    this.routes();
    if (state.scenery?.equipped.flag && this.view === "overworld") {
      const anchor = state.placements.V3 || { x: 1, z: 1 },
        g = group(this.graph, anchor.x + 0.65, 0.16, anchor.z + 0.38),
        k = state.cosmetics.flag;
      box(g, P.wood, 0, 0.9, 0, 0.06, 1.8, 0.06);
      box(
        g,
        ["#739777", "#cf9868", "#a29abe"][k],
        0.35,
        1.45,
        0,
        0.7,
        0.42,
        0.045,
      );
      const marks =
        k === 0
          ? [
              [0.32, 1.45, 0.035, 0.3],
              [0.25, 1.53, 0.11, 0.045],
              [0.39, 1.45, 0.1, 0.045],
              [0.25, 1.37, 0.1, 0.045],
            ]
          : k === 1
            ? [
                [0.35, 1.45, 0.23, 0.22],
                [0.35, 1.45, 0.34, 0.065],
                [0.35, 1.45, 0.065, 0.32],
              ]
            : [
                [0.18, 1.51, 0.1, 0.14],
                [0.35, 1.43, 0.26, 0.08],
                [0.53, 1.51, 0.1, 0.14],
                [0.35, 1.34, 0.11, 0.08],
              ];
      for (const [x, y, w, h] of marks)
        box(g, "#f1dfb5", x, y, 0.033, w, h, 0.02);
      if (k === 1) box(g, "#cf9868", 0.35, 1.45, 0.048, 0.1, 0.09, 0.012);
    }
    // Upgrades change models, usually not paths. Reuse radius grids only when
    // actual land and collision bounds match, including after moving/removal.
    const navigationKey = JSON.stringify([chunks, this.colliders]);
    const sameNavigation = cached?.navigationKey === navigationKey;
    this.navigation = sameNavigation ? cached.navigation : new Navigation(chunks, this.colliders);
    this.navigationKey = navigationKey;
    this.initializeWalkers(sameNavigation ? cached.walkers : []);
    this.refreshMarkers();
    this.buildInstances();
    this.caches.set(this.view, this.snapshot());
    this.current = null;
    this.renderer.shadowMap.needsUpdate = true;
    this.resize();
  }
  setTheme(state) {
    const indoor = this.interior;
    this.fill.color.set(indoor ? "#f1c78e" : "#d4e3ef");
    this.fill.intensity = indoor ? 0.65 : 0.8;
    this.hemi.color.set(indoor ? "#ffe1b7" : "#fff3d9");
    this.hemi.groundColor.set(indoor ? "#796050" : "#7c8f74");
    this.sun.position.set(...(indoor ? [-3.5, 7, 5] : [-8, 20, 12]));
    const shadowSpan = indoor ? 5.5 : 24;
    Object.assign(this.sun.shadow.camera, {
      left: -shadowSpan,
      right: shadowSpan,
      top: shadowSpan,
      bottom: -shadowSpan,
    });
    this.sun.shadow.camera.updateProjectionMatrix();
    if (indoor) {
      this.scene.background = new T.Color("#e9e3d0");
      this.sun.color.set("#ffdab0");
      return;
    }
    const theme = terrain[this.view],
      night =
        state.environment?.palette === "legacy-sky-2" &&
        this.view === "overworld";
    this.scene.background = new T.Color(
      night
        ? "#293c43"
        : state.environment?.palette === "legacy-sky-1" &&
            this.view === "overworld"
          ? "#d9c3a1"
          : theme.bg,
    );
    this.sun.color.set(
      this.view === "nether"
        ? "#ffd5aa"
        : this.view === "end"
          ? "#e0d7f2"
          : "#fff1d9",
    );
  }
  routes() {
    this.pile = [];
    this.railTraffic = null;
    this.weatherRailPaths = [];
    if (n(this.state, "M5") && this.state.editing?.lines?.power!==false) this.drawWires();
    if(this.state.editing?.lines?.logistics===false)return;
    if (!n(this.state, "V2") && this.view === "overworld") return;
    const realm = this.view,
      topology = transportTopology(this.state, realm),
      rail = !!n(this.state, "M16"),
      drawn = new Set(),
      railPaths = new Map();
    if (rail) {
      const grid = routeGrid(this.state, realm);
      const isClear = (p) =>
        onLand(this.state, { ...p, realm }) &&
        !grid.boxes.some(
          (b) => p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ,
        );
      for (const edge of topology.edges)
        railPaths.set(edge.id, createRailPath(edge, isClear));
      this.weatherRailPaths = [...railPaths.values()];
      drawRailTracks(this.graph, railPaths.values());
      this.railTraffic = createRailTrafficView(
        this.graph,
        railPaths,
        this.state,
        this.animations,
      );
    }
    for (const edge of topology.edges) {
      for (let i = 1; !rail && i < edge.points.length; i++) {
        const a = edge.points[i - 1],
          b = edge.points[i],
          tag = [a.x + "," + a.z, b.x + "," + b.z].sort().join(":");
        if (drawn.has(tag)) continue;
        drawn.add(tag);
        const x = (a.x + b.x) / 2,
          z = (a.z + b.z) / 2,
          horizontal = a.x !== b.x;
        box(
          this.graph,
          "#c4b28f",
          x,
          0.18,
          z,
          horizontal ? 0.26 : 0.25,
          0.018,
          horizontal ? 0.25 : 0.26,
        );
      }
      if (rail) continue;
      const cargo = group(this.graph);
      cargo.userData.dynamic = true;
      box(cargo, "#b8a577", 0, 0, 0, 0.21, 0.2, 0.21);
      this.animations.push(() => {
        const flow = this.state.transport?.edges[edge.id],
          active =
            !!flow?.quantity && Math.abs(this.state.play - flow.at) < 1.1,
          phase = ((flow?.total || 0) / 8) % 1,
          p = routePoint(edge, phase * edge.length),
          ahead = routePoint(
            edge,
            Math.min(edge.length, phase * edge.length + 0.1),
          );
        cargo.position.set(p.x, 0.36, p.z);
        cargo.rotation.y = Math.atan2(ahead.x - p.x, ahead.z - p.z);
        cargo.visible = active;
      });
    }
    const first = topology.edges.find((e) => e.stage === "raw")?.points[0];
    if (first)
      for (let j = 0; j < 12; j++) {
        const pile = box(
          this.graph,
          "#c3a875",
          first.x + (j % 3) * 0.16,
          0.25 + Math.floor(j / 6) * 0.2,
          first.z + (Math.floor(j / 3) % 2) * 0.2,
          0.16,
          0.17,
          0.16,
        );
        pile.userData.dynamic = true;
        this.pile.push(pile);
      }
  }
  drawWires() {
    const drawn = new Set(),
      realm = this.view;
    for (const [id, p] of Object.entries(this.state.placements)) {
      if (
        p.realm !== realm ||
        !(
          POWER_FACILITIES.has(id) ||
          (id === "V4" && this.state.grid.automation.farm) ||
          (id === "V7" && this.state.grid.automation.wool)
        )
      )
        continue;
      const wire = gridConnection(this.state, id);
      if (!wire.route) continue;
      for (let i = 1; i < wire.route.points.length; i++) {
        const a = wire.route.points[i - 1],
          b = wire.route.points[i],
          tag = [a.x + "," + a.z, b.x + "," + b.z].sort().join(":");
        if (drawn.has(tag)) continue;
        drawn.add(tag);
        box(
          this.graph,
          "#984f43",
          (a.x + b.x) / 2,
          0.24,
          (a.z + b.z) / 2,
          a.x === b.x ? 0.04 : 0.26,
          0.024,
          a.z === b.z ? 0.04 : 0.26,
        );
        if (n(this.state, "M11") && i % 16 === 0) {
          box(this.graph, "#c0b7a1", b.x, 0.26, b.z, 0.18, 0.045, 0.18);
          for (const x of [-0.045, 0.045])
            box(
              this.graph,
              "#b65241",
              b.x + x,
              0.305,
              b.z,
              0.035,
              0.055,
              0.035,
            );
        }
      }
      const pulse = box(this.graph, "#efb466", 0, 0.27, 0, 0.075, 0.045, 0.075);
      pulse.userData.dynamic = true;
      this.animations.push((t) => {
        const factor =
            this.current?.electricity?.perDevice[
              id === "V4" ? "auto-farm" : id === "V7" ? "auto-wool" : id
            ] || 0,
          p = routePoint(
            wire.route,
            (t * (n(this.state, "M10") ? 1.3 : 1)) %
              Math.max(0.25, wire.length),
          );
        pulse.position.x = p.x;
        pulse.position.z = p.z;
        pulse.visible = factor > 0;
      });
    }
  }
  buildInstances() {
    const bins = new Map();
    this.dynamicRoots = [];
    this.graph.updateMatrixWorld(true);
    this.graph.traverse((o) => {
      let parent = o.parent,
        dynamic = !!o.userData.dynamic,
        ancestor = false;
      while (parent) {
        if (parent.userData.dynamic) {
          dynamic = true;
          ancestor = true;
        }
        parent = parent.parent;
      }
      if (o.userData.dynamic && !ancestor) this.dynamicRoots.push(o);
      if (!dynamic) {
        o.matrixAutoUpdate = false;
        o.matrixWorldAutoUpdate = false;
      }
      if (!o.isMesh) return;
      const tintedMaterial = blockBatchMaterial(o.material) || colorBatchMaterial(o.material);
      const key =
        o.geometry.uuid +
        (tintedMaterial || o.material).uuid +
        (o.userData.nonSolid ? "light" : "solid");
      if (!bins.has(key)) bins.set(key, []);
      bins.get(key).push({ o, dynamic, tintedMaterial });
    });
    for (const entries of bins.values()) {
      // Static transforms are uploaded once. Dynamic instances form a contiguous tail.
      entries.sort((a, b) => Number(a.dynamic) - Number(b.dynamic));
      const objects = entries.map((e) => e.o),
        firstDynamic = entries.findIndex((e) => e.dynamic),
        mesh = new T.InstancedMesh(
          objects[0].geometry,
          entries[0].tintedMaterial || objects[0].material,
          objects.length,
        );
      const dynamic = firstDynamic >= 0;
      mesh.instanceMatrix.setUsage(
        dynamic ? T.DynamicDrawUsage : T.StaticDrawUsage,
      );
      mesh.castShadow = !objects[0].userData.nonSolid;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      for (let i = 0; i < objects.length; i++) {
        mesh.setMatrixAt(i, objects[i].matrixWorld);
        if (entries[0].tintedMaterial)
          mesh.setColorAt(i, objects[i].material.color);
      }
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
        mesh.userData.blockColorBatch = true;
      }
      mesh.instanceMatrix.needsUpdate = true;
      this.scene.add(mesh);
      this.batch.push({
        mesh,
        objects,
        dynamic,
        firstDynamic,
        dynamicObjects: dynamic
          ? objects.slice(firstDynamic).map((o) => {
              const parents = [];
              for (let p = o; p; p = p.parent) parents.push(p);
              return {
                o,
                parents,
                lastMatrix: new Float64Array(o.matrixWorld.elements),
                visible: true,
              };
            })
          : [],
      });
    }
  }
  addCollider(root, id) {
    root.updateWorldMatrix(true, true);
    root.traverse((o) => {
      if (!o.isMesh || o.userData.nonSolid) return;
      const b = new T.Box3().setFromObject(o);
      this.roofHeight = Math.max(this.roofHeight, b.max.y);
    });
    if (id === "V7") {
      root.traverse((o) => {
        if (!o.isMesh) return;
        const b = new T.Box3().setFromObject(o);
        this.colliders.push({
          minX: b.min.x,
          maxX: b.max.x,
          minZ: b.min.z,
          maxZ: b.max.z,
        });
      });
      return;
    }
    if (this.state.placements[id]) {
      this.colliders.push(...buildingObstacles(id, this.state.placements[id]));
      return;
    }
    const foot = new T.Box3();
    root.traverse((o) => {
      if (!o.isMesh || o.userData.nonSolid) return;
      const b = new T.Box3().setFromObject(o);
      if (b.min.y < 1.35 && b.max.y > 0.22) foot.union(b);
    });
    if (!foot.isEmpty())
      this.colliders.push({
        minX: foot.min.x,
        maxX: foot.max.x,
        minZ: foot.min.z,
        maxZ: foot.max.z,
      });
  }
  actorRadius(root) {
    root.updateWorldMatrix(true, true);
    const size = new T.Box3().setFromObject(root).getSize(new T.Vector3());
    return bodyRadius(size.x, size.z);
  }
  initializeWalkers(previous = []) {
    const ordinals = new Map();
    const key = (a) => {
      if (a.person) return a.person.id;
      const index = ordinals.get(a.id) || 0;
      ordinals.set(a.id, index + 1);
      return `${a.id}:${index}`;
    };
    const old = new Map(previous.map(a => [key(a), a]));
    ordinals.clear();
    const preserved = new Map(this.walkers.map(a => [a, old.get(key(a))])
      .filter(([a, before]) => before?.active && a.radius === before.radius &&
        a.home.x === before.home.x && a.home.z === before.home.z));
    // Newly visible actors must also avoid walkers later in the render order.
    // Inactive actors retry finding space rather than inheriting a hidden state.
    const placed = [...preserved.values()];
    for (const a of this.walkers) {
      const before = preserved.get(a);
      a.root.userData.dynamic = true;
      if (before) {
        for (const field of ['path', 'visit', 'wait', 'stuck', 'active', 'x', 'z', 'component', 'escaping'])
          a[field] = before[field];
        a.root.visible = before.root.visible;
        a.root.position.set(a.x ?? a.home.x, a.groundY ?? 0.17, a.z ?? a.home.z);
        a.root.rotation.y = before.root.rotation.y;
        continue;
      }
      const nav = a.person ? companionNavigation(this.state) : this.navigation;
      const node = a.person
        ? nav.nearest(a.person, a.radius)
        : nav.nearest(a.home, a.radius, null, placed);
      a.root.userData.dynamic = true;
      a.path = [];
      a.visit = 0;
      a.wait = 0;
      a.stuck = 0;
      a.active = !!node;
      if (!node) {
        a.root.visible = false;
        continue;
      }
      a.x = a.person?.x ?? node.x;
      a.z = a.person?.z ?? node.z;
      a.root.position.set(a.x, a.groundY ?? 0.17, a.z);
      a.component = node.component;
      placed.push(a);
    }
  }
  updateWalkers(dt) {
    for (const a of this.walkers) {
      a.root.userData.walking = !!(
        a.active &&
        (a.person?.path?.length || a.path.length) &&
        !this.state.reducedMotion
      );
      a.root.userData.activity =
        a.person?.activity || (a.root.userData.walking ? "walk" : "idle");
      if (!a.active) continue;
      const nav = a.person ? companionNavigation(this.state) : this.navigation;
      if (a.person) {
        const p = a.person,
          target = { x: p.x, z: p.z };
        if (
          companionNavigation(this.state).clear(target.x, target.z, a.radius)
        ) {
          const dx = target.x - a.x,
            dz = target.z - a.z;
          const distance = Math.hypot(dx, dz);
          const job = JOBS[p.job];
          const face =
            !p.path?.length && job?.target && !["travel", "rest"].includes(p.activity)
              ? companionTarget(this.state, job.target)
              : null;
          const faceX = face ? face.x - a.x : dx,
            faceZ = face ? face.z - a.z : dz;
          if (Math.hypot(faceX, faceZ) > 0.005) {
            const turn = Math.atan2(
              Math.sin(Math.atan2(faceX, faceZ) - a.root.rotation.y),
              Math.cos(Math.atan2(faceX, faceZ) - a.root.rotation.y),
            );
            a.root.rotation.y +=
              turn * (this.state.reducedMotion ? 1 : 1 - Math.exp(-dt * 12));
          }
          const blend =
            this.state.reducedMotion ||
            distance > 0.4 ||
            !nav.segment(a, target, a.radius)
              ? 1
              : 1 - Math.exp(-dt * 18);
          a.x += dx * blend;
          a.z += dz * blend;
          a.root.position.set(a.x, 0.17, a.z);
        }
        continue;
      }
      // Decorative animals yield to actual couriers; their old visual position
      // must not obscure a worker whose simulation has already reached this tile.
      const overlapping = this.walkers.some(
        (b) =>
          b.person &&
          b.active &&
          Math.hypot(b.person.x - a.x, b.person.z - a.z) <
            a.radius + b.radius + 0.035,
      );
      if (!overlapping) a.escaping = false;
      if (overlapping && !a.escaping) {
        const occupied = this.walkers
          .filter((b) => b !== a && b.active)
          .map((b) => ({
            x: b.person?.x ?? b.x,
            z: b.person?.z ?? b.z,
            radius: b.radius,
          }));
        const node = nav.nearest(a, a.radius, a.component, occupied);
        if (node) {
          a.path = nav.route(
            a,
            node,
            a.radius,
            occupied.filter(
              (b) =>
                Math.hypot(b.x - a.x, b.z - a.z) >= a.radius + b.radius + 0.035,
            ),
          );
          a.escaping = a.path.length > 0;
          a.wait = 0;
        }
      }
      if (this.state.reducedMotion) continue;
      if (a.wait > 0) {
        a.wait -= dt;
        continue;
      }
      if (!a.path.length) {
        const grid = nav.grid(a.radius),
          component = grid.components[a.component],
          nearby = a.roam
            ? component.filter(
                (i) =>
                  Math.hypot(
                    grid.nodes[i].x - a.home.x,
                    grid.nodes[i].z - a.home.z,
                  ) <= a.roam,
              )
            : component,
          area = nearby.length ? nearby : component;
        const target =
          grid.nodes[area[(a.index * 137 + ++a.visit * 71) % area.length]];
        a.path = nav.route(
          a,
          target,
          a.radius,
          this.walkers.filter((b) => b !== a && b.active),
        );
        a.wait = 0.15 + (a.index % 3) * 0.1;
        if (!a.path.length) a.wait = 1;
        continue;
      }
      const next = a.path[0],
        dx = next.x - a.x,
        dz = next.z - a.z,
        d = Math.hypot(dx, dz),
        amount = Math.min(d, dt * (a.id === "V2" ? 0.55 : 0.32));
      if (d < 0.015) {
        a.path.shift();
        continue;
      }
      const x = a.x + (dx / d) * amount,
        z = a.z + (dz / d) * amount;
      if (
        !nav.segment(a, { x, z }, a.radius) ||
        this.walkers.some(
          (b) =>
            b !== a &&
            b.active &&
            Math.hypot(b.x - x, b.z - z) < a.radius + b.radius + 0.035 &&
            Math.hypot(b.x - x, b.z - z) <=
              Math.hypot(b.x - a.x, b.z - a.z) + 1e-6,
        )
      ) {
        a.stuck += dt;
        if (a.stuck > 0.6) {
          const destination = a.path.at(-1);
          a.path = destination
            ? nav.route(
                a,
                destination,
                a.radius,
                this.walkers.filter((b) => b !== a && b.active),
              )
            : [];
          a.wait = 0.2 + (a.index % 4) * 0.15;
          a.stuck = 0;
        }
        continue;
      }
      a.stuck = 0;
      a.x = x;
      a.z = z;
      if (a.person) {
        a.person.x = x;
        a.person.z = z;
      }
      a.root.position.set(x, a.groundY ?? 0.17, z);
      const heading = ["V8", "V9", "V10"].includes(a.id)
        ? Math.atan2(-dz, dx)
        : Math.atan2(dx, dz);
      const turn = Math.atan2(
        Math.sin(heading - a.root.rotation.y),
        Math.cos(heading - a.root.rotation.y),
      );
      a.root.rotation.y += turn * Math.min(1, dt * 10);
    }
  }
  pointerRay(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      (-(e.clientY - r.top) / r.height) * 2 + 1,
    );
    this.ray.setFromCamera(this.pointer, this.camera);
    return r;
  }
  pick(e) {
    const r = this.pointerRay(e);
    if (this.interior && this.mode?.kind.startsWith("studio-")) {
      const site = this.studioSiteAt(e);
      if (!site) return null;
      this.showStudioGhost(site);
      return { userData: { action: "studio-place", site } };
    }
    if (this.mode && ["expand", "land-store", "build", "move", "garden-build", "garden-move", "terrain-paint", "home-build", "home-move", "civic-build", "civic-move"].includes(this.mode.kind)) {
      const site = this.outdoorSiteAt(e);
      return site ? { userData: { action: "place", site } } : null;
    }
    if(this.mode?.kind === 'garden-edit') {
      const hit=this.ray.intersectObjects(this.gardenTargets,true)[0];let o=hit?.object;
      while(o&&!o.userData.gardenId)o=o.parent;
      return o||null;
    }
    const hit = this.ray.intersectObjects([...this.targets,...this.easterEggView.targets], true)[0];
    if (!hit) return null;
    let o = hit.object;
    while (o && !o.userData.item && !o.userData.action && !o.userData.studioKey)
      o = o.parent;
    return o;
  }
  down(e) {
    if (e.button !== 0 && e.button !== 2) return;
    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size > 1) {
      this.stopHold();
      this.start = null;
      this.touchGesture =
        this.pointers.size === 2
          ? createTouchCamera([...this.pointers.values()])
          : null;
      this.touchDirty = false;
      return;
    }
    const rotating = e.button === 2 || e.shiftKey,
      hit = rotating ? null : this.pick(e);
    this.start = {
      x: e.clientX,
      y: e.clientY,
      hit,
      moved: false,
      rotating,
      at: performance.now(),
    };
    if (hit?.userData.action === "mine" && !this.mode) {
      this.onAction({ type: "mine" });
      if (!canHoldMine(this.state)) return;
      this.hold = setTimeout(
        () =>
          (this.repeat = setInterval(
            () => this.onAction({ type: "mine" }),
            200,
          )),
        360,
      );
    } else if (
      ["V4", "V9", "V10", "E4"].includes(hit?.userData.item) &&
      !this.mode
    )
      this.onAction({ type: "hold", id: hit.userData.item });
  }
  drag(e) {
    const old = this.pointers.get(e.pointerId);
    if (
      e.pointerType !== "touch" &&
      !old &&
      performance.now() - (this.pointerHintAt || 0) > 75
    ) {
      this.pointerHintAt = performance.now();
      (this.renderer.domElement.dataset ||= {}).pointer = this.pick(e)
        ? "interactive"
        : "grab";
    }
    if (!old) {
      if (
        !this.interior &&
        this.mode &&
        !this.mode.site &&
        e.pointerType !== "touch" &&
        ["build", "move", "expand", "land-store", "garden-build", "garden-move", "terrain-paint", "home-build", "home-move", "civic-build", "civic-move"].includes(this.mode.kind)
      ) {
        const site = this.outdoorSiteAt(e);
        if (site) this.showOutdoorGhost(site);
      }
      if (
        this.interior &&
        this.mode?.kind.startsWith("studio-") &&
        e.pointerType !== "touch"
      ) {
        const site = this.studioSiteAt(e);
        if (site) this.showStudioGhost(site);
      }
      return;
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size >= 2) {
      this.touchDirty = true;
      return;
    }
    if (
      this.start &&
      Math.hypot(e.clientX - this.start.x, e.clientY - this.start.y) > 8
    ) {
      this.start.moved = true;
      (this.renderer.domElement.dataset ||= {}).pointer = "grabbing";
      this.stopHold();
      if (this.start.rotating) this.rotateView((e.clientX - old.x) * -0.009);
      else this.panPixels(e.clientX - old.x, e.clientY - old.y);
    }
  }
  flushTouchCamera() {
    if (!this.touchDirty || this.pointers.size !== 2 || !this.touchGesture)
      return;
    this.touchDirty = false;
    const change = this.touchGesture.update([...this.pointers.values()]);
    this.zoom = T.MathUtils.clamp(this.zoom * change.zoom, this.minimumZoom(), 2.5);
    this.rotateView(change.yaw);
  }
  cancelPointers() {
    (this.renderer.domElement.dataset ||= {}).pointer = "grab";
    this.pointers.clear();
    this.touchGesture = null;
    this.touchDirty = false;
    this.start = null;
    this.stopHold();
  }
  rotateView(delta) {
    if (!Number.isFinite(delta)) return;
    this.yaw = Math.atan2(
      Math.sin(this.yaw + delta),
      Math.cos(this.yaw + delta),
    );
  }
  panPixels(dx, dy) {
    const scale =
        (2 * (this.displaySize ?? this.baseSize * this.zoom)) /
        Math.max(1, this.container.clientHeight),
      angle =
        Math.atan2(this.cameraOffset.x, this.cameraOffset.z) + this.displayYaw,
      vertical =
        Math.hypot(
          this.cameraOffset.x,
          this.cameraOffset.y,
          this.cameraOffset.z,
        ) / this.cameraOffset.y,
      rightX = Math.cos(angle),
      rightZ = -Math.sin(angle),
      backX = Math.sin(angle),
      backZ = Math.cos(angle),
      limitX = this.interior ? STUDIO.width * 0.7 : 30,
      limitZ = this.interior ? STUDIO.depth * 0.7 : 30;
    this.pan.x = T.MathUtils.clamp(
      this.pan.x - dx * scale * rightX - dy * scale * vertical * backX,
      -limitX,
      limitX,
    );
    this.pan.z = T.MathUtils.clamp(
      this.pan.z - dx * scale * rightZ - dy * scale * vertical * backZ,
      -limitZ,
      limitZ,
    );
  }
  up(e) {
    (this.renderer.domElement.dataset ||= {}).pointer = "grab";
    this.flushTouchCamera();
    this.pointers.delete(e.pointerId);
    this.touchGesture =
      this.pointers.size === 2
        ? createTouchCamera([...this.pointers.values()])
        : null;
    this.touchDirty = false;
    this.stopHold();
    if (this.start && !this.start.moved && !this.start.rotating) {
      const data = this.start.hit?.userData;
      if(data?.action === "civic-select")this.onAction({type:"civic-select",id:data.civicId});
      else if(data?.action === "housing-select")this.onAction({type:"housing-select",id:data.homeId});
      else if(data?.action === "garden-select") this.onAction({type:"garden-select",id:data.gardenId});
      else if (data?.action === "easter-egg")
        this.onAction({type:"easter-egg",id:data.eggId});
      else if (data?.action === "studio-place")
        this.onAction({ type: "studio-place", site: data.site });
      else if (data?.studioKey)
        this.onAction({
          type: "studio-select",
          key: data.studioKey,
          id: data.studioId,
        });
      else if (data?.action === "place")
        this.onAction({ type: "place", site: data.site });
      else if (
        data?.item &&
        (!["V4", "V9", "V10", "E4"].includes(data.item) ||
          performance.now() - this.start.at < 850)
      )
        this.onAction({
          type: "select",
          id: data.item,
          resident: data.resident,
          golem: data.golem,
        });
    }
    this.start = null;
  }
  stopHold() {
    clearTimeout(this.hold);
    clearInterval(this.repeat);
    this.onAction({ type: "hold-end" });
  }
  select(id) {
    if (this.interior) {
      this.selectStudio(id);
      return;
    }
    const root = this.roots[id];
    this.selectRing.visible = !!root;
    if (root) {
      this.selectRing.position.x = root.position.x;
      this.selectRing.position.z = root.position.z;
      const f = footprint(id,this.state.placements[id]);
      this.selectRing.scale.set((f.w + 0.4) * 0.62, (f.d + 0.4) * 0.62, 1);
    }
  }
  connectionFeedback(id) {
    const connection = gridConnection(this.state, id),
      p = this.state.placements[id];
    if (!connection.connected || !p || p.realm !== this.view || this.interior)
      return;
    this.select(id);
    if (!this.connectionLine) {
      const geometry = new T.BufferGeometry();
      geometry.setAttribute(
        "position",
        new T.BufferAttribute(new Float32Array(256 * 3), 3),
      );
      const material = new T.LineBasicMaterial({
        color: "#d88558",
        transparent: true,
        depthWrite: false,
      });
      this.connectionLine = new T.Line(geometry, material);
      this.connectionLine.frustumCulled = false;
      this.scene.add(this.connectionLine);
    }
    const points = connection.route?.points || [p, p],
      attribute = this.connectionLine.geometry.attributes.position;
    points.slice(0, 256).forEach((p, i) => attribute.setXYZ(i, p.x, 0.27, p.z));
    attribute.needsUpdate = true;
    this.connectionLine.geometry.setDrawRange(0, Math.min(256, points.length));
    this.connectionLine.visible = true;
    this.connectionLine.material.opacity = 0.9;
    this.connectionUntil = this.time + (this.state.reducedMotion ? 0.35 : 0.9);
    this.connectionRealm = this.view;
  }
  selectStudio(key) {
    const root = this.roots[key],
      spec = studioSpec(key);
    this.selectRing.visible =
      !!(root && spec) && !this.mode?.kind?.startsWith("studio-");
    if (!root || !spec) return;
    root.getWorldPosition(this.selectRing.position);
    this.selectRing.position.y = STUDIO.floorY + 0.035;
    const bounds = new T.Box3().setFromObject(root),
      width = Math.max(0.3, bounds.max.x - bounds.min.x),
      depth = Math.max(0.3, bounds.max.z - bounds.min.z);
    this.selectRing.scale.set((width + 0.12) * 0.56, (depth + 0.12) * 0.56, 1);
  }
  focus(id) {
    this.focusPoint = null;
    this.focusId = id;
    this.zoom = 1;
    this.pan.set(0, 0, 0);
  }
  itemCamera(id) {
    const root = this.roots[id];
    if (!root) return null;
    const bounds = new T.Box3().setFromObject(root);
    const size = bounds.getSize(new T.Vector3());
    const point = bounds.getCenter(new T.Vector3());
    // Include working space around the model, with the same yaw as the player.
    return { point, size: Math.max(size.x, size.y * 1.2, size.z, 2) };
  }
  captureCamera({absolute=false}={}) {
    return {
      pan: { x: this.pan.x, y: this.pan.y, z: this.pan.z },
      zoom: this.zoom,
      yaw: this.yaw,
      focusId: this.focusId ?? null,
      focusPoint: this.focusPoint ? { ...this.focusPoint } : null,
      focusSize: this.focusSize,
      ...(absolute&&!this.focusId&&!this.focusPoint&&!this.shot&&this.center?{worldCenter:{x:this.center.x,y:this.center.y,z:this.center.z},baseSize:this.baseSize}:{}),
    };
  }
  restoreCamera(saved) {
    this.pan.set(saved?.pan?.x || 0, saved?.pan?.y || 0, saved?.pan?.z || 0);
    this.zoom = saved?.zoom ?? 1;
    this.yaw = saved?.yaw ?? 0;
    this.focusId = saved?.focusId ?? null;
    this.focusPoint = saved?.focusPoint ? { ...saved.focusPoint } : null;
    this.focusSize = saved?.focusSize;
    // Land edits can change both the world's centre and its automatic fit size.
    // Keep the same world point and scale while the player continues editing.
    if(saved?.worldCenter&&this.center&&!this.focusId&&!this.focusPoint){
      this.pan.x+=saved.worldCenter.x-this.center.x;
      this.pan.y+=saved.worldCenter.y-this.center.y;
      this.pan.z+=saved.worldCenter.z-this.center.z;
      if(saved.baseSize>0&&this.baseSize>0)this.zoom*=saved.baseSize/this.baseSize;
    }
  }
  inspectPoint(point, size = 2) {
    this.focusId = null;
    this.focusPoint = { x: point.x, y: point.y || 0, z: point.z };
    this.focusSize =
      Math.max(1.6, size * 0.7 + 0.6) / Math.min(1, this.aspect || 1);
    this.zoom = 1;
    this.pan.set(0, 0, 0);
  }
  focusCompanion(id) {
    this.focusPoint = null;
    this.focusedCompanion = id;
    this.sync(this.state);
    const actor = this.interior
      ? this.roots[id] && {
          x: this.roots[id].position.x,
          z: this.roots[id].position.z,
        }
      : this.walkers.find((a) => a.person?.id === id);
    if (actor) {
      this.focusId = null;
      this.pan.set(actor.x - this.center.x, 0, actor.z - this.center.z);
      this.zoom = 0.45;
      this.resize();
    }
  }
  soundVisible(id) {
    const root = this.roots[id];
    if (!root || !root.visible) return false;
    const p = root.getWorldPosition(new T.Vector3()).project(this.camera);
    return p.z >= -1 && p.z <= 1 && Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1;
  }
  miningPoint() {
    if (!this.hero || this.interior) return null;
    this.hero.updateWorldMatrix(true, false);
    // Just above the top face; the hero's scale and parent transform are real.
    const point = new T.Vector3(0, 1.35, 0).applyMatrix4(this.hero.matrixWorld);
    return projectWorldPoint(
      point,
      this.camera,
      this.renderer.domElement.getBoundingClientRect(),
    );
  }
  hit() {
    if (this.time - (this.hitAt ?? -10) < PICK_DURATION) {
      this.queuedHit = true;
      return;
    }
    this.hitAt = this.time;
  }
  hitPulse() {
    const age = this.time - (this.hitAt ?? -10) - PICK_CONTACT;
    return age < 0 ? 0 : Math.max(0, 1 - age / 0.18);
  }
  update(force = false, repaint = false) {
    const now = performance.now(),
      dt = repaint ? 0 : Math.min(0.08, (now - this.last) / 1000);
    if (!repaint) this.last = now;
    if (this.contextLost || document.hidden || !this.state || (!this.active && !force && !repaint))
      return;
    this.resize(false);
    this.flushTouchCamera();
    this.time += dt;
    if (this.availableSurface) {
      this.previewMotionQuery ||= window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      );
      this.availableSurface.pulse(
        this.time,
        this.state.reducedMotion || this.previewMotionQuery.matches,
      );
    }
    if (this.connectionLine) {
      this.connectionLine.visible =
        this.time < this.connectionUntil &&
        this.connectionRealm === this.view &&
        !this.interior;
      this.connectionLine.material.opacity = Math.max(
        0,
        Math.min(0.9, (this.connectionUntil - this.time) * 2),
      );
    }
    if (this.constructionEffect) {
      const effect = this.constructionEffect,
        age = (this.time - effect.at) / 0.7;
      if (
        age >= 1 ||
        this.state.reducedMotion ||
        effect.context !== this.cameraContext
      ) {
        effect.group.removeFromParent();
        this.constructionEffect = null;
      } else {
        effect.group.position.y = 0.23 + age * 0.65;
        effect.group.children.forEach((p) => p.scale.setScalar(1 - age));
      }
    }
    if (this.queuedHit && this.time - (this.hitAt ?? -10) >= PICK_DURATION) {
      this.queuedHit = false;
      this.hitAt = this.time;
    }
    this.atmosphereView.update(this);
    if (this.interior) {
      // Outdoor weather continues to run, but cannot recolor the control room.
      this.sun.intensity = 2.55;
      this.hemi.intensity = 1.5;
    }
    if (!this.current || now - (this.rateAt || 0) > 250) {
      this.current = rates(this.state);
      this.rateAt = now;
    }
    const t = this.state.reducedMotion ? 0 : this.time;
    for (const light of this.statusLights || []) {
      light.on.visible = (this.current.electricity.perDevice.M19 || 0) > 0;
      light.off.visible = !light.on.visible;
    }
    this.updateWalkers(dt);
    for (const fn of this.animations) fn(t);
    if (this.hero) {
      const pulse = this.hitPulse();
      this.hero.scale.set(
        this.heroBase * (1 + pulse * 0.02),
        this.heroBase * (1 - pulse * 0.025),
        this.heroBase * (1 + pulse * 0.02),
      );
    }
    const b = this.state.buffers[this.view],
      capacity = this.current.regions[this.view].capacity;
    this.pile?.forEach((p, i) => (p.visible = (b.raw / capacity) * 12 > i));
    if (this.roots.Z2) {
      const root = this.roots.Z2;
      root.scale.y =
        root.userData.nominalScale *
        (0.3 + Math.min(1, this.state.project / 180000) * 0.7);
      root.position.y = 0.16 - root.userData.baseMinY * root.scale.y;
    }
    const focusId = this.focusId || this.shot;
    const shotPosition =
      focusId &&
      (this.roots[focusId]?.position || this.state.placements[focusId]);
    if (this.focusPoint) this.aim.copy(this.focusPoint);
    else if (focusId)
      this.aim.set(
        shotPosition?.x || 0,
        this.studio && this.shot === "L2"
          ? STUDIO.view.center.y
          : Math.max(0, shotPosition?.y || 0),
        shotPosition?.z || 0,
      );
    else this.aim.copy(this.center);
    this.aim.add(this.pan);
    this.target.lerp(
      this.aim,
      force || this.state.reducedMotion ? 1 : 1 - Math.exp(-dt * 8),
    );
    const wanted =
      (this.focusPoint
        ? this.focusSize
        : this.focusId
          ? this.focusId === "L2"
            ? this.interior
              ? STUDIO.view.span / 2
              : 2.2
            : 2.2
          : this.studio && this.shot === "L2"
            ? STUDIO.view.span / 2 / Math.min(1.2, this.aspect || 1)
            : this.baseSize) * this.zoom;
    this.displaySize =
      force || this.state.reducedMotion
        ? wanted
        : T.MathUtils.lerp(
            this.displaySize ?? wanted,
            wanted,
            1 - Math.exp(-dt * 9),
          );
    const size = this.displaySize,
      a = this.aspect || 1;
    this.camera.left = -size * a;
    this.camera.right = size * a;
    this.camera.top = size;
    this.camera.bottom = -size;
    this.camera.updateProjectionMatrix();
    const yawDelta = Math.atan2(
      Math.sin(this.yaw - this.displayYaw),
      Math.cos(this.yaw - this.displayYaw),
    );
    this.displayYaw +=
      yawDelta *
      (force || this.state.reducedMotion ? 1 : 1 - Math.exp(-dt * 10));
    this.rotatedOffset
      .copy(this.cameraOffset)
      .applyAxisAngle(this.upAxis, this.displayYaw);
    this.camera.position.copy(this.target).add(this.rotatedOffset);
    this.camera.lookAt(this.target.x, this.target.y + 0.4, this.target.z);
    for (const wall of this.studioWalls || []) {
      const face = wall.userData.studioWallFace;
      wall.visible =
        face === "back"
          ? this.rotatedOffset.z > -0.2
          : this.rotatedOffset.x > -0.2;
    }
    for (const root of this.dynamicRoots) root.updateMatrixWorld(true);
    for (const { mesh, dynamicObjects, firstDynamic } of this.batch) {
      if (firstDynamic < 0) continue;
      let changedFrom = Infinity,
        changedTo = -1;
      for (let j = 0; j < dynamicObjects.length; j++) {
        const entry = dynamicObjects[j],
          { o, parents, lastMatrix } = entry,
          visible = parents.every((p) => p.visible),
          elements = o.matrixWorld.elements;
        let changed = visible !== entry.visible;
        if (visible && !changed)
          for (let k = 0; k < 16; k++)
            if (elements[k] !== lastMatrix[k]) {
              changed = true;
              break;
            }
        if (!changed) continue;
        mesh.setMatrixAt(
          firstDynamic + j,
          visible ? o.matrixWorld : this.zeroMatrix,
        );
        entry.visible = visible;
        if (visible) lastMatrix.set(elements);
        changedFrom = Math.min(changedFrom, firstDynamic + j);
        changedTo = firstDynamic + j;
      }
      if (changedTo < 0) continue;
      mesh.instanceMatrix.clearUpdateRanges();
      mesh.instanceMatrix.addUpdateRange(
        changedFrom * 16,
        (changedTo - changedFrom + 1) * 16,
      );
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (force || now - (this.shadowAt || 0) > 180) {
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowAt = now;
    }
    this.renderer.render(this.scene, this.camera);
    this.hasRenderedFrame = true;
  }
  capture() {
    this.update(true);
    return this.renderer.domElement.toDataURL("image/png");
  }
  captureCurrentScene({ width = 1440, height = 1000 } = {}) {
    if (
      !this.state ||
      !this.graph ||
      this.renderer.getContext().isContextLost()
    )
      throw new Error("场景仍在加载，暂时无法拍照");
    if (
      ![width, height].every(
        (v) => Number.isInteger(v) && v >= 64 && v <= 4096,
      ) ||
      width * height > 12_000_000
    )
      throw new Error("截图尺寸需为 64–4096 像素，总像素不超过 1200 万");
    const renderer = this.renderer,
      camera = fittedSceneCamera(
        visibleSceneBounds(this.graph),
        this.camera.getWorldDirection(new T.Vector3()).negate(),
        width,
        height,
        this.graph,
      ),
      previous = {
        target: renderer.getRenderTarget(),
        face: renderer.getActiveCubeFace(),
        mip: renderer.getActiveMipmapLevel(),
        viewport: renderer.getViewport(new T.Vector4()),
        scissor: renderer.getScissor(new T.Vector4()),
        scissorTest: renderer.getScissorTest(),
        clearColor: renderer.getClearColor(new T.Color()),
        clearAlpha: renderer.getClearAlpha(),
        autoClear: renderer.autoClear,
        shadowAuto: renderer.shadowMap.autoUpdate,
        shadowUpdate: renderer.shadowMap.needsUpdate,
        selectVisible: this.selectRing.visible,
        markersVisible: this.markerGroup.visible,
        xr: renderer.xr.enabled,
        background: this.scene.background,
      };
    let linear, output, pass;
    try {
      linear = new T.WebGLRenderTarget(width, height, {
        type: T.HalfFloatType,
        colorSpace: T.LinearSRGBColorSpace,
        samples: Math.min(4, renderer.capabilities.maxSamples),
      });
      output = new T.WebGLRenderTarget(width, height, { depthBuffer: false });
      pass = new OutputPass();
      const backdrop = previous.background?.isColor
        ? previous.background
        : previous.clearColor;
      pass.uniforms.captureBackground = { value: backdrop.clone() };
      // Direct canvas rendering does not tone-map its clear/background color.
      // Keep it outside the HDR pass, while correctly compositing transparent
      // ground shadows and antialiased model edges back onto that original color.
      pass.material.fragmentShader = pass.material.fragmentShader
        .replace(
          "uniform sampler2D tDiffuse;",
          "uniform sampler2D tDiffuse;\nuniform vec3 captureBackground;",
        )
        .replace(
          "gl_FragColor = texture2D( tDiffuse, vUv );",
          "gl_FragColor = texture2D( tDiffuse, vUv );\nif (gl_FragColor.a > 0.0) gl_FragColor.rgb /= gl_FragColor.a;",
        )
        .replace(
          /}\s*$/,
          `
          vec3 backdrop = captureBackground;
          #ifdef SRGB_TRANSFER
            backdrop = sRGBTransferOETF(vec4(backdrop, 1.0)).rgb;
          #endif
          gl_FragColor.rgb = mix(backdrop, gl_FragColor.rgb, gl_FragColor.a);
          gl_FragColor.a = 1.0;
        }`,
        );
      this.selectRing.visible = false;
      this.markerGroup.visible = false;
      renderer.xr.enabled = false;
      renderer.autoClear = true;
      renderer.shadowMap.autoUpdate = false;
      // Reuse the displayed scene's shadows; capture must not advance its animation.
      renderer.shadowMap.needsUpdate = false;
      this.scene.background = null;
      renderer.setClearColor(0x000000, 0);
      renderer.setRenderTarget(linear);
      renderer.setScissorTest(false);
      renderer.render(this.scene, camera);
      // Offscreen Three renders are linear: the output pass retains the visible
      // renderer's ACES exposure and sRGB transform instead of washing out the PNG.
      pass.render(renderer, output, linear);
      const pixels = new Uint8Array(width * height * 4);
      renderer.readRenderTargetPixels(output, 0, 0, width, height, pixels);
      if (!pixels.some((v, i) => i % 4 === 3 && v > 0))
        throw new Error("截图为空，请稍后重试");
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("浏览器无法创建截图画布");
      const image = context.createImageData(width, height),
        stride = width * 4;
      for (let y = 0; y < height; y++)
        image.data.set(
          pixels.subarray((height - y - 1) * stride, (height - y) * stride),
          y * stride,
        );
      context.putImageData(image, 0, 0);
      const realm = this.interior ? "studio" : this.view,
        background = `rgb(${image.data[0]}, ${image.data[1]}, ${image.data[2]})`;
      return {
        url: canvas.toDataURL("image/png"),
        realm,
        label: this.interior
          ? "我的直播间"
          : REALMS[this.view]?.name || "我的世界",
        background,
        width,
        height,
      };
    } finally {
      this.selectRing.visible = previous.selectVisible;
      this.markerGroup.visible = previous.markersVisible;
      this.scene.background = previous.background;
      renderer.xr.enabled = previous.xr;
      renderer.autoClear = previous.autoClear;
      renderer.shadowMap.autoUpdate = previous.shadowAuto;
      renderer.shadowMap.needsUpdate = previous.shadowUpdate;
      renderer.setRenderTarget(previous.target, previous.face, previous.mip);
      renderer.setViewport(previous.viewport);
      renderer.setScissor(previous.scissor);
      renderer.setScissorTest(previous.scissorTest);
      renderer.setClearColor(previous.clearColor, previous.clearAlpha);
      pass?.dispose();
      linear?.dispose();
      output?.dispose();
    }
  }
  captureWorlds() {
    const previous = {
      cameraState: this.captureCamera(),
      view: this.view,
      shot: this.shot,
      pan: this.pan.clone(),
      zoom: this.zoom,
      yaw: this.yaw,
      target: this.target.clone(),
    };
    const images = [];
    for (const realm of [
      "overworld",
      ...(n(this.state, "N1") ? ["nether"] : []),
      ...(n(this.state, "E2") ? ["end"] : []),
    ]) {
      this.setView(realm);
      this.setShot(null);
      this.home();
      this.target.copy(this.center);
      images.push({
        realm,
        url: this.capture(),
        background: this.scene.background.getStyle(),
      });
    }
    this.setView(previous.view);
    this.setShot(previous.shot);
    this.pan.copy(previous.pan);
    this.zoom = previous.zoom;
    this.yaw = previous.yaw;
    this.restoreCamera(previous.cameraState);
    this.target.copy(previous.target);
    this.resize();
    this.update();
    return images;
  }

  halt() {
    if(this.fatal)return;
    this.fatal=true;this.active=false;
    cancelAnimationFrame(this.raf);cancelAnimationFrame(this.surfaceFrame);
    this.cancelPointers();this.observer?.disconnect();
  }
  destroy() {
    this.easterEggView.dispose();
    this.connectionLine?.geometry.dispose();
    this.connectionLine?.material.dispose();
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    cancelAnimationFrame(this.surfaceFrame);
    this.renderer.domElement.removeEventListener("webglcontextlost", this.onContextLost);
    this.renderer.domElement.removeEventListener("webglcontextrestored", this.onContextRestored);
    this.stopHold();
    this.observer.disconnect();
    const disposed = new Set();
    for (const cache of [...this.caches.values(), { batch: this.batch }]) {
      for (const entry of cache.batch || []) {
        if (disposed.has(entry.mesh)) continue;
        this.disposeCache({ batch: [entry] });
        disposed.add(entry.mesh);
      }
    }
    this.caches.clear();
    this.atmosphereView.dispose();
    this.selectRing.geometry.dispose();
    this.selectRing.material.dispose();
    this.clearStudioPreview();
    this.clearOutdoorPreview();
    this.clearPlacementSurface();
    this.outdoorCue?.dispose();
    this.studioCue.dispose();
    this.landFlashGeometry.dispose();
    this.landFlashMaterial.dispose();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
    this.renderer.dispose();
  }
}
