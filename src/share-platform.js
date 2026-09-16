// Public invitation links never contain local preview hosts, cache tags or saves.
export const GAME_SHARE_URL = "https://www.kw-aigc.cn/projects/mc-clicker-2/";
export const shareLinkData = () => ({
  title: "MC Clicker 2.0",
  text: "从一块方块开始，造一个会自己运转的小世界。",
  url: GAME_SHARE_URL,
});
export const shareImageData = (file, scene) => ({
  title: `我的 MC Clicker 世界 · ${scene}`,
  text: `从第一块开始，这是我的${scene}。\n${GAME_SHARE_URL}`,
  files: [file],
});
export function supportsShare(nav, data) {
  if (typeof nav?.share !== "function") return false;
  try {
    if (data.files)
      return (
        typeof nav.canShare === "function" &&
        nav.canShare({ files: data.files })
      );
    return typeof nav.canShare !== "function" || nav.canShare(data);
  } catch {
    return false;
  }
}
export async function systemShare(nav, data) {
  if (!supportsShare(nav, data)) return "unsupported";
  try {
    // File preparation happens before the button is enabled. Do not await a
    // screenshot or blob here: the native sheet needs the button's activation.
    await nav.share(data);
    return "shared";
  } catch (error) {
    return error?.name === "AbortError" ? "cancelled" : "failed";
  }
}
