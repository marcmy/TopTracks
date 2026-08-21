'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGs } = require('./load-gs');

const ctx = loadGs(['src/Config.gs', 'src/gmail/GmailLabels.gs'], { Gmail: {} });

function gmailWithLabels(labels) {
  const patches = [];
  const creates = [];
  return {
    patches,
    creates,
    service: { Users: { Labels: {
      list() { return { labels }; },
      create(resource) { creates.push(resource); return { ...resource, id: 'NEW' }; },
      patch(resource, userId, id) {
        patches.push({ resource, userId, id });
        return { ...resource, id };
      }
    } } }
  };
}

function baseLabels(names) {
  return [
    { id: 'L_PARENT', name: 'TopTracks', messageListVisibility: 'hide', labelListVisibility: 'labelShow' },
    { id: 'L_EX', name: names.Exceptional, messageListVisibility: 'show', labelListVisibility: 'labelShow', color: { backgroundColor: '#0b804b', textColor: '#ffffff' } },
    { id: 'L_ST', name: names.Strong, messageListVisibility: 'show', labelListVisibility: 'labelShow', color: { backgroundColor: '#16a766', textColor: '#ffffff' } },
    { id: 'L_MO', name: names.Moderate, messageListVisibility: 'show', labelListVisibility: 'labelShow', color: { backgroundColor: '#fad165', textColor: '#000000' } },
    { id: 'L_MA', name: names.Marginal, messageListVisibility: 'show', labelListVisibility: 'labelShow', color: { backgroundColor: '#efefef', textColor: '#666666' } },
    { id: 'L_PE', name: names.ParseError, messageListVisibility: 'show', labelListVisibility: 'labelShow', color: { backgroundColor: '#fb4c2f', textColor: '#ffffff' } },
    { id: 'L_PR', name: 'TopTracks/Processed', messageListVisibility: 'hide', labelListVisibility: 'labelHide', color: { backgroundColor: '#f3f3f3', textColor: '#999999' } }
  ];
}

const expectedNames = [
  ['L_EX', 'Exceptional'],
  ['L_ST', 'Strong'],
  ['L_MO', 'Moderate'],
  ['L_MA', 'Marginal'],
  ['L_PE', 'Parse Error']
];

test('legacy TopTracks-prefixed labels are renamed in place without the prefix', () => {
  const mock = gmailWithLabels(baseLabels({
    Exceptional: 'TopTracks/Exceptional',
    Strong: 'TopTracks/Strong',
    Moderate: 'TopTracks/Moderate',
    Marginal: 'TopTracks/Marginal',
    ParseError: 'TopTracks/Parse Error'
  }));

  const ids = ctx.TopTracksGmailLabels.ensureLabels(mock.service, ctx.TopTracksConfig.get({}));

  assert.equal(mock.creates.length, 0);
  assert.deepEqual(mock.patches.map(p => [p.id, p.resource.name]), expectedNames);
  assert.equal(ids.Exceptional, 'L_EX');
  assert.equal(ids.Strong, 'L_ST');
  assert.equal(ids.Moderate, 'L_MO');
  assert.equal(ids.Marginal, 'L_MA');
  assert.equal(ids.ParseError, 'L_PE');
  assert.equal(ids.Processed, 'L_PR');
});

test('temporary compact labels are also renamed in place to full tier names', () => {
  const mock = gmailWithLabels(baseLabels({
    Exceptional: 'EXC',
    Strong: 'STR',
    Moderate: 'MOD',
    Marginal: 'MAR',
    ParseError: 'ERR'
  }));

  ctx.TopTracksGmailLabels.ensureLabels(mock.service, ctx.TopTracksConfig.get({}));

  assert.equal(mock.creates.length, 0);
  assert.deepEqual(mock.patches.map(p => [p.id, p.resource.name]), expectedNames);
});

test('full unprefixed label names are the configured steady state', () => {
  const labels = ctx.TopTracksConfig.get({}).labels;
  assert.deepEqual(
    [labels.Exceptional.name, labels.Strong.name, labels.Moderate.name, labels.Marginal.name, labels.ParseError.name],
    ['Exceptional', 'Strong', 'Moderate', 'Marginal', 'Parse Error']
  );
  assert.equal(labels.Processed.name, 'TopTracks/Processed');
});
