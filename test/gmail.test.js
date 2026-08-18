'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGs } = require('./load-gs');

const ctx = loadGs([
  'src/Config.gs',
  'src/core/Scoring.gs',
  'src/gmail/GmailLabels.gs',
  'src/gmail/GmailMessages.gs',
  'src/gmail/Processor.gs'
], {
  Gmail: {},
  Utilities: {},
  LockService: {},
  TopTracksParser: {}
});

function fakeUtilities() {
  return {
    base64DecodeWebSafe(data) {
      return Buffer.from(
        data.replace(/-/g, '+').replace(/_/g, '/'),
        'base64'
      );
    },
    newBlob(bytes) {
      return {
        getDataAsString() {
          return Buffer.from(bytes).toString('utf8');
        }
      };
    }
  };
}

function b64url(text) {
  return Buffer.from(text).toString('base64url');
}

const labelIds = {
  Exceptional: 'L_EX',
  Strong: 'L_ST',
  Moderate: 'L_MO',
  Marginal: 'L_MA',
  ParseError: 'L_PE',
  Processed: 'L_PR',
  tierIds: ['L_EX', 'L_ST', 'L_MO', 'L_MA'],
  classificationIds: ['L_EX', 'L_ST', 'L_MO', 'L_MA', 'L_PE']
};

test('runtime config supports Script Properties threshold overrides', () => {
  const config = ctx.TopTracksConfig.get({
    TOPTRACKS_EXCEPTIONAL_MAX_RATIO: '0.55',
    TOPTRACKS_STRONG_MAX_RATIO: '0.75',
    TOPTRACKS_MODERATE_MAX_RATIO: '0.88',
    TOPTRACKS_STAR_STRONG: 'true',
    TOPTRACKS_MAX_RESULTS: '25'
  });

  assert.deepEqual(JSON.parse(JSON.stringify(config.thresholds)), {
    exceptionalMaxRatio: 0.55,
    strongMaxRatio: 0.75,
    moderateMaxRatio: 0.88
  });
  assert.equal(config.starStrong, true);
  assert.equal(config.gmail.maxResults, 25);
});

test('pending Gmail query excludes the Processed label', () => {
  const query = ctx.TopTracksGmailMessages._test.buildPendingQuery(
    'from:pricealert@keepa.com subject:"Price alert"',
    'TopTracks/Processed'
  );
  assert.equal(
    query,
    'from:pricealert@keepa.com subject:"Price alert" -label:"TopTracks/Processed"'
  );
});

test('normalizer finds HTML nested inside multipart/alternative', () => {
  const full = {
    id: 'm1',
    threadId: 't1',
    internalDate: '1787030000000',
    labelIds: ['INBOX'],
    payload: {
      headers: [{ name: 'Subject', value: 'Price alert: Test Book' }],
      parts: [{
        mimeType: 'multipart/alternative',
        parts: [
          { mimeType: 'text/plain', body: { data: b64url('plain') } },
          {
            mimeType: 'text/html',
            body: { data: b64url('<table>prices</table>') }
          }
        ]
      }]
    }
  };

  const normalized = ctx.TopTracksGmailMessages.normalizeFullMessage(
    full,
    {},
    fakeUtilities()
  );
  assert.equal(normalized.subject, 'Price alert: Test Book');
  assert.equal(normalized.htmlBody, '<table>prices</table>');
  assert.equal(normalized.gmailMessageId, 'm1');
  assert.equal(normalized.gmailThreadId, 't1');
});

test('classification atomically adds one tier plus Processed and stars Exceptional', () => {
  let request;
  const gmail = {
    Users: {
      Messages: {
        modify(resource, userId, messageId) {
          request = { resource, userId, messageId };
          return {};
        }
      }
    }
  };
  const config = ctx.TopTracksConfig.get({});

  ctx.TopTracksGmailMessages.applyClassification(
    'm1',
    'Exceptional',
    labelIds,
    config,
    gmail
  );

  assert.deepEqual(
    Array.from(request.resource.addLabelIds),
    ['L_EX', 'L_PR', 'STARRED']
  );
  assert.deepEqual(
    Array.from(request.resource.removeLabelIds),
    ['L_ST', 'L_MO', 'L_MA', 'L_PE']
  );
  assert.equal(request.messageId, 'm1');
});

test('parse failures receive Parse Error and Processed rather than a guessed tier', () => {
  const applied = [];
  const messages = {
    getFull() {
      return { id: 'm1', labelIds: [], threadId: 't1', payload: {} };
    },
    isProcessed() {
      return false;
    },
    normalizeFullMessage() {
      return { gmailThreadId: 't1', subject: 'bad alert' };
    },
    applyClassification(id, key) {
      applied.push([id, key]);
    }
  };
  const parser = {
    parseEmail() {
      return {
        ok: false,
        error: { code: 'PRICING_TABLE_MISSING' }
      };
    }
  };

  const result = ctx.TopTracksProcessor._test.processOne(
    { id: 'm1' },
    labelIds,
    ctx.TopTracksConfig.get({}),
    {
      messages,
      parser,
      scoring: ctx.TopTracksScoring,
      gmail: {},
      utilities: {}
    }
  );

  assert.equal(result.status, 'parse-error');
  assert.deepEqual(applied, [['m1', 'ParseError']]);
});

