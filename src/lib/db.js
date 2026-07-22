/**
 * Beacon Data Adapter — Unified interface for local (IndexedDB) and cloud (Supabase) modes.
 *
 * FERPA compliance:
 * - Local mode: all student data stays on-device (IndexedDB). No DPA required.
 * - Cloud mode: data syncs to Supabase. Requires district DPA.
 *
 * Usage:
 *   import { db } from '../lib/db';
 *   const students = await db.select('students', { eq: { status: 'active' }, order: { column: 'name' } });
 *   const student = await db.insert('students', { name: 'Jane', grade: '3', tier: 1 });
 *   await db.update('students', id, { tier: 2 });
 *   await db.del('students', id);
 */

import { supabase } from './supabase';
import * as local from './localDb';
import { checkLicense, getLicenseKey } from './license';

// Check if the local counselor is in an active trial (no license key needed)
const TRIAL_DAYS = 14;
async function isTrialActive() {
  try {
    const counselorData = await local.getAll('counselor');
    const counselor = counselorData[0];
    if (!counselor) return false;
    // Active/extended subscription = not gated
    if (counselor.subscription_status === 'active' || counselor.subscription_status === 'extended') return true;
    // Trial with valid start date
    if (counselor.subscription_status === 'trial' && counselor.trial_started_at) {
      const elapsed = (Date.now() - new Date(counselor.trial_started_at).getTime()) / 86400000;
      return elapsed <= TRIAL_DAYS;
    }
    return false;
  } catch { return false; }
}

// Storage mode: 'local' (IndexedDB) or 'cloud' (Supabase)
// Persisted in localStorage so it survives reloads
const STORAGE_MODE_KEY = 'beacon_storage_mode';

// B4 (CC30 naysayer audit): cloud mode is hard-disabled at the build level until
// (a) district plumbing ships AND (b) cloud RLS on the Beacon Supabase project
// (cghhabcbgyoqwqjzunfo) is confirmed tenant-isolated. Until then Beacon is
// local-only, so a counselor cannot flip to a cloud backend whose isolation is
// unverified. getStorageMode() is the single chokepoint every data path and the
// auth context read through, so coercing it to 'local' neutralizes every cloud
// entry point — including any stale 'cloud' value already in localStorage.
// To re-enable: confirm cloud RLS, then set CLOUD_MODE_ENABLED = true.
const CLOUD_MODE_ENABLED = false;

export function isCloudModeEnabled() {
  return CLOUD_MODE_ENABLED;
}

export function getStorageMode() {
  if (!CLOUD_MODE_ENABLED) return 'local';
  return localStorage.getItem(STORAGE_MODE_KEY) || 'local';
}

export function setStorageMode(mode) {
  if (mode !== 'local' && mode !== 'cloud') throw new Error('Invalid storage mode');
  // Cloud disabled at build level — never persist 'cloud'.
  localStorage.setItem(STORAGE_MODE_KEY, CLOUD_MODE_ENABLED ? mode : 'local');
}

export function isLocalMode() {
  return getStorageMode() === 'local';
}

// Tables exempt from license soft gate (seeding, setup, internal)
const LICENSE_EXEMPT_TABLES = ['lesson_library', 'communication_templates', 'settings', 'counselor'];

// Tables whose edits/deletes get a change-log entry in record_history.
// History writes are best-effort (never block or fail the main operation)
// and bypass the license gate — the log is a protective feature, so it runs
// for trial and gated users too. Fields below are bookkeeping noise, not
// counselor-made changes.
const HISTORY_TABLES = ['students', 'sessions'];
const HISTORY_SKIP_FIELDS = new Set(['updated_at', 'created_at', 'id']);

async function recordHistory(entry) {
  try {
    await local.insert('record_history', { at: new Date().toISOString(), ...entry });
  } catch { /* history must never break the write it describes */ }
}

function diffFields(before, changes) {
  const out = [];
  for (const [field, to] of Object.entries(changes || {})) {
    if (HISTORY_SKIP_FIELDS.has(field)) continue;
    const from = before?.[field];
    // Normalize so 2 vs "2" or null vs undefined don't log phantom edits
    if (String(from ?? '') === String(to ?? '')) continue;
    out.push({ field, from: from ?? null, to: to ?? null });
  }
  return out;
}

