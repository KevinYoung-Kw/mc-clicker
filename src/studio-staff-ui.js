import {
  ensureCommunity,
  escapeHtml,
  portrait,
  activeHost,
} from "./residents.js";

function staffState(s, job) {
  const person = ensureCommunity(s).residents.find(
    (r) => !r.reserve && r.job === job,
  );
  const active =
    job === "host"
      ? !!activeHost(s)
      : person?.room === "studio" && !person.handover;
  const title = job === "host" ? "主持人" : "乐师";
  const available = !!s.counts[job === "host" ? "L4" : "L1"];
  return {
    person,
    title: person
      ? `${person.name} · ${active ? "在岗" : "赶来中"}`
      : `${title}空缺`,
    note: !available
      ? "购买主持席后，可从村庄分配主持人。"
      : person
        ? active
          ? (job === "host" ? "正在主持，提高节目效果与收入" : "自动完成唱片机演出")
          : person.status || "正在赶往直播间"
        : job === "host"
          ? "没有主持人也能开播。安排一位村民主持，节目效果和收入会更好。"
          : "安排乐师后，他会来这里操作唱片机。",
    available,
  };
}

export function studioStaffMarkup(s, only = null) {
  const jobs = only ? [only] : ["host", ...(s.counts.L1 ? ["musician"] : [])];
  return `<section class="studio-staff" aria-label="直播间人员">${jobs
    .map((job) => {
      const v = staffState(s, job);
      return `<article data-staff-job="${job}"><span class="resident-portrait" data-staff-face>${v.person ? portrait(v.person) : "—"}</span><div><strong data-staff-name>${escapeHtml(v.title)}</strong><small data-staff-note>${escapeHtml(v.note)}</small></div>${v.available ? `<button class="quiet-button" data-village-staff>${v.person ? "管理村民" : "去村庄安排"}</button>` : '<button class="quiet-button" data-room-open="equipment">添置主持席</button>'}</article>`;
    })
    .join("")}</section>`;
}

export function refreshStudioStaff(root, s) {
  root.querySelectorAll("[data-staff-job]").forEach((row) => {
    const v = staffState(s, row.dataset.staffJob);
    row.querySelector("[data-staff-name]").textContent = v.title;
    row.querySelector("[data-staff-note]").textContent = v.note;
    const face = v.person ? portrait(v.person) : "—";
    if (row.querySelector("[data-staff-face]").innerHTML !== face)
      row.querySelector("[data-staff-face]").innerHTML = face;
    const button = row.querySelector("[data-village-staff]");
    if (button) button.textContent = v.person ? "管理村民" : "去村庄安排";
  });
}
