'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGs } = require('./load-gs');

const ctx = loadGs(['src/gmail/GmailMessages.gs'], { Gmail: {}, Utilities: {} });

function utilitiesWithTracking() {
  let decodeCalls = 0;
  return {
    get decodeCalls() { return decodeCalls; },
    base64DecodeWebSafe(data) {
      decodeCalls += 1;
      return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
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

test('Gmail Advanced Service byte-array body data is not decoded twice', () => {
  const utilities = utilitiesWithTracking();
  const bytes = Array.from(Buffer.from('<html>Keepa</html>', 'utf8'));
  const decoded = ctx.TopTracksGmailMessages._test.decodeBodyData(bytes, utilities);

  assert.equal(decoded, '<html>Keepa</html>');
  assert.equal(utilities.decodeCalls, 0);
});

test('base64url string body data is still decoded when supplied as a string', () => {
  const utilities = utilitiesWithTracking();
  const encoded = Buffer.from('<html>Keepa</html>', 'utf8').toString('base64url');
  const decoded = ctx.TopTracksGmailMessages._test.decodeBodyData(encoded, utilities);

  assert.equal(decoded, '<html>Keepa</html>');
  assert.equal(utilities.decodeCalls, 1);
});
