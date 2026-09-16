import { formatHudNumber } from './hud-numbers.js';
import { RECORDS, RECORD_BY_ID, ensureRecords, selectRecord, recordStatus, RECORD_MODES, setRecordMode } from "./records.js";
import { recordArt } from "./record-art.js";
import { icon } from './icons.js';

export const audioUnlocked = s => (s.counts?.L1||0)>0;
const audioUnlockNote='购买唱片机（音乐盒）后开启游戏声音。';
export function audioMasterMarkup(s) {
  const locked=!audioUnlocked(s);
  return `<label class="setting audio-master" data-audio-master data-audio-locked="${locked}"><span>游戏声音 · 总开关${locked?`<small id="audio-unlock-note">${icon('lock',14)}${audioUnlockNote}</small>`:''}</span><input id="sound-setting" type="checkbox" ${!locked&&s.sound?'checked':''} ${locked?'disabled aria-describedby="audio-unlock-note"':''}></label>`;
}
export function audioSettingsMarkup(s) {
  ensureRecords(s);
  const volumes=[["musicVolume", "背景音乐"], ["sfxVolume", "操作音效"],...(s.guidance?.info?[["narratorVolume","旁白音量"]]:[])];
  return `<div class="audio-settings" data-audio-locked="${!audioUnlocked(s)}">${volumes.map(([key,label]) => `<label><span>${label}</span><input ${audioUnlocked(s)?'':'disabled'} type="range" min="0" max="100" step="1" data-audio-volume="${key}" value="${Math.round((s.audio[key]??.45)*100)}" aria-label="${label}${key==='narratorVolume'?'':'音量'}"><output data-audio-value="${key}">${Math.round((s.audio[key]??.45)*100)}%</output></label>`).join("")}${s.guidance?.info?`<button ${audioUnlocked(s)?'':'disabled'} type="button" class="narrator-voice-toggle" data-narrator-voice aria-pressed="${s.audio.narratorVoice===false}"></button>`:''}</div>`;
}
export function createRecordsUI(api) {
  function markup() {
    const s=api.state(), r=ensureRecords(s), selected=RECORD_BY_ID[r.selected];
    return `<section class="record-library" aria-label="唱片收藏"><header><h4>唱片收藏</h4><small>音乐播放</small></header><div class="record-now"><div data-record-cover>${recordArt(selected.id)}</div><div><strong data-record-name>${selected.name}</strong><span data-record-playback>已暂停</span></div></div><div class="record-transport"><button class="primary" data-record-toggle>播放</button><select data-record-mode aria-label="音乐播放方式">${Object.entries(RECORD_MODES).map(([value,label])=>`<option value="${value}" ${r.mode===value?"selected":""}>${label}</option>`).join("")}</select><button data-record-next aria-label="下一首" title="下一首">${icon("next",16)}</button><button data-record-enable hidden>打开声音</button></div><p class="record-audio-note">列表与随机播放包含全部已收藏唱片，曲间休息 3 秒。</p>${audioSettingsMarkup(s)}<p class="record-audio-note" data-record-note></p><div class="record-shelves">${RECORDS.map(record => `<article class="record-row" data-record="${record.id}"><div class="record-cover">${recordArt(record.id)}</div><div class="record-description"><strong>${record.name}</strong><small>${record.style}</small><span data-record-state>未购买</span></div><div class="record-actions"><button data-record-play="${record.id}" hidden>播放</button><button data-record-buy="${record.id}">${formatHudNumber(record.cost)} ◆</button></div><small class="record-reason" data-record-reason></small></article>`).join("")}</div></section>`;
  }
  function bind(root) {
    const on = (query, fn) => root.querySelectorAll(query).forEach(el => el.onclick=()=>fn(el));
    on("[data-record-enable]", () => { api.state().sound=true;api.audio.unlock();api.changed(); });
    on("[data-record-toggle]", () => { const r=ensureRecords(api.state()); r.playing=!r.playing; api.audio.command(); api.changed(); });
    on("[data-record-play]", el => { if(selectRecord(api.state(),el.dataset.recordPlay)){api.audio.command({skipGap:true});api.changed();} });
    on("[data-record-buy]", el => api.purchase(el.dataset.recordBuy));
    on("[data-record-next]",()=>{api.audio.next();api.changed();});
    root.querySelectorAll("[data-record-mode]").forEach(el=>el.onchange=()=>{setRecordMode(api.state(),el.value);api.audio.tick();api.changed();});
    on('[data-narrator-voice]',()=>{if(!audioUnlocked(api.state()))return;api.voiceChanged(api.state().audio.narratorVoice===false);refresh(document);});
    root.querySelectorAll("[data-audio-volume]").forEach(el => {
      el.oninput=()=>{if(!audioUnlocked(api.state())){refresh(root);return;}const key=el.dataset.audioVolume,old=api.state().audio[key];api.state().audio[key]=Number(el.value)/100;
        if(key==='narratorVolume'&&(Number(el.value)===0||old===0))api.voiceChanged(Number(el.value)>0);
        api.audio.tick();refresh(document);};
      el.onchange=()=>{if(!audioUnlocked(api.state()))return;api.audio.unlock();api.changed();};
    });
    refresh(root);
  }
  function refresh(root) {
    const s=api.state(),r=ensureRecords(s), playback=api.audio.snapshot(), selected=RECORD_BY_ID[r.selected];
    const unlocked=audioUnlocked(s);
    root.querySelectorAll('[data-audio-volume],[data-narrator-voice],#sound-setting').forEach(el=>el.disabled=!unlocked);
    root.querySelectorAll('[data-audio-locked]').forEach(el=>el.dataset.audioLocked=String(!unlocked));
    root.querySelectorAll('#sound-setting').forEach(el=>el.checked=unlocked&&s.sound);
    root.querySelectorAll('#audio-unlock-note').forEach(el=>el.hidden=unlocked);
    const set=(selector,text)=>root.querySelectorAll(selector).forEach(el=>{if(el.textContent!==text)el.textContent=text;});
    set("[data-record-name]",selected.name);
    set("[data-record-playback]",!s.sound ? "总静音" : playback.playing ? "播放中" : r.playing && playback.interlude ? "曲间休息" : r.playing ? "待播放" : "已暂停");
    set("[data-record-toggle]",r.playing ? "暂停音乐" : "播放音乐");
    set("[data-record-note]",playback.failure || (!s.sound ? "总静音已开启。" : "这里选的是背景音乐。要赚绿宝石，点「开始演出」，或安排乐师帮忙。"));
    root.querySelectorAll("[data-record-cover]").forEach(el=>{if(el.dataset.art!==selected.id){el.innerHTML=recordArt(selected.id);el.dataset.art=selected.id;}});
    root.querySelectorAll("[data-record-mode]").forEach(el=>{if(el.value!==r.mode)el.value=r.mode;});
    root.querySelectorAll("[data-record-enable]").forEach(el=>el.hidden=s.sound);
    root.querySelectorAll("[data-audio-volume]").forEach(el=>{if(el!==document.activeElement)el.value=Math.round(s.audio[el.dataset.audioVolume]*100);});
    for(const key of ["musicVolume","sfxVolume","narratorVolume"])set(`[data-audio-value="${key}"]`,Math.round((s.audio[key]??.45)*100)+"%");
    root.querySelectorAll('[data-narrator-voice]').forEach(el=>{
      const muted=s.audio.narratorVoice===false;
      el.setAttribute('aria-pressed',String(muted));
      const label=muted?'开启旁白声音':'静音旁白声音';
      if(el.dataset.label!==label){el.dataset.label=label;el.innerHTML=`${icon(muted?'mute':'sound',16)}<span>${label}</span>`;}
    });
    root.querySelectorAll("[data-record]").forEach(row=>{
      const id=row.dataset.record, status=recordStatus(s,id), owned=status.kind==="owned", playing=playback.playing&&playback.selected===id;
      row.dataset.state=playing ? "playing" : owned ? "owned" : "unowned";
      row.querySelector("[data-record-state]").textContent=playing ? "播放中" : owned ? "已收藏" : "未购买";
      const play=row.querySelector("[data-record-play]"), buy=row.querySelector("[data-record-buy]");
      play.hidden=!owned;play.textContent=playing ? "正在播放" : "播放";play.disabled=playing;
      buy.hidden=owned;buy.dataset.purchaseState=status.kind;
      buy.setAttribute("aria-label",`购买唱片《${RECORD_BY_ID[id].name}》，${RECORD_BY_ID[id].cost} 绿宝石`);
      row.querySelector("[data-record-reason]").textContent=owned ? "" : status.reason;
    });
  }
  return { markup, bind, refresh };
}
