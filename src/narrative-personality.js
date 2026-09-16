import { WEB_BY_ID } from './web-catalog.js';
import { COLLECTION_BY_ID } from './collection.js';
import { appearanceRequirement } from './appearance-growth.js';
import { upgradeStatus, upgradeLevel, UPGRADE_BY_ID } from './upgrades.js';
import { NARRATOR_COPY } from './narrator-copy.js';
import { inputKind } from './input-guidance.js';

// Only successful, recent purchase gestures are observed. Ownership imported
// from a save and browsing/equipping old items are not new purchases.
export function recentDecoration(s) {
  for (const p of [...(s.narrative?.behavior?.purchases || [])].reverse()) {
    if (p.at > s.play || s.play - p.at > 45) continue;
    const web = WEB_BY_ID[p.id], extra = COLLECTION_BY_ID[p.id];
    if (web && s.webAppearance?.owned[p.id])
      return s.webAppearance.equipped[web.slot] === p.id ? { ...web, at: p.at } : null;
    if (extra && ['studio', 'flag'].includes(extra.category) && s.scenery?.owned[p.id])
      return s.scenery.equipped[extra.slot] === p.id ? { ...extra, at: p.at } : null;
  }
  return null;
}
export function decorationCopy(s) {
  const item = recentDecoration(s);
  if (!item) return null;
  if (item.category === 'theme' || item.category === 'notice') return item.id.replace('web-', 'decor-');
  if (item.category === 'cursor') return `decor-cursor-${inputKind()}`;
  if (item.category === 'share') return item.slot === 'shareCard' ? 'decor-share-card' : 'decor-share-fx';
  return `decor-${item.category}`;
}
export const DECORATION_NARRATION = ['title', 'icon', 'cursor', 'theme', 'notice', 'share', 'studio', 'flag'].map(category => ({
  id: `decoration:${category}`, cosmetic: true, kind: 'reaction', priority: 32,
  minPlay: 0, settle: 2, ttl: 45, shop: true, surfaces: ['live'],
  when: s => recentDecoration(s)?.category === category,
  guard: s => !s.narrative.current?.target || s.narrative.current.id !== `decoration:${category}` || s.narrative.current.target.id === recentDecoration(s)?.id,
  lines: s => NARRATOR_COPY[decorationCopy(s)]?.lines || [],
}));

const targets = {
  'suggest-notice': { domain: 'web', id: 'web-notice-paper' },
  'suggest-cooling': { domain: 'upgrade', id: 'drill-cooling' },
};
// One quoted item, one existing checkout. No money is spent by narration.
export function narratorOffer(s, id) {
  const target = targets[id];
  if (!target) return null;
  if (target.domain === 'web') {
    const item = WEB_BY_ID[target.id];
    if (!s.counts.X2 || s.webAppearance.owned[item.id] || appearanceRequirement(s, item)) return null;
    return { ...target, name: item.name, cost: item.cost, verb: '换这件', decline: '先不换', ready: s.money >= item.cost };
  }
  const status = upgradeStatus(s, target.id);
  if (upgradeLevel(s, target.id) || status.missing.length) return null;
  return { ...target, name: UPGRADE_BY_ID[target.id].name, cost: status.cost, verb: '装上', decline: '先不装', ready: status.kind === 'ready' };
}
export const PERSONALITY_SUGGESTIONS = [
  {
    id: 'suggest-notice', minPlay: 720,
    situation: s => s.narrative.lastCosmeticAt != null && s.play - s.narrative.lastCosmeticAt >= 120,
    resolved: s => Object.keys(s.webAppearance.owned).some(id => WEB_BY_ID[id]?.category === 'notice'),
  },
  {
    id: 'suggest-cooling', minPlay: 900,
    situation: s => s.grid?.last?.perDevice?.M9 > 0,
  },
].map(({ situation, resolved = () => false, ...spec }) => ({
  ...spec, offer: true, kind: 'suggestion', priority: -15, quietFor: 45, settle: 12, ttl: Infinity,
  guard: (s, context) => (!context.surface || context.surface() === 'world') && context.realm?.() !== 'studio',
  lines: s => NARRATOR_COPY[spec.id].lines.map(line => line.replace('{价格}', String(narratorOffer(s,spec.id)?.cost ?? WEB_BY_ID[targets[spec.id].id]?.cost ?? ''))),
  when: s => {
    const offer = narratorOffer(s, spec.id);
    const eggQuiet = s.easterEggs?.lastOfferAt == null || s.play - s.easterEggs.lastOfferAt >= 240;
    // Surplus and machine activity qualify the initial suggestion. Once it is
    // visible, an ordinary work-cycle pause must not remove the choice buttons.
    const active = s.narrative.current?.id === spec.id;
    return !resolved(s) && !!offer?.ready && (active || (eggQuiet && s.money >= offer.cost * 4 && situation(s)));
  },
}));
