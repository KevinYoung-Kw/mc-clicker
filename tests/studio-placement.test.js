import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { fresh, restore } from "../src/game.js";
import { ITEMS } from "../src/catalog.js";
import { COLLECTION_BY_ID } from "../src/collection.js";
import { footprint } from "../src/layout.js";
import { STUDIO } from "../src/studio-layout.js";
import { broadcastHouse } from "../src/village-models.js";
import {
  studioSpec,
  studioEntities,
  studioSites,
  canPlaceStudio,
  placeStudio,
  entityForPurchase,
  restoreStudio,
  ensureStudio,
} from "../src/studio-placement.js";

function completeRoom() {
  const s = fresh(0);
  s.money = 123456;
  for (let i = 1; i <= 14; i++) s.counts[`L${i}`] = ITEMS[`L${i}`].max;
  for (const item of Object.values(COLLECTION_BY_ID))
    if (["studio", "flag"].includes(item.category)) {
      s.scenery.owned[item.id] = true;
      s.scenery.equipped[item.slot] = item.id;
    }
  return s;
}
function render(s, interior = true) {
  const root = new T.Group(),
    animations = [];
  broadcastHouse(root, animations, interior, s);
  root.updateMatrixWorld(true);
  return { root, animations };
}
function find(root, key) {
  let result;
  root.traverse((o) => {
    if (o.userData.studioKey === key) result = o;
  });
  return result;
}

test("three outdoor entrance levels stay on two by two land, while room has independent six by five space", () => {
  assert.deepEqual(footprint("L2"), { w: 2, d: 2 });
  assert.equal(STUDIO.width, 6);
  assert.equal(STUDIO.depth, 5);
  const shapes = [];
  for (let level = 1; level <= 3; level++) {
    const s = completeRoom();
    s.counts.L2 = level;
    const { root } = render(s, false),
      bounds = new T.Box3().setFromObject(root);
    assert.ok(
      bounds.min.x >= -1 &&
        bounds.max.x <= 1 &&
        bounds.min.z >= -1 &&
        bounds.max.z <= 1,
    );
    let meshes = 0;
    root.traverse((o) => {
      if (o.isMesh) meshes++;
      assert.equal(o.userData.studioEquipment, undefined);
    });
    shapes.push(meshes);
  }
  assert.ok(shapes[0] < shapes[1] && shapes[1] < shapes[2]);
});

test("legacy full room receives deterministic non-overlapping placements without losing any owned item or income", () => {
  const s = completeRoom(),
    counts = structuredClone(s.counts),
    collection = structuredClone(s.collection),
    money = s.money;
  restoreStudio(s, null);
  const first = structuredClone(s.studio);
  assert.equal(studioEntities(s).length, 31);
  for (const entity of studioEntities(s))
    assert.ok(
      canPlaceStudio(s, entity.key, entity.position, { ignoreKey: entity.key }),
      entity.key,
    );
  restoreStudio(s, s.studio);
  assert.deepEqual(s.studio, first);
  assert.deepEqual(s.counts, counts);
  assert.deepEqual(s.collection, collection);
  assert.equal(s.money, money);
  const corrupt = structuredClone(first);
  corrupt.placements.L6 = { x: 99, z: 0, rotation: 0 };
  corrupt.placements.L10 = { ...corrupt.placements.L12 };
  corrupt.placements.cheat = { x: 0, z: 0, rotation: 0 };
  restoreStudio(s, corrupt);
  assert.equal(s.studio.placements.cheat, undefined);
  for (const entity of studioEntities(s))
    assert.ok(
      canPlaceStudio(s, entity.key, entity.position, { ignoreKey: entity.key }),
      entity.key,
    );
  assert.equal(s.money, money);
});

