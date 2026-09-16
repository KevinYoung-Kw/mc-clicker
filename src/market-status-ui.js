import { formatHudNumber, exactBalance } from './hud-numbers.js';

export function marketCargoMarkup() {
  return `<section class="market-cargo" aria-label="待交货物"><h4>待运货物</h4><div class="market-cargo-summary"><span>等待处理 <b data-cargo-total>0</b></span><span>运输中 <b data-cargo-moving>0</b></span></div><div class="cargo-columns" aria-hidden="true"><span>货物</span><span>数量</span><span>状态</span></div><div class="cargo-list" data-cargo-list tabindex="0" aria-label="货物运输列表"></div></section><section class="market-receipts" aria-label="最近成交"><h4>最近成交</h4><div class="receipt-columns"><span>货物</span><span>售出</span><span>收入 ◆</span></div><div data-market-receipts tabindex="0" aria-label="成交记录列表"></div><small>已入账的普通出售 · 按 10 秒合并</small></section>`;
}

export function refreshMarketReceipts(root, s) {
  const list = root.querySelector('[data-market-receipts]'); if (!list) return;
  const records = [...(s.marketLedger?.receipts || [])].reverse();
  const rows = new Map([...list.querySelectorAll('[data-receipt]')].map(el=>[Number(el.dataset.receipt),el]));
  const top = list.getBoundingClientRect().top, scroll = list.scrollTop;
  const anchor = [...rows.values()].find(row=>row.getBoundingClientRect().bottom>top);
  const offset = anchor?.getBoundingClientRect().top-top;
  const ids = new Set(records.map(r=>r.id));
  for (const [id,row] of rows) if (!ids.has(id)) row.remove();
  // Most recent groups first. Within a group ticking values never reorder rows.
  let cursor=list.firstElementChild;
  for (const receipt of records) {
    let row = rows.get(receipt.id);
    if (!row) { row=document.createElement('div');row.dataset.receipt=receipt.id;row.innerHTML='<strong></strong><span></span><b></b>'; }
    if(row!==cursor)list.insertBefore(row,cursor);
    cursor=row.nextElementSibling;
    text(row.children[0],receipt.label); row.children[0].title=receipt.label;
    text(row.children[1],formatHudNumber(receipt.quantity, true));row.children[1].title=receipt.quantity.toLocaleString('en-US',{maximumFractionDigits:2})+' 份';
    text(row.children[2],formatHudNumber(receipt.money, true));row.children[2].title=receipt.money.toLocaleString('en-US',{maximumFractionDigits:2})+' 绿宝石';
  }
  let empty=list.querySelector('.cargo-empty');
  if (!empty) { empty=document.createElement('p');empty.className='cargo-empty';empty.textContent='尚无成交';list.append(empty); }
  empty.hidden=!!records.length;
  list.scrollTop=scroll>0&&anchor?.isConnected?list.scrollTop+anchor.getBoundingClientRect().top-top-offset:scroll;
}
const text = (el, value) => { if (el.textContent !== value) el.textContent = value; };
export function refreshMarketCargo(root, community) {
  const list = root.querySelector('[data-cargo-list]');
  if (!list) return;
  const batches = community.batches, rows = new Map([...list.querySelectorAll('[data-cargo-id]')].map(el => [el.dataset.cargoId, el]));
  text(root.querySelector('[data-cargo-total]'), formatHudNumber(batches.reduce((n,b)=>n+b.qty,0)) + ' 份');
  text(root.querySelector('[data-cargo-moving]'), formatHudNumber(batches.reduce((n,b)=>n+(b.claimed?b.qty:0),0)) + ' 份');
  const top = list.getBoundingClientRect().top;
  const anchor = [...rows.values()].find(row => row.getBoundingClientRect().bottom > top);
  const offset = anchor?.getBoundingClientRect().top - top, scroll = list.scrollTop;
  const ids = new Set(batches.map(b=>String(b.id)));
  for (const [id,row] of rows) if (!ids.has(id)) row.remove();
  let cursor = list.firstElementChild;
  for (const batch of batches) {
    const id=String(batch.id);
    let row=rows.get(id);
    if (!row) {
      row=document.createElement('div');row.dataset.cargoId=id;
      row.innerHTML='<strong></strong><span class="cargo-quantity"></span><span class="cargo-state"></span>';
    }
    if (row !== cursor) list.insertBefore(row,cursor);
    cursor=row.nextElementSibling;
    text(row.children[0],batch.label);row.children[0].title=batch.label;
    text(row.children[1],formatHudNumber(batch.qty));row.children[1].title=exactBalance(batch.qty)+' 份';
    const state = batch.claimed ? '正在运送' : batch.delivered > 0 ? '等待交易' : '等待取货';
    text(row.children[2],state);row.dataset.cargoState=batch.claimed?'moving':batch.delivered>0?'trading':'waiting';
  }
  let empty=list.querySelector('.cargo-empty');
  if (!empty) { empty=document.createElement('p');empty.className='cargo-empty';empty.textContent='暂无待交货物';list.append(empty); }
  empty.hidden=!!batches.length;
  list.scrollTop=anchor?.isConnected ? list.scrollTop+anchor.getBoundingClientRect().top-top-offset : scroll;
}
