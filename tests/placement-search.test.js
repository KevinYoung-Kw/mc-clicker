import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh} from '../src/game.js';
import {buildSites,canPlace,landChecker,onLand,footprint,overlaps,worldScenery,WALKWAY_GAP} from '../src/layout.js';
import {gardenGround} from '../src/garden-data.js';
import {footprintHitsWater} from '../src/terrain-data.js';
// Frozen pre-optimization rule: coast sampling, water, housing and obstacle envelopes.
function referenceCanPlace(s, id, p, ignore = null) {
  if (
    !p ||
    !Number.isFinite(p.x) ||
    !Number.isFinite(p.z) ||
    !s.chunks[p.realm] || (p.rotation!==undefined&&!Number.isInteger(p.rotation))
  )
    return false;
  const f = footprint(id,p),
    a = { ...p, ...f };
  // Reserve a walkable margin, including at the exposed coast. Existing saves
  // use the same placement migration as other footprint changes.
  const marginX = Math.min(0.4, Math.max(0, (5 - f.w) / 2)),
    marginZ = Math.min(0.4, Math.max(0, (5 - f.d) / 2));
  for (
    let x = p.x - f.w / 2 - marginX;
    x <= p.x + f.w / 2 + marginX + 0.001;
    x += 0.2
  )
    for (
      let z = p.z - f.d / 2 - marginZ;
      z <= p.z + f.d / 2 + marginZ + 0.001;
      z += 0.2
    )
      if (!onLand(s, { x, z, realm: p.realm })) return false;
  if (footprintHitsWater(s, a, p.realm)) return false;
  if (overlaps(a, { x: 0, z: 0, w: 1.45, d: 1.45 }, 0.2)) return false;

  if(worldScenery(s,p.realm).some(q=>!q.native&&!gardenGround(q)&&q.id!==ignore&&overlaps(a,q,WALKWAY_GAP)))return false;
  return !Object.entries(s.placements).some(
    ([other, b]) =>
      other !== ignore &&
      b.realm === p.realm &&
      overlaps(a, { ...b, ...footprint(other,b) }, WALKWAY_GAP),
  );
}
test('batched placement search preserves every candidate and order across worlds, rotations, water and moves',()=>{
 const s=fresh();s.chunks.overworld=[{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:-1,z:0}];s.chunks.nether=[{x:0,z:0},{x:1,z:0}];s.chunks.end=[{x:0,z:0}];
 s.placements={V18:{x:4,z:0,realm:'overworld'},M17:{x:0,z:5,realm:'overworld',rotation:1}};
 s.garden.terrain={'-4,0':'water'};s.garden.plants=[{id:'planted:1',type:'oak',x:-5,z:1,realm:'overworld'}];
 for(const realm of ['overworld','nether','end'])for(const id of ['V18','V4','M17','E2'])for(const rotation of [0,1]){
  const expected=[];for(const c of s.chunks[realm])for(let x=-2;x<=2;x+=.5)for(let z=-2;z<=2;z+=.5){const p={x:c.x*5+x,z:c.z*5+z,realm,...(rotation?{rotation}:{})};if(referenceCanPlace(s,id,p,id))expected.push(p);}
  assert.deepEqual(buildSites(s,realm,id,id,rotation),expected);
 }
 const p={x:5,z:0,realm:'overworld'};assert.equal(canPlace(s,'V18',p,'V18'),true);s.garden.terrain['5,0']='water';assert.equal(canPlace(s,'V18',p,'V18'),false,'fresh search must see terrain edits');
});
test('indexed coastline retains the exact strict tolerance, including negative coordinates and holes',()=>{
 const s=fresh();s.chunks.overworld=[{x:-1,z:0},{x:0,z:1},{x:1,z:1}];const check=landChecker(s,'overworld');
 for(let k=-15;k<=15;k++)for(let j=-15;j<=15;j++)for(const e of [-.0011,-.001,0,.001,.0011]){const p={x:k/2+e,z:j/2-e,realm:'overworld'};assert.equal(check(p),!!onLand(s,p),JSON.stringify(p));}
});
