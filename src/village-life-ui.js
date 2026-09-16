import {menuChoices,menuState,menuBudget,setLifeMenu,enableLifeServices} from './life-menu.js';
import {foodCapacity} from './food-service.js';
import {serviceQuote} from './service-economy.js';
import {housingCapacity} from './housing-data.js';
import {RESEARCH_CATALOG,RESEARCH_UNLOCKS,researchStatus,startResearch,pauseResearch,researchPrerequisiteItems} from './research.js';
import {LIFE_SERVICES,WELFARE,lifeSnapshot,setWelfare,lifeHappiness,happinessLabel,serviceNodes,serviceCapacity,serviceRange} from './villager-life.js';
import {refreshFarmSites} from './farm-sites-ui.js';
import {CIVIC_TYPES,civicCount,civicCost} from './civic-data.js';
import {civicReason} from './civic-sites.js';
import {formatWallet} from './game.js';
import {purchaseStatus,buttonContent} from './purchase-feedback.js';
import {itemSummary} from './first-steps.js';
import {ITEMS} from './catalog.js';
import {escapeHtml as esc} from './residents.js';
import {icon,iconButton} from './icons.js';
const time=v=>{const seconds=Math.ceil(v);return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;};
const unlocks=RESEARCH_UNLOCKS;
const SERVICE_MENUS={V25:'meal',V22:'drink',V23:'activity'};
const MENU_NAMES={meal:'食堂伙食',drink:'酒馆饮品',activity:'公共活动'};
const SERVICE_NAMES={V25:'供餐设置',V21:'休闲设施',V22:'饮品设置',V23:'活动设置'};
const art=id=>`<img src="${import.meta.env?.BASE_URL||'/'}icons/${id}.png" alt="" width="44" height="44" loading="lazy">`;
const techIcon=id=>id==='basic-power'?'gear':id==='industrial'?'bolt':id==='modern'?'circuit':id==='cargo-tools'?'box':id==='broadcasting'?'sound':id==='television'?'camera':id==='streaming'?'circuit':'home';
export function lifeSummaryMarkup(s){
 if(!(s.counts.V2>0))return '';
 const a=lifeSnapshot(s);
 return `<button class="life-summary" data-life-open aria-label="查看全村生活"><span>${icon('home',18)} 全村生活</span><span><b data-life-happiness>${a.happiness}</b><small data-life-mood>${happinessLabel(a.happiness)}</small></span><span><b data-life-resting>${a.resting}</b><small> 位休息</small>${icon('chevron',14)}</span></button>`;
}
export function createVillageLifeUI(api){
 function researchRow(row){
  const s=api.state();return `<article data-research-row="${row.id}"><div class="research-heading"><span class="research-symbol">${icon(techIcon(row.id),22)}</span><div><h4>${row.name}</h4><small>${row.id==='basic-power'?'农耕时代 · 起步研究':row.optional?'专项研究':'时代推进'}</small></div><button data-research-action="${row.id}"></button></div><div class="research-unlocks" aria-label="${row.name}开放的建设">${unlocks[row.id].map(id=>`<button data-detail="${id}" aria-label="查看${ITEMS[id].name}">${art(id)}<span>${ITEMS[id].name}</span></button>`).join('')}</div><div class="research-progress" ${row.duration?'':'hidden'}><span data-research-label></span><progress max="1" value="0" aria-label="${row.name}进度"></progress><b data-research-time></b></div><p class="purchase-reason" data-research-reason></p><div class="requirement-links">${row.beds&&row.beds>housingCapacity(s)?'<button data-housing-open>补充住址 →</button>':''}${row.residents&&(s.community?.residents||[]).filter(r=>!r.reserve).length<row.residents?'<button data-open="village">添加村民 →</button>':''}${researchPrerequisiteItems(s,row.id).map(i=>`<button data-detail="${i.id}">${esc(row.items.find(x=>x[0]===i.id)?.[2]||i.id)} ${icon('arrow',14)}</button>`).join('')}</div></article>`;
 }
 function researchMarkup(){
  return `<section class="life-page research-page" aria-label="图书馆研发"><ol class="era-route" aria-label="发展路线">${[['farm','wheat','农耕'],['industrial','bolt','工业'],['modern','circuit','现代']].map(([id,symbol,name])=>`<li data-era-step="${id}">${icon(symbol,20)}<span>${name}</span><small data-era-state></small></li>`).join('')}</ol><div class="research-section-heading"><h4>发展技术</h4><small>研究后开放以下建设</small></div><div class="research-list">${RESEARCH_CATALOG.filter(r=>!r.optional).map(researchRow).join('')}</div><div class="research-section-heading"><h4>专项研究</h4><button class="quiet-button" data-life-researcher>${icon('person',16)} 研究员</button></div><div class="research-list">${RESEARCH_CATALOG.filter(r=>r.optional&&(!r.requires.length||r.requires.every(id=>api.state().research?.completed[id])||api.state().research?.projects[r.id]||researchStatus(api.state(),r.id).kind==='complete')).map(researchRow).join('')}</div></section>`;
 }
 function branchesMarkup(id){
  const branches=(api.state().life.sites||[]).filter(p=>p.type===id),row=LIFE_SERVICES[id];
  return branches.map(p=>`<div class="civic-row"><span>${row.name} · ${branches.indexOf(p)+2}号<small>${p.stored?'已收起':'营业中'}</small></span><div>${p.stored?`<button data-civic-move="${p.id}">免费回摆</button>`:iconButton('locate','定位分点',`data-civic-locate="${p.id}"`)+iconButton('wrench','搬动分点',`data-civic-move="${p.id}"`)+iconButton('box','收起分点',`data-civic-store="${p.id}"`)}</div></div>`).join('');
 }
 function servicesMarkup(){const s=api.state();return Object.entries(LIFE_SERVICES).map(([id,row])=>{
  const has=!!s.counts[id],kind=SERVICE_MENUS[id];
  return `<article class="life-service" data-life-service="${id}"><div class="life-service-heading">${art(id)}<div><h4>${row.name}</h4><small>${has?(kind?`<span data-life-selection="${kind}"></span>`:'全村共享 · 歇脚放松'):'尚未建造'}</small></div>${has?iconButton('gear',`设置${row.name}`,`data-detail="${id}"`):`<button class="quiet-button" data-detail="${id}">去建造 ${icon('arrow',14)}</button>`}</div>${has?`<div class="life-service-status"><span data-service-status="${id}"></span></div>`:''}</article>`;
 }).join('');}
 function facilityMarkup(id){
  const s=api.state(),item=ITEMS[id],st=purchaseStatus(s,item),kind=SERVICE_MENUS[id];
  return `<section class="life-page life-facility" data-life-facility="${id}">
    <div class="life-facility-heading" data-card="${id}">${art(id)}<div><h4>${SERVICE_NAMES[id]}</h4><small>Lv.${s.counts[id]} · 全村共享</small></div><button class="buy" data-buy="${id}" aria-label="升级${item.name}">${buttonContent(st)}</button><p class="purchase-reason" data-purchase-reason ${st.reason?'':'hidden'}>${st.reason}</p></div>
    <p class="life-facility-effect">${itemSummary(s,item).effect}</p>
    ${kind?menusMarkup(kind):'<p class="life-caption">村民会自动休闲，无需安排岗位。</p>'}
    <div class="research-section-heading"><h4>${id==='V25'?'供餐设施':'营业设施'}</h4>${CIVIC_TYPES[id]?`<button data-civic-build="${id}" class="quiet-button">${icon('plus',14)} 增设 <span data-civic-cost="${id}">${formatWallet(civicCost(s,id))} ◆</span></button>`:''}</div>
    <div class="life-service-status"><span data-service-status="${id}"></span></div>${branchesMarkup(id)}${CIVIC_TYPES[id]?'<p class="purchase-reason" data-life-civic-reason></p>':''}
    <button class="life-overview-link quiet-button" data-life-open>${icon('home',18)} 全村生活 ${icon('arrow',14)}</button>
  </section>`;
 }
 function menusMarkup(only=null){
  const s=api.state(),legacy=s.life.serviceMode==='legacy';
  if(legacy)return '<label class="management-field"><select data-life-welfare aria-label="原有福利">'+Object.entries(WELFARE).map(([id,p])=>'<option value="'+id+'" '+(s.life.welfare===id?'selected':'')+'>'+p.name+'</option>').join('')+'</select></label><div class="research-section-heading"><h4>原有福利</h4></div><p class="life-caption">现有费用与服务保留。启用新供餐后，食堂会花绿宝石备餐，酒品与活动可另选。</p><button class="quiet-button" data-life-enable>启用供餐与活动 →</button><p class="purchase-reason" data-life-message role="status"></p>';
  const descriptions={home:'吃饱后休息更快，幸福 +8',mushroom:'幸福 +10 · 手工货值 +3% · 多歇 1 秒',roast:'幸福 +8 · 工作 +4%',water:'免费解渴',berry:'幸福 +3',ale:'幸福 +7 · 工作 −3%',free:'自由安排，不额外花钱',chess:'幸福 +4 · 手工货值 +2% · 多歇 2 秒',dance:'幸福 +5 · 工作 +5% · 多歇 3 秒'};
  return '<div class="research-section-heading"><h4>当前选择</h4><b class="life-bill">最高 <span '+(only?'data-life-menu-cost="'+only+'"':'data-life-cost')+'></span> ◆ / 分</b></div>'+Object.entries(MENU_NAMES).filter(([kind])=>!only||kind===only).map(([kind,name])=>'<fieldset class="life-menu"><legend>'+name+'</legend>'+menuChoices(s,kind).map(o=>{
   const price=kind==='meal'?foodCapacity(s)*serviceQuote(s).food*o.cost:menuBudget(s,kind,o.id);
   return '<button type="button" class="life-menu-option" data-life-menu="'+kind+'" data-life-option="'+o.id+'" aria-pressed="'+(menuState(s).selected[kind]===o.id)+'" '+(o.available?'':'disabled')+'><span class="life-choice-mark">'+(menuState(s).selected[kind]===o.id?icon('check',16):'<span class="life-choice-empty"></span>')+'</span><span><b>'+o.name+'</b><small>'+descriptions[o.id]+'</small></span><span class="life-choice-cost" data-menu-price="'+kind+':'+o.id+'">'+(o.available?(price?formatWallet(price)+' ◆/分':'免费'):o.reason)+'</span></button>';
  }).join('')+'</fieldset>').join('')+'<p class="life-caption">费用随村民基础收入与时代调整，余额不足时自动停供。</p>'+(only==='meal'?'<p class="life-caption">换菜后先吃完已备好的饭菜，再吃新菜。</p><p class="life-caption" data-life-food-ledger></p>':'')+'<p class="purchase-reason life-menu-message" data-life-message role="status"></p>';
 }
 function lifeMarkup(){const s=api.state(),a=lifeSnapshot(s);return `<section class="life-page" aria-label="全村生活"><div class="happiness-overview"><div><span class="life-kicker">全村幸福</span><strong><b data-life-happiness>${a.happiness}</b><small>/ 100</small></strong></div><div><b data-life-mood>${happinessLabel(a.happiness)}</b><span>人工作业 <b data-life-bonus>+${a.bonus.toFixed(1)}%</b></span></div><meter min="0" max="100" value="${a.happiness}" data-life-meter aria-label="全村幸福指数"></meter></div><div class="life-needs" aria-label="幸福来源">${[['housing','home','住得安稳','home'],['rest','clock','歇得过来','rest'],['food','bowl','吃口热饭','V25'],['leisure','spark','找点乐子','V21']].map(([id,symbol,name,target])=>`<div><span class="need-symbol">${icon(symbol,19)}</span><div><b>${name}</b><small data-life-need="${id}"></small></div><span class="need-points" data-life-points="${id}"></span>${target==='home'?iconButton('arrow','查看住房','data-housing-open'):target==='rest'?'':iconButton('arrow','查看'+name,`data-detail="${target}"`)}</div>`).join('')}</div><p class="life-caption">基础 50<span data-life-welfare-note></span> · 幸福加成人工作业，最高${s.life.serviceMode==='legacy'?15:25}%；酒品和活动另计</p><div class="research-section-heading"><h4>公共设施</h4><button data-detail="V11" class="quiet-button">图书馆研发 →</button></div><div class="life-services">${servicesMarkup()}</div>${s.life.serviceMode==='legacy'?menusMarkup():'<div class="life-expense-summary"><span>全村服务 · 最高费用</span><b><span data-life-cost></span> ◆ / 分</b></div><p class="life-caption" data-life-food-ledger></p>'}<div class="research-section-heading"><h4>村民近况</h4><small>状态 / 幸福</small></div><div class="life-people">${(s.community?.residents||[]).filter(r=>!r.reserve).map(r=>`<div><span>${esc(r.name)}</span><span data-life-person="${r.id}">${esc(r.status)}</span><b data-life-person-score="${r.id}">${Math.round(lifeHappiness(s,r))}</b></div>`).join('')}</div></section>`;}
 function complete(action){const r=action();if(!r.ok){api.toast(r.reason);return;}api.changed();}
 function bind(root){
  root.querySelectorAll('[data-research-action]').forEach(b=>b.onclick=()=>{const s=api.state(),id=b.dataset.researchAction,st=researchStatus(s,id);if(st.kind==='active')return complete(()=>pauseResearch(s));const run=()=>complete(()=>startResearch(s,id));if(st.cost>0&&st.affordable&&!st.requirements.length&&!s.skipPurchaseConfirmation)api.confirm(st.name,st.cost,run,st.duration);else run();});
  root.querySelectorAll('[data-life-researcher]').forEach(b=>b.onclick=()=>api.staff('researcher'));
  root.querySelectorAll('[data-life-open]').forEach(b=>b.onclick=()=>api.openLife());
  root.querySelectorAll('[data-civic-build]').forEach(b=>b.onclick=()=>api.buildCivic(b.dataset.civicBuild));
  root.querySelectorAll('[data-civic-move]').forEach(b=>b.onclick=()=>{const p=api.state().life.sites.find(p=>p.id===b.dataset.civicMove);if(p)api.buildCivic(p.type,p.id);});
  root.querySelectorAll('[data-civic-locate]').forEach(b=>b.onclick=()=>api.focus(api.state().life.sites.find(p=>p.id===b.dataset.civicLocate)));
  root.querySelectorAll('[data-civic-store]').forEach(b=>b.onclick=()=>api.storeCivic(b.dataset.civicStore));
  root.querySelectorAll('[data-life-enable]').forEach(b=>b.onclick=()=>complete(()=>enableLifeServices(api.state())));
  root.querySelectorAll('[data-life-menu]').forEach(b=>b.onclick=()=>{
    const s=api.state(),kind=b.dataset.lifeMenu,id=b.dataset.lifeOption;
    if(menuState(s).selected[kind]===id)return;
    const result=setLifeMenu(s,kind,id);
    if(result.ok)api.changed({menuOnly:true});
    const message=root.querySelector('[data-life-message]');if(message)message.textContent=result.ok?result.text:result.reason;
    refresh(root);b.focus({preventScroll:true});
  });
  const select=root.querySelector('[data-life-welfare]');if(select)select.onchange=()=>{const r=setWelfare(api.state(),select.value);if(!r.ok){root.querySelector('[data-life-message]').textContent=r.reason;select.value=api.state().life.welfare;return;}api.changed();};
  refresh(root);
 }
 function refresh(root){
  refreshFarmSites(root,api.state());
  const s=api.state(),a=lifeSnapshot(s),text=(q,v)=>root.querySelectorAll(q).forEach(el=>{if(el.textContent!==String(v))el.textContent=String(v);});
  text('[data-life-welfare-note]',a.sources.welfare?' · 福利 +'+a.sources.welfare:'');text('[data-life-happiness]',a.happiness);text('[data-life-mood]',happinessLabel(a.happiness));text('[data-life-resting]',a.resting);text('[data-life-cost]',formatWallet(a.perMinute));text('[data-life-bonus]',`${a.bonus>=0?'+':''}${a.bonus.toFixed(1)}%`);root.querySelectorAll('[data-life-meter]').forEach(el=>el.value=a.happiness);
  for(const [id,label]of Object.entries({housing:`${a.housed} / ${a.people} 位有住址`,rest:`${a.resting} 位休息 · 岗位保留`,food:`${a.foodPeople} / ${a.people} 位近期用餐`,leisure:`${a.leisurePeople} / ${a.people} 位近期放松`})) {text(`[data-life-need="${id}"]`,label);text(`[data-life-points="${id}"]`,`+${a.sources[id].toFixed(1)}`);}
  const era=s.research?.completed.modern?2:s.research?.completed.industrial?1:0;
  root.querySelectorAll('[data-era-step]').forEach((el,i)=>{el.dataset.state=i<era?'complete':i===era?'current':'next';el.querySelector('small').textContent=i<era?'已走过':i===era?'当前':'下一阶段';});
  root.querySelectorAll('[data-life-researcher]').forEach(b=>b.hidden=['cargo-tools','community-life'].every(id=>s.research?.completed[id]));
  for(const row of root.querySelectorAll('[data-research-row]')){
   const st=researchStatus(s,row.dataset.researchRow),b=row.querySelector('[data-research-action]');
   const label=st.kind==='active'?'暂停':st.kind==='complete'?'已研究':st.kind==='paused'?'继续研究':`${formatWallet(st.cost)} ◆ 研究`;
   if(b.textContent!==label)b.textContent=label;b.disabled=st.kind==='complete';b.classList.toggle('primary',st.kind==='ready'&&st.affordable);b.setAttribute('aria-label',`${st.name}，${label}`);row.dataset.state=st.kind;
   const reason=st.requirements.map(t=>'需要'+t.replace(/^完成/,'')).join(' · ')||(!st.affordable?`还差 ${formatWallet(st.cost-s.money)} 绿宝石`:'');row.querySelector('[data-research-reason]').textContent=reason;row.querySelector('.requirement-links').hidden=!st.requirements.length;
   row.querySelector('[data-research-label]').textContent=st.kind==='active'?(st.researcherId?'研究员加速中':'正在研究'):st.kind==='complete'?'研究完成':st.kind==='paused'?'已暂停':'预计用时';
   row.querySelector('[data-research-time]').textContent=st.kind==='complete'?'✓':st.duration===0?'即刻':time(st.eta);row.querySelector('progress').value=st.kind==='complete'?1:st.duration?st.progress/st.duration:0;
  }
  text('[data-life-food-ledger]',s.life.serviceMode==='legacy'?'':('备餐 '+a.food.stock.toFixed(1)+' / '+a.food.capacity+' 份 · 满仓暂停备餐'+(a.food.hungry?' · '+a.food.hungry+' 位没吃饱，工作 −8%':'')));
  for(const kind of ['meal','drink','activity']){
    const choices=menuChoices(s,kind),selected=menuState(s).selected[kind],current=choices.find(o=>o.id===selected);
    text(`[data-life-selection="${kind}"]`,s.life.serviceMode==='legacy'?'原有福利 · 可设置':current?.name||'');
    for(const o of choices){
      const price=kind==='meal'?foodCapacity(s)*serviceQuote(s).food*o.cost:menuBudget(s,kind,o.id);
      text(`[data-menu-price="${kind}:${o.id}"]`,o.available?(price?formatWallet(price)+' ◆/分':'免费'):o.reason);
      if(o.id===selected)text(`[data-life-menu-cost="${kind}"]`,formatWallet(price));
      for(const button of root.querySelectorAll(`[data-life-menu="${kind}"][data-life-option="${o.id}"]`)){
        const active=selected===o.id;
        if(button.getAttribute('aria-pressed')!==String(active)){
          button.setAttribute('aria-pressed',String(active));
          button.querySelector('.life-choice-mark').innerHTML=active?icon('check',16):'<span class="life-choice-empty"></span>';
        }
        button.disabled=!o.available;
      }
    }
  }
  const nodes=serviceNodes(s);
  for(const id of Object.keys(LIFE_SERVICES)){const same=nodes.filter(p=>p.type===id),occupied=Object.values(s.life.residents).filter(a=>a.phase!=='work'&&same.some(p=>p.id===a.service)).length;text(`[data-service-status="${id}"]`,!same.length?'已收纳 · 摆回后恢复服务':id==='V25'&&s.life.serviceMode!=='legacy'?`${same.length} 座 · 每轮可供 ${a.food.capacity} 份 · 全村配送`:`${same.length} 座 · 全村共享 · 现场 ${occupied} 位休息`);}
  root.querySelectorAll('[data-civic-build]').forEach(b=>{const cost=civicCost(s,b.dataset.civicBuild);text(`[data-civic-cost="${b.dataset.civicBuild}"]`,formatWallet(cost)+' ◆');const reason=civicReason(s,b.dataset.civicBuild)||(s.money<cost?`还差 ${formatWallet(cost-s.money)} 绿宝石`:'');if(b.closest('.life-facility'))text('[data-life-civic-reason]',reason);b.disabled=!!reason;b.title=reason||`${formatWallet(cost)} 绿宝石 · 共享本体等级与改造`;const note=b.closest('.farm-add-row')?.querySelector('[data-farm-build-reason]');if(note)note.textContent=reason||'新建后可以再安排 1 位'+(b.dataset.civicBuild==='V4'?'农民':'牧工');});
  for(const r of s.community?.residents||[]){text(`[data-life-person="${r.id}"]`,r.status);text(`[data-life-person-score="${r.id}"]`,Math.round(lifeHappiness(s,r)));}
  const select=root.querySelector('[data-life-welfare]');if(select&&select.value!==s.life.welfare)select.value=s.life.welfare;
 }
 return {researchMarkup,lifeMarkup,facilityMarkup,bind,refresh};
}
