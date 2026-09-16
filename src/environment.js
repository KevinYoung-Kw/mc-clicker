// Cosmetic environment simulation. Called only by the foreground game tick.
export const ENV_MODULES = [
  {id:'env-sundial', name:'日晷', cost:160, requires:[], desc:'让世界每 8 分钟经历一次昼夜，也可以停在你喜欢的时刻。'},
  {id:'env-weather', name:'气象仪', cost:240, requires:[], desc:'选择晴天、多云，或让天气自动变化。雨天和雪天需要另外购买仪器。'},
  {id:'env-rain', name:'雨量仪', cost:360, requires:['env-weather'], desc:'让世界下起像素雨，地面变湿，直播间窗外也能看到雨景。'},
  {id:'env-snow', name:'雪景模块', cost:900, requires:['env-weather'], desc:'让世界飘起方形雪花，在地面和屋顶留下薄雪。'},
  {id:'env-stars', name:'星象仪', cost:2200, requires:['env-sundial'], desc:'夜晚可以看到星空和流星；看到过的景象会记入观测记录。'},
];
export const ENV_BY_ID = Object.fromEntries(ENV_MODULES.map(i=>[i.id,i]));
export const ENV_RECORDS = {rain:'雨中村庄', snow:'第一场雪', stars:'星空之夜', fireflies:'萤火之夜', meteor:'流星时刻'};
export const ENV_LEGACY = {'world-day':'env-sundial','world-weather':'env-weather','world-rain':'env-rain','world-snow':'env-snow','world-fireflies':'env-stars','world-meteor':'env-stars'};
export const freshEnvironment = () => ({version:1,access:{legacy:false,pending:false},modules:{},enabled:{},clock:0,phase:.5,cycle:true,weather:'clear',auto:false,seed:0x4d434c,weatherEpoch:0,palette:'',palettes:[],seen:[],observed:{},meteorAt:0,meteorEpoch:0});
export const environmentAccess = s => !!(s.counts.V19 || s.environment?.access.legacy);
export const environmentEnabled = (s,id) => !!s.environment?.modules[id] && s.environment.enabled[id] !== false;
export function environmentPhase(s) {
  const e=s.environment;
  return e && environmentEnabled(s,'env-sundial') ? e.phase : .5;
}
export const nightAmount = phase => {
  const t=phase*480;
  const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
  return t<92||t>=440?1:t<140?1-smooth((t-92)/48):t<380?0:smooth((t-380)/60);
};
export function environmentWeather(s) {
  const e=s.environment;
  if(!e || !environmentEnabled(s,'env-weather')) return 'clear';
  return ['rain','snow'].includes(e.weather) && !environmentEnabled(s,'env-'+e.weather) ? 'clear' : e.weather;
}
export function buyEnvironment(s,id) {
  const item=ENV_BY_ID[id],e=s.environment;
  if(!item || !environmentAccess(s)) return {ok:false,reason:'需要先建造观象台'};
  if(e.modules[id]) return {ok:false,reason:'已拥有'};
  const missing=item.requires.filter(x=>!e.modules[x]);
  if(missing.length) return {ok:false,reason:'需要先购买'+missing.map(x=>ENV_BY_ID[x].name).join('、')};
  if(s.money<item.cost) return {ok:false,reason:`还差 ${Math.ceil(item.cost-s.money)} 绿宝石`};
  s.money-=item.cost;e.modules[id]=true;e.enabled[id]=true;
  if(id==='env-sundial') e.cycle=true;
  if(id==='env-stars') {e.enabled.meteor=true;e.enabled.stars=true;}
  if(id==='env-rain'||id==='env-snow') {e.weather=id.slice(4);e.auto=false;e.enabled['env-weather']=true;}
  return {ok:true,cost:item.cost};
}
export function setEnvironment(s,change) {
  if(!environmentAccess(s)) return false;
  const e=s.environment;
  if(typeof change.cycle==='boolean' && e.modules['env-sundial']) {e.cycle=change.cycle;e.enabled['env-sundial']=true;}
  if(Number.isFinite(change.phase) && e.modules['env-sundial']) {e.phase=Math.max(0,Math.min(.99999,change.phase));e.cycle=false;e.enabled['env-sundial']=true;}
  if(typeof change.auto==='boolean' && e.modules['env-weather']) {e.auto=change.auto;e.enabled['env-weather']=true;}
  if(['clear','cloudy','rain','snow'].includes(change.weather) && e.modules['env-weather'] && (!['rain','snow'].includes(change.weather)||e.modules['env-'+change.weather])) {e.weather=change.weather;e.auto=false;e.enabled['env-weather']=true;if(e.modules['env-'+change.weather])e.enabled['env-'+change.weather]=true;}
  if(change.toggle && (e.modules[change.toggle] || ['stars','meteor','fireflies'].includes(change.toggle)&&e.modules['env-stars'])) e.enabled[change.toggle]=!!change.value;
  if(change.palette==='' || e.palettes.includes(change.palette)) e.palette=change.palette;
  return true;
}
export function resetEnvironment(s) {const e=s.environment;Object.assign(e,{phase:.5,cycle:false,weather:'clear',auto:false,palette:''});for(const k of Object.keys(e.enabled))e.enabled[k]=false;}
function randomWeather(e) {
  e.seed=(Math.imul(e.seed,1664525)+1013904223)>>>0;
  const options=['clear','clear','clear','clear','cloudy','cloudy','cloudy',...(e.modules['env-rain']&&e.enabled['env-rain']!==false?['rain','rain']:[]),...(e.modules['env-snow']&&e.enabled['env-snow']!==false?['snow']:[])];
  return options[e.seed%options.length];
}
export function advanceEnvironment(s,dt) {
  const e=s.environment;
  if(!e || dt<=0 || !Number.isFinite(dt))return;
  e.clock+=dt;
  if(environmentEnabled(s,'env-sundial')&&e.cycle)e.phase=(e.phase+dt/480)%1;
  const epoch=Math.floor(e.clock/180);
  if(epoch>e.weatherEpoch && e.auto && environmentEnabled(s,'env-weather')) e.weather=randomWeather(e);
  e.weatherEpoch=epoch;
  const remember=id=>{if(!e.seen.includes(id)){e.seen.push(id);(e.observed||={})[id]={clock:e.clock,phase:environmentPhase(s)};}};
  const w=environmentWeather(s),night=nightAmount(environmentPhase(s));
  if(w==='rain'||w==='snow')remember(w);
  if(night>.7&&environmentEnabled(s,'env-stars')) {
    if(e.enabled.stars!==false)remember('stars');
    if(e.enabled.fireflies)remember('fireflies');
    if(e.enabled.meteor && e.clock-e.meteorAt>=360) {e.meteorAt=e.clock;remember('meteor');}
  }
  // Observations deliberately do not call game.emit(): no viewers, orders or money.
}
export function restoreEnvironment(raw) {
  const e=freshEnvironment();if(raw?.version!==1)return e;
  for(const id of Object.keys(ENV_BY_ID)) if(raw.modules?.[id]===true)e.modules[id]=true;
  for(const id of [...Object.keys(ENV_BY_ID),'stars','meteor','fireflies'])if(typeof raw.enabled?.[id]==='boolean')e.enabled[id]=raw.enabled[id];
  e.access={legacy:raw.access?.legacy===true,pending:raw.access?.pending===true};
  for(const key of ['clock','phase','weatherEpoch','meteorEpoch'])if(Number.isFinite(raw[key])&&raw[key]>=0)e[key]=raw[key];
  e.phase=Math.min(.99999,e.phase);e.seed=Number.isInteger(raw.seed)?raw.seed>>>0:e.seed;
  e.meteorAt=Number.isFinite(raw.meteorAt)?raw.meteorAt:e.clock;
  e.cycle=raw.cycle===true;e.auto=!!e.modules['env-weather']&&raw.auto===true;
  if(['clear','cloudy','rain','snow'].includes(raw.weather))e.weather=raw.weather;
  e.palettes=['legacy-sky-0','legacy-sky-1','legacy-sky-2'].filter(id=>raw.palettes?.includes(id));
  e.palette=e.palettes.includes(raw.palette)?raw.palette:'';
  e.seen=Object.keys(ENV_RECORDS).filter(id=>raw.seen?.includes(id));
  for(const id of e.seen){const at=raw.observed?.[id];if(at&&Number.isFinite(at.clock)&&at.clock>=0&&Number.isFinite(at.phase)&&at.phase>=0&&at.phase<1)e.observed[id]={clock:at.clock,phase:at.phase};}
  return e;
}
