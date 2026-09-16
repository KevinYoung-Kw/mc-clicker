// Paired foreground probe from an earned P9 world. No money or ownership grants.
import fs from 'node:fs';
import {restore,buy,advance,mine,sites,frontier} from '../src/game.js';
import {setLifeMenu} from '../src/life-menu.js';
import {lifeSnapshot} from '../src/villager-life.js';
import {foodSnapshot} from '../src/food-service.js';
import {persistentSave} from '../src/save-persistent.js';
const out='docs/v2.0.0/qa/alpha3/menu-investment.json';
const raw=JSON.parse(fs.readFileSync('docs/v2.0.0/qa/alpha3/routes/village-life-save.json'));
const base=restore(raw,0),wallet=base.money,setup=[];let setupSeconds=0;
base.realm='overworld';
for(const id of ['V25','V22','V23'])while((base.counts[id]||0)<2){
 if(setupSeconds>1200)throw Error('Setup failed to fund '+id);
 const room=base.counts[id]||sites(base,'overworld',null,id).length;
 const r=room?buy(base,id):buy(base,'V1',frontier(base)[0]);
 if(r.ok){setup.push({id:room?id:'V1',at:setupSeconds,price:r.cost});continue;}
 advance(base,1);if(setupSeconds%2===0)mine(base);setupSeconds++;
}
const records=[];
for(const [name,meal,drink,activity] of [
 ['家常菜 / 清水 / 自由休闲','home','water','free'],
 ['菌菇汤 / 浆果饮 / 棋局','mushroom','berry','chess'],
 ['烤肉 / 清水 / 舞会','roast','water','dance'],
 ['家常菜 / 麦芽酒 / 自由休闲','home','ale','free'],
]){
 const s=restore(persistentSave(base),0),start={money:s.money,total:s.total,manual:s.manualIncome,spent:s.life.spent,cooked:s.life.food.cooked,eaten:s.life.food.eaten};
 for(const [k,v] of Object.entries({meal,drink,activity})){const r=setLifeMenu(s,k,v);if(!r.ok)throw Error(r.reason);}
 let happiness=0,hungry=0;
 for(let t=0;t<1200;t++){advance(s,1);if(t%2===0)mine(s);happiness+=lifeSnapshot(s).happiness;hungry+=foodSnapshot(s).hungry;}
 records.push({name,seconds:1200,grossIncome:s.total-start.total,manualIncome:s.manualIncome-start.manual,serviceSpend:s.life.spent-start.spent,netWalletChange:s.money-start.money,averageHappiness:happiness/1200,hungryPersonSeconds:hungry,cooked:s.life.food.cooked-start.cooked,eaten:s.life.food.eaten-start.eaten,selected:s.life.menuState.selected});
}
fs.writeFileSync(out,JSON.stringify({method:'Same earned world and installed venues; 1200 foreground seconds, one tap every two seconds, no purchases after choice. Isolates operating choices, not whole-facility ROI. Real wallet, food and delivery simulation. Existing home-cooked stock is not relabelled on switching.',setupSeconds,setup,walletBeforeSetup:wallet,walletAfterSetup:base.money,records},null,2)+'\n');console.log(JSON.stringify(records));
