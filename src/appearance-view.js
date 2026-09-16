import { WEB_BY_ID } from './web-catalog.js';
import { cursorArt, badgeArt, titleArt, artURL, ART_COLORS, titleInk } from './web-art.js';
import { cursorHotspot } from './web-cursors.js';
export function applyWebAppearance(s,equipped=s.webAppearance.equipped) {
 const b=document.body;
 for(const [key,slot] of [['theme','theme'],['notice','notice'],['cursor','cursor']])b.dataset[key]=equipped[slot]||'';
 b.dataset.frame='';b.classList.remove('custom-cursor');
 const cursor=WEB_BY_ID[equipped.cursor];
 if(cursor) {
  for(const [property,mode,fallback] of [['--web-cursor','default','default'],['--web-pointer','pointer','pointer'],['--web-grab','grab','grab'],['--web-grabbing','grabbing','grabbing']])
   b.style.setProperty(property,`url("${artURL(cursorArt(cursor.id,mode))}") ${cursorHotspot(cursor.id,mode).join(' ')}, ${fallback}`);
  b.style.setProperty('--cursor-color',(ART_COLORS[cursor.id.slice(11)]||ART_COLORS.stone)[0]);
 } else {for(const k of ['--web-cursor','--web-pointer','--web-grab','--web-grabbing','--cursor-color'])b.style.removeProperty(k);}
 const title=WEB_BY_ID[equipped.title],label=document.querySelector('#world-label'),eyebrow=label.querySelector('.eyebrow');
 label.dataset.titleStyle=title?.id||'';
 eyebrow.textContent=title?(s.webAppearance.legacyAliases[title.id]||title.titleText):'A WORLD OF YOUR OWN';
 eyebrow.style.setProperty('--title-ink',title?titleInk(title.id):'');
 if(title)eyebrow.style.setProperty('--title-art',`url("${artURL(titleArt(title.id))}")`);else eyebrow.style.removeProperty('--title-art');
 if(title)document.title=eyebrow.textContent+' · MC Clicker 2.0';
 document.querySelector('#favicon').href=artURL(badgeArt(equipped.icon||'web-icon-emerald'));
 return {title,cursor};
}