// ─── Unified Data API ───

export const db = {
  /**
   * SELECT rows from a table.
   * @param {string} table
   * @param {object} opts - { eq, gte, lte, order: { column, ascending }, limit, select, joins }
   * @returns {Promise<{ data: Array, error: null } | { data: null, error: Error }>}
   */
  async select(table, opts = {}) {
    try {
      if (isLocalMode()) {
        const rows = await local.query(table, opts);
        // Handle joins for local mode
        if (opts.joins) {
          for (const row of rows) {
            for (const join of opts.joins) {
              const { table: jTable, fk, localKey = 'id', as } = join;
              const allJoined = await local.getAll(jTable);
              row[as || jTable] = allJoined.filter(r => r[fk] === row[localKey]);
            }
          }
        }
        // Handle nested select (e.g. 'students(name, grade)')
        if (opts.nestedSelect) {
          for (const row of rows) {
            for (const ns of opts.nestedSelect) {
              const related = await local.getById(ns.table, row[ns.fk]);
              row[ns.as || ns.table] = related || null;
            }
          }
        }
        return { data: rows, error: null };
      }

      // Cloud mode — build Supabase query
      let q = supabase.from(table).select(opts.select || '*');
      if (opts.eq) {
        for (const [col, val] of Object.entries(opts.eq)) {
          q = q.eq(col, val);
        }
      }
      if (opts.gte) {
        for (const [col, val] of Object.entries(opts.gte)) {
          q = q.gte(col, val);
        }
      }
      if (opts.lte) {
        for (const [col, val] of Object.entries(opts.lte)) {
          q = q.lte(col, val);
        }
      }
      if (opts.order) {
        q = q.order(opts.order.column, { ascending: opts.order.ascending ?? true });
      }
      if (opts.limit) {
        q = q.limit(opts.limit);
      }
      return await q;
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * SELECT a single row by ID.
   */
  async selectById(table, id) {
    try {
      if (isLocalMode()) {
        const row = await local.getById(table, id);
        return { data: row, error: null };
      }
      return await supabase.from(table).select('*').eq('id', id).single();
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * INSERT a new row. Returns the inserted row with generated id.
   * Blocked in local mode when license is expired (soft gate).
   */
  async insert(table, record) {
    try {
      if (isLocalMode()) {
        // Soft gate: block new records when license is invalid AND trial is expired
        if (!LICENSE_EXEMPT_TABLES.includes(table)) {
          // If they have a valid license key, check it
          if (getLicenseKey()) {
            const lic = await checkLicense();
            if (lic.softGated) {
              return { data: null, error: new Error('License expired — renew to create new records.') };
            }
          } else {
            // No license key — check if trial is still active
            const trialOk = await isTrialActive();
            if (!trialOk) {
              return { data: null, error: new Error('Your free trial has ended. Enter a license key in Settings to continue.') };
            }
          }
        }
        const row = await local.insert(table, record);
        return { data: row, error: null };
      }
      return await supabase.from(table).insert(record).select().single();
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * INSERT multiple rows.
   */
  async insertMany(table, records) {
    try {
      if (isLocalMode()) {
        if (!LICENSE_EXEMPT_TABLES.includes(table)) {
          if (getLicenseKey()) {
            const lic = await checkLicense();
            if (lic.softGated) return { data: null, error: new Error('License expired — renew to create new records.') };
          } else {
            const trialOk = await isTrialActive();
            if (!trialOk) return { data: null, error: new Error('Your free trial has ended. Enter a license key in Settings to continue.') };
          }
        }
        const rows = [];
        for (const r of records) {
          rows.push(await local.insert(table, r));
        }
        return { data: rows, error: null };
      }
      return await supabase.from(table).insert(records).select();
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * UPDATE a row by ID.
   */
  async update(table, id, changes) {
    try {
      if (isLocalMode()) {
        // Soft gate: block edits when license is expired (exempt: counselor profile + license tables)
        if (!LICENSE_EXEMPT_TABLES.includes(table) && table !== 'counselor') {
          if (getLicenseKey()) {
            const lic = await checkLicense();
            if (lic.softGated) return { data: null, error: new Error('License expired — renew to edit records.') };
          } else {
            const trialOk = await isTrialActive();
            if (!trialOk) return { data: null, error: new Error('Your free trial has ended. Enter a license key in Settings to continue.') };
          }
        }
        let before = null;
        if (HISTORY_TABLES.includes(table)) {
          before = await local.getById(table, id);
        }
        const row = await local.update(table, id, changes);
        if (before) {
          const changed = diffFields(before, changes);
          if (changed.length > 0) {
            await recordHistory({
              table_name: table,
              record_id: id,
              counselor_id: before.counselor_id || null,
              action: 'update',
              changes: changed,
            });
          }
        }
        return { data: row, error: null };
      }
      return await supabase.from(table).update(changes).eq('id', id).select().single();
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * DELETE a row by ID.
   */
  async del(table, id) {
    try {
      if (isLocalMode()) {
        if (!LICENSE_EXEMPT_TABLES.includes(table)) {
          if (getLicenseKey()) {
            const lic = await checkLicense();
            if (lic.softGated) return { error: new Error('License expired — renew to delete records.') };
          } else {
            const trialOk = await isTrialActive();
            if (!trialOk) return { error: new Error('Your free trial has ended. Enter a license key in Settings to continue.') };
          }
        }
        let snapshot = null;
        if (HISTORY_TABLES.includes(table)) {
          snapshot = await local.getById(table, id);
        }
        await local.del(table, id);
        if (snapshot) {
          await recordHistory({
            table_name: table,
            record_id: id,
            counselor_id: snapshot.counselor_id || null,
            action: 'delete',
            snapshot,
          });
        }
        return { error: null };
      }
      return await supabase.from(table).delete().eq('id', id);
    } catch (error) {
      return { error };
    }
  },

  /**
   * COUNT rows matching filters.
   */
  async count(table, eq) {
    try {
      if (isLocalMode()) {
        const n = await local.count(table, eq);
        return { count: n, error: null };
      }
      let q = supabase.from(table).select('id', { count: 'exact', head: true });
      if (eq) {
        for (const [col, val] of Object.entries(eq)) {
          q = q.eq(col, val);
        }
      }
      const { count: c, error } = await q;
      return { count: c, error };
    } catch (error) {
      return { count: 0, error };
    }
  },

  /**
   * Raw Supabase access (cloud mode only — for auth, edge functions, etc.)
   */
  get supabase() {
    return supabase;
  },

  /**
   * Raw local DB access (for export/import, seeding, etc.)
   */
  get local() {
    return local;
  },
};

// ─── Seeded lesson data (bundled for local mode) ───

export async function seedLocalLessons(counselorId, band = 'elementary') {
  if (!isLocalMode()) return;

  // Check if already seeded
  const existing = await local.getAll('lesson_library');
  if (existing.length > 0) return;

  // Dynamically import the lesson data + band grade map
  const { SEED_LESSONS } = await import('./seedLessonData.js');
  const { GRADE_BANDS, DEFAULT_GRADE_BAND } = await import('./constants.js');
  const bandGrades = new Set((GRADE_BANDS[band] || GRADE_BANDS[DEFAULT_GRADE_BAND]).grades);

  // Seed only lessons that overlap the counselor's band; fall back to all if
  // a band somehow matches nothing (keeps the library from being empty).
  const inBand = SEED_LESSONS.filter((l) => (l.grade_tags || []).some((g) => bandGrades.has(g)));
  const toSeed = inBand.length ? inBand : SEED_LESSONS;

  for (const lesson of toSeed) {
    await local.insert('lesson_library', {
      ...lesson,
      counselor_id: counselorId,
      is_favorite: false,
      source_platform: lesson.source_platform || null,
    });
  }
}

export async function seedLocalTemplates(counselorId) {
  if (!isLocalMode()) return;

  const existing = await local.getAll('communication_templates');
  if (existing.length > 0) return;

  const { SEED_TEMPLATES } = await import('./seedTemplateData.js');
  for (const template of SEED_TEMPLATES) {
    await local.insert('communication_templates', {
      ...template,
      counselor_id: counselorId,
    });
  }
}

// ─── Local-mode backup/restore ───

export async function exportLocalBackup() {
  return local.exportAllData();
}

export async function importLocalBackup(json) {
  return local.importAllData(json);
}
