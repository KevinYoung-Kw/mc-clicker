import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {checkEditions} from '../scripts/check-edition-sync.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
test('edition audit detects missed patches, new files and overwritten platform boundaries',()=>{
 const temp=mkdtempSync(join(tmpdir(),'mc-editions-')),web=join(temp,'web'),xhs=join(temp,'xhs');
 try{
  for(const root of [web,xhs]){mkdirSync(join(root,'src'),{recursive:true});writeFileSync(join(root,'src/game.js'),'same economy');}
  const manifest={reviewedDifferences:{'src/share.js':{web:hash('website sharing'),xhs:hash('album only'),reason:'Platform sharing APIs'}}};
  writeFileSync(join(web,'src/share.js'),'website sharing');writeFileSync(join(xhs,'src/share.js'),'album only');
  assert.equal(checkEditions(web,xhs,manifest).ok,true);
  writeFileSync(join(web,'src/game.js'),'new fix');
  assert.deepEqual(checkEditions(web,xhs,manifest).issues,[{path:'src/game.js',kind:'shared-change-not-synced'}]);
  writeFileSync(join(xhs,'src/game.js'),'new fix');
  writeFileSync(join(xhs,'src/share.js'),'website sharing');
  assert.deepEqual(checkEditions(web,xhs,manifest).issues,[{path:'src/share.js',kind:'platform-review-required'}],'equal files must not erase an intentional platform fork');
  writeFileSync(join(xhs,'src/share.js'),'album only');writeFileSync(join(web,'src/new.js'),'new feature');
  assert.equal(checkEditions(web,xhs,manifest).issues[0].path,'src/new.js');
 }finally{rmSync(temp,{recursive:true,force:true});}
});