test("preview supports an unowned future fixture and cancellation cannot change wallet or layout", () => {
  const s = fresh(0);
  s.counts.L2 = 1;
  ensureStudio(s);
  const before = structuredClone(s),
    key = entityForPurchase(s, "L3"),
    sites = studioSites(s, key);
  assert.equal(key, "L3:0");
  assert.ok(sites.length > 10);
  assert.equal(canPlaceStudio(s, key, sites[0]), true);
  assert.deepEqual(s, before);
  assert.equal(placeStudio(s, key, sites[0]).ok, false);
  assert.deepEqual(s, before);
  s.counts.L3 = 1;
  assert.equal(entityForPurchase(s, "L3"), "L3:1");
  s.counts.L3 = 2;
  assert.equal(entityForPurchase(s, "L3"), "L3:2");
  assert.equal(entityForPurchase(s, "L6"), "L6");
  assert.equal(entityForPurchase(s, "studioShelf-1"), "studioShelf");
  assert.equal(entityForPurchase(s, "flag-2"), "flag");
});

test("moving and rotating a fixture persists without touching its level, income, or another fixture", () => {
  const s = completeRoom();
  ensureStudio(s);
  const original = structuredClone(s),
    key = "L6",
    p = studioSites(s, key, { ignoreKey: key, rotation: 1 }).find(
      (p) => p.x < -0.5 && p.z > 0.5,
    );
  assert.ok(p);
  assert.equal(placeStudio(s, key, p).ok, true);
  assert.equal(s.studio.revision, 1);
  assert.equal(placeStudio(s, key, p).ok, true);
  assert.equal(s.studio.revision, 1);
  assert.deepEqual(s.counts, original.counts);
  assert.equal(s.money, original.money);
  assert.deepEqual(s.studio.placements.L12, original.studio.placements.L12);
  const saved = structuredClone(s.studio);
  restoreStudio(s, JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(s.studio, saved);
  const { root, animations } = render(s),
    model = find(root, key);
  assert.ok(model);
  assert.equal(model.position.x, p.x);
  assert.equal(model.position.z, p.z);
  assert.equal(model.rotation.y, Math.PI / 2);
  s.live.gifts = [{ id: 1 }];
  animations.forEach((fn) => fn(2));
  assert.ok(new T.Box3().setFromObject(model).min.x >= -STUDIO.width / 2);
});

test("overlap, blocked furniture, outside bounds and invalid wall attachment never overwrite saved layout", () => {
  const s = completeRoom();
  ensureStudio(s);
  const before = structuredClone(s.studio);
  for (const p of [
    { x: 9, z: 0, rotation: 0 },
    { x: 0, z: -1.75, rotation: 0 },
    { x: 2.75, z: 2.25, rotation: 1 },
    { x: 1.5, z: 0.5, rotation: 0 },
    { x: 0.123, z: 0, rotation: 0 },
  ]) {
    assert.equal(placeStudio(s, "L10", p).ok, false, JSON.stringify(p));
    assert.deepEqual(s.studio, before);
  }
  assert.equal(canPlaceStudio(s, "L5", { x: 0, z: 0, rotation: 0 }), false);
  assert.equal(canPlaceStudio(s, "L5", { x: 0, z: -2.25, rotation: 1 }), false);
  assert.equal(
    canPlaceStudio(s, "studioDesk", { x: 1, z: 0, rotation: 0 }),
    false,
  );
  assert.ok(
    studioSites(s, "studioSign").every(
      (p) => p.z === -2.25 && p.rotation === 0,
    ),
  );
});

test("every allowed mounting surface matches rendered geometry, including rotated floor objects at boundaries", () => {
  const s = completeRoom();
  ensureStudio(s);
  for (const entity of studioEntities(s).filter((e) => e.movable)) {
    for (const rotation of entity.layer.startsWith("wall")
      ? [0]
      : [0, 1, 2, 3]) {
      const sites = studioSites(s, entity.key, {
        ignoreKey: entity.key,
        rotation,
      });
      assert.ok(sites.length, entity.key);
      for (const p of [sites[0], sites.at(-1)]) {
        const trial = structuredClone(s);
        assert.ok(placeStudio(trial, entity.key, p).ok);
        const { root } = render(trial),
          model = find(root, entity.key),
          b = new T.Box3().setFromObject(model);
        assert.ok(
          b.min.x >= -3 && b.max.x <= 3 && b.min.z >= -2.5 && b.max.z <= 2.5,
          entity.key + " " + JSON.stringify(b),
        );
      }
    }
  }
});

test("all purchased decor variants stay visible as collectibles when no style is equipped", () => {
  const s = completeRoom();
  s.scenery.equipped = {};
  const { root } = render(s),
    samples = [],
    equipped = [];
  root.traverse((o) => {
    if (o.userData.studioCollectible)
      samples.push(o.userData.studioCollectible);
    if (o.userData.studioDecoration) equipped.push(o.userData.studioDecoration);
  });
  assert.equal(samples.length, 11);
  assert.equal(equipped.length, 0);
  assert.equal(new Set(samples).size, 11);
  assert.ok(samples.includes("flag-2"));
  assert.ok(samples.includes("studioShelf-1"));
});

test("removing a furniture decoration frees its floor space while remembering its last position", () => {
  const s = completeRoom();
  ensureStudio(s);
  const withoutShelf = structuredClone(s);
  delete withoutShelf.scenery.equipped.studioShelf;
  const shelfPosition = studioSites(s, "studioShelf", {
    ignoreKey: "studioShelf",
  }).find((p) => canPlaceStudio(withoutShelf, "L6", p));
  assert.ok(
    shelfPosition,
    "both pieces fit somewhere outside the staff landing",
  );
  assert.ok(placeStudio(s, "studioShelf", shelfPosition).ok);
  assert.equal(canPlaceStudio(s, "L6", shelfPosition), false);
  delete s.scenery.equipped.studioShelf;
  assert.equal(canPlaceStudio(s, "L6", shelfPosition), true);
  assert.deepEqual(s.studio.placements.studioShelf, shelfPosition);
  assert.ok(s.scenery.owned["studioShelf-1"]);
});


test("wall layers and tall floor furniture obey actual model height, including old overlapping saves", () => {
  const s = completeRoom(); restoreStudio(s, null);
  assert.equal(canPlaceStudio(s, 'L11', {...s.studio.placements.L8}), false, 'lower console intersects upper program board');
  const old = structuredClone(s.studio);
  old.placements.L11 = {...old.placements.L8};
  const money=s.money, counts=structuredClone(s.counts);
  restoreStudio(s, old);
  assert.notDeepEqual(s.studio.placements.L8, s.studio.placements.L11);
  const once=structuredClone(s.studio.placements);
  restoreStudio(s, s.studio);
  assert.deepEqual(s.studio.placements,once);
  assert.equal(s.money,money);assert.deepEqual(s.counts,counts);
});

test("both sets of full-room decor fit and rendered equipment volumes do not intersect", () => {
  for(const variant of [0,1]) {
    const s=completeRoom();
    for(const slot of ['studioDesk','studioWall','studioSign','studioShelf'])s.scenery.equipped[slot]=slot+'-'+variant;
    ensureStudio(s);
    assert.ok(studioEntities(s).every(e=>e.placed),'all purchased objects have real positions');
    const {root}=render(s), boxes=[];
    root.traverse(o=>{const key=o.userData.studioKey;if(key&&!key.startsWith('collectible:')&&key!=='studioWall')boxes.push({key,box:new T.Box3().setFromObject(o)});});
    for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++) {
      const overlap=boxes[a].box.clone().intersect(boxes[b].box).getSize(new T.Vector3());
      assert.ok(overlap.x<.01||overlap.y<.01||overlap.z<.01,boxes[a].key+' overlaps '+boxes[b].key);
    }
  }
});

test("re-equipping a shelf repairs an occupied remembered position instead of overlapping a new device", () => {
  const s=completeRoom();ensureStudio(s);
  const original=s.scenery.equipped.studioShelf;
  delete s.scenery.equipped.studioShelf;
  const site=studioSites(s,'L13').find(p=>canPlaceStudio(s,'studioShelf',p));
  assert.ok(site);s.studio.placements.studioShelf={...site};
  assert.ok(placeStudio(s,'L13',site).ok);
  s.scenery.equipped.studioShelf=original;
  ensureStudio(s);
  assert.notDeepEqual(s.studio.placements.L13,s.studio.placements.studioShelf);
  for(const e of studioEntities(s))assert.ok(e.placed&&canPlaceStudio(s,e.key,e.position,{ignoreKey:e.key}),e.key);
});
