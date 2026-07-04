/**
 * CSV export helper — shared by the pages that hand tabular data to the
 * front office (Sessions, Communications; Students and Time Tracker have
 * their own older inline versions).
 *
 * Every cell is quoted so names with commas, quotes, or newlines survive
 * Excel round-trips.
 */

function csvCell(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

export function rowsToCsv(header, rows) {
  const lines = [header.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(csvCell).join(','));
  }
  return lines.join('\r\n');
}

export function downloadCsv(filename, header, rows) {
  const csv = rowsToCsv(header, rows);
  // BOM so Excel opens UTF-8 (accented names) correctly
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
