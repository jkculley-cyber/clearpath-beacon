/**
 * Backup-folder helpers — File System Access API.
 *
 * Lets the counselor pick a folder ONCE (e.g. ~/OneDrive/Beacon-Backups/ or
 * ~/GoogleDrive/Beacon/) that the OS already syncs to her cloud provider.
 * The directory handle is stored in IndexedDB (FileSystemDirectoryHandle is
 * structured-clone-friendly). Subsequent saves write silently to that
 * folder if the page still holds permission.
 *
 * This is intentionally NOT an OAuth integration with OneDrive / Google
 * Drive — those need an Azure App Registration / Google Cloud project, a
 * privacy review, and a token-refresh dance. Picking a sync-folder via the
 * standard browser dialog uses the OS-level cloud client the counselor has
 * already configured, with no Clear Path infrastructure in the loop.
 *
 * Browser support: Chromium-based browsers (Chrome / Edge / Opera / Brave).
 * Firefox + Safari fall back to standard Downloads-folder export. The UI
 * checks isFsAccessSupported() before offering the picker.
 */

const HANDLE_DB = 'beacon-fs';
const HANDLE_STORE = 'handles';
const HANDLE_KEY = 'backup-folder';

export function isFsAccessSupported() {
  return typeof window !== 'undefined'
    && typeof window.showDirectoryPicker === 'function';
}

function openHandleDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(HANDLE_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putHandle(handle) {
  const db = await openHandleDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, 'readwrite');
    tx.objectStore(HANDLE_STORE).put(handle, HANDLE_KEY);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function getHandle() {
  const db = await openHandleDb();
  const handle = await new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, 'readonly');
    const req = tx.objectStore(HANDLE_STORE).get(HANDLE_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return handle;
}

async function deleteHandle() {
  const db = await openHandleDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, 'readwrite');
    tx.objectStore(HANDLE_STORE).delete(HANDLE_KEY);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/**
 * Open the system folder picker, store the chosen directory handle, and
 * return its display name. Throws if the user cancels.
 */
export async function pickAndPersistBackupFolder() {
  if (!isFsAccessSupported()) {
    throw new Error('Your browser does not support choosing a backup folder. Use Chrome, Edge, Brave, or Opera, or fall back to standard Downloads.');
  }
  const handle = await window.showDirectoryPicker({
    id: 'beacon-backups',
    mode: 'readwrite',
    startIn: 'documents',
  });
  // Confirm we actually have readwrite permission
  const perm = await handle.requestPermission({ mode: 'readwrite' });
  if (perm !== 'granted') {
    throw new Error('Read-write permission was not granted on that folder.');
  }
  await putHandle(handle);
  return handle.name;
}

/**
 * Get the persisted folder's display name without prompting. Returns null
 * if no folder was chosen, or if permission was revoked.
 */
export async function getBackupFolderName() {
  if (!isFsAccessSupported()) return null;
  const handle = await getHandle();
  if (!handle) return null;
  try {
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    if (perm === 'denied') return null;
    return handle.name;
  } catch {
    return null;
  }
}

export async function clearBackupFolder() {
  await deleteHandle();
}

/**
 * Save a Blob into the persisted folder. Returns true on success, false if
 * no folder is set or permission was lost. Falls back to silent failure so
 * the calling code can drop to a Downloads-folder fallback.
 */
export async function saveBackupToHandle(blob, filename) {
  if (!isFsAccessSupported()) return false;
  const handle = await getHandle();
  if (!handle) return false;
  // queryPermission returns 'granted' | 'prompt' | 'denied'. 'prompt' means
  // we need a user gesture to ask again — for the silent Friday auto-backup
  // we treat that as "not granted." The Settings UI will re-prompt.
  let perm;
  try {
    perm = await handle.queryPermission({ mode: 'readwrite' });
  } catch {
    return false;
  }
  if (perm !== 'granted') return false;

  try {
    const fileHandle = await handle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * Re-prompt for permission on a previously-stored handle (requires user gesture).
 * Returns the folder name on success, null on failure.
 */
export async function reauthorizeBackupFolder() {
  if (!isFsAccessSupported()) return null;
  const handle = await getHandle();
  if (!handle) return null;
  try {
    const perm = await handle.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') return null;
    return handle.name;
  } catch {
    return null;
  }
}
