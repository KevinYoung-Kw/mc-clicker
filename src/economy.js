// Fixed coefficients. Full-route calibration is recorded in docs/v1.1l/simulation.
export const DIMENSION_RULES = Object.freeze({
  heatCapacity: 120,
  heatPerBlaze: 8,
  heatPerGoods: 0.5,
  recoveredElectricityPerGoods: 8,
  magmaPeriod: 10,
  magmaBatch: 60,
  ghastPeriod: 12,
  ghastCapacity: 80,
  ghastFlight: 3,
  endermanPeriod: 8,
  endermanCapacity: 64,
  endermanFlight: 0.6,
  dragonPeriod: 40,
  dragonCapacity: 800,
  dragonFlight: 6,
  netherTransfer: 8,
  chestTransfer: 6,
  projectShare: 0.65,
});
export const ORDER_RULES = Object.freeze({
  interval: 90,
  life: 180,
  max: 2,
  targets: { overworld: 64, nether: 128, end: 96 },
  values: { overworld: 12, nether: 1200, end: 3000000 },
  premium: 1.4,
  cropTarget: 32,
});
export const CROP_GOODS = Object.freeze({
  wheat: { name: "小麦", value: 4 },
  carrot: { name: "胡萝卜", value: 6 },
  potato: { name: "马铃薯", value: 8 },
  beet: { name: "甜菜", value: 10 },
  pumpkin: { name: "南瓜", value: 14 },
  wool: { name: "羊毛", value: 8 },
});
