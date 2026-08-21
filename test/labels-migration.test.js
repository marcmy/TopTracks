'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGs } = require('./load-gs');

const ctx = loadGs(['src/Config.gs', 'src/gmail/GmailLabels.gs'], { Gmail: {} });

test('legacy visible labels are renamed in place to compact three-character tags', () => {
  const labels = [
    { id: 'L_PARENT', name: 'TopTracks', messageListVisibility: 'hide', labelListVisibility: 'labelShow' },
    { id: 'L_EX', name: 'TopTracks/Exceptional', messageListVisibility: 'show', labelListVisibility: 'labelShow', color: { backgroundColor: '#0b804b', textColor: '#ffffff' } },
    { id: 'L_ST', name: 'TopTracks/Strong', messageListVisibility: 'show', labelListVisibility: 'labelShow', color: { backgroundColor: '#16a766', textColor: '#ffffff' } },
    { id: 'L_MO', name: 'TopTracks/Moderate', messageListVisibility: 'show', labelListVisibility: 'labelShow', color: { backgroundColor: '#fad165', textColor: '#000000' } },
    { id: 'L_MA', name: 'TopTracks/Marginal', messageListVisibility: 'show', labelListVisibility: 'labelShow', color: { backgroundColor: '#efefef', textColor: '#666666' } },
    { id: 'L_PE', name: 'TopTracks/Parse Error', messageListVisibility: 'show', labelListVisibility: 'labelShow', color: { backgroundColor: '#fb4c2f', textColor: '#ffffff' } },
    { id: 'L_PR', name: 'TopTracks/Processed', messageListVisibility: 'hide', labelListVisibility: 'labelHide', color: { backgroundColor: '#f3f3f3', textColor: '#999999' } }
  ];
  const patches = [];
  const creates = [];
  const gmail = { Users: { Labels: {
    list() { return { labels }; },
    create(resource) { creates.push(resource); return { ...resource, id: 'NEW' }; },
    patch(resource, userId, id) {
      patches.push({ resource, userId, id });
      return { ...resource, id };
    }
  } } };

  const ids = ctx.TopTracksGmailLabels.ensureLabels(gmail, ctx.TopTracksConfig.get({}));

  assert.equal(creates.length, 0);
  assert.deepEqual(patches.map(p => [p.id, p.resource.name]), [
    ['L_EX', 'EXC'],
    ['L_ST', 'STR'],
    ['L_MO', 'MOD'],
    ['L_MA', 'MAR'],
    ['L_PE', 'ERR']
  ]);
  assert.equal(ids.Exceptional, 'L_EX');
  assert.equal(ids.Strong, 'L_ST');
  assert.equal(ids.Moderate, 'L_MO');
  assert.equal(ids.Marginal, 'L_MA');
  assert.equal(ids.ParseError, 'L_PE');
  assert.equal(ids.Processed, 'L_PR');
});

test('compact label names are the configured steady state', () => {
  const labels = ctx.TopTracksConfig.get({}).labels;
  assert.deepEqual(
    [labels.Exceptional.name, labels.Strong.name, labels.Moderate.name, labels.Marginal.name, labels.ParseError.name],
    ['EXC', 'STR', 'MOD', 'MAR', 'ERR']
  );
  assert.equal(labels.Processed.name, 'TopTracks/Processed');
});
