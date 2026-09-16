import { RELEASE_VERSION } from './release.js';
// Keep native selects as the source of truth; every screen uses the same menu.
export function installGameSelects(root = document.body) {
  const controls = new WeakMap();
  let serial = 0, open = null;
  const chevron = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M3 5h2v2h2v2h2V7h2V5h2v4h-2v2H9v2H7v-2H5V9H3z"/></svg>';
  function close(restoreFocus = false) {
    if (!open) return;
    const { menu, button } = open;
    open = null;
    menu.remove();
    button.setAttribute('aria-expanded', 'false');
    button.removeAttribute('aria-activedescendant');
    if (restoreFocus && button.isConnected) button.focus({ preventScroll: true });
  }
  function labelOf(select) {
    if (select.hasAttribute('aria-label')) return select.getAttribute('aria-label');
    const label = select.labels?.[0]?.cloneNode(true);
    label?.querySelectorAll('select, input, button, .game-select').forEach(el => el.remove());
    return label?.textContent.trim() || '选择';
  }
  function sync(select) {
    const c = controls.get(select);
    if (!c) return;
    const option = select.selectedOptions[0];
    c.value.textContent = option?.dataset.label || option?.textContent || '请选择';
    c.button.disabled = select.disabled;
  }
  function activate(index, scroll = true) {
    if (!open) return;
    open.active = index;
    open.rows.forEach((row, i) => row.classList.toggle('is-active', i === index));
    const row = open.rows[index];
    if (row) {
      open.button.setAttribute('aria-activedescendant', row.id);
      if (scroll) row.scrollIntoView({ block: 'nearest' });
    }
  }
  function identity(select) {
    if (select.id) return `#${CSS.escape(select.id)}`;
    const key = select.getAttributeNames().find(k => k.startsWith('data-'));
    return key ? `select[${key}="${CSS.escape(select.getAttribute(key))}"]` : null;
  }
  function choose(index) {
    if (!open) return;
    const { select, button } = open, option = select.options[index];
    if (!option || option.disabled || select.disabled) return;
    const locator = identity(select), changed = select.selectedIndex !== index;
    close();
    select.selectedIndex = index;
    sync(select);
    if (changed) {
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // Assignment may rebuild the detail panel. Focus its replacement, without scrolling.
    queueMicrotask(() => {
      const target = button.isConnected ? button : controls.get(locator && root.querySelector(locator))?.button;
      target?.focus({ preventScroll: true });
    });
  }
  function show(select, button) {
    if (open?.select === select) return close();
    close();
    select.dispatchEvent(new Event('game-select-open'));
    if (select.disabled || !select.options.length) return;
    const menu = document.createElement('div');
    menu.id = button.getAttribute('aria-controls');
    menu.className = 'game-select-menu';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', labelOf(select));
    // Popovers live above dialogs without becoming another modal/focus trap.
    menu.setAttribute('popover', 'manual');
    const rows = Array.from(select.options, (option, i) => {
      const row = document.createElement('div');
      row.className = 'game-select-option';
      row.id = `${menu.id}-${i}`;
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', String(option.selected));
      row.setAttribute('aria-disabled', String(option.disabled));
      if (option.dataset.icon) {
        const img = document.createElement('img');
        img.src = `${import.meta.env.BASE_URL}icons/${option.dataset.icon}.png?v=${RELEASE_VERSION}`;
        img.alt = ''; img.width = img.height = 32;
        row.append(img);
      }
      const content = document.createElement('span'), heading = document.createElement('strong');
      content.className = 'game-select-option-copy';
      heading.textContent = option.textContent;
      content.append(heading);
      for (const [key, tag] of [['description', 'span'], ['meta', 'small']]) {
        if (!option.dataset[key]) continue;
        const detail = document.createElement(tag);
        detail.textContent = option.dataset[key];
        content.append(detail);
      }
      const check = document.createElement('span');
      check.className = 'game-select-check'; check.setAttribute('aria-hidden', 'true');
      check.textContent = option.selected ? '✓' : option.disabled ? '−' : '';
      row.append(content, check);
      row.addEventListener('pointerdown', e => { if (e.pointerType !== 'touch') e.preventDefault(); });
      row.addEventListener('click', () => choose(i));
      row.addEventListener('pointermove', e => {
        if (e.pointerType === 'mouse' && !option.disabled) activate(i, false);
      });
      menu.append(row);
      return row;
    });
    (select.closest('dialog[open]') || root).append(menu);
    if (menu.showPopover) menu.showPopover();
    else menu.classList.add('game-select-fallback');
    open = { select, button, menu, rows, active: select.selectedIndex, search: '', searchAt: 0 };
    positionMenu();
    if (!open) return;
    button.setAttribute('aria-expanded', 'true');
    activate(select.selectedIndex);
    button.focus({ preventScroll: true });
  }
  function positionMenu() {
    if (!open) return;
    const { button, select, menu } = open;
    const rect = button.getBoundingClientRect(), viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
    const width = viewport?.width || innerWidth, height = viewport?.height || innerHeight;
    if (!button.getClientRects().length || rect.bottom < top || rect.top > top + height) return close();
    const below = top + height - rect.bottom - 12, above = rect.top - top - 12;
    const upwards = below < 220 && above > below;
    menu.style.width = `${Math.min(width - 16, Math.max(rect.width, select.matches('[data-assign]') ? 330 : 220))}px`;
    menu.style.maxHeight = `${Math.max(60, Math.min(400, upwards ? above : below))}px`;
    menu.style.left = `${Math.max(left + 8, Math.min(rect.left, left + width - menu.offsetWidth - 8))}px`;
    menu.style.top = `${upwards ? rect.top - menu.offsetHeight - 5 : rect.bottom + 5}px`;
  }
  function mount(select) {
    if (controls.has(select) || select.multiple || select.size > 1) return;
    const label = labelOf(select), wrapper = document.createElement('span'), button = document.createElement('button');
    wrapper.className = 'game-select';
    button.type = 'button'; button.className = 'game-select-trigger';
    button.setAttribute('role', 'combobox');
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', `game-select-list-${++serial}`);
    const value = document.createElement('span');
    value.className = 'game-select-value';
    button.append(value); button.insertAdjacentHTML('beforeend', chevron);
    select.before(wrapper); wrapper.append(select, button);
    select.hidden = true; select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    controls.set(select, { button, value });
    sync(select);
    select.addEventListener('change', () => sync(select));
    button.addEventListener('click', () => show(select, button));
    button.addEventListener('keydown', e => {
      const handled = ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' ', 'Escape'];
      if (e.key === 'Escape' && open?.select !== select) return;
      if (e.key === 'Tab') { if (open?.select === select) close(); return; }
      if (!handled.includes(e.key) && !(open?.select === select && e.key.length === 1)) return;
      e.preventDefault(); e.stopPropagation();
      if (e.key === 'Escape') return close(true);
      if (open?.select !== select) { show(select, button); return; }
      if (e.key === 'Enter' || e.key === ' ') return choose(open.active);
      const enabled = Array.from(select.options).map((o, i) => o.disabled ? -1 : i).filter(i => i >= 0);
      if (!enabled.length) return;
      let next = open.active;
      const current = enabled.indexOf(next);
      if (e.key === 'Home') next = enabled[0];
      else if (e.key === 'End') next = enabled.at(-1);
      else if (e.key === 'ArrowDown') next = enabled[(current + 1) % enabled.length];
      else if (e.key === 'ArrowUp') next = enabled[(current - 1 + enabled.length) % enabled.length];
      else {
        const now = performance.now();
        open.search = (now - open.searchAt < 700 ? open.search : '') + e.key.toLocaleLowerCase();
        open.searchAt = now;
        next = enabled.find(i => select.options[i].textContent.toLocaleLowerCase().startsWith(open.search)) ?? next;
      }
      activate(next);
    });
  }
  function scan(node) {
    if (!(node instanceof Element) || node.closest('.game-select-menu')) return;
    if (node.matches('select')) mount(node);
    else node.querySelectorAll('select').forEach(mount);
  }
  scan(root);
  // Only newly inserted elements/changed select options are inspected, never the simulation tick.
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'childList') record.addedNodes.forEach(scan);
      const select = record.target instanceof Element && record.target.closest('select');
      if (select) {
        sync(select);
      }
    }
    // A companion arriving at work can update the surrounding panel. Keep the
    // player's open selector and scroll position instead of dismissing it.
    if (open && !open.select.isConnected) {
      const previous = open, locator = identity(previous.select);
      const next = locator && root.querySelector(locator), control = next && controls.get(next);
      const scroll = previous.menu.scrollTop, activeValue = previous.select.options[previous.active]?.value;
      if (control && !next.disabled) {
        show(next, control.button);
        if (open) {
          activate([...next.options].findIndex(o => o.value === activeValue), false);
          open.menu.scrollTop = scroll;
        }
      } else close();
    }
    if (open && (open.select.disabled || open.select.closest('dialog:not([open])'))) close();
  });
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'selected', 'open'] });
  document.addEventListener('pointerdown', e => {
    if (open && !open.menu.contains(e.target) && !open.button.contains(e.target)) close();
  }, true);
  let repositioning = false;
  document.addEventListener('scroll', e => {
    if (open && e.target !== open.menu && !open.menu.contains(e.target) && !repositioning) {
      repositioning = true;
      requestAnimationFrame(() => { repositioning = false; positionMenu(); });
    }
  }, true);
  window.addEventListener('resize', () => close());
  window.visualViewport?.addEventListener('resize', () => close());
  document.addEventListener('visibilitychange', () => { if (document.hidden) close(); });
}
