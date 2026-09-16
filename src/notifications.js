import { noticeFace } from './notice-face.js';
import { icon } from './icons.js';
import { createPanelNoticeLane } from './panel-notice-lane.js';

// Every notification uses one shell. Direct receipts preempt ambient comments;
// pausing clears transient results so returning never replays a shopping backlog.
export function createNotifications(host, { enabled = true } = {}) {
  const toast = host.querySelector('#toast'), paused = host.querySelector('#foreground-status');
  const shell = document.createElement('section'); shell.id = 'notification-shell';
  const face = document.createElement('span'); face.className = 'notification-avatar'; face.setAttribute('aria-hidden','true');
  const body = document.createElement('div'); body.className = 'notification-content';
  shell.append(face, body); body.append(toast, paused); host.replaceChildren(shell);
  paused.innerHTML = '<span class="pause-kicker">TAKE A BREAK</span><strong>世界歇一会儿</strong><span class="pause-return">回到游戏后自动继续</span><small>已暂停 · 暂停期间不计算收益</small>';
  let timer = null, current = null, queue = [], suspended = false;
  let narrator = null, narrationRequested = false, narrationMood = 'plain', shownMood = '';
  let characterAway=false,accessory=null;
  const recent = new Map();
  function visibility() {
    if (narrator) narrator.hidden = suspended || !!current || !narrationRequested;
    const visible = suspended || !!current || !!(narrator && narrationRequested);
    const mood = suspended ? 'pause' : current ? (current.expression || (current.kind === 'success' ? 'smile' : 'notice')) : narrationMood;
    const faceKey=`${mood}:${characterAway}:${accessory}`;
    if (shownMood !== faceKey) { face.innerHTML = characterAway?icon('info',28):noticeFace(mood,accessory); shownMood = faceKey; }
    shell.dataset.character=characterAway?'away':'present';
    shell.dataset.expression = mood;
    shell.dataset.kind = suspended ? 'pause' : current?.kind || 'narration';
    paused.hidden = !suspended;
    host.dataset.mode = suspended ? 'pause' : 'notice';
    host.hidden = !visible;
    if (host.showPopover) {
      const open = host.matches(':popover-open');
      if (visible && !open) host.showPopover();
      if (!visible && open) host.hidePopover();
    }
  }
  function nextNotice() {
    const now = performance.now();
    while (queue.length) { const next = queue.shift(); if (next.expiresAt > now) return next; }
    return null;
  }
  function display(notice) {
    clearTimeout(timer); current = notice; toast.replaceChildren();
    if (notice) {
      const line = document.createElement('span'); line.className = 'notice-title'; line.textContent = notice.text; toast.append(line);
      if (notice.amount || notice.detail) {
        const receipt = document.createElement('small'); receipt.className = 'notice-receipt';
        if (notice.amount) { const cost = document.createElement('b'); cost.textContent = notice.amount; receipt.append(cost); }
        if (notice.detail) { const detail = document.createElement('span'); detail.textContent = notice.detail; receipt.append(detail); }
        toast.append(receipt);
      }
      toast.dataset.kind = notice.kind; toast.classList.add('visible'); toast.hidden = false;
      timer = setTimeout(() => display(nextNotice()), Math.max(1000,Math.min(6000,notice.duration||3600)));
    } else { toast.classList.remove('visible'); toast.hidden = true; }
    visibility();
  }
  return {
    get busy() { return suspended || !!current; },
    avatarRect() { return face.getBoundingClientRect(); },
    setCharacter(away,outfit){if(characterAway===away&&accessory===outfit)return;characterAway=away;accessory=outfit;visibility();},
    mountNarrator(node) { narrator = node; body.append(node); visibility(); },
    narrate(visible, expression = 'plain') {
      if (narrationRequested === visible && narrationMood === expression) return;
      narrationRequested = visible; narrationMood = expression; visibility();
    },
    setEnabled(value) {
      if (enabled === value) return; enabled = value;
      if (!enabled) { queue = []; if (current?.kind === 'event') display(null); }
      visibility();
    },
    show(text, { kind = 'action', amount = '', detail = '', expression, duration } = {}) {
      // Paid information controls ambient events, not essential action feedback.
      if (!text || suspended || (kind === 'event' && !enabled)) return;
      text = String(text); const now = performance.now();
      if (kind === 'event') {
        if (now - (recent.get(text) ?? -Infinity) < 12000) return;
        recent.set(text, now);
        for (const [key, at] of recent) if (now - at > 12000) recent.delete(key);
      }
      const notice = { text, kind, amount, detail, expression, duration, expiresAt: now + 8000 };
      if (kind === 'event' && current) queue = [...queue, notice].slice(-2);
      else display(notice);
    },
    clear() { queue = []; display(null); },
    pause(value) {
      if (suspended === value) return; suspended = value;
      queue = []; display(null);
    },
    promote() {
      if (host.hidePopover && host.matches(':popover-open')) { host.hidePopover(); host.showPopover(); }
    },
  };
}

export function bindSceneHud({ stage, label, controls, hotbar, notices }) {
  let frame;
  const panel=stage.closest('#game')?.querySelector('#panel');
  const position = () => {
    frame = null;
    const stageBounds = stage.getBoundingClientRect();
    const scene = stageBounds.width ? stageBounds : stage.closest("#game").getBoundingClientRect();
    const tight = scene.width < 760;
    stage.classList.toggle("compact-hud", tight && scene.height < 380);
    notices.style.setProperty("--notice-x", `${scene.x + scene.width / 2}px`);
    notices.style.setProperty("--notice-y", `${scene.y + (tight ? 62 : 8)}px`);
    notices.style.setProperty(
      "--notice-width",
      `${Math.max(160, Math.min(380, scene.width - (tight ? 24 : 540)))}px`,
    );
    notices.style.setProperty("--narrator-width", `${Math.min(420,scene.width-24)}px`);
    positionLane();
    const title = label.getBoundingClientRect();
    let bottom = tight ? (scene.height < 300 ? 8 : 14) : 24;
    for (const element of [controls, hotbar]) {
      if (!element.getClientRects().length || element.hidden) continue;
      const bounds = element.getBoundingClientRect();
      if (title.left < bounds.right + 12 && title.right > bounds.left - 12)
        bottom = Math.max(bottom, scene.bottom - bounds.top + 14);
    }
    label.style.bottom = `${bottom}px`;
    // A sheet's WAAPI translate changes its position without changing its
    // dimensions. ResizeObserver alone leaves the subtitle midway down the
    // screen in WebKit. Follow only the short panel animation, then stop.
    if(!notices.hidden&&panel?.getAnimations().some(a=>a.playState==='running'||a.pending))schedule();
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(position);
  };
  const positionLane=createPanelNoticeLane({game:stage.closest('#game'),panel,host:notices,schedule});
  const observer = new ResizeObserver(schedule);
  for (const element of [stage, label, controls, hotbar, panel, notices])
    observer.observe(element);
  new MutationObserver(schedule).observe(notices,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden']});
  const game=stage.closest('#game');
  if(game)new MutationObserver(schedule).observe(game,{attributes:true,attributeFilter:['class']});
  window.addEventListener("resize", schedule);
  schedule();
  return schedule;
}
