/* Exhaustive offline matrix for the grade-band logic.
 * Pure functions only (constants.js has no browser deps). */
import {
  GRADE_BANDS, COMBINED_PRESETS, ALL_GRADES, DEFAULT_GRADE_BAND,
  getGrades, getGradeBand, getPromotionLadder, gradeLabel, topGradeLabel,
  isSecondaryServed, touchedBands, gradeFilterTokens, itemMatchesFilter,
  rangeTokenToGrades,
} from '../src/lib/constants.js';

let pass = 0, fail = 0;
const fails = [];
function ok(cond, label, detail = '') {
  if (cond) { pass++; } else { fail++; fails.push(`${label}${detail ? ' :: ' + detail : ''}`); }
}
function eq(a, b, label) {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  ok(A === B, label, `got ${A} want ${B}`);
}

// ---- every counselor state we can be in ----
const STATES = {
  'legacy-user (no grade_band)': {},
  'null counselor': null,
  'undefined field': { grade_band: undefined, served_grades: undefined },
  'garbage band': { grade_band: 'kindergarten-ish' },
  elementary: { grade_band: 'elementary' },
  middle: { grade_band: 'middle' },
  high: { grade_band: 'high' },
  'combined 6-12': { grade_band: 'combined', served_grades: { min: '6', max: '12' } },
  'combined K-8': { grade_band: 'combined', served_grades: { min: 'K', max: '8' } },
  'combined K-12': { grade_band: 'combined', served_grades: { min: 'K', max: '12' } },
  'combined custom 3-9': { grade_band: 'combined', served_grades: { min: '3', max: '9' } },
  'combined broken range (min>max)': { grade_band: 'combined', served_grades: { min: '12', max: '6' } },
  'combined bogus grades': { grade_band: 'combined', served_grades: { min: 'X', max: 'Q' } },
  'combined missing max': { grade_band: 'combined', served_grades: { min: '6' } },
};

console.log('=== 1. getGrades: never empty, always ordered, always valid ===');
for (const [name, c] of Object.entries(STATES)) {
  const g = getGrades(c);
  ok(Array.isArray(g) && g.length > 0, `getGrades non-empty [${name}]`, JSON.stringify(g));
  ok(g.every((x) => ALL_GRADES.includes(x)), `getGrades valid grades [${name}]`, JSON.stringify(g));
  const idx = g.map((x) => ALL_GRADES.indexOf(x));
  ok(idx.every((v, i) => i === 0 || v > idx[i - 1]), `getGrades ordered [${name}]`, JSON.stringify(g));
}
// legacy/garbage must fall back to elementary exactly
eq(getGrades({}), GRADE_BANDS.elementary.grades, 'legacy user -> K-5');
eq(getGrades(null), GRADE_BANDS.elementary.grades, 'null -> K-5');
eq(getGrades({ grade_band: 'garbage' }), GRADE_BANDS.elementary.grades, 'garbage -> K-5');
eq(getGrades({ grade_band: 'combined', served_grades: { min: '12', max: '6' } }),
   GRADE_BANDS.elementary.grades, 'inverted range -> falls back K-5');
eq(getGrades({ grade_band: 'combined', served_grades: { min: '6', max: '12' } }),
   ['6','7','8','9','10','11','12'], '6-12 expands correctly');
eq(getGrades({ grade_band: 'combined', served_grades: { min: 'K', max: '12' } }), ALL_GRADES, 'K-12 = all');
eq(getGrades('middle'), ['6','7','8'], 'string band arg works');

console.log('=== 2. promotion ladder: total, terminal, no orphan targets ===');
for (const [name, c] of Object.entries(STATES)) {
  const grades = getGrades(c);
  const ladder = getPromotionLadder(c);
  ok(Object.keys(ladder).length === grades.length, `ladder covers every served grade [${name}]`,
     `${Object.keys(ladder).length} vs ${grades.length}`);
  const top = grades[grades.length - 1];
  ok(ladder[top] === 'Graduated', `top grade graduates [${name}]`, `${top}->${ladder[top]}`);
  // every non-terminal target must itself be a served grade (no promoting into a void)
  for (const [from, to] of Object.entries(ladder)) {
    if (to !== 'Graduated') {
      ok(grades.includes(to), `ladder target in range [${name}] ${from}->${to}`);
    }
  }
  // no cycles: each promotes strictly upward
  for (const [from, to] of Object.entries(ladder)) {
    if (to !== 'Graduated') {
      ok(ALL_GRADES.indexOf(to) === ALL_GRADES.indexOf(from) + 1, `ladder steps by 1 [${name}] ${from}->${to}`);
    }
  }
}
eq(getPromotionLadder({ grade_band: 'high' }),
   { '9': '10', '10': '11', '11': '12', '12': 'Graduated' }, 'high ladder exact');
