/** Quote a cell for a semicolon-delimited CSV and neutralize spreadsheet formulas.
 * Text beginning with a formula trigger is prefixed with an apostrophe, so
 * spreadsheet imports treat it as text. Number values stay numeric. */
export function spreadsheetCsvCell(value: unknown): string {
  let cell = String(value ?? '');
  if (typeof value === 'string' && (/^[\s\uFEFF]*[=+@-]/.test(cell) || /^[\t\r\n]/.test(cell))) {
    cell = `'${cell}`;
  }
  return `"${cell.replace(/"/g, '""')}"`;
}
