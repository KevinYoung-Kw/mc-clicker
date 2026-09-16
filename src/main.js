import { broadcastStage } from './broadcasting.js';
import { broadcastStageMarkup, broadcastShopItems } from './broadcasting-ui.js';
import { createProductionGuide } from './production-guide-ui.js';
import { powerSnapshot } from './power.js';
import { productionSummary } from './production-summary.js';
import {FARM_TYPES} from './farm-sites.js';
import {farmSitesMarkup,refreshFarmSites,requestFarmHarvest} from './farm-sites-ui.js';
import './farm-sites.css';
import {CIVIC_TYPES} from './civic-data.js';
import {civicReason,civicCost,civicPlacementReason,buildCivic,storeCivic} from './civic-sites.js';
import {readStartupSave,recoverStartupSave} from './startup-storage.js';
import {parseSaveJSON} from './save-validation.js';
import { atlasMarkup, ATLAS_TABS } from './atlas-ui.js';
import { ACHIEVEMENT_GROUPS } from './achievements.js';
import { refreshAchievements, createAchievementFeedback } from './achievements-ui.js';
import './achievements.css';
import {commandAuto,dispatchMode,beaconTarget,beaconMode} from './command-dispatch.js';
import {facilityStored,STORABLE_FACILITIES} from './facility-storage.js';
import {storeFacility,replaceFacility,facilityStorageReason} from './building-storage.js';
import {storeHome,homeStorageReason} from './housing.js';
import { commitImportedSave } from './save-transfer.js';
import './housing.css';
import {HOME_BY_ID,homeReason} from './housing-data.js';
import {claimStarterHome,buildHome,homeCost,housingPlacementReason,moveResidentHome,syncHousingResidents} from './housing.js';
import {createHousingUI} from './housing-ui.js';
import {noteCommunityAction,claimCommunitySouvenir} from './community-stories.js';
import {createGardenUI} from './garden-ui.js';
import {GARDEN_BY_ID,gardenDiscovered,gardenItemReason} from './garden-data.js';
import {plantGarden,clearGarden,undoGardenClear,gardenSites,gardenPlacementReason,gardenObject,paintTerrain,paintTerrainCost,paintTerrainReason} from './garden.js';
import {TERRAIN_BY_ID,TERRAIN_RESTORE,TERRAIN_MOTTLE} from './terrain-data.js';
import {refreshEggLocations} from './easter-eggs.js';
import './garden.css';
import { canHoldMine, miningCombo } from './mining-combo.js';
import { createDevelopmentGuide, discoveryStock } from './development.js';
import { shoppingOptions, shoppingUpgrades } from './shopping-options.js';
import { openingShop } from './opening-shop.js';
import { captiveNotice } from './notice-face.js';
import { createNarratorUI } from "./narrator-ui.js";
import { narrativeContext } from './narrative-context.js';
import { notePurchaseConfirmation } from "./narrative.js";
import { recordNarrativeAction } from './narrative-behavior.js';
import { NarrativeAbsence } from './narrative-absence.js';
import { redeemEasterEgg } from "./game.js";
import { panelMemory } from './panel-memory.js';
import { LAND_PRICING, storedLandCount } from './land.js';
import {landRemovalReason,storeLand,undoStoreLand} from './land-management.js';
import {editingPreference,setEditingPreference,editFamily,repeatPlacement,skipPlacementConfirmation,editingUndoAvailable,placementDirection,rememberPlacementDirection} from './editing.js';
import './editing.css';
import { facilityLevelLabel, nextFacilityUnlock } from './facility-growth.js';
import { WEB_BY_ID } from './web-catalog.js';
import { buyWeb } from './presentation.js';
import { ENV_BY_ID, buyEnvironment, environmentAccess } from './environment.js';
import { applyWebAppearance } from './appearance-view.js';
import { createObservatoryUI } from './observatory-ui.js';
import './observatory.css';
import { GameAudio } from "./game-audio.js";
import { earlyTarget, itemSummary, developmentRoute } from './first-steps.js';
import { createRecordsUI, audioSettingsMarkup, audioMasterMarkup, audioUnlocked } from "./records-ui.js";
import { RECORD_BY_ID, recordStatus, buyRecord } from "./records.js";
import { facilityStatusMarkup, refreshFacilityStatuses } from "./facility-status.js";
import { RELEASE_NAME, RELEASE_VERSION } from "./release.js";
import {
  dimensionNetworkMarkup,
  orderPanel,
  refreshDimensionUI,
} from "./dimensional-ui.js";
import {
  SHARE_PRICE,
  shareUnlocked,
  shareAvailable,
  unlockSharing,
} from "./sharing.js";
import { createUpgradesUI } from "./upgrades-ui.js";
import {
  buyUpgrade,
  facilityUpgrades,
  UPGRADE_BY_ID,
  upgradePrice,
  upgradeStatus,
  upgradeMultiplier,
} from "./upgrades.js";
import {createVillageLifeUI} from "./village-life-ui.js";
import "./village-life.css";
import { createManagementUI } from "./management-ui.js";
import { connectionControls } from './network-ui.js';
import { bindSpaceMining } from "./keyboard-mining.js";
import {
  GUIDANCE_ITEMS,
  guidanceOwned,
  guidanceRequirements,
  buyGuidance,
} from "./guidance.js";
import { createGuidanceUI } from "./guidance-ui.js";
import { createGainLayer } from "./gain-layer.js";
import {
  purchaseStatus,
  buttonContent,
  refreshPurchaseButton,
  requirementLinks,
} from "./purchase-feedback.js";
import { createShopOnboarding } from "./shop-onboarding.js";
import { createMobileCamera } from "./mobile-camera.js";
import { bindInputGuidance } from "./input-guidance.js";
import { siteBrand } from "./site-brand.js";
import { bindMobileSheet } from "./mobile-sheet.js";
import { bindMobileTools } from "./mobile-tools.js";
import { createRealmPicker } from "./realm-picker.js";
import { createNotifications, bindSceneHud } from "./notifications.js";
import { projectMarkup, refreshProject } from "./project-ui.js";
import "./project-style.css";
import { createMailUI } from "./mail-ui.js";
import { mailSummary, readMail, upgradePostal, postalRate, postalLevel, postalUpgradeCost } from "./mail.js";
import {
  ensureCommunity,
  activeResidents,
  portrait,
  JOBS,
  activeHost,
} from "./residents.js";
import { studioStaffMarkup, refreshStudioStaff } from "./studio-staff-ui.js";
import { ensureGrid } from "./power.js";
import { TASKS } from "./operations.js";
import { refreshTaskControls } from "./task-controls.js";
import {
  ownerOf,
  inConstruction,
  ownedGroups,
  ownedCatalog,
  ownedUpgrade,
  relatedFacilities,
} from "./facility-shops.js";
import {
  studioSpec,
  studioEntities,
  studioSites,
  canPlaceStudio,
  placeStudio,
  entityForPurchase,
  ensureStudio,
} from "./studio-placement.js";
import { confirmStudioPurchase } from "./studio-purchases.js";
import { createStudioUI } from "./studio-ui.js";
import {
  COLLECTION_BY_ID,
  COLLECTION,
  collectionNeeds,
  equipExtra,
  resetExtra,
  resetScenery,
  setExtraEnabled,
  shopAvailable,
  hasExtra,
  extraEnabled,
  dayPhase,
  CROPS,
  currentCrop,
  buyCrop,
  selectCrop,
} from "./collection.js";
import { collectionArt } from "./collection-art.js";
import "./style.css";
import "./decoration-skins.css";
import "./studio-room.css";
import "./share-style.css";
import "./guidance-style.css";
import "./mail-style.css";
import "./purchase-style.css";
import "./hud-style.css";
import "./mobile-polish.css";
import "./mobile-sheet.css";
import "./early-game.css";
import "./upgrades-style.css";
import "./records.css";
import "./facility-status.css";
import "./first-steps.css";
import "./web-themes.css";
import "./appearance-polish.css";
import "./game-select.css";
import './network-style.css';
import './interface-polish.css';
import './management-polish.css';
import { installGameSelects } from "./game-select.js";
import {
  CATALOG,
  ITEMS,
  FAMILIES,
  REALMS,
  SAVE_KEY,
} from "./catalog.js";
import {
  fresh,
  VERSION,
  restore,
  n,
  buy,
  price,
  requirements,
  unlocked,
  rates,
  mine,
  action,
  advance,
  settleOffline,
  accessible,
  frontier,
  sites,
  move,
  setOption,
  collectGift,
  format,
  formatWallet,
  cameras,
  PROJECT_TARGET,
  redeemMail,
  emit,
} from "./game.js";
import { ForegroundClock } from "./foreground.js";
import { footprint, placementReason } from "./layout.js";
import { World } from "./world.js";
import { icon, iconButton } from "./icons.js";
import { formatHudNumber, exactBalance } from "./hud-numbers.js";
import "./facility-controls.css";
import { features, hasCosmetics } from "./progression-ui.js";
const $ = (q) => document.querySelector(q),
  $$ = (q) => [...document.querySelectorAll(q)];
window.MCBoot?.stage('读取存档');
window.MCBoot?.recovery({validate:text=>restore(parseSaveJSON(text)),commit:next=>recoverStartupSave(localStorage,SAVE_KEY,next)});
let stored, state;
try { stored=readStartupSave(localStorage,SAVE_KEY,parseSaveJSON); state=restore(stored); }
catch(error){window.MCBoot?.fail(error.code||'SAVE_INVALID',error);throw error;}
if (!stored)
  state.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
settleOffline(state);
let pageSuspended = false,
  windowFocused = document.hasFocus();
const isForeground = () =>
  !window.MCBoot?.failed() && !pageSuspended &&
  windowFocused &&
  document.visibilityState === "visible" &&
  document.hasFocus();
const foreground = new ForegroundClock(performance.now(), isForeground());
let world,
  page = "world",
  studioTab = "program",
  studioMonitor = false,
  studioSelected = null,
  pendingStudio = null,
  studioEntry = 0,
  studioReturn = null,
  displayedMoney = state.money,
  panel = "build",
  family = "all",
  atlasTab = "buildings",
  achievementGroup = "all",
  achievementPending = false,
  selected = null,
  itemReturn = { panel: "build", family: "all" },
  placement = null,
  shopKey = "",
  firstShopAll = false,
  lastPaint = 0,
  lastSave = 0,
  lastEvent = state.eventSerial,
  lastView = "",
  holdTimer,
  holdInterval,
  keyboardMining,
  savingFailed = false;
const symbols = {
  T: "hand",
  V: "leaf",
  M: "bolt",
  L: "camera",
  N: "spark",
  E: "spark",
  X: "leaf",
  Z: "cube",
};
import "./narrative.css";
const realmNames = { overworld: "主世界", nether: "下界", end: "末地" };
$("#app").innerHTML = `
<header class="hud"><div class="wallet"><span class="emerald"></span><div><button id="income-open" aria-label="查看实际收入来源" aria-haspopup="dialog" aria-controls="modal" aria-expanded="false"><strong id="money">0</strong><span class="income-rate"><b id="rate">0</b><span> / 秒</span><span class="income-indicator">${icon("chevron", 14)}</span></span></button><span id="first-income" role="status" hidden>邮政 +1/秒</span></div></div><div class="hud-status"><span id="population" hidden></span><button id="power-top" title="查看生产网络" hidden>${icon("bolt", 15)}<span><small>红石储能</small><b data-hud-energy></b></span></button></div><button id="hud-more" hidden aria-label="菜单" aria-expanded="false" aria-controls="hud-tools">菜单</button><nav id="hud-tools" class="hud-tools" aria-label="游戏功能"><button id="settings" hidden class="square labeled-tool" aria-label="设置">${icon("settings", 20)}<span>设置</span></button><button id="quick-help" hidden class="square labeled-tool" aria-label="操作指南">${icon("help", 20)}<span>操作指南</span></button>${siteBrand}<button id="sound" class="square" aria-label="打开声音">${icon("mute", 20)}</button><button id="info-open" class="square" aria-label="世界信息" title="世界信息" hidden>${icon("info", 20)}</button><button id="share-open" class="square" aria-label="分享" title="分享你的世界" hidden>${icon("share", 20)}</button><button id="collection-open" class="square" aria-label="装饰商店" title="装饰商店" hidden>${icon("bag", 20)}</button></nav></header>
<main id="game" class="panel-open"><header id="studio-header" hidden><button id="studio-back">← 返回世界</button><span><i></i> BLOCKCAST <b>导播室</b></span><small>把你的世界，播给大家看。</small></header><div id="studio-console" hidden><div class="console-channel"><small>正在播出</small><strong id="studio-shot-name">村庄全景</strong></div><button id="studio-prev" aria-label="上一个机位">←</button><button id="studio-next" aria-label="下一个机位">→</button><button id="studio-host">按住 · 开麦主持</button><button id="studio-respond">回应弹幕</button><div class="studio-heat"><span>节目热度</span><i><b></b></i></div></div>
 <div id="stage"><div id="world"></div><div id="fallback" hidden>这个浏览器暂时无法显示 3D。采集、建造和经营仍然可用。</div><div class="stage-vignette"></div>
  <div class="goal-prompt" id="mission" hidden><div id="mission-content"><button id="mission-link"><span id="mission-icon"></span><span><small>下一个目标</small><strong id="mission-name"></strong></span></button></div><button id="mission-toggle" aria-label="收起任务提示" aria-expanded="true" aria-controls="mission-content">${icon("arrow", 16)}</button></div>
  <div class="realm-switch" id="realm-switch"></div><button class="home-view square" id="home-view" aria-label="回到全景">${icon("locate", 22)}</button>
  <div id="world-label"><span class="eyebrow">A WORLD OF YOUR OWN</span><h1 id="world-name">第一块</h1><p id="world-subtitle">轻轻一下，世界就开始了。</p></div>
  <div id="live-overlay" hidden><span class="live-badge"><i></i> LIVE · MC TV</span><div><strong id="live-program"></strong><span id="live-view-count"></span></div></div>
  <div id="gains" aria-hidden="true"></div><div id="gift-layer"></div>
  <div id="placement-bar" hidden><p id="placement-label" aria-live="polite">点浅绿色区域，预览位置</p><p id="placement-detail" hidden></p><div id="placement-tools" hidden><button id="placement-land-mode" title="整理土地" aria-label="整理土地">${icon("wrench",18)}</button><button id="placement-repeat" aria-pressed="false">${icon("repeat",18)}<span>连续</span></button><button id="placement-move" title="搬动布景" aria-label="搬动布景" hidden>${icon("wrench",18)}</button><button id="placement-undo" title="撤销上次收起" aria-label="撤销上次收起" hidden>${icon("undo",18)}</button></div><div><button id="placement-cancel">取消</button><button id="placement-confirm" class="primary" disabled>在这里建造</button></div></div>
  <div class="world-controls" id="world-controls"><div class="interaction-chips" id="interaction-chips"></div><button id="mine" class="mine-button">${icon("hand", 20)}<span>采集</span><strong id="click-value">+1</strong><kbd id="mine-method">点按</kbd></button><div id="resonance" hidden><span id="resonance-label"></span><i><b></b></i></div><p class="gesture-hint" data-gesture-hint></p></div>
 </div>
 <aside id="panel" aria-label="游戏操作面板"><button class="drawer-handle" type="button" aria-label="展开面板" aria-expanded="false" aria-controls="panel-content"></button><header class="panel-header"><button id="panel-world-back" class="square" type="button" aria-label="返回世界" title="返回世界">←</button><div><span class="eyebrow" id="panel-kicker">THE NEXT POSSIBILITY</span><h2 id="panel-title">下一块可能</h2><span id="shop-wallet" hidden aria-label="绿宝石余额"><span class="mini-emerald"></span><strong data-shop-balance></strong></span></div><button id="panel-expand" class="square" type="button" aria-label="展开面板" aria-expanded="false" aria-controls="panel-content"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" d="M10 5h4v2h2v2h2v2h-3V9h-2V7h-2v2H9v2H6V9h2V7h2zM6 15h12v2H6z"/></svg></button><button id="panel-close" class="square" aria-label="收起面板">${icon("close", 20)}</button></header><div id="panel-content"></div></aside>
 <nav class="hotbar" aria-label="游戏快捷栏"><button data-nav="build">${icon("bag", 22)}<span>商城</span><kbd>1</kbd></button><button data-nav="village">${icon("leaf", 22)}<span>村庄</span><kbd>2</kbd></button><button data-nav="network">${icon("bolt", 22)}<span>工业</span><kbd>3</kbd></button><button data-nav="atlas">${icon("book", 22)}<span>图鉴</span><kbd>4</kbd></button></nav>
</main>
<div id="notice-center" popover="manual" hidden><div id="foreground-status" class="scene-notice" role="status" hidden>${icon("info", 18)}<span>已暂停 · 回到游戏继续</span></div><div id="toast" class="scene-notice" role="status" aria-live="polite" hidden></div></div><dialog id="modal"><button id="modal-close" class="square modal-close" aria-label="关闭">${icon("close", 20)}</button><div id="modal-content"></div></dialog>`;
$("#game").insertAdjacentHTML(
  "beforeend",
  `<nav id="room-tools" aria-label="直播间操作" hidden><button data-room-tab="program">${icon("camera", 18)}<span>节目</span></button><button data-room-tab="equipment">${icon("cube", 18)}<span>添置设备</span></button><button data-room-tab="arrange">${icon("hand", 18)}<span>整理房间</span></button><button data-room-tab="decor">${icon("bag", 18)}<span>室内装扮</span></button><button id="room-close-panel" aria-label="收起操作面板">${icon("close", 18)}</button></nav><div id="room-camera-tools" hidden><button id="room-rotate-left" aria-label="向左旋转视角">↶</button><button id="room-rotate-right" aria-label="向右旋转视角">↷</button><button id="room-monitor">查看节目</button></div>`,
);
$("#placement-confirm").insertAdjacentHTML(
  "beforebegin",
  `<button id="placement-rotate" title="旋转 90°（R）" aria-label="旋转 90°" hidden>${icon('rotate',18)}</button>`,
);
// Size the mobile editing dock from its actual contents, including wrapped copy.
let dockResizeFrame=0;
new ResizeObserver(()=>{
  cancelAnimationFrame(dockResizeFrame);
  dockResizeFrame=requestAnimationFrame(()=>{
    const bar=$('#placement-bar');if(bar.hidden)return;
    const height=`${Math.ceil(bar.getBoundingClientRect().height)+2}px`;
    if($('#game').style.getPropertyValue('--editing-dock-height')!==height)$('#game').style.setProperty('--editing-dock-height',height);
  });
}).observe($('#placement-bar'));
$("#room-close-panel").insertAdjacentHTML(
  "beforebegin",
  '<button id="room-gifts" hidden><span>收礼</span><b>0</b></button>',
);
$("#studio-header > span").innerHTML = "<i></i> 我的直播间 <b>BLOCKCAST</b>";
$("#studio-header small").setAttribute("data-gesture-hint", "");
const realmPicker = createRealmPicker($("#realm-switch"), REALMS, (realm) => {
  state.realm = realm;
  if (page === "live") panelSet(null);
  page = "world";
  document.body.classList.remove("live-page");
  shopKey = "";
  save();
  paint(true);
});
const mobileCamera = createMobileCamera({
  camera: () => world,
  enabled: () => true,
  overviewOnOpen: () => false,
});
bindInputGuidance(() => state);
installGameSelects();
$("#panel-content").addEventListener("click",e=>{
  if(e.target.closest("#first-shop-all")||e.target.closest("#first-shop-back")){
    firstShopAll=!!e.target.closest("#first-shop-all");if(!firstShopAll)family='all';shopKey="";paint(true);
  }
});
const mobileTools = bindMobileTools($("#hud-tools"), $("#hud-more"));
const notifications = createNotifications($("#notice-center"), {
  enabled: false,
});
const infoEnabled = () =>
  guidanceOwned(state, "info") && state.guidance.notices;
function syncInformation() {
  notifications.setEnabled(infoEnabled());
}
bindSceneHud({
  stage: $("#stage"),
  label: $("#world-label"),
  controls: $("#world-controls"),
  hotbar: $(".hotbar"),
  notices: $("#notice-center"),
});
const shopOnboarding = createShopOnboarding({
  button: $('[data-nav="build"]'),
  state: () => state,
  cost: GUIDANCE_ITEMS.find(i=>i.id==='info').cost,
  save,
  open: () => { family='all';go('build'); },
});
function save() {
  if(window.MCBoot?.failed())return;
  try {
    state.savedAt = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    if (!savingFailed) {
      toast("浏览器未能保存进度，请允许本地存储。");
      savingFailed = true;
    }
  }
}
function toast(text, options) {
  syncInformation();
  notifications.show(text, options);
}
function purchaseReceipt(text, cost, detail = '') {
  toast(text, {kind:'success', amount:Number.isFinite(cost) && cost > 0 ? `−${formatWallet(cost)} ◆` : '', detail});
}

