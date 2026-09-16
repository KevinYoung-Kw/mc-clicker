import test from 'node:test';
import assert from 'node:assert/strict';
import {readStartupSave,recoverStartupSave,RECOVERY_KEY} from '../src/startup-storage.js';
import {parseSaveJSON} from '../src/save-validation.js';
import {commitImportedSave,BACKUP_KEY,PREVIOUS_BACKUP_KEY,readImportBackup} from '../src/save-transfer.js';
import {fresh,restore} from '../src/game.js';
function memory(entries={}){const map=new Map(Object.entries(entries));return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
for(const raw of ['{broken',JSON.stringify({version:99,money:42,counts:{}}),'null','{}',''])test('startup preserves rejected raw '+raw,()=>{
 const store=memory({save:raw});assert.throws(()=>readStartupSave(store,'save',parseSaveJSON),e=>e.code==='SAVE_INVALID');assert.equal(store.getItem('save'),raw);assert.equal(store.getItem(RECOVERY_KEY),raw);
});
test('full storage never replaces unreadable original',()=>{const store=memory({save:'broken'});store.setItem=()=>{throw Error('quota')};assert.throws(()=>readStartupSave(store,'save',parseSaveJSON));assert.equal(store.getItem('save'),'broken');});
test('empty slot is fresh; valid historical schema preserves assets',()=>{assert.equal(readStartupSave(memory(),'save',parseSaveJSON),null);for(const version of [2,3,4,5,6,7]){const s=fresh();s.version=version;s.money=987;const store=memory({save:JSON.stringify(s)});const loaded=restore(readStartupSave(store,'save',parseSaveJSON));assert.equal(loaded.money,987);}});
test('recovery backup must succeed before replacing original',()=>{const store=memory({save:'bad'}),s=fresh();store.setItem=()=>{throw Error('quota')};assert.throws(()=>recoverStartupSave(store,'save',s));assert.equal(store.getItem('save'),'bad');});
test('recovery retains raw data before valid replacement',()=>{const store=memory({save:'bad'});recoverStartupSave(store,'save',fresh());assert.equal(store.getItem(RECOVERY_KEY),'bad');assert.equal(JSON.parse(store.getItem('save')).version,fresh().version);});
test('failed main import retains previous backup and main',()=>{
 const store=memory({save:'current',[BACKUP_KEY]:'older'}),write=store.setItem;store.setItem=(k,v)=>{if(k==='save')throw Error('quota');write(k,v);};assert.throws(()=>commitImportedSave(store,'save',fresh(),fresh()));assert.equal(store.getItem('save'),'current');assert.equal(store.getItem(BACKUP_KEY),'older');assert.equal(store.getItem(PREVIOUS_BACKUP_KEY),'older');
});
test('failed backup write after main rolls both slots back',()=>{
 const store=memory({save:'current',[BACKUP_KEY]:'older'}),write=store.setItem;
 store.setItem=(k,v)=>{if(k===BACKUP_KEY&&v!=='older')throw Error('quota');write(k,v);};
 assert.throws(()=>commitImportedSave(store,'save',fresh(),fresh()));
 assert.equal(store.getItem('save'),'current');
 assert.equal(store.getItem(BACKUP_KEY),'older');
 assert.equal(readImportBackup(store),'older');
});
test('restore helper falls back to previous backup slot',()=>{
 const store=memory({[PREVIOUS_BACKUP_KEY]:'legacy'});
 assert.equal(readImportBackup(store),'legacy');
 store.setItem(BACKUP_KEY,'fresh-backup');
 assert.equal(readImportBackup(store),'fresh-backup');
});

test("current schema8 startup preserves paid research and welfare",()=>{const s=fresh();s.research.projects["cargo-tools"]={progress:5,duration:20};s.life.spent=12;const store=memory({save:JSON.stringify(s)});const r=readStartupSave(store,"save",parseSaveJSON);assert.deepEqual(r.research,s.research);assert.deepEqual(r.life,s.life);});
