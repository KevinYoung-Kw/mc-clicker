import { refreshTutorialInput } from './tutorial-figures.js';
import { canHoldMine } from './mining-combo.js';
const TEXT = {
  touch: ["点建筑查看", "单指拖动平移", "双指捏合缩放", "双指左右滑动旋转"],
  mouse: ["点击建筑查看", "左键拖动平移", "滚轮缩放", "右键 / Shift 拖动旋转"],
};
let current = "mouse";
export function controlsFor(kind) {
  return TEXT[kind] || TEXT.mouse;
}
export function inputKind() { return current; }
export function controlGuide(s) {
  return (
    (s && !canHoldMine(s) ? "点按采集，铁镐可解锁长按。" : current === "touch"
      ? "点按或长按采集。"
      : "点击或长按采集，也可长按空格。") +
    TEXT[current].join("；") +
    "。"
  );
}
export function bindInputGuidance(state = () => undefined) {
  const media = matchMedia("(pointer: coarse)");
  function update(kind) {
    current = kind;
    refreshTutorialInput(document, kind);
    document.documentElement.dataset.input = kind;
    document.querySelectorAll("[data-gesture-hint]").forEach((el) => {
      el.replaceChildren(
        ...TEXT[kind].map((text, i) => {
          const span = document.createElement("span");
          span.textContent = (i ? " · " : "") + text;
          return span;
        }),
      );
    });
    document.querySelectorAll("#world canvas").forEach((el) => {
      el.setAttribute("aria-label", "方块世界：" + TEXT[kind].join("，"));
    });
    document.querySelectorAll("[data-control-guide]").forEach((el) => {
      el.textContent = controlGuide(state());
    });
  }
  update(media.matches ? "touch" : "mouse");
  media.addEventListener("change", () =>
    update(media.matches ? "touch" : "mouse"),
  );
  document.addEventListener(
    "pointerdown",
    (e) => {
      const kind = e.pointerType === "touch" ? "touch" : "mouse";
      if (kind !== current) update(kind);
    },
    { capture: true, passive: true },
  );
}