eq(getPromotionLadder({ grade_band: 'combined', served_grades: { min: '6', max: '12' } })['8'], '9',
   '6-12: 8th promotes to 9th (does NOT graduate)');
eq(getPromotionLadder({ grade_band: 'middle' })['8'], 'Graduated', 'middle-only: 8th graduates out');

console.log('=== 3. isSecondaryServed / CCMR gating ===');
ok(!isSecondaryServed({}), 'legacy user not secondary');
ok(!isSecondaryServed({ grade_band: 'elementary' }), 'elementary not secondary');
ok(isSecondaryServed({ grade_band: 'middle' }), 'middle IS secondary');
ok(isSecondaryServed({ grade_band: 'high' }), 'high IS secondary');
ok(isSecondaryServed({ grade_band: 'combined', served_grades: { min: '6', max: '12' } }), '6-12 IS secondary');
ok(isSecondaryServed({ grade_band: 'combined', served_grades: { min: 'K', max: '8' } }), 'K-8 IS secondary (has 6-8)');
ok(isSecondaryServed({ grade_band: 'combined', served_grades: { min: 'K', max: '12' } }), 'K-12 IS secondary');
ok(!isSecondaryServed({ grade_band: 'combined', served_grades: { min: 'K', max: '5' } }), 'K-5 range NOT secondary');

console.log('=== 4. touchedBands / filter tokens ===');
eq(touchedBands({ grade_band: 'combined', served_grades: { min: '6', max: '12' } }), ['middle','high'], '6-12 touches middle+high');
eq(touchedBands({ grade_band: 'combined', served_grades: { min: 'K', max: '12' } }), ['elementary','middle','high'], 'K-12 touches all');
eq(touchedBands({ grade_band: 'elementary' }), ['elementary'], 'elementary touches only itself');
for (const [name, c] of Object.entries(STATES)) {
  const toks = gradeFilterTokens(c);
  ok(toks[0] === 'All', `filter tokens start with All [${name}]`);
  ok(new Set(toks).size === toks.length, `filter tokens unique [${name}]`, JSON.stringify(toks));
}

console.log('=== 5. rangeTokenToGrades: no token may silently vanish ===');
const KNOWN = ['K-1','2-5','K-5','K-2','1-5','6-8','6-7','7-8','9-12','9-10','11-12','3-5','K-8','6-12','K-12'];
for (const t of KNOWN) {
  const g = rangeTokenToGrades(t);
  ok(g.length > 0, `token expands [${t}]`, JSON.stringify(g));
}
for (const g of ALL_GRADES) ok(rangeTokenToGrades(g).length === 1, `single grade token [${g}]`);
// the critical regression: unknown token must NOT expand to [] (which hid content everywhere)
ok(rangeTokenToGrades('totally-bogus').length > 0, 'unparseable token is shown, not hidden');
ok(rangeTokenToGrades(undefined).length > 0, 'undefined token is shown, not hidden');
ok(rangeTokenToGrades('').length > 0, 'empty token is shown, not hidden');
eq(rangeTokenToGrades('k-5'), ['K','1','2','3','4','5'], 'lowercase k parses');
eq(rangeTokenToGrades('6 - 8'), ['6','7','8'], 'spaced range parses');

