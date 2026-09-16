import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {resolve, relative, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

// Read-only: detect missed shared changes AND edits to reviewed platform forks.
const folders=['src','public','tests'];
const files=['index.html','package.json','package-lock.json','vite.config.js'];
function inventory(root) {
  const result=new Map();
  const walk=dir=>{
    if(!existsSync(dir))return;
    for(const item of readdirSync(dir,{withFileTypes:true})){
      const path=resolve(dir,item.name);
      if(item.isDirectory())walk(path);
      else if(item.isFile())result.set(relative(root,path),createHash('sha256').update(readFileSync(path)).digest('hex'));
    }
  };
  folders.forEach(dir=>walk(resolve(root,dir)));
  for(const file of files){const path=resolve(root,file);if(existsSync(path))result.set(file,createHash('sha256').update(readFileSync(path)).digest('hex'));}
  return result;
}
export function checkEditions(web,xhs,manifest) {
  const a=inventory(web),b=inventory(xhs),issues=[];
  const exceptions=manifest.reviewedDifferences||{};
  for(const path of [...new Set([...a.keys(),...b.keys(),...Object.keys(exceptions)])].sort()){
    const webHash=a.get(path)||null,xhsHash=b.get(path)||null,reviewed=exceptions[path];
    if(reviewed){
      if(!reviewed.reason?.trim()||reviewed.web!==webHash||reviewed.xhs!==xhsHash)
        issues.push({path,kind:'platform-review-required'});
    }else if(webHash!==xhsHash)issues.push({path,kind:'shared-change-not-synced'});
  }
  return {ok:issues.length===0,checkedFiles:new Set([...a.keys(),...b.keys()]).size,reviewedDifferences:Object.keys(exceptions).length,issues};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const here=resolve(dirname(fileURLToPath(import.meta.url)),'..');
  const isXhs=JSON.parse(readFileSync(resolve(here,'package.json'))).name==='mc-clicker-xhs';
  const peerArg=process.argv.indexOf('--peer');
  const peer=peerArg>=0?resolve(process.argv[peerArg+1]||''):resolve(here,isXhs?'../mc-clicker':'../mc-clicker-xhs');
  if(!existsSync(resolve(peer,'src/game.js')))throw Error('找不到另一版本；请使用 --peer 指定游戏根目录。');
  const manifest=JSON.parse(readFileSync(resolve(here,'docs/edition-sync-state.json')));
  const result=checkEditions(isXhs?peer:here,isXhs?here:peer,manifest);
  console.log(JSON.stringify(result,null,2));
  if(!result.ok){console.error('需要同步或重新核查上述平台差异；不会自动覆盖任何文件。参见 docs/EDITION-SYNC.md。');process.exitCode=1;}
}