const gameAudio = new GameAudio({ state: () => state, base: import.meta.env.BASE_URL, changed: () => save() });
const recordsUI = createRecordsUI({
  state: () => state, audio: gameAudio, purchase: startRecordPurchase,
  voiceChanged: enabled => narrator.setVoiceEnabled(enabled),
  changed: () => { save(); applyCosmetics(); gameAudio.tick(); recordsUI.refresh(document); },
});
function sound(type = "tap", options) { return gameAudio.sfx(type, options); }
// Unlock only on gestures. Returning to the foreground never creates another player.
for (const event of ["pointerdown", "keydown"])
  document.addEventListener(event, () => gameAudio.unlock(), { capture: true, passive: true });
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b || b.disabled || b.matches("[data-buy], [data-task], [data-action], [data-hold], [data-record-buy], #mine")) return;
  if (b.matches("[data-open], [data-nav], [data-family], [data-room-tab], [data-village-tab], [data-industry-tab]")) sound("switch");
  else if (b.matches("[data-item-back], #panel-close, #modal-close, #placement-cancel, #studio-back")) sound("back");
  else sound("tap");
});
const gainLayer = createGainLayer($("#gains"));
function floating(v, lucky = false, mining = false) {
  const el = document.createElement("span");
  el.className =
    "gain" +
    (lucky ? " lucky" : "") +
    (state.webAppearance.equipped.cursor ? " gold" : "");
  el.textContent = (lucky ? "幸运！ " : "") + "+" + formatHudNumber(v, true);
  const view = world?.view;
  const anchor = mining
    ? () => (world?.view === view ? world?.miningPoint() : null)
    : () => {
        const rect = $("#stage").getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height * 0.44 };
      };
  if (state.webAppearance.equipped.cursor && !state.reducedMotion)
    for (let j = 0; j < 5; j++) {
      const chip = document.createElement("i");
      chip.className = "hit-chip";
      chip.style.setProperty("--chip-x", (j - 2) * 14 + "px");
      chip.style.setProperty("--chip-y", -15 - (j % 3) * 10 + "px");
      el.append(chip);
    }
  gainLayer.add(el, anchor);
}
function refreshMiningCombo() {
  const combo=miningCombo(state), button=$('#mine');
  const progress=String(combo.progress);
  if(button.style.getPropertyValue('--mining-progress')!==progress)
    button.style.setProperty('--mining-progress',progress);
  const label='采集，连击倍率 ×'+combo.multiplier.toFixed(2);
  if(button.getAttribute('aria-label')!==label)button.setAttribute('aria-label',label);
  const method=canHoldMine(state)?'按住':'点按';
  if($('#mine-method').textContent!==method)$('#mine-method').textContent=method;
}
function doMine() {
  if (!isForeground() || $("#modal").open || placement || world?.mode?.kind === "garden-edit") return;
  const result = mine(state);
  displayedMoney = state.money;
  refreshMiningCombo();
  world?.hit();
  floating(result.value, result.lucky, true);
  sound("mine");
  if (state.money < displayedMoney || state.reducedMotion)
    displayedMoney = state.money;
  const moneyText = formatHudNumber(displayedMoney);
  if ($("#money").textContent !== moneyText) $("#money").textContent = moneyText;
  $("#money").title = exactBalance(state.money) + " 绿宝石";
}
function doAction(type) {
  if (!isForeground()) return;
  const result = action(state, type);
  if (!result.ok) {
    sound("blocked");
    toast(result.reason || "还在准备，再等一会儿。");
    return;
  }
  if (result.value) floating(result.value);
  if (type !== "crank") toast(result.text);
  sound(["farm", "wool", "chorus", "treasure"].includes(type) ? "harvest" : type === "piston" ? "pickup" : "start");
  if (type === "end-eye") {
    const progress = $(".portal-progress");
    if (progress)
      progress.textContent = "末影之眼 " + state.endEyes + " / 12 · 随工程提供";
    if (state.endEyes === 12) {
      stopHold();
      const button = $("[data-end-eye]");
      if (button) {
        button.style.minWidth = button.getBoundingClientRect().width + "px";
        button.textContent = "进入末地 →";
        button.dataset.action = "enter-end";
      }
    }
  }
  if (type === "enter-end") {
    selected = null;
    go("world");
  }
  paint(true);
  save();
}
let communityHoldAt=null;
function stopHold() {
  if(communityHoldAt!==null){noteCommunityAction(state,'hold',{duration:state.play-communityHoldAt});communityHoldAt=null;}
  keyboardMining?.reset();
  clearTimeout(holdTimer);
  clearInterval(holdInterval);
  ensureGrid(state).crank = 0;
  $$(".holding").forEach((e) => {
    e.classList.remove("holding");
    e.style.removeProperty("--hold");
  });
}
function startHold(type, el) {
  stopHold();
  if (el) el.classList.add("holding");
  if (type === "mine") {
    doMine();
    if (!canHoldMine(state)) return;
    communityHoldAt=state.play;
    holdTimer = setTimeout(
      () => (holdInterval = setInterval(doMine, 200)),
      330,
    );
  } else if (type === "crank") {
    doAction(type);
    holdInterval = setInterval(() => doAction(type), 200);
  } else
    holdTimer = setTimeout(
      () => {
        doAction(type);
        stopHold();
      },
      type === "host" ? 1200 : 850,
    );
}
function bindHold(el, type) {
  el.classList.add("hold-control");
  for (const event of ["contextmenu", "selectstart", "dragstart", "copy"])
    el.addEventListener(event, (e) => e.preventDefault());
  el.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      if (e.touches.length > 1) stopHold();
    },
    { passive: false },
  );
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.isPrimary === false) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    startHold(type, el);
  });
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    el.addEventListener(event, stopHold);
  el.addEventListener("click", (e) => {
    if (e.detail === 0) {
      type === "mine" ? doMine() : doAction(type);
    }
  });
}
bindHold($("#mine"), "mine");
window.MCBoot?.stage('创建画面');
try {
  world = new World($("#world"), (event) => {
    if(event.type==='easter-egg' && isForeground() && !placement && !$('#modal').open) {
      const result=redeemEasterEgg(state,event.id);
      if(result.ok){sound('pickup');toast(`${result.title} · +${formatWallet(result.value)} ◆`,{kind:'success'});state.narrative.gap=0;save();paint(true);}
    }
    if(placement?.kind==='building-edit' && ['select','housing-select'].includes(event.type)){
      const origin=placement.returnTo,camera=world?.captureCamera();
      if(event.type==='housing-select'){const h=state.housing.homes.find(h=>h.id===event.id);if(!h)return;startHomePlacement(h.type,h.id);}
      else {if(!state.placements[event.id]||event.resident||event.golem)return;startPlacement(event.id,true);}
      if(placement){placement.returnTo={arranging:true,origin};world?.restoreCamera(camera);}return;
    }
    if(event.type === "housing-select"){openHousing(event.id);return;}
    if(event.type==='civic-select'){const p=state.life.sites.find(p=>p.id===event.id);if(p){if(FARM_TYPES[p.type])openItem(p.type);else openItem(p.type,true);world?.inspectPoint(p,3);}}
    if(event.type === "garden-select") {
      if(placement?.kind==='garden-edit'){placement.key=event.id;world?.setMode(placement);updateOutdoorPlacementGuide();}
      else gardenUI.select(event.id);
    }
    if (event.type === "mine") doMine();
    if (event.type === "select" && (page !== "live" || event.resident))
      event.resident || event.golem
        ? openCompanion(event.resident || event.golem)
        : event.id === "L2"
          ? go("live")
          : openItem(event.id);
    if (event.type === "place" && placement) {
      placement.site = {...event.site,rotation:placement.rotation||0};
      world?.refreshMarkers();
      updateOutdoorPlacementGuide();
      if (skipPlacementConfirmation(state,placement) && !$("#placement-confirm").disabled) return confirmPurchase(true);
      if (!$("#placement-confirm").disabled && !repeatPlacement(state,placement)) previewPlacementCamera();
    }
    if (
      event.type === "studio-place" &&
      placement?.kind.startsWith("studio-")
    ) {
      placement.site = event.site;
      placement.rotation = event.site.rotation;
      world?.setMode(placement);
      updatePlacementConfirmation();
      if (skipPlacementConfirmation(state,placement) && !$("#placement-confirm").disabled) return confirmPurchase(true);
      if (!$("#placement-confirm").disabled) previewPlacementCamera();
    }
    if (event.type === "studio-select" && page === "live" && !placement) {
      studioSelected = event.key;
      studioMonitor = false;
      studioTab = "inspect";
      panelSet("live");
      paint(true);
    }
    if (event.type === "hold") {
      const type = { V4: "farm", V9: "wool", V10: "treasure", E4: "chorus" }[
        event.id
      ];
      if (state.harvest[type] >= 1) startHold(type);
    }
    if (event.type === "hold-end") stopHold();
  });
  // Initial scene is synchronized once by the first paint, after UI setup.
} catch (e) {
  world?.halt();
  window.MCBoot?.fail('WEBGL',e);
  throw e;
}
window.MCBoot?.stage('准备界面');
const management = createManagementUI({
  state: () => state,
  toast,
  action: doAction,
  openItem: id => openItem(id, true),
  go,
  purchase,
  marketServices: () => sharingOffer() + orderPanel(state),
  housingMarkup:()=>housingUI.markup(),bindHousing:root=>housingUI.bind(root),refreshHousing:root=>housingUI.refresh(root),
  bindHold,
  connected(id) { world?.connectionFeedback(id); },
  changed() {
    syncHousingResidents(state);
    shopKey = "";
    save();
    paint(true);
  },
  focus(id) {
    const resident = ensureCommunity(state).residents.find((r) => r.id === id);
    if (resident?.room === "studio") {
      enterStudio(null, id);
      return;
    } else {
      state.realm = "overworld";
      go("world");
      world?.setView("overworld");
    }
    world?.focusCompanion(id);
    panelSet(null);
    paint(true);
  },
});
function openCompanion(id) {
  management.select(id);
  go("village");
}
function art(i) {
  return (
    '<img class="shop-icon" src="' +
    import.meta.env.BASE_URL +
    "icons/" +
    i.id +
    ".png?v=" +
    RELEASE_VERSION +
    '" width="128" height="128" alt="" loading="eager" decoding="async" data-icon="' +
    i.id +
    '">'
  );
}
const mobileSheet = bindMobileSheet({
  game: $("#game"),
  panel: $("#panel"),
  reducedMotion: () => state.reducedMotion,
  onLayout: () => world?.refreshSurface(),
  onClose: () => closePanel(),
});
function panelSet(kind) {
  panelMemory.leave($("#panel-content"));
  if (placement && kind !== panel) cancelPlacement();
  const changed = panel !== kind;
  const wasOpen = !!panel;
  if (changed) {world?.cancelPointers();if(world?.mode?.kind === "garden-edit"){world.setMode(null);$("#world-controls").hidden=false;}}
  const previous = $("#stage").getBoundingClientRect();
  panel = kind;
  shopKey = "";
  $("#game").classList.toggle("panel-open", !!kind);
  $("#panel").hidden = !kind;
  mobileSheet.sync(kind);
  renderPanel();
  mobileCamera.sync(!!kind);
  world?.resize();
  const next = $("#stage").getBoundingClientRect();
  const layoutChanged = ["x", "y", "width", "height"].some(
    (key) => Math.abs(previous[key] - next[key]) > 0.5,
  );
  // Tabs replace the contents of an open panel; only entering it gets a reveal.
  if (changed && (wasOpen !== !!kind || layoutChanged))
    transitionLayout(previous, !wasOpen && !!kind);
  world?.refreshSurface();
}
function transitionLayout(previous, opening = true) {
  if (state.reducedMotion) return;
  // A menu reveals itself over the world; it does not animate the camera.
  if (opening) {
    $("#panel")
      .getAnimations()
      .forEach((a) => a.cancel());
    $("#panel").animate(
      [
        {
          transform: innerWidth < 760 ? "translateY(28px)" : "translateX(28px)",
          opacity: 0,
        },
        { transform: "translate(0,0)", opacity: 1 },
      ],
      { duration: 360, easing: "cubic-bezier(.22,.8,.24,1)" },
    );
  }
}
function enterStudio(initialPanel = null, companionId = null) {
  if(facilityStored(state,'L2'))return openStoredFacility('L2');
  const token = ++studioEntry;
  if (page === "live") {
    if (initialPanel) openStudioPanel(initialPanel);
    if (companionId) world?.focusCompanion(companionId);
    return;
  }
  stopHold();
  cancelPlacement();
  studioReturn = {
    realm: state.realm,
    pan: innerWidth < 760 ? mobileCamera.free?.pan : world?.pan.clone(),
    zoom: innerWidth < 760 ? (mobileCamera.free?.zoom ?? 1) : world?.zoom || 1,
    yaw: innerWidth < 760 ? (mobileCamera.free?.yaw ?? 0) : world?.yaw || 0,
  };
  panelSet(null);
  state.realm = "overworld";
  world?.setView("overworld");
  world?.focus("L2");
  document.body.classList.add("entering-studio");
  setTimeout(
    () => {
      if (token !== studioEntry) return;
      world?.focus(null);
      studioMonitor = false;
      studioSelected = null;
      document.body.classList.remove("entering-studio");
      document.body.classList.add("live-page");
      page = "live";
      panelSet(null);
      sound("enter");
      paint(true);
      if (pendingStudio) {
        const request = pendingStudio;
        pendingStudio = null;
        startStudioPlacement(...request);
      } else if (initialPanel) openStudioPanel(initialPanel);
      if (companionId) world?.focusCompanion(companionId);
    },
    state.reducedMotion ? 0 : 460,
  );
}
function go(which) {
  if (!features(state)[which]) return;
  if (which === "live") {
    enterStudio();
    return;
  }
  ++studioEntry;
  pendingStudio = null;
  mobileCamera.overview();
  document.body.classList.remove("entering-studio", "live-page");
  stopHold();
  cancelPlacement();
  const returning = studioReturn;
  studioReturn = null;
  if (returning) state.realm = returning.realm;
  page = "world";
  if (which === "expand") {
    startPlacement("V1");
    return;
  }
  panelSet(which === "world" ? null : which);
  paint(true);
  if (returning && world) {
    world.pan.copy(returning.pan || world.pan);
    world.zoom = returning.zoom;
    world.yaw = returning.yaw;
    world.resize();
  }
}
function openStoredFacility(id){
  if(page==='live')go('world');
  selected=id;panelSet('item');world?.select(null);paint(true);
}
function openItem(id, exact = false) {
  if(facilityStored(state,id))return openStoredFacility(id);
  if(ITEMS[id] && !n(state,id)) recordNarrativeAction(state,'inspect',{id});
  if (!exact && n(state,id) && ["M4","M5"].includes(id)) { id==="M4"?management.logistics():management.power();go("network");return; }
  if(id === "X2" && n(state,id) && !exact) return showCosmetics();
  if(id === "X8") return openItem("V19",true);
  if (id === "V18" && n(state, id)) return openMailbox();
  if (id === "X6" && n(state, "L2")) {
    enterStudio("decor");
    return;
  }
  if (id === "L1" && n(state, "L2")) {
    if (page !== "live") enterStudio("arrange");
    else {
      studioSelected = "L1";
      openStudioPanel("inspect");
    }
    return;
  }
  if ((id === "V2" || id === "V15") && n(state, id)) {
    openCompanion(
      id === "V2"
        ? activeResidents(state)[0]?.id
        : ensureCommunity(state).golems[0]?.id,
    );
    return;
  }
  if (["build", "owned", "atlas", "village", "network", "life"].includes(panel))
    itemReturn = { panel, family, scroll: $("#panel-content").scrollTop };
  const owner = ownerOf(id),
    isHost = CATALOG.some((i) => ownerOf(i.id) === id);
  if (owner === "decor") {
    showCosmetics();
    return;
  }
  if (
    (!exact || unlocked(state, ITEMS[id]) || n(state, id)) &&
    ((id === "L2" && n(state, "L2")) || (owner === "L2" && n(state, "L2")))
  ) {
    studioTab = owner === "L2" ? "equipment" : "program";
    if (page === "live")
      openStudioPanel(owner === "L2" ? "equipment" : "program");
    else enterStudio(owner === "L2" ? "equipment" : null);
    return;
  }
  if (!exact && owner && n(state, owner) && !(isHost && n(state, id))) {
    openItem(owner);
    return;
  }
  if(world?.mode?.kind === "garden-edit") {world.setMode(null);$("#world-controls").hidden=false;}
  ++studioEntry;
  mobileCamera.overview();
  document.body.classList.remove("entering-studio");
  selected = id;
  page = "world";
  document.body.classList.remove("live-page");
  const p = state.placements[id];
  if (p) state.realm = p.realm;
  panelSet("item");
  world?.select(id);
  paint(true);
  focusItemCamera(id);
  if(id === "V20" && n(state,id)) gardenUI.restoreMode();
}
function startPlacement(id, relocate = false) {
  stopHold();
  cancelPlacement();
  if (
    world?.landBuild &&
    world.time - world.landBuild.started < 0.9 &&
    !state.reducedMotion
  ) {
    toast("土地施工中");
    return;
  }
  const i = ITEMS[id];
  if (!i || (relocate && !state.placements[id])) return;
  ++studioEntry;
  document.body.classList.remove("entering-studio");
  if (!relocate && !facilityStored(state,id) && !unlocked(state, i)) {
    openItem(id);
    return;
  }
  if (id!=="V1" && !relocate && !facilityStored(state,id) && state.money < price(state, i)) {
    toast("还差 " + formatWallet(Math.ceil(price(state, i) - state.money)) + " 绿宝石");
    return;
  }
  const returnTo = purchaseContext();
  $("#modal").close();
  if (id !== "V1") {
    state.realm = relocate ? state.placements[id].realm : i.realm;
  }
  if (
    id !== "V1" &&
    !relocate && ![0,1].some(rotation=>sites(state, state.realm, null, id, rotation).length)
  ) {
    toast("空间不足，请先扩地。");
    startPlacement("V1");
    return;
  }
  page = "world";
  document.body.classList.remove("live-page");
  placement = {
    id,
    kind: relocate ? "move" : id === "V1" ? "expand" : "build",
    site: relocate?{...state.placements[id]}:null,
    rotation:relocate?(state.placements[id].rotation||0):placementDirection(state,"building"),
    returnTo,
  };
  showPurchaseControls();
  $("#world-controls").hidden = true;
  updateOutdoorPlacementGuide();
  $("#placement-confirm").disabled = true;
  $("#placement-confirm").textContent = "先选择位置";
  $("#placement-rotate").hidden = id==="V1";
  world?.setView(state.realm);
  if (world && innerWidth >= 760) {
    const view = world.captureCamera();
    world.restoreCamera({
      ...view,
      pan: { x: 0, y: 0, z: 0 },
      zoom: 1,
      focusId: null,
      focusPoint: null,
    });
  }
  world?.setMode(placement);
  if (!world) {
    placement.site =
      id === "V1"
        ? { ...frontier(state)[0], realm: state.realm }
        : sites(state, state.realm, relocate ? id : null, id, placement.rotation)[0];
    $("#placement-confirm").disabled = !placement.site;
    $("#placement-label").textContent = "3D 暂不可用：为你选择了第一个空闲位置";
  }
  updateOutdoorPlacementGuide();
  paint();
}
function openHousing(id=null){housingUI.select(id);management.housing();go('village');if(id){const h=state.housing.homes.find(h=>h.id===id);if(h){state.realm='overworld';world?.setView('overworld');world?.inspectPoint(h,Math.max(HOME_BY_ID[h.type].w,HOME_BY_ID[h.type].d)+1);}}}
function startHomePlacement(type,moveId=null){
  const i=HOME_BY_ID[type];if(!i)return;
  const missing=!moveId&&(homeReason(state,type)||(state.money<homeCost(state,type)?'绿宝石还不够':''));
  if(missing){toast(missing);return;}
  stopHold();cancelPlacement();const returnTo=purchaseContext(),home=state.housing.homes.find(h=>h.id===moveId);
  state.realm='overworld';page='world';
  placement={id:'home:'+type,type,moveId,key:moveId,rotation:home?.rotation??placementDirection(state,'home'),kind:moveId?'home-move':'home-build',site:home?{...home}:null,returnTo};
  showPurchaseControls();$('#world-controls').hidden=true;$('#placement-rotate').hidden=false;world?.setView('overworld');world?.home();world?.setMode(placement);updateOutdoorPlacementGuide();paint();
}
function startCivicPlacement(type,moveId=null){
  if(!CIVIC_TYPES[type])return;
  const old=state.life.sites.find(p=>p.id===moveId),reason=!moveId&&(civicReason(state,type)||(state.money<civicCost(state,type)?'绿宝石还不够':''));
  if(reason){toast(reason);return;}
  stopHold();cancelPlacement();const returnTo=purchaseContext();state.realm='overworld';page='world';
  placement={id:type,type,moveId,rotation:old?.rotation||0,kind:moveId?'civic-move':'civic-build',site:old&&!old.stored?{...old}:null,returnTo};
  showPurchaseControls();$('#world-controls').hidden=true;$('#placement-rotate').hidden=false;world?.setView('overworld');world?.home();world?.setMode(placement);updateOutdoorPlacementGuide();paint();
}
function startGardenPlacement(type,moveId=null) {
  const i=GARDEN_BY_ID[type];if(!i)return;
  const missing=!moveId && (gardenItemReason(state,type)||(!(state.garden.stored?.[type]>0)&&state.money<i.cost?'绿宝石还不够':''));
  if(missing){toast(missing);return;}
  stopHold();cancelPlacement();
  const returnTo=purchaseContext();
  state.realm='overworld';page='world';
  placement={id:'garden:'+type,type,moveId,key:moveId,rotation:gardenObject(state,moveId)?.rotation??placementDirection(state,'garden'),kind:moveId?'garden-move':'garden-build',site:moveId?{...gardenObject(state,moveId)}:null,returnTo};
  showPurchaseControls();$('#world-controls').hidden=true;
  $('#placement-rotate').hidden=false;world?.setView('overworld');
  world?.home();world?.setMode(placement);updateOutdoorPlacementGuide();paint();
}
function startTerrainPaint(type,brushSize=1) {
  if(!state.counts.V20){toast('先建造园艺台');return;}
  if(type!==TERRAIN_MOTTLE&&!TERRAIN_BY_ID[type]){toast('没有这种地貌');return;}
  stopHold();cancelPlacement();
  const returnTo=purchaseContext();
  state.realm='overworld';page='world';
  placement={id:'terrain:'+type,type,brush:Math.max(1,Math.min(3,brushSize|0)),kind:'terrain-paint',site:null,returnTo};
  showPurchaseControls();$('#world-controls').hidden=true;
  $('#placement-rotate').hidden=true;world?.setView('overworld');
  world?.home();world?.setMode(placement);updateOutdoorPlacementGuide();paint();
}
function gardenChanged(result) {
  if(!result.ok){toast(result.reason);return result;}
  refreshEggLocations(state);save();shopKey='';world?.sync(state);paint(true);return result;
}
let editUndo=null;
function syncEditTools() {
  if(editUndo && !editingUndoAvailable(state,editUndo))editUndo=null;
  const family=editFamily(placement?.kind),sameUndo=editUndo?.family===family && (family!=='land'||editUndo.token.realm===state.realm);
  $('#placement-tools').hidden=!family;
  $('#placement-repeat').hidden=['garden-edit','garden-move','home-move','land-store'].includes(placement?.kind);
  $('#placement-repeat').setAttribute('aria-pressed',String(family&&editingPreference(state,family)));
  $('#placement-repeat span').textContent=`连续：${family&&editingPreference(state,family)?'开':'关'}`;
  $('#placement-land-mode').hidden=family!=='land';
  $('#placement-land-mode').setAttribute('aria-pressed',String(placement?.kind==='land-store'));
  $('#placement-land-mode').title=placement?.kind==='land-store'?'继续扩地':'整理土地';
  $('#placement-land-mode').setAttribute('aria-label',$('#placement-land-mode').title);
  if(!$('#placement-land-mode span'))$('#placement-land-mode').insertAdjacentHTML('beforeend','<span></span>');
  $('#placement-land-mode span').textContent=placement?.kind==='land-store'?'扩地':'整理';
  $('#placement-move').hidden=placement?.kind!=='garden-edit'||!gardenObject(state,placement.key);
  $('#placement-undo').hidden=!sameUndo;
  $('#placement-cancel').textContent=placement?.kind?.endsWith('-move')?'取消':family&&(editingPreference(state,family)||['garden-edit','land-store'].includes(placement?.kind))?'完成':'取消';
}
function continueEditing() {
  placement.site=null;world?.setMode(placement);world?.refreshMarkers();updateOutdoorPlacementGuide();
}
function startBuildingArrange(origin=purchaseContext()) {
  const camera=world?.captureCamera();stopHold();cancelPlacement();$('#modal').close();page='world';document.body.classList.remove('live-page');panelSet(null);
  placement={kind:'building-edit',returnTo:origin};world?.setView(state.realm);world?.setMode(placement);showPurchaseControls();$('#world-controls').hidden=true;updateOutdoorPlacementGuide();world?.restoreCamera(camera);
}
function confirmStorage(kind,id){
  const home=kind==='home'?state.housing.homes.find(h=>h.id===id):null;
  if(kind==='home'&&!home)return;
  const reason=kind==='home'?homeStorageReason(state,id):facilityStorageReason(state,id);
  const name=home?HOME_BY_ID[home.type].name:ITEMS[id].name;
  const help=home?['安排住户',()=>openHousing(id)]:/电量|储电/.test(reason)?['查看电力',()=>{management.power();go('network');}]:/村民|换岗/.test(reason)?['安排岗位',()=>{management.select(null);go('village');}]:/搬运|巡收|货物|仓储|交货/.test(reason)?['查看物流',()=>{management.logistics();go('network');}]:null;
  const move=()=>{if(home)startHomePlacement(home.type,id);else startPlacement(id,true);};
  modal(`<section class="storage-review"><header><span>${icon('box',24)}</span><div><h2>收纳${name}</h2><p>从地图移走，之后可以免费摆回。</p></div></header><dl><div><dt>收纳后</dt><dd>${home?'保留房型，腾出占地':'停止工作，保留等级和改造'}</dd></div><div><dt>摆回入口</dt><dd>${home?'村庄 → 住房':'商城 → 已购买'}</dd></div></dl>${reason?`<p class="storage-blocker" role="status"><strong>暂时不能收纳</strong>${reason}</p>`:'<p class="storage-hint">只是调整位置或朝向？用扳手搬动即可。</p>'}<div class="modal-actions"><button id="store-cancel">${reason?'关闭':'取消'}</button><button id="store-move">${icon('wrench',18)} 搬动</button>${reason?(help?`<button class="primary" id="store-help">${help[0]}</button>`:''):`<button class="primary" id="store-confirm">${icon('box',18)} 确认收纳</button>`}</div></section>`);
  $('#store-cancel').onclick=()=>$('#modal').close();
  $('#store-move').onclick=()=>{$('#modal').close();move();};
  if(help&&reason)$('#store-help').onclick=()=>{$('#modal').close();help[1]();};
  if(!reason)$('#store-confirm').onclick=()=>{const result=kind==='home'?storeHome(state,id):storeFacility(state,id);if(!result.ok){confirmStorage(kind,id);return;}$('#modal').close();if(kind==='facility')openStoredFacility(id);gardenChanged(result);purchaseReceipt(`${result.name} · 已收纳`,0);};
}
function buildingManagementToolbar(industry=false){
  return `<div class="building-management-toolbar"><button class="quiet-button" data-building-arrange>${icon('wrench',18)} 整理建筑</button>${industry?`<div>${['M4','M5'].filter(id=>state.placements[id]).map(id=>`<button class="quiet-button" data-building-details="${id}" title="管理${ITEMS[id].name}">${icon('gear',18)} ${id==='M4'?'仓库':'控制台'}</button>`).join('')}</div>`:''}</div>`;
}
function startGardenArrange(context) {
  const returnTo=context||purchaseContext();cancelPlacement();state.realm='overworld';page='world';
  placement={id:'garden:edit',kind:'garden-edit',key:null,site:null,returnTo};
  showPurchaseControls();world?.setView('overworld');world?.setMode(placement);$('#world-controls').hidden=true;
  $('#placement-rotate').hidden=true;updateOutdoorPlacementGuide();paint();
}
function cancelPlacement() {
  mobileCamera.overview();
  placement = null;
  $("#placement-bar").hidden = true;
  $("#stage").append($("#placement-bar"));
  $("#placement-bar").classList.remove("purchase-dock");
  $("#game").classList.remove("choosing-site");
  mobileSheet.placement();
  $("#world-controls").hidden = false;
  world?.setMode(null);
  $("#placement-rotate").hidden = true;
  $("#placement-detail").hidden = true;
  delete $("#placement-label").dataset.state;
  syncEditTools();
}
function updateOutdoorPlacementGuide() {
  writeOutdoorPlacementGuide();
  syncDirectPurchase();
}
function syncDirectPurchase() {
  const direct = skipPlacementConfirmation(state,placement);
  $('#placement-confirm').hidden = direct || placement?.kind==='building-edit';
  if (!direct) return;
  const { kind, id, type, extra, equip, site } = placement;
  if (kind === 'move' || kind.endsWith('-move')) return;
  const cost = kind === 'civic-build' ? civicCost(state,type) : kind === 'home-build' ? homeCost(state,type)
    : kind === 'garden-build' ? (state.garden.stored?.[type]>0 ? 0 : GARDEN_BY_ID[type].cost)
    : kind === 'terrain-paint' ? (type===TERRAIN_MOTTLE?0:(TERRAIN_BY_ID[type]?.cost||0))
    : equip ? 0 : extra ? COLLECTION_BY_ID[id].cost : facilityStored(state,id)?0:price(state,ITEMS[id],site?.realm||state.realm);
  $('#placement-detail').textContent += ` · ${formatWallet(cost)} ◆ / 次`;
}
function writeOutdoorPlacementGuide() {
  const { id, kind, site } = placement;
  syncEditTools();
  if(kind==='building-edit'){
    $('#placement-label').textContent='点一座设施或住宅，搬动或转向';
    $('#placement-detail').hidden=false;$('#placement-detail').textContent='确认后继续选下一座；花草仍到园艺台整理';
    $('#placement-confirm').hidden=true;$('#placement-cancel').textContent='完成整理';return;
  }
  if(kind==='garden-edit') {
    const object=gardenObject(state,placement.key),item=GARDEN_BY_ID[object?.kind==='tree'?'oak':object?.type];
    $('#placement-label').textContent=object?item.name:'点世界里的布景，选中后整理';
    $('#placement-detail').hidden=false;$('#placement-detail').textContent=object?(object.native?'自然布景 · 清除后可撤销':'购买的布景 · 收回后可免费再摆'):'只在园艺台中可以选中景观';
    $('#placement-confirm').disabled=!object;$('#placement-confirm').textContent=object?(object.native?'确认清除':'确认收回'):'先选择布景';return;
  }
  if(kind==='land-store') {
    const reason=site?landRemovalReason(state,site):'';
    setPlacementGuide(site,reason,'已有土地');$('#placement-confirm').disabled=!site||!!reason;
    if(!site)$('#placement-label').textContent='整理空地 · 点土地检查能否收起';
    else if(!reason)$('#placement-label').textContent='✓ 这片空地可以收起';
    $('#placement-confirm').textContent=!site?'先选择土地':reason?'暂不能收起':'收起这片空地';
    $('#placement-detail').hidden=false;$('#placement-detail').textContent=`${REALMS[state.realm].name} · 已收起 ${storedLandCount(state)} 片 · 可免费重新摆放`;return;
  }
  if(kind.startsWith('civic-')) {
    const h=CIVIC_TYPES[placement.type],cost=kind==='civic-move'?0:civicCost(state,placement.type),reason=(kind==='civic-build'?civicReason(state,placement.type):'')||(state.money<cost?'绿宝石还不够':'')||(site?civicPlacementReason(state,placement.type,site,placement.moveId):'');
    setPlacementGuide(site,reason);$('#placement-confirm').disabled=!site||!!reason;
    $('#placement-confirm').textContent=!site?'先选择位置':reason?'请调整位置':kind==='civic-move'?'确认摆放':`在这里建造 · ${formatWallet(cost)} ◆`;
    $('#placement-detail').hidden=false;$('#placement-detail').textContent=`${h.name}分点 · ${h.w}×${h.d} 格 · 共用 Lv.${n(state,placement.type)} 装修`;return;
  }
  if(kind.startsWith('home-')) {
    const h=HOME_BY_ID[placement.type],cost=kind==='home-move'?0:homeCost(state,h.id),missing=kind==='home-move'?'':homeReason(state,h.id),reason=missing||(state.money<cost?`还差 ${formatWallet(Math.ceil(cost-state.money))} 绿宝石`:'')||(site?housingPlacementReason(state,h.id,site,placement.moveId):'');
    setPlacementGuide(site,reason);$('#placement-confirm').disabled=!site||!!reason;
    $('#placement-confirm').textContent=!site?'先选择位置':reason?'请调整位置':kind==='home-move'?'确认搬动':`在这里建造 · ${formatWallet(homeCost(state,h.id))} ◆`;
    $('#placement-detail').hidden=false;$('#placement-detail').textContent=`${h.name} · ${placement.rotation%2?h.d:h.w}×${placement.rotation%2?h.w:h.d} 格 · ${h.beds} 个住址`;return;
  }
  if(kind.startsWith('garden-')) {
    const i=GARDEN_BY_ID[placement.type],cost=kind==='garden-move'||state.garden.stored?.[i.id]>0?0:i.cost,shortfall=state.money<cost,reason=(site?gardenPlacementReason(state,i.id,site,placement.moveId):'')||(shortfall?`还差 ${formatWallet(Math.ceil(cost-state.money))} 绿宝石`:'');
    setPlacementGuide(site,reason);$('#placement-confirm').disabled=!site||!!reason;
    $('#placement-confirm').textContent=shortfall?'绿宝石不足':!site?'先选择位置':reason?'请调整位置':kind==='garden-move'?'确认搬动':`${i.group==='ground'?'在这里铺设':i.souvenir?'在这里摆放':'在这里种下'} · ${state.garden.stored?.[i.id]>0?'使用已收纳布景':formatWallet(i.cost)+' ◆'}`;
    $('#placement-detail').hidden=false;$('#placement-detail').textContent=`${i.name} · ${placement.rotation%2?i.d:i.w}×${placement.rotation%2?i.w:i.d} 格${kind==='garden-move'?' · 免费搬动':''}`;return;
  }
  if(kind==='terrain-paint') {
    const item=placement.type===TERRAIN_MOTTLE?TERRAIN_RESTORE:TERRAIN_BY_ID[placement.type];
    const brush=placement.brush||1;
    const quote=site?paintTerrainCost(state,placement.type,site,brush):{cost:0,count:0};
    const reason=(site?paintTerrainReason(state,placement.type,site,brush):'')||(quote.cost>state.money?`还差 ${formatWallet(Math.ceil(quote.cost-state.money))} 绿宝石`:'');
    setPlacementGuide(site,reason);$('#placement-confirm').disabled=!site||!!reason||(site&&!quote.count&&!reason);
    $('#placement-confirm').textContent=!site?'先选择位置':reason?'请调整位置':quote.count?`刷上${item.name} · ${quote.cost?formatWallet(quote.cost)+' ◆':'免费'}`:'已经是这种地貌';
    $('#placement-detail').hidden=false;$('#placement-detail').textContent=`${item.name} · 笔触 ${brush} · 按格计费`;return;
  }
  let reason = !site
    ? ""
    : kind === "expand"
      ? frontier(state, site.realm || state.realm).some((p) => p.x === site.x && p.z === site.z)
        ? ""
        : "请选择与大陆相连的浅绿色土地"
      : placementReason(state, id, site, kind === "move" ? id : null);
  if(kind==='expand' && state.money<price(state,ITEMS.V1))reason=`还差 ${formatWallet(Math.ceil(price(state,ITEMS.V1)-state.money))} 绿宝石`;
  setPlacementGuide(site, reason);
  $("#placement-confirm").disabled = !site || !!reason;
  $("#placement-confirm").textContent = kind==='expand' && state.money<price(state,ITEMS.V1) ? '绿宝石不足' : !site
    ? "先选择位置"
    : reason
      ? "请调整位置"
      : `${kind === "move" ? "确认搬动" : kind === "expand" ? "在这里扩地" : "在这里建造"}${kind === "move" ? "" : ` · ${formatWallet(facilityStored(state,id)?0:price(state, ITEMS[id], site?.realm || state.realm))} ◆`}`;
  const detail = $("#placement-detail");
  detail.hidden = false;
  detail.textContent =
    kind === "expand"
      ? `${REALMS[site?.realm || state.realm].name} · ${!n(state, "V1") && state.realm === "overworld" ? "展开为" : "新增"} 5×5 地面 · ${storedLandCount(state)?`先回摆已收起的 ${storedLandCount(state)} 片，不扣绿宝石`:`下次地价 +${Math.round((LAND_PRICING[site?.realm || state.realm].growth - 1) * 100)}%`}`
      : `${ITEMS[id].name} · ${footprint(id,placement).w}×${footprint(id,placement).d} 格${["build","move"].includes(kind)?` · 朝向 ${placement.rotation*90}°`:""}`;
}
function setPlacementGuide(site, reason, surface = "浅绿色区域") {
  const label = $("#placement-label");
  label.dataset.state = !site ? "choose" : reason ? "invalid" : "valid";
  label.textContent = reason && !site ? `× ${reason}` : !site
    ? `点${surface}，${skipPlacementConfirmation(state,placement)?"直接放置":"预览位置"}`
    : reason
      ? `× ${reason}`
      : "✓ 可以放置 · 确认后落成";
}
function purchaseContext() {
  return {
    focus: panelMemory.focusTarget($("#panel-content")),
    page,
    panel,
    selected,
    family,
    realm: state.realm,
    studioTab,
    scroll: $("#panel-content").scrollTop,
    collection: !!$("#collection-shop")?.closest("dialog")?.open,
    camera: world?.captureCamera(),
  };
}
function showPurchaseControls() {
  notifications.clear();
  $('#placement-confirm').hidden = false;
  const bar = $("#placement-bar");
  const container = ($("#modal").open && placement?.kind === "appearance-purchase") || $("#collection-shop")?.closest("dialog")?.open
    ? $("#modal-content")
    : panel
      ? $("#panel")
      : $("#stage");
  container.append(bar);
  bar.classList.toggle("purchase-dock", container !== $("#stage"));
  bar.hidden = false;
  $("#game").classList.toggle(
    "choosing-site",
    !!placement &&
      ![
        "confirm",
        "share-unlock",
        "guidance-unlock",
        "facility-upgrade",
        "record-purchase",
        "appearance-purchase",
      ].includes(placement.kind),
  );
  mobileSheet.placement();
  syncEditTools();
}
function returnFromPlacement(context) {
  if (!context) return;
  if(context.arranging){startBuildingArrange(context.origin);return;}
  page = context.page;
  selected = context.selected;
  family = context.family;
  studioTab = context.studioTab;
  state.realm = context.realm;
  document.body.classList.toggle("live-page", page === "live");
  panelSet(context.panel);
  paint(true);
  mobileCamera.restore(context.camera);
  panelMemory.restoreFocus($("#panel-content"), context.focus);
  if (context.collection) collectionShop?.render();
  if(context.panel === "item" && context.selected === "V20")gardenUI.restoreMode();
}
function startConfirmation(id) {
  const i = ITEMS[id];
  stopHold();
  cancelPlacement();
  const returnTo = purchaseContext(),
    host = ownerOf(id),
    target = state.placements[id] ? id : host;
  placement = { id, kind: "confirm", returnTo, target };
  if (state.skipPurchaseConfirmation) return confirmPurchase(true);
  world?.setMode(null);
  if (page !== "live" && target && state.placements[target])
    world?.select(target);
  showPurchaseControls();
  $("#placement-rotate").hidden = true;
  $("#placement-confirm").disabled = false;
  $("#placement-confirm").textContent =
    `确认${n(state, id) ? "升级" : "购买"} · ${formatWallet(price(state, i))} ◆`;
  $("#placement-label").textContent = n(state, id)
    ? `${i.name}提升至 ${n(state, id) + 1} 级 · 保留已有位置`
    : host && ITEMS[host]
      ? `${i.name}加入${ITEMS[host].name} · 不新增地块`
      : `${i.name} · 确认购买后即可使用`;
  paint();
}
function startAppearancePurchase(extraId,scope='web') {
  const item=(scope==='web'?WEB_BY_ID:ENV_BY_ID)[extraId];if(!item)return;
  stopHold();cancelPlacement();
  placement={id:scope==='web'?'X2':'V19',extraId,scope,kind:'appearance-purchase',returnTo:purchaseContext()};
  if(state.skipPurchaseConfirmation)return confirmPurchase(true);
  showPurchaseControls();$('#placement-rotate').hidden=true;
  $('#placement-confirm').disabled=false;$('#placement-confirm').textContent=`确认购买 · ${formatWallet(item.cost)} ◆`;
  $('#placement-label').textContent=item.name;paint();
}
function startRecordPurchase(recordId) {
  const status = recordStatus(state, recordId), record = RECORD_BY_ID[recordId];
  if (status.kind !== "ready") { sound("blocked"); return toast(status.reason); }
  stopHold(); cancelPlacement();
  placement = { id: "L1", recordId, kind: "record-purchase", target: "L1", returnTo: purchaseContext() };
  if (state.skipPurchaseConfirmation) return confirmPurchase(true);
  showPurchaseControls();
  $("#placement-rotate").hidden = true;
  $("#placement-confirm").disabled = false;
  $("#placement-confirm").textContent = `收藏唱片 · ${formatWallet(record.cost)} ◆`;
  $("#placement-label").textContent = record.name + " · " + record.style;
  paint();
}
function startFacilityUpgrade(id) {
  const row = UPGRADE_BY_ID[id],
    status = upgradeStatus(state, id);
  if (!row || status.kind !== "ready") return toast(status.reason);
  const returnTo = purchaseContext();
  stopHold();
  cancelPlacement();
  placement = { id, kind: "facility-upgrade", target: row.owner, returnTo };
  if (state.skipPurchaseConfirmation) return confirmPurchase(true);
  showPurchaseControls();
  $("#placement-rotate").hidden = true;
  $("#placement-confirm").disabled = false;
  $("#placement-confirm").textContent =
    "安装改造 · " + formatWallet(upgradePrice(state, id)) + " ◆";
  $("#placement-label").textContent = ITEMS[row.owner].name + " · " + row.name;
  paint();
}
const upgradesUI = createUpgradesUI({
  state: () => state,
  purchase: startFacilityUpgrade,
  openItem,
  toast,
});
const productionGuide = createProductionGuide({
  state: () => state, rates: () => rates(state), purchase, upgrade: startFacilityUpgrade,
  openItem, toast, power: () => { management.power(); go('network'); },
  openMod(id, owner) {
    openItem(owner, true);
    const row=$(`[data-mod-card="${id}"]`);
    if(row){const details=row.closest('details');if(details)details.open=true;if(row.dataset.expanded!=='true')row.querySelector('[data-mod-select]')?.click();row.scrollIntoView({block:'center'});}
  },
});
const guidanceUI = createGuidanceUI({
  state: () => state,
  active: () => isForeground(),
  modal,
  toast,
  purchase: startGuidanceUnlock,
  openItem,
  mailbox: openMailbox,
  activityMarkup:()=>narrator.activityMarkup(),
  bindActivities:root=>narrator.bindActivities(root),
  setNarration:enabled=>narrator.setEnabled(enabled),
  setNarratorVoice:enabled=>narrator.setVoiceEnabled(enabled),
  changed() {
    shopKey = "";
    save();
    paint(true);
  },
});
const mailNumber = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });
const mailUI = createMailUI({
  state: () => state,
  read: (id) => readMail(state, id),
  claim(id) {
    const result = redeemMail(state, id);
    if (result.ok) sound("harvest");
    return result;
  },
  upgrade() {
    const result = upgradePostal(state);
    if (result.ok) sound("buy");
    return result;
  },
  changed() {
    save();
    paint();
  },
  move: () => startPlacement("V18", true),
  store: () => confirmStorage("facility","V18"),
  locate: () => focusItemCamera("V18"),
  toast,
  icon,
  format: (value) => value >= 1e6 ? formatWallet(value) : mailNumber.format(value),
});
function openMailbox(initialTab='letters') {
  if(facilityStored(state,'V18'))return openStoredFacility('V18');
  if (!n(state, "V18")) return openItem("V18");
  $("#modal").close();
  notifications.clear();
  stopHold();
  cancelPlacement();
  if (page === "live") go("world");
  state.realm = "overworld";
  selected = "V18";
  mailUI.reset?.(initialTab);
  shopKey='';
  panelSet("mail");
  world?.setView("overworld");
  world?.select("V18");
  paint(true);
  if (innerWidth >= 760) focusItemCamera("V18");
  $("#panel-content").scrollTop = 0;
  $(`[data-mail-tab="${initialTab==='postal'?'postal':'letters'}"]`)?.focus({ preventScroll: true });
}
$("#mission-toggle").onclick = () => guidanceUI.toggle();
$("#info-open").onclick = () => {if(!narrator.openStatus())guidanceUI.openInfo();};
function startGuidanceUnlock(id) {
  const item = GUIDANCE_ITEMS.find((i) => i.id === id);
  if (!item || guidanceOwned(state, id)) return;
  const needs = guidanceRequirements(state, id);
  if (needs.length) return toast("需要 " + needs.join("、"));
  if (state.money < item.cost)
    return toast(
      `还差 ${formatWallet(Math.ceil(item.cost - state.money))} 绿宝石`,
    );
  stopHold();
  cancelPlacement();
  $("#modal").close();
  placement = {
    kind: "guidance-unlock",
    guidanceId: id,
    returnTo: purchaseContext(),
  };
  if (state.skipPurchaseConfirmation) return confirmPurchase(true);
  showPurchaseControls();
  $("#placement-rotate").hidden = true;
  $("#placement-label").textContent = item.name + " · 购买后显示在界面上，不占土地";
  $("#placement-confirm").disabled = false;
  $("#placement-confirm").textContent =
    "确认解锁 · " + formatWallet(item.cost) + " ◆";
  paint();
}
function sharingOffer() {
  return "";
}
function startSharingUnlock(ending = false) {
  showStats(ending);
}

