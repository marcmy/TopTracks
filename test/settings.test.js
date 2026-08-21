'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGs } = require('./load-gs');

const ctx = loadGs(['src/Config.gs', 'src/sheets/Settings.gs']);
const settings = ctx.TopTracksSettings;

test('Douglas 50/30/10 discount settings map to 0.50/0.70/0.90 price ratios', () => {
  const parsed = settings._test.parseValues({
    exceptionalDiscount: 0.50,
    strongDiscount: 0.30,
    moderateDiscount: 0.10,
    starExceptional: true,
    starStrong: false,
    sheetLoggingEnabled: true
  });

  assert.deepEqual(JSON.parse(JSON.stringify(parsed.thresholds)), {
    exceptionalMaxRatio: 0.5,
    strongMaxRatio: 0.7,
    moderateMaxRatio: 0.9
  });
  assert.equal(parsed.starExceptional, true);
  assert.equal(parsed.starStrong, false);
  assert.equal(parsed.sheetLoggingEnabled, true);
});

test('settings reject tier percentages in the wrong order', () => {
  assert.throws(() => settings._test.parseValues({
    exceptionalDiscount: 0.30,
    strongDiscount: 0.50,
    moderateDiscount: 0.10,
    starExceptional: true,
    starStrong: false,
    sheetLoggingEnabled: true
  }), /Exceptional >= Strong >= Moderate/);
});

test('new default tier scale is 50+ / 30+ / 10+ percent below max', () => {
  assert.equal(ctx.TOPTRACKS_CONFIG.thresholds.exceptionalMaxRatio, 0.50);
  assert.equal(ctx.TOPTRACKS_CONFIG.thresholds.strongMaxRatio, 0.70);
  assert.equal(ctx.TOPTRACKS_CONFIG.thresholds.moderateMaxRatio, 0.90);
});
