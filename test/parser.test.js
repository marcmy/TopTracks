'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGs } = require('./load-gs');

const ctx = loadGs([
  'src/Config.gs',
  'src/core/Validation.gs',
  'src/core/KeepaParser.gs',
  'src/core/Scoring.gs'
]);

function readFixtureEml(name) {
  const raw = fs.readFileSync(path.join(__dirname, 'fixtures', 'sanitized', name + '.eml'), 'utf8').replace(/\r\n/g, '\n');
  const subjectBlock = (raw.match(/^Subject:[^\n]*(?:\n[ \t].*)*/m) || [])[0] || '';
  const subject = subjectBlock
    .replace(/^Subject:\s*/i, '')
    .replace(/\n[ \t]+/g, ' ')
    .replace(/=\?utf-8\?b\?([^?]+)\?=/gi, (_, encoded) => Buffer.from(encoded, 'base64').toString('utf8'));
  const date = (raw.match(/^Date:\s*(.*)$/m) || [])[1] || null;
  const boundary = (raw.match(/boundary="([^"]+)"/) || [])[1];
  assert.ok(boundary, 'fixture boundary missing');
  const parts = raw.split('--' + boundary);
  let plainBody = null;
  let htmlBody = null;
  for (const part of parts) {
    const separator = part.indexOf('\n\n');
    if (separator < 0) continue;
    const headers = part.slice(0, separator);
    const body = part.slice(separator + 2).replace(/\n--\s*$/, '').trim();
    if (/Content-Type:\s*text\/plain/i.test(headers)) plainBody = body;
    if (/Content-Type:\s*text\/html/i.test(headers)) htmlBody = body;
  }
  return {
    subject,
    receivedAt: date ? new Date(date).toISOString() : null,
    plainBody,
    htmlBody
  };
}

for (const name of [
  'classico-e-moderno',
  'boy-who-sailed',
  'residential-oil-burners',
  'hq-solutions',
  'lost-classics-jack-oconnor'
]) {
  test('parses sanitized Keepa fixture: ' + name, () => {
    const input = readFixtureEml(name);
    const expected = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'sanitized', name + '.expected.json'), 'utf8'));
    const parsed = ctx.TopTracksParser.parseEmail(input, {
      differenceTolerance: ctx.TOPTRACKS_CONFIG.differenceTolerance
    });
    assert.equal(parsed.ok, true, parsed.error && JSON.stringify(parsed.error));
    assert.deepEqual(JSON.parse(JSON.stringify(parsed.value)), expected.parsed);

    const scored = ctx.TopTracksScoring.scoreEmail(parsed.value, ctx.TOPTRACKS_CONFIG.thresholds);
    assert.equal(scored.bestOfferIndex, expected.bestOfferIndex);
    assert.equal(scored.tier, expected.tier);
    assert.ok(Math.abs(scored.bestOffer.dealDepthPct - expected.bestOfferPercentBelowMax) < 1e-8);
  });
}

test('fails closed when Current/Desired/Difference do not reconcile', () => {
  const input = readFixtureEml('boy-who-sailed');
  input.htmlBody = input.htmlBody.replace('✓&nbsp;-2.09', '✓&nbsp;-1.09');
  const parsed = ctx.TopTracksParser.parseEmail(input, { differenceTolerance: 0.011 });
  assert.equal(parsed.ok, false);
  assert.equal(parsed.error.code, 'VALIDATION_FAILED');
});

test('validation error includes sanitized raw price row when a numeric cell is non-numeric', () => {
  const input = readFixtureEml('boy-who-sailed');
  input.htmlBody = input.htmlBody.replace('✓&nbsp;-2.09', 'N/A');
  const parsed = ctx.TopTracksParser.parseEmail(input, { differenceTolerance: 0.011 });
  assert.equal(parsed.ok, false);
  assert.equal(parsed.error.code, 'VALIDATION_FAILED');
  assert.ok(parsed.error.details.some((detail) => detail.includes('Keepa difference is invalid.')));
  assert.ok(parsed.error.details.some((detail) => detail.includes('raw price row') && detail.includes('Difference="N/A"')));
});
