import { cargoSnapshot } from './management-overview.js';
import { formatHudNumber } from './hud-numbers.js';
import { foldAttributes } from './panel-memory.js';
import { RELEASE_VERSION } from './release.js';
import { POWER_BENEFITS } from './power-benefits.js';
import { ITEMS, REALMS } from "./catalog.js";
import {
  gridConnection,
  connectionProblem,
  NETWORK_FACILITIES,
  connectGrid,
  disconnectGrid,
  toggleDevice,
  devicePaused,
  connectAll,
  setAutoConnect,
  powerSnapshot,
  configureAutomation,
  automationAssignments,
} from "./power.js";
import {
  ensureCommunity,
  activeResidents,
  HAUL_SOURCES,
  prioritizeHauling,
  JOBS,
  skillLevel,
  portrait,
  escapeHtml as esc,
  setGolemRoute,
  jobAvailable,
  jobSlots,
} from "./residents.js";
import { localStock } from "./operations.js";
import { upgradeExtraPower } from "./upgrades.js";
import { freightSpec } from "./dimensional.js";
import {
  facilityStatusMarkup,
  facilityStatusSummaryMarkup,
  refreshFacilityStatuses,
} from "./facility-status.js";
import { transportTopology } from "./routing.js";
import { footprint } from "./layout.js";
import { icon, iconButton } from "./icons.js";
const n = (s, id) => s.counts[id] || 0,
  fmt = (v) => Math.floor(v || 0).toLocaleString("zh-CN");
const name = (id) => (id === "home" ? "售货箱" : ITEMS[id]?.name || id);
const target = (s) =>
  s.placements.M4 ? "M4" : s.placements.V3 ? "V3" : "home";
