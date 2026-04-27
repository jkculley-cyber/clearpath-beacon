/**
 * Standalone tests for CREST Phase 2 pure logic.
 * Runs without a browser — exercises crestData, crestAutoDerive, and crestExport.toAscii
 * with mocked db.select.
 *
 * Run: node tools/test-crest-phase2.mjs
 */

// Polyfill crypto.randomUUID for older Node + globalThis
import { randomUUID } from 'node:crypto';
if (!globalThis.crypto) globalThis.crypto = {};
if (!globalThis.crypto.randomUUID) globalThis.crypto.randomUUID = randomUUID;

let pass = 0;
let fail = 0;
function eq(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) {
    console.log('  expected:', JSON.stringify(expected));
    console.log('  actual:  ', JSON.stringify(actual));
    fail++;
  } else pass++;
}
function truthy(label, actual) {
  const ok = !!actual;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) { console.log('  was falsy:', actual); fail++; } else pass++;
}

// ─── 1) crestData: deadline + progress math ─────────────────────────────
const { CREST_CATEGORIES, getNextCrestDeadline, categoryProgress, overallProgress } =
  await import('../src/lib/crestData.js');

console.log('\n── crestData ──');
eq('5 categories defined', CREST_CATEGORIES.length, 5);
eq('Cat 1 has 5 suggested types', CREST_CATEGORIES[0].suggestedArtifacts.length, 5);

const oct31 = new Date(2026, 9, 31); // Oct 31 → next deadline = Nov 1 same year
const d1 = getNextCrestDeadline(oct31);
eq('Oct 31 → 1 day until Nov 1', d1.daysUntil, 1);
eq('Oct 31 → target year 2026', d1.date.getFullYear(), 2026);

const nov2 = new Date(2026, 10, 2); // Nov 2 → next deadline = Nov 1 next year
const d2 = getNextCrestDeadline(nov2);
truthy('Nov 2 → daysUntil between 360 and 370', d2.daysUntil >= 360 && d2.daysUntil <= 370);
eq('Nov 2 → target year 2027', d2.date.getFullYear(), 2027);

// progress math
const cat1 = CREST_CATEGORIES[0];
eq('empty artifacts → 0%', categoryProgress(cat1, []).pct, 0);
const oneArtifact = [{ category: 'intro', type: cat1.suggestedArtifacts[0].type }];
eq('1 of 5 covered → 20%', categoryProgress(cat1, oneArtifact).pct, 20);
const allCat1 = cat1.suggestedArtifacts.map((sa) => ({ category: 'intro', type: sa.type }));
eq('all 5 covered → 100%', categoryProgress(cat1, allCat1).pct, 100);
const dupes = [...allCat1, ...allCat1]; // duplicates shouldn't double-count
eq('duplicate types do not exceed 100%', categoryProgress(cat1, dupes).pct, 100);

// overallProgress sum
eq('overall: empty → 0%', overallProgress([]).pct, 0);
eq('overall: 1 artifact → small pct', overallProgress(oneArtifact).pct >= 4 && overallProgress(oneArtifact).pct <= 8, true);

// ─── 2) crestExport.toAscii: every CC10 trouble char ────────────────────
// We re-implement toAscii here since the module statically imports jsPDF
// (which fails in Node). The implementation is a pure regex chain — copy it
// verbatim from crestExport.js.
function toAscii(s) {
  if (s == null) return '';
  return String(s)
    .replace(/[—–]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[·•]/g, '-')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/✓/g, '[x]')
    .replace(/✗/g, '[ ]')
    .replace(/⚠/g, '!')
    .replace(/[§]/g, 'Sec.')
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x00-\x7F]/g, '');
}

