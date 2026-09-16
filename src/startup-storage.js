// Invalid saves must never reach restore()'s intentional fresh-world fallback.
export const RECOVERY_KEY = 'mc-clicker-world-recovery-original';
export function readStartupSave(storage, key, parse) {
  let raw;
  try { raw = storage.getItem(key); } catch { const e = Error('Storage unavailable'); e.code='STORAGE'; throw e; }
  if (raw === null) return null;
  try { return parse(raw); } catch {
    // The main slot remains untouched even if backup storage is unavailable/full.
    try { if(storage.getItem(RECOVERY_KEY)===null)storage.setItem(RECOVERY_KEY, raw); } catch {}
    const e = Error('Save requires recovery'); e.code='SAVE_INVALID'; throw e;
  }
}
export function recoverStartupSave(storage, key, next) {
  const current=storage.getItem(key);
  if(current!==null){
    storage.setItem(RECOVERY_KEY,current);
    if(storage.getItem(RECOVERY_KEY)!==current)throw Error('Backup unavailable');
  }
  storage.setItem(key,JSON.stringify(next));
}
