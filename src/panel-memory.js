const STORAGE_KEY = 'mc-clicker-panel-preferences-v1';
const tracked = '[data-mod-card],[data-equipment-card],[data-card],[data-dispatch-source],[data-workplace-card],[data-fold]';
const escapeAttr = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

export function createPanelMemory({ storage = () => globalThis.localStorage,
  device = () => globalThis.matchMedia?.('(max-width: 760px)').matches ? 'mobile' : 'desktop' } = {}) {
  let preferences = {};
  try {
    const raw = JSON.parse(storage()?.getItem(STORAGE_KEY) || '{}');
    for (const bucket of ['mobile', 'desktop']) {
      preferences[bucket] = Object.fromEntries(Object.entries(raw?.[bucket] || {})
        .filter(([key, value]) => key.length < 160 && typeof value === 'boolean').slice(-240));
    }
  } catch { /* Private browsing and malformed preferences use sensible defaults. */ }
  const views = new WeakMap(), bound = new WeakSet(), positions = new Map();
  const open = (key, fallback = false) => preferences[device()]?.[key] ?? fallback;
  function set(key, value) {
    (preferences[device()] ||= {})[key] = !!value;
    try { storage()?.setItem(STORAGE_KEY, JSON.stringify(preferences)); } catch { /* UI remains usable without storage. */ }
  }
  function attrs(key, fallback = false) {
    return `data-fold="${escapeAttr(key)}" ${open(key, fallback) ? 'open' : ''}`;
  }
  function identity(el) {
    if (!el) return null;
    if (el.tagName === 'SUMMARY' && el.parentElement?.dataset.fold)
      return `details[data-fold="${CSS.escape(el.parentElement.dataset.fold)}"] > summary`;
    if (el.id) return `#${CSS.escape(el.id)}`;
    const attrs = [...el.attributes].filter(a => a.name.startsWith('data-') &&
      !['data-state', 'data-purchase-state', 'data-recommended'].includes(a.name));
    return attrs.length ? el.tagName.toLowerCase() + attrs.map(a => `[${a.name}="${CSS.escape(a.value)}"]`).join('') : null;
  }
  function capture(root) {
    const view = views.get(root);
    if (!view || !root.getClientRects().length) return;
    const top = root.getBoundingClientRect().top;
    const anchor = [...root.querySelectorAll(tracked)].filter(el => {
      const box = el.getBoundingClientRect();
      return box.height && box.bottom > top && box.top < top + root.clientHeight;
    }).sort((a, b) => Math.abs(a.getBoundingClientRect().top - top) - Math.abs(b.getBoundingClientRect().top - top))[0];
    const focused = root.contains(document.activeElement) ? document.activeElement : null;
    positions.set(view, { scroll: root.scrollTop, anchor: identity(anchor),
      offset: anchor ? anchor.getBoundingClientRect().top - top : 0,
      focus: identity(focused), start: focused?.selectionStart, end: focused?.selectionEnd });
    if (positions.size > 80) positions.delete(positions.keys().next().value);
  }
  function focusTarget(root) {
    return root.contains(document.activeElement) ? identity(document.activeElement) : null;
  }
  function restoreFocus(root, selector) {
    if (!selector) return;
    let target = root.querySelector(selector);
    if (target?.disabled) target = target.closest('[data-mod-card]')?.querySelector('[data-mod-select]');
    if (target?.getClientRects().length) target.focus({ preventScroll: true });
  }
  function leave(root) { capture(root); views.delete(root); }
  function restore(root, key) {
    const view = `${device()}:${key}`, same = views.get(root) === view;
    views.set(root, view);
    if (!bound.has(root)) {
      bound.add(root);
      root.addEventListener('toggle', event => {
        const detail = event.target;
        if (detail.matches?.('details[data-fold]') && root.contains(detail)) set(detail.dataset.fold, detail.open);
      }, true);
    }
    const saved = positions.get(view);
    root.scrollTop = saved?.scroll || 0;
    if (!saved) return;
    const anchor = saved.anchor && root.querySelector(saved.anchor);
    if (anchor?.getClientRects().length) root.scrollTop += anchor.getBoundingClientRect().top - root.getBoundingClientRect().top - saved.offset;
    const focus = same && saved.focus && root.querySelector(saved.focus);
    if (focus && !focus.disabled && focus.getClientRects().length) {
      focus.focus({ preventScroll: true });
      if (typeof saved.start === 'number' && typeof focus.setSelectionRange === 'function') {
        try { focus.setSelectionRange(saved.start, saved.end); } catch { /* Non-text inputs do not accept a caret. */ }
      }
    }
  }
  return { open, set, attrs, capture, leave, restore, focusTarget, restoreFocus };
}
export const panelMemory = createPanelMemory();
export const foldAttributes = (key, fallback) => panelMemory.attrs(key, fallback);
