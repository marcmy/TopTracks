'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGs } = require('./load-gs');

const ctx = loadGs(['src/sheets/SheetLogger.gs']);

test('transient Sheets failures retry the same target row without duplicates', () => {
  let lastRowCalls = 0;
  const targetRows = [];
  let writes = 0;
  let writtenValues = null;
  const sheet = {
    getLastRow() {
      lastRowCalls += 1;
      return 3;
    },
    getRange(row) {
      targetRows.push(row);
      return {
        setValues(values) {
          writes += 1;
          if (writes < 3) {
            throw new Error('Service Spreadsheets failed while accessing document with id test.');
          }
          writtenValues = values;
        }
      };
    }
  };
  const keys = {};
  const row = ['m1:0', 'value'];

  const appended = ctx.TopTracksSheetLogger._test.appendIfMissing(sheet, keys, row);

  assert.equal(appended, true);
  assert.equal(lastRowCalls, 1);
  assert.deepEqual(targetRows, [4, 4, 4]);
  assert.deepEqual(Array.from(writtenValues, value => Array.from(value)), [row]);
  assert.equal(keys['m1:0'], true);
});

test('non-transient Sheets failures are not retried or marked written', () => {
  let writes = 0;
  const sheet = {
    getLastRow() { return 7; },
    getRange() {
      return {
        setValues() {
          writes += 1;
          throw new Error('Permission denied.');
        }
      };
    }
  };
  const keys = {};

  assert.throws(
    () => ctx.TopTracksSheetLogger._test.appendIfMissing(sheet, keys, ['m2:0']),
    /Permission denied/
  );
  assert.equal(writes, 1);
  assert.equal(keys['m2:0'], undefined);
});