test('already Processed messages are skipped before parsing', () => {
  let parsed = false;
  const messages = {
    getFull() {
      return { id: 'm1', labelIds: ['L_PR'] };
    },
    isProcessed(full, processedId) {
      return full.labelIds.includes(processedId);
    }
  };

  const result = ctx.TopTracksProcessor._test.processOne(
    { id: 'm1' },
    labelIds,
    ctx.TopTracksConfig.get({}),
    {
      messages,
      parser: {
        parseEmail() {
          parsed = true;
        }
      },
      scoring: ctx.TopTracksScoring,
      gmail: {},
      utilities: {}
    }
  );

  assert.equal(result.status, 'skipped-processed');
  assert.equal(parsed, false);
});

test('successful processing classifies from the best offer', () => {
  const applied = [];
  const messages = {
    getFull() {
      return { id: 'm1', labelIds: [], threadId: 't1', payload: {} };
    },
    isProcessed() {
      return false;
    },
    normalizeFullMessage() {
      return { gmailThreadId: 't1', subject: 'alert' };
    },
    applyClassification(id, key) {
      applied.push([id, key]);
    }
  };
  const parser = {
    parseEmail() {
      return {
        ok: true,
        value: {
          title: 'Book',
          asin: '1234567890',
          offers: [
            {
              condition: 'Used, good',
              currentPrice: 95,
              desiredPrice: 100,
              keepaDifference: -5,
              cause: 'drop'
            },
            {
              condition: 'Used, very good',
              currentPrice: 70,
              desiredPrice: 100,
              keepaDifference: -30,
              cause: 'drop'
            }
          ]
        }
      };
    }
  };

  const result = ctx.TopTracksProcessor._test.processOne(
    { id: 'm1' },
    labelIds,
    ctx.TopTracksConfig.get({}),
    {
      messages,
      parser,
      scoring: ctx.TopTracksScoring,
      gmail: {},
      utilities: {}
    }
  );

  assert.equal(result.status, 'processed');
  assert.equal(result.tier, 'Strong');
  assert.equal(result.bestOffer.dealDepthPct, 30);
  assert.deepEqual(applied, [['m1', 'Strong']]);
});

test('run lock prevents overlapping scheduled executions', () => {
  const lock = {
    tryLock() {
      return false;
    },
    releaseLock() {
      throw new Error('should not release');
    }
  };
  const result = ctx.TopTracksProcessor.processPending({
    config: { get: () => ctx.TopTracksConfig.get({}) },
    lockService: { getScriptLock: () => lock },
    labels: {},
    messages: {},
    parser: {},
    scoring: {},
    gmail: {},
    utilities: {},
    logger: console
  });

  assert.equal(result.status, 'locked');
});

test('label provisioning creates missing labels and patches stale colors', () => {
  const calls = { create: [], patch: [] };
  let nextId = 10;
  const gmail = {
    Users: {
      Labels: {
        list() {
          return {
            labels: [{
              id: 'L_ST',
              name: 'TopTracks/Strong',
              messageListVisibility: 'show',
              labelListVisibility: 'labelShow',
              color: {
                backgroundColor: '#ffffff',
                textColor: '#000000'
              }
            }]
          };
        },
        create(resource) {
          calls.create.push(resource);
          return { ...resource, id: `L${nextId++}` };
        },
        patch(resource, userId, id) {
          calls.patch.push({ resource, userId, id });
          return { ...resource, id };
        }
      }
    }
  };

  const ids = ctx.TopTracksGmailLabels.ensureLabels(
    gmail,
    ctx.TopTracksConfig.get({})
  );
  assert.equal(calls.create.length, 6);
  assert.equal(calls.patch.length, 1);
  assert.equal(calls.patch[0].id, 'L_ST');
  assert.equal(calls.patch[0].resource.color.backgroundColor, '#16a766');
  assert.equal(ids.Strong, 'L_ST');
  assert.equal(ids.classificationIds.length, 5);
});

test('runtime failure remains unprocessed so a later run can retry it', () => {
  let modified = false;
  const config = ctx.TopTracksConfig.get({});
  const lock = {
    tryLock() {
      return true;
    },
    releaseLock() {}
  };
  const messages = {
    listPending() {
      return [{ id: 'm1' }];
    },
    getFull() {
      throw new Error('temporary Gmail failure');
    },
    applyClassification() {
      modified = true;
    }
  };

  const result = ctx.TopTracksProcessor.processPending({
    config: { get: () => config },
    lockService: { getScriptLock: () => lock },
    labels: { ensureLabels: () => labelIds },
    messages,
    parser: {},
    scoring: {},
    gmail: {},
    utilities: {},
    logger: { error() {} }
  });

  assert.equal(result.runtimeErrors, 1);
  assert.equal(modified, false);
});
