import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {HOMES,homeModel}from'../src/housing-models.js';import{natureModel,gardenModel}from'../src/garden-models.js';import{mat}from'../src/models.js';import{blaze}from'../src/mob-models.js';import{exposedCoplanarFaces}from'../scripts/lib/surface-audit.mjs';
import{makeResident}from'../src/companion-models.js';import{appearance,JOBS}from'../src/residents.js';
const visible=hits=>hits.filter(h=>h.axis!=='y'||h.side!=='min');
test('housing roofs, stairs and windows have no competing above-ground box faces',()=>{
 for(const home of HOMES)for(const night of[false,true])assert.deepEqual(visible(exposedCoplanarFaces(homeModel(home,night))),[],home.id);
});
test('garden workyard, vine and poppy do not stack coplanar patterned faces',()=>{
 for(const lv of[1,2,3])assert.deepEqual(visible(exposedCoplanarFaces(gardenModel(lv))),[],'workyard '+lv);
 for(const type of['vine','poppy'])assert.deepEqual(visible(exposedCoplanarFaces(natureModel(type))),[],type);
});
test('orbiting blaze rod caps remain outside the body surface',()=>{
 const root=new T.Group(),animations=[];blaze(root,animations);for(const t of[0,.2,1,4]){animations.forEach(fn=>fn(t));assert.deepEqual(visible(exposedCoplanarFaces(root)),[]);}
});
test('legacy pixel textures retain nearest magnification with mipmaps for distant views',()=>{
 for(const color of['#916c4b','#977054','#858c80']){const t=mat(color).map;assert.ok(t);assert.equal(t.magFilter,T.NearestFilter);assert.equal(t.minFilter,T.NearestMipmapLinearFilter);assert.equal(t.generateMipmaps,true);}
});
test('resident headwear does not share a visible plane with hair across jobs and appearances',()=>{
 for(let i=0;i<24;i++)for(const job of Object.keys(JOBS)){
  const root=new T.Group();makeResident(root,{id:'probe',job,look:appearance(i),skills:{}},[]);
  const head=[];root.traverse(o=>{if(o.userData.mobPart==='head')head.push(o)});
  for(const h of head)assert.deepEqual(visible(exposedCoplanarFaces(h)),[],`${i}/${job}`);
 }
});
