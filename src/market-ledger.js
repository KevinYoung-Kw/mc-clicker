// A receipt ledger, not another income calculation. Call only after settlement.
export const MARKET_RECEIPT_LIMIT = 24;
export function recordMarketSale(s, { source, label, realm, quantity, money }) {
  if (!(quantity > 0 && money > 0) || !Number.isFinite(quantity + money)) return;
  const ledger = s.marketLedger ||= { version: 1, nextId: 1, receipts: [] };
  const bucket = Math.floor(s.play / 10);
  let row = ledger.receipts.find(r => r.source === source && r.bucket === bucket);
  if (!row) {
    row = { id: ledger.nextId++, source, label, realm, bucket, at: s.play, quantity: 0, money: 0 };
    ledger.receipts.push(row);
    ledger.receipts = ledger.receipts.slice(-MARKET_RECEIPT_LIMIT);
  }
  row.quantity += quantity;
  row.money += money;
  row.at = s.play;
}
export function restoreMarketLedger(s, raw) {
  const receipts = (Array.isArray(raw.marketLedger?.receipts) ? raw.marketLedger.receipts : [])
    .filter(r => r && ['overworld', 'nether', 'end'].includes(r.realm) &&
      typeof r.source === 'string' && typeof r.label === 'string' &&
      Number.isFinite(r.money) && r.money > 0 && Number.isFinite(r.quantity) && r.quantity > 0 &&
      Number.isFinite(r.at) && r.at >= 0 && r.at <= s.play)
    .slice(-MARKET_RECEIPT_LIMIT).map((r, index) => ({
      id: index + 1, source: r.source.slice(0, 64), label: r.label.slice(0, 32), realm: r.realm,
      at: r.at, bucket: Math.floor(r.at / 10), quantity: Math.min(r.quantity, 1e30), money: Math.min(r.money, 1e30),
    }));
  s.marketLedger = { version: 1, nextId: receipts.length + 1, receipts };
}
