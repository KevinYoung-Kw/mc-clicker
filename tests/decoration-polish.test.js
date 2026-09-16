import test from "node:test";
import assert from "node:assert/strict";
import { fresh, restore, advance, rates, formatWallet } from "../src/game.js";
import {
  COLLECTION,
  buyExtra,
  hasExtra,
  extraEnabled,
  setExtraEnabled,
  resetExtra,
  resetAllExtras,
  equipExtra,
  dayPhase,
  weatherNow,
} from "../src/collection.js";
import { gridConnected, powerSnapshot } from "../src/power.js";

import {WEB_ITEMS} from '../src/web-catalog.js';
import {buyWeb,equipWeb,resetWeb} from '../src/presentation.js';
import {ENV_MODULES,buyEnvironment,setEnvironment,resetEnvironment,advanceEnvironment} from '../src/environment.js';
import {resetScenery} from '../src/collection.js';
function decorated() {
 const s=fresh();Object.assign(s.counts,{T1:1,V1:1,V2:1,V3:1,V4:1,X2:3,L2:1,M19:1,X7:1,V19:1});s.money=1e8;
 for(const i of WEB_ITEMS)assert.ok(buyWeb(s,i.id).ok,i.id);
 for(const i of COLLECTION.filter(i=>['flag','studio'].includes(i.category)))assert.ok(buyExtra(s,i.id).ok,i.id);
 for(const i of ENV_MODULES)assert.ok(buyEnvironment(s,i.id).ok,i.id);
 return s;
}
test("web reset preserves scenery, environment, paid ownership and production",()=>{
 const s=decorated(),before=structuredClone(s),income=rates(s).total;resetAllExtras(s);
 assert.deepEqual(s.webAppearance.equipped,{});assert.deepEqual(s.webAppearance.owned,before.webAppearance.owned);
 assert.deepEqual(s.environment,before.environment);assert.deepEqual(s.scenery,before.scenery);
 assert.deepEqual(s.counts,before.counts);assert.equal(s.money,before.money);assert.equal(rates(s).total,income);
 const restored=restore(s);assert.deepEqual(restored.webAppearance,s.webAppearance);assert.equal(weatherNow(restored),'snow');
});
test("all 46 web goods remove and reapply without new charges across reload",()=>{
 const s=decorated();for(const i of WEB_ITEMS){assert.ok(equipWeb(s,i.id));const money=s.money;resetWeb(s,i.slot);
 const r=restore(s);assert.equal(r.webAppearance.equipped[i.slot],undefined);assert.equal(r.webAppearance.owned[i.id],true);
 assert.ok(equipWeb(r,i.id));assert.equal(r.money,money);}
});
test("environment and scenery resets only change their own domain and retain purchases",()=>{
 const s=decorated(),web=structuredClone(s.webAppearance),scenery=structuredClone(s.scenery),owned={...s.environment.modules};
 resetEnvironment(s);assert.equal(weatherNow(s),'clear');assert.equal(dayPhase(s),.5);
 assert.deepEqual(s.webAppearance,web);assert.deepEqual(s.scenery,scenery);assert.deepEqual(s.environment.modules,owned);
 const e=structuredClone(s.environment);resetScenery(s,'studio');assert.deepEqual(s.environment,e);assert.deepEqual(s.webAppearance,web);
 assert.deepEqual(s.scenery.owned,scenery.owned);assert.equal(s.scenery.equipped.studioDesk,undefined);
});
test("automatic weather excludes disabled rain and snow; disabled meteors cannot emit records",()=>{
 const s=decorated();for(const id of ['env-rain','env-snow','meteor'])setEnvironment(s,{toggle:id,value:false});
 setEnvironment(s,{weather:'clear'});setEnvironment(s,{auto:true,phase:.95});
 for(let i=0;i<20;i++){advanceEnvironment(s,180);assert.ok(['clear','cloudy'].includes(weatherNow(s)));}
 assert.equal(s.environment.seen.includes('meteor'),false);assert.equal(s.environment.seen.includes('snow'),false);
 assert.equal(restore(s).environment.enabled['env-rain'],false);
});
test("legacy explicit removal remains removed after migration and second restore",()=>{
 const s=fresh();s.version=6;delete s.webAppearance;delete s.environment;delete s.scenery;
 s.counts.X2=1;s.collection={version:1,owned:{'cursor-1':true,'frame-0':true,'world-rain':true},equipped:{}};
 const saved=restore(s);assert.deepEqual(saved.webAppearance.equipped,{});
 assert.equal(saved.webAppearance.owned['web-cursor-diamond'],true);assert.equal(saved.webAppearance.owned['web-theme-oak'],true);
 assert.equal(saved.environment.access.pending,true);assert.equal(saved.counts.V19,0);assert.equal(saved.environment.enabled['env-weather'],false);
 const again=restore(saved);assert.deepEqual(again.webAppearance,saved.webAppearance);assert.deepEqual(again.environment,saved.environment);
});

test("studio lights auto-connect at any entrance position, but still obey per-device disconnect", () => {
  const s = fresh();
  Object.assign(s.counts, { M5: 1, M6: 1, L2: 1, L12: 1 });
  s.placements.M5 = { x: 0, z: 0, realm: "overworld" };
  s.placements.M6 = { x: 1, z: 0, realm: "overworld" };
  s.placements.L2 = { x: 20, z: 0, realm: "overworld" };
  assert.equal(gridConnected(s, "L12"), true);
  assert.equal(
    powerSnapshot(s).loads.find((l) => l.id === "L12").connected,
    true,
  );
  s.counts.M11 = 3;
  assert.equal(
    powerSnapshot(s).loads.find((l) => l.id === "L12").connected,
    true,
  );
  s.grid.links.L12 = false;
  assert.equal(
    powerSnapshot(s).loads.find((l) => l.id === "L12").enabled,
    false,
  );
  delete s.grid.links.L12;
  s.counts.M11 = 0;
  s.placements.L2.x = 3;
  assert.equal(gridConnected(s, "L12"), true);
});

test("cached number formatters retain visible increments and fractional large-unit precision", () => {
  assert.equal(formatWallet(15999.9), "15,999");
  assert.equal(formatWallet(16000), "16,000");
  assert.equal(formatWallet(1001999), "1.001M");
  assert.equal(formatWallet(1.00199e8), "100.199M");
  assert.equal(formatWallet(NaN), "0");
});