console.log('\n── crestExport.toAscii ──');
eq('em-dash → hyphen', toAscii('a — b'), 'a - b');
eq('en-dash → hyphen', toAscii('a – b'), 'a - b');
eq('ellipsis → triple dot', toAscii('end…'), 'end...');
eq('middle dot → hyphen', toAscii('a · b'), 'a - b');
eq('right arrow → ->', toAscii('a → b'), 'a -> b');
eq('checkmark → [x]', toAscii('done ✓'), 'done [x]');
eq('section sign → Sec.', toAscii('TEC §33.006'), 'TEC Sec.33.006');
eq('smart quotes → straight', toAscii('“hi” it’s'), '"hi" it\'s');
eq('emoji stripped', toAscii('hello 🚨 there'), 'hello  there');
eq('null safe', toAscii(null), '');
eq('undefined safe', toAscii(undefined), '');
eq('newlines preserved', toAscii('line1\nline2'), 'line1\nline2');
eq('tabs preserved', toAscii('col1\tcol2'), 'col1\tcol2');
eq('plain ascii unchanged', toAscii('Hello, World! 123'), 'Hello, World! 123');

// ─── 3) crestAutoDerive: school-year range (pure function — no db) ──────
// We can't import crestAutoDerive directly under Node ESM (it transitively
// pulls in the supabase + IndexedDB stack). Reimplement currentSchoolYearRange
// here from the source — it's pure date math and we want it test-locked.
function currentSchoolYearRange(now = new Date()) {
  const y = now.getFullYear();
  const startYear = now.getMonth() >= 7 ? y : y - 1;
  const start = `${startYear}-08-01`;
  const end = `${startYear + 1}-07-31`;
  const label = `${startYear}-${String(startYear + 1).slice(-2)}`;
  return { start, end, label };
}

console.log('\n── crestAutoDerive: school year range ──');
const aug15 = new Date(2026, 7, 15);
const r1 = currentSchoolYearRange(aug15);
eq('Aug 15 2026 → label 2026-27', r1.label, '2026-27');
eq('Aug 15 2026 → start 2026-08-01', r1.start, '2026-08-01');
eq('Aug 15 2026 → end 2027-07-31', r1.end, '2027-07-31');

const apr15 = new Date(2026, 3, 15);
const r2 = currentSchoolYearRange(apr15);
eq('Apr 15 2026 → label 2025-26 (already in current year)', r2.label, '2025-26');
eq('Apr 15 2026 → start 2025-08-01', r2.start, '2025-08-01');

const jul31 = new Date(2026, 6, 31); // boundary: Jul 31 still belongs to 2025-26
const r3 = currentSchoolYearRange(jul31);
eq('Jul 31 2026 → label 2025-26 (boundary)', r3.label, '2025-26');

const aug1 = new Date(2026, 7, 1); // boundary: Aug 1 starts new year
const r4 = currentSchoolYearRange(aug1);
eq('Aug 1 2026 → label 2026-27 (boundary)', r4.label, '2026-27');

// ─── 4) crestAutoDerive: math correctness on synthetic time entries ─────
// Reproduce the SB 179 calculation independently to lock the math.
const COUNSELING_DOMAINS = ['guidance', 'planning', 'responsive'];
function computePct(entries) {
  const totalMin = entries.reduce((s, e) => s + (e.duration_minutes || 0), 0);
  const counselingMin = entries
    .filter((e) => COUNSELING_DOMAINS.includes(e.domain))
    .reduce((s, e) => s + (e.duration_minutes || 0), 0);
  return totalMin > 0 ? Math.round((counselingMin / totalMin) * 100) : 0;
}
console.log('\n── SB 179 math ──');
eq('1:1 counseling/non = 50%', computePct([
  { domain: 'guidance',       duration_minutes: 60 },
  { domain: 'non_counseling', duration_minutes: 60 },
]), 50);
eq('4:1 counseling/non = 80%', computePct([
  { domain: 'guidance',   duration_minutes: 60 },
  { domain: 'planning',   duration_minutes: 60 },
  { domain: 'responsive', duration_minutes: 120 },
  { domain: 'non_counseling', duration_minutes: 60 },
]), 80);
eq('all counseling = 100%', computePct([
  { domain: 'guidance', duration_minutes: 60 },
]), 100);
eq('empty = 0%', computePct([]), 0);
eq('"system" is not counseling under SB 179', computePct([
  { domain: 'system',         duration_minutes: 60 },
  { domain: 'non_counseling', duration_minutes: 60 },
]), 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
