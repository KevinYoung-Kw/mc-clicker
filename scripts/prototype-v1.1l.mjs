// Planning model: isolated queue/power equations, not the game's runtime and not a playtest.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
const DT = 0.25,
  SECONDS = 360;
export function prototype(options = {}) {
  const cfg = {
    raw: 14,
    process: 12,
    haul: 9,
    trade: 20,
    buffer: 120,
    supply: 32,
    stored: 0,
    capacity: 120,
    rawWatts: 6,
    processWatts: 4,
    haulWatts: 2,
    clock: 1,
    reach: 16,
    line: 8,
    repeater: 0,
    studio: false,
    extras: 0,
    ...options,
  };
  const loss = Math.min(0.18, (cfg.line * 0.004) / (1 + 0.35 * cfg.repeater)),
    connected = cfg.line <= cfg.reach + 8 * cfg.repeater;
  let raw = options.initialRaw || 0,
    goods = options.initialGoods || 0,
    energy = cfg.stored,
    earned = 0,
    delivered = 0,
    broadcastSeconds = 0,
    generated = 0,
    consumed = 0,
    spilled = 0,
    rawMade = 0,
    processed = 0;
  const samples = [];
  for (let t = 0; t < SECONDS; t += DT) {
    const wantRaw = raw < cfg.buffer - 0.001 ? cfg.raw * cfg.clock : 0;
    const wantProcess =
      goods < cfg.buffer - 0.001 && (raw > 0 || wantRaw)
        ? cfg.process * cfg.clock
        : 0;
    const wantHaul = raw > 0 || goods > 0 || wantRaw ? cfg.haul : 0;
    let available = energy + cfg.supply * DT;
    generated += cfg.supply * DT;
    const base = cfg.studio ? Math.min(2 * DT, available) : 0;
    available -= base;
    broadcastSeconds += base / 2;
    consumed += base;
    const workload =
      (wantRaw ? cfg.rawWatts * cfg.clock : 0) +
      (wantProcess ? cfg.processWatts * cfg.clock : 0) +
      (wantHaul ? cfg.haulWatts : 0);
    const need = connected ? (workload / (1 - loss)) * DT : 0,
      fraction = need ? Math.min(1, available / need) : connected ? 1 : 0;
    available -= need * fraction;
    consumed += need * fraction;
    const extra = Math.min(available, cfg.extras * DT);
    available -= extra;
    consumed += extra;
    const produced = Math.min(wantRaw * fraction * DT, cfg.buffer - raw);
    raw += produced;
    rawMade += produced;
    const made = Math.min(
      raw,
      wantProcess * fraction * DT,
      wantHaul * fraction * DT,
      cfg.buffer - goods,
    );
    raw -= made;
    goods += made;
    processed += made;
    const sold = Math.min(goods, cfg.trade * DT, wantHaul * fraction * DT);
    goods -= sold;
    delivered += sold;
    earned += sold * 8;
    spilled += Math.max(0, available - cfg.capacity);
    energy = Math.min(cfg.capacity, available);
    if (t % 30 === 0)
      samples.push({
        t,
        raw,
        goods,
        energy,
        delivered,
        powerFraction: fraction,
      });
  }
  assert.ok(
    Math.abs(rawMade + (options.initialRaw || 0) - raw - processed) < 1e-7,
    "raw conservation",
  );
  assert.ok(
    Math.abs(processed + (options.initialGoods || 0) - goods - delivered) <
      1e-7,
    "goods conservation",
  );
  assert.ok(
    Math.abs(generated + cfg.stored - consumed - spilled - energy) < 1e-7,
    "energy conservation",
  );
  return {
    cfg,
    loss,
    connected,
    seconds: SECONDS,
    earned,
    delivered,
    raw,
    goods,
    energy,
    broadcastSeconds,
    generated,
    consumed,
    spilled,
    samples,
  };
}
const rows = {
  baseline: prototype(),
  "drill-before-logistics": prototype({ raw: 23.1, rawWatts: 10.2 }),
  "then-rail": prototype({ raw: 23.1, rawWatts: 10.2, haul: 15 }),
  "then-furnace": prototype({
    raw: 23.1,
    rawWatts: 10.2,
    haul: 15,
    process: 17.4,
    processWatts: 4.8,
  }),
  "short-wire-clock": prototype({ clock: 1.3, haul: 20, supply: 16 }),
  "long-wire-clock": prototype({ clock: 1.3, haul: 20, supply: 16, line: 30 }),
  "long-wire-repeater": prototype({
    clock: 1.3,
    haul: 20,
    supply: 16,
    line: 30,
    repeater: 2,
  }),
  "studio-torch": prototype({
    raw: 0,
    process: 0,
    haul: 0,
    supply: 6,
    studio: true,
    extras: 11,
  }),
  "studio-no-power": prototype({
    raw: 0,
    process: 0,
    haul: 0,
    supply: 0,
    studio: true,
    extras: 11,
  }),
  "full-buffer": prototype({
    initialRaw: 120,
    initialGoods: 120,
    haul: 0,
    trade: 0,
  }),
};
assert.equal(rows["drill-before-logistics"].delivered, rows.baseline.delivered);
assert.ok(rows["then-rail"].delivered > rows.baseline.delivered);
assert.ok(rows["then-furnace"].delivered > rows["then-rail"].delivered);
assert.equal(rows["long-wire-clock"].delivered, 0);
assert.ok(rows["long-wire-repeater"].delivered > 0);
assert.equal(rows["studio-no-power"].broadcastSeconds, 0);
assert.equal(rows["studio-torch"].broadcastSeconds, SECONDS);
assert.equal(rows["full-buffer"].consumed, 0);
mkdirSync("docs/v1.1l/simulation/prototype", { recursive: true });
writeFileSync(
  "docs/v1.1l/simulation/prototype/results.json",
  JSON.stringify(
    {
      method:
        "Planning-only quarter-second stock/energy model; not full economy calibration and not a human playtest.",
      rows,
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  "docs/v1.1l/simulation/prototype/README.md",
  "# 联动原型结果\n\n模型先于运行时改动。10 个 360 秒场景均检查原料、成品、电量守恒；这些结果只确认规则方向，不批准整局发布价格。整局最终数值需在真实游戏实现后重新跑五条路线。\n\n| 场景 | 实际交付 | 到账 | 直播运行秒数 | 消耗电量 |\n|---|---:|---:|---:|---:|\n" +
    Object.entries(rows)
      .map(
        ([id, r]) =>
          `| ${id} | ${r.delivered.toFixed(1)} | ${r.earned.toFixed(0)} | ${r.broadcastSeconds.toFixed(1)} | ${r.consumed.toFixed(1)} |`,
      )
      .join("\n") +
    "\n\n钻机单独提速不会越过运输瓶颈；增加车次后释放加工能力，继续升级炉芯才有进一步收益。超距停止工作，中继器在有限范围内恢复连接。6 E/s 火把可维持基础直播，但不足以支持全部附加设备。满仓停止工作耗电。\n",
);
console.log(
  "10 prototype scenarios: cargo + energy conserved; bottleneck, finite reach, studio shedding, backpressure assertions passed.",
);
