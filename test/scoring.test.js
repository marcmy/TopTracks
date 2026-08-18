'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGs } = require('./load-gs');

const ctx = loadGs(['src/Config.gs', 'src/core/Scoring.gs']);
const scoring = ctx.TopTracksScoring;
const thresholds = ctx.TOPTRACKS_CONFIG.thresholds;

function offer(currentPrice, desiredPrice) {
  return {
    condition: 'Used, good',
    currentPrice,
    desiredPrice,
    keepaDifference: currentPrice - desiredPrice,
    cause: 'fixture'
  };
}

test('acceptance case: 61.13 / 78.00 is Strong at about 21.6% below max', () => {
  const result = scoring.scoreOffer(offer(61.13, 78), thresholds);
  assert.equal(result.tier, 'Strong');
  assert.ok(Math.abs(result.dollarBelowMax - 16.87) < 1e-9);
  assert.ok(Math.abs(result.dealDepthPct - 21.6282051282) < 1e-8);
});

test('tier boundaries are inclusive on the deeper tier', () => {
  assert.equal(scoring.scoreOffer(offer(60, 100), thresholds).tier, 'Exceptional');
  assert.equal(scoring.scoreOffer(offer(60.01, 100), thresholds).tier, 'Strong');
  assert.equal(scoring.scoreOffer(offer(80, 100), thresholds).tier, 'Strong');
  assert.equal(scoring.scoreOffer(offer(80.01, 100), thresholds).tier, 'Moderate');
  assert.equal(scoring.scoreOffer(offer(90, 100), thresholds).tier, 'Moderate');
  assert.equal(scoring.scoreOffer(offer(90.01, 100), thresholds).tier, 'Marginal');
});

test('email ranking uses percent below max first and keeps first row on exact ties', () => {
  const parsed = { offers: [offer(96.27, 134), offer(96.27, 134)] };
  const result = scoring.scoreEmail(parsed, thresholds);
  assert.equal(result.bestOfferIndex, 0);
  assert.equal(result.tier, 'Strong');
});
