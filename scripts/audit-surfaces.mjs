import {writeFileSync} from 'node:fs';import * as T from 'three';
import {exposedCoplanarFaces} from './lib/surface-audit.mjs';
import {natureModel,gardenModel} from '../src/garden-models.js';import {GARDEN_ITEMS} from '../src/garden-data.js';
import {HOMES,homeModel} from '../src/housing-models.js';import {ModelKit} from '../src/models.js';
import {makeObject,makeActor} from '../src/objects.js';import{ITEMS}from'../src/catalog.js';import{fresh}from'../src/game.js';
const report={};function scan(name,root){const hits=exposedCoplanarFaces(root);if(hits.length)report[name]=hits;}
for(const i of GARDEN_ITEMS)scan('garden:'+i.id,natureModel(i.id));for(const i of HOMES)scan('home:'+i.id,homeModel(i));for(const lv of[1,2,3])scan('workyard:'+lv,gardenModel(lv));
const hero=new T.Group();new ModelKit(hero,[],fresh(42)).block();scan('hero',hero);
for(const i of Object.values(ITEMS)){const s=fresh(42);s.counts[i.id]=1;const g=new T.Group();makeObject(g,i,s,[]);scan(i.id,g);}
for(const id of ['V2','V15','V16','N3','N5','N6','E3','E5','E9']){const g=new T.Group();makeActor(g,id,[],0,fresh(42));scan('actor:'+id,g);}
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(Object.fromEntries(Object.entries(report).map(([id,v])=>[id,v.length])));
