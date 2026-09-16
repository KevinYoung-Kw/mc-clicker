import { NARRATOR_COPY } from './narrator-copy.js';
// Original 16×16 paper face. Blinking swaps pixel eyelids; the SVG never stretches.
const expressions = {
 plain:{eyes:[[5,6,2,2],[10,6,2,2]],lids:[[5,7,2,1],[10,7,2,1]],marks:[[6,11,5,1]]},
 notice:{marks:[[7,4,2,5],[7,11,2,2]]},
 thinking:{eyes:[[5,7,2,2],[10,7,2,2]],lids:[[5,8,2,1],[10,8,2,1]],marks:[[4,5,4,1],[8,11,2,1],[10,12,3,2]]},
 smirk:{eyes:[[6,7,2,2],[11,8,2,1]],lids:[[6,8,2,1],[11,8,2,1]],marks:[[4,5,4,1],[10,6,3,1],[6,11,4,1],[10,10,2,1]]},
 smile:{eyes:[[4,6,2,2],[10,6,2,2]],lids:[[4,7,2,1],[10,7,2,1]],marks:[[5,10,1,2],[6,12,4,1],[10,10,1,2]]},
 muffled:{eyes:[[4,5,2,2],[10,5,2,2]],lids:[[4,6,2,1],[10,6,2,1]],marks:[]},
 pause:{marks:[[4,8,3,1],[9,8,3,1],[7,12,2,1]]},
};
const pixels=parts=>parts.map(([x,y,w,h])=>`<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`).join('');
export function noticeFace(expression='plain',accessory=null) {
 const face=expressions[expression]||expressions.plain;
 const bow=accessory==='date-bow';
 return `<svg class="notice-face" data-accessory="${bow?'date-bow':''}" data-expression="${expressions[expression]?expression:'plain'}" viewBox="0 0 16 ${bow?20:16}" width="32" height="${bow?40:32}" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true"><path opacity=".13" d="M2 1h10v2h2v11H2z"/><path opacity=".7" d="M2 0h10v1H2zM1 1h1v13H1zM2 14h12v1H2zM14 3h1v11h-1zM12 1h1v1h-1zM13 2h1v1h-1z"/>${face.eyes?`<g class="notice-eyes-open">${pixels(face.eyes)}</g><g class="notice-eyes-closed" opacity="0">${pixels(face.lids)}</g>`:''}${pixels(face.marks)}${expression==='muffled'?'<g class="notice-gag" data-mouth="x"><path d="M5 9h1v1H5zM9 9h1v1H9zM6 10h1v1H6zM8 10h1v1H8zM7 11h1v1H7zM6 12h1v1H6zM8 12h1v1H8zM5 13h1v1H5zM9 13h1v1H9z"/></g>':''}${bow?'<g class="date-bow"><path fill="#703f40" d="M2 15h3v1h6v-1h3v5h-3v-1H5v1H2z"/><path fill="#bd655a" d="M3 16h2v1h2v1H5v1H3zM13 16h-2v1H9v1h2v1h2z"/><path fill="#e3a083" d="M7 16h2v3H7z"/></g>':''}</svg>`;
}
export function narrationExpression(id) {
 return id==='egg:after-hours'?'smirk':NARRATOR_COPY[id]?.expression||'plain';
}
// The same bag appears in the capture, the storefront and the persistent hint.
export function captiveNotice() {
 return `<span class="captive-bag-art" aria-hidden="true"><span class="captive-handle"></span><span class="captive-face">${noticeFace('thinking')}</span><span class="captive-bag-front"></span><span class="captive-seal">!</span></span>`;
}