function startStudioPlacement(id, options = {}) {
  if (page !== "live") {
    pendingStudio = [id, options];
    enterStudio();
    return;
  }
  $("#modal").close();
  cancelPlacement();
  ensureStudio(state);
  const key =
    options.key ||
    (options.extra ? COLLECTION_BY_ID[id]?.slot : entityForPurchase(state, id));
  const spec = studioSpec(key);
  if (!spec) return toast("这项功能在原有设施上升级");
  const current = state.studio.placements[key],
    returnTo = purchaseContext();
  studioMonitor = false;
  placement = {
    id,
    key,
    kind: options.move ? "studio-move" : "studio-build",
    extra: !!options.extra,
    equip: !!options.equip,
    returnTo,
    site: options.move || current ? { ...current } : null,
    rotation: current?.rotation ?? placementDirection(state,'studio'),
  };
  if (!spec.movable) placement.site = { ...spec.default };
  // A new camera or piece of furniture still needs a chosen location.
  // Existing equipment and replacement skins can upgrade in their current slot.
  if (state.skipPurchaseConfirmation && (current || !spec.movable) && !options.move)
    return confirmPurchase(true);
  if (!world && !placement.site)
    placement.site =
      studioSites(state, key, { rotation: placement.rotation })[0] || null;
  showPurchaseControls();
  paint(true);
  world?.setMode(placement);
  world?.selectStudio(key);
  $("#placement-rotate").hidden =
    !spec.movable || spec.layer.startsWith("wall");
  updatePlacementConfirmation();
  if (placement.site) previewPlacementCamera();
}
function updatePlacementConfirmation() {
  if(!placement)return;
  if(["garden-","home-","civic-"].some(prefix=>placement.kind.startsWith(prefix))||["expand","land-store"].includes(placement.kind)){updateOutdoorPlacementGuide();return;}
  if (!placement.kind.startsWith("studio-")) return;
  const spec = studioSpec(placement.key),
    valid =
      !!placement.site && canPlaceStudio(state, placement.key, placement.site),
    cost =
      placement.kind === "studio-move" || placement.equip
        ? 0
        : placement.extra
          ? COLLECTION_BY_ID[placement.id].cost
          : price(state, ITEMS[placement.id]);
  $("#placement-confirm").disabled = !valid || state.money < cost;
  $("#placement-confirm").textContent = cost
    ? `在这里安放 · ${formatWallet(cost)} ◆`
    : "确认位置";
  if (!placement.site) $("#placement-confirm").textContent = "先选择位置";
  else if (!valid) $("#placement-confirm").textContent = "请调整位置";
  const reason = placement.site && !valid ? "与物品重叠或超出安装范围" : state.money < cost ? `还差 ${formatWallet(cost-state.money)} 绿宝石` : "";
  setPlacementGuide(placement.site, reason, spec.layer.startsWith("wall") ? "浅绿色墙面" : "浅绿色区域");
  $("#placement-detail").hidden = false;
  $("#placement-detail").textContent = `${spec.name} · ${spec.w}×${spec.d} 格`;
  syncDirectPurchase();
}
function purchase(id) {
  if(facilityStored(state,id))return startPlacement(id);
  const i = ITEMS[id];
  if (!i) return;
  const status = purchaseStatus(state, i, placement);
  if (status.kind !== "ready") {
    sound("blocked");
    if (status.kind === "locked") {
      if(id === "V2" && n(state,"V2")) management.recruit();
      else openItem(id, true);
    }
    toast(status.reason);
    return;
  }
  const owner = ownerOf(id);
  if (id === "X6" && n(state, "L2")) return enterStudio("decor");
  if (owner === "decor") {
    showCosmetics();
    return;
  }
  if (owner === "L2" || (id === "L1" && n(state, "L2")))
    return startStudioPlacement(id);
  if ((i.place && !n(state, id)) || id === "V1") {
    startPlacement(id);
    return;
  }
  startConfirmation(id);
}
function afterPurchase(i, result) {
  applyCosmetics();
  gameAudio.tick();
  sound(i.id === "V1" ? "land" : result.first && i.place ? "build" : "buy");
  purchaseReceipt(
    (i.id === "V1"
      ? `${REALMS[result.land.realm].name} · 土地已扩展`
      : i.id === "V2" ? `村民已加入 · 共 ${n(state, "V2")} 位`
      : result.first && i.id === "V18"
      ? "邮箱落成"
      : result.first
        ? i.name + (i.place ? "落成" : " · 已购买")
        : `${i.name} · ${n(state, i.id)} 级`),
    result.cost,
    i.id === 'V18' && result.first ? '邮政 +1 /秒' : i.id==='V2' && result.first ? '村庄 · 住房可领取免费住宅' : '',
  );
  shopKey = "";
  world?.sync(state);
  if (result.first && i.place) world?.revealBuilding(i.id);
  save();
  if (i.id === "Z3") {
    page = "world";
    panelSet(null);
    state.realm = "overworld";
    state.burst = 8;
    world?.home();
    sound("harvest");
    setTimeout(() => showStats(true), 1800);
  }
  paint(true);
}
function cancelCurrentPlacement() {
  if(placement?.resumeGardenArrange){const context=placement.returnTo,camera=world?.captureCamera();startGardenArrange(context);world?.restoreCamera(camera);return;}
  const context = placement?.returnTo;
  cancelPlacement();
  returnFromPlacement(context);
}
$("#placement-cancel").onclick = cancelCurrentPlacement;
$("#placement-rotate").onclick = () => {
  if (!placement || !(["build","move"].includes(placement.kind)||["studio-","garden-","home-","civic-"].some(prefix=>placement.kind.startsWith(prefix)))) return;
  placement.rotation = (placement.rotation + 1) % 4;
  if (placement.site)
    placement.site = { ...placement.site, rotation: placement.rotation };
  world?.setMode(placement);
  if(placement.kind.startsWith("studio-"))updatePlacementConfirmation();else updateOutdoorPlacementGuide();
};
$('#placement-repeat').onclick=()=>{
  const family=editFamily(placement?.kind);if(!family)return;
  setEditingPreference(state,family,!editingPreference(state,family));save();syncEditTools();
};
$('#placement-land-mode').onclick=()=>{
  if(!placement||editFamily(placement.kind)!=='land')return;
  placement.kind=placement.kind==='land-store'?'expand':'land-store';placement.site=null;
  world?.setMode(placement);world?.refreshMarkers();updateOutdoorPlacementGuide();
};
$('#placement-move').onclick=()=>{
  const p=gardenObject(state,placement?.key);if(!p)return;
  const context=placement.returnTo,camera=world?.captureCamera();startGardenPlacement(p.kind==='tree'?'oak':p.type,p.id);placement.returnTo=context;placement.resumeGardenArrange=true;world?.restoreCamera(camera);
};
$('#placement-undo').onclick=()=>{
  if(!editUndo)return;const camera=world?.captureCamera({absolute:true}),result=editUndo.family==='land'?undoStoreLand(state,editUndo.token):undoGardenClear(state,editUndo.token);
  if(!result.ok){toast(result.reason);return;}
  editUndo=null;gardenChanged(result);world?.restoreCamera(camera);if(result.land)world?.revealLand(result.land);continueEditing();sound('place');
};
function confirmPurchase(instant = false) {
  if(placement?.kind==='land-store'||placement?.kind==='garden-edit'){
    const editing=placement,land=editing.kind==='land-store',camera=world?.captureCamera({absolute:true}),result=land?storeLand(state,editing.site):clearGarden(state,editing.key);
    if(!result.ok){toast(result.reason);updateOutdoorPlacementGuide();return;}
    editUndo={family:land?'land':'garden',token:land?result:result.undo};gardenChanged(result);world?.restoreCamera(camera);sound('place');
    purchaseReceipt(land?'空地已收起，可免费回摆':`${result.name} · 已收回`,0);
    editing.key=null;continueEditing();return;
  }
  if (
    !placement ||
    (!placement.site &&
      ![
        "confirm",
        "share-unlock",
        "guidance-unlock",
        "facility-upgrade",
        "record-purchase",
        "appearance-purchase",
      ].includes(placement.kind))
  )
    return;
  const { id, site, kind, key, extra, equip, returnTo, ending, guidanceId, recordId, extraId, scope, type, moveId } =
    placement;
  const previousPlacement=state.placements[id];
  const result =
    kind==='terrain-paint' ? paintTerrain(state,type,site,placement.brush||1) : kind.startsWith("civic-") ? buildCivic(state,type,site,{moveId}) : kind.startsWith("home-") ? buildHome(state,type,site,{moveId}) : kind.startsWith("garden-") ? plantGarden(state,type,site,{moveId}) : kind === "appearance-purchase"
      ? (scope === "web" ? buyWeb(state,extraId) : buyEnvironment(state,extraId))
      : kind === "record-purchase"
      ? buyRecord(state, recordId)
      : kind === "facility-upgrade"
      ? buyUpgrade(state, id)
      : kind === "guidance-unlock"
        ? buyGuidance(state, guidanceId)
        : kind === "share-unlock"
          ? unlockSharing(state)
          : kind === "studio-move"
            ? placeStudio(state, key, site)
            : kind === "studio-build"
              ? confirmStudioPurchase(state, id, site, { extra, equip })
              : kind === "move"
                ? { ok: move(state, id, site) }
                : facilityStored(state,id)?replaceFacility(state,id,site):buy(state, id, site);
  if (!result.ok) {
    sound("blocked");
    toast(result.reason || "这里不能放置");
    if (instant && !skipPlacementConfirmation(state,placement)) {
      cancelPlacement();
      paint();
    }
    return;
  }
  noteCommunityAction(state,'build',{kind,placedId:result.id||id,plantType:type});
  rememberPlacementDirection(state,placement);
  notePurchaseConfirmation(state,{manual:!instant && !state.skipPurchaseConfirmation && !['move','studio-move','garden-move','home-move','civic-move'].includes(kind),paid:result.cost});
  if(!['move','studio-move','garden-move','home-move','civic-move'].includes(kind) && result.cost>0)
    recordNarrativeAction(state,'purchase',{id:guidanceId ? `feature:${guidanceId}` : recordId ? `record:${recordId}` : extraId || id});
  // A muted game's first jukebox must unlock audio inside the purchase gesture.
  if (id === "L1" && result.first) gameAudio.command();
  // Register construction before restoring the panel triggers the first scene sync.
  if (result.land) world?.revealLand(result.land);
  const keepsakeFinished=kind==='garden-build'&&GARDEN_BY_ID[type]?.souvenir&&!(state.garden.stored[type]>0);
  if((!keepsakeFinished && repeatPlacement(state,placement) && (kind==='expand'||kind==='garden-build'||kind==='home-build'||kind==='terrain-paint')) || placement.resumeGardenArrange) {
    const camera=world?.captureCamera({absolute:true});
    if(kind==='expand')afterPurchase(ITEMS[id],result);
    else if(kind==='terrain-paint'){gardenChanged(result);sound('place');purchaseReceipt(`${result.name} · 已刷 ${result.count} 格`,result.cost);}
    else {gardenChanged(result);sound('place');purchaseReceipt(`${result.name} · ${kind==='garden-move'?'已搬动':'已摆放'}`,result.cost);world?.revealBuilding(result.id);}
    world?.restoreCamera(camera);
    if(kind==='garden-move'){startGardenArrange(returnTo);world?.restoreCamera(camera);}
    else continueEditing();
    return;
  }
  cancelPlacement();
  if(kind==='terrain-paint'){gardenChanged(result);returnFromPlacement(returnTo);sound('place');purchaseReceipt(`${result.name} · 已刷 ${result.count} 格`,result.cost);gardenUI.restoreMode();return;}
  if(kind.startsWith('civic-')){gardenChanged(result);returnFromPlacement(returnTo);sound('place');purchaseReceipt(`${result.name} · ${kind==='civic-move'?'已摆放':'已建成'}`,result.cost);world?.revealBuilding(result.id);previewBuiltCamera(site,kind,id);return;}
  if(returnTo?.arranging){gardenChanged(result);returnFromPlacement(returnTo);sound('place');return;}
  if(kind.startsWith('home-')) {
    gardenChanged(result);housingUI.select(result.id);returnFromPlacement(returnTo);sound('place');
    purchaseReceipt(`${result.name} · ${kind==='home-move'?'已搬动':'已建成'}`,result.cost);
    world?.revealBuilding(result.id);previewBuiltCamera(site,kind,id);return;
  }
  if(kind.startsWith('garden-')) {
    gardenChanged(result);returnFromPlacement(returnTo);sound('place');
    purchaseReceipt(`${result.name} · ${kind==='garden-move'?'已搬动':GARDEN_BY_ID[type].group==='ground'?'已铺设':GARDEN_BY_ID[type].souvenir?'已摆放':'已种下'}`,result.cost);
    world?.revealBuilding(result.id);previewBuiltCamera(site,kind,id);gardenUI.restoreMode();return;
  }
  if(kind === 'appearance-purchase') {
    applyCosmetics();save();shopKey='';world?.sync(state);returnFromPlacement(returnTo);
    sound('buy');purchaseReceipt((scope==='web'?WEB_BY_ID:ENV_BY_ID)[extraId].name+' · 已购买',result.cost);return;
  }
  if (kind === "record-purchase") {
    save(); returnFromPlacement(returnTo); recordsUI.refresh(document); sound("buy");
    purchaseReceipt(result.text, result.cost); return;
  }
  if (kind === "facility-upgrade") {
    emit(state, "upgrade", result.text, ITEMS[result.owner].realm);
    shopKey = "";
    save();
    returnFromPlacement(returnTo);
    sound("buy");
    purchaseReceipt(result.text, result.cost);
    return;
  }
  if (kind === "guidance-unlock") {
    shopKey = "";
    save();
    returnFromPlacement(returnTo);
    sound("buy");
    purchaseReceipt(GUIDANCE_ITEMS.find(i=>i.id===guidanceId).name + " · 已解锁", result.cost);
    return;
  }
  if (kind === "share-unlock") {
    save();
    returnFromPlacement(returnTo);
    sound("buy");
    toast("分享组件已解锁 · 右上角可以找到它");
    if (ending) showStats(true);
    return;
  }
  if (kind.startsWith("studio-")) {
    studioSelected = key;
    applyCosmetics();
    world?.sync(state);
    sound("place");
    purchaseReceipt(
      `${studioSpec(key).name} · ${kind === "studio-move" ? "位置已保存" : "已安放"}`,
      kind === 'studio-move' ? 0 : result.cost,
    );
    save();
    returnFromPlacement(returnTo);
    previewBuiltCamera(site, kind, id, key);
    return;
  }
  if (kind === "move") {
    sound('place');
    toast(previousPlacement?.x===site.x&&previousPlacement?.z===site.z?'朝向已调整':'搬到新位置了');
    world?.sync(state);
    returnFromPlacement(returnTo);
  } else {
    returnFromPlacement(returnTo);
    afterPurchase(ITEMS[id], result);
  }
  if (page !== "live" && ["build", "move", "expand"].includes(kind))
    previewBuiltCamera(site, kind, id, key);
}
$("#placement-confirm").onclick = () => confirmPurchase();
function closePanel() {
  stopHold();
  panelSet(null);
  paint();
}
// Toggle only explicit menu gestures. In-game links keep go() idempotent.
function toggleMenu(which) {
  const current = page === "world" ? (panel === "owned" ? "build" : panel) : null;
  if (current === which) closePanel();
  else go(which);
}
$("#panel-close").onclick = closePanel;
$$("[data-nav]").forEach((b) => (b.onclick = () => toggleMenu(b.dataset.nav)));
$("#home-view").onclick = () => {
  if (!mobileCamera.overview()) world?.home();
  paint();
};
function focusItemCamera(id) {
  const shot = world?.itemCamera(id);
  if (shot) {
    mobileCamera.preview(shot.point, shot.size);
    paint();
  }
}
function previewSiteCamera(site, kind, id, key) {
  if (!site) return;
  const expanding = ["expand","land-store"].includes(kind),
    spec = kind?.startsWith("studio-") ? studioSpec(key) : footprint(id,site);
  mobileCamera.preview(
    {
      x: site.x * (expanding ? 5 : 1),
      y: spec?.y || 0,
      z: site.z * (expanding ? 5 : 1),
    },
    expanding ? 5 : Math.max(spec?.w || 1, spec?.d || 1),
  );
  paint();
}
function previewPlacementCamera() {
  if (placement)
    previewSiteCamera(
      placement.site,
      placement.kind,
      placement.id,
      placement.key,
    );
}
function previewBuiltCamera(site, kind, id, key) {
  if (!site) return;
  if (site.realm) state.realm = site.realm;
  paint(true);
  previewSiteCamera(site, kind, id, key);
}
const familyTabs = () =>
  `<div class="family-tabs" role="tablist" aria-label="${panel === "atlas" ? "图鉴分类" : "商城分类"}"><button data-family="all" role="tab" aria-selected="${family === "all"}">全部</button>${Object.entries(
    FAMILIES,
  )
    .filter(
      ([k]) =>
        panel === "atlas" ||
        {
          T: true,
          V: n(state, "T1"),
          M: n(state, "T7"),
          L: false,
          N: n(state, "N1"),
          E: n(state, "E1"),
          X: false,
          Z: n(state, "E9"),
        }[k],
    )
    .map(
      ([k, v]) =>
        `<button data-family="${k}" role="tab" aria-selected="${family === k}">${v.short}</button>`,
    )
    .join(
      "",
    )}${panel !== "atlas" ? `<button data-family="features" role="tab" aria-selected="${family === "features"}">特性</button>` : ""}</div>`;
