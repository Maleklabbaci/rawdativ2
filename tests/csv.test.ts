import test from 'node:test';
import assert from 'node:assert/strict';
import { spreadsheetCsvCell } from '../src/utils/csv';

test('CSV escapes quotes and neutralizes formula-like text while retaining numbers', () => {
  for (const input of ['=SUM(1,1)', '  +1+1', '@something', '-2+3', '\ttext', '\rdata', '\uFEFF=cmd']) {
    assert.equal(spreadsheetCsvCell(input), `"'${input}"`);
  }
  assert.equal(spreadsheetCsvCell(-12), '"-12"');
  assert.equal(spreadsheetCsvCell('hello; "monde"'), '"hello; ""monde"""');
  assert.equal(spreadsheetCsvCell(null), '""');
});
