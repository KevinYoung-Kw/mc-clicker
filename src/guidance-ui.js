import {noteCommunityAction} from './community-stories.js';
import { versionHistoryMarkup } from './version-history.js';
import { exactBalance, formatHudNumber } from "./hud-numbers.js";
import {
  GUIDANCE_ITEMS,
  guidanceOwned,
  guidanceRequirements,
  guidanceMissing,
  guidanceDescription,
} from "./guidance.js";
import { refreshPurchaseButton } from "./purchase-feedback.js";
import { formatWallet } from "./game.js";
import { icon } from "./icons.js";
import { tutorialFigure } from "./tutorial-figures.js";
import { controlGuide, inputKind } from "./input-guidance.js";
import { mailSummary } from "./mail.js";
import { noticeFace } from './notice-face.js';
import { narratorPresentation } from './narrator-activity-ui.js';
import { incomeSnapshot } from './income.js';
import { manualCuePending, visitManual } from './opening-guide.js';

const esc = (v) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function createGuidanceUI(api) {
  let infoTab="news", guideTopic="采集与视角";
  function card(id, {compact=false,recommended=false}={}) {
    const s = api.state(),
      item = GUIDANCE_ITEMS.find((i) => i.id === id),
      owned = guidanceOwned(s, id),
      needs = guidanceRequirements(s, id);
    if(compact) {
      const brief=Object.fromEntries(GUIDANCE_ITEMS.map(i=>[i.id,guidanceDescription(s,i.id)]));
      return `<article class="opening-product" data-guidance-card="${id}"><span class="opening-icon">${icon(item.icon,24)}</span><div><h3>${item.name}</h3>${recommended?'<small class="shop-recommend-label">推荐</small>':''}</div><button class="opening-buy" data-buy-guidance="${id}">${formatWallet(item.cost)} <span class="mini-emerald"></span></button><p class="opening-effect">${brief[id]||item.desc}</p><p class="purchase-reason" data-purchase-reason hidden></p></article>`;
    }
    return `<article class="guidance-card ${owned ? "owned" : ""}" data-guidance-card="${id}"><span class="guidance-glyph">${icon(item.icon, 28)}</span><div><h3>${item.name}</h3><p>${guidanceDescription(s,id)}</p><p class="purchase-reason" data-purchase-reason hidden></p></div>${owned ? `<button data-guidance-open="${id}" ${id === "nameplate" ? "disabled" : ""}>${id === "info" || id === "counter" ? "查看" : id === "nameplate" ? "已挂上" : s.guidance.collapsed ? "展开" : "收起"}</button>` : `<button data-buy-guidance="${id}" >${formatWallet(item.cost)} <span class="mini-emerald"></span></button>`}</article>`;
  }
  function cards(mode = "available") {
    const s = api.state();
    return GUIDANCE_ITEMS.filter(
      (i) =>
        mode === "all" ||
        (mode === "owned"
          ? guidanceOwned(s, i.id)
          : !guidanceOwned(s, i.id) && !guidanceRequirements(s, i.id).length),
    )
      .map((i) => card(i.id))
      .join("");
  }
  function toggle() {
    const s = api.state();
    if (!guidanceOwned(s, "goals")) return;
    s.guidance.collapsed = !s.guidance.collapsed;
    api.changed();
  }
  function openInfo(basic = false, options = {}) {
    const s = api.state(),
      paid = guidanceOwned(s, "info") && !basic;
    const tutorialEntry=options.guide===true||manualCuePending(s);
    if(tutorialEntry){infoTab='guide';guideTopic=s.counts.V2?'村庄与岗位':'采集与视角';}
    const persona=narratorPresentation(s);
    const tips = [
      ["采集与视角", controlGuide(s)],
      ["购买与建造", "买建筑时，先点地图选位置，再按「在这里建造」。取消不扣钱。没有空地就先扩地；升级已有建筑不用再选位置。扩地、住宅和园艺布景可开启「连续」，每次选新位置建造；点「完成」退出。下一次建造会沿用同类上次确认的朝向。"],
      [
        "前台收益",
        "游戏留在前台才会赚钱。切后台或锁屏后暂停，回来不会补发这段时间的收益。",
      ],
      [
        "存档与读档",
        "点右上角「设置 → 存档与读档」（手机先点「菜单」）保存存档图，手机可以长按图片保存。继续游玩后，点更新按钮生成最新图片。换设备时选择存档图片，核对进度后确认读取；读取前会自动备份当前进度。请保留完整原图，避免裁切或保存缩略图。存档码和 JSON 文件也可备用。",
      ],
    ];
    if (Object.keys(s.placements).length)
      tips.push(["搬动与转向", "点建筑打开详情，用上方的扳手搬动；邮箱在来信页上方，直播间在室内管理面板上方。搬动时先选中原位置，可以直接点旋转图标转 90°；电脑也可按 R。确认后才生效，取消留在原处。住宅到「村庄 → 住房」，花草到园艺台整理。"]);
    if (s.counts.V2)
      tips.push([
        "村庄与岗位",
        "打开「村庄 → 居民 → 按工作地点」，点「安排村民」，再选一个人。原来的基础收入照拿，工作收入另算。想看看他在哪儿，点名字旁的定位图标。",
      ]);
    if (s.counts.V2 && (s.counts.V3 || s.counts.M4))
      tips.push(["搬运与成交", "「村庄 → 居民 → 按工作地点」可以安排搬运工；铜傀儡的巡收范围在「村庄 → 帮手」里设置。采集按钮直接赚绿宝石，生产岗位先产货；搬运把货送到交货点，卖出后才算收入。"]);
    if (s.counts.M5)
      tips.push([
        "电力与自动化",
        "「工业 → 电力」中，点设备的「接入电网」。红石钻机需要有电才能生产；唱片机不接电也能演出，接电后准备更快，同时耗电。缺电要增加发电，储电升级只增加容量。E 是电量，E/秒是发电或耗电速度。",
      ]);
    if (s.counts.L2)
      tips.push([
        "直播间",
        "点直播间进入室内，买设备、摆家具、安排节目。主持人从村庄里选。新设备需要接入电网；在工业中开启「新设备自动接入」后，建好才会自动尝试接电。",
      ]);
    if (s.counts.N1)
      tips.push([
        "跨维度生产",
        "烈焰人提供热能，烈焰熔炉用热能加工并发电。恶魂、末影人和末影龙定期搬货；目的地仓库满了，就会等货物运走后再卸货。",
      ]);
    if (s.counts.M2 || s.counts.V4)
      tips.push([
        "设施改造",
        "点击设施即可购买改造。钻头更好，采矿就更快；车厢更大，一次就能多运货。但机器缺电或仓库堵住时，要先解决这些问题，升级才更有效。",
      ]);
    if (s.counts.Z2)
      tips.push([
        "工程交付",
        "世界工程只买一次，收到货就会自动往上建，共三层。三个世界都要交成品。进度不动时，查看缺的是哪个世界的货，再查那里的供电、生产和运输。",
      ]);
    const events = s.events.slice(-8).reverse();
    const mail = mailSummary(s);
    const topicIcons={"采集与视角":"T1","购买与建造":"V1","前台收益":"V18","存档与读档":"save","搬动与转向":"M9","村庄与岗位":"V2","搬运与成交":"M4","电力与自动化":"M5","直播间":"L2","跨维度生产":"N1","设施改造":"M2","工程交付":"Z2"};
    const initialTopic=Math.max(0,tips.findIndex(([title])=>title===guideTopic));
    const guide=`<section class="info-section illustrated-manual" ${paid?'id="info-guide" role="tabpanel" aria-labelledby="info-tab-guide"':''}><nav class="manual-controls" aria-label="教学目录"><select id="guide-topic" aria-label="选择教学主题">${tips.map(([title],index)=>`<option value="${index}" data-icon="${topicIcons[title]}" data-label="${String(index+1).padStart(2,'0')}　${title}" ${index===initialTopic?'selected':''}>${title}</option>`).join('')}</select><button type="button" id="guide-prev" class="manual-turn" aria-label="上一项教学">${icon('arrow',18)}</button><button type="button" id="guide-next" class="manual-turn" aria-label="下一项教学">${icon('arrow',18)}</button></nav>${tips.map(([title,text],index)=>`<article class="manual-page" data-guide-page="${index}" aria-label="${title}" ${index===initialTopic?'':'hidden'}>${tutorialFigure(title,inputKind())}<p ${title==='采集与视角'?'data-control-guide':''}>${text}</p></article>`).join('')}</section>`;
    const news=`<section id="info-news" class="info-section" role="tabpanel" aria-labelledby="info-tab-news"><ol class="info-events">${events.length?events.map(e=>`<li><small>${Math.floor(e.at/60).toString().padStart(2,'0')}:${Math.floor(e.at%60).toString().padStart(2,'0')}</small><p>${esc(e.text)}</p></li>`).join(''):'<li class="info-empty"><p>还没什么新鲜事。先去盖点东西？</p></li>'}</ol></section>`;
    api.modal(`<div id="info-panel" class="${paid?'world-info':''}">${paid?`
      <header class="info-persona"><span data-narrator-avatar>${noticeFace(persona.expression,s.easterEggs.wardrobe.equipped)}</span><div><small>消息通知 · <span data-narrator-state>${persona.label}</span></small><h2>世界信息</h2></div></header>
      <p class="info-introduction">村里出了什么事、机器怎么用，都可以来这儿翻翻。平时嘛，我偶尔插两句嘴。</p>
      <div class="info-narrator-controls"><button id="guidance-voice" class="info-narration-toggle"></button><button id="guidance-notices" class="info-narration-toggle" aria-pressed="${!s.guidance.notices}"></button></div>
      <div data-narrator-activities>${api.activityMarkup?.()||''}</div>
      <div class="info-tabs" role="tablist" aria-label="世界信息内容"><button id="info-tab-news" role="tab" data-info-tab="news" aria-controls="info-news">世界近况 <small>${events.length}</small></button><button id="info-tab-guide" role="tab" data-info-tab="guide" aria-controls="info-guide">操作指南</button><button id="info-tab-versions" role="tab" data-info-tab="versions" aria-controls="info-versions">版本日志</button></div>
      ${news}${guide}${versionHistoryMarkup()}`:`<h2>操作指南</h2>${guide}`}<button id="info-return" class="quiet-button">回到世界 →</button></div>`);
    if(paid)noteCommunityAction(s,'info');
    const root=document.querySelector('#info-panel');api.bindActivities?.(root);
    const notices=root.querySelector('#guidance-notices');
    function showToggle(){const muted=!api.state().guidance.notices;notices.setAttribute('aria-pressed',String(muted));notices.innerHTML=`${icon(muted?'play':'pause',16)}<span>${muted?'恢复旁白':'暂停旁白'}</span>`;}
    if(notices){showToggle();notices.onclick=()=>{api.setNarration(!api.state().guidance.notices);showToggle();};}
    const voice=root.querySelector('#guidance-voice');
    function showVoice(){const muted=api.state().audio.narratorVoice===false;voice.setAttribute('aria-pressed',String(muted));voice.innerHTML=`${icon(muted?'mute':'sound',16)}<span>${muted?'开启旁白声音':'静音旁白声音'}</span>`;}
    if(voice){showVoice();voice.onclick=()=>{api.setNarratorVoice(api.state().audio.narratorVoice===false);showVoice();};}
    function sawGuide(){if(visitManual(s))api.changed();}
    function selectTab(id){if(id==='versions')noteCommunityAction(s,'versions');infoTab=id;root.dataset.infoTab=id;for(const b of root.querySelectorAll('[data-info-tab]')){const active=b.dataset.infoTab===id;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;}for(const panel of root.querySelectorAll('[role="tabpanel"]'))panel.hidden=panel.id!==`info-${id}`;if(id==='guide')sawGuide();}
    for(const b of root.querySelectorAll('[data-info-tab]')){
      b.onclick=()=>selectTab(b.dataset.infoTab);
      b.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const tabs=['news','guide','versions'],at=tabs.indexOf(infoTab);const id=tabs[e.key==='Home'?0:e.key==='End'?tabs.length-1:(at+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];selectTab(id);root.querySelector(`[data-info-tab="${id}"]`).focus();}};
    }
    if(paid)selectTab(infoTab);else sawGuide();
    const topicPicker=root.querySelector('#guide-topic');
    function showGuide(scroll=false) {
      const index=Number(topicPicker.value);
      guideTopic=tips[index][0];
      for(const page of root.querySelectorAll('[data-guide-page]')) page.hidden=Number(page.dataset.guidePage)!==index;
      root.querySelector('#guide-prev').disabled=index===0;
      root.querySelector('#guide-next').disabled=index===tips.length-1;
      const nav=root.querySelector('.manual-controls');
      if(scroll && nav.getBoundingClientRect().top<document.querySelector('#modal').getBoundingClientRect().top+40) nav.scrollIntoView({block:'start',behavior:'instant'});
    }
    topicPicker.onchange=()=>showGuide(true);
    for(const [id,delta] of [['guide-prev',-1],['guide-next',1]]) root.querySelector('#'+id).onclick=()=>{
      topicPicker.value=String(Math.min(tips.length-1,Math.max(0,Number(topicPicker.value)+delta)));
      topicPicker.dispatchEvent(new Event('change',{bubbles:true}));
    };
    showGuide();
    if(tutorialEntry){
      const tab=root.querySelector('#info-tab-guide');tab?.classList.add('tutorial-entry-highlight');
      // On short phones the persona header must not hide the tutorial itself.
      requestAnimationFrame(()=>{if(root.isConnected){(tab||root.querySelector('.manual-controls')).scrollIntoView({block:'start',behavior:'instant'});}});
    }
    document.querySelector("#info-return").onclick = () =>
      document.querySelector("#modal").close();
    if (s.counts.V18 && api.mailbox) {
      const button = document.createElement("button");
      button.id = "info-mailbox";
      button.className = "quiet-button info-mailbox";
      button.innerHTML = `${icon("mail", 22)}<span><strong>打开邮箱</strong><small>${mail.unread} 封未读 · ${mail.unclaimed} 封待领</small></span><b>→</b>`;
      button.onclick = () => api.mailbox();
      document.querySelector("#info-return").before(button);
    }
  }
  function refresh(root) {
    const s = api.state();
    const receipt=incomeSnapshot(s);
    const balance = root.querySelector('[data-income-balance]');
    if (balance) balance.textContent = exactBalance(s.money);
    const total=root.querySelector('[data-income-total]');
    if(total) {
      const active=api.active?.()!==false;
      total.textContent=formatHudNumber(active?receipt.total:0,true)+' /秒';
      for(const row of root.querySelectorAll('[data-income-source]')) {
        const found=receipt.rows.find(x=>x.key===row.dataset.incomeSource);
        row.querySelector('dd').textContent=formatHudNumber(active?(found?.rate||0):0,true)+' /秒';
      }
      const expense=active?(s.life?.lastExpense||0):0;
      const expenseNode=root.querySelector('[data-income-expense]'),netNode=root.querySelector('[data-income-net]');
      if(expenseNode)expenseNode.textContent='−'+formatHudNumber(expense,true)+' /秒';
      if(netNode){const net=(active?receipt.total:0)-expense;netNode.textContent=(net<0?'−':'')+formatHudNumber(Math.abs(net),true)+' /秒';}
      const bonus=root.querySelector('[data-income-bonus]');
      bonus.textContent=formatHudNumber(active?receipt.rows.filter(x=>x.bonus).reduce((v,x)=>v+x.rate,0):0,true)+' /秒';
      const recent=root.querySelector('[data-income-recent]'), text=receipt.recent.map(x=>`${x.name} +${formatWallet(x.amount)}`).join(' · ')||'暂无';
      if(recent.textContent!==text)recent.textContent=text;
    }
    root.querySelectorAll("[data-buy-guidance]").forEach((button) => {
      const item = GUIDANCE_ITEMS.find(
        (i) => i.id === button.dataset.buyGuidance,
      );
      const needs = guidanceRequirements(s, item.id);
      refreshPurchaseButton(
        button,
        {
          cost: item.cost,
          owned: 0,
          kind: needs.length
            ? "locked"
            : s.money < item.cost
              ? "short"
              : "ready",
          reason: needs.length
            ? `需要先${needs.join("、")}`
            : s.money < item.cost
              ? `还差 ${formatWallet(Math.ceil(item.cost - s.money))} 绿宝石`
              : "",
        },
        item.name,
      );
    });
  }
  function bind(root) {
    root.querySelectorAll("[data-buy-guidance]").forEach((b) => {
      b.onclick = () => {
        const item = GUIDANCE_ITEMS.find((i) => i.id === b.dataset.buyGuidance);
        const missing = guidanceMissing(api.state(),item.id)[0];
        if (missing && GUIDANCE_ITEMS.some(i=>i.id===missing)) api.purchase(missing);
        else if (missing) api.openItem(missing, true);
        else api.purchase(item.id);
      };
    });
    root.querySelectorAll("[data-guidance-open]").forEach((b) => {
      b.onclick = () =>
        b.dataset.guidanceOpen === "info" ? openInfo() : b.dataset.guidanceOpen === "counter" ? openIncome() : b.dataset.guidanceOpen === "goals" ? toggle() : null;
    });
  }
  function openIncome() {
    api.modal(`<div id="info-panel" class="income-panel"><h2>实际收入</h2><div class="income-balance"><small>绿宝石余额</small><b data-income-balance></b></div><small class="income-units">M 百万 · B 十亿 · T 万亿 · Qa 千万亿 · Qi 百京</small><strong class="income-total" data-income-total></strong><p class="panel-note">这里是最近一次入账的来源。送货、演出和奖励不是每秒都到账，所以数字会变化。</p><dl class="income-lines">${[['postal','邮政'],['base','村民基础收入'],['jobs','岗位与演出'],['production','生产交货'],['live','直播经营']].map(([id,name])=>`<div data-income-source="${id}"><dt>${name}</dt><dd></dd></div>`).join('')}<div><dt>本轮到账的奖励</dt><dd data-income-bonus></dd></div><div><dt>福利支出</dt><dd data-income-expense></dd></div><div><dt>扣除福利后的净收入</dt><dd data-income-net></dd></div></dl><h3>一次性奖励</h3><p data-income-recent></p><p class="panel-note">手动采集直接加到余额，不计入每秒收入。机器产出还要运走、卖出，才会计入生产收入。</p><button id="income-help">操作指南 →</button></div>`);
    refresh(document);
    document.querySelector('#income-help').onclick=()=>openInfo(true);
  }
  return { card, cards, bind, toggle, openInfo, openIncome, refresh };
}