function constructionTabs() {
  const upgradable=ownedGroups(state,ownedCatalog(state)).upgradable.length;
  const label=`已购买${upgradable ? `，${upgradable} 处可升级或改造` : ''}`;
  return `<nav class="construction-tabs" aria-label="商城页签">${n(state, "T1") ? '<button data-expand-land aria-label="扩展土地，选择大陆边缘">扩地 +</button>' : ""}<button data-open="build" aria-selected="${panel === "build"}">发现</button><button data-open="owned" aria-selected="${panel === "owned"}" aria-label="${label}" title="${label}">已购买${upgradable ? ` <small class="shop-upgrade-count">可升级 ${upgradable}</small>` : ''}</button></nav>`;
}
const developmentGuide=createDevelopmentGuide();
let shopOrder='progress';
try { if(localStorage.getItem('mc-clicker-shop-order')==='price')shopOrder='price'; } catch {}
const shopOrderControl=()=>`<div class="shop-order"><select id="shop-order" aria-label="商品排序"><option value="progress" ${shopOrder==='progress'?'selected':''}>按进度</option><option value="price" ${shopOrder==='price'?'selected':''}>按价格</option></select></div>`;
function shoppingRow(row) {
 if(row.kind==='purchase')return openingProduct(row.item,shopOrder==='progress'&&developmentGuide(state)?.id===row.id);
 const label=row.kind==='mod'?row.name:row.kind==='postal'?'邮政升级':`${row.item.name}升级`;
 const action=row.kind==='postal'?'data-open-postal':row.kind==='mod'?`data-shop-mod="${row.mod}" data-shop-owner="${row.id}"`:`data-detail="${row.id}"`;
 return `<article class="opening-product" data-shopping-upgrade="${row.id}" data-shopping-cost="${row.cost}"><button class="opening-name" ${action}><span class="opening-icon">${art(row.item)}</span><span><h3>${label}</h3><small>${row.kind==='mod'?row.item.name+' · 改造':'已有设施 · 升级'}</small></span></button><button class="buy opening-buy" ${action} aria-label="查看${label}，${formatWallet(row.cost)}绿宝石">${formatWallet(row.cost)} <span class="mini-emerald"></span> ${icon('arrow',14)}</button></article>`;
}
function recruitmentEntry() {
  if(!n(state,'V2') || !['all','V'].includes(family))return '';
  const i=ITEMS.V2,status=purchaseStatus(state,i,placement);
  return `<article class="resident-shop-row" data-card="V2"><button class="opening-name" data-detail="V2"><span class="opening-icon">${art(i)}</span><span><h3>村民</h3><small>已邀请 ${n(state,'V2')} 位</small></span></button><button class="buy opening-buy" data-buy="V2" data-purchase-state="${status.kind}" aria-label="邀请村民">${buttonContent(status)}</button><p class="purchase-reason" data-purchase-reason ${status.reason?'':'hidden'}>${status.reason}</p></article>`;
}
function shopToolbar() {
  return `<div class="shop-toolbar">${shopOrderControl()}</div>`;
}
function openingProduct(i,recommended=false) {
  const status=purchaseStatus(state,i,placement);
  return `<article class="opening-product" data-card="${i.id}"><button class="opening-name" data-detail="${i.id}"><span class="opening-icon">${art(i)}</span><span><h3>${i.name}</h3>${recommended ? '<small class="shop-recommend-label">推荐</small>' : ''}</span></button><button class="buy opening-buy" data-buy="${i.id}" data-purchase-state="${status.kind}">${buttonContent(status)}</button><p class="opening-effect">${itemSummary(state,i).effect}</p><p class="purchase-reason" data-purchase-reason ${status.reason?'':'hidden'}>${status.reason}</p></article>`;
}
function openDevelopment(step) {
  if(!step)return;
  if(step.kind==='feature')startGuidanceUnlock(step.id);
  else if(step.kind==='research'){openItem('V11',true);$(`[data-research-row="${step.research}"]`)?.scrollIntoView({block:'nearest'});}
  else if(step.kind==='job')management.workplace(step.job);
  else if(step.kind==='power'){management.power();go('network');}
  else openItem(step.id,true);
}
function developmentSuggestion(step) {
  if(step?.kind==='feature')return guidanceUI.card(step.id,{compact:true,recommended:true});
  if(!step || step.kind==='purchase')return '';
  const label=step.kind==='purchase'?`升级${step.label}`:step.label;
  const description=step.kind==='purchase'?nextFacilityUnlock(state,step.id):step.description;
  return `<div class="opening-product development-suggestion"><button class="opening-name" data-development aria-label="${label}"><span class="opening-icon">${art(ITEMS[step.id])}</span><span><h3>${label}</h3><small class="shop-recommend-label">推荐</small></span></button><button class="facility-icon" data-development aria-label="${label}" title="${label}">${icon('arrow',18)}</button>${description?`<p class="opening-effect">${description}</p>`:''}</div>`;
}
function ownedSection(items, title, note) {
  if(!items.length&&!title.includes('可升级'))return ''; 
  if(title.includes('可升级')){
    const offers=shoppingUpgrades(state,family,{all:true});
    const allowed=new Set(items.map(i=>i.id)),rows=offers.filter(r=>allowed.has(r.id));
    const shown=new Set(rows.map(r=>r.id));
    const rest=items.filter(i=>!shown.has(i.id));
    return `<section class="owned-section"><h4>${title} <small>${rows.length+rest.length}</small></h4>${rows.map(shoppingRow).join('')}${rest.map(i=>card(i)).join('')}${!items.length?'<p class="empty-note">当前没有待升级或改造的设施。</p>':''}</section>`;
  }
  return `<section class="owned-section"><h4>${title} <small>${items.length}</small></h4>${note ? `<p class="panel-note">${note}</p>` : ""}${items.length ? items.map((i) => card(i)).join("") : `<p class="empty-note">${title.includes('可升级')?'当前没有待升级或改造的设施。':'这里还没有设施。'}</p>`}</section>`;
}
function facilityShop(host) {
  let html = host === "V3" ? sharingOffer() : "";
  if (host === "V4")
    html = `<section class="crop-shop"><h4>种在这片田里</h4><p class="panel-note">切换后重新生长；人口支持不变。农田升级增加作物密度、灌溉管道与棚架。</p>${CROPS.map((c) => `<button data-crop="${c.id}" class="crop-choice ${state.crops.selected === c.id ? "active" : ""}"><span class="crop-art crop-${c.id}" style="--crop:${c.color}"><i></i><b></b></span><span><strong>${c.name}</strong><small>${Math.round(c.seconds * (n(state, "V5") ? 0.7 : 1) * upgradeMultiplier(state, "V4", "growthPeriod"))} 秒 · 收获后运往集市</small></span><b>${state.crops.selected === c.id ? "生长中" : state.crops.owned[c.id] ? "种植" : formatWallet(c.cost) + " ◆"}</b></button>`).join("")}</section>`;
  const related = CATALOG.filter((i) => ownerOf(i.id) === host),
    list = host === "L2" ? broadcastShopItems(state, related) : related,
    available = list
      .filter((i) => !n(state, i.id) && unlocked(state, i)),
    soon = list
      .filter((i) => !n(state, i.id) && !unlocked(state, i))
      .sort(
        (a, b) => requirements(state, a).length - requirements(state, b).length,
      )
      .slice(0, 2),
    owned = list.filter((i) => n(state, i.id));
  if (list.length)
    html += `<section class="facility-shop"><h4>${host === "L2" ? "频道设备" : "设施内购买"}</h4>${available.map((i) => card(i)).join("")}${soon.length ? '<p class="list-label">下一步可以解锁</p>' + soon.map((i) => card(i)).join("") : ""}${owned.length ? "<h4>已经投入使用</h4>" + owned.map((i) => card(i)).join("") : ""}</section>`;
  const nearby = relatedFacilities(host).map((id) => ITEMS[id]);
  if (nearby.length)
    html += `<section class="facility-shop"><h4>相关户外设施</h4><p class="panel-note">独立占地，确认位置后再建造。</p>${nearby.map(card).join("")}</section>`;
  html +=
    (host === "V3" || host === "N2" ? orderPanel(state) : "") +
    upgradesUI.render(host);
  return html;
}
function card(i, atlas = false) {
  if(facilityStored(state,i.id))return `<article class="opening-product" data-card="${i.id}"><button class="opening-name" data-detail="${i.id}"><span class="opening-icon">${art(i)}</span><span><h3>${i.name}</h3><small>Lv.${n(state,i.id)} · 已收纳</small></span></button><button class="buy opening-buy" data-buy="${i.id}">${icon('box',16)} 免费摆回</button></article>`;
  const missing = requirements(state, i),
    owned = n(state, i.id),
    cost = price(state, i),
    locked = missing.length > 0,
    offer = panel === 'owned' ? ownedUpgrade(state, i) : null;
  if(i.id==='V18'&&owned&&panel==='owned')return `<article class="opening-product" data-card="V18"><button class="opening-name" data-detail="V18"><span class="opening-icon">${art(i)}</span><span><h3>邮箱</h3><small class="shop-recommend-label">邮政 Lv.${postalLevel(state)}</small></span></button><button class="${offer?'buy opening-buy':'facility-icon'}" data-open-postal aria-label="管理邮政升级${offer?'，'+formatWallet(offer.cost)+'绿宝石':''}" title="管理邮政升级">${offer?formatWallet(offer.cost)+' <span class="mini-emerald"></span> ':''}${icon('gear',18)}</button><p class="opening-effect">邮政收入 +${postalRate(state)} / 秒${postalUpgradeCost(state)!==null?' · 可升级':' · 已满级'}</p></article>`;
  if (i.id === "Z2" && owned)
    return `<article class="build-card owned" data-card="Z2"><button class="card-main" data-detail="Z2"><div class="item-art" style="--tint:${FAMILIES.Z.color}">${art(i)}</div><div><small>创造工程 · 三维度共同施工</small><h3>世界工程</h3><p data-engineering-card></p></div></button><div class="card-bottom"><span>一次立项 · 交付后自动建成三层</span><button data-detail="Z2">查看施工 →</button></div></article>`;
  const status = purchaseStatus(state, i, placement),
    modification = offer?.kind === 'mod',
    complete = status.kind === "complete";
  return `<article class="build-card ${locked ? "locked" : ""} ${owned ? "owned" : ""}" data-card="${i.id}" data-recommended="${earlyTarget(state)===i.id}" data-purchase-state="${status.kind}" style="--price-width:${formatWallet(cost).length > 8 ? 106 : 88}px"><button class="card-main" data-detail="${i.id}"><div class="item-art" style="--tint:${FAMILIES[i.family].color}">${art(i)}</div><div><small>${FAMILIES[i.family].name}${owned ? " · " + (facilityUpgrades(i.id).length ? facilityLevelLabel(state,i.id) : i.id==='V1'?owned+" 片土地":owned + " 级") : ""}</small><h3 data-level="${owned && i.id!=='V1' && !facilityUpgrades(i.id).length ? `Lv.${owned}` : ""}">${i.name}</h3><p class="item-effect">${itemSummary(state,i).effect}</p>${owned && nextFacilityUnlock(state,i.id) ? `<p class="item-next">${nextFacilityUnlock(state,i.id)}</p>` : ""}${itemSummary(state,i).next ? `<p class="item-next">后续：${itemSummary(state,i).next}</p>` : ""}</div></button><p class="purchase-reason" data-purchase-reason ${status.reason ? "" : "hidden"}>${status.reason}</p>${owned && !(panel === "item" && selected === i.id) ? facilityStatusMarkup(state, i.id) : ""}<div class="card-bottom"><span data-compact="${i.place ? `${footprint(i.id).w} × ${footprint(i.id).d} 格` : ""}">${owned ? (i.id==='V1'?'扩展土地':modification?'可改造':complete ? "" : i.id==='V2'?'招募村民':"可升级") : i.place ? footprint(i.id).w + " × " + footprint(i.id).d + " 方块空间" : i.model === "actor" ? "一位新的伙伴" : "购买后即可使用"}</span>${modification ? `<button class="buy" data-detail="${i.id}" aria-label="查看${i.name}改造，${formatWallet(offer.cost)}绿宝石起">${offer.locked?icon('lock',14):''}${formatWallet(offer.cost)} <span class="mini-emerald"></span> 改造 ${icon('arrow',14)}</button>` : complete ? `<strong class="complete-badge">${buttonContent(status)}</strong>` : `<button class="buy" data-buy="${i.id}" data-purchase-state="${status.kind}">${buttonContent(status)}</button>`}</div></article>`;
}
function renderPanel(report = rates(state)) {
  if (!panel) return;
  if (panel === "atlas" && family === "features") family = "all";
  const development=['build','owned'].includes(panel)?developmentGuide(state,report):null;
  // World milestones must not replace a letter while the player is reading.
  // Mail navigation owns its DOM; the HUD refreshes only amounts and controls.
  const key =
    panel === "mail"
      ? `mail:${!!n(state, "V18")}`
      : JSON.stringify([
          panel,
          development?.key,
          panel === "village" && !management.marketOpen ? state.community?.revision : null,
          ["village", "network"].includes(panel) ? state.grid?.revision : null,
          management.key(),
          family,
          panel === "atlas" ? [atlasTab,achievementGroup,achievementPending] : null,
          shopOrder,
          state.facilityStorage,
          selected,
          state.counts,
          state.research?.completed, state.research?.milestones,
          state.research?.active, Object.keys(state.research?.projects||{}), state.life?.sites?.map(p=>[p.id,p.type,p.x,p.z,p.rotation,p.stored]), state.life?.welfare, state.life?.serviceMode,
          state.upgrades?.revision,
          ['build','owned'].includes(panel)?state.mail?.postalLevel:null,
          state.garden?.revision,state.communityStories?.unlocked.join(','),gardenDiscovered(state),gardenUI.key(),state.housing?.revision,housingUI.key(),
          state.guidance,
          state.sharing,
          state.crops,
          state.scenery,
          panel === "atlas" ? state.webAppearance.owned : null,
          state.environment.modules,
          state.environment.access.pending,
          studioTab,
          studioSelected,
          state.studio?.revision,
          state.realm,
          panel === "atlas" && atlasTab === "achievements" ? null : state.achievements,
          state.jobs,
          state.priority,
          state.beacon,
          state.beaconRealm,
          state.dispatch,
          state.transfer,
          state.emitter,
          state.live.peak >= 100,
          state.live.peak >= 1000,
          state.project >= PROJECT_TARGET,
        ]);
  if (key === shopKey) return;
  shopKey = key;
  const titles = {
    build: ["A LITTLE MORE POSSIBILITY", "商城"],
    item: [
      "A LITTLE PART OF YOUR WORLD",
      selected ? ITEMS[selected].name : "设施",
    ],
    atlas: ["THE BOOK OF POSSIBILITIES", "世界图鉴"],
    village: ["MEET YOUR NEIGHBORS", "村庄"],
    life: ["LIFE IN THE VILLAGE", "村民与生活"],
    network: ["BUILT TO WORK", "工业"],
    live: ["YOUR WORLD, ON AIR", "方块电台"],
    owned: ["ALREADY PART OF YOUR WORLD", "我的设施"],
    mail: ["LETTERS TO YOUR LITTLE WORLD", "邮箱"],
  };
  const [k, t] = titles[panel] || titles.build;
  $("#panel-kicker").textContent = k;
  $("#panel-title").textContent = t;
  const shop=panel==='build'||panel==='owned',start=panel==='build'&&family==='all'&&!firstShopAll?openingShop(state):null;
  $('#panel').dataset.shopOpening=String(!!start);
  $('#shop-wallet').hidden=!shop;
  let html = "";
  if (panel === "build") {
    const {available,soon}=shoppingOptions(state,family,report,development,shopOrder);
    html =
      constructionTabs() +
      familyTabs() + shopToolbar() +
      (family==='all'?developmentSuggestion(development):'') +
      (family === "features" ? guidanceUI.cards("all") : "") +
      `<div class="cards">${available.map(shoppingRow).join('')}${soon.length ? '<p class="list-label">待解锁</p>' + soon.map(i=>openingProduct(i)).join('') : ""}</div><button class="quiet-button" data-open="atlas">查看完整的 ${CATALOG.length} 项蓝图 ${icon("arrow", 15)}</button>`;
    if (family === "features")
      html = constructionTabs() + familyTabs() + guidanceUI.cards("all");
    if(start) {
      const stock=available;
      html=`<section class="opening-store" aria-label="起步商品">${start.captive?`<div class="opening-captive">${captiveNotice()}<span>消息通知被关在这里</span></div>`:''}<div class="opening-stock">${start.features.map(id=>guidanceUI.card(id,{compact:true,recommended:development?.id===id})).join('')}${start.captive?'':stock.map(shoppingRow).join('')}</div><button class="quiet-button" id="first-shop-all">查看全部商品 ${icon('arrow',16)}</button></section>`;
    } else if(openingShop(state)) html=`<button class="quiet-button" id="first-shop-back">← 起步商品</button>`+html;
  } else if (panel === "owned") {
    const groups = ownedGroups(
      state,
      ownedCatalog(state,family),
    );
    html =
      constructionTabs() +
      familyTabs() +
      shopToolbar() + recruitmentEntry() +
      (groups.building.length
        ? ownedSection(
            groups.building,
            "施工中",
            "三维度交付推进工程，无需重复购买。",
          )
        : "") +
      ownedSection(groups.stored, "已收纳", "等级与改造保留 · 免费摆回") +
      ownedSection(groups.upgradable, "可升级 / 改造", "按本次价格从低到高 · 待解锁项在后") +
      (family === "features" ? guidanceUI.cards("owned") : "") +
      ownedSection(groups.complete, "已完成", "") + (state.environment.access.pending ? `<button class="feature-discovery" data-detail="V19">观象台 · 待选址 →</button>` : "");
    if (family === "features")
      html = constructionTabs() + familyTabs() + guidanceUI.cards("owned");
  } else if (panel === "item") {
    const i = ITEMS[selected],
      owned = n(state, i.id),
      region = rates(state).regions[i.realm];
    const children = CATALOG.filter((x) => x.deps.includes(i.id));
    html = `${i.id === "X1" ? developmentRoute(state) : ""}${itemToolbar(i)}<div class="item-hero" style="--tint:${FAMILIES[i.family].color}">${art(i)}<span>${FAMILIES[i.family].name} · ${i.place ? REALMS[i.realm].name : "所有区域"}</span></div>${owned ? `<div class="detail-stats"><div><small>已有</small><strong>${facilityUpgrades(i.id).length ? facilityLevelLabel(state,i.id) : `${owned}${i.id==='V1'?' 片土地':i.model === "actor" ? " 位" : " 级"}`}</strong></div><div><small>${i.family === "L" ? "历史最高观众" : "区域供电"}</small><strong>${i.family === "L" ? format(state.live.peak) : Math.round(region.power * 100) + "%"}</strong></div></div>` : ""}${card(i)}${purchaseStatus(state, i).kind === "locked" ? `<div class="requirement-links" aria-label="前往缺少的条件">${requirementLinks(purchaseStatus(state, i))}</div>` : ""}<div class="object-actions">${objectActions(i.id)}</div>${owned ? facilityShop(i.id) : ""}${children.length ? `<h4>解锁项目</h4><div class="dependency-list">${children.map((c) => `<button data-detail="${c.id}"><span>${icon(symbols[c.family], 17)} ${c.name}</span><small>${n(state, c.id) ? "已拥有" : requirements(state, c).length ? "待解锁" : "可建造"}</small></button>`).join("")}</div>` : ""}${i.deps.length ? `<h4>前置条件</h4><div class="dependency-list">${i.deps.map((id) => `<button data-detail="${id}">${ITEMS[id].name}<small>${n(state, id) ? "已完成" : "去看看"}</small></button>`).join("")}</div>` : ""}`;

    if(i.id === "V19" && environmentAccess(state)) html=`${itemToolbar(i)}${observatoryUI.markup()}`;
    if(i.id === "V11" && owned) html=`${itemToolbar(i)}${lifeUI.researchMarkup()}<h4 class="life-secondary-heading">培训与改造</h4>${facilityShop(i.id)}`;
    if(['V21','V22','V23','V25'].includes(i.id)&&owned) html=`${itemToolbar(i)}${lifeUI.facilityMarkup(i.id)}`;
    if(i.id === "V20" && owned) html=`${itemToolbar(i)}${gardenUI.markup()}`;
    if (i.id === "Z2" && owned)
      html = `${itemToolbar(i)}${projectMarkup()}`;
    if(facilityStored(state,i.id))html=`${itemToolbar(i)}${card(i)}${facilityStatusMarkup(state,i.id)}<p class="panel-note">已购等级、改造和接电设置都保留。摆回后恢复工作，不再收费。</p>`;
  } else if (panel === "atlas") {
    html = atlasMarkup(state, {tab:atlasTab, achievementGroup, achievementPending, family, families:familyTabs(), features:atlasTab==='features'?guidanceUI.cards("all"):'', symbols});
  } else if (panel === "mail") html = mailUI.render();
  else if (panel === "life") html = `<button class="life-back" data-open="village">← 村庄</button>`+lifeUI.lifeMarkup();
  else if (panel === "village") html = buildingManagementToolbar()+management.village();
  else if (panel === "network")
    html = buildingManagementToolbar(true)+management.industry(
      networkPanel(), networkPanel(true) + dimensionNetworkMarkup(state) + orderPanel(state),
    );
  else if (panel === "live") html = studioPanel();
  panelMemory.capture($("#panel-content"));
  $("#panel-content").toggleAttribute('data-item-view', panel === 'item');
  $("#panel-content").innerHTML = html;
  panelMemory.restore($("#panel-content"), JSON.stringify([panel, family, panel === "atlas" ? atlasTab : null, panel === "item" ? selected : null, ["village", "network"].includes(panel) ? management.key() : null, panel === "live" ? [studioTab, studioSelected] : null]));
  management.bind($("#panel-content"));
  productionGuide.bind($("#panel-content"));
  lifeUI.bind($("#panel-content"));
  for(const b of document.querySelectorAll('[data-farm-harvest]'))b.onclick=()=>{const r=requestFarmHarvest(state,b.dataset.farmHarvest);if(!r.ok)toast(r.reason);save();paint();};
  for(const b of document.querySelectorAll('[data-farm-staff]'))b.onclick=()=>management.workplace(b.dataset.farmStaff);
  guidanceUI.bind($("#panel-content"));
  observatoryUI.bind($("#panel-content"));
  document.querySelectorAll("[data-housing-open]").forEach(b=>b.onclick=()=>openHousing());
  gardenUI.bind($("#panel-content"));
  $("[data-garden-toggle]")?.addEventListener("click",()=>{setExtraEnabled(state,"garden",!extraEnabled(state,"garden"));save();shopKey="";paint(true)});
  upgradesUI.bind($("#panel-content"));
  if (panel === "mail") mailUI.bind($("#panel-content"));
  bindStudioPanel();
  $('#shop-order')?.addEventListener('change',e=>{
    shopOrder=e.target.value==='price'?'price':'progress';
    try { localStorage.setItem('mc-clicker-shop-order',shopOrder); } catch {}
    shopKey='';paint(true);
  });
  $$('[data-shop-mod]').forEach(b=>b.onclick=()=>{
    openItem(b.dataset.shopOwner,true);
    const row=$(`[data-mod-card="${b.dataset.shopMod}"]`);
    if(row){const details=row.closest('details');if(details)details.open=true;if(row.dataset.expanded!=='true')row.querySelector('[data-mod-select]')?.click();row.scrollIntoView({block:'center'});}
  });
  $$('[data-development]').forEach(b=>b.onclick=()=>openDevelopment(development));
  $$("[data-unlock-sharing]").forEach(
    (b) => (b.onclick = () => startSharingUnlock()),
  );
  $$("[data-open-share]").forEach((b) => (b.onclick = () => showStats()));
  $$("[data-open-mail]").forEach((b) => (b.onclick = openMailbox));
  $$('[data-open-postal]').forEach(b=>b.onclick=()=>openMailbox('postal'));
  $$("[data-enter-studio]").forEach((b) => (b.onclick = () => enterStudio()));
  $$('[data-power-hub]').forEach(b=>b.onclick=()=>{management.power();go('network');});
  $$("[data-project-improve]").forEach(
    (b) =>
      (b.onclick = () => {
        if (b.dataset.projectImprove === "power") {
          management.power();
          go("network");
        } else openItem(b.dataset.projectImprove);
      }),
  );
  $$("[data-engineering-logistics]").forEach(
    (b) =>
      (b.onclick = () => {
        management.logistics();
        go("network");
      }),
  );
  $$("[data-engineering-ending]").forEach(
    (b) => (b.onclick = () => openItem("Z3")),
  );
  refreshProject($("#panel-content"), state, rates(state), isForeground());
  if ($("[data-expand-land]"))
    $("[data-expand-land]").onclick = () => go("expand");
  const selectAtlasTab = id => {
    if (!ATLAS_TABS.some(([key])=>key===id)) return;
    atlasTab=id; shopKey=""; renderPanel();
    $(`[data-atlas-tab="${id}"]`)?.focus({preventScroll:true});
  };
  $$('[data-achievement-buildings]').forEach(b=>b.onclick=()=>selectAtlasTab('buildings'));
  $$("[data-atlas-tab]").forEach(b=>{
    b.onclick=()=>selectAtlasTab(b.dataset.atlasTab);
    b.onkeydown=e=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
      e.preventDefault();const at=ATLAS_TABS.findIndex(([id])=>id===atlasTab);
      selectAtlasTab(ATLAS_TABS[e.key==='Home'?0:e.key==='End'?ATLAS_TABS.length-1:(at+(e.key==='ArrowRight'?1:-1)+ATLAS_TABS.length)%ATLAS_TABS.length][0]);
    };
  });
  $$('[data-achievement-group]').forEach(b=>b.onclick=()=>{
    if(!ACHIEVEMENT_GROUPS.some(([id])=>id===b.dataset.achievementGroup))return;
    achievementGroup=b.dataset.achievementGroup;shopKey='';renderPanel();
    $(`[data-achievement-group="${achievementGroup}"]`)?.focus({preventScroll:true});
  });
  const pendingFilter=$('[data-achievement-pending]');if(pendingFilter)pendingFilter.onchange=()=>{
    achievementPending=pendingFilter.checked;shopKey='';renderPanel();$('[data-achievement-pending]')?.focus({preventScroll:true});
  };
  $$("[data-family]").forEach(
    (b) =>
      (b.onclick = () => {
        family = b.dataset.family;
        shopKey = "";
        renderPanel();
      }),
  );
  $$("[data-buy]").forEach((b) => (b.onclick = () => purchase(b.dataset.buy)));
  $$("[data-detail]").forEach(
    (b) => (b.onclick = () => openItem(b.dataset.detail, true)),
  );
  $$('[data-recruit-open]').forEach(b => b.onclick = () => {
    management.recruit();
    $('#panel-content').scrollTop = 0;
    $('[data-equipment-buy="V2"]')?.focus({preventScroll:true});
  });
  $$("[data-prerequisite]").forEach(
    (b) => (b.onclick = () => openItem(b.dataset.prerequisite, true)),
  );
  $$("[data-open]").forEach(
    (b) =>
      (b.onclick = () =>
        b.dataset.open === "atlas" && !n(state, "X1")
          ? openItem("X1")
          : panelSet(b.dataset.open)),
  );
  $$('[data-building-details]').forEach(b=>b.onclick=()=>openItem(b.dataset.buildingDetails,true));
  $$('[data-building-arrange]').forEach(b=>b.onclick=()=>startBuildingArrange());
  $$('[data-facility-store]').forEach(b=>b.onclick=()=>confirmStorage('facility',b.dataset.facilityStore));
  $$('[data-facility-replace]').forEach(b=>b.onclick=()=>startPlacement(b.dataset.facilityReplace));
  $$("[data-focus-item]").forEach(b => b.onclick = () => focusItemCamera(b.dataset.focusItem));
  $$("[data-move]").forEach(
    (b) => (b.onclick = () => startPlacement(b.dataset.move, true)),
  );
  $$("[data-action]").forEach(
    (b) => (b.onclick = () => doAction(b.dataset.action)),
  );
  $$("[data-hold]").forEach((b) => bindHold(b, b.dataset.hold));
  $$("[data-option]").forEach(
    (el) =>
      (el.onchange = () => {
        if (setOption(state, el.dataset.option, el.value)) {
          shopKey = "";
          save();
          paint(true);
        }
      }),
  );
  $$("[data-topic]").forEach(
    (b) =>
      (b.onclick = () => {
        state.live.topic = b.dataset.topic;
        shopKey = "";
        save();
        paint(true);
      }),
  );
  $$("[data-camera]").forEach(
    (b) =>
      (b.onclick = () => {
        const camera = cameras(state).find((c) => c.id === b.dataset.camera);
        if (!camera) return;
        state.live.camera = camera.realm;
        state.live.shot = camera.id;
        state.live.program = camera.name;
        state.live.director = false;
        shopKey = "";
        save();
        paint(true);
      }),
  );
  if ($("#director-toggle"))
    $("#director-toggle").onclick = () => {
      state.live.director = !state.live.director;
      shopKey = "";
      save();
      paint(true);
    };
  if ($("[data-end-eye]")) {
    const b = $("[data-end-eye]");
    let inserting = false;
    b.onpointerdown = (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      stopHold();
      inserting = state.endEyes < 12;
      if (!inserting) return;
      doAction("end-eye");
      holdInterval = setInterval(() => doAction("end-eye"), 160);
    };
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
      b.addEventListener(event, stopHold);
    b.onclick = (e) => {
      if (!e.detail) doAction(state.endEyes === 12 ? "enter-end" : "end-eye");
      else if (!inserting && state.endEyes === 12) doAction("enter-end");
    };
  }
  for (const b of $$("[data-crop]"))
    b.onclick = () => {
      const id = b.dataset.crop;
      if (!state.crops.owned[id] && !buyCrop(state, id)) {
        toast("绿宝石还不够");
        return;
      }
      selectCrop(state, id);
      shopKey = "";
      save();
      paint(true);
      toast(currentCrop(state).name + " · 开始生长");
    };
  if ($("[data-item-back]"))
    $("[data-item-back]").onclick = () => {
      family = itemReturn.family;
      mobileCamera.overview();
      panelSet(itemReturn.panel);
      $("#panel-content").scrollTop = itemReturn.scroll || 0;
    };
  if ($("#edit-cosmetics")) $("#edit-cosmetics").onclick = showCosmetics;
  if ($("#studio-decor"))
    $("#studio-decor").onclick = () => openStudioPanel("decor");
}
function itemToolbar(i) {
  const back = { owned: "已购买", atlas: "图鉴", village: "村庄", network: "工业", life: "全村生活" }[itemReturn.panel] || "商城";
  const placed = !!state.placements[i.id];
  return `<div class="item-toolbar"><button class="quiet-button item-back" data-item-back>← 返回${back}</button><div>${placed ? iconButton('locate', `定位${i.name}`, `data-focus-item="${i.id}"`) + iconButton('wrench', `调整${i.name}位置`, `data-move="${i.id}"`) + (STORABLE_FACILITIES.has(i.id)?iconButton('box',`收纳${i.name}`,`data-facility-store="${i.id}"`):'') : ''}</div></div>`;
}
function objectActions(id) {
  if(facilityStored(state,id))return `<p class="panel-note">已收纳，暂停工作。等级与改造保留，原接电设置在摆回后继续使用。</p><button class="primary" data-facility-replace="${id}">${icon('box',18)} 免费摆回</button>`;
  if (id === 'M4' && n(state,id)) return `<button class="primary" data-engineering-logistics>打开物流调度</button>${facilityStatusMarkup(state,id)}${connectionControls(state,id)}`;
  if (id === 'M5' && n(state,id)) return `<button class="primary" data-power-hub>打开红石控制台</button><button data-hold="crank">按住手摇发电</button>`;
  if(id==="X7"&&n(state,id))return `<button class="primary" data-garden-toggle>${extraEnabled(state,"garden")?"收起园林装饰":"展示园林装饰"}</button>`;
  if (id === "V19" && environmentAccess(state)) return observatoryUI.markup();
  if (id === "L1" && n(state, id)) return recordsUI.markup() + `<h4>村庄演出</h4>${facilityStatusMarkup(state, id)}${connectionControls(state,id)}<button class="primary" data-action="music">开始演出</button><button data-open="village">安排乐师 →</button>`;
  if (id === "V18" && n(state, id))
    return `<button class="primary" data-open-mail>${icon("mail", 20)} 查看来信 · ${mailSummary(state).unread} 封未读</button>`;
  if(id === "Z1" && n(state,id))return `<div class="facility-control-panel">${commandControls()}</div>`;
  if(id === "N10" && n(state,id))return `${facilityStatusMarkup(state,id)}${connectionControls(state,id)}<div class="facility-control-panel">${beaconControls()}</div>`;
  if(FARM_TYPES[id]&&n(state,id))return farmSitesMarkup(state,id)+management.hauling(id);
  const task = Object.keys(TASKS).find((key) => key!=='milk'&&TASKS[key].id === id);
  if (task && n(state, id))
    return `${facilityStatusMarkup(state, id)}${connectionControls(state,id)}<button class="primary" data-action="${task}">开始${TASKS[task].name}</button><button data-open="${id === "M20" ? "network" : "village"}">进入${id === "M20" ? "工业" : "村庄"}管理 →</button>${management.hauling(id)}`;
  const map = {
    V4: ["farm", "长按收" + currentCrop(state).name],
    V9: ["wool", "长按剪羊毛"],
    V10: ["treasure", "长按挖宝藏"],
    E4: ["chorus", "长按收紫颂果"],
    M5: ["crank", "按住补充动力"],
    L4: ["host", "长按主持节目"],
  };
  let html = n(state, id) ? facilityStatusMarkup(state, id) : "";
  html += connectionControls(state,id) + management.hauling(id);
  if (id === "E2" && n(state, id))
    html +=
      state.endEyes < 12
        ? '<p class="portal-progress">末影之眼 ' +
          state.endEyes +
          ' / 12 · 随工程提供</p><button class="primary" data-end-eye>点按 / 长按 · 嵌入末影之眼</button>'
        : '<p class="portal-progress">12 / 12 · 星空通道已激活</p><button class="primary" data-end-eye data-action="enter-end">进入末地 →</button>';
  if (n(state, id) && map[id])
    html += `<button class="primary" data-hold="${map[id][0]}">${map[id][1]}</button>`;
  const clickMap = {
    M3: ["piston", "启动／收取活塞"],
    L1: ["music", "开始村庄演出"],
    M20: ["note", "敲一个音符"],
    N6: ["ghast", "加派一趟空运"],
    E10: ["brew", "使用龙息强化"],
    L14: ["festival", "开始世界庆典"],
  };
  if (n(state, id) && clickMap[id])
    html += `<button class="primary" data-action="${clickMap[id][0]}">${clickMap[id][1]}</button>`;
  if (id === "L2" && n(state, id))
    html += "<button data-enter-studio>进入方块电台 →</button>";
  if (id[0] === "X" && id !== "X1" && n(state, id) && hasCosmetics(state))
    html += '<button id="edit-cosmetics">打扮我的世界 →</button>';
  return html;
}
function selectInput(key, label, options, enabled = true) {
  const explanation = (value) => ({
    priority: { balanced: "根据各设备需要分配电力。", production: "缺电时先给采矿和加工设备供电。", logistics: "缺电时先保证货物能运走。", automation: "缺电时先保证自动采集与演出。", lighting: "缺电时先保留灯光。" },
    beacon: { production: "提高选定世界的生产速度。", logistics: "提高选定世界的运输速度。" },
    dispatch: { off: "关闭调度加成，保留手动设置。", supply: "工作耗电减少 20%，不增加储电容量。", clear: "三个世界的运输能力提高 40%，仍需实际货物和路线。", orders: "三个世界的成交能力提高 40%，不会凭空产生货物。", auto: "每 8 秒检查一次积压和工程进度，切换策略，并联动信标。" },
  }[key]?.[value] || (key === "transfer" ? `把其他世界的原料集中送到${REALMS[value]?.name}。` : key === "beaconRealm" ? `信标强化${REALMS[value]?.name}的生产或运输。` : `缺电时优先给${REALMS[value]?.name}供电。`));
  return `<label class="select-row"><span>${label}</span><select data-option="${key}" aria-label="${label}" ${enabled ? "" : "disabled"}>${options.map(([v, name]) => `<option value="${v}" data-description="${escapeHTML(explanation(v))}" ${state[key] === v ? "selected" : ""}>${name}</option>`).join("")}</select></label>`;
}
const commandLabels={off:'未启用',supply:'节能生产',clear:'加快运输',orders:'加快成交'};
function commandStatus(){
 const p=state.commandPlan;
 return commandAuto(state)&&p?`${REALMS[p.realm].name} · ${p.reason} · ${commandLabels[p.mode]}`:commandLabels[dispatchMode(state)];
}
function commandControls(){
 return selectInput('dispatch','命令方块策略',[['off','不启用'],['auto','跨世界自动调度'],['supply','节能生产'],['clear','加快运输'],['orders','加快成交']])+`<p class="panel-note" data-command-status>${commandStatus()}</p><p class="panel-note">自动调度会联动信标，优先照看工程交付落后的世界。运输与成交仍使用现有货物、线路和运力。</p>`;
}
function beaconStatus(){return `${REALMS[beaconTarget(state)].name} · ${beaconMode(state)==='production'?'生产强化':'物流强化'}${commandAuto(state)?' · 命令方块调度中':''}`;}
function beaconControls(){
 const fields=commandAuto(state)?`<button data-detail="Z1">${icon('settings',16)} 到命令方块调整</button>`:selectInput('beaconRealm','信标强化世界',Object.keys(REALMS).filter(k=>accessible(state,k)).map(k=>[k,REALMS[k].name]))+selectInput('beacon','信标模式',[['production','生产强化'],['logistics','物流强化']]);
 return `<p class="panel-note" data-beacon-status>${beaconStatus()}</p>`+fields;
}
function networkPanel(advanced = false) {
  if (!advanced) return '<section class="regional-overview" aria-label="区域生产与积压"><header class="operations-heading"><h3>生产与积压</h3><span>产能 · 份/秒</span></header>' + Object.keys(REALMS).filter(realm=>accessible(state,realm)).map(realm=>`<section class="network-region" data-region-overview="${realm}"><header><strong>${REALMS[realm].name}</strong>${iconButton('locate','定位'+REALMS[realm].name,`data-jump="${realm}"`)}</header><div class="flow-chain">${["采集", "运输", "加工", "交易"].map((label,j)=>`<button data-flow="${realm}-${j}" data-guide-realm="${realm}" data-guide-stage="${["raw","haul","process","trade"][j]}" aria-expanded="false"><b>${label}</b><small></small><em data-guide-signal></em></button>`).join('<i>→</i>')}</div><div class="region-cause"><span data-bottleneck="${realm}"></span><button class="guide-help" data-guide-help="raw" data-guide-realm="${realm}">改善 ${icon('arrow',14)}</button></div><div class="buffer-row"><button data-guide-stage="rawStorage" data-guide-realm="${realm}" aria-label="查看原料仓储改善选项">原料库存 ›</button><i><b data-buffer="${realm}"></b></i><small data-buffer-text="${realm}"></small></div><div class="buffer-row region-goods"><button data-guide-stage="storage" data-guide-realm="${realm}" aria-label="查看成品仓储改善选项">成品待售 ›</button><i><b data-goods-buffer="${realm}"></b></i><small data-goods-text="${realm}"></small></div><div class="region-actuals" aria-label="实际产线"><span>加工入库 <b data-region-processed="${realm}">0</b> 份/秒</span><span>实际售出 <b data-region-sold="${realm}">0</b> 份/秒</span></div>${productionGuide.slot(realm)}</section>`).join('') + '</section>';
  const r = rates(state);
  let html = `<div class="power-summary"><span>${icon("bolt",20)} 发电 / 需求</span><strong data-net-power>${formatWallet(r.supply)} / ${formatWallet(r.demand)} <small>E/秒</small></strong></div>`;
  html += selectInput(
    "priority",
    "供电优先",
    [
      ["balanced", "按需求分配"],
      ["production", "优先生产"],
      ["logistics", "优先运输"],
      ["automation", "优先自动操作"],
      ["lighting", "优先灯光"],
      ...Object.keys(REALMS)
        .filter((k) => accessible(state, k))
        .map((k) => [k, REALMS[k].name]),
    ],
    !!n(state, "M12"),
  );
  if (!n(state, "M12"))
    html += '<p class="panel-note">购买比较器后可调整供电优先级。</p>';
  if (n(state, "N10")) html += beaconControls();
  if (n(state, "E7"))
    html += selectInput(
      "transfer",
      "末影箱送往",
      Object.keys(REALMS)
        .filter((k) => accessible(state, k))
        .map((k) => [k, REALMS[k].name]),
    );
  if (n(state, "Z1")) html += commandControls();
  if (n(state, "Z2")) html += projectMarkup();
  return html;
}
function openStudioPanel(tab) {
  cancelPlacement();
  studioTab = tab;
  studioMonitor = false;
  panelSet("live");
  $("#panel-content").scrollTop = 0;
  paint(true);
}
const studioUI = createStudioUI({
  state: () => state,
  tab: () => studioTab,
  selected: () => studioSelected,
  art,
  card,
  facilityShop,
  records: () => recordsUI.markup(),
  program: () => livePanel(),
  place: startStudioPlacement,
  focus: key => { const e = studioEntities(state).find(e => e.key === key); if (e) { world?.selectStudio(key); previewSiteCamera(e.position, "studio-move", e.id, key); } },
  open: openStudioPanel,
  refresh: () => {
    shopKey = "";
    renderPanel();
  },
  select: (key) => {
    studioSelected = key;
    openStudioPanel("inspect");
    world?.selectStudio(key);
  },
  reset: () => {resetScenery(state,"studio");ensureStudio(state);applyCosmetics();shopKey="";save();paint(true);toast("室内装扮已还原");},
  unequip: (slot) => {
    resetExtra(state, slot);
    ensureStudio(state);
    applyCosmetics();
    shopKey = "";
    save();
    paint(true);
    toast("已卸下 · 收藏还在展示架");
  },
});
function studioPanel() {
  return `<div class="item-toolbar special-building-tools"><span>直播间外景</span><div>${iconButton("locate","定位直播间",'data-studio-building-locate')}${iconButton("wrench","调整直播间位置",'data-studio-building-move')}${iconButton("box","收纳直播间",'data-facility-store="L2"')}</div></div>` + studioUI.render();
}
function bindStudioPanel() {
  if (panel === "live") {
    studioUI.bind();
    $("[data-studio-building-move]").onclick=()=>startPlacement("L2",true);
    $("[data-studio-building-locate]").onclick=()=>{go("world");focusItemCamera("L2");};
  }
  recordsUI.bind($("#panel-content"));
}
$$("[data-room-tab]").forEach(
  (b) => (b.onclick = () => {
    if (panel === "live" && studioTab === b.dataset.roomTab) closePanel();
    else openStudioPanel(b.dataset.roomTab);
  }),
);
$("#room-close-panel").onclick = () => {
  cancelPlacement();
  panelSet(null);
  paint(true);
};
$("#room-rotate-left").onclick = () => world?.rotateView(-Math.PI / 4);
$("#room-rotate-right").onclick = () => world?.rotateView(Math.PI / 4);
$("#room-monitor").onclick = () => {
  studioMonitor = !studioMonitor;
  cancelPlacement();
  paint(true);
};
$("#room-gifts").onclick = () => openStudioPanel("gifts");
function livePanel() {
  const phase=broadcastStage(state), radio=phase.id==='radio';
  if(studioTab==='chat'&&!n(state,'L5'))studioTab='program';
  return broadcastStageMarkup(state) + `<nav class="studio-tabs" aria-label="导播面板">${[
    ["program", "节目"],
    ...(n(state,"L5") ? [["chat", "观众"]] : []),
    ["orders", "订单"],
  ]
    .map(
      ([id, name]) =>
        `<button data-studio-tab="${id}" class="${studioTab === id ? "active" : ""}">${name}</button>`,
    )
    .join(
      "",
    )}</nav><section data-studio-view="program" ${studioTab !== "program" ? "hidden" : ""}><div class="audience"><span id="studio-power-status">直播中</span><strong id="audience-number">${format(state.live.viewers)}</strong><p>${radio ? "正在收听" : "正在观看"} · 峰值 <b id="audience-peak">${format(state.live.peak)}</b></p><div><span>频道收入</span><strong id="live-rate"></strong></div></div><div class="topic-tabs" aria-label="节目方向">${[
    ["pastoral", "田园时光"],
    ["industrial", "工厂实录"],
    ["otherworld", "异界奇遇"],
  ]
    .map(
      ([v, t]) =>
        `<button data-topic="${v}" class="${state.live.topic === v ? "active" : ""}">${t}</button>`,
    )
    .join("")}</div><div ${radio ? "hidden" : ""}><h4>正在拍摄的机位</h4><div class="camera-list">${cameras(
    state,
  )
    .map(
      (c) =>
        `<button data-camera="${c.id}" class="${state.live.shot === c.id ? "active" : ""}"><span class="camera-color ${c.realm}">${art(ITEMS[c.id])}</span><span>${c.name}<small>${REALMS[c.realm].name} · ${c.id === "L2" ? "室内机位" : "专用机位"}</small></span><i></i></button>`,
    )
    .join(
      "",
    )}</div></div>${studioStaffMarkup(state)}${n(state, "L10") ? `<button id="director-toggle" class="director-button ${state.live.director ? "active" : ""}">${icon("spark", 18)} 自动导播 <strong>${state.live.director ? "正在接管" : "已暂停"}</strong></button>` : ''}<div class="live-actions">${n(state, "L4") ? `${facilityStatusMarkup(state, "L4")}<button data-hold="host" class="primary" ${activeHost(state) ? "" : "disabled"}>${activeHost(state) ? "按住 · 开麦主持" : "等待主持人到岗"}</button>` : ""}${n(state, "L5") ? facilityStatusMarkup(state, "L5") + '<button data-action="respond">回应观众</button>' : ""}${n(state, "L14") ? facilityStatusMarkup(state, "L14") + '<button data-action="festival">开启庆典</button>' : ""}</div></section><section data-studio-view="chat" ${studioTab !== "chat" ? "hidden" : ""}><div class="chat-head"><h4>来自观众</h4><span>游戏内模拟频道</span></div><div id="chat"></div></section><section data-studio-view="orders" ${studioTab !== "orders" ? "hidden" : ""}><h4>节目与贸易订单</h4><div id="orders"></div></section>`;
}
$("#panel-content").addEventListener("click", (e) => {
  const technology=e.target.closest("[data-broadcast-research]");
  if(technology){openItem("V11",true);$(`[data-research-row="${technology.dataset.broadcastResearch}"]`)?.scrollIntoView({block:"nearest"});return;}
  const b = e.target.closest("[data-studio-tab]");
  if (!b) return;
  openStudioPanel(b.dataset.studioTab);
});
$("#studio-back").onclick = () => go("world");
$("#panel-world-back").onclick = () => go("world");
function stepCamera(direction) {
  const options = cameras(state),
    at = options.findIndex((c) => c.id === state.live.shot),
    next = options[(at + direction + options.length) % options.length];
  state.live.camera = next.realm;
  state.live.shot = next.id;
  state.live.program = next.name;
  state.live.director = false;
  paint();
  save();
}
$("#studio-prev").onclick = () => stepCamera(-1);
$("#studio-next").onclick = () => stepCamera(1);
bindHold($("#studio-host"), "host");
$("#studio-respond").onclick = () => doAction("respond");
function updateLive() {
  updateGiftLayer();
  if (!n(state, "L2")) return;
  const live = state.live, phase=broadcastStage(state);
  const studioPower = rates(state).electricity,
    onAir = studioPower.perDevice.L2 > 0,
    chatPowered = onAir && studioPower.perDevice.L5 > 0;
  const status = $("#studio-power-status");
  if (status) status.textContent = onAir ? (phase.id==='radio'?"广播中":"直播中") : "等待供电";
  const host = activeHost(state);
  refreshStudioStaff($("#panel-content"), state);
  $("#studio-shot-name").textContent =
    cameras(state).find((c) => c.id === live.shot)?.name || "村庄全景";
  $("#studio-host").hidden = !n(state, "L4");
  $("#studio-host").disabled = !onAir || !host || live.host > 0;
  $("#studio-host").title = host
    ? `${host.name} · ${live.host > 0 ? "主持中" : "开麦主持"}`
    : "到村庄安排主持人，到岗后开启";
  $$("[data-hold='host']").forEach((button) => {
    button.disabled = !onAir || !host || live.host > 0;
    button.textContent = !onAir
      ? "缺电 · 等待供电"
      : !host
        ? "等待主持人到岗"
        : live.host > 0
          ? "主持中"
          : "按住 · 开麦主持";
  });
  $("#studio-respond").hidden = !n(state, "L5");
  $("#studio-respond").disabled = !chatPowered || live.respondCooldown > 0;
  $$("[data-action='respond']").forEach((button) => {
    button.disabled = !chatPowered || live.respondCooldown > 0;
    button.textContent = !chatPowered
      ? "弹幕屏缺电"
      : live.respondCooldown > 0
        ? "准备中"
        : "回应观众";
  });
  $(".studio-heat b").style.width =
    Math.min(100, ((live.heat + (host ? live.hostHeat || 0 : 0)) / 30) * 100) +
    "%";
  $$("[data-camera]").forEach((b) =>
    b.classList.toggle("active", b.dataset.camera === live.shot),
  );
  $$("[data-topic]").forEach((b) => {
    b.classList.toggle("active", b.dataset.topic === live.topic);
    b.hidden = b.dataset.topic === "otherworld" && !n(state, "N1");
  });
  const director = $("#director-toggle");
  if (director) {
    director.classList.toggle(
      "active",
      live.director && studioPower.perDevice.L10 > 0,
    );
    director.querySelector("strong").textContent = live.director
      ? studioPower.perDevice.L10 > 0
        ? "红石自动运行"
        : "缺电 · 等待供电"
      : "已暂停";
  }
  if ($("#audience-number")) {
    $("#audience-number").textContent = format(live.viewers);
    $("#audience-peak").textContent = format(live.peak);
    $("#live-rate").textContent = "+" + formatHudNumber(rates(state).live, true) + "/秒";
    const comments = n(state, "L5")
      ? state.events
          .slice(-4)
          .reverse()
          .map(
            (e, j) =>
              `<p><b>${["方块观察员", "羊毛团子", "红石爱好者", "小村民"][j]}</b>${escapeHTML(e.text)}，这也太忙了！</p>`,
          )
          .join("")
      : '<p class="empty-note">购买弹幕墙后可查看和回应弹幕。</p>';
    if ($("#chat").innerHTML !== comments) $("#chat").innerHTML = comments;
    $("#orders").innerHTML =
      (live.goal
        ? `<div class="order build-goal"><span>打赏目标 · ${ITEMS[live.goal.id].name}</span><strong>${n(state, live.goal.id)} / ${live.goal.required}</strong><small>建成后奖励 ${formatWallet(live.goal.reward)} 绿宝石</small></div>`
        : "") +
      (state.orders.length
        ? state.orders
            .map(
              (o) =>
                `<div class="order"><span>${REALMS[o.realm].name} · ${escapeHTML(o.label || "交货订单")}</span><strong>${format(o.progress)} / ${format(o.target)}</strong><i><b style="width:${Math.min(100, (o.progress / o.target) * 100)}%"></b></i><small>完成奖励 ${formatWallet(o.reward)} 绿宝石</small></div>`,
            )
            .join("")
        : '<p class="empty-note">解锁流浪商人、订阅社群或打赏目标板后可接单。</p>');
  }
  $("#live-program").textContent = live.program;
  $("#live-view-count").textContent =
    format(live.viewers) + " 位" + phase.audience + " · " + REALMS[live.camera].name;
}
let lastGiftReceipt = "";
function updateGiftLayer() {
  const layer = $("#gift-layer"),
    compact =
      page === "live" &&
      !!n(state, "L6") &&
      panel === "live" &&
      (studioTab === "gifts" ||
        (studioTab === "inspect" && studioSelected === "L6")),
    parent = compact ? $("#panel") : $("#stage"),
    queued = compact ? state.live.gifts : [],
    desired = compact ? queued.slice(0, 4) : queued;
  if (layer.parentElement !== parent) {
    if (compact) parent.insertBefore(layer, $("#panel-content"));
    else parent.append(layer);
  }
  layer.classList.toggle("gift-tray", compact);
  let meta = layer.querySelector(".gift-tray-meta"),
    empty = layer.querySelector(".gift-tray-empty");
  if (!meta) {
    meta = document.createElement("div");
    meta.className = "gift-tray-meta";
    meta.innerHTML =
      "<strong data-gift-count></strong><span data-gift-feedback></span>";
    layer.append(meta);
    empty = document.createElement("span");
    empty.className = "gift-tray-empty";
    empty.textContent = "暂无礼物";
    layer.append(empty);
  }
  meta.hidden = !compact;
  empty.hidden = !compact || queued.length > 0;
  if (compact) {
    meta.querySelector("[data-gift-count]").textContent =
      "收礼箱 · " + queued.length + " 待领取";
    meta.querySelector("[data-gift-feedback]").textContent =
      lastGiftReceipt || "点一下 · 滑动扫收";
  }
  const wanted = new Set(desired.map((gift) => gift.id));
  layer.querySelectorAll("[data-gift]").forEach((el) => {
    if (!wanted.has(Number(el.dataset.gift))) el.remove();
  });
  const existing = new Map(
      [...layer.querySelectorAll("[data-gift]")].map((el) => [
        Number(el.dataset.gift),
        el,
      ]),
    ),
    usedSlots = new Set(
      [...existing.values()]
        .map((el) => Number(el.dataset.giftSlot))
        .filter(Number.isFinite),
    );
  for (const gift of desired) {
    let el = existing.get(gift.id);
    if (!el) {
      el = document.createElement("button");
      el.className = "gift" + (gift.expression ? " expression" : "");
      el.dataset.gift = gift.id;
      el.setAttribute(
        "aria-label",
        "收取直播礼物 · " + formatWallet(gift.value) + " 绿宝石",
      );
      el.innerHTML = gift.expression
        ? ["✦", "♡", "!", "♫"][gift.id % 4]
        : '<span class="emerald"></span>';
      const collect = () => {
        if (!isForeground()) return;
        const amount = collectGift(state, gift.id);
        if (amount) {
          if (layer.classList.contains("gift-tray"))
            lastGiftReceipt = "已收 +" + formatWallet(amount) + " ◆";
          else floating(amount);
          sound("harvest");
          el.remove();
          updateGiftLayer();
        }
      };
      // Pointer input is collected below. Its follow-up click must not collect
      // the replacement gift in the same slot; keyboard/assistive clicks remain.
      el.onclick = (e) => {
        if (e.detail === 0) collect();
      };
      el.addEventListener("pointerenter", (e) => {
        if (e.pointerType === "mouse") collect();
      });
      el._collect = collect;
      layer.append(el);
    }
    if (compact) {
      let slot = Number(el.dataset.giftSlot);
      if (!Number.isFinite(slot)) {
        slot = [0, 1, 2, 3].find((index) => !usedSlots.has(index));
        el.dataset.giftSlot = slot;
        usedSlots.add(slot);
      }
      el.style.setProperty("--gift-slot", slot + 1);
      el.style.left = "";
      el.style.top = "";
    } else {
      delete el.dataset.giftSlot;
      el.style.removeProperty("--gift-slot");
      el.style.left = gift.x + "%";
      el.style.top = gift.y + "%";
    }
  }
}

