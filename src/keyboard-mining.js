// Use the game's pointer-hold clock, never the operating system's key repeat.
export function bindSpaceMining({
  target = window,
  enabled,
  start,
  stop,
  mineButton,
}) {
  let held = false;
  const interactive = (element) => {
    if (element === mineButton) return false;
    return !!element?.closest?.(
      'input, textarea, select, button, a, summary, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="textbox"]',
    );
  };
  const down = (event) => {
    if (
      event.code !== "Space" ||
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      interactive(event.target) ||
      !enabled()
    )
      return;
    event.preventDefault();
    if (event.repeat || held) return;
    start();
    held = true;
  };
  const up = (event) => {
    if (event.code !== "Space" || !held) return;
    event.preventDefault();
    held = false;
    stop();
  };
  const focus = (event) => {
    if (!held || !interactive(event.target)) return;
    held = false;
    stop();
  };
  target.addEventListener("keydown", down);
  target.addEventListener("keyup", up);
  target.addEventListener("focusin", focus);
  return {
    reset() {
      held = false;
    },
    dispose() {
      if (held) stop();
      held = false;
      target.removeEventListener("keydown", down);
      target.removeEventListener("keyup", up);
      target.removeEventListener("focusin", focus);
    },
  };
}
