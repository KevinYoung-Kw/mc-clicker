// Isolated power experiments: never use the mutable economic candidate overlays.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import {pathToFileURL} from 'node:url';
const workspace = resolve(import.meta.dirname, '..');
const root = process.env.V2_POWER_SOURCE ? resolve(process.env.V2_POWER_SOURCE) : workspace;
const name = process.argv[2], configFile = process.argv[3];
if (!/^[a-z][a-z0-9-]+$/.test(name || '') || !configFile) throw Error('Usage: NEW-NAME config.json');
const config = JSON.parse(readFileSync(configFile, 'utf8'));
const dir = resolve(workspace, 'docs/v2.0.0/simulation'), target = resolve(dir, `${name}.mjs`);
if (existsSync(target)) throw Error('Refusing to replace frozen engine ' + name);
mkdirSync(dir, { recursive: true });
const hash = text => createHash('sha256').update(text).digest('hex');
const inputs = {}, applied = {};
const baseResearch = (await import(pathToFileURL(resolve(root,'src/research.js')))).RESEARCH_CATALOG;
const namespaces = ['game','catalog','residents','housing','housing-data','power','guidance','mail','upgrades','development','villager-life','research','facility-capacity',...(config.workQuality?['operations']:[]),...(config.compatibility?['save-code','save-persistent','upgrade-comparison']:[])];
const source = namespaces.map(id => `export * as ${id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())} from './src/${id}.js';`).join('\n')+(config.food?`\nexport * as food from './spikes/v2-power/food-service.js';`:'')+(config.services?`\nexport * as services from './spikes/v2-power/service-economy.js';`:'')+(config.workQuality?`\nexport * as quality from './spikes/v2-power/work-quality.js';`:'')+(config.lifeMenu?`\nexport * as lifeMenu from './spikes/v2-power/life-menu.js';`:'');
function replaceOnce(source, from, to) {
  if (source.split(from).length !== 2) throw Error('Ambiguous candidate patch: ' + from);
  return source.replace(from, to);
}
function transform(key, raw) {
  let contents=raw;
  if(config.workQuality&&key==='src/operations.js') {
    contents="import {workQuality} from '../spikes/v2-power/work-quality.js';\n"+contents;
    contents=replaceOnce(contents,'    value,\n    owners,\n    haulOwners:', '    value: value * workQuality(s,owners),\n    owners,\n    haulOwners:');
    contents=replaceOnce(contents,'function pay(s, value, owners, api) {','function pay(s, value, owners, api, priced=false) {\n  if (!priced) value *= workQuality(s,owners);');
    contents=replaceOnce(contents,'    pay(s, money, owners, api);','    pay(s, money, owners, api, true);');
  }
  if(config.bookStep!==undefined) {
    if(key==='src/game.js')contents=replaceOnce(contents,'1.55 ** c("V12")',`(1 + ${config.bookStep} * c("V12"))`);
    if(key==='src/residents.js')contents=replaceOnce(contents,'1.55 ** n(s, "V12")',`(1 + ${config.bookStep} * n(s, "V12"))`);
  }
  if(config.bookGoodsStep!==undefined) {
    if(key==='src/game.js')contents=replaceOnce(contents,'(1 + c("V12") * 0.3)',`(1 + c("V12") * ${config.bookGoodsStep})`);
    if(key==='src/orders.js')contents=replaceOnce(contents,'1 + 0.3 * n(s, "V12")',`1 + ${config.bookGoodsStep} * n(s, "V12")`);
    if(key==='src/operations.js') {
      if(contents.split('1 + 0.3 * n(s, "V12")').length!==3)throw Error('Expected farm and crafted goods training');
      contents=contents.replaceAll('1 + 0.3 * n(s, "V12")',`1 + ${config.bookGoodsStep} * n(s, "V12")`);
      contents=replaceOnce(contents,'1 + 0.25 * n(s, "V12")',`1 + ${config.bookGoodsStep} * n(s, "V12")`);
    }
  }
  if(config.bookTrade===false&&key==='src/game.js')contents=replaceOnce(contents,'skill ** 0.45 * marketService(s).factor','(2 ** c("V13")) ** 0.45 * marketService(s).factor');
  if(config.bookTrade===false&&key==='src/catalog.js')contents=replaceOnce(contents,'每升一级，全体村民的基础收入变为 1.55 倍，农牧产品也更值钱。','培训村民，逐级提高基础收入和农牧、加工货值。集市的卖货能力由集市升级。');
  if(config.trainingSplit) {
    if(key==='src/game.js') {
      contents=replaceOnce(contents,'2 ** c("V13");',`(1 + ${config.trainingSplit.masterStep} * c("V13"));`);
      contents=replaceOnce(contents,'(2 ** c("V13")) ** 0.45 * marketService(s).factor','marketService(s).factor');
      contents=replaceOnce(contents,`(1 + c("V12") * ${config.bookGoodsStep}),`,'upgradeMultiplier(s, "M2", "localValue"),');
    }
    if(key==='src/residents.js')contents=replaceOnce(contents,'2 ** n(s, "V13")',`(1 + ${config.trainingSplit.masterStep} * n(s, "V13"))`);
    if(key==='src/operations.js') {
      contents=replaceOnce(contents,'(key === "farm" ? v[1] : 8) * training','(key === "farm" ? v[1] : 8) * upgradeMultiplier(s,key === "farm" ? "V4" : "V7","localValue")');
      contents=replaceOnce(contents,`8 * (1 + ${config.bookGoodsStep} * n(s, "V12"))`,'8 * upgradeMultiplier(s,"M2","localValue")');
    }
    if(key==='src/orders.js') {
      contents=replaceOnce(contents,'import { upgradeCapability }','import { upgradeCapability, upgradeMultiplier }');
      contents=replaceOnce(contents,`(1 + ${config.bookGoodsStep} * n(s, "V12"))`,'upgradeMultiplier(s,"V4","localValue")');
    }
    if(key==='src/upgrade-catalog.js') for(const id of ['farm-beds','pen-feed','furnace-core']) {
      const start=contents.indexOf(`id: "${id}"`),end=contents.indexOf('\n  {',start);if(start<0)throw Error('Missing local training target '+id);
      const block=contents.slice(start,end<0?undefined:end);
      const revised=replaceOnce(block,'effects: {',`effects: {\n      localValue: ${config.trainingSplit.localValue},`);
      contents=contents.slice(0,start)+revised+(end<0?'':contents.slice(end));
    }
    if(key==='src/catalog.js') {
      contents=replaceOnce(contents,'培训村民，逐级提高基础收入和农牧、加工货值。集市的卖货能力由集市升级。',`每级为村民基础收入增加 ${config.bookStep*100} 个百分点。农牧与加工的品质在对应设施改造，卖货能力在集市升级。`);
      contents=replaceOnce(contents,'每升一级，全体村民的基础收入翻倍；还可学习 Lv.4–5 的个人技能。',`开放 Lv.4–5 个人技能；每级为基础收入增加 ${config.trainingSplit.masterStep*100} 个百分点，不增加集市吞吐量。`);
    }
  }
  if(key==='src/operations.js'&&config.humanHaulingLife)
    contents=replaceOnce(contents,'* cartFactor(s,a),','* cartFactor(s,a) * lifeWorkFactor(s,a),');
  if(key==='src/game.js'&&config.returnUnusedTransport) {
    contents="import {villageNetworkBudget} from '../spikes/v2-power/village-network-budget.js';\n"+contents;
    contents=replaceOnce(contents,'  const researchResult=advanceResearch(s,dt);',"  const villageBudget=villageNetworkBudget(s,dt,r.regions.overworld,electricity.perDevice.M8||0,n(s,'M8'));\n  const researchResult=advanceResearch(s,dt);");
    contents=replaceOnce(contents,'cap.haul * dt * (1 - communityReserve) + pendingRaw','(realm===\"overworld\"?cap.haul*dt-villageBudget.haul:cap.haul*dt*(1-communityReserve))+pendingRaw');
    contents=replaceOnce(contents,'cap.trade * dt * (1 - communityReserve),','realm===\"overworld\"?cap.trade*dt-villageBudget.trade:cap.trade*dt*(1-communityReserve),');
    contents=replaceOnce(contents,'        cap.haul * communityReserve,','        villageBudget.haul/dt,');
    contents=replaceOnce(contents,'        cap.trade * communityReserve,','        villageBudget.trade/dt,');
  }
  if(key==='src/villager-life.js'&&config.serviceRange!==undefined)
    contents=replaceOnce(contents,'=>2+Math.min(3,level(s,id));',`=>${config.serviceRange}+Math.min(3,level(s,id));`);
  if(key==='src/villager-life.js'&&config.food) {
    contents="import {advanceFood,takeMeal,foodParts,restoreFood} from '../spikes/v2-power/food-service.js';\n"+contents;
    contents=replaceOnce(contents,'  for(const [id,at]of Object.entries(a.visited||{})){','  for(const [id,at]of Object.entries(a.visited||{})){\n   if(id===\'V25\')continue;');
    contents=replaceOnce(contents,' parts.food=Math.min(10,parts.food);'," const meal=foodParts(s,r);parts.food=meal.food;parts.hunger=meal.hunger;\n parts.food=Math.min(10,parts.food);");
    contents=replaceOnce(contents,' parts.factor=1+Math.max(0,parts.total-50)/50*.15;',' parts.factor=(1+Math.max(0,Math.min(100,parts.total-parts.hunger)-50)/50*.15)*meal.work;');
    contents=replaceOnce(contents,'  if(!s.life||!(dt>0))return null;','  if(!s.life||!(dt>0))return null;\n  advanceFood(s,dt);');
    contents=replaceOnce(contents,'  return serviceNodes(s).filter(p=>','  return serviceNodes(s).filter(p=>p.type!==\'V25\').filter(p=>');
    contents=replaceOnce(contents,"    a.phase='going-rest';", "    takeMeal(s,r);\n    a.phase='going-rest';");
    contents=replaceOnce(contents,'  if(Number.isFinite(old.lastPerformance))','  restoreFood(s,raw);\n  if(Number.isFinite(old.lastPerformance))');
  }
  if(config.services) {
    if(key==='spikes/v2-power/food-service.js') {
      contents="import {mealUnitCost} from './service-economy.js';\n"+contents;
      contents=replaceOnce(contents,'  const amount=Math.max(', '  const unitCost=mealUnitCost(s,C.cycle);\n  const amount=Math.max(');
      contents=replaceOnce(contents,'C.cost>0?s.money/C.cost:Infinity','unitCost>0?s.money/unitCost:Infinity');
      contents=replaceOnce(contents,'const cost=amount*C.cost','const cost=amount*unitCost');
    }
    if(key==='src/villager-life.js') {
      contents="import {advanceContract,welfarePerMinute,serviceQuote,restoreContract} from '../spikes/v2-power/service-economy.js';\n"+contents;
      contents=replaceOnce(contents,'  advanceFood(s,dt);','  advanceContract(s,dt);\n  advanceFood(s,dt);');
      contents=replaceOnce(contents,"const bill=WELFARE[id].perMinute*(s.community?.residents||[]).filter(r=>!r.reserve).length;","const bill=welfarePerMinute(s,id);");
      contents=replaceOnce(contents,"const cost=policy.perMinute*(s.community?.residents||[]).filter(r=>!r.reserve).length*dt/60;","const cost=welfarePerMinute(s)*dt/60;");
      contents=replaceOnce(contents,"perMinute:people.length*(WELFARE[s.life?.welfare]?.perMinute||0)","serviceContract:serviceQuote(s),perMinute:welfarePerMinute(s)");
      contents=replaceOnce(contents,'  restoreFood(s,raw);','  restoreFood(s,raw);\n  restoreContract(s,raw);');
      contents=replaceOnce(contents,'/50*.15)*meal.work',`/50*${config.services.happinessCap})*meal.work`);
      contents=replaceOnce(contents,"a.remaining=20;a.trip=0;",`a.remaining=foodParts(s,r).food>0?${config.services.mealRest}:20;a.trip=0;`);
    }
  }
  if(config.lifeMenu) {
    if(key==='src/villager-life.js') {
      contents="import {advanceMenu,menuEffects,restoreMenu} from '../spikes/v2-power/life-menu.js';\n"+contents;
      contents=replaceOnce(contents,'  advanceContract(s,dt);','  advanceContract(s,dt);\n  advanceMenu(s,dt);');
      contents=replaceOnce(contents,' parts.total=Math.min(100,',' parts.welfare=Math.min(12,parts.welfare+menuEffects(s,r).happiness);\n parts.total=Math.min(100,');
      contents=replaceOnce(contents,`/50*${config.services.happinessCap})*meal.work`,`/50*${config.services.happinessCap})*meal.work*menuEffects(s,r).work`);
      contents=replaceOnce(contents,`a.remaining=foodParts(s,r).food>0?${config.services.mealRest}:20;`,`a.remaining=(foodParts(s,r).food>0?${config.services.mealRest}:20)+menuEffects(s,r).rest;`);
      contents=replaceOnce(contents,'  restoreContract(s,raw);','  restoreContract(s,raw);\n  restoreMenu(s,raw);');
    }
    if(key==='spikes/v2-power/food-service.js') {
      contents="import {recipeCost,recordCooking,recordMeal,recordDiscard,mealComfort} from './life-menu.js';\n"+contents;
      contents=replaceOnce(contents,'mealUnitCost(s,C.cycle);','mealUnitCost(s,C.cycle)*recipeCost(s);');
      contents=replaceOnce(contents,'if(f.stock>limit){f.discarded+=f.stock-limit;f.stock=limit;}','if(f.stock>limit){recordDiscard(s,f.stock-limit);f.discarded+=f.stock-limit;f.stock=limit;}');
      contents=replaceOnce(contents,'  f.cooked+=amount;f.stock+=amount;','  recordCooking(s,amount);\n  f.cooked+=amount;f.stock+=amount;');
      contents=replaceOnce(contents,'    f.stock=Math.max(0,f.stock-1);','    recordMeal(s,r);\n    f.stock=Math.max(0,f.stock-1);');
      contents=replaceOnce(contents,'food:fresh?C.comfort:0','food:fresh?mealComfort(s,r,C.comfort):0');
    }
    if(key==='spikes/v2-power/work-quality.js') {
      contents="import {menuEffects} from './life-menu.js';\n"+contents;
      contents=replaceOnce(contents,'weighted+=weight*((h.food>0?.12:0)+Math.max(0,Math.min(1,(h.total-50)/50))*.12);','weighted+=weight*((h.food>0?.12:0)+Math.max(0,Math.min(1,(h.total-50)/50))*.12+menuEffects(s,r).quality);');
      contents=replaceOnce(contents,'Math.min(.24,weighted/','Math.min(.28,weighted/');
    }
  }
  // Explicit flow interventions, kept separate from the old mutable economy
  // overlay (which also changes transport settlement). Each input is recorded.
  if (config.flow) {
    const flow=config.flow;
    if(key==='src/catalog.js' && flow.prices)
      contents=replaceOnce(contents,'  cost,\n  deps:','  cost: '+JSON.stringify(flow.prices)+'[id] ?? cost,\n  deps:');
    if(key==='src/game.js' && flow.broadcast) {
      contents=replaceOnce(contents,'(c("L9") ? 4 : 1) *',`${flow.broadcast.base} * (1 + ${flow.broadcast.level} * (c("L2") - 1)) * (c("L9") ? ${flow.broadcast.subscription} : 1) *`);
    }
    if(key==='src/research.js') {
      const rows=baseResearch.map(row=>({...row,...flow.research?.[row.id]})).concat(flow.extraResearch||[]);
      const start=contents.indexOf('export const RESEARCH_CATALOG = '),end=contents.indexOf('export const RESEARCH_BY_ID');
      if(start<0||end<start)throw Error('Research catalog not found');
      contents=contents.slice(0,start)+'export const RESEARCH_CATALOG = Object.freeze('+JSON.stringify(rows)+'.map(Object.freeze));\n'+contents.slice(end);
      contents=replaceOnce(contents,'  if (count(s, id)) return [];',`  if (count(s, id)) return [];
  if (${JSON.stringify(flow.gates||{})}[id]) return ${JSON.stringify(flow.gates||{})}[id];`);
      if(flow.industrialSale) {
        contents=replaceOnce(contents,'  if (hasVillageSale(s))',`  if (count(s,'M9') && (s.marketLedger?.receipts||[]).some(row=>row.source==='production:overworld'&&row.money>0&&row.quantity>0)) r.milestones.industrialSale=true;
  if (hasVillageSale(s))`);
        contents=replaceOnce(contents,'  return missing;','  if (row.industrialSale && !r.milestones?.industrialSale) missing.push("完成一次工业成品成交");\n  return missing;');
        contents=replaceOnce(contents,'    restored.milestones.villageSale = saved.milestones?.villageSale === true;','    restored.milestones.villageSale = saved.milestones?.villageSale === true;\n    restored.milestones.industrialSale = saved.milestones?.industrialSale === true;');
      }
    }
  }
  if (key === 'src/facility-capacity.js' && config.generator !== undefined)
    contents = replaceOnce(contents, 'M15: 180', `M15: ${config.generator}`);
  if (key === 'src/facility-capacity.js' && config.linearSources?.length)
    contents = replaceOnce(contents, 'return scaledCount(s, id) *', `return (${JSON.stringify(config.linearSources)}.includes(id) ? activeLevel(s,id) : scaledCount(s,id)) *`);
  if (key === 'src/catalog.js' && config.generatorPrice !== undefined) {
    const matches=[...contents.matchAll(/("M15",\s*"红石发电机组",\s*)64000/g)];
    if(matches.length!==1)throw Error('Cannot locate generator price');
    contents=contents.replace(/("M15",\s*"红石发电机组",\s*)64000/,`$1${config.generatorPrice}`);
  }
  if (key === 'src/upgrade-catalog.js') {
    for (const [id, value] of Object.entries(config.multipliers || {})) {
      const start = contents.indexOf(`id: "${id}"`), end = contents.indexOf('\n  {', start);
      if (start < 0) throw Error('Unknown upgrade ' + id);
      const block = contents.slice(start, end < 0 ? undefined : end);
      const replaced = block.replace(/generation: [\d.]+/, `generation: ${value}`);
      if (replaced === block) throw Error('No generation effect ' + id);
      contents = contents.slice(0, start) + replaced + (end < 0 ? '' : contents.slice(end));
    }
  }
  if(key==='src/upgrades.js' && config.stages) {
    contents=replaceOnce(contents,'  if (requiredLevel > 1 &&',`  for (const tech of (${JSON.stringify(config.stages)}[id]?.[next] || [])) {
    if (!s.research?.completed?.[tech]) missing.push({id: tech, type:'research', name: {industrial:'工业技术',modern:'现代技术'}[tech]});
  }
  if (requiredLevel > 1 &&`);
  }
  if(config.compatibility) {
    if(key==='src/facility-capacity.js') {
      contents=`import {powerCompensation} from '../spikes/v2-power/power-compatibility.js';\n`+contents;
      contents=replaceOnce(contents,'export function generationCapacity(s, id) {','export function generationCapacity(s, id) {\n  if (!activeLevel(s,id)) return 0;');
      contents=replaceOnce(contents,'upgradeMultiplier(s, id, "generation");','upgradeMultiplier(s, id, "generation") + powerCompensation(s,id);');
      contents+=`\nexport function purchasedGenerationCapacity(s,id) { return generationCapacity({...s,facilityStorage:{},grid:{...s.grid,powerCompensation:{}}},id); }\n`;
    }
    if(key==='src/power.js') {
      contents=`import {restorePowerCompensation} from '../spikes/v2-power/power-compatibility.js';\n`+contents;
      contents=replaceOnce(contents,'import { generationCapacity }','import { generationCapacity, purchasedGenerationCapacity }');
      contents=replaceOnce(contents,'    version: 2,','    version: 2,\n    powerBalanceRevision: 1,\n    powerCompensation: {},');
      contents=replaceOnce(contents,'  s.grid = g;','  s.grid = g;\n  restorePowerCompensation(s,raw,purchasedGenerationCapacity);');
    }
    if(key==='src/game.js') {
      contents=replaceOnce(contents,'export const VERSION = 9,','export const VERSION = 10,');
      contents=replaceOnce(contents,'[2, 3, 4, 5, 6, 7, VERSION]','[2, 3, 4, 5, 6, 7, 8, 9, VERSION]');
    }
    if(key==='src/save-validation.js') {
      contents=replaceOnce(contents,'raw.version > 9','raw.version > 10');
      contents=replaceOnce(contents,'[2, 3, 4, 5, 6, 7, 8, 9]','[2, 3, 4, 5, 6, 7, 8, 9, 10]');
    }
    if(key==='src/save-persistent.js')contents=replaceOnce(contents,'[7,8,9]','[7,8,9,10]');
  }
  return contents;
}
const result = await build({ stdin: { contents: source, resolveDir: root }, bundle: true, platform: 'node', format: 'esm', target: 'node20', write: false,
  plugins: [{ name: 'power-only', setup(b) {
    b.onResolve({filter:/food-config\.js$/},()=>({path:'food-config',namespace:'candidate-food'}));
    b.onLoad({filter:/.*/,namespace:'candidate-food'},()=>({contents:'export const FOOD_CONFIG='+JSON.stringify(config.food)+';',loader:'js'}));
    b.onResolve({filter:/service-config\.js$/},()=>({path:'service-config',namespace:'candidate-service'}));
    b.onLoad({filter:/.*/,namespace:'candidate-service'},()=>({contents:'export const SERVICE_CONFIG='+JSON.stringify(config.services)+';',loader:'js'}));
    b.onResolve({filter:/life-menu\.js$/},()=>({path:'life-menu',namespace:'candidate-menu'}));
    b.onLoad({filter:/.*/,namespace:'candidate-menu'},()=>{
      const raw=readFileSync(resolve(workspace,'spikes/v2-power/life-menu.js'),'utf8');inputs['candidate/life-menu.js']=hash(raw);applied['candidate/life-menu.js']=hash(raw);
      return {contents:raw,loader:'js',resolveDir:resolve(root,'spikes/v2-power')};
    });
    b.onResolve({filter:/spikes\/v2-power\/power-compatibility\.js$/},()=>({path:resolve(workspace,'spikes/v2-power/power-compatibility.js')}));
    b.onLoad({ filter: /\.[cm]?js$/ }, ({path}) => {
      const key = relative(root, path), raw = readFileSync(path, 'utf8');
      const contents = transform(key, raw);
      inputs[key] = hash(raw); applied[key] = hash(contents);
      return { contents, loader: 'js' };
    });
  }}] });
const code = result.outputFiles[0].text;
writeFileSync(target, code);
writeFileSync(resolve(dir, `${name}-manifest.json`), JSON.stringify({ name, config, inputs, applied, sha256: hash(code), method: 'Playable runtime snapshot; only explicitly recorded power/flow interventions applied. No mutable economic overlays, free money, free buildings or simulated income.' }, null, 2) + '\n');
console.log(name);
