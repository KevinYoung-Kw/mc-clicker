import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const engine='flow-joint-r5-close',dir=new URL('../docs/v2.0.0/simulation/',import.meta.url);
const {game:G,catalog:C,food:F,lifeMenu:M,villagerLife:L}=await import(new URL(engine+'.mjs',dir));
const file=`${engine}-p8/village-life-save.json`,bytes=readFileSync(new URL(file,dir)),rows=[];
const choices=[['default'],['soup','meal','mushroom','V25',2],['roast','meal','roast','V25',2],['berry','drink','berry','V22',1],['ale','drink','ale','V22',2],['chess','activity','chess','V23',1],['dance','activity','dance','V23',2]];
for(const phase of [0,91])for(const [id,kind,choice,owner,required]of choices){
 const s=G.restore(JSON.parse(bytes),0);L.setWelfare(s,'off');for(let t=0;t<phase;t++)G.advance(s,1);
 const start={cash:s.money,total:s.total,spent:s.life.spent};let capital=0,failure=null;
 if(owner)while(G.n(s,owner)<required){const r=G.buy(s,owner);if(!r.ok){failure=r.reason;break;}capital+=r.cost;}
 if(kind&&!failure){const r=M.setLifeMenu(s,kind,choice);if(!r.ok)failure=r.reason;}
 let happiness=0,rest=0;for(let t=0;t<1200;t++){G.advance(s,1);const q=L.lifeSnapshot(s);happiness+=q.happiness;rest+=q.resting;}
 assert.ok(s.money>=0);const food=F.foodSnapshot(s);assert.ok(Math.abs(food.cooked-food.eaten-food.stock-food.discarded)<1e-5);
 const result={phase,id,failure,capital,income:s.total-start.total,expense:s.life.spent-start.spent,cash:s.money-start.cash,happiness:happiness/1200,restPersonSeconds:rest};
 assert.ok(Math.abs(result.cash-(result.income-result.expense-capital))<1e-4);
 const control=id==='default'?result:rows.find(r=>r.phase===phase&&r.id==='default');
 result.deltaCash=result.cash-control.cash;result.deltaOperating=result.deltaCash+capital;result.deltaHappiness=result.happiness-control.happiness;
 rows.push(result);console.log(JSON.stringify(result));
}
writeFileSync(new URL('r5-menu-investments.json',dir),JSON.stringify({engine,input:file,inputSha256:createHash('sha256').update(bytes).digest('hex'),scriptSha256:createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),method:'Earned life-route N1 checkpoint, two rest phases, old welfare off for all branches. Pays actual required facility levels and menu recurring costs. Twenty foreground minutes, no manual taps or later investment; not a full-route recommendation or minimum ROI guarantee.',rows},null,2)+'\n');
