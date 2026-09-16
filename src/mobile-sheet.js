// One sheet interaction for the shop, management panels and the indoor desk.
// It changes available UI space, never the player's camera bookmark or save.
export function sheetSwipe(start, end) {
  const dy = end.y - start.y,
    dx = end.x - start.x;
  if (Math.abs(dy) < 34 || Math.abs(dy) < Math.abs(dx) * 1.2) return null;
  return dy < 0;
}

export function bindMobileSheet({ game, panel, reducedMotion = () => false, onLayout = () => {}, onClose = () => {} }) {
  const mobile = matchMedia("(max-width: 759px)"),
    grip = panel.querySelector(".drawer-handle"),
    toggle = panel.querySelector("#panel-expand"),
    header = panel.querySelector(".panel-header");
  let expanded = false,
    kind = null,
    gesture = null,
    animation = null;
  function paint() {
    const full = mobile.matches && expanded && !!kind;
    game.classList.toggle("sheet-expanded", full);
    const stage = game.querySelector("#stage");
    if (stage) stage.inert = full;
    const label = full ? "收回半屏" : "展开面板";
    for (const button of [grip, toggle]) {
      button.setAttribute("aria-expanded", String(full));
      button.setAttribute("aria-label", button === grip ? `${label}；下拉${full ? '收回半屏' : '关闭面板'}` : label);
      button.title = button.getAttribute("aria-label");
      button.disabled = game.classList.contains("choosing-site");
    }
    onLayout();
  }
  function set(value, animate = true) {
    if (!mobile.matches || !kind) return;
    if (value && game.classList.contains("choosing-site")) return;
    animation?.cancel();
    const before = panel.getBoundingClientRect();
    expanded = value;
    paint();
    const after = panel.getBoundingClientRect();
    if (animate && !reducedMotion() && before.y !== after.y)
      animation = panel.animate(
        [
          { transform: `translateY(${before.y - after.y}px)` },
          { transform: "translateY(0)" },
        ],
        { duration: 280, easing: "cubic-bezier(.22,.8,.24,1)" },
      );
  }
  const click = (event) => {
    // A completed swipe also generates click on some WebKit versions.
    if (event.currentTarget.dataset.swiped === "true") {
      delete event.currentTarget.dataset.swiped;
      return;
    }
    set(!expanded);
  };
  grip.addEventListener("click", click);
  grip.addEventListener("keydown", () => { delete grip.dataset.swiped; });
  toggle.addEventListener("click", click);
  panel.addEventListener('pointerdown', event => {
    if(event.isPrimary === false)gesture = null;
  }, true);
  for (const surface of [grip, header]) {
    surface.addEventListener("pointerdown", (event) => {
      if (
        !mobile.matches ||
        !kind ||
        game.classList.contains("choosing-site") ||
        event.isPrimary === false ||
        event.button !== 0 ||
        (surface === header && event.target.closest("button"))
      )
        return;
      gesture = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        surface,
      };
      delete surface.dataset.swiped;
      surface.setPointerCapture(event.pointerId);
    });
    surface.addEventListener("pointerup", (event) => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const direction = sheetSwipe(gesture, {
        x: event.clientX,
        y: event.clientY,
      });
      const moved=Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>12;
      gesture = null;
      if (surface.hasPointerCapture(event.pointerId))
        surface.releasePointerCapture(event.pointerId);
      if(moved)surface.dataset.swiped = "true";
      if (direction !== null) {
        if (!direction && !expanded) onClose();
        else set(direction);
      }
    });
    surface.addEventListener("pointercancel", () => {
      gesture = null;
    });
    surface.addEventListener("lostpointercapture", () => {
      gesture = null;
    });
  }
  mobile.addEventListener("change", () => {
    animation?.cancel();
    gesture = null;
    paint();
  });
  return {
    sync(next) {
      animation?.cancel();
      gesture = null;
      if (!next) expanded = false;
      else if (["mail", "network"].includes(next) && kind !== next) expanded = true;
      else if (!kind && mobile.matches && innerHeight < 640) expanded = true;
      kind = next;
      paint();
    },
    placement() {
      // Selecting a site always exposes the world. Confirmation-only purchases
      // keep the expanded list visible, so successive upgrades remain quick.
      if (game.classList.contains("choosing-site")) set(false);
      paint();
    },
  };
}
