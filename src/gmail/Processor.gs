var TopTracksProcessor = (function () {
  function makeDeps(overrides) {
    var deps = overrides || {};
    return {
      config: deps.config || TopTracksConfig,
      labels: deps.labels || TopTracksGmailLabels,
      messages: deps.messages || TopTracksGmailMessages,
      parser: deps.parser || TopTracksParser,
      scoring: deps.scoring || TopTracksScoring,
      sheetLogger: deps.sheetLogger || TopTracksSheetLogger,
      gmail: deps.gmail || Gmail,
      utilities: deps.utilities || Utilities,
      lockService: deps.lockService || LockService,
      logger: deps.logger || console
    };
  }

  function processOne(messageRef, labelIds, config, overrides, sheetSession) {
    var deps = makeDeps(overrides);
    var full = deps.messages.getFull(messageRef.id, deps.gmail);
    if (deps.messages.isProcessed(full, labelIds.Processed)) {
      return { status: 'skipped-processed', messageId: messageRef.id };
    }

    var normalized = deps.messages.normalizeFullMessage(full, deps.gmail, deps.utilities);
    var parsed = deps.parser.parseEmail(normalized, {
      differenceTolerance: config.differenceTolerance
    });

    if (!parsed.ok) {
      if (config.sheet.enabled) {
        deps.sheetLogger.logParseError(sheetSession, normalized, parsed.error);
      }
      deps.messages.applyClassification(messageRef.id, 'ParseError', labelIds, config, deps.gmail);
      return {
        status: 'parse-error',
        messageId: messageRef.id,
        threadId: normalized.gmailThreadId,
        receivedAt: normalized.receivedAt,
        subject: normalized.subject,
        error: parsed.error
      };
    }

    var scored = deps.scoring.scoreEmail(parsed.value, config.thresholds);
    if (config.sheet.enabled) {
      deps.sheetLogger.logProcessed(sheetSession, normalized, parsed.value, scored);
    }
    deps.messages.applyClassification(messageRef.id, scored.tier, labelIds, config, deps.gmail);

    return {
      status: 'processed',
      messageId: messageRef.id,
      threadId: normalized.gmailThreadId,
      receivedAt: normalized.receivedAt,
      subject: normalized.subject,
      title: parsed.value.title,
      asin: parsed.value.asin,
      amazonUrl: parsed.value.amazonUrl,
      tier: scored.tier,
      bestOfferIndex: scored.bestOfferIndex,
      bestOffer: scored.bestOffer,
      offers: scored.offers
    };
  }

  function processPending(overrides) {
    var deps = makeDeps(overrides);
    var config = deps.config.get();
    var lock = deps.lockService.getScriptLock();
    if (!lock.tryLock(config.gmail.lockTimeoutMs)) {
      return {
        status: 'locked', found: 0, processed: 0, parseErrors: 0,
        runtimeErrors: 0, sheetErrors: 0, skipped: 0
      };
    }

    var stats = {
      status: 'ok', found: 0, processed: 0, parseErrors: 0,
      runtimeErrors: 0, sheetErrors: 0, skipped: 0, results: []
    };
    var sheetSession = null;

    try {
      var labelIds = deps.labels.ensureLabels(deps.gmail, config);
      if (config.sheet.enabled) {
        sheetSession = deps.sheetLogger.createSession(config);
      }
      var refs = deps.messages.listPending(config, deps.gmail);
      stats.found = refs.length;

      refs.forEach(function (ref) {
        try {
          var result = processOne(ref, labelIds, config, deps, sheetSession);
          stats.results.push(result);
          if (result.status === 'processed') stats.processed += 1;
          else if (result.status === 'parse-error') {
            stats.parseErrors += 1;
            deps.logger.error('TopTracks parse error: ' + JSON.stringify(result));
          } else stats.skipped += 1;
        } catch (error) {
          stats.runtimeErrors += 1;
          var failure = {
            status: 'runtime-error',
            messageId: ref.id,
            error: error && error.message ? error.message : String(error)
          };
          stats.results.push(failure);
          deps.logger.error('TopTracks runtime error: ' + JSON.stringify(failure));
        }
      });

      if (sheetSession) {
        try {
          deps.sheetLogger.finalize(sheetSession);
        } catch (error) {
          stats.sheetErrors += 1;
          deps.logger.error('TopTracks sheet finalize error: ' +
            (error && error.message ? error.message : String(error)));
        }
      }
      return stats;
    } finally {
      lock.releaseLock();
    }
  }

  return {
    processPending: processPending,
    _test: { processOne: processOne, makeDeps: makeDeps }
  };
})();
