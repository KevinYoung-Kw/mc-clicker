import {lifeSummaryMarkup} from './village-life-ui.js';
import { villageOverviewMarkup, refreshVillageOverview } from './management-overview.js';
import {housingCapacity} from './housing-data.js';
import {starterHomeAvailable} from './housing.js';
import {gardenDiscovered} from './garden-data.js';
import { marketCargoMarkup, refreshMarketCargo, refreshMarketReceipts } from "./market-status-ui.js";
import { productionSummaryMarkup, refreshProductionSummary } from './production-summary.js';
import { foldAttributes } from './panel-memory.js';
import { facilityLevelLabel, nextFacilityUnlock } from './facility-growth.js';
import { RELEASE_VERSION } from './release.js';
import { populationSupport } from './population.js';
import { createNetworkUI, connectionControls } from "./network-ui.js";
import { facilityStatusMarkup } from "./facility-status.js";
import {
  purchaseStatus,
  buttonContent,
  refreshPurchaseButton,
  requirementLinks,
} from "./purchase-feedback.js";
import { facilityUpgrades } from "./upgrades.js";
import { ITEMS } from "./catalog.js";
import { footprint } from "./layout.js";
import { n, price, requirements, formatWallet as fmt } from "./game.js";
import {
  MANAGEMENT_PURCHASES,
  placementFor,
  spaceOf,
} from "./facility-shops.js";
import {
  ensureCommunity,
  JOBS,
  PROFESSIONS,
  portrait,
  escapeHtml as esc,
  residentBase,
  assignJob,
  renameCompanion,
  skillLevel,
  trainingPrice,
  trainResident,
  GOLEM_UPGRADES,
  upgradeGolem,
  setGolemRoute,
  activeResidents,
  HAUL_SOURCES,
  recallResident,
} from "./residents.js";
import {
  powerSnapshot,
  gridCapacity,
  CAPACITOR_PRICES,
  upgradeCapacitor,
  configureAutomation,
  connectGrid,
  toggleDevice,
  gridRange,
} from "./power.js";
import { TASKS } from "./operations.js";
import { icon, iconButton } from "./icons.js";
import { residentJobChoices } from "./resident-jobs-ui.js";
import {farmSitesMarkup} from './farm-sites-ui.js';
import { createWorkplaceBoard } from "./workplace-board-ui.js";
export function createManagementUI(api) {
  const workplaces = createWorkplaceBoard({ state: api.state, changed: change, toast: api.toast });
  const network = createNetworkUI({
    ...api,
    showPower() {
      industryTab = "power";
      api.go("network");
    },
  });
  let rosterView = "people";
  let villageTab = "overview",
    industryTab = "logistics",
    selected = null,
    study = null,
    reserveOpen = false;
  const tabs = (items, current, attr) =>
    `<div class="management-tabs">${items.map(([id, name]) => `<button ${attr}="${id}" class="${id === current ? "active" : ""}" aria-pressed="${id === current}">${name}</button>`).join("")}</div>`;
  const shelf = (key, title, content, open = true) => `<details class="management-disclosure" ${foldAttributes(key, open)}><summary>${title}</summary><div class="disclosure-body">${content}</div></details>`;
  function change() {
    api.changed();
  }
  function showJobs(job) {
    villageTab = 'residents'; rosterView = 'jobs'; selected = null; study = null;
    workplaces.close(); change();
    const root = document.querySelector('#panel-content');
    if(job)workplaces.open(root,job); else root.scrollTop=0;
  }
  function equipment(ids) {
    const s = api.state(),
      visible = ids.filter(id=>id!=="V20"||gardenDiscovered(s)).filter(
        (id) =>
          n(s, id) ||
          !requirements(s, ITEMS[id]).length ||
          ITEMS[id].deps.some((dep) => n(s, dep)),
      );
    return `<div class="management-equipment">${visible
      .map((id) => {
        const i = ITEMS[id],
          count = n(s, id),
          placement = placementFor(s, id),
          action =
            placement === "outdoor"
              ? "选址"
              : count && i.place
                ? "升级"
                : spaceOf(id) === "resident"
                  ? "招募"
                  : "购买",
          note =
            placement === "outdoor"
              ? `占地 ${footprint(id).w} × ${footprint(id).d} 格`
              : count && i.place && count < i.max
                ? "原址升级 · 确认后生效"
                : "";
        return `<article data-equipment-card="${id}"><img src="${import.meta.env.BASE_URL}icons/${id}.png?v=${RELEASE_VERSION}" alt=""><div class="equipment-content"><div class="equipment-heading"><strong>${i.name}</strong>${count ? iconButton("gear", `管理${i.name}`, `data-manage-item="${id}"`) : ""}</div><small>${count ? `${facilityUpgrades(id).length ? facilityLevelLabel(s,id) : `已有 ${count}`} · ` : ""}${esc(i.desc)}</small>${nextFacilityUnlock(s,id) ? `<small class="equipment-growth">${nextFacilityUnlock(s,id)}</small>` : ""}${note ? `<small>${note}</small>` : ""}<small class="purchase-reason" data-purchase-reason></small>${count ? facilityStatusMarkup(s, id) + connectionControls(s, id) : ""}</div>${count >= i.max ? `<span class="complete-badge">${buttonContent(purchaseStatus(s, i))}</span>` : `<button data-equipment-buy="${id}" aria-label="${action}${i.name}，${fmt(price(s, i))} 绿宝石">${buttonContent(purchaseStatus(s,i))}</button>`}</article>`;
      })
      .join("")}</div>`;
  }
  function tasks(keys) {
    const s = api.state();
    return keys
      .filter((key) => n(s, TASKS[key].id))
      .map((key) => {
        const d = TASKS[key];
        return `<article class="task-card" data-task-card="${key}"><header><strong>${ITEMS[d.id].name}</strong>${iconButton("gear", `管理${ITEMS[d.id].name}`, `data-manage-item="${d.id}"`)}</header>${facilityStatusMarkup(s, d.id)}<div class="management-actions"><button class="primary" data-task="${key}">开始${d.name}</button>${s.grid.automation[key] ? "<button data-power-jump>查看供电</button>" : '<button data-village-tab="residents">安排村民</button>'}</div></article>`;
      })
      .join("");
  }
  function residentCard(r) {
    if (r.reserve) return reserveCard(r);
    const s = api.state(),
      profession = study || JOBS[r.job].skill || "farming",
      level = skillLevel(r, profession);
    return `<article class="resident-detail"><header><div class="resident-portrait large">${portrait(r)}</div><div><div class="resident-name"><h3>${esc(r.name)}</h3><button type="button" class="resident-locate" data-person-focus="${r.id}" aria-label="定位${esc(r.name)}" title="定位${esc(r.name)}">${icon("locate", 20)}</button></div><span>${JOBS[r.job].name} · ${JOBS[r.job].skill ? PROFESSIONS[JOBS[r.job].skill] + " Lv." + skillLevel(r) : "未分配岗位"}</span><p data-person-status="${r.id}">${esc(r.status)}</p></div></header><div class="resident-income"><div><small>基础收入</small><strong>${fmt(residentBase(s, r))}<em> / 秒</em></strong></div><div><small>工作赚取</small><strong data-person-earned="${r.id}">${fmt(r.jobEarned)}<em> ◆</em></strong></div></div><p class="panel-note">基础收入自动到账；干活赚的钱，在送货或演出完成后另算。</p><label class="management-field">昵称<div><input data-rename-input value="${esc(r.name)}" maxlength="12" aria-label="村民昵称"><button data-rename="${r.id}">保存</button></div></label><label class="management-field">安排工作<select data-assign="${r.id}" aria-label="安排工作">${residentJobChoices(
      s,
      r,
    )
      .map(
        (j) =>
          `<option value="${j.id}" data-label="${j.name} · ${j.place}" data-icon="${j.icon}" data-description="${esc(j.description)}" data-meta="${esc(j.meta)}" ${j.selected ? "selected" : ""} ${j.disabled ? "disabled" : ""}>${j.name} · ${j.place}</option>`,
      )
      .join(
        "",
      )}</select></label><p class="panel-note resident-assignment-note">${JOBS[r.job].desc}</p>${
      n(s, "V11")
        ? `<section class="personal-school"><h4>为 ${esc(r.name)} 学习技能</h4><select data-study aria-label="选择培训专业">${Object.entries(
            PROFESSIONS,
          )
            .map(
              ([id, name]) =>
                `<option value="${id}" data-description="${{ farming: "提高农民照料作物和收割的效率。", ranching: "提高牧工照料动物和收取产物的效率。", hauling: "让搬运工一趟能搬更多货。", mining: "提高矿工采矿的效率。", crafting: "提高工匠加工的效率。", music: "提高乐师演出和主持节目的效果。" }[id]}" ${profession === id ? "selected" : ""}>${name} Lv.${skillLevel(r, id)}</option>`,
            )
            .join(
              "",
            )}</select><p>换工作不会丢失已学技能。</p><button data-train="${r.id}" data-skill="${profession}" ${level >= 5 ? "disabled" : ""}>${level >= 5 ? "已是专业大师" : `学习 ${PROFESSIONS[profession]} Lv.${level + 1} · ${fmt(trainingPrice(r, profession))} ◆`}</button>${level >= 3 && !n(s, "V13") ? "<small>想学到 Lv.4–5，需先购买「大师书」。</small>" : ""}</section>`
        : '<p class="panel-note">图书管理员到来后，可以为每个人购买技能书。</p>'
    }<p class="resident-story" data-person-done="${r.id}">已经完成 ${r.jobsDone} 次工作</p></article>`;
  }
  function reserveCard(r) {
    const s = api.state();
    return `<article class="resident-detail"><header><div class="resident-portrait large">${portrait(r)}</div><div><h3>${esc(r.name)}</h3><span>轮休 · ${JOBS[r.previousJob]?.name || "自由活动"}</span></div></header><p class="panel-note">轮休时仍会自动赚钱，学过的技能也保留。选择一位驻村同伴换班后，就能回村工作。</p><p>${
      Object.entries(r.skills)
        .filter(([, v]) => v > 1)
        .map(([k, v]) => `${PROFESSIONS[k]} Lv.${v}`)
        .join(" · ") || "还没学过技能"
    }</p><label class="management-field">和谁换班<select data-recall-outgoing>${activeResidents(
      s,
    )
      .map(
        (a) =>
          `<option value="${a.id}" ${a.cargo ? "disabled" : ""}>${esc(a.name)} · ${JOBS[a.job].name}${a.cargo ? "（正在送货）" : ""}</option>`,
      )
      .join(
        "",
      )}</select></label><button class="primary" data-recall="${r.id}">换班回村</button></article>`;
  }
  function roster(people) {
    return `<div class="resident-roster">${people.map((r) => `<button data-person="${r.id}" class="${selected === r.id ? "selected" : ""}"><span class="resident-portrait">${portrait(r)}</span><span><strong>${esc(r.name)}</strong><small>${r.reserve ? "轮休" : JOBS[r.job].name}${r.room === "studio" ? " · 室内" : ""}${!r.reserve && JOBS[r.job].skill ? " · Lv." + skillLevel(r) : ""}</small></span></button>`).join("")}</div>`;
  }
  function golemCard(g) {
    const s = api.state();
    return `<article class="resident-detail golem-detail" data-golem-route="${g.id}"><header><div class="copper-portrait"><i></i><b></b></div><div><div class="resident-name"><h3>${esc(g.name)}</h3><button type="button" class="resident-locate" data-person-focus="${g.id}" aria-label="定位${esc(g.name)}" title="定位${esc(g.name)}">${icon("locate", 20)}</button></div><span>巡回帮手 · 背篓 ${16 * 2 ** g.upgrades.basket} 份</span><p data-person-status="${g.id}">${esc(g.status)}</p></div></header><p data-golem-delivered="${g.id}">已搬运 ${fmt(g.delivered)} 份 · ${g.trips} 趟</p><label class="management-field">昵称<div><input data-rename-input value="${esc(g.name)}" aria-label="铜傀儡昵称"><button data-rename="${g.id}">保存</button></div></label><h4>巡收范围</h4><div class="golem-stops">${[
      "V4",
      "V7",
      "M1",
      "M2",
      "M3",
      "L2",
    ]
      .filter((id) => n(s, id))
      .map(
        (id) =>
          `<label><input type="checkbox" data-route-stop value="${id}" ${g.stops.includes(id) ? "checked" : ""}>${ITEMS[id].name}</label>`,
      )
      .join(
        "",
      )}</div><select data-golem-mode aria-label="铜傀儡工作方式"><option value="all" data-description="在选定范围搬货，也帮忙收宝藏和直播礼物。" ${g.mode === "all" ? "selected" : ""}>收货与活动跑腿</option><option value="cargo" data-description="只搬运生产货物，专心清理取货点的积压。" ${g.mode === "cargo" ? "selected" : ""}>只搬货物</option><option value="events" data-description="收取猪发现的宝藏和直播礼物，不搬生产货物。" ${g.mode === "events" ? "selected" : ""}>宝藏与直播礼物</option></select><p class="muted" data-route-status>已选 ${g.stops.filter(id=>n(s,id)).length} / ${2 + 2 * g.upgrades.route} 站 · 自动保存</p><h4>装备升级</h4>${Object.entries(
      GOLEM_UPGRADES,
    )
      .map(
        ([key, u]) =>
          `<div class="golem-upgrade"><div><strong>${u.name}</strong><small>${u.desc}</small></div><button data-golem-upgrade="${key}" data-golem="${g.id}" ${u.prices[g.upgrades[key]] === undefined ? "disabled" : ""}>${u.prices[g.upgrades[key]] === undefined ? "已完成" : fmt(u.prices[g.upgrades[key]]) + " ◆"}</button></div>`,
      )
      .join("")}</article>`;
  }
  function recruitment(s, active) {
    const support = populationSupport(s), status = purchaseStatus(s, ITEMS.V2);
    const capacity = Math.max(active.length, Math.min(support.capacity, Math.max(1,housingCapacity(s))));
    const links = status.links.includes('housing')
      ? `<button data-housing-open>${starterHomeAvailable(s) ? '免费住宅' : Object.values(s.housing.stored).some(count=>count>0) ? '摆放住宅' : '建造住宅'} ${icon('arrow',14)}</button>`
      : requirementLinks(status);
    return `<section class="resident-recruitment" data-equipment-card="V2" aria-label="添加村民"><div class="roster-top"><span>村民 <b>${active.length} / ${capacity}</b><small>${active.filter(r=>r.job!=='idle').length} 位在岗</small></span><button data-equipment-buy="V2" data-purchase-state="${status.kind}">${buttonContent(status)}</button></div><div class="recruitment-help"><p class="purchase-reason" data-purchase-reason ${status.reason?'':'hidden'}>${status.reason}</p>${links ? `<div class="requirement-links">${links}</div>` : ''}</div></section>`;
  }
  function village() {
    const s = api.state(),
      c = ensureCommunity(s);
    let body = "";
    if(villageTab === "overview") body = villageOverviewMarkup() + lifeSummaryMarkup(s);
    if(villageTab === "housing")body=api.housingMarkup();
    if (villageTab === "production")
      body = `${farmSitesMarkup(s,"V4")}${farmSitesMarkup(s,"V7")}${tasks(["music"]) || '<p class="empty-note">购买农田后，在这里收割或安排村民照料。</p>'}${shelf("village:production:equipment", "添置农牧设施", equipment(MANAGEMENT_PURCHASES.village.production))}`;
    if (villageTab === "construction")
      body = `${equipment(MANAGEMENT_PURCHASES.village.construction)}`;
    if (villageTab === "residents") {
      const r = c.residents.find((x) => x.id === selected),
        active = activeResidents(s),
        reserves = c.residents.filter((r) => r.reserve);
      body = `${recruitment(s,active)}${lifeSummaryMarkup(s)}<div class="management-tabs"><button data-roster-view="people" class="${rosterView === "people" ? "active" : ""}">按人物</button><button data-roster-view="jobs" class="${rosterView === "jobs" ? "active" : ""}">按工作地点</button></div>${rosterView === "people" ? roster(active) : workplaces.render()}${reserves.length ? `<button class="quiet-button" data-reserve-toggle aria-expanded="${reserveOpen}">${reserveOpen ? "收起" : "查看"}轮休档案 · ${reserves.length} 位</button>${reserveOpen ? roster(reserves) : ""}` : ""}${r ? residentCard(r) : ""}${shelf("village:education", "全村培训", equipment(n(s, "V11") ? MANAGEMENT_PURCHASES.village.education : ["V11"]))}`;
    }
    if (villageTab === "helpers") {
      const g = c.golems.find((x) => x.id === selected);
      body = `<p class="panel-note">铜傀儡可搬运货物、收集宝藏和直播礼物。</p><div class="resident-roster">${c.golems.map((g) => `<button data-person="${g.id}" class="${selected === g.id ? "selected" : ""}"><span class="copper-portrait small"><i></i><b></b></span><span><strong>${esc(g.name)}</strong><small>${g.trips} 趟交付</small></span></button>`).join("")}</div>${g ? golemCard(g) : ""}${equipment(MANAGEMENT_PURCHASES.village.helpers)}`;
    }
    if (villageTab === "market")
      body = `<div class="management-intro"><h3>交货记录</h3><p class="market-shipped"><span>累计交货</span><b data-community-shipped>${fmt(c.shipped)} 份</b></p></div>${facilityStatusMarkup(s,"V3")}<div class="management-actions"><button data-market-staff>售货员岗位 →</button></div>${marketCargoMarkup()}${equipment(MANAGEMENT_PURCHASES.village.market)}${api.marketServices?.() || ""}`;
    return (
      tabs(
        [
          ["overview", "概况"],
          ["residents", "居民"],
          ["housing", "住房"],
          ["production", "农牧"],
          ["construction", "建设"],
          ...(n(s, "V14") || n(s, "V15") ? [["helpers", "帮手"]] : []),
          ...(n(s, "V3") ? [["market", "集市"]] : []),
        ],
        villageTab,
        "data-village-tab",
      ) + `<div class="management-page">${body}</div>`
    );
  }
  function industry(logistics, advanced = '') {
    const s = api.state(),
      g = s.grid,
      p = powerSnapshot(s);
    if (industryTab === "power" && !n(s, "M5")) industryTab = "logistics";
    let body = "";
    if (industryTab === "production")
      body = `${productionSummaryMarkup(s)}${equipment(MANAGEMENT_PURCHASES.industry.production)}<div class="management-actions"><button data-manage-item="M3">活塞启动与取料</button><button data-village-staff>安排工匠 / 矿工</button></div>`;
    if (industryTab === "power")
      body = `<section class="electricity-dashboard"><span>储存的红石能量</span><strong data-energy>${fmt(s.energy)} <small>/ ${fmt(p.capacity)} E</small></strong><div class="task-meter"><i data-energy-fill></i></div><div class="electricity-metrics"><div><small>发电</small><b data-generation></b></div><div><small>设备需求</small><b data-demand></b></div><div><small>实际消耗</small><b data-consumption></b></div></div><p data-power-guidance></p><div class="management-actions"><button data-crank>按住发电 · +24 E/秒</button><button data-capacitor ${g.capacitor >= 4 ? "disabled" : ""}>${g.capacitor >= 4 ? "储电容量已满级" : `容量 → ${fmt([120, 480, 1920, 7680, 30720][g.capacitor + 1])} E · ${fmt(CAPACITOR_PRICES[g.capacitor])} ◆`}</button></div><small>容量是能存多少电，发电量是每秒补进来多少电。</small></section>${network.power()}<details ${foldAttributes("industry:power:equipment", true)}><summary>发电设施与改造</summary>${equipment(MANAGEMENT_PURCHASES.industry.power)}</details>`;
    if (industryTab === "automation")
      body =
        network.automation() +
        ["music", "note"]
          .filter((k) => n(s, k === "music" ? "L1" : "M20"))
          .map(
            (key) =>
              `<label class="management-switch"><span><strong>${key === "music" ? "唱片机自动演出" : "自动机器合奏"}</strong><small>接电后按周期演出，触发时另耗电。</small></span><input type="checkbox" data-auto="${key}" ${g.automation[key] ? "checked" : ""}></label>`,
          )
          .join("") +
        `<details ${foldAttributes("industry:automation:equipment", true)}><summary>控制模块与执行器</summary>${equipment(MANAGEMENT_PURCHASES.industry.automation)}</details>`;
    if (industryTab === "logistics")
      body =
        logistics + network.logistics() + (advanced ? `<details class="management-disclosure" ${foldAttributes('industry:logistics:advanced')}><summary>高级调度与跨世界运输</summary><div class="disclosure-body">${advanced}</div></details>` : '') +
        `<details ${foldAttributes("industry:logistics:equipment", true)}><summary>仓储与运输改造</summary>${equipment(MANAGEMENT_PURCHASES.industry.logistics)}</details>`;
    if (network.inspecting) body = network.map();
    return (
      tabs(
        [
          ["logistics", "物流"],
          ["production", "生产"],
          ...(n(s, "M5") ? [["power", "电力"]] : []),
          ...(n(s, "M5") ? [["automation", "自动化"]] : []),
        ],
        industryTab,
        "data-industry-tab",
      ) + `<div class="management-page">${body}</div>`
    );
  }
  function bind(root) {
    api.bindHousing?.(root);
    network.bind(root);
    workplaces.bind(root);
    root.querySelectorAll('[data-overview-jobs]').forEach(b=>b.onclick=()=>showJobs());
    // The vacancy rows update in place as people change jobs, so delegate them.
    if(root._overviewClick)root.removeEventListener('click',root._overviewClick);
    root._overviewClick=e=>{
      const job=e.target.closest('[data-overview-job]');
      if(job){showJobs(job.dataset.overviewJob);return;}
      const cargo=e.target.closest('[data-overview-cargo]'), action=e.target.closest('[data-overview-action]');
      const target=cargo?(cargo.dataset.overviewCargo==='trading'?'market':'logistics'):action?.dataset.overviewAction;
      if(!target)return;
      if(target==='jobs')showJobs();
      else if(target==='logistics'){network.clearMap();industryTab='logistics';api.go('network');}
      else {villageTab=target==='market'&& !api.state().counts.V3?'production':target;change();root.scrollTop=0;}
    };
    root.addEventListener('click',root._overviewClick);
    root.querySelector("[data-market-staff]")?.addEventListener("click",()=>{villageTab="residents";rosterView="jobs";selected=null;change();workplaces.open(root,"merchant");});
    const s = api.state(),
      on = (selector, event, fn) =>
        root
          .querySelectorAll(selector)
          .forEach((el) => el.addEventListener(event, () => fn(el)));
    const result = (r) => {
      api.toast(r.text || r.reason || "已保存");
      change();
    };
    on("[data-roster-view]", "click", (b) => {
      workplaces.close();
      rosterView = b.dataset.rosterView;
      selected = null;
      change();
    });
    on("[data-reserve-toggle]", "click", () => {
      reserveOpen = !reserveOpen;
      if (
        !reserveOpen &&
        s.community.residents.find((r) => r.id === selected)?.reserve
      )
        selected = null;
      change();
    });
    on("[data-recall]", "click", (el) => {
      const response = recallResident(
        s,
        el.dataset.recall,
        root.querySelector("[data-recall-outgoing]").value,
      );
      if (response.ok) {
        selected = el.dataset.recall;
        reserveOpen = false;
      }
      result(response);
    });
    on("[data-village-tab]", "click", (el) => {
      workplaces.close();
      villageTab = el.dataset.villageTab;
      selected = null;
      study = null;
      change();
      root.scrollTop = 0;
    });
    on("[data-industry-tab]", "click", (el) => {
      network.clearMap();
      industryTab = el.dataset.industryTab;
      change();
      root.scrollTop = 0;
    });
    on('[data-production-target]', 'click', el => { if (el.dataset.target) api.openItem(el.dataset.target); });
    on("[data-person]", "click", (el) => {
      selected = el.dataset.person;
      study = null;
      change();
      requestAnimationFrame(() =>
        root.querySelector(".resident-detail")?.scrollIntoView({
          block: "start",
          behavior: s.reducedMotion ? "instant" : "smooth",
        }),
      );
    });
    on("[data-assign]", "change", (el) =>
      result(assignJob(s, el.dataset.assign, el.value)),
    );
    on("[data-assign]", "game-select-open", (el) => {
      const resident = s.community.residents.find(
        (r) => r.id === el.dataset.assign,
      );
      if (!resident) return;
      for (const choice of residentJobChoices(s, resident)) {
        const option = [...el.options].find((o) => o.value === choice.id);
        if (!option) continue;
        if (option.disabled !== choice.disabled)
          option.disabled = choice.disabled;
        option.dataset.meta = choice.meta;
      }
    });
    on("[data-rename]", "click", (el) =>
      result(
        renameCompanion(
          s,
          el.dataset.rename,
          root.querySelector("[data-rename-input]").value,
        ),
      ),
    );
    on("[data-study]", "change", (el) => {
      study = el.value;
      change();
    });
    on("[data-train]", "click", (el) =>
      result(trainResident(s, el.dataset.train, el.dataset.skill)),
    );
    on("[data-person-focus]", "click", (el) =>
      api.focus(el.dataset.personFocus),
    );
    on("[data-golem-upgrade]", "click", (el) =>
      result(upgradeGolem(s, el.dataset.golem, el.dataset.golemUpgrade)),
    );
    on("[data-route-stop], [data-golem-mode]", "change", (el) => {
      const card = el.closest("[data-golem-route]"), id = card.dataset.golemRoute;
      const r = setGolemRoute(s, id,
        [...card.querySelectorAll("[data-route-stop]:checked")].map(input => input.value),
        card.querySelector("[data-golem-mode]").value);
      // Save before any upgrade can rebuild this card. Keep the keyboard user's place.
      const focus = el.matches("[data-route-stop]") ? '[data-route-stop][value="' + el.value + '"]' : '[data-golem-mode]';
      if (!r.ok) api.toast(r.reason);
      change();
      root.querySelector(focus)?.focus({ preventScroll: true });
    });
    on("[data-task]", "click", (el) => api.action(el.dataset.task));
    on("[data-manage-item]", "click", (el) =>
      api.openItem(el.dataset.manageItem),
    );
    on("[data-power-jump]", "click", () => {
      industryTab = "power";
      api.go("network");
    });
    on("[data-village-staff]", "click", () => {
      villageTab = "residents";
      api.go("village");
    });
    on("[data-equipment-buy]", "click", (el) =>
      api.purchase(el.dataset.equipmentBuy),
    );
    on("[data-capacitor]", "click", () => result(upgradeCapacitor(s)));
    on("[data-auto]", "change", (el) =>
      result(
        configureAutomation(
          s,
          el.dataset.auto,
          el.type === "checkbox" ? el.checked : Number(el.value),
        ),
      ),
    );
    const crank = root.querySelector("[data-crank]");
    if (crank) api.bindHold(crank, "crank");
    if (root._managementClick)
      root.removeEventListener("click", root._managementClick);
    root._managementClick = (e) => {
      const device = e.target.closest("[data-device-toggle]"),
        connect = e.target.closest("[data-device-connect]");
      if (device) result(toggleDevice(s, device.dataset.deviceToggle));
      if (connect) result(connectGrid(s, connect.dataset.deviceConnect));
    };
    root.addEventListener("click", root._managementClick);
  }
  function refresh(root) {
    api.refreshHousing?.(root);
    network.refresh(root);
    workplaces.refresh(root);
    refreshVillageOverview(root, api.state());
    const s = api.state(),
      c = ensureCommunity(s),
      p = powerSnapshot(s),
      set = (selector, value) => {
        const el = root.querySelector(selector);
        if (el) el.textContent = value;
      };
    for (const r of [...c.residents, ...c.golems]) {
      set(`[data-person-status="${r.id}"]`, r.status);
      set(`[data-person-earned="${r.id}"]`, fmt(r.jobEarned || 0) + " ◆");
      set(`[data-person-done="${r.id}"]`, "已完成 " + r.jobsDone + " 次工作");
      set(
        `[data-golem-delivered="${r.id}"]`,
        `已搬运 ${fmt(r.delivered || 0)} 份 · ${r.trips} 趟`,
      );
    }
    set("[data-energy]", `${fmt(s.energy)} / ${fmt(p.capacity)} E`);
    const fill = root.querySelector("[data-energy-fill]");
    if (fill)
      fill.style.width = (p.capacity ? (s.energy / p.capacity) * 100 : 0) + "%";
    set("[data-generation]", fmt(p.supply) + " E/s");
    set("[data-consumption]", fmt(p.consumption) + " E/s");
    set("[data-demand]", fmt(p.demand) + " E/s");
    set(
      "[data-power-guidance]",
      p.supply < p.demand
        ? `当前需求 ${fmt(p.demand)} E/s，缺口 ${fmt(p.demand - p.supply)} E/s。增加发电，或暂停次要设备。`
        : `供电余量 ${fmt(p.supply - p.demand)} E/s · 最远供电 ${gridRange(s)} 格${s.grid.legacyStudioSupply ? " · 旧版直播电源已保留" : ""}`,
    );
    const load = root.querySelector("[data-loads]");
    if (load) {
      const ids = new Set(p.loads.map((l) => l.id));
      for (const row of load.querySelectorAll("[data-power-load]"))
        if (!ids.has(row.dataset.powerLoad)) row.remove();
      for (const l of p.loads) {
        let row = load.querySelector(`[data-power-load="${l.id}"]`);
        if (!row) {
          row = document.createElement("div");
          row.className = "power-load";
          row.dataset.powerLoad = l.id;
          row.innerHTML = `<div><strong>${esc(l.name)}</strong>${facilityStatusMarkup(s, l.id, p)}</div>${ITEMS[l.id] ? "<button data-load-action></button>" : ""}`;
          load.append(row);
        }
        row.dataset.powerState = l.state;
        const button = row.querySelector("[data-load-action]");
        if (button) {
          const needsConnection =
            !l.connected && !s.grid.disabled.includes(l.id);
          button.removeAttribute(
            needsConnection ? "data-device-toggle" : "data-device-connect",
          );
          button.setAttribute(
            needsConnection ? "data-device-connect" : "data-device-toggle",
            l.id,
          );
          const text = needsConnection
            ? "检查线路"
            : l.enabled
              ? "暂停"
              : "启用";
          if (button.textContent !== text) button.textContent = text;
        }
      }
    }
    set("[data-community-shipped]", `${fmt(c.shipped)} 份`);
    refreshMarketCargo(root, c);
    refreshMarketReceipts(root, s);
    refreshProductionSummary(root, s, p);
    root.querySelectorAll("[data-equipment-buy]").forEach((button) => {
      const item = ITEMS[button.dataset.equipmentBuy];
      refreshPurchaseButton(button, purchaseStatus(s, item), item.name);
    });
  }
  return {
    village,
    industry,
    // Live overview values refresh in place just like the market ledger.
    get marketOpen() { return villageTab === 'market' || villageTab === 'overview'; },
    hauling(id) {
      return HAUL_SOURCES.includes(id) ? network.logisticsFor(id) : "";
    },
    bind,
    refresh,
    key: () => [
      villageTab,
      industryTab,
      selected,
      study,
      reserveOpen,
      rosterView,
      ...network.key(),
    ],
    recruit(){villageTab="residents";rosterView="people";selected=null;study=null;api.go("village");},
    housing(){villageTab="housing";selected=null;study=null;},
    workplace(job){
      villageTab='residents';rosterView='jobs';selected=null;study=null;
      api.go('village');
      workplaces.open(document.querySelector('#panel-content'),job);
    },
    select(id) {
      selected = id;
      villageTab = id?.startsWith("golem") ? "helpers" : "residents";
      study = null;
    },
    power() {
      network.clearMap();
      industryTab = "power";
    },
    logistics() {
      network.clearMap();
      industryTab = "logistics";
    },
  };
}
