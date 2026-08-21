'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGs } = require('./load-gs');

const ctx = loadGs(['src/Code.gs'], {
  TopTracksHistory: {},
  installTopTracks() {},
  removeTopTracksTriggers() { return 0; },
  TopTracksProcessor: {},
  TopTracksConfig: { get() { return { sheet: { enabled: true } }; } }
});

test('backfill summary stays compact and reports counters', () => {
  const text = ctx.TopTracksUi.formatBackfill({
    status: 'ok',
    found: 100,
    processed: 98,
    parseErrors: 1,
    runtimeErrors: 1,
    sheetErrors: 0,
    skipped: 0,
    results: new Array(100).fill({ title: 'should not be dumped' })
  });

  assert.match(text, /Found: 100/);
  assert.match(text, /Processed: 98/);
  assert.match(text, /Parse errors: 1/);
  assert.match(text, /Runtime errors: 1/);
  assert.doesNotMatch(text, /should not be dumped/);
});
