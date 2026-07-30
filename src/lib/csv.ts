// Minimal hand-rolled CSV formatting + browser download trigger — no
// dependency needed for something this small. Used by AdminDashboardPage's
// "투자 내역 CSV 다운로드" / "심사 내역 CSV 다운로드" buttons.

/** Standard CSV field escaping: wrap in quotes (doubling any internal
 * quotes) if the field contains a comma, quote, or newline. */
function escapeCsvField(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/** Builds a full CSV string (header row + data rows) from plain arrays. */
export function rowsToCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(escapeCsvField).join(',')).join('\r\n')
}

// Excel on Windows (what this is actually opened in) mojibake's Korean
// text in a UTF-8 CSV without a byte-order mark — prepend one so Excel
// detects the encoding correctly instead of guessing a legacy codepage.
const UTF8_BOM = '﻿'

/** Triggers a browser download of `csvContent` as `filename`, via a Blob +
 * temporary `<a download>` link (standard no-dependency pattern). */
export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([UTF8_BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** Today's date as YYYY-MM-DD, for CSV filenames (e.g. 투자내역_2026-07-30.csv). */
export function todayDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
