import { atlasCount } from './atlas-progress.js';
import { World } from './world.js';
import { CATALOG } from './catalog.js';
import { collectionCount, presentationForSnapshot } from './presentation.js';
import { formatWallet } from './game.js';
import { paintMemento } from './share-card-painter.js';
export const POSTER_SIZE={width:1440,height:1920};
const fields=[{realm:'overworld',label:'主世界',w:1312,h:760},{realm:'nether',label:'下界',w:642,h:408},{realm:'end',label:'末地',w:642,h:408}];
export async function captureVictoryCard(source,{progress=()=>{},cancelled=()=>false,style=''}={}) {
 const check=()=>{if(cancelled())throw new DOMException('分享已关闭','AbortError')};check();
 const snapshot=presentationForSnapshot(structuredClone(source.snapshot)),shots=[];
 const host=document.createElement('div');host.setAttribute('aria-hidden','true');host.dataset.victoryRenderer='';host.style.cssText='position:fixed;left:-10000px;top:0;width:672px;height:420px;pointer-events:none;visibility:hidden;contain:strict';document.body.append(host);
 let world;
 try {
  world=new World(host,()=>{},{autoStart:false});world.renderer.setPixelRatio(1);world.time=snapshot.play;
  for(const [i,field] of fields.entries()) {
   check();progress(`正在取景 · ${field.label} ${i+1}/3`);await new Promise(resolve=>setTimeout(resolve,0));check();
   world.view=field.realm;world.sync(snapshot);world.update(true,true);
   shots.push({...world.captureCurrentScene({width:field.w,height:field.h}),label:field.label});
   world.disposeCache({batch:world.batch});world.batch=[];world.caches.clear();world.signature='';world.renderedView=null;
  }
 } finally {if(world){world.destroy();world.renderer.forceContextLoss()}host.remove()}
 check();progress('正在排版…');
 const statistics=[
  [`${Math.floor(snapshot.play/60)}分${Math.floor(snapshot.play%60)}秒`,source.historical?'前台通关时长':'累计前台时长'],
  [formatWallet(snapshot.total),'累计创造 · 绿宝石'],
  [atlasCount(snapshot)+' / '+(snapshot.version<7?97:CATALOG.length),'设施与功能解锁'],
  snapshot.counts.L2?[formatWallet(snapshot.live.peak),'直播最高观众']:[snapshot.ordersCompleted,'完成订单'],
 ];
 const modifications=Object.values(snapshot.upgrades?.levels||{}).reduce((a,b)=>a+b,0);
 check();return {shots,statistics,label:source.label+' · 三维度世界',release:source.release,historical:source.historical,
  detail:`${snapshot.community?.residents?.length||0} 位同伴 · ${modifications} 次设施改造 · ${collectionCount(source.snapshot)} 件收藏`};
}
export async function makeVictoryCard(source,options={}) {
 const content=await captureVictoryCard(source,options);
 if(options.cancelled?.())throw new DOMException('分享已关闭','AbortError');
 return paintMemento({...content,style:options.style||''});
}
