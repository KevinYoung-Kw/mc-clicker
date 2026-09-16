import fs from 'node:fs';import{fresh,buy,frontier}from'../../src/game.js';import{prepareRecruitHousing}from'../housing-fixture.mjs';import{gardenSites,gardenPlacementReason,plantGarden}from'../../src/garden.js';import{assignJob,JOBS}from'../../src/residents.js';
import{completeFixture}from'../fixtures.mjs';
const dir=process.argv[2]||'/tmp/mc-v16-stability-fixtures';fs.mkdirSync(dir,{recursive:true});
const s=fs.existsSync(dir+'/complete.json')?JSON.parse(fs.readFileSync(dir+'/complete.json')):completeFixture();
fs.writeFileSync(dir+'/new.json',JSON.stringify(fresh(42)));
s.money=1e25;for(const id of['V4','V5','M1'])while(s.counts[id]<5)if(!buy(s,id).ok)break;
while(s.counts.V2<24){prepareRecruitHousing(s);const r=buy(s,'V2');if(!r.ok)throw Error(r.reason);}
for(const r of s.community.residents){for(const job of ['farmer','miner','hauler','musician','host','merchant']){if(assignJob(s,r.id,job).ok)break;}}
while(s.counts.V20<3)buy(s,'V20');s.guidance.notices=false;s.audio.muted=true;s.reducedMotion=true;s.savedAt=1;
// Keep land/people/facilities identical in all three density samples.
while(s.chunks.overworld.length<22){const p=frontier(s,'overworld').sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z))[0];if(!buy(s,'V1',p).ok)throw Error('land');}
const base=structuredClone(s);fs.writeFileSync(dir+'/dense-0.json',JSON.stringify(base));
for(let n=0;n<150;n++){
 const type=['wildflowers','poppy','fern','stones','vine','turf'][n%6];const p=gardenSites(s,type).find(p=>!gardenPlacementReason(s,type,p));if(!p)throw Error('No space '+n+' '+type);
 const result=plantGarden(s,type,p);if(!result.ok)throw Error(result.reason);
 if(n===49||n===149)fs.writeFileSync(dir+`/dense-${n+1}.json`,JSON.stringify(s));
}
console.log(JSON.stringify({residents:s.counts.V2,homes:s.housing.homes.length,land:s.chunks.overworld.length,plants:s.garden.plants.length}));

// Full-motion stress variant uses legal facility upgrades and all available jobs.
for(const id of new Set(Object.values(JOBS).map(j=>j.target).filter(Boolean)))while(s.counts[id]<6){if(!buy(s,id).ok)break;}
s.reducedMotion=false;s.guidance.counter=true;
for(const r of s.community.residents)assignJob(s,r.id,'idle');
for(const r of s.community.residents)for(const job of Object.keys(JOBS).filter(id=>id!=='idle'))if(assignJob(s,r.id,job).ok)break;
fs.writeFileSync(dir+'/peak.json',JSON.stringify(s));
