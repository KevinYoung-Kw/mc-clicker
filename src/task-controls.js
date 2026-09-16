import { TASKS } from "./operations.js";
import { powerSnapshot } from "./power.js";
import { taskControl } from "./task-control-state.js";
import { facilityStatusMarkup } from "./facility-status.js";
export { taskControl } from "./task-control-state.js";
export function refreshTaskControls(root, s, power = powerSnapshot(s)) {
  for (const key of [...Object.keys(TASKS), "piston"]) {
    const id = key === "piston" ? "M3" : TASKS[key].id;
    if (!s.counts[id]) continue;
    const control = taskControl(s, key, power);
    for (const button of root.querySelectorAll(`[data-task="${key}"], [data-action="${key}"]`)) {
      button.dataset.control = control.mode;
      button.disabled = control.disabled;
      const label = key === "music" && control.mode === "manual" ? "开始演出" : control.label;
      if (button.textContent !== label) button.textContent = label;
      button.title = control.label;
      const container = button.closest("[data-task-card]") || button.parentElement;
      if (!container.querySelector(`[data-facility-status="${id}"]`))
        button.insertAdjacentHTML("beforebegin", facilityStatusMarkup(s, id, power));
    }
  }
}
