import { MAIL_CATALOG } from "./mail-content.js";

// Mail rewards become snapshots when claimed. The catalogue carries content;
// save contains only delivery/read/claim receipts and the postal service level.
export const MAIL_TYPES = Object.freeze([
  "activity",
  "system",
  "story",
  "tutorial",
]);
export const POSTAL_RATES = Object.freeze([0, 1, 2, 4, 7, 11]);
export const POSTAL_UPGRADE_COSTS = Object.freeze([40, 100, 240, 520]);
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const validNumber = (value) => Number.isFinite(value) && value >= 0;
const clock = (s) => (validNumber(s?.play) ? s.play : 0);
const definition = (id) => MAIL_CATALOG.find((letter) => letter.id === id);
const hasReward = (item) => item?.reward?.kind === "claim-rate";
const introduced = (item) =>
  Number.isInteger(item?.introducedVersion) && item.introducedVersion > 0
    ? item.introducedVersion
    : 1;
const catalogVersion = () => Math.max(1, ...MAIL_CATALOG.map(introduced));
const deliveryReady = (s, item) =>
  (item.delivery?.requires || []).every((id) => (s.counts?.[id] || 0) > 0);
export const mailboxOwned = (s) => (s?.counts?.V18 || 0) > 0;

export function freshMail() {
  return {
    version: 1,
    catalogVersion: catalogVersion(),
    postalLevel: 0,
    letters: {},
  };
}

function newLetter(at) {
  return {
    deliveredAt: at,
    readAt: null,
    claimedRate: null,
    reward: null,
    claimedAt: null,
    blocked: false,
  };
}

function blockedLetter(raw = {}) {
  return {
    deliveredAt: validNumber(raw?.deliveredAt) ? raw.deliveredAt : 0,
    readAt: validNumber(raw?.readAt) ? raw.readAt : 0,
    claimedRate: 0,
    reward: 0,
    claimedAt: validNumber(raw?.claimedAt) ? raw.claimedAt : null,
    blocked: true,
  };
}

function restoreLetter(raw) {
  if (!raw || typeof raw !== "object" || raw.blocked === true)
    return blockedLetter(raw);
  const deliveredAt = raw.deliveredAt;
  if (!validNumber(deliveredAt) || raw.blocked !== false)
    return blockedLetter(raw);
  // Unclaimed legacy read snapshots are deliberately discarded: players may
  // wait and claim using their later actual income rate. A claim receipt is
  // different; damage to one must never reopen a reward.
  if (raw.claimedAt === null) {
    if (raw.readAt === null) return newLetter(deliveredAt);
    if (!validNumber(raw.readAt)) return blockedLetter(raw);
    return { ...newLetter(deliveredAt), readAt: raw.readAt };
  }
  const claimedRate = raw.claimedRate ?? raw.readRate;
  if (
    !validNumber(raw.readAt) ||
    !validNumber(claimedRate) ||
    !validNumber(raw.reward) ||
    !Number.isFinite(claimedRate * 5) ||
    raw.reward !== claimedRate * 5 ||
    !validNumber(raw.claimedAt)
  )
    return blockedLetter(raw);
  return {
    deliveredAt,
    readAt: raw.readAt,
    claimedRate,
    reward: raw.reward,
    claimedAt: raw.claimedAt,
    blocked: false,
  };
}

export function restoreMail(raw, s, { legacy = false } = {}) {
  const mail = freshMail(),
    valid =
      raw?.version === 1 && raw.letters && typeof raw.letters === "object",
    previousCatalog =
      raw?.catalogVersion === undefined
        ? 1
        : Number.isInteger(raw.catalogVersion) && raw.catalogVersion > 0
          ? raw.catalogVersion
          : catalogVersion();
  if (mailboxOwned(s)) {
    mail.postalLevel =
      valid && Number.isInteger(raw.postalLevel)
        ? Math.max(1, Math.min(5, raw.postalLevel))
        : 1;
  }
  for (const item of MAIL_CATALOG) {
    if (valid && has(raw.letters, item.id))
      mail.letters[item.id] = restoreLetter(raw.letters[item.id]);
    else if (mailboxOwned(s) && deliveryReady(s, item))
      mail.letters[item.id] =
        (legacy && raw === undefined) ||
        (valid && introduced(item) > previousCatalog)
          ? newLetter(clock(s))
          : blockedLetter();
  }
  return mail;
}

