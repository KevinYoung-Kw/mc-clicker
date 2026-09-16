import {broadcastStage} from './broadcasting.js';
import {COMMUNITY_NARRATION} from './community-narration.js';
import {discoverCommunityWealth} from './community-stories.js';
import { inputKind } from './input-guidance.js';
import { openingChoicePending, narrationAllowed, needsManualReminder } from './opening-guide.js';
import { NARRATOR_LINE_REST, narratorReadingTime } from './narrator-voice.js';
import { traceNarrative, hasNarrativeTrace } from './narrative-trace.js';
import { EASTER_EGGS, narratorAway } from './easter-eggs.js';
import { JOBS, HAUL_SOURCES, jobAvailable, jobSlots } from './residents.js';
import { NARRATOR_COPY, NARRATOR_PLACES } from './narrator-copy.js';
import { ITEMS } from './catalog.js';
import { priorityInterface } from './guidance.js';
import { earlyTarget } from './first-steps.js';
import { MIDGAME_NARRATION, MIDGAME_IDLE } from './narrative-midgame.js';
import { DECORATION_NARRATION, PERSONALITY_SUGGESTIONS, recentDecoration, decorationCopy, narratorOffer } from './narrative-personality.js';
export { narratorOffer } from './narrative-personality.js';
import { freshNarrativeBehavior, restoreNarrativeBehavior, observeNarrativeBehavior, rushing, browsing, grinding, rearranging } from './narrative-behavior.js';
const people=s=>s.community?.residents||[];
const has=(s,id)=>(s.counts[id]||0)>0;
const working=s=>people(s).some(r=>!r.reserve&&r.job&&r.job!=='idle');
const busyWorkers=s=>people(s).some(r=>!r.reserve&&r.activity==='working');
const copy=id=>NARRATOR_COPY[id]?.lines||[];
// `seen` also contains skipped/expired lessons. Only completed history supports
// a spoken callback. V1 is a real prerequisite of V18 in the purchase catalog;
// unrelated branches (e.g. M4 and M1) must never supply each other's backstory.
const heard=(s,id)=>s.narrative.history.some(h=>h.id===id&&h.text===copy(id).join(' '));
const hasWorker=(s,job)=>people(s).some(r=>!r.reserve&&r.job===job);
const builtFacilities=s=>Object.keys(s.placements||{}).filter(id=>ITEMS[id]?.place).length;
const EARLY_HELP=['pick-use','land-use','mail-income','music-work','farm-work','power-use','haul-use'];
const openJob=(s,id)=>id!=='idle'&&jobAvailable(s,id)&&people(s).filter(r=>!r.reserve&&r.job===id).length<jobSlots(s,id);
function vacancy(s){return Object.keys(JOBS).find(id=>openJob(s,id));}
function residentVariant(s){return working(s)?null:vacancy(s)?'resident-vacant':!has(s,'L1')?'resident-no-music':null;}
function residentAdvice(s){const variant=s.narrative.current?.variant||residentVariant(s),job=vacancy(s);return copy(variant).map(line=>line.replace('{岗位}',job?JOBS[job].name:''));}
const rule=(id,when,options={})=>({id,when,lines:copy(id),kind:'reaction',ttl:60,minPlay:0,priority:0,...options});
// Name each new vacancy once. The shared board tutorial is spoken once per save,
// rather than repeated for every profession; later openings get only the reminder.
const VACANCY_RULES=Object.entries(JOBS).filter(([id])=>id!=='idle').map(([job,spec])=>rule(`vacancy:${job}`,s=>has(s,'V2')&&openJob(s,job)&&(job!=='researcher'||!!s.research?.active),{
 kind:'explain',minPlay:180,settle:8,quietFor:8,ttl:90,priority:30,shop:true,surfaces:['village','network','live'],
 lines:s=>{
  const target=job==='hauler'&&!has(s,'M4')?'V3':spec.target;
  const teach=s.narrative.current?.id===`vacancy:${job}`
    ? s.narrative.current.vacancyGuide ?? !s.narrative.vacancyGuideShown
    : !s.narrative.vacancyGuideShown;
  return copy('job-vacancy').slice(0,teach?2:1).map(line=>line.replace('{设施}',NARRATOR_PLACES[target]||ITEMS[target].name).replace('{岗位}',spec.name));
 },
}));
// Dialogue follows recent actions. Only optional asides/events have time floors.
export const NARRATION=[
 rule('research-library',s=>has(s,'V11')&&!s.research?.completed.industrial,{kind:'explain',shop:true,surfaces:['item','village'],settle:5,ttl:180,priority:45}),
 rule('research-switch',s=>!!s.research?.active,{kind:'explain',shop:true,surfaces:['item'],ttl:60,priority:35}),
 rule('industrial-era',s=>s.research?.completed.industrial&&!has(s,'M9')&&!s.research?.completed.modern,{kind:'reaction',ttl:60,priority:45}),
 rule('villager-rest',s=>Object.values(s.life?.residents||{}).some(r=>r.phase==='rest'),{kind:'explain',shop:true,surfaces:['village'],ttl:90,priority:35}),
 rule('public-visit',s=>(s.life?.visits||0)>0,{kind:'reaction',ttl:60,priority:15}),
 rule('cart-work',s=>has(s,'V24')&&(s.community?.residents||[]).some(r=>r.job==='hauler'&&r.cargo),{kind:'explain',shop:true,surfaces:['network','village'],ttl:90,priority:30}),
 rule('welfare-running',s=>s.life?.welfare!=='off'&&(s.life?.spent||0)>0,{kind:'explain',shop:true,surfaces:['life','village'],ttl:60,priority:25}),
 ...EASTER_EGGS.map(egg=>rule(`egg:${egg.id}`,s=>s.easterEggs?.entries?.[egg.id]?.status==='claimed',{lines:egg.found,kind:'return',ttl:Infinity,priority:100})),
 rule('rescued',s=>s.guidance.info,{kind:'guide',shop:true,ttl:Infinity,priority:95}),
 rule('companions',s=>s.guidance.info&&s.narrative.seen.includes('rescued')&&!s.narrative.companionsShown,{kind:'guide',shop:true,ttl:Infinity,priority:94}),
 rule('friend',s=>s.guidance.info&&!s.guidance.goals&&s.narrative.companionsShown,{kind:'guide',shop:true,ttl:Infinity,priority:90}),
 rule('rescue-price',s=>s.guidance.info&&s.narrative.companionsShown,{kind:'aside',minPlay:120,quietFor:25,ttl:Infinity,priority:-5}),
 rule('rush',rushing,{kind:'behavior',shop:true,ttl:20,priority:98,stable:true,lines:s=>copy((s.narrative.current?.rushReason||s.narrative.behavior.rushReason)==='milestone'?'rush-milestone':'rush')}),
 rule('grind',s=>!has(s,'V2')&&grinding(s),{kind:'guide',shop:true,minPlay:45,ttl:20,priority:85,stable:true,
  guard:(s,c)=>{const t=c.affordableTarget?.(s);return !!t&&(!s.narrative.current?.target||s.narrative.current.target.id===t.id);},
  lines:s=>copy('grind').map(line=>line.replace('{商品}',s.narrative.current?.target?.name||'下一件商品'))}),
 rule('browse',browsing,{kind:'behavior',shop:true,minPlay:45,ttl:20,priority:30,stable:true,guard:(s,c)=>c.surface?.()==='shop'}),
 rule('rearrange',rearranging,{kind:'behavior',ttl:20,priority:45,stable:true}),
 rule('goals',s=>s.guidance.goals,{shop:true,ttl:25,guard:s=>!s.guidance.collapsed,lines:s=>{const next=priorityInterface(s)||ITEMS[earlyTarget(s)];return [next?`你看看，「目标追踪」建议你下一个买${next.name}。`:'目标追踪已经挂上了。'];}}),
 rule('pick',s=>has(s,'T1')), // Retired copy ID retained for old saves.
 rule('pick-use',s=>has(s,'T1'),{kind:'explain',shop:true,ttl:75,priority:55}),
 rule('land',s=>has(s,'V1'),{kind:'guide',shop:true,priority:60}),
 // Reset a saved candidate from the former four-building gate until eight exist.
 rule('camera-controls',s=>builtFacilities(s)>=8,{kind:'explain',settle:0,quietFor:12,ttl:100,priority:25,lines:()=>copy('camera-'+inputKind())}),
 rule('iron-hold',s=>has(s,'T3'),{kind:'explain',shop:true,ttl:100,priority:65}),
 rule('facility-upgrade',s=>has(s,'V18'),{kind:'guide',shop:true,surfaces:['mail'],ttl:120,priority:80}),
 rule('market-work',s=>has(s,'V3'),{kind:'explain',shop:true,surfaces:['village'],ttl:100,priority:42}),
 rule('land-use',s=>has(s,'V1'),{kind:'explain',shop:true,ttl:90,priority:40}),
 rule('mail',s=>has(s,'V18')&&s.postalIncome>0,{kind:'aside',quietFor:20,ttl:90,lines:s=>has(s,'V1')&&heard(s,'land')?copy('mail'):['这邮箱里居然有绿宝石。']}),
 rule('mail-income',()=>false), // Merged into the immediate mailbox/upgrade lesson.
 rule('resident',s=>has(s,'V2')&&!working(s)&&!!residentVariant(s),{kind:'guide',shop:true,surfaces:['village'],lines:residentAdvice,priority:65}),
 // Buying/assigning quickly can retire resident advice, but never this entry cue.
 rule('manual',s=>needsManualReminder(s)&&s.narrative.companionsShown&&s.narrative.seen.includes('resident'),{kind:'guide',shop:true,surfaces:['village','network','live'],ttl:Infinity,priority:89}),
 rule('work',s=>has(s,'V2'),{kind:'aside',minPlay:180,settle:60,quietFor:35,ttl:Infinity,priority:-5}),
 rule('first-wages',s=>people(s).some(r=>r.jobEarned>0),{ttl:45,priority:35,guard:(s,c)=>!!c.workingVisible?.()}),
 rule('bench',s=>has(s,'T7')&&has(s,'V2'),{ttl:30}),
 rule('music',s=>has(s,'L1'),{guard:(s,c)=>!!c.musicPlaying?.(),priority:40}),
 rule('music-work',s=>has(s,'L1')&&has(s,'V2'),{kind:'explain',shop:true,surfaces:['village'],ttl:120,priority:35}),
 rule('farm',s=>has(s,'V4'),{guard:(s,c)=>!!c.visible?.('V4'),ttl:60}),
 rule('farm-work',s=>has(s,'V4'),{kind:'explain',shop:true,surfaces:['village'],ttl:120,priority:35}),
 rule('power',s=>has(s,'M5'),{guard:(s,c)=>!!c.visible?.('M5'),ttl:90}),
 rule('power-use',s=>has(s,'M5'),{kind:'explain',shop:true,surfaces:['network'],ttl:180,priority:55}),
 rule('haul',s=>has(s,'M4'),{ttl:45}),
 rule('haul-use',s=>has(s,'M4')&&HAUL_SOURCES.some(id=>has(s,id)),{kind:'explain',shop:true,surfaces:['network','village'],ttl:180,priority:50}),
 rule('rail',s=>has(s,'M16'),{guard:(s,c)=>!!c.railRunning?.(),ttl:120}),
 rule('broadcast-available',s=>s.research?.completed.industrial&&has(s,'M9')&&!has(s,'L2'),{kind:'explain',settle:15,quietFor:12,ttl:180,shop:true,surfaces:['network','village','item'],priority:25}),
 rule('live',s=>has(s,'L2'),{ttl:75,shop:true,surfaces:['live'],lines:s=>broadcastStage(s).id==='radio'?[(hasWorker(s,'host')?'主持人已经安排好了。广播挺适合咱们村，开工的动静就够播半天。':has(s,'L4')?'主持席有了，去村庄安排一位主持人，就能来这里开麦。':copy('radio-open')[0]),copy('radio-open')[1]]:copy('live')}),
 rule('television-ready',s=>has(s,'L3')&&broadcastStage(s).id==='television',{ttl:60,shop:true,surfaces:['live']}),
 rule('streaming-ready',s=>has(s,'L5')&&broadcastStage(s).id==='streaming',{ttl:60,shop:true,surfaces:['live']}),
 rule('live-success',s=>(s.live?.income||0)>=5000&&(s.live?.peak||0)>=1000,{minPlay:1200,ttl:120}),
 rule('nether',s=>has(s,'N1'),{kind:'scene',priority:75,guard:(s,c)=>c.realm?.()==='nether',ttl:Infinity}),
 rule('end',s=>has(s,'E2')&&s.endEyes>=12,{kind:'scene',priority:75,guard:(s,c)=>c.realm?.()==='end',ttl:Infinity}),
 rule('project',s=>has(s,'Z2')&&s.project>0&&!s.completed,{ttl:90}),
 rule('ending',s=>s.completed,{kind:'return',ttl:Infinity,priority:90,lines:s=>s.narrative.history.some(h=>h.id==='rescued')?copy('ending'):['真盖完了啊。']}),
 rule('confirmations',s=>s.narrative.confirmations>=10&&!s.skipPurchaseConfirmation,{kind:'explain',shop:true,quietFor:12,ttl:Infinity,priority:20}),
 // A one-time backup reminder also helps returning players. Let opening lessons
 // and purchases finish first; a long menu visit must not expire this reminder.
 rule('building-editing',s=>s.guidance.info&&s.narrative.companionsShown&&(s.housing?.homes.length||0)>=2,{kind:'aside',minPlay:600,quietFor:18,settle:12,ttl:Infinity,priority:12,shop:true,surfaces:['village']}),
 rule('save-transfer',s=>s.guidance.info&&s.narrative.companionsShown&&s.communityStories?.backupAt==null,{kind:'aside',minPlay:480,quietFor:12,settle:12,ttl:Infinity,priority:22,shop:true,surfaces:['village','network']}),
 rule('foreground-return',s=>s.narrative.returnAt!==null&&s.narrative.returnAt!==undefined,{kind:'aside',ttl:60,priority:-10,stable:true}),
 ...VACANCY_RULES,
 ...MIDGAME_NARRATION,
 ...DECORATION_NARRATION,
 ...PERSONALITY_SUGGESTIONS,
 ...COMMUNITY_NARRATION,
];
export const IDLE_LINES=[
 rule('idle-shop',s=>has(s,'V18'),{kind:'idle',minPlay:720,ttl:Infinity}),
 rule('idle-workers',busyWorkers,{kind:'idle',minPlay:1320,ttl:Infinity,guard:(s,c)=>!!c.workingVisible?.()}),
 rule('idle-machine',s=>has(s,'M5'),{kind:'idle',minPlay:2100,ttl:Infinity,guard:(s,c)=>!!c.runningMachine?.()}),
 ...MIDGAME_IDLE,
];
const all=[...NARRATION,...IDLE_LINES],byId=new Map(all.map(r=>[r.id,r]));
const rushSkippable=new Set(['goals','bench','browse']);
const obsolete={rescued:s=>has(s,'V2'),friend:s=>s.guidance.goals||has(s,'V2'),pick:s=>has(s,'V1'),land:s=>has(s,'V18'),mail:s=>has(s,'V2'),resident:working,bench:s=>has(s,'M1'),music:s=>has(s,'L2'),project:s=>s.completed,confirmations:s=>s.skipPurchaseConfirmation};
Object.assign(obsolete,{
 'research-library':s=>!!s.research?.completed.industrial,
 'research-switch':s=>Object.keys(s.research?.completed||{}).length===4,
 'industrial-era':s=>has(s,'M9')||!!s.research?.completed.modern,
 'welfare-running':s=>s.life?.welfare==='off'&&(s.life?.spent||0)>0,
 'goals':s=>has(s,'T1'),
 'mail-income':()=>true,
 'pick-use':s=>has(s,'V1'),
 'facility-upgrade':s=>(s.mail?.postalLevel||0)>1,
 'market-work':s=>hasWorker(s,'merchant'),
 'land-use':s=>Object.keys(s.placements||{}).length>=4,
 'music-work':s=>hasWorker(s,'musician')||has(s,'L2'),
 'farm-work':s=>hasWorker(s,'farmer')||(s.grid?.automation?.farm||0)>0,
 'power-use':s=>s.grid?.learnedConnection===true,
 'haul-use':s=>hasWorker(s,'hauler'),
});
for(const r of VACANCY_RULES){const job=r.id.slice('vacancy:'.length);obsolete[r.id]=s=>jobAvailable(s,job)&&!openJob(s,job);}
export const narrationGap=s=>s.play<900?20:90; // Idle pacing, never an opening-guide gate.
const mark=(n,id)=>{if(!n.seen.includes(id))n.seen.push(id);};
function discard(n,id){mark(n,id);if(n.current?.id===id){n.current=null;n.silence=0;n.gap=Math.max(n.gap,3);}}
export function reconcileNarrative(s,context={}){
 if(openingChoicePending(s))return false;
 const n=s.narrative;let changed=discoverCommunityWealth(s);n.eligibleAt||={};observeNarrativeBehavior(s);
 for(const r of all){
  if(n.seen.includes(r.id))continue;
  if(!narrationAllowed(s,r)){discard(n,r.id);delete n.eligibleAt[r.id];changed=true;continue;}
  // A busy return should not become a stale anecdote. A later real absence may
  // offer it again; a completed telling remains in seen like other narration.
  if(r.id==='foreground-return'&&n.returnAt!=null&&s.play-n.returnAt>60&&n.current?.id!==r.id){n.returnAt=null;delete n.eligibleAt[r.id];changed=true;continue;}
  if(obsolete[r.id]?.(s)||r.id==='pick'){traceNarrative(s,'skipped',r.id,'condition-obsolete');mark(n,r.id);changed=true;continue;}
  const matches=r.when(s)&&s.play>=r.minPlay&&(!r.guard||r.guard(s,context));
  if(r.settle!==undefined&&!matches&&n.current?.id!==r.id&&n.eligibleAt[r.id]!==undefined){delete n.eligibleAt[r.id];changed=true;}
  if(matches&&n.eligibleAt[r.id]===undefined){n.eligibleAt[r.id]=s.play;traceNarrative(s,'candidate',r.id,'conditions-met');changed=true;}
  const ready=n.eligibleAt[r.id]!==undefined;
  if(ready&&rushing(s)&&rushSkippable.has(r.id)){
   if(n.current?.id===r.id){if(n.current.blockedFor>0){discard(n,r.id);changed=true;}else if(!n.current.dropAfterLine){n.current.dropAfterLine=true;changed=true;}}
   else {traceNarrative(s,'skipped',r.id,'experienced-player');mark(n,r.id);changed=true;}
  }
  if(ready&&s.play-n.eligibleAt[r.id]>r.ttl&&(n.current?.id!==r.id||(n.current.blockedFor||0)>12)){traceNarrative(s,'skipped',r.id,'expired');discard(n,r.id);changed=true;}
 }
 const c=n.current;if(!c)return changed;const r=byId.get(c.id);
 const purchasedDuringAside=['browse','grind'].includes(c.id)&&c.purchaseSerial!==undefined&&n.behavior.purchaseSerial!==c.purchaseSerial;
 if(obsolete[c.id]?.(s)||(r&&!r.stable&&!r.when(s))||purchasedDuringAside||(c.id==='resident'&&c.variant&&c.variant!==residentVariant(s))){discard(n,c.id);return true;}
 if(c.index>=narrationLines(s,c.id).length){discard(n,c.id);return true;}
 return changed;
}
const safeCount=v=>Number.isFinite(v)?Math.max(0,Math.floor(v)):0;
export function freshNarrative(){return {version:1,cadenceVersion:6,openingChoice:'pending',manualVisited:false,manualPrompted:false,legacy:false,intro:'waiting',companionsVersion:2,companionsShown:false,muteReactionSeen:false,voiceMuteReactionSeen:false,seen:[],history:[],current:null,returnAt:null,lastVacancyAt:null,vacancyGuideShown:false,lastCosmeticAt:null,lastSuggestionAt:null,gap:0,silence:90,quiet:0,confirmations:0,eligibleAt:{},spokenAt:[],behavior:freshNarrativeBehavior()};}
export function restoreNarrative(raw,s){
 const n=freshNarrative();n.behavior=restoreNarrativeBehavior(raw?.behavior,s);
 // Existing saves continue their current story, without a retroactive question.
 n.openingChoice=['pending','first','returning'].includes(raw?.openingChoice)?raw.openingChoice:'legacy';
 n.manualVisited=raw?.manualVisited===true;n.manualPrompted=raw?.manualPrompted===true;
 if(!raw||raw.version!==1){n.legacy=true;n.intro='skipped';n.companionsShown=true;n.seen=NARRATION.filter(r=>r.id!=='confirmations'&&(r.when({...s,narrative:n})||obsolete[r.id]?.(s))).map(r=>r.id);if(n.companionsShown)mark(n,'companions');return n;}
 n.legacy=raw.legacy===true;n.intro=['waiting','calling','captured','rescued','skipped'].includes(raw.intro)?raw.intro:'waiting';
 n.seen=[...new Set((Array.isArray(raw.seen)?raw.seen:[]).filter(id=>byId.has(id)))];
 // Existing worlds keep their free tools without replaying the opening.
 n.companionsShown=raw.companionsVersion!==2||raw.companionsShown===true||(raw.companionsShown===undefined&&!!s.guidance.info)||n.seen.includes('companions');
 n.muteReactionSeen=raw.muteReactionSeen===true;
 n.voiceMuteReactionSeen=raw.voiceMuteReactionSeen===true;
 if(n.companionsShown)mark(n,'companions');
 n.history=(Array.isArray(raw.history)?raw.history:[]).filter(h=>byId.has(h.id)&&typeof h.text==='string').slice(-32).map(h=>({id:h.id,text:h.text.slice(0,400)}));
 n.vacancyGuideShown=raw.vacancyGuideShown===true||n.history.some(h=>h.id.startsWith('vacancy:')&&h.text.includes(copy('job-vacancy')[1]));
 n.confirmations=safeCount(raw.confirmations);n.gap=Math.min(90,safeCount(raw.gap));n.quiet=Math.min(180,safeCount(raw.quiet));
 n.lastVacancyAt=Number.isFinite(raw.lastVacancyAt)?Math.max(0,Math.min(s.play,raw.lastVacancyAt)):null;
 for(const key of ['lastCosmeticAt','lastSuggestionAt'])n[key]=Number.isFinite(raw[key])?Math.max(0,Math.min(s.play,raw[key])):null;
 n.silence=Number.isFinite(raw.silence)?Math.min(180,Math.max(0,raw.silence)):90;
 n.spokenAt=(Array.isArray(raw.spokenAt)?raw.spokenAt:[]).filter(at=>Number.isFinite(at)&&at<=s.play&&s.play-at<60).slice(-8);
 for(const [id,at] of Object.entries(raw.eligibleAt||{}))if(byId.has(id)&&Number.isFinite(at))n.eligibleAt[id]=Math.min(s.play,Math.max(0,at));
 const c=raw.current;
 if(c&&(c.id==='rescue'||byId.has(c.id))){
  n.current={id:c.id,index:Math.min(4,safeCount(c.index)),elapsed:Math.min(30,Math.max(0,Number(c.elapsed)||0)),blockedFor:Math.min(90,safeCount(c.blockedFor)),startedAt:Number.isFinite(c.startedAt)?Math.min(s.play,c.startedAt):s.play,
   purchaseSerial:Number.isFinite(c.purchaseSerial)?c.purchaseSerial:n.behavior.purchaseSerial,
   ...(c.variant&&['resident-vacant','resident-no-music'].includes(c.variant)?{variant:c.variant}:{}),...(c.dropAfterLine?{dropAfterLine:true}:{})};
  if(c.id.startsWith('vacancy:'))n.current.vacancyGuide=typeof c.vacancyGuide==='boolean'?c.vacancyGuide:!n.vacancyGuideShown;
  if(c.target&&typeof c.target.id==='string'&&typeof c.target.name==='string')n.current.target={id:c.target.id.slice(0,64),name:c.target.name.slice(0,32)};
  if(['burst','milestone'].includes(c.rushReason))n.current.rushReason=c.rushReason;
 }
 // Keep heard/skipped copy. Do not infer player behavior from old purchases.
 if(![1,2,3,4,5,6].includes(raw.cadenceVersion))for(const r of NARRATION){if(r.id!==c?.id&&!['rescued','friend','confirmations','ending'].includes(r.id)&&!r.id.startsWith('egg:')&&r.when({...s,narrative:n})&&!n.seen.includes(r.id))mark(n,r.id);}
 if(![2,3,4,5,6].includes(raw.cadenceVersion)&&people(s).some(r=>r.jobEarned>0))mark(n,'first-wages');
 if(![3,4,5,6].includes(raw.cadenceVersion))for(const id of EARLY_HELP){const r=byId.get(id);if(r.when({...s,narrative:n})||obsolete[id]?.(s))mark(n,id);}
 if(![4,5,6].includes(raw.cadenceVersion))for(const id of ['camera-controls','iron-hold','facility-upgrade','market-work']){
  // Legacy migrations use the old qualification, not today's delayed camera
  // threshold, so previously skipped instructions do not return after building.
  const r=byId.get(id);if((id==='camera-controls'?has(s,'V1'):r.when({...s,narrative:n}))||obsolete[id]?.(s))mark(n,id);
 }
 if(![5,6].includes(raw.cadenceVersion))for(const r of MIDGAME_NARRATION){
  // Do not announce old unlocks in a pile. Unresolved problems can still get
  // timely help; they must pass the normal settle window after loading.
  delete n.eligibleAt[r.id];
  if(!r.catchUp&&(r.learned||r.when)({...s,narrative:n}))mark(n,r.id);
 }
 if(raw.cadenceVersion!==6){
  // Old buildings are not newly vacant. Preserve heard dialogue and teach only
  // newly available job types after this update, without touching work or money.
  for(const r of VACANCY_RULES)if(jobAvailable(s,r.id.slice('vacancy:'.length)))mark(n,r.id);
  if(s.guidance.info)mark(n,'rescue-price');
  delete n.eligibleAt.work;
  if(n.current?.id==='work'){mark(n,'work');n.current=null;}
  if(n.current?.id==='mail-income')n.current=null;
 }
 if(n.companionsShown&&n.current?.id==='companions')n.current=null;
 // Only an already-visible return line resumes. Reloading is not an absence.
 delete n.eligibleAt['foreground-return'];
 if(n.current?.id==='foreground-return')n.returnAt=s.play;
 if(n.openingChoice==='returning'){n.intro='skipped';n.companionsShown=true;if(n.current?.id==='rescue'||(n.current&&byId.has(n.current.id)&&!narrationAllowed({...s,narrative:n},byId.get(n.current.id))))n.current=null;}
 return n;
}
export function notePurchaseConfirmation(s,{manual,paid}){if(manual&&paid>0&&Number.isFinite(paid))s.narrative.confirmations++;}
export function setNarrationEnabled(s,enabled){
 const n=s.narrative,next=!!enabled,react=!!s.guidance.info&&s.guidance.notices&&!next&&!n.muteReactionSeen;
 s.guidance.notices=next;
 if(!next){
  if(n.current){mark(n,n.current.id);n.current=null;}
  n.companionsShown=true;mark(n,'companions');n.silence=0;
 }
 if(react)n.muteReactionSeen=true;
 return react;
}
export function narrationLines(s,id){if(id==='rescue')return copy('rescue');const row=byId.get(id);return !row?[]:typeof row.lines==='function'?row.lines(s):row.lines;}
export function currentNarration(s){const c=s.narrative.current;if(!c)return null;const lines=narrationLines(s,c.id),r=byId.get(c.id),expressionId=r?.cosmetic?decorationCopy(s):c.id;return {id:c.id,text:lines[c.index]||'',index:c.index,total:lines.length,elapsed:c.elapsed,startedAt:c.startedAt,speaking:c.elapsed<lineDuration(r,lines,c.index),shop:r?.shop===true,surfaces:r?.surfaces,expressionId,voiceId:c.variant||expressionId};}
export function chooseNarratorOffer(s,id,accept){
 const n=s.narrative,c=n.current,row=byId.get(id),offer=narratorOffer(s,id);
 if(!s.guidance.info||!s.guidance.notices||narratorAway(s)||c?.id!==id||!row?.offer)return {ok:false};
 if(accept&&!offer?.ready)return {ok:false};
 const text=narrationLines(s,id).slice(0,c.index+1).join(' ');
 mark(n,id);n.history=[...n.history,{id,text}].slice(-32);n.current=null;n.quiet=0;n.silence=0;n.gap=20;
 return {ok:true,purchase:accept?offer:null};
}
function delay(r){return r.kind==='idle'?60:NARRATOR_LINE_REST;}
function lineDuration(row,lines,index){return row?.offer&&index===lines.length-1?12:narratorReadingTime(lines[index]);}
export function advanceNarrative(s,dt,options={}) {
 const tracing=hasNarrativeTrace(s), before=tracing&&s.narrative.current?{...s.narrative.current}:null;
 const result=advanceNarrativeStep(s,dt,options);
 if(tracing){
  const n=s.narrative,c=n.current,{available=true,context={},canPresent=()=>true}=options;
  if(c&&(!before||c.id!==before.id||c.index!==before.index))traceNarrative(s,'spoken',c.id,'line-visible',{index:c.index,text:currentNarration(s).text});
  if(before&&before.id!==c?.id)traceNarrative(s,n.history.some(h=>h.id===before.id)?'completed':'interrupted',before.id,'dialogue-ended');
  for(const r of all){
   if(n.seen.includes(r.id)||n.eligibleAt[r.id]===undefined||c?.id===r.id)continue;
   const reason=!s.guidance.notices?'muted':!available?'interaction-or-receipt':narratorAway(s)?'narrator-away':
    !canPresent(r)?'panel-hidden':r.guard&&!r.guard(s,context)?'scene-not-visible':!r.when(s)?'condition-no-longer-met':
    c?'another-dialogue':n.silence<delay(r,s)?'reading-gap':r.settle!==undefined&&s.play-n.eligibleAt[r.id]<r.settle?'settling':
    r.quietFor!==undefined&&n.quiet<r.quietFor?'waiting-for-quiet':n.spokenAt.length>=(s.play<900?3:2)?'frequency-limit':'priority-or-special-gate';
   traceNarrative(s,'waiting',r.id,reason);
  }
 }
 return result;
}
function advanceNarrativeStep(s,dt,{available=true,context={},canPresent=()=>true,reconcile=true}={}){
 if(!Number.isFinite(dt)||dt<=0||openingChoicePending(s))return {changed:false};
 // The UI performs this once before choosing between dialogue and egg offers.
 // Simulation callers retain the default reconciliation on every step.
 dt=Math.min(1,dt);const reconciled=reconcile&&reconcileNarrative(s,context),n=s.narrative;
 // Foreground cooling continues behind receipts/menus. Only visible sentences
 // consume reading time. This prevents every purchase adding another long wait.
 n.silence=Math.min(180,(n.silence??90)+dt);n.gap=Math.max(0,n.gap-dt);
 if(s.guidance.info&&['waiting','calling','captured'].includes(n.intro)){n.intro='rescued';if(n.current?.id==='rescue')n.current=null;}
 if(!s.guidance.info&&Object.values(s.counts).some(v=>v>0)&&['waiting','calling'].includes(n.intro)){n.intro='skipped';n.current=null;}
 if(s.guidance.info&&!s.guidance.notices){const ignored=NARRATION.filter(r=>r.kind!=='return'&&!n.seen.includes(r.id)&&r.when(s)).map(r=>r.id);const changed=!!n.current||ignored.length>0;n.current=null;n.seen.push(...ignored);n.companionsShown=true;mark(n,'companions');if(needsManualReminder(s))mark(n,'manual');return {changed:reconciled||changed};}
 if(!available||narratorAway(s)||(n.current&&!canPresent(byId.get(n.current.id)))){
  n.quiet=0;if(n.current)n.current.blockedFor=(n.current.blockedFor||0)+dt;return {changed:reconciled};
 }
 const allowed=s.guidance.info&&s.guidance.notices;
 if(!allowed&&n.current?.id!=='rescue')n.current=null;
 n.spokenAt=n.spokenAt.filter(at=>s.play-at<60);
 const canSpeak=r=>narrationAllowed(s,r)&&!n.seen.includes(r.id)&&s.play>=r.minPlay&&r.when(s)&&canPresent(r)&&(!r.guard||r.guard(s,context))&&n.silence>=delay(r,s)&&
  (r.quietFor===undefined||n.quiet>=r.quietFor)&&
  (!r.id.startsWith('vacancy:')||n.lastVacancyAt==null||s.play-n.lastVacancyAt>=120)&&
  (!r.community||((s.communityStories?.lastStoryAt==null||s.play-s.communityStories.lastStoryAt>=300)&&(s.easterEggs?.lastOfferAt==null||s.play-s.easterEggs.lastOfferAt>=240)))&&
  (!r.cosmetic||n.lastCosmeticAt==null||s.play-n.lastCosmeticAt>=120)&&
  (!r.offer||n.lastSuggestionAt==null||s.play-n.lastSuggestionAt>=360)&&
  (r.settle===undefined||(n.eligibleAt[r.id]!==undefined&&s.play-n.eligibleAt[r.id]>=r.settle))&&
  (!['reaction','explain','aside','suggestion'].includes(r.kind)||n.spokenAt.length<(s.play<900?3:2))&&!(rushing(s)&&rushSkippable.has(r.id));
 if(!n.current){
  n.quiet+=dt;
  if(!s.guidance.info&&['waiting','calling'].includes(n.intro)&&s.money>=10){n.intro='calling';n.current={id:'rescue',index:0,elapsed:0,startedAt:s.play};}
  else if(allowed){
   const ready=NARRATION.filter(canSpeak);
   const next=ready.filter(r=>r.id!=='foreground-return'||(s.play-n.returnAt>=3&&n.quiet>=3&&ready.length===1)).sort((a,b)=>b.priority-a.priority||(n.eligibleAt[b.id]??0)-(n.eligibleAt[a.id]??0))[0]||(n.quiet>=180&&n.gap===0?IDLE_LINES.find(canSpeak):null);
   if(next){
    n.behavior.lastNarrationAt=s.play;
    n.current={id:next.id,index:0,elapsed:0,blockedFor:0,startedAt:s.play,purchaseSerial:n.behavior.purchaseSerial,...(next.id==='resident'?{variant:residentVariant(s)}:{}),...(next.id==='grind'?{target:context.affordableTarget(s)}:{})};
    if(next.community)s.communityStories.lastStoryAt=s.play;
    if(next.id==='rush')n.current.rushReason=n.behavior.rushReason;
    if(next.id==='manual')n.manualPrompted=true;
    if(next.cosmetic){const item=recentDecoration(s);n.current.target={id:item.id,name:item.name};n.lastCosmeticAt=s.play;}
    if(next.offer)n.lastSuggestionAt=s.play;
    if(next.id.startsWith('vacancy:')){n.lastVacancyAt=s.play;n.current.vacancyGuide=!n.vacancyGuideShown;}
    if(['reaction','explain','aside','suggestion'].includes(next.kind))n.spokenAt.push(s.play);
    if(next.kind==='reaction'){
     // A recent observation replaces older pending observations, not core help.
     for(const r of NARRATION)if(r.kind==='reaction'&&n.eligibleAt[r.id]!==undefined&&n.eligibleAt[r.id]<n.eligibleAt[next.id])mark(n,r.id);
    }
   }
  }
  return {changed:reconciled||!!n.current};
 }
 const c=n.current,row=byId.get(c.id);c.blockedFor=0;
 n.behavior.lastNarrationAt=s.play;
 if(row?.guard&&!row.guard(s,context)){
  if(row.kind==='scene'){
   // Leaving before hearing the introduction is not the same as hearing it.
   // Retry on a future visit, never announce the wrong world from a menu.
   n.current=null;delete n.eligibleAt[c.id];n.silence=0;
   traceNarrative(s,'waiting',c.id,'left-scene');
  }else discard(n,c.id);
  return {changed:true};
 }
 const lines=narrationLines(s,c.id),line=lines[c.index];c.elapsed+=dt;
 const duration=lineDuration(row,lines,c.index),rest=c.index<lines.length-1&&!c.dropAfterLine?NARRATOR_LINE_REST:0;
 // Keep the last subtitle visible during the quiet beat: mobile layout stays
 // still, while audio stops before the next sentence appears.
 if(line&&c.elapsed<duration+rest)return {changed:reconciled};
 c.index++;c.elapsed=0;
 if(c.id.startsWith('vacancy:')&&c.index>=2)n.vacancyGuideShown=true;
 if(c.index<lines.length&&!c.dropAfterLine){reconcileNarrative(s,context);return {changed:true};}
 const captured=c.id==='rescue';if(captured)n.intro='captured';else{mark(n,c.id);n.history=[...n.history,{id:c.id,text:lines.slice(0,c.index).join(' ')}].slice(-32);}
 const companions=c.id==='companions';if(companions)n.companionsShown=true;
 n.current=null;n.gap=captured?0:narrationGap(s);n.silence=0;n.quiet=0;return {changed:true,captured,companions};
}
