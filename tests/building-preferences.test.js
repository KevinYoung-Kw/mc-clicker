import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,restore} from '../src/game.js';
import {editingPreference,setEditingPreference,placementDirection,rememberPlacementDirection,restoreEditing} from '../src/editing.js';
import {encodeSave,decodeSave} from '../src/save-code.js';
test('continuous housing and completed directions survive reload and transfer without changing the old categories',()=>{
 const s=fresh(42);setEditingPreference(s,'home',true);setEditingPreference(s,'land',true);
 for(const [kind,rotation] of [['build',1],['home-build',2],['garden-build',3],['studio-build',1]])rememberPlacementDirection(s,{kind,rotation});
 const expected=restoreEditing(s.editing);
 assert.deepEqual(restore(s).editing,expected);
 assert.deepEqual(restore(decodeSave(encodeSave(s)).save).editing,expected);
 assert.equal(editingPreference(s,'home'),true);assert.equal(editingPreference(s,'garden'),false);
 rememberPlacementDirection(s,{kind:'home-move',rotation:3});assert.equal(placementDirection(s,'home'),2);
 setEditingPreference(s,'unknown',true);assert.deepEqual(restoreEditing(s.editing),expected);
});
test('old or damaged orientation preferences have safe defaults',()=>{
 assert.equal(placementDirection(fresh(),'home'),0);
 const saved=restoreEditing({homeContinuous:'yes',directions:{building:4,home:-1,garden:1.5,studio:2}});
 assert.equal(saved.homeContinuous,false);assert.deepEqual(saved.directions,{building:0,home:0,garden:0,studio:2});
});

test('current portable encoding preserves the new building settings and unfrozen narration text',async()=>{
 const {createRequire}=await import('node:module'),brotli=createRequire(import.meta.url)('brotli-wasm');
 const {encodePortableSave,decodePortableSave}=await import('../src/save-brotli.js');
 const {NARRATOR_COPY}=await import('../src/narrator-copy.js');
 const s=fresh(42);setEditingPreference(s,'home',true);rememberPlacementDirection(s,{kind:'home-build',rotation:3});
 s.narrative.history=['save-transfer','building-editing'].flatMap(id=>NARRATOR_COPY[id].lines.map(text=>({id,text})));
 const decoded=await decodePortableSave(await encodePortableSave(s,'test',42,async()=>brotli),async()=>brotli);
 assert.deepEqual(restore(decoded.save).editing,restoreEditing(s.editing));assert.deepEqual(decoded.save.narrative.history,s.narrative.history);
});
