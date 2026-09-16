import test from "node:test";
import assert from "node:assert/strict";
import { fresh, restore } from "../src/game.js";
import { toggleDevice } from "../src/power.js";
import { connectionAction, connectionControls } from "../src/network-ui.js";
import { facilityStatus } from "../src/facility-status.js";
import { advanceFreight, freightSpec, startFreight } from "../src/dimensional.js";
import { storageCapacity } from "../src/upgrades.js";

const power = { loads: [], sources: [], perDevice: {} };
const value = (view, key) => view.fields.find(f => f.key === key)?.value;
function fixture(id) {
  const s = fresh();
  Object.assign(s.counts, { N1: 1, E2: 1, [id]: 1 });
  s.endEyes = 12;
  return s;
}

for (const id of ["N6", "E3"]) {
  test(`${id}: old pause flags remain paused after reload and can be explicitly resumed`, () => {
    for (const flags of ["disabled", "link", "both"]) {
      let s = fixture(id);
      if (flags !== "link") s.grid.disabled.push(id);
      if (flags !== "disabled") s.grid.links[id] = false;
      s = restore(s);
      const spec = freightSpec(s, id);
      s.buffers[spec.from][spec.source] = 20;
      advanceFreight(s, spec.period, power);
      assert.equal(s.dimensions.trips[id], undefined, "reload must not resume transport");
      assert.equal(connectionAction(s, id)?.label, "恢复运行");
      const html = connectionControls(s, id);
      assert.match(html, /data-run-state="paused"/);
      assert.doesNotMatch(html, /data-network-action="(?:map|connect|disconnect)"/);
      assert.ok(toggleDevice(s, id).ok);
      assert.equal(s.grid.disabled.includes(id), false);
      assert.notEqual(s.grid.links[id], false);
      advanceFreight(s, 0.1, power);
      assert.equal(s.dimensions.trips[id].cargo, 20);
      advanceFreight(s, spec.flight + 1, power);
      const target = spec.target.startsWith("end") ? s.dimensions.awaiting : s.buffers[spec.to];
      assert.equal(target[spec.target], 20);
      assert.equal(s.dimensions.moved[id], 20);
      assert.equal(s.total, 0, "delivery does not award money");
      assert.equal(connectionAction(s, id)?.label, "暂停设备");
    }
  });

  test(`${id}: pause and resume preserve an in-flight cargo`, () => {
    let s = fixture(id);
    const spec = freightSpec(s, id);
    s.buffers[spec.from][spec.source] = 20;
    assert.ok(startFreight(s, id, power, { manual: true }).ok);
    toggleDevice(s, id);
    s = restore(s);
    const trip = structuredClone(s.dimensions.trips[id]);
    advanceFreight(s, 100, power);
    assert.deepEqual(s.dimensions.trips[id], trip);
    toggleDevice(s, id);
    advanceFreight(s, spec.flight + 1, power);
    assert.equal(s.dimensions.moved[id], 20);
    assert.equal(s.dimensions.trips[id], undefined);
  });
}

test("resuming powered devices never reconnects a deliberately disconnected grid link", () => {
  for (const id of ["M9", "E9"]) {
    const s = fixture(id);
    s.grid.links[id] = false;
    s.grid.disabled.push(id);
    toggleDevice(s, id);
    assert.equal(s.grid.links[id], false);
    assert.equal(s.grid.disabled.includes(id), false);
  }
});

test("freight countdown keeps its row and explains blocked departures", () => {
  const s = fixture("E3"), spec = freightSpec(s, "E3");
  s.dimensions.clocks.E3 = spec.period;
  const keys = facilityStatus(s, "E3", power).fields.map(f => f.key);
  function check(expectedState, expectedTime = expectedState) {
    const view = facilityStatus(s, "E3", power);
    assert.equal(value(view, "state"), expectedState);
    assert.equal(value(view, "time"), expectedTime);
    assert.deepEqual(view.fields.map(f => f.key), keys);
  }
  check("等待货物");
  s.buffers.end.raw = 20;
  s.dimensions.awaiting.endRaw = storageCapacity(s, "end", "raw");
  check("目的仓已满");
  s.dimensions.awaiting.endRaw = 0;
  s.endEyes = 0;
  check("等待传送门");
  s.endEyes = 12;
  s.grid.disabled.push("E3");
  check("设备已暂停", "已暂停");
  s.grid.disabled = [];
  check("准备装货", "可发车");
  s.dimensions.clocks.E3 = spec.period - 1;
  check("等待班次", "00:01");
  s.dimensions.clocks.E3 = spec.period;
  assert.ok(startFreight(s, "E3", power).ok);
  s.endEyes = 0; // The actual simulation allows a departed trip to finish.
  check("运输中", "00:01");
});

test("dragon status distinguishes free transport, unpowered upgrades and unloading", () => {
  const s = fixture("E9");
  s.buffers.end.goods = 20;
  s.dimensions.clocks.E9 = freightSpec(s, "E9").period;
  const missingPower = { ...power, loads: [{ id: "E9", state: "no-power", actual: 0 }] };
  assert.equal(value(facilityStatus(s, "E9", missingPower), "state"), "准备装货");
  s.upgrades.levels["dragon-route"] = 1;
  assert.equal(startFreight(s, "E9", missingPower).ok, false);
  const blocked = facilityStatus(s, "E9", missingPower);
  assert.equal(value(blocked, "state"), "等待供电");
  assert.equal(value(blocked, "time"), "等待供电");
  const supplied = { ...power, perDevice: { E9: 0.5 } };
  assert.ok(startFreight(s, "E9", supplied).ok);
  const trip = s.dimensions.trips.E9;
  trip.remaining = 4;
  assert.equal(value(facilityStatus(s, "E9", supplied), "time"), "00:08");
  advanceFreight(s, 100, missingPower);
  assert.equal(trip.remaining, 4);
  assert.equal(value(facilityStatus(s, "E9", missingPower), "time"), "等待供电");
  trip.remaining = 0;
  s.dimensions.awaiting.endGoods = storageCapacity(s, "end", "goods");
  assert.equal(value(facilityStatus(s, "E9", supplied), "time"), "等待卸货");
  s.grid.disabled.push("E9");
  assert.equal(value(facilityStatus(s, "E9", supplied), "time"), "已暂停");
});
