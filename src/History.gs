var TopTracksHistory = (function () {
  function validateLimit(maxResults) {
    var limit = Number(maxResults);
    if (!isFinite(limit) || limit < 1 || limit > 100 || Math.floor(limit) !== limit) {
      throw new Error('Historical preview/backfill requires an integer maxResults from 1 to 100.');
    }
    return limit;
  }

  function preview(maxResults, queryOverride, overrides) {
    var limit = validateLimit(maxResults);
    var deps = overrides || {};
    var config = (deps.config || TopTracksConfig).get();
    var messages = deps.messages || TopTracksGmailMessages;
    var parser = deps.parser || TopTracksParser;
    var scoring = deps.scoring || TopTracksScoring;
    var gmail = deps.gmail || Gmail;
    var utilities = deps.utilities || Utilities;
    var query = queryOverride || config.gmail.query;
    var refs = messages.listByQuery(query, limit, gmail);
    var results = [];

    refs.forEach(function (ref) {
      try {
        var full = messages.getFull(ref.id, gmail);
        var normalized = messages.normalizeFullMessage(full, gmail, utilities);
        var parsed = parser.parseEmail(normalized, {
          differenceTolerance: config.differenceTolerance
        });
        if (!parsed.ok) {
          results.push({
            status: 'parse-error',
            messageId: ref.id,
            receivedAt: normalized.receivedAt,
            subject: normalized.subject,
            error: parsed.error
          });
          return;
        }
        var scored = scoring.scoreEmail(parsed.value, config.thresholds);
        results.push({
          status: 'preview',
          messageId: ref.id,
          threadId: normalized.gmailThreadId,
          receivedAt: normalized.receivedAt,
          title: parsed.value.title,
          asin: parsed.value.asin,
          tier: scored.tier,
          bestOffer: scored.bestOffer,
          offerCount: scored.offers.length
        });
      } catch (error) {
        results.push({
          status: 'runtime-error',
          messageId: ref.id,
          error: error && error.message ? error.message : String(error)
        });
      }
    });

    return { query: query, requested: limit, found: refs.length, results: results };
  }

  function backfill(maxResults, queryOverride) {
    var limit = validateLimit(maxResults);
    return TopTracksProcessor.processPending({
      config: {
        get: function () {
          var config = TopTracksConfig.get();
          config.gmail.maxResults = limit;
          if (queryOverride) config.gmail.query = queryOverride;
          return config;
        }
      }
    });
  }

  return { preview: preview, backfill: backfill, _test: { validateLimit: validateLimit } };
})();

function previewTopTracksHistory(maxResults, queryOverride) {
  return TopTracksHistory.preview(maxResults, queryOverride);
}

function backfillTopTracksHistory(maxResults, queryOverride) {
  return TopTracksHistory.backfill(maxResults, queryOverride);
}

// Apps Script's Run button cannot supply function arguments. These wrappers are
// deliberately fixed to a small batch so the mailbox owner can perform the safe
// first-run sequence directly from the editor without changing code.
function previewTopTracksHistory25() {
  var result = TopTracksHistory.preview(25);
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function backfillTopTracksHistory25() {
  return TopTracksHistory.backfill(25);
}
