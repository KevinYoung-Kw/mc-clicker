export function createRealmPicker(host, realms, select) {
  let signature;
  function close(focus = false) {
    host.classList.remove("open");
    host.querySelector("#realm-toggle")?.setAttribute("aria-expanded", "false");
    if (focus) host.querySelector("#realm-toggle")?.focus();
  }
  document.addEventListener("pointerdown", (event) => {
    if (!host.contains(event.target)) close();
  });
  host.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && host.classList.contains("open")) {
      event.stopPropagation();
      close(true);
    }
  });
  host.addEventListener("focusout", (event) => {
    if (!host.contains(event.relatedTarget)) close();
  });
  return {
    render(available, current) {
      const next = available.join() + current;
      if (signature === next) return;
      signature = next;
      host.innerHTML = `<button id="realm-toggle" aria-expanded="false" aria-controls="realm-options" aria-label="切换世界，当前${realms[current].name}"><span>${realms[current].name}</span><span class="realm-chevron" aria-hidden="true">⌄</span></button><div id="realm-options" role="group" aria-label="切换世界">${available.map((key) => `<button data-realm="${key}" class="${key === current ? "active" : ""}" aria-pressed="${key === current}">${realms[key].name}</button>`).join("")}</div>`;
      close();
      host.querySelector("#realm-toggle").onclick = (event) => {
        const open = host.classList.toggle("open");
        event.currentTarget.setAttribute("aria-expanded", String(open));
      };
      host.querySelectorAll("[data-realm]").forEach((button) => {
        button.onclick = () => {
          close();
          select(button.dataset.realm);
        };
      });
    },
  };
}
