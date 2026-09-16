import { ACHIEVEMENT_DEFS, ACHIEVEMENT_GROUPS, achievementProgress } from './achievements.js';
import { icon } from './icons.js';
import { formatHudNumber } from './hud-numbers.js';

const earnedCount = s => ACHIEVEMENT_DEFS.filter(a=>s.achievements.includes(a.id)).length;
const number = n => formatHudNumber(Math.floor(n));
const progressText = p => p.earned ? '已达成' : `${number(p.value)} / ${number(p.total)}`;
function row(s,a) {
  const p=achievementProgress(s,a);
  const action=a.destination==='housing'?'data-housing-open':a.target==='X1'?'data-achievement-buildings':a.target?`data-detail="${a.target}"`:'';
  return `<article class="achievement-row ${p.earned?'earned':''}" data-achievement="${a.id}">
    <span class="achievement-medal" aria-hidden="true">${icon(a.symbol,24)}<i>${icon('check',10)}</i></span>
    <div class="achievement-body"><div class="achievement-title"><h3>${a.name}</h3><span data-achievement-status>${progressText(p)}</span></div>
      <p class="achievement-condition">${a.description}</p>
      <div class="achievement-progress" role="progressbar" aria-label="${a.name}" aria-valuemin="0" aria-valuemax="${p.total}" aria-valuenow="${p.earned?p.total:p.value}" aria-valuetext="${progressText(p)}"><span style="width:${p.earned?100:100*p.value/p.total}%"></span></div>
      ${a.flavor?`<p class="achievement-flavor">${a.flavor}</p>`:''}
      ${action?`<button class="achievement-go" ${action} aria-label="${a.name}：${a.destination==='housing'?'前往住房':'查看相关设施'}">${a.destination==='housing'?'去住房':a.target==='X1'?'查看建设图鉴':'查看相关设施'} ${icon('arrow',14)}</button>`:''}
    </div></article>`;
}
export function achievementsMarkup(s,{group='all',pending=false}={}) {
  const earned=earnedCount(s), rows=ACHIEVEMENT_DEFS.filter(a=>(group==='all'||a.group===group)&&(!pending||!s.achievements.includes(a.id)));
  return `<div class="achievement-heading"><span class="achievement-bookmark">${icon('spark',30)}</span><div><h3>世界成就册</h3><p><b data-achievement-count>${earned}</b> / ${ACHIEVEMENT_DEFS.length} 枚已收集</p></div><label class="achievement-toggle"><input type="checkbox" data-achievement-pending ${pending?'checked':''}>未达成</label></div>
    <nav class="achievement-filters" aria-label="成就分类">${ACHIEVEMENT_GROUPS.map(([id,name])=>`<button data-achievement-group="${id}" class="${group===id?'active':''}" aria-pressed="${group===id}">${name}</button>`).join('')}</nav>
    <p class="achievement-note">达成自动记入存档 · 可随时补做</p>
    <div class="achievement-list">${rows.length?rows.map(a=>row(s,a)).join(''):`<p class="achievement-empty">${icon('check',24)}这一页已经收齐了。换个分类，再逛逛世界。</p>`}</div>`;
}
// Update progress in place. Do not sort or remove a focused row when it unlocks.
export function refreshAchievements(root,s) {
  const total=root.querySelector('[data-achievement-count]');if(!total)return;
  total.textContent=earnedCount(s);
  for(const a of ACHIEVEMENT_DEFS){
    const el=root.querySelector(`[data-achievement="${a.id}"]`);if(!el)continue;
    const p=achievementProgress(s,a),bar=el.querySelector('[role="progressbar"]');
    el.classList.toggle('earned',p.earned);el.querySelector('[data-achievement-status]').textContent=progressText(p);
    bar.setAttribute('aria-valuemax',p.total);bar.setAttribute('aria-valuenow',p.earned?p.total:p.value);bar.setAttribute('aria-valuetext',progressText(p));
    bar.firstElementChild.style.width=`${p.earned?100:100*p.value/p.total}%`;
  }
}

// Fresh/restored state starts a baseline, so old worlds never replay unlock spam.
export function createAchievementFeedback(initial) {
  let state=initial,known=new Set(initial.achievements),pending=[],at=0;
  return (s,{busy=false}={})=>{
    if(state!==s){state=s;known=new Set(s.achievements);pending=[];at=s.play;return null;}
    const added=ACHIEVEMENT_DEFS.filter(a=>s.achievements.includes(a.id)&&!known.has(a.id));
    s.achievements.forEach(id=>known.add(id));
    if(s.counts.X1&&s.play>120)pending.push(...added);
    if(!pending.length||busy||s.play-at<20)return null;
    const newest=pending[pending.length-1],count=pending.length;pending=[];at=s.play;
    return {text:count>1?`新达成 ${count} 枚成就`:`成就达成 · ${newest.name}`,detail:count>1?`${newest.name}等 · 图鉴 → 成就`:'图鉴 → 成就',kind:'event',expression:'smile'};
  };
}
