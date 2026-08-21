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

test('61.13 / 78.00 is Moderate at about 21.6% below max under the 50/30/10 scale', () => {
  const result = scoring.scoreOffer(offer(61.13, 78), thresholds);
  assert.equal(result.tier, 'Moderate');
  assert.ok(Math.abs(result.dollarBelowMax - 16.87) < 1e-9);
  assert.ok(Math.abs(result.dealDepthPct - 21.6282051282) < 1e-8);
});

test('tier boundaries are inclusive on the deeper tier', () => {
  assert.equal(scoring.scoreOffer(offer(50, 100), thresholds).tier, 'Exceptional');
  assert.equal(scoring.scoreOffer(offer(50.01, 100), thresholds).tier, 'Strong');
  assert.equal(scoring.scoreOffer(offer(70, 100), thresholds).tier, 'Strong');
  assert.equal(scoring.scoreOffer(offer(70.01, 100), thresholds).tier, 'Moderate');
  assert.equal(scoring.scoreOffer(offer(90, 100), thresholds).tier, 'Moderate');
  assert.equal(scoring.scoreOffer(offer(90.01, 100), thresholds).tier, 'Marginal');
});

test('email ranking uses percent below max first and keeps first row on exact ties', () => {
  const parsed = { offers: [offer(96.27, 134), offer(96.27, 134)] };
  const result = scoring.scoreEmail(parsed, thresholds);
  assert.equal(result.bestOfferIndex, 0);
  assert.equal(result.tier, 'Moderate');
});