let giftGestureSlots = new Set();
function collectGestureGift(el) {
  if (!el) return;
  const key = el.dataset.giftSlot ?? el.dataset.gift;
  if (giftGestureSlots.has(key)) return;
  giftGestureSlots.add(key);
  el._collect?.();
}
$("#gift-layer").addEventListener("pointerdown", (e) => {
  const gift = e.target.closest("[data-gift]");
  if (gift) {
    e.preventDefault();
    giftGestureSlots = new Set();
    $("#gift-layer").setPointerCapture(e.pointerId);
    collectGestureGift(gift);
  }
});
$("#gift-layer").addEventListener("pointermove", (e) => {
  if (e.pointerType !== "mouse" && e.buttons) {
    e.preventDefault();
    collectGestureGift(
      document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-gift]"),
    );
  }
});
const achievementFeedback = createAchievementFeedback(state);
function paint(force = false) {
  $("#studio-header").hidden = page !== "live";
  $("#studio-console").hidden = page !== "live";
  $("#room-tools").hidden = page !== "live" || !!placement;
  $("#room-camera-tools").hidden = page !== "live";
  $("#room-close-panel").hidden = !panel;
  $("#room-monitor").hidden = broadcastStage(state).id === "radio";
  $("#room-monitor").textContent = studioMonitor ? "回到房间" : "查看节目";
  $("#room-gifts").hidden = !n(state, "L6");
  $("#room-gifts b").textContent = state.live.gifts.length;
  $("#room-gifts").classList.toggle("has-gifts", state.live.gifts.length > 0);
  document.body.classList.toggle(
    "room-monitor",
    page === "live" && studioMonitor,
  );
  document.body.classList.toggle(
    "room-placing",
    page === "live" && !!placement,
  );
  $$("[data-room-tab]").forEach((b) => {
    const active = panel === "live" && studioTab === b.dataset.roomTab;
    b.classList.toggle("active", active);
    b.setAttribute("aria-expanded", String(active));
    b.setAttribute("aria-controls", "panel");
    b.title = active ? "收起" + b.textContent.trim() : b.textContent.trim();
  });
  const visible = features(state);
  const counter=guidanceOwned(state,'counter'), nameplate=guidanceOwned(state,'nameplate') || !!state.webAppearance.equipped.title;
  $('.hud .wallet').hidden=!counter;
  $$('.hud .site-link').forEach(el=>el.hidden=!nameplate);
  document.body.classList.toggle('interface-minimal',!counter && !n(state,'V2') && !n(state,'M5'));
  const shopBalance=$('[data-shop-balance]');if(shopBalance){shopBalance.textContent=formatWallet(state.money);shopBalance.title=exactBalance(state.money)+' 绿宝石';}
  const shopIncome=$('[data-shop-income]');if(shopIncome)shopIncome.textContent=n(state,'V18')?`${formatHudNumber(isForeground()?state.rate:0,true)} /秒`:'';
  if(panel==='build')narrator.captureForShop();
  $("#collection-open").hidden = !shopAvailable(state);
  collectionShop.refresh();
  $$("#unlock-sharing, [data-unlock-sharing]").forEach(
    (b) =>
      (b.disabled =
        shareUnlocked(state) ||
        !shareAvailable(state) ||
        state.money < SHARE_PRICE),
  );
  for (const b of $$("[data-nav]")) b.hidden = !visible[b.dataset.nav];
  for (const [id, key] of [
    ["sound", "sound"],
    ["share-open", "share"],
    ["realm-switch", "realms"],
    ["home-view", "home"],
  ])
    $("#" + id).hidden = !visible[key];
  const r = rates(state);
  if (state.money < displayedMoney || state.reducedMotion)
    displayedMoney = state.money;
  const moneyText = formatHudNumber(displayedMoney);
  if ($("#money").textContent !== moneyText) $("#money").textContent = moneyText;
  $("#money").title = exactBalance(state.money) + " 绿宝石";
  $("#rate").textContent = formatHudNumber(state.rate, true);
  $("#click-value").textContent = "+" + formatHudNumber(r.click, true);
  refreshMiningCombo();
  refreshProject($("#panel-content"), state, r, isForeground());
  $("#population").hidden = !n(state, "V2");
  $("#population").textContent =
    `驻村 ${activeResidents(state).length} / ${Math.max(activeResidents(state).length, r.population)}`;
  $("#power-top").hidden = !n(state, "M5");
  $("[data-hud-energy]").textContent =
    `${formatWallet(state.energy)} / ${formatWallet(r.electricity.capacity)} E`;
  $("#power-top").classList.toggle("warning", r.supply < r.demand);
  $("#power-top small").textContent =
    r.supply < r.demand ? "电力不足 · 查看" : "红石储能 · 查看";
  $("#power-top").onclick = () => {
    management.power();
    go("network");
  };
  const view =
    page === "live"
      ? studioMonitor
        ? state.live.camera
        : "overworld"
      : state.realm;
  $("#game").classList.toggle(
    "dark-world",
    (view === "overworld" &&
      extraEnabled(state, "world-day") &&
      (dayPhase(state) < .25 || dayPhase(state) > .87)) ||
      state.environment.palette === "legacy-sky-2" ||
      view !== "overworld",
  );
  $("#world-name").textContent = !n(state, "V1") ? "第一块" : REALMS[view].name;
  $("#world-subtitle").textContent = !n(state, "V1")
    ? "轻轻一下，世界就开始了。"
    : `${state.chunks[view].length} 片土地 · ${Object.values(state.placements).filter((p) => p.realm === view).length} 处建设`;
  $("#world-label").hidden = page === "live" || !nameplate;
  $("#live-overlay").hidden = page !== "live" || !studioMonitor;
  $("#world-controls").hidden = page === "live" || !!placement || world?.mode?.kind === "garden-edit";
  const missionVisible =
    guidanceOwned(state, "goals") && page !== "live" && !placement;
  $("#mission").hidden = !missionVisible;
  $("#mission").classList.toggle("collapsed", !!state.guidance.collapsed);
  $("#stage").classList.toggle("has-mission", missionVisible);
  $("#stage").classList.toggle("mission-collapsed", !!state.guidance.collapsed);
  $("#mission-content").hidden = !!state.guidance.collapsed;
  $("#mission-toggle").setAttribute(
    "aria-expanded",
    String(!state.guidance.collapsed),
  );
  $("#mission-toggle").setAttribute(
    "aria-label",
    state.guidance.collapsed ? "显示任务提示" : "收起任务提示",
  );

  for(const [id,available] of [['settings',visible.settings],['quick-help',visible.settings],['info-open',visible.info],['share-open',visible.share]]){
    const button=$('#'+id);button.hidden=!available;button.inert=!available||button.hasAttribute('data-companion-arriving');
  }
  $('#hud-more').hidden=!(visible.settings||visible.share||visible.info||visible.sound||visible.cosmetics||nameplate);
  if($('#hud-more').hidden)mobileTools.close();
  $(".gesture-hint").hidden = true;
  const realms = Object.keys(REALMS).filter((k) => accessible(state, k));
  realmPicker.render(realms, state.realm);
  const goal = n(state, "Z2") && state.project < PROJECT_TARGET
    ? {key:'project:Z2',kind:'purchase',id:'Z2',label:ITEMS.Z2.name}
    : developmentGuide(state,r);
  const goalKey = goal?.key || "complete";
  if ($("#mission-link").dataset.goal !== goalKey) {
    $("#mission-link").dataset.goal = goalKey;
    $("#mission-name").textContent = goal?.label || "创造模式";
    $("#mission-icon").innerHTML = goal ? goal.kind==='feature'?icon(goal.icon,24):art(ITEMS[goal.id]) : icon("check", 24);
  }
  $("#mission-link").onclick = () => goal ? openDevelopment(goal) : showStats(true);
  if ($("#interaction-chips").childElementCount)
    $("#interaction-chips").replaceChildren();
  $("#resonance").hidden = !n(state, "T11");
  $("#resonance-label").textContent = state.burst
    ? `世界共振 ×3 · ${Math.ceil(state.burst)}s`
    : `共振 ${state.charge}%`;
  $("#resonance b").style.width =
    (state.burst ? (state.burst / 12) * 100 : state.charge) + "%";
  $$("[data-nav]").forEach((b) => {
    b.classList.toggle(
      "active",
      page === "live"
        ? b.dataset.nav === "live"
        : panel
          ? b.dataset.nav === (panel === "owned" ? "build" : panel === "life" ? "village" : panel)
          : b.dataset.nav === "world",
    );
    b.setAttribute("aria-expanded", String(b.classList.contains("active")));
    b.setAttribute("aria-controls", "panel");
    b.title = (b.classList.contains("active") ? "收起" : "打开") + b.querySelector("span").textContent;
    b.classList.toggle(
      "not-yet",
      (b.dataset.nav === "live" && !n(state, "L2")) ||
        (b.dataset.nav === "network" && !n(state, "M1") && !n(state, "M4") && !n(state, "M5")),
    );
  });
  if (world) {
    world.setStudio(page === "live");
    world.setView(view);
    world.sync(state);
    world.setShot(
      page === "live" ? (studioMonitor ? state.live.shot : "L2") : null,
    );
    if (page === "live" && !studioMonitor) world.selectStudio(studioSelected);
    else if (
      ["confirm", "share-unlock", "facility-upgrade"].includes(
        placement?.kind,
      ) &&
      placement.target
    )
      world.select(placement.target);
    else if (selected && panel === "item") world.select(selected);
    else world.select(null);
  }
  mobileCamera.sync(!!panel);
  const inspecting = mobileCamera.inspecting;
  $("#game").classList.toggle("camera-inspecting", inspecting);
  const home = $("#home-view");
  if (home.dataset.inspecting !== String(inspecting)) {
    home.dataset.inspecting = String(inspecting);
    home.innerHTML = icon("locate", 22);
    home.setAttribute("aria-label", inspecting ? "返回浏览视角" : "回到全景");
  }
  if (inspecting) home.hidden = false;
  syncInformation();
  renderPanel(r);
  management.refresh($("#panel-content"));
  lifeUI.refresh($("#panel-content"));
  if(panel==="atlas"&&atlasTab==="achievements")refreshAchievements($("#panel-content"),state);
  const achievementNotice=achievementFeedback(state,{busy:notifications.busy});
  if(achievementNotice)toast(achievementNotice.text,achievementNotice);
  refreshTaskControls(document, state, r.electricity);
  const finished = state.events.findLast((e) => e.id > lastEvent && (e.manualTask || e.projectLayer));
  if (guidanceOwned(state, "info") && state.guidance.notices) {
    const news = finished;
    if (news) toast(news.text, { kind: "event" });
  }
  const audible = state.events.find(e => e.id > lastEvent && (e.manualTask || ["burst", "festival", "ending"].includes(e.type) || (["harvest", "creature", "live"].includes(e.type) && e.facility && world?.soundVisible(e.facility))));
  if (audible) sound(audible.manualTask ? "pickup" : "event", { automatic: !audible.manualTask, visible: true });
  lastEvent = state.eventSerial;
  const balanceNow=$("[data-shop-balance]");if(balanceNow){balanceNow.textContent=formatWallet(state.money);balanceNow.title=exactBalance(state.money)+' 绿宝石';}
  guidanceUI.refresh(document);
  upgradesUI.refresh($("#panel-content"));
  refreshDimensionUI($("#panel-content"), state);
  refreshFacilityStatuses(document, state, r.electricity);
  $$("[data-command-status]").forEach(el=>{const text=commandStatus();if(el.textContent!==text)el.textContent=text;});
  $$("[data-beacon-status]").forEach(el=>{const text=beaconStatus();if(el.textContent!==text)el.textContent=text;});
  recordsUI.refresh(document);
  observatoryUI.refresh(document);
  gardenUI.refresh(document);
  $$("[data-buy]").forEach((b) => {
    const i = ITEMS[b.dataset.buy];
    refreshPurchaseButton(b, purchaseStatus(state, i, placement), i.name);
  });
  shopOnboarding.update(isForeground() && !panel && !placement && !$("#modal").open);
  if (panel === "network") {
    if ($("[data-net-power]"))
      $("[data-net-power]").innerHTML =
        formatWallet(r.supply) + " / " + formatWallet(r.demand) + " <small>E/秒</small>";
    const overviewPower=powerSnapshot(state);
    for (const realm of realms) {
      const region = r.regions[realm];
      ["raw", "haul", "process", "trade"].forEach((key, j) => {
        const el = $(`[data-flow="${realm}-${j}"]`);
        if (el) {
          el.querySelector("small").textContent = formatHudNumber(region[key],true);
          el.classList.toggle(
            "limiting",
            ["采集", "运输", "加工", "交易"][j] === region.bottleneck,
          );
        }
      });
      const actual = productionSummary(state, overviewPower, realm);
      const b = $(`[data-buffer="${realm}"]`);
      if(b)b.style.width = Math.min(100,state.buffers[realm].raw/Math.max(1,region.rawCapacity)*100)+'%';
      const bt = $(`[data-buffer-text="${realm}"]`);
      if(bt)bt.textContent = formatWallet(state.buffers[realm].raw)+' / '+formatWallet(region.rawCapacity);
      const goods=$(`[data-goods-buffer="${realm}"]`),goodsText=$(`[data-goods-text="${realm}"]`);
      if(goods)goods.style.width=Math.min(100,state.buffers[realm].goods/Math.max(1,region.capacity)*100)+'%';
      if(goodsText)goodsText.textContent=formatWallet(state.buffers[realm].goods)+' / '+formatWallet(region.capacity);
      for(const key of ['processed','sold']) {
        const el=$(`[data-region-${key}="${realm}"]`);if(el)el.textContent=formatHudNumber(actual[key],true);
      }
      const p = $(`[data-project="${realm}"]`);
      if (p)
        p.textContent =
          Math.floor(
            (state.projectByRealm[realm] / (PROJECT_TARGET / 3)) * 100,
          ) + "%";
    }
    productionGuide.refresh($("#panel-content"), r, overviewPower);
    $$("[data-jump]").forEach(
      (b) =>
        (b.onclick = () => {
          state.realm = b.dataset.jump;
          world?.home();
          paint(true);
        }),
    );
  }
  updateLive();
  if (panel === "live") studioUI.refresh();
  if (panel === "mail") mailUI.refresh($("#panel-content"));
  updatePlacementConfirmation();
}
function escapeHTML(text) {
  return String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
function applyCosmetics() {
  $("#notice-center").classList.toggle("reduced-motion", !!state.reducedMotion);
  const equipped=state.scenery.equipped;
  document.title=`MC Clicker 2.0 · ${RELEASE_NAME}`;
  applyWebAppearance(state);
  document.body.classList.toggle("reduce-motion", state.reducedMotion);
  document.body.style.setProperty(
    "--flag-color",
    ["#739777", "#cf9868", "#a29abe"][state.cosmetics.flag],
  );
  document.body.dataset.flag = equipped.flag || "";
  const badgeIcon = COLLECTION_BY_ID[equipped.flag];
  $("#live-overlay .live-badge").innerHTML = badgeIcon
    ? `<span class="channel-flag">${collectionArt(badgeIcon)}</span> LIVE · MC TV`
    : "<i></i> LIVE · MC TV";
  $("#sound").innerHTML = icon(state.sound ? "sound" : "mute", 20);
  $("#sound").setAttribute("aria-label", state.sound ? "关闭声音" : "打开声音");
}
function modal(html) {
  stopHold();
  cancelPlacement();
  world?.stopHold();
  $("#modal-content").innerHTML = html;
  $("#income-open").setAttribute("aria-expanded", String(!!$("#modal-content .income-panel")));
  if (!$("#modal").open) $("#modal").showModal();
  notifications.promote();
}
$("#modal-close").onclick = () => $("#modal").close();
$("#modal").addEventListener("close", () => {
  $("#income-open").setAttribute("aria-expanded", "false");
  if ($("#modal").contains($("#placement-bar"))) {
    cancelPlacement();
    paint();
  }
});
$("#modal").addEventListener("click", (e) => {
  if (e.target === $("#modal")) {
    const r = e.target.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      e.target.close();
  }
});
let saveUI, saveModule;
async function showSaveManager() {
  modal('<div id="save-loading" role="status"><h2>存档与读档</h2><p>正在打开存档工具…</p></div>');
  try {
    saveModule ||= import('./save-ui.js');
    const { createSaveUI } = await saveModule;
    saveUI ||= createSaveUI({
      dialog: $('#modal'), modal, release: RELEASE_VERSION, format: formatWallet, download,
      snapshot: () => structuredClone({ ...state, savedAt: Date.now() }),
      restore, notice: toast, backedUp:()=>{noteCommunityAction(state,'backup');save();},
      load(imported) {
        settleOffline(imported);
        const now = commitImportedSave(localStorage, SAVE_KEY, state, imported);
        // Finish old-world interactions before exposing the replacement state.
        cancelPlacement(); panelSet(null); mobileCamera.reset();
        notifications.clear();
        state = imported; state.savedAt = now; savingFailed = false;
        page = 'world'; family = 'all'; selected = null;
        studioMonitor = false; studioSelected = null; pendingStudio = null; studioReturn = null; studioEntry++;
        displayedMoney = state.money; shopKey = ''; foreground.reset(performance.now());
        document.body.classList.remove('live-page', 'entering-studio', 'room-monitor');
        world?.cancelPointers(); world?.setMode(null); world?.setStudio(false);
        world?.sync(state); world?.setView(state.realm); world?.cameraStates.clear(); world?.home();
        applyCosmetics(); gameAudio.tick(); paint(true);
      },
    });
    if ($('#modal').open && $('#save-loading')) saveUI.open();
  } catch {
    saveModule = null;
    if ($('#modal').open && $('#save-loading')) modal('<h2>存档工具未能打开</h2><p>请检查网络后重试，当前进度没有改变。</p>');
  }
}
function showSettings() {
  modal(
    `<header class="settings-header"><span class="eyebrow">MAKE YOURSELF AT HOME</span><h2>MC Clicker 2.0</h2></header><p class="save-note">${RELEASE_NAME}</p><p class="save-note">KevinYoung 策划 · GPT-6 Astra 制作</p>${audioMasterMarkup(state)}${audioSettingsMarkup(state)}<label class="setting"><span>显示电线</span><input id="power-lines-setting" type="checkbox" ${state.editing?.lines?.power!==false?"checked":""}></label><label class="setting"><span>显示物流线路与矿车</span><input id="logistics-lines-setting" type="checkbox" ${state.editing?.lines?.logistics!==false?"checked":""}></label><label class="setting"><span>减少动态</span><input id="motion-setting" type="checkbox" ${state.reducedMotion ? "checked" : ""}></label><p class="save-note">存档保存在当前浏览器。切后台、锁屏或离开游戏窗口后暂停收益，不补算离线收益。</p><div class="modal-actions">${shopAvailable(state) ? '<button id="cosmetic-settings">网页装扮</button>' : ""}${environmentAccess(state)?'<button id="environment-settings">世界环境</button>':""}${n(state,"L2")?'<button id="scenery-settings">室内布置</button>':""}<button id="basic-help">操作指南</button><button id="save-settings">存档与读档</button></div><button id="reset-request" class="danger">重新开始</button>`,
  );
  recordsUI.bind($("#modal-content"));
  if(guidanceOwned(state,'info')) {
    $('#motion-setting').closest('label').insertAdjacentHTML('afterend',`<label class="setting"><span>播放旁白（字幕与声音）</span><input id="narration-setting" type="checkbox" ${state.guidance.notices?'checked':''}></label>`);
    $('#narration-setting').onchange=e=>narrator.setEnabled(e.target.checked);
  }
  $('#modal-content').insertAdjacentHTML('beforeend','<a class="quiet-button" href="https://www.kw-aigc.cn/" target="_blank" rel="noopener">kw-aigc 个人网站 ↗</a>');
  $("#basic-help").onclick = () => guidanceUI.openInfo(true);
  $("#sound-setting").onchange = (e) => {
    if(!audioUnlocked(state)){recordsUI.refresh($("#modal-content"));return;}
    state.sound = e.target.checked;
    gameAudio.unlock(); gameAudio.tick();
    applyCosmetics();
    save();
    sound("buy");
  };
  for(const kind of ['power','logistics'])$('#'+kind+'-lines-setting').onchange=e=>{state.editing||={};state.editing.lines||={};state.editing.lines[kind]=e.target.checked;save();world?.sync(state);};
  $("#motion-setting").onchange = (e) => {
    state.reducedMotion = e.target.checked;
    applyCosmetics();
    save();
  };
  $("#motion-setting")
    .closest("label")
    .insertAdjacentHTML(
      "afterend",
      `<label class="setting purchase-setting"><span>购买确认<small>购买商品、升级时再确认一次。</small></span><input id="purchase-confirmation-setting" type="checkbox" ${!state.skipPurchaseConfirmation ? "checked" : ""}></label><label class="setting purchase-setting"><span>建造确认<small>扩地、放置与搬动时确认落点。关闭后点选合法位置即完成。</small></span><input id="build-confirmation-setting" type="checkbox" ${!state.skipBuildConfirmation ? "checked" : ""}></label>`,
    );
  $("#purchase-confirmation-setting").onchange = (e) => {
    state.skipPurchaseConfirmation = !e.target.checked;
    save();
  };
  $("#build-confirmation-setting").onchange = (e) => {
    state.skipBuildConfirmation = !e.target.checked;
    if (placement && ['expand','build','move','land-store','garden-edit','home-build','home-move','civic-build','civic-move','garden-build','garden-move','terrain-paint','studio-build','studio-move'].includes(placement.kind)) {
      if (placement.kind.startsWith('studio-')) updatePlacementConfirmation();
      else updateOutdoorPlacementGuide();
    }
    save();
  };
  $("#environment-settings")?.addEventListener("click",()=>{$("#modal").close();openItem("V19")});
  $("#scenery-settings")?.addEventListener("click",()=>{$("#modal").close();enterStudio("decor")});
  if ($("#cosmetic-settings")) $("#cosmetic-settings").onclick = showCosmetics;
  $('#save-settings').onclick = () => showSaveManager();
  $("#reset-request").onclick = () => {
    modal(
      '<h2>重新从一块开始？</h2><p>这会清除当前世界。可以先回去保存纪念卡或导出存档。</p><div class="modal-actions"><button id="reset-cancel">留下这个世界</button><button id="reset-confirm" class="primary">清除并重新开始</button></div>',
    );
    $("#reset-cancel").onclick = () => $("#modal").close();
    $("#reset-confirm").onclick = () => {
      state = fresh();
      page = "world";
      family = "all";
      selected = null;
      cancelPlacement();
      applyCosmetics();
      panelSet(null);
      document.body.classList.remove("live-page");
      world?.home();
      save();
      paint(true);
      $("#modal").close();
    };
  };
}
const housingUI=createHousingUI({state:()=>state,format:formatWallet,build:startHomePlacement,
  store:id=>confirmStorage('home',id),
  continuous:()=>editingPreference(state,"home"),
  setContinuous:value=>{setEditingPreference(state,"home",value);save();},
  claim:()=>{const result=claimStarterHome(state);if(result.ok){save();shopKey='';sound('buy');}else toast(result.reason);return result;},
  assign:(resident,id,unit)=>gardenChanged(moveResidentHome(state,resident,id,unit)),
  rerender:()=>{shopKey='';paint(true)},focus:p=>{if(p){state.realm='overworld';world?.setView('overworld');world?.inspectPoint(p,Math.max(HOME_BY_ID[p.type].w,HOME_BY_ID[p.type].d)+1);}},
});
const gardenUI=createGardenUI({
  state:()=>state,format:formatWallet,plant:startGardenPlacement,
  paintTerrain:startTerrainPaint,
  claim:id=>{const r=claimCommunitySouvenir(state,id);if(r.ok){save();shopKey='';paint(true);purchaseReceipt(`${r.name} · 已领取`,0);}else toast(r.reason);return r;},
  continuous:()=>editingPreference(state,'garden'),
  setContinuous:value=>{setEditingPreference(state,'garden',value);save();},
  arrange:startGardenArrange,
  clear:id=>gardenChanged(clearGarden(state,id)),undo:object=>gardenChanged(undoGardenClear(state,object)),
  rerender:()=>{shopKey='';paint(true)},
  focus:p=>{if(p)world?.inspectPoint(p,3)},
  mode:key=>{if(placement||panel!=='item'||selected!=='V20')return;world?.setMode(key===undefined?null:{kind:'garden-edit',key});$('#world-controls').hidden=key!==undefined;},
});
const lifeUI=createVillageLifeUI({buildCivic:startCivicPlacement,
  focus:p=>{if(p){state.realm='overworld';world?.setView('overworld');world?.inspectPoint(p,3);}},
  storeCivic:id=>{modal('<h2>收起分点</h2><p>保留这座设施，可以免费重新摆放。</p><div class="dialog-actions"><button id="civic-cancel">取消</button><button id="civic-store">收起</button></div>');$('#civic-cancel').onclick=()=>$('#modal').close();$('#civic-store').onclick=()=>{$('#modal').close();gardenChanged(storeCivic(state,id));};},
  state:()=>state,toast,staff:job=>management.workplace(job),openLife:()=>go('life'),
  changed:({menuOnly=false}={})=>{save();if(!menuOnly)shopKey='';paint(!menuOnly)},
  confirm:(name,cost,run,duration)=>{
    modal(`<h2>研究${name}</h2><p>投入 ${formatWallet(cost)} 绿宝石。${duration?"切换研究保留进度，完成后自动生效。":"立即解锁对应建设。"}</p><div class="dialog-actions"><button id="research-cancel">取消</button><button id="research-confirm" class="primary">投入研究</button></div>`);
    $('#research-cancel').onclick=()=>$('#modal').close();
    $('#research-confirm').onclick=()=>{$('#modal').close();run()};
  }
});
const observatoryUI=createObservatoryUI({state:()=>state,purchase:id=>startAppearancePurchase(id,'environment'),place:()=>startPlacement('V19'),changed:()=>{save();world?.sync(state)},rerender:()=>{shopKey='';paint(true)}});
const collectionAPI = {
  store:()=>confirmStorage("facility","X2"),
  state: () => state,
  modal,
  toast,
  purchase: id=>startAppearancePurchase(id,'web'),
  nodeBuy: (id) => {
    // Catalogue-backed decorations share the same confirmation preference.
    if (ITEMS[id].place && !n(state, id)) startPlacement(id);
    else startConfirmation(id);
    return { pending: true };
  },
  changed: () => {
    applyCosmetics();
    world?.sync(state);
    shopKey = "";
    save();
    paint(true);
    sound("buy");
  },

};
let loadedCollectionShop,
  collectionModule,
  collectionRequest = 0;
const collectionShop = {
  async open(category,itemId=null) {
    if (loadedCollectionShop) return loadedCollectionShop.open(category,itemId);
    const request = ++collectionRequest;
    modal(
      '<div id="collection-loading" role="status"><span class="eyebrow">THE LITTLE THINGS</span><h2>装扮商店</h2><p>正在加载商品…</p></div>',
    );
    try {
      collectionModule ||= import("./collection-ui.js");
      const { createCollectionShop } = await collectionModule;
      loadedCollectionShop ||= createCollectionShop(collectionAPI);
      if (
        request === collectionRequest &&
        $("#modal").open &&
        $("#collection-loading")
      )
        loadedCollectionShop.open(category,itemId);
    } catch {
      collectionModule = null;
      if ($("#collection-loading"))
        modal(
          "<h2>商店暂未打开</h2><p>请稍后重试。</p>",
        );
    }
  },
  refresh() {
    loadedCollectionShop?.refresh();
  },
  render() {
    loadedCollectionShop?.render();
  },
};
$("#collection-open").onclick = () => showCosmetics();
function showCosmetics() {
  if(facilityStored(state,'X2'))return openStoredFacility('X2');
  if (shopAvailable(state)) collectionShop.open();
}
function shareEffect() {
  const item=WEB_BY_ID[state.webAppearance.equipped.shareFx];if(!item)return;
  const target=document.activeElement?.closest('button') || $('#share-open'),bounds=target.getBoundingClientRect();
  const layer=document.createElement('div');layer.className='web-share-effect';layer.dataset.effect=item.id;layer.setAttribute('aria-hidden','true');
  layer.style.cssText=`left:${Math.min(innerWidth-45,bounds.right-14)}px;top:${Math.max(16,bounds.top)}px`;
  layer.innerHTML=item.id.endsWith('stamp')||state.reducedMotion?'<b>✓</b>':Array.from({length:12},(_,i)=>`<i style="--x:${Math.cos(i*Math.PI/6)*30}px;--y:${Math.sin(i*Math.PI/6)*24}px"></i>`).join('');
  ($('#modal').open?$('#modal'):document.body).append(layer);
  if(!state.reducedMotion)layer.animate([{opacity:0,transform:'scale(1.25)'},{opacity:1,transform:'scale(1)',offset:.4},{opacity:0,transform:'scale(.95)'}],{duration:item.id.endsWith('stamp')?260:450});
  setTimeout(()=>layer.remove(),state.reducedMotion?700:500);
}
function download(blob, name) {
  if (name.endsWith(".png")) shareEffect();
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
let shareCaptureBusy = false;
let loadedShareUI,
  shareModule,
  shareRequest = 0;
async function showStats(ending = false) {
  if (loadedShareUI) return loadedShareUI.open({ ending });
  const request = ++shareRequest;
  modal(
    '<div id="share-loading" role="status"><span class="eyebrow">A WORLD WORTH SHARING</span><h2>准备分享你的世界</h2><p>正在打开分享面板…</p></div>',
  );
  try {
    shareModule ||= import("./share-ui.js");
    const { createShareUI } = await shareModule;
    loadedShareUI ||= createShareUI({
      state: () => state,
      modal,
      toast,
      download,
      effect: shareEffect,
      changed:()=>{applyCosmetics();save()},
      unlock: startSharingUnlock,
      beginCapture: () => {
        shareCaptureBusy = true;
        if (world) world.active = false;
        return () => {
          shareCaptureBusy = false;
          foreground.reset(performance.now());
          if (world) world.active = isForeground();
        };
      },
      capture: () => world?.captureCurrentScene({ width: 1440, height: 1040 }),
      sceneLabel: () =>
        world?.interior ? "直播室" : REALMS[world?.view || state.realm].name,
    });
    if (request === shareRequest && $("#modal").open && $("#share-loading"))
      loadedShareUI.open({ ending });
  } catch {
    shareModule = null;
    if ($("#share-loading"))
      modal("<h2>分享面板暂未打开</h2><p>请稍后重试。</p>");
  }
}
$("#share-open").onclick = () => showStats();
$("#settings").onclick = showSettings;
$("#quick-help").onclick = () => guidanceUI.openInfo(true);
$("#income-open").onclick = () => guidanceUI.openIncome();
$("#sound").onclick = () => {
  state.sound = !state.sound;
  gameAudio.unlock(); gameAudio.tick();
  applyCosmetics();
  save();
  sound("buy");
};
window.addEventListener("keydown", (e) => {
  if (
    ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName) ||
    $("#modal").open
  )
    return;
  if (e.key.toLowerCase() === "r" && placement && !e.repeat && !e.target.isContentEditable && !e.ctrlKey && !e.metaKey && !e.altKey && !$("#placement-rotate").hidden) {
    e.preventDefault();$("#placement-rotate").click();return;
  }
  if (e.key === "Escape") {
    if (placement) {
      cancelCurrentPlacement();
      return;
    }
    if (page === "live") {
      go("world");
      return;
    }
    cancelPlacement();
    panelSet(null);
  }
  const map = {
    1: "build",
    2: "village",
    3: "network",
    4: "atlas",
  };
  if (map[e.key]) {
    e.preventDefault();
    if (!e.repeat) toggleMenu(map[e.key]);
  }
});
keyboardMining = bindSpaceMining({
  enabled: () =>
    isForeground() &&
    !$("#modal").open &&
    !placement &&
    page === "world" &&
    panel !== "mail",
  start: () => startHold("mine", $("#mine")),
  stop: stopHold,
  mineButton: $("#mine"),
});
const narrativeAbsence = new NarrativeAbsence();
function syncForeground() {
  if(window.MCBoot?.failed())return;
  const active = isForeground();
  narrativeAbsence.update(active, Date.now(), state);
  foreground.setActive(active, performance.now());
  foreground.reset(performance.now());
  stopHold();
  world?.stopHold();
  if (world) world.active = active && !shareCaptureBusy;
  if (active) world?.refreshSurface();
  displayedMoney = state.money;
  syncInformation();
  notifications.pause(!active);
  if(!active)narrator.suspend();
  $("#rate").textContent = active ? formatHudNumber(state.rate, true) : "0";
  if (!active) {
    world?.cancelPointers();
    save();
  }
  gameAudio.setActive(active);
  guidanceUI.refresh(document);
}
window.addEventListener("blur", () => {
  windowFocused = false;
  syncForeground();
});
window.addEventListener("focus", () => {
  windowFocused = true;
  syncForeground();
});
document.addEventListener("visibilitychange", syncForeground);
window.addEventListener("pagehide", () => {
  pageSuspended = true;
  syncForeground();
});
window.addEventListener("pageshow", () => {
  pageSuspended = false;
  windowFocused = document.hasFocus();
  syncForeground();
});
document.addEventListener("freeze", () => {
  pageSuspended = true;
  syncForeground();
});
document.addEventListener("resume", () => {
  pageSuspended = false;
  syncForeground();
});
function frame(now) {
  if(window.MCBoot?.failed())return;
  if (shareCaptureBusy) {
    foreground.reset(now);
    requestAnimationFrame(frame);
    return;
  }
  const active = isForeground();
  if (active !== foreground.active) syncForeground();
  const dt = foreground.step(now);
  if (active) {
    // Keep the same small simulation steps even when rendering is very slow.
    for (let left = dt; left > 1e-9; left -= 0.25)
      advance(state, Math.min(0.25, left));
    displayedMoney =
      state.money < displayedMoney || state.reducedMotion
        ? state.money
        : displayedMoney +
          (state.money - displayedMoney) * (1 - Math.exp(-dt * 18));
    if (Math.abs(state.money - displayedMoney) < 0.5)
      displayedMoney = state.money;
    const moneyText = formatHudNumber(displayedMoney);
    if ($("#money").textContent !== moneyText) $("#money").textContent = moneyText;
    narrator.tick(dt);
    gameAudio.ambient(world?.atmosphereView?.ambience);
    gameAudio.tick();
    if (now - lastPaint > 220) {
      paint();
      lastPaint = now;
    }
    if (now - lastSave > 8000) {
      save();
      lastSave = now;
    }
  }
  requestAnimationFrame(frame);
}
const narrator=createNarratorUI({
  audio:gameAudio,
  openManual:()=>{if(isForeground())guidanceUI.openInfo(false,{guide:true});},
  foreground:isForeground,
  modal,context:narrativeContext({world:()=>world,audio:()=>gameAudio,surface:()=>$('#modal').open?($('#collection-shop')?'appearance':'modal'):['build','owned','item','atlas'].includes(panel)?'shop':panel||'world'}),
  state:()=>state,notices:notifications,shop:$('[data-nav="build"]'),save,paint:()=>paint(true),
  available:()=>isForeground() && !placement && (!$('#modal').open||!!$('#collection-shop')) && !(world?.pointers.size>1 || (world?.pointers.size && (world.start?.moved || world.start?.rotating || world.start?.hit?.userData.action!=='mine'))) && !document.activeElement?.matches('input:not([type]),input[type=text],input[type=number],input[type=search],textarea,[contenteditable=true]'),
  canPresent:r=>$('#modal').open ? !!$('#collection-shop')&&!!r?.id?.startsWith('decoration:') : (!$('#game').classList.contains('sheet-expanded') || (['build','owned','item'].includes(panel) && r?.shop===true) || r?.surfaces?.includes(panel) || (panel==='village' && r?.id==='rearrange')),
  activitiesAvailable:()=>!$('#modal').open && !panel && page==='world',
  offerPurchase:async offer=>{
    if(offer.domain==='upgrade'){openItem(UPGRADE_BY_ID[offer.id].owner,true);startFacilityUpgrade(offer.id);}
    else{await collectionShop.open('notice',offer.id);if(isForeground()&&$('#modal').open&&$('#collection-shop'))startAppearancePurchase(offer.id,'web');}
  },
  closeModal:()=>$('#modal').close(),
  find:point=>{if(!point){toast('先留一点空地，钱匣会放在能走到的地方。');return;}state.realm=point.realm;page='world';panelSet(null);paint(true);world?.inspectPoint(point,4);},
});
window.MCBoot?.stopWith(()=>{
  foreground.setActive(false,performance.now());foreground.reset(performance.now());
  stopHold();world?.halt();gameAudio.setActive(false);narrator.suspend();
});
panel = null;
$("#panel").hidden = true;
$("#game").classList.remove("panel-open");
applyCosmetics();
paint(true);
requestAnimationFrame(frame);
syncForeground();
window.MCBoot?.ready();
if (import.meta.env.DEV)
  window.mcDebug = {
    get state() {
      return state;
    },
    audio: gameAudio,
    rates: () => rates(state),
    get world() {
      return world;
    },
    setState(raw) {
      state = restore(raw);
      shopKey = "";
      applyCosmetics();
      paint(true);
    },
    advance: (seconds) => {
      advance(state, seconds);
      paint(true);
    },
    save,
    showStats,
    openCompanion,
    go,
  };
