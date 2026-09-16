export function bindMobileTools(host, toggle) {
  const mobile = matchMedia("(max-width: 759px)");
  const close = () => {
    host.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  };
  const brand = host.querySelector(".site-link");
  const header = host.closest(".hud");
  const arrange = () => {
    close();
    if (brand) (mobile.matches ? host : header).prepend(brand);
  };
  arrange();
  toggle.onclick = () => {
    const open = host.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  };
  host.addEventListener("click", (event) => {
    if (event.target.closest("button, a")) close();
  });
  document.addEventListener("pointerdown", (event) => {
    if (!host.contains(event.target) && !toggle.contains(event.target)) close();
  });
  const key = (event) => {
    if (event.key === "Escape" && host.classList.contains("is-open")) {
      event.stopPropagation();
      close();
      toggle.focus();
    }
  };
  host.addEventListener("keydown", key);
  toggle.addEventListener("keydown", key);
  mobile.addEventListener("change", arrange);
  return { close };
}