const automaticNames = { farm: "农田收割", wool: "羊群剪毛", mine: "矿区采集" };
export function connectionAction(s, id, power) {
  if (n(s, id) && !NETWORK_FACILITIES.has(id) && freightSpec(s, id))
    return { action: "toggle", label: devicePaused(s, id) ? "恢复运行" : "暂停设备", reason: "" };
  if (
    !n(s, id) ||
    !NETWORK_FACILITIES.has(id) ||
    id === "M5" ||
    (id === "M4" && !upgradeExtraPower(s, id))
  )
    return null;
  const c = gridConnection(s, id),
    stopped = s.grid.disabled.includes(id),
    reason = connectionProblem(s, id);
  const optional = POWER_BENEFITS[id];
  if (stopped) return { action: "toggle", label: optional ? "启用用电增益" : "恢复运行", reason };
  if (!c.gridReady) return { action: "power", label: "查看红石控制台", reason };
  if (!c.connected)
    return {
      action: reason ? "map" : "connect",
      label: reason ? "查看线路" : optional ? "接电提速" : id === "M17" ? "启用自动装卸" : "接入电网",
      reason,
    };
  if (
    (power || powerSnapshot(s)).loads.some(
      (l) => l.id === id && l.state === "no-power",
    )
  )
    return {
      action: "power",
      label: "查看供电",
      reason: optional ? "供电不足，仍可按原速演出" : "设备已接入，当前供电不足",
    };
  return { action: "toggle", label: optional ? "停用用电增益" : "暂停设备", reason: "" };
}
export function connectionControls(s, id) {
  const a = connectionAction(s, id);
  if (!a) return "";
  const view = connectionButtonView(s, id, a);
  if (!NETWORK_FACILITIES.has(id))
    return `<div class="connection-actions" data-connection-actions="${id}"><div><button type="button" class="facility-icon device-toggle" data-connection-primary data-network-action="toggle" data-network-id="${id}" data-run-state="${view.state}" aria-label="${esc(view.label)}" title="${esc(view.label)}">${view.html}</button></div></div>`;
  const connected = gridConnection(s, id).connected;
  return `<div class="connection-actions" data-connection-actions="${id}"><p data-connection-reason>${esc(a.reason)}</p>${POWER_BENEFITS[id] ? `<p class="connection-benefit">${POWER_BENEFITS[id].label} · 准备时 ${POWER_BENEFITS[id].rate} E/秒；未接电仍可演出。</p>` : ""}<div><button type="button" class="${view.toggle ? 'facility-icon device-toggle' : 'primary'}" data-connection-primary data-network-action="${a.action}" data-network-id="${id}" data-run-state="${view.state}" aria-label="${esc(view.label)}" title="${esc(view.label)}">${view.html}</button>${iconButton('circuit', `查看${name(id)}线路`, `data-network-action="map" data-network-id="${id}"`)}<button type="button" class="facility-icon device-toggle" data-connection-stop data-network-action="toggle" data-network-id="${id}" data-run-state="enabled" aria-label="${esc(POWER_BENEFITS[id] ? '停用用电增益' : `暂停${name(id)}`)}" title="${esc(POWER_BENEFITS[id] ? '停用用电增益' : `暂停${name(id)}`)}" ${a.action === 'power' && connected ? '' : 'hidden'}>${icon('pause',18)}</button><button class="network-secondary" data-connection-disconnect data-network-action="disconnect" data-network-id="${id}" ${connected ? '' : 'hidden'}>断开</button></div></div>`;
}
function connectionButtonView(s, id, action) {
  const toggle = action.action === 'toggle', paused = devicePaused(s, id);
  return {
    toggle, state: toggle ? (paused ? 'paused' : 'enabled') : 'unconnected',
    label: toggle && !POWER_BENEFITS[id] ? `${paused ? '恢复运行：' : '暂停：'}${name(id)}` : action.label,
    html: toggle ? icon(paused ? 'play' : 'pause', 18) : esc(action.label),
  };
}
export function createNetworkUI(api) {
  let choosing = null,
    recruiting = false,
    recentDevice = null,
    mapMode = null,
    mapRealm = "overworld",
    mapSelected = null,
    mapZoom = 1,
    mapPan = { x: 0, y: 0 };
  function changed() {
    api.changed();
  }
  function act(result, button) {
    const action = button?.dataset.networkAction,
      id = button?.dataset.networkId;
    api.toast(result.text || result.reason || "已保存");
    if (result.ok && id) recentDevice = id;
    if (result.connected === true) api.connected?.(result.id);
    changed();
    if (action)
      requestAnimationFrame(() =>
        document
          .querySelector(
            `[data-connection-actions="${id}"] [data-network-action]`,
          )
          ?.focus({ preventScroll: true }),
      );
  }
  function devices(s, ids) {
    return ids
      .filter((id) => n(s, id))
      .map(
        (id) =>
          `<article class="network-device" data-equipment-card="${id}"><header><button class="network-title" data-manage-item="${id}"><img src="${import.meta.env.BASE_URL}icons/${id}.png?v=${RELEASE_VERSION}" alt="">${name(id)}</button>${iconButton('gear', `管理${name(id)}`, `data-manage-item="${id}"`)}</header>${connectionControls(s, id)}${facilityStatusSummaryMarkup(s,id)}<details class="device-status-details" ${foldAttributes(`device:${id}:status`)}><summary>运行详情</summary>${facilityStatusMarkup(s, id)}</details></article>`,
      )
      .join("");
  }
  function power() {
    const s = api.state(),
      ids = [...NETWORK_FACILITIES].filter(
        (id) => n(s, id) && id !== "M5" && (!gridConnection(s, id).automatic || POWER_BENEFITS[id]) &&
          (id !== "M4" || upgradeExtraPower(s, id) > 0),
      ),
      p = powerSnapshot(s);
    const pending = ids.filter(
        (id) =>
          !gridConnection(s, id).connected && !s.grid.disabled.includes(id),
      ),
      recent =
        ids.includes(recentDevice) && !pending.includes(recentDevice)
          ? [recentDevice]
          : [];
    return `<section class="network-hub" aria-label="电网接入"><header><h3>电网接入</h3><button data-network-map="power">${icon("circuit", 18)} 查看电网</button></header><p class="panel-note">接入设备后开始用电。演出设备可不接电，接电后准备更快。</p><div class="network-tools">${pending.length ? `<button data-connect-all>接入全部可用设备 · ${pending.filter((id) => !connectionProblem(s, id)).length}</button>` : ""}${s.grid.learnedConnection ? `<label class="management-switch"><span>新设备自动接入</span><input type="checkbox" data-auto-connect ${s.grid.autoConnect ? "checked" : ""}></label>` : ""}</div>${pending.length ? `<h4>等待接入</h4>${devices(s, pending)}` : ""}${devices(s, recent)}<div class="network-blockers" aria-label="设备停工原因">${ids.filter(id=>!pending.includes(id)&&!recent.includes(id)).map(id=>facilityStatusSummaryMarkup(s,id,p,true)).join("")}</div><details ${foldAttributes("network:power:other", !pending.length && !recent.length)}><summary>其余已接入 / 已暂停 · ${ids.length - pending.length - recent.length}</summary>${devices(
      s,
      ids.filter((id) => !pending.includes(id) && !recent.includes(id)),
    )}</details></section>`;
  }
  function sourceCard(s, source) {
    const workers = activeResidents(s).filter(
        (r) => r.job === "hauler" && r.prioritySource === source,
      ),
      c = ensureCommunity(s);
    const golems = c.golems.filter(
      (g) => g.stops.includes(source) && g.mode !== "events",
    );
    const open = choosing === source;
    return `<article class="dispatch-source" data-dispatch-source="${source}"><header><button class="network-title" data-manage-item="${source}"><img src="${import.meta.env.BASE_URL}icons/${source}.png?v=${RELEASE_VERSION}" alt="">${name(source)}</button><button class="quiet-button dispatch-edit" data-haul-choose="${source}" aria-expanded="${open}" aria-controls="dispatch-editor-${source}" aria-label="调整${name(source)}搬运">${icon('gear',16)}<span>调整搬运</span></button></header><dl class="dispatch-cargo">${[['waiting','待取'],['moving','在途'],['trading','待售']].map(([key,label])=>`<div><dt>${label}</dt><dd data-source-cargo="${source}:${key}">${formatHudNumber(cargoSnapshot(s,source)[key])}</dd></div>`).join('')}</dl><p class="dispatch-assigned" data-dispatch-assigned="${source}">优先搬运 ${workers.length} 人 · 傀儡巡收 ${golems.length} 台</p>${open ? editor(s, source, workers) : ''}</article>`;
  }
  function candidateReason(s,r,source) {
    if(r.job==='hauler' && r.prioritySource===source)return '已在这里优先搬运';
    if(r.cargo)return '交付后可调整';
    if(!jobAvailable(s,'hauler'))return '需要集市或储物箱';
    if(r.job!=='hauler' && activeResidents(s).filter(p=>p.job==='hauler').length>=jobSlots(s,'hauler'))return '搬运岗位已满';
    return '';
  }
  function editor(s,source,workers) {
    const c=ensureCommunity(s);
    return `<section class="dispatch-editor" id="dispatch-editor-${source}" aria-label="${name(source)}搬运设置"><header><strong>搬运设置</strong>${iconButton('close','收起搬运设置','data-haul-cancel')}</header><p class="panel-note">交货点：${name(target(s))}。优先取货不影响通用搬运。</p><h4>优先搬运的村民</h4>${workers.map(r=>`<div class="dispatch-person"><span class="resident-portrait">${portrait(r)}</span><div><strong>${esc(r.name)}</strong><small data-delivery-status="${r.id}">${esc(r.status)}</small></div><button type="button" class="facility-icon" data-clear-priority="${r.id}" aria-label="取消${esc(r.name)}的优先搬运" title="取消优先，继续通用搬运" ${r.cargo?'disabled':''}>${icon('close',16)}</button></div>`).join('') || '<p class="empty-note">未指定专人，通用搬运照常进行。</p>'}<button type="button" class="quiet-button" data-haul-recruit aria-expanded="${recruiting}">${icon('plus',16)} ${recruiting?'收起人选':'安排村民'}</button>${recruiting?candidates(s,source):''}<h4>铜傀儡巡收</h4><div class="dispatch-golems">${c.golems.map(g=>{
      const included=g.stops.includes(source)&&g.mode!=='events',full=!g.stops.includes(source)&&g.stops.length>=2+2*g.upgrades.route;
      return `<label class="dispatch-golem"><span class="copper-portrait small"><i></i><b></b></span><span><strong>${esc(g.name)}</strong><small>${full?'巡收范围已满':g.mode==='events'?'勾选后也搬货物':g.cargo?'送完当前货物后生效':'按巡收范围取货'}</small></span><input type="checkbox" data-pickup-golem="${g.id}" data-source="${source}" aria-label="${esc(g.name)}巡收${name(source)}" ${included?'checked':''} ${full?'disabled':''}></label>`;
    }).join('')||'<p class="empty-note">购买铜傀儡后可在这里设置巡收。</p>'}</div></section>`;
  }
  function candidates(s, source) {
    const people=activeResidents(s), available=people.filter(r=>!candidateReason(s,r,source));
    return `<div class="dispatch-candidates" aria-label="选择搬运者">${available.map(r=>`<button data-haul-assign="${r.id}" data-source="${source}"><span class="resident-portrait">${portrait(r)}</span><span><strong>${esc(r.name)} · 物流 Lv.${skillLevel(r,'hauling')}</strong><small>${r.job==='hauler'?`优先取货：${r.prioritySource?name(r.prioritySource):'通用搬运'} → 这里`:r.job==='idle'?'自由活动 → 搬运工':`${JOBS[r.job].name} → 搬运工；原岗位将空出`}</small></span></button>`).join('')||`<p class="empty-note">${!people.length?'先邀请一位村民。':people.some(r=>r.cargo)?'有村民正在交货，完成后可调整。':jobAvailable(s,'hauler')?'没有可改派的村民；可到居民页调整岗位。':'建成集市或储物箱后开放搬运岗位。'}</p>`}</div>`;
  }
  function logistics() {
    const s = api.state(), sources = HAUL_SOURCES.filter((id) => n(s, id));
    return `<section class="network-hub" aria-label="物流调度"><header><h3>取货安排</h3><button class="quiet-button" data-network-map="logistics">${icon('circuit',16)} 运输图</button></header><p class="panel-note">基础交货持续运行${n(s,'M8')?'，已启用的漏斗也会收货':''}。需要专人照看时，再调整搬运。</p>${sources.map(id=>sourceCard(s,id)).join('')||'<p class="empty-note">建好农田、畜栏或工坊后，可以安排取货。</p>'}<details ${foldAttributes('network:transport:devices')}><summary>自动运输设备</summary>${devices(s,['M8','M16','M17'])||'<button data-manage-item="M8">查看漏斗</button>'}</details><details ${foldAttributes('network:deliveries')}><summary>最近人物交付</summary>${activeResidents(s).filter(r=>r.lastDelivery).map(r=>`<p class="delivery-record">${esc(r.name)}：${name(r.lastDelivery.source)} → ${name(r.lastDelivery.target)} · ${fmt(r.lastDelivery.qty)} 份已送达</p>`).join('')||'<p class="empty-note">还没有人物交付记录。</p>'}</details></section>`;
  }
  function automation() {
    const s = api.state(),
      g = s.grid,
      assigned = Object.keys(automaticNames).reduce(
        (a, k) => a + g.automation[k],
        0,
      );
    return `<section class="network-hub" aria-label="执行器分配"><header><h3>自动作业</h3><span class="management-count">${n(s, "M14")} 台执行器</span></header><div class="allocation-summary"><span>已安排 <b>${assigned}</b></span><span>可用 <b>${Math.max(0, n(s, "M14") - assigned)}</b></span></div>${connectionControls(s, "M14")}${Object.entries(
      automaticNames,
    )
      .filter(([k]) => n(s, { farm: "V4", wool: "V9", mine: "M1" }[k]))
      .map(
        ([key, label]) =>
          `<article class="actuator-row"><div><strong>${label}</strong><small>固定 <b data-fixed-count="${key}">${g.automation[key]}</b> · 临时 <b data-borrowed-count="${key}">0</b></small></div><div class="actuator-stepper"><button data-actuator="${key}" data-delta="-1" aria-label="减少${label}发射器" ${g.automation[key] ? "" : "disabled"}>−</button><output>${g.automation[key]}</output><button data-actuator="${key}" data-delta="1" aria-label="增加${label}发射器" ${assigned >= n(s, "M14") ? "disabled" : ""}>＋</button></div></article>`,
      )
      .join(
        "",
      )}<p class="panel-note">${n(s, "M13") ? "侦测器只临时使用空闲名额，不挪走固定分配。" : "购买侦测器后，可自动把空闲名额用于成熟作物。"}需要接电；正在进行的人工工作先完成。</p></section>`;
  }
  function map() {
    if (!mapMode) return "";
    const s = api.state(),
      available = Object.entries(REALMS).filter(
        ([id]) =>
          id === "overworld" ||
          (id === "nether" ? n(s, "N1") : n(s, "E2") && s.endEyes === 12),
      );
    const entries = Object.entries(s.placements).filter(
        ([id, p]) => p.realm === mapRealm,
      ),
      all = entries.map(([id, p]) => ({ id, ...p }));
    const minX = Math.min(-3, ...all.map((p) => p.x - 3)),
      maxX = Math.max(3, ...all.map((p) => p.x + 3)),
      minZ = Math.min(-3, ...all.map((p) => p.z - 3)),
      maxZ = Math.max(3, ...all.map((p) => p.z + 3));
    const w = maxX - minX,
      h = maxZ - minZ,
      vw = w / mapZoom,
      vh = h / mapZoom,
      x = minX + (w - vw) / 2 + mapPan.x,
      z = minZ + (h - vh) / 2 + mapPan.y;
    const routes =
      mapMode === "power"
        ? entries
            .filter(
              ([id]) =>
                NETWORK_FACILITIES.has(id) &&
                (!mapSelected || mapSelected === id),
            )
            .map(([id]) => ({
              id,
              points: gridConnection(s, id).route?.points || [],
              on: gridConnection(s, id).connected,
            }))
        : transportTopology(s, mapRealm)
            .edges.filter(
              (e) =>
                !mapSelected || e.from === mapSelected || e.to === mapSelected,
            )
            .map((e) => ({ id: e.id, points: e.points, on: true }));
    return `<section class="network-map-view"><header><button data-map-back>← 返回管理</button><strong>${mapMode === "power" ? "公共电网" : "区域运输"}</strong></header><div class="network-map-realms">${available.map(([id, r]) => `<button data-map-realm="${id}" class="${id === mapRealm ? "active" : ""}">${r.name}</button>`).join("")}</div><div class="network-map-surface"><svg data-network-svg viewBox="${x} ${z} ${vw} ${vh}" role="img" aria-label="${mapMode === "power" ? "电力" : "运输"}设施布局">${routes.map((r) => `<polyline fill="none" stroke="${r.on ? "#aa604b" : "#b99545"}" stroke-width="0.09" ${r.on ? "" : 'stroke-dasharray="0.2 0.16"'} points="${r.points.map((p) => `${p.x},${p.z}`).join(" ")}"/>`).join("")}${entries
      .map(([id, p]) => {
        const f = footprint(id,p);
        return `<g role="button" tabindex="0" aria-label="${esc(name(id))}" data-map-node="${id}"><rect x="${p.x - f.w / 2}" y="${p.z - f.d / 2}" width="${f.w}" height="${f.d}" fill="${mapSelected === id ? "#789660" : "#e8e7ce"}" stroke="#58725c" stroke-width="0.07"/><image href="${import.meta.env.BASE_URL}icons/${id}.png?v=${RELEASE_VERSION}" x="${p.x - 0.45}" y="${p.z - 0.45}" width="0.9" height="0.9"/></g>`;
      })
      .join(
        "",
      )}</svg></div><div class="network-map-tools"><button data-map-zoom="1.3" aria-label="放大设施图">＋</button><button data-map-zoom="0.77" aria-label="缩小设施图">−</button><button data-map-reset>全图</button></div><p class="panel-note">点设施查看。拖动地图移动，双指或按钮缩放。</p><details class="network-map-picker" ${foldAttributes(`network:map:${mapMode}:picker`)}><summary>选择设施</summary>${entries.map(([id]) => `<button data-map-pick="${id}" class="${mapSelected === id ? "active" : ""}">${name(id)}</button>`).join("")}</details>${mapSelected ? `<h3>${name(mapSelected)}</h3>${facilityStatusMarkup(s, mapSelected)}${mapMode === "power" ? connectionControls(s, mapSelected) : `<button data-manage-item="${mapSelected}">查看设施</button>`}` : "<p>选择设施，突出它的相关线路。</p>"}</section>`;
  }
  function redrawSource(root,source,focus) {
    const row=root.querySelector(`[data-dispatch-source="${source}"]`),top=row?.getBoundingClientRect().top;
    changed();
    const next=root.querySelector(`[data-dispatch-source="${source}"]`);
    if(next&&top!==undefined)root.scrollTop+=next.getBoundingClientRect().top-top;
    next?.querySelector(focus)?.focus({preventScroll:true});
  }
  function bind(root) {
    if(root._dispatchEscape)root.removeEventListener("keydown",root._dispatchEscape);
    root._dispatchEscape=e=>{if(e.key!=="Escape"||!choosing||!root.querySelector(".dispatch-editor"))return;e.preventDefault();e.stopPropagation();const source=choosing;if(recruiting)recruiting=false;else choosing=null;redrawSource(root,source,choosing?"[data-haul-recruit]":"[data-haul-choose]");};
    root.addEventListener("keydown",root._dispatchEscape);
    const on = (selector, event, fn) =>
      root
        .querySelectorAll(selector)
        .forEach((b) => b.addEventListener(event, () => fn(b)));
    on("[data-network-action]", "click", (b) => {
      const s = api.state(),
        id = b.dataset.networkId,
        a = b.dataset.networkAction;
      if (a === "power") {
        if (n(s, "M5")) {
          mapMode = null;
          api.showPower?.();
          changed();
        } else api.openItem("M5");
        return;
      }
      if (a === "map") {
        mapMode = "power";
        mapSelected = id;
        mapRealm = s.placements[id]?.realm || ITEMS[id].realm;
        mapPan = { x: 0, y: 0 };
        api.showPower?.();
        changed();
        return;
      }
      act(
        a === "connect"
          ? connectGrid(s, id)
          : a === "disconnect"
            ? disconnectGrid(s, id)
            : toggleDevice(s, id),
        b,
      );
    });
    on("[data-connect-all]", "click", (b) => act(connectAll(api.state()), b));
    on("[data-auto-connect]", "change", (b) =>
      act(setAutoConnect(api.state(), b.checked), b),
    );
    on("[data-haul-choose]", "click", (b) => {
      const source=b.dataset.haulChoose;
      choosing=choosing===source?null:source; recruiting=false;
      redrawSource(root,source,choosing?'[data-haul-cancel]':'[data-haul-choose]');
    });
    on('[data-haul-cancel]', 'click', () => {const source=choosing; choosing=null; recruiting=false; redrawSource(root,source,'[data-haul-choose]');});
    on('[data-haul-recruit]', 'click', () => {recruiting=!recruiting;redrawSource(root,choosing,'[data-haul-recruit]');});
    on("[data-haul-assign]", "click", (b) => {
      const r = prioritizeHauling(
        api.state(),
        b.dataset.haulAssign,
        b.dataset.source,
      );
      if (r.ok) recruiting = false;
      api.toast(r.text||r.reason||'已保存');
      redrawSource(root,b.dataset.source,'[data-haul-recruit]');
    });
    on('[data-clear-priority]', 'click', b=>{const result=prioritizeHauling(api.state(),b.dataset.clearPriority,null);api.toast(result.text||result.reason);redrawSource(root,choosing,'[data-haul-recruit]');});
    on("[data-pickup-golem]", "change", (b) => {
      const s = api.state(),
        g = ensureCommunity(s).golems.find(
          (g) => g.id === b.dataset.pickupGolem,
        ),
        source = b.dataset.source,
        included = g.stops.includes(source) && g.mode !== "events";
      const result=setGolemRoute(s,g.id,included?g.stops.filter(x=>x!==source):[...new Set([...g.stops,source])],g.mode==='events'?'all':g.mode);
      api.toast(result.text||result.reason);
      redrawSource(root,source,`[data-pickup-golem="${g.id}"]`);
    });
    on("[data-actuator]", "click", (b) =>
      act(
        configureAutomation(
          api.state(),
          b.dataset.actuator,
          api.state().grid.automation[b.dataset.actuator] +
            Number(b.dataset.delta),
        ),
        b,
      ),
    );
    on("[data-network-map]", "click", (b) => {
      mapMode = b.dataset.networkMap;
      mapSelected = null;
      mapRealm = api.state().realm;
      mapZoom = 1;
      mapPan = { x: 0, y: 0 };
      changed();
    });
    on("[data-map-back]", "click", () => {
      mapMode = null;
      changed();
    });
    on("[data-map-realm]", "click", (b) => {
      mapRealm = b.dataset.mapRealm;
      mapSelected = null;
      mapPan = { x: 0, y: 0 };
      mapZoom = 1;
      changed();
    });
    on("[data-map-pick]", "click", (b) => {
      mapSelected = b.dataset.mapPick;
      changed();
    });
    root.querySelectorAll("[data-map-node]").forEach((b) =>
      b.addEventListener("keydown", (e) => {
        if (["Enter", " "].includes(e.key)) {
          e.preventDefault();
          b.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        }
      }),
    );
    on("[data-map-zoom]", "click", (b) => {
      mapZoom = Math.max(0.6, Math.min(4, mapZoom * Number(b.dataset.mapZoom)));
      changed();
    });
    on("[data-map-reset]", "click", () => {
      mapZoom = 1;
      mapPan = { x: 0, y: 0 };
      changed();
    });
    const svg = root.querySelector("[data-network-svg]");
    if (svg) {
      const points = new Map();
      let dragged = false;
      svg.addEventListener("click", (e) => {
        const node = e.target.closest("[data-map-node]");
        if (node && !dragged) {
          mapSelected = node.dataset.mapNode;
          changed();
        }
      });
      svg.addEventListener("pointerdown", (e) => {
        if (!points.size) dragged = false;
        points.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (points.size > 1) dragged = true;
      });
      svg.addEventListener("pointermove", (e) => {
        const old = points.get(e.pointerId);
        if (!old) return;
        const next = { x: e.clientX, y: e.clientY },
          view = svg.viewBox.baseVal;
        if (points.size === 1) {
          if (!dragged && Math.hypot(next.x - old.x, next.y - old.y) < 5)
            return;
          dragged = true;
          svg.setPointerCapture(e.pointerId);
          const scale = Math.max(
            view.width / svg.clientWidth,
            view.height / svg.clientHeight,
          );
          const dx = (next.x - old.x) * scale,
            dy = (next.y - old.y) * scale;
          mapPan.x -= dx;
          mapPan.y -= dy;
          view.x -= dx;
          view.y -= dy;
        } else {
          const other = [...points.entries()].find(
            ([id]) => id !== e.pointerId,
          )?.[1];
          const a = Math.hypot(old.x - other.x, old.y - other.y),
            b = Math.hypot(next.x - other.x, next.y - other.y);
          if (a > 5 && b > 5) {
            const zoom = Math.max(0.6, Math.min(4, (mapZoom * b) / a)),
              ratio = mapZoom / zoom;
            view.x += (view.width - view.width * ratio) / 2;
            view.y += (view.height - view.height * ratio) / 2;
            view.width *= ratio;
            view.height *= ratio;
            mapZoom = zoom;
          }
        }
        points.set(e.pointerId, next);
      });
      for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
        svg.addEventListener(event, (e) => points.delete(e.pointerId));
      svg.addEventListener("pointerleave", (e) => {
        if (!svg.hasPointerCapture(e.pointerId)) points.delete(e.pointerId);
      });
    }
  }
  function refresh(root) {
    const s = api.state(),
      power = powerSnapshot(s);
    for(const row of root.querySelectorAll('[data-dispatch-source]')) {
      const source=row.dataset.dispatchSource, cargo=cargoSnapshot(s,source), c=ensureCommunity(s);
      row.querySelectorAll('[data-source-cargo]').forEach(el=>{const value=formatHudNumber(cargo[el.dataset.sourceCargo.split(':')[1]]);if(el.textContent!==value)el.textContent=value;});
      const assigned=row.querySelector('[data-dispatch-assigned]');
      const people=activeResidents(s).filter(r=>r.job==='hauler'&&r.prioritySource===source),golems=c.golems.filter(g=>g.stops.includes(source)&&g.mode!=='events');
      const summary=`优先搬运 ${people.length} 人 · 傀儡巡收 ${golems.length} 台`;
      if(assigned.textContent!==summary)assigned.textContent=summary;
      for(const b of row.querySelectorAll('[data-haul-assign]')){const r=c.residents.find(r=>r.id===b.dataset.haulAssign);const reason=r?candidateReason(s,r,source):'村民已离开';b.disabled=!!reason;b.title=reason;}
      for(const b of row.querySelectorAll('[data-clear-priority]')) b.disabled=!!c.residents.find(r=>r.id===b.dataset.clearPriority)?.cargo;
    }
    root.querySelectorAll('[data-delivery-status]').forEach(el=>{const r=s.community.residents.find(r=>r.id===el.dataset.deliveryStatus);if(r&&el.textContent!==r.status)el.textContent=r.status;});
    const actual = automationAssignments(s);
    root.querySelectorAll("[data-borrowed-count]").forEach((el) => {
      const k = el.dataset.borrowedCount;
      el.textContent = String(Math.max(0, actual[k] - s.grid.automation[k]));
    });
    // Replace controls only when their action semantics change, not per timer tick.
    root.querySelectorAll("[data-connection-actions]").forEach((el) => {
      const a = connectionAction(s, el.dataset.connectionActions, power),
        b = el.querySelector("[data-connection-primary]");
      if (!a || !b) return;
      if (b.dataset.networkAction !== a.action)
        b.dataset.networkAction = a.action;
      const view = connectionButtonView(s, el.dataset.connectionActions, a);
      const signature = `${a.action}:${view.state}:${view.label}`;
      if (b.dataset.controlView !== signature) {
        b.dataset.controlView = signature;
        b.dataset.runState = view.state;
        b.classList.toggle('primary', !view.toggle);
        b.classList.toggle('facility-icon', view.toggle);
        b.classList.toggle('device-toggle', view.toggle);
        b.setAttribute('aria-label', view.label);
        b.title = view.label;
        b.innerHTML = view.html;
      }
      const stop = el.querySelector('[data-connection-stop]'),
        disconnect = el.querySelector('[data-connection-disconnect]');
      const connected = (stop || disconnect) && gridConnection(s, el.dataset.connectionActions).connected;
      if (stop) stop.hidden = !(a.action === 'power' && connected);
      if (disconnect) disconnect.hidden = !connected;
      const reason = el.querySelector("[data-connection-reason]");
      if (reason && reason.textContent !== a.reason) reason.textContent = a.reason;
    });
    refreshFacilityStatuses(root, s, power);
  }
  return {
    power,
    logistics,
    logisticsFor: (id) =>
      n(api.state(), id) ? sourceCard(api.state(), id) : "",
    automation,
    map,
    bind,
    refresh,
    // Gestures update the SVG viewport in place. They must not invalidate the
    // panel and close a picker on the next simulation tick.
    key: () => [choosing, recruiting, mapMode, mapRealm, mapSelected],
    clearMap() {
      mapMode = null;
    },
    get inspecting() {
      return !!mapMode;
    },
  };
}