export function ensureMail(s) {
  if (!s.mail || s.mail.version !== 1 || !s.mail.letters)
    s.mail = restoreMail(s.mail, s);
  if (mailboxOwned(s)) {
    if (!Number.isInteger(s.mail.postalLevel) || s.mail.postalLevel < 1)
      s.mail.postalLevel = 1;
    s.mail.postalLevel = Math.min(5, s.mail.postalLevel);
    for (const item of MAIL_CATALOG) deliverMail(s, item.id);
    s.mail.catalogVersion = catalogVersion();
  }
  return s.mail;
}

export function deliverMail(s, id, at = clock(s)) {
  const item = definition(id);
  if (!mailboxOwned(s) || !item || !s.mail?.letters || !deliveryReady(s, item))
    return { ok: false, reason: "先建成邮箱" };
  if (has(s.mail.letters, id)) return { ok: false, reason: "这封信已经送达" };
  s.mail.letters[id] = newLetter(validNumber(at) ? at : clock(s));
  return { ok: true, letter: s.mail.letters[id] };
}

export function mailSummary(s) {
  const summary = { total: 0, unread: 0, unclaimed: 0, claimed: 0 };
  if (!mailboxOwned(s)) return summary;
  for (const item of MAIL_CATALOG) {
    const letter = s.mail?.letters?.[item.id];
    if (!letter) continue;
    summary.total++;
    if (letter.claimedAt !== null) summary.claimed++;
    else if (!letter.blocked && letter.readAt === null) summary.unread++;
    else if (!letter.blocked && hasReward(item)) summary.unclaimed++;
  }
  return summary;
}

export function readMail(s, id) {
  if (!mailboxOwned(s)) return { ok: false, reason: "先建成邮箱" };
  if (!definition(id)) return { ok: false, reason: "没有找到这封信" };
  const mail = ensureMail(s),
    letter = mail.letters[id];
  if (!letter) return { ok: false, reason: "这封信还没有送达" };
  if (letter.readAt !== null || letter.blocked)
    return { ok: true, first: false, letter };
  letter.readAt = clock(s);
  return { ok: true, first: true, letter };
}

export function mailRewardPreview(s, rate = s.rate) {
  const actual = validNumber(rate) && Number.isFinite(rate * 5) ? rate : 0;
  return { rate: actual, value: actual * 5 };
}

export function claimMail(s, id, rate = s.rate) {
  if (!mailboxOwned(s) || !definition(id))
    return { ok: false, reason: "没有找到这封信" };
  if (!hasReward(definition(id)))
    return { ok: false, reason: "这封信没有附带奖励" };
  const letter = s.mail?.letters?.[id];
  if (!letter || letter.readAt === null)
    return { ok: false, reason: "先读一读信里的内容" };
  const checked = restoreLetter(letter);
  if (checked.blocked) {
    s.mail.letters[id] = checked;
    return { ok: false, reason: "这封信的奖励记录无法核对，仍可查看正文" };
  }
  if (letter.claimedAt !== null)
    return { ok: false, reason: "这封信的奖励已经领取" };
  // Use the same last actual earning rate shown in the HUD, at this click.
  // Mark before returning to the wallet adapter to reject repeated input.
  const snapshot = mailRewardPreview(s, rate);
  letter.claimedRate = snapshot.rate;
  letter.reward = snapshot.value;
  letter.claimedAt = clock(s);
  return { ok: true, value: letter.reward };
}

export function postalLevel(s) {
  return mailboxOwned(s)
    ? Math.max(1, Math.min(5, Math.floor(s.mail?.postalLevel || 1)))
    : 0;
}
export const postalRate = (s) => POSTAL_RATES[postalLevel(s)];
export function postalUpgradeCost(s) {
  const level = postalLevel(s);
  return level > 0 && level < 5 ? POSTAL_UPGRADE_COSTS[level - 1] : null;
}

export function upgradePostal(s) {
  if (!mailboxOwned(s)) return { ok: false, reason: "先建成邮箱" };
  const cost = postalUpgradeCost(s);
  if (cost === null) return { ok: false, reason: "邮政已经达到最高等级" };
  if (!validNumber(s.money) || s.money < cost)
    return { ok: false, reason: "绿宝石还不够" };
  const mail = ensureMail(s);
  s.money -= cost;
  mail.postalLevel++;
  return { ok: true, cost, level: mail.postalLevel, rate: postalRate(s) };
}
