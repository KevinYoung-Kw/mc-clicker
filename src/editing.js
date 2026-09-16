const continuousKeys = {land:'landContinuous',garden:'gardenContinuous',home:'homeContinuous'};
export function editingPreference(s, kind) {
  return !!continuousKeys[kind] && s.editing?.[continuousKeys[kind]] === true;
}
export function setEditingPreference(s, kind, value) {
  if (!continuousKeys[kind]) return;
  s.editing ||= {};
  s.editing[continuousKeys[kind]] = value === true;
}
export const editFamily = kind => ['expand','land-store'].includes(kind) ? 'land' : kind==='terrain-paint'||kind?.startsWith('garden-') ? 'garden' : kind?.startsWith('home-') ? 'home' : null;
export function repeatPlacement(s, placement) {
  return !!editFamily(placement?.kind) && editingPreference(s, editFamily(placement.kind));
}

// A layout preference, independent of non-spatial purchases. Only an explicit
// valid site click can commit. Clearing/removing still requires confirmation.
export function skipPlacementConfirmation(s, placement) {
  return s.skipBuildConfirmation === true &&
    ['expand', 'build', 'home-build', 'garden-build', 'terrain-paint', 'studio-build',
      'move', 'home-move', 'garden-move', 'studio-move'].includes(placement?.kind);
}

// A consumed stored object cannot be restored a second time. Geometry may
// still block a valid undo; leave that action visible so it can explain why.
export function editingUndoAvailable(s, undo) {
  const token=undo?.token;
  if(!token)return false;
  if(undo.family==='land')return !!s.land?.stored?.[token.realm]?.some(p=>p.id===token.id);
  if(undo.family!=='garden')return false;
  if(!token.id.startsWith('planted:'))return !!s.garden?.cleared?.includes(token.id);
  return !s.garden?.plants?.some(p=>p.id===token.id) && s.garden?.stored?.[token.type]>0;
}

const directionFamilies = ['building','home','garden','studio'];
export function placementDirection(s, family) {
  const value=s.editing?.directions?.[family];
  return Number.isInteger(value)&&value>=0&&value<4?value:0;
}
// Remember only completed construction, never a cancelled preview or a move.
export function rememberPlacementDirection(s, placement) {
  const family={build:'building','home-build':'home','garden-build':'garden','studio-build':'studio'}[placement?.kind];
  if(!family)return;
  s.editing ||= {};s.editing.directions ||= {};
  s.editing.directions[family]=((placement.rotation||0)%4+4)%4;
}
export function restoreEditing(raw) {
  const editing={};
  for(const key of Object.values(continuousKeys))editing[key]=raw?.[key]===true;
  if(raw?.directions)editing.directions=Object.fromEntries(directionFamilies.map(family=>[family,placementDirection({editing:raw},family)]));
  editing.lines={power:raw?.lines?.power!==false,logistics:raw?.lines?.logistics!==false};
  return editing;
}
