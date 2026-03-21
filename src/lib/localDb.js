/**
 * IndexedDB Data Layer — Beacon Local Mode (FERPA-compliant)
 * All student data stays on-device. No cloud. No server.
 *
 * Mirrors the Supabase schema from migration 001 + 002.
 * Each store maps to a Supabase table.
 */

const DB_NAME = 'beacon_local';
const DB_VERSION = 1;

const STORES = [
  'counselor',         // single record — counselor profile
  'students',
  'groups',
  'group_members',
  'sessions',
  'attendance',
  'progress_ratings',
  'referrals',
  'communications',
  'time_entries',
  'lesson_library',
  'campus_schedule_blocks',
  'communication_templates',
  'counselor_notes',
  'settings',          // key-value config
];

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // counselor — single profile record
      if (!db.objectStoreNames.contains('counselor')) {
        db.createObjectStore('counselor', { keyPath: 'id' });
      }

      // students
      if (!db.objectStoreNames.contains('students')) {
        const s = db.createObjectStore('students', { keyPath: 'id' });
        s.createIndex('status', 'status', { unique: false });
        s.createIndex('grade', 'grade', { unique: false });
        s.createIndex('tier', 'tier', { unique: false });
      }

      // groups
      if (!db.objectStoreNames.contains('groups')) {
        const g = db.createObjectStore('groups', { keyPath: 'id' });
        g.createIndex('status', 'status', { unique: false });
      }

      // group_members
      if (!db.objectStoreNames.contains('group_members')) {
        const gm = db.createObjectStore('group_members', { keyPath: 'id' });
        gm.createIndex('group_id', 'group_id', { unique: false });
        gm.createIndex('student_id', 'student_id', { unique: false });
      }

      // sessions
      if (!db.objectStoreNames.contains('sessions')) {
        const ss = db.createObjectStore('sessions', { keyPath: 'id' });
        ss.createIndex('group_id', 'group_id', { unique: false });
        ss.createIndex('session_date', 'session_date', { unique: false });
        ss.createIndex('status', 'status', { unique: false });
        ss.createIndex('student_id', 'student_id', { unique: false });
      }

      // attendance
      if (!db.objectStoreNames.contains('attendance')) {
        const a = db.createObjectStore('attendance', { keyPath: 'id' });
        a.createIndex('session_id', 'session_id', { unique: false });
        a.createIndex('student_id', 'student_id', { unique: false });
      }

      // progress_ratings
      if (!db.objectStoreNames.contains('progress_ratings')) {
        const pr = db.createObjectStore('progress_ratings', { keyPath: 'id' });
        pr.createIndex('session_id', 'session_id', { unique: false });
        pr.createIndex('student_id', 'student_id', { unique: false });
      }

      // referrals
      if (!db.objectStoreNames.contains('referrals')) {
        const r = db.createObjectStore('referrals', { keyPath: 'id' });
        r.createIndex('status', 'status', { unique: false });
        r.createIndex('student_id', 'student_id', { unique: false });
      }

      // communications
      if (!db.objectStoreNames.contains('communications')) {
        const c = db.createObjectStore('communications', { keyPath: 'id' });
        c.createIndex('student_id', 'student_id', { unique: false });
      }

      // time_entries
      if (!db.objectStoreNames.contains('time_entries')) {
        const t = db.createObjectStore('time_entries', { keyPath: 'id' });
        t.createIndex('entry_date', 'entry_date', { unique: false });
        t.createIndex('domain', 'domain', { unique: false });
      }

      // lesson_library
      if (!db.objectStoreNames.contains('lesson_library')) {
        const l = db.createObjectStore('lesson_library', { keyPath: 'id' });
        l.createIndex('domain_tag', 'domain_tag', { unique: false });
        l.createIndex('is_favorite', 'is_favorite', { unique: false });
      }

      // campus_schedule_blocks
      if (!db.objectStoreNames.contains('campus_schedule_blocks')) {
        const csb = db.createObjectStore('campus_schedule_blocks', { keyPath: 'id' });
        csb.createIndex('day_of_week', 'day_of_week', { unique: false });
      }

      // communication_templates
      if (!db.objectStoreNames.contains('communication_templates')) {
        const ct = db.createObjectStore('communication_templates', { keyPath: 'id' });
      }

      // counselor_notes
      if (!db.objectStoreNames.contains('counselor_notes')) {
        const cn = db.createObjectStore('counselor_notes', { keyPath: 'id' });
        cn.createIndex('student_id', 'student_id', { unique: false });
      }

      // settings (key-value)
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

// --- UUID generator (matches Supabase gen_random_uuid format) ---
export function uuid() {
  return crypto.randomUUID();
}

// --- Generic CRUD ---

export async function getAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getById(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function put(storeName, record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

export async function insert(storeName, record) {
  const withId = { id: uuid(), created_at: new Date().toISOString(), ...record };
  return put(storeName, withId);
}

export async function update(storeName, id, changes) {
  const existing = await getById(storeName, id);
  if (!existing) throw new Error(`Record ${id} not found in ${storeName}`);
  const updated = { ...existing, ...changes, updated_at: new Date().toISOString() };
  return put(storeName, updated);
}

export async function del(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAllByIndex(storeName, indexName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const index = tx.objectStore(storeName).index(indexName);
    const req = index.getAll(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// --- Query helpers (client-side filtering to match Supabase query patterns) ---

export async function query(storeName, { eq, gte, lte, order, limit: lim, select } = {}) {
  let rows = await getAll(storeName);

  // Apply eq filters
  if (eq) {
    for (const [col, val] of Object.entries(eq)) {
      rows = rows.filter(r => r[col] === val);
    }
  }

  // Apply gte filters
  if (gte) {
    for (const [col, val] of Object.entries(gte)) {
      rows = rows.filter(r => r[col] >= val);
    }
  }

  // Apply lte filters
  if (lte) {
    for (const [col, val] of Object.entries(lte)) {
      rows = rows.filter(r => r[col] <= val);
    }
  }

  // Sort
  if (order) {
    const { column, ascending = true } = order;
    rows.sort((a, b) => {
      const av = a[column] ?? '';
      const bv = b[column] ?? '';
      if (av < bv) return ascending ? -1 : 1;
      if (av > bv) return ascending ? 1 : -1;
      return 0;
    });
  }

  // Limit
  if (lim) rows = rows.slice(0, lim);

  return rows;
}

// --- Count helper ---
export async function count(storeName, eq) {
  let rows = await getAll(storeName);
  if (eq) {
    for (const [col, val] of Object.entries(eq)) {
      rows = rows.filter(r => r[col] === val);
    }
  }
  return rows.length;
}

// --- Settings helpers ---

export async function getSetting(key) {
  const record = await getById('settings', key);
  return record ? record.value : null;
}

export async function setSetting(key, value) {
  return put('settings', { key, value });
}

// --- Bulk export / import ---

export async function exportAllData() {
  const data = {};
  for (const storeName of STORES) {
    data[storeName] = await getAll(storeName);
  }
  data._exportedAt = new Date().toISOString();
  data._version = DB_VERSION;
  return data;
}

export async function importAllData(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  const db = await openDB();

  for (const storeName of STORES) {
    if (!data[storeName]) continue;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      for (const record of data[storeName]) {
        store.put(record);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

// --- Join helper (simulates Supabase nested selects) ---

export async function getWithJoin(storeName, id, joins) {
  const record = await getById(storeName, id);
  if (!record || !joins) return record;

  for (const { table, fk, as } of joins) {
    record[as || table] = await getAllByIndex(table, fk, record.id);
  }
  return record;
}