console.log('=== 6. itemMatchesFilter: content visibility per band ===');
const CONTENT = ['K-1','2-5','K-5','K-2','1-5','6-8','9-12'];
for (const [name, c] of Object.entries(STATES)) {
  const served = new Set(getGrades(c));
  // Under "All", every item within the served range must be visible...
  for (const item of CONTENT) {
    const overlaps = rangeTokenToGrades(item).some((g) => served.has(g));
    eq(itemMatchesFilter(item, 'All', served), overlaps, `All-filter visibility [${name}] item=${item}`);
  }
  // ...and at least SOME content must be visible (never a blank page)
  const anyVisible = CONTENT.some((i) => itemMatchesFilter(i, 'All', served));
  ok(anyVisible, `some content visible under All [${name}]`);
}
const hs = new Set(getGrades({ grade_band: 'high' }));
ok(!itemMatchesFilter('K-5', 'All', hs), 'high counselor does NOT see K-5 content');
ok(itemMatchesFilter('9-12', 'All', hs), 'high counselor sees 9-12 content');
const c612 = new Set(getGrades({ grade_band: 'combined', served_grades: { min: '6', max: '12' } }));
ok(itemMatchesFilter('6-8', 'All', c612) && itemMatchesFilter('9-12', 'All', c612),
   '6-12 counselor sees BOTH middle and high content');
ok(!itemMatchesFilter('K-5', 'All', c612), '6-12 counselor does NOT see K-5 content');
ok(itemMatchesFilter('6-8', '6-8', c612), 'specific band filter matches its own content');
ok(!itemMatchesFilter('9-12', '6-8', c612), 'specific band filter excludes other band');

console.log('=== 7. labels ===');
eq(gradeLabel('K'), 'Kindergarten', 'K label');
eq(gradeLabel('1'), '1st Grade', '1st');
eq(gradeLabel('2'), '2nd Grade', '2nd');
eq(gradeLabel('3'), '3rd Grade', '3rd');
eq(gradeLabel('4'), '4th Grade', '4th');
eq(gradeLabel('11'), '11th Grade', '11th (not 11st)');
eq(gradeLabel('12'), '12th Grade', '12th');
eq(topGradeLabel({ grade_band: 'high' }), '12th Grade', 'high top grade');
eq(topGradeLabel({ grade_band: 'elementary' }), '5th Grade', 'elementary top grade');
eq(topGradeLabel({ grade_band: 'combined', served_grades: { min: '6', max: '12' } }), '12th Grade', '6-12 top grade');

console.log('=== 8. band->band transitions: grades change, nothing crashes ===');
const ALL_STATES = Object.entries(STATES);
for (const [fromName, from] of ALL_STATES) {
  for (const [toName, to] of ALL_STATES) {
    const gFrom = getGrades(from), gTo = getGrades(to);
    ok(gFrom.length > 0 && gTo.length > 0, `transition ${fromName} -> ${toName} both valid`);
    // students at grades in `from` but not `to` become out-of-band: must be a computable set
    const orphaned = gFrom.filter((g) => !gTo.includes(g));
    ok(Array.isArray(orphaned), `orphan set computable ${fromName} -> ${toName}`);
    // the ladder for the destination must never reference an orphaned grade as a target
    const ladder = getPromotionLadder(to);
    for (const t of Object.values(ladder)) {
      if (t !== 'Graduated') ok(gTo.includes(t), `post-transition ladder sane ${fromName}->${toName}`);
    }
  }
}

console.log('=== 9. COMBINED_PRESETS integrity ===');
for (const p of COMBINED_PRESETS) {
  const g = getGrades({ grade_band: 'combined', served_grades: { min: p.min, max: p.max } });
  ok(g.length > 1, `preset ${p.key} spans >1 grade`, JSON.stringify(g));
  ok(g[0] === p.min && g[g.length - 1] === p.max, `preset ${p.key} endpoints exact`);
  const spans = touchedBands({ grade_band: 'combined', served_grades: { min: p.min, max: p.max } });
  ok(spans.length >= 2, `preset ${p.key} genuinely spans >=2 bands`, JSON.stringify(spans));
}
ok(DEFAULT_GRADE_BAND === 'elementary', 'default band is elementary (back-compat)');

console.log('\n' + '='.repeat(60));
console.log(`PASS ${pass}   FAIL ${fail}`);
if (fails.length) { console.log('\nFAILURES:'); fails.forEach((f) => console.log('  ✗ ' + f)); }
process.exit(fail ? 1 : 0);
