import dimensions from './assets/tutorials/dimensions.json' with { type: 'json' };

// Static URLs are fingerprinted by Vite, so updating a guide also invalidates its cache.
const images = {
  'controls-mouse': new URL('./assets/tutorials/controls-mouse.webp', import.meta.url).href,
  'controls-touch': new URL('./assets/tutorials/controls-touch.webp', import.meta.url).href,
  building: new URL('./assets/tutorials/building.webp', import.meta.url).href,
  foreground: new URL('./assets/tutorials/foreground.webp', import.meta.url).href,
  moving: new URL('./assets/tutorials/moving.webp', import.meta.url).href,
  jobs: new URL('./assets/tutorials/jobs.webp', import.meta.url).href,
  delivery: new URL('./assets/tutorials/delivery.webp', import.meta.url).href,
  power: new URL('./assets/tutorials/power.webp', import.meta.url).href,
  studio: new URL('./assets/tutorials/studio.webp', import.meta.url).href,
  upgrades: new URL('./assets/tutorials/upgrades.webp', import.meta.url).href,
};
const topics = {
  '采集与视角': ['controls', '采集按钮与视角操作图解；铁镐解锁长按采集。'],
  '购买与建造': ['building', '依次点击商品购买按钮、地图绿色区域和在这里建造按钮；橙框标出按钮。'],
  '前台收益': ['foreground', '前台运行、切后台暂停、返回后继续；暂停的时间不补发收益。'],
  '搬动与转向': ['moving', '橙框依次标出设施详情的扳手和选址时的旋转按钮；确认才生效。'],
  '村庄与岗位': ['jobs', '按工作地点找到安排村民按钮，再点人选直接安排；橙框标出点击位置。'],
  '搬运与成交': ['delivery', '麦田产货、村民搬运、集市成交的流程，以及搬运工的安排入口。'],
  '电力与自动化': ['power', '红石钻机的接入电网按钮，以及电力页的储电、发电、需求和实际消耗。'],
  '直播间': ['studio', '直播间户外建筑和室内实景；橙框标出添置设备入口。'],
  '设施改造': ['upgrades', '钢制钻头改造的购买按钮、开采能力变化与耗电变化。'],
};
const controlsKey = kind => kind === 'touch' ? 'controls-touch' : 'controls-mouse';
const controlAlt = kind => topics['采集与视角'][1] + (kind === 'touch'
  ? '手机：单指平移、双指捏合缩放、双指左右滑动旋转。'
  : '电脑：左键平移、滚轮缩放、右键或 Shift 拖动旋转。');
export function tutorialFigure(title, kind = 'mouse') {
  const topic = topics[title];
  if (!topic) return '';
  const controls = topic[0] === 'controls', key = controls ? controlsKey(kind) : topic[0];
  const { width, height } = dimensions[key];
  return `<figure class="tutorial-figure"><img ${controls ? 'data-guide-controls' : ''} src="${images[key]}" width="${width}" height="${height}" alt="${controls ? controlAlt(kind) : topic[1]}" loading="lazy" decoding="async"></figure>`;
}
export function refreshTutorialInput(root, kind) {
  for (const img of root.querySelectorAll('[data-guide-controls]')) {
    const key = controlsKey(kind);
    if (img.getAttribute('src') === images[key]) continue;
    img.width = dimensions[key].width;
    img.height = dimensions[key].height;
    img.alt = controlAlt(kind);
    img.src = images[key];
  }
}
