export const BACKUP_KEY = 'mc-clicker-world-before-import';
export const PREVIOUS_BACKUP_KEY = `${BACKUP_KEY}-previous`;

// Keep the live slot and the restore slot aligned: never replace the older
// backup until the imported main write has succeeded. If any write fails,
// roll both slots back so the current world is unchanged.
export function commitImportedSave(storage, key, current, imported, now = Date.now()) {
  const backup = JSON.stringify({ ...current, savedAt: now });
  const next = JSON.stringify({ ...imported, savedAt: now });
  let previous;
  let priorMain;
  try {
    previous = storage.getItem(BACKUP_KEY);
    priorMain = storage.getItem(key);
    if (previous !== null) storage.setItem(PREVIOUS_BACKUP_KEY, previous);
    storage.setItem(key, next);
    storage.setItem(BACKUP_KEY, backup);
  } catch {
    try {
      if (priorMain === null) storage.removeItem(key);
      else if (priorMain !== undefined) storage.setItem(key, priorMain);
      if (previous === null) storage.removeItem(BACKUP_KEY);
      else if (previous !== undefined) storage.setItem(BACKUP_KEY, previous);
    } catch { /* Restore-best-effort; the thrown error below still tells the player nothing was applied. */ }
    throw Error('浏览器未能保存。请先复制当前存档码，并允许本地存储后重试；当前世界没有被替换。');
  }
  return now;
}

export function readImportBackup(storage) {
  try {
    return storage.getItem(BACKUP_KEY) ?? storage.getItem(PREVIOUS_BACKUP_KEY);
  } catch {
    return null;
  }
}
