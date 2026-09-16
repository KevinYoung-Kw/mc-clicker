import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {fresh,restore,advance} from '../src/game.js';
import {noteCommunityAction,claimCommunitySouvenir,villageBesidePortal,discoverCommunityWealth} from '../src/community-stories.js';
import {COMMUNITY_SOUVENIRS} from '../src/community-souvenirs-data.js';
import {COMMUNITY_NARRATION} from '../src/community-narration.js';
import {NARRATION,IDLE_LINES,advanceNarrative} from '../src/narrative.js';
import {footprint} from '../src/layout.js';
import {gardenPlacementReason,gardenSites,plantGarden,clearGarden} from '../src/garden.js';
import {natureModel} from '../src/garden-models.js';
import {encodePersistentSave,decodeSave} from '../src/save-code.js';
import {encodeFrame,decodeFrame,archiveFromCode,codeFromArchive} from '../src/save-image-codec.js';
const yes=()=>0,no=()=>.99;
function world(){const s=fresh(1);s.play=2400;s.money=1e7;s.counts={V1:9,V20:3,T1:1,M5:1};s.placements.V20={x:0,z:5,realm:'overworld'};s.placements.M5={x:5,z:0,realm:'overworld'};s.chunks.overworld=[];for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)s.chunks.overworld.push({x,z});s.narrative.openingChoice='returning';s.narrative.companionsShown=true;s.guidance.info=true;return s;}
function portal(s){s.counts.E2=1;s.placements.E2={x:0,z:-4,realm:'overworld'};const p=footprint('E2',s.placements.E2);s.housing.homes=[{id:'home:1',type:'porch',realm:'overworld',x:p.w/2+1+1.9,z:-4,rotation:0}];}
test('nearby uses footprint edges and rotation, only physical village buildings in the same realm',()=>{
 const s=world();portal(s);assert.ok(villageBesidePortal(s));
 s.housing.homes[0].rotation=1;assert.equal(villageBesidePortal(s),false);
 s.housing.homes[0].rotation=0;s.housing.homes[0].realm='end';assert.equal(villageBesidePortal(s),false);
 s.housing.homes=[];s.placements.M9={x:2,z:-4,realm:'overworld'};assert.equal(villageBesidePortal(s),false);
 s.placements.V6={x:2,z:-4,realm:'overworld'};assert.ok(villageBesidePortal(s));delete s.placements.E2;assert.equal(villageBesidePortal(s),false);
});
test('stage is discovered only after completed building/moving, not a preview or an import',()=>{
 const s=world();portal(s);noteCommunityAction(s,'preview',{kind:'home-build',random:yes});assert.deepEqual(s.communityStories.unlocked,[]);
 const loaded=restore(s,0);assert.deepEqual(loaded.communityStories.unlocked,[]);
 noteCommunityAction(s,'build',{kind:'home-build',random:yes});assert.deepEqual(s.communityStories.unlocked,['village-stage']);
});
test('failed chance is persisted, so repeated menus, builds, wealth and reload do not reroll',()=>{
 const s=world();portal(s);for(const type of ['versions','info'])noteCommunityAction(s,type,{random:no});
 noteCommunityAction(s,'build',{kind:'home-build',random:no});s.money=1e8;discoverCommunityWealth(s,no);
 const loaded=restore(s,0);for(const type of ['versions','info'])noteCommunityAction(loaded,type,{random:yes});
 noteCommunityAction(loaded,'build',{kind:'home-build',random:yes});discoverCommunityWealth(loaded,yes);
 assert.deepEqual(loaded.communityStories.unlocked,[]);assert.deepEqual(loaded.communityStories.triggers,{});
});
test('free claim, placement, rotation, storage and replay cannot create money or duplicate copies',()=>{
 const s=world();noteCommunityAction(s,'versions',{random:yes});const money=s.money;
 assert.equal(claimCommunitySouvenir(s,'village-stage').ok,false);assert.ok(claimCommunitySouvenir(s,'request-pond').ok);assert.equal(claimCommunitySouvenir(s,'request-pond').ok,false);
 const p=gardenSites(s,'request-pond',1).find(p=>!gardenPlacementReason(s,'request-pond',p));assert.ok(p);
 const r=plantGarden(s,'request-pond',p);assert.ok(r.ok);assert.equal(s.garden.stored['request-pond'],0);assert.equal(plantGarden(s,'request-pond',{...p,x:6}).ok,false);
 assert.ok(clearGarden(s,r.id).ok);assert.equal(s.garden.stored['request-pond'],1);
 assert.ok(plantGarden(s,'request-pond',p).ok);assert.equal(s.money,money);
 const loaded=restore(decodeSave(encodePersistentSave(s,'1.8.2',1)).save,0);
 assert.deepEqual(loaded.communityStories,s.communityStories);assert.deepEqual(loaded.garden.plants,s.garden.plants);assert.equal(claimCommunitySouvenir(loaded,'request-pond').ok,false);
});
test('new story state survives image frame + restore, while historical save still runs and saves',async()=>{
 const raw=JSON.parse(fs.readFileSync(new URL('../docs/v1.7/qa/balance-baseline/industrial-first-save.json',import.meta.url))),s=restore(raw,0),oldMoney=s.money;
 advance(s,1);assert.ok(s.money>=oldMoney);noteCommunityAction(s,'versions',{random:yes});noteCommunityAction(s,'backup');
 const code=encodePersistentSave(s,'1.8.2',1),archive=await decodeFrame(await encodeFrame(archiveFromCode(code))),loaded=restore(decodeSave(codeFromArchive(archive)).save,0);
 assert.deepEqual(loaded.communityStories,s.communityStories);assert.deepEqual(loaded.counts,s.counts);assert.equal(loaded.money,s.money);
 const again=restore(JSON.parse(JSON.stringify(loaded)),0);assert.deepEqual(again.communityStories,loaded.communityStories);
});
test('hold anecdote needs actual long hold and postgame story needs an editing action',()=>{
 const s=world();noteCommunityAction(s,'hold',{duration:19,random:yes});assert.equal(s.communityStories.triggers['community-hold'],undefined);
 noteCommunityAction(s,'hold',{duration:20,random:yes});assert.equal(s.communityStories.triggers['community-hold'],s.play);
 noteCommunityAction(s,'build',{kind:'home-move',random:yes});assert.equal(s.communityStories.triggers['community-overtime'],undefined);
 s.completed=true;noteCommunityAction(s,'build',{kind:'home-move',random:yes});assert.equal(s.communityStories.triggers['community-overtime'],s.play);
});
test('stories wait for quiet, pause behind receipts and leave at least five minutes between starts',()=>{
 const s=world();s.narrative.seen=[...NARRATION,...IDLE_LINES].filter(r=>!r.community).map(r=>r.id);
 noteCommunityAction(s,'info',{random:yes});noteCommunityAction(s,'versions',{random:yes});
 for(let i=0;i<35;i++){s.play++;advanceNarrative(s,1,{available:false});}assert.equal(s.narrative.current,null);
 const starts=[];let previous=null;for(let i=0;i<370;i++){s.play++;advanceNarrative(s,1);const c=s.narrative.current;if(c&&c.id!==previous)starts.push({id:c.id,at:s.play});previous=c?.id;}
 assert.equal(starts.length,2);assert.ok(starts[1].at-starts[0].at>=300);assert.equal(new Set(starts.map(x=>x.id)).size,2);
});
test('keepsakes fit their declared footprints with distinct geometry and no rotating update callbacks',()=>{
 const sizes=[];for(const i of COMMUNITY_SOUVENIRS){const g=natureModel(i.id),size=new T.Box3().setFromObject(g).getSize(new T.Vector3());assert.ok(size.x<=i.w+.001,`${i.id} width ${size.x}`);assert.ok(size.z<=i.d+.001,`${i.id} depth ${size.z}`);sizes.push(size.y);g.traverse(o=>assert.equal(typeof o.userData.update,'undefined'));}assert.equal(new Set(sizes).size,3);
});
