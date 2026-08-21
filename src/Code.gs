var TopTracksUi = (function () {
  function money(value) {
    var number = Number(value);
    return isFinite(number) ? '$' + number.toFixed(2) : '?';
  }

  function errorText(error) {
    if (!error) return 'Unknown error';
    if (typeof error === 'string') return error;
    try {
      return JSON.stringify(error);
    } catch (ignored) {
      return String(error);
    }
  }

  function formatPreview(result) {
    var tierCounts = { Exceptional: 0, Strong: 0, Moderate: 0, Marginal: 0 };
    var parsed = 0;
    var errors = 0;
    var lines = [
      'TOPTRACKS PREVIEW — READ ONLY',
      'Found ' + result.found + ' of ' + result.requested + ' requested Keepa alerts.'
    ];

    (result.results || []).forEach(function (item, index) {
      if (item.status !== 'preview') {
        errors += 1;
        lines.push(
          (index + 1) + '. [ERROR] ' + item.messageId + ' — ' + errorText(item.error)
        );
        return;
      }

      parsed += 1;
      if (tierCounts[item.tier] !== undefined) tierCounts[item.tier] += 1;
      var offer = item.bestOffer || {};
      var depth = Number(offer.dealDepthPct);
      var depthText = isFinite(depth) ? depth.toFixed(1) + '% below max' : 'unknown discount';
      lines.push(
        (index + 1) + '. [' + item.tier + '] ' + depthText +
        ' | ' + money(offer.currentPrice) + ' / max ' + money(offer.desiredPrice) +
        ' | ' + (item.title || '(untitled)')
      );
    });

    lines.splice(2, 0,
      'Parsed: ' + parsed + ' | Errors: ' + errors,
      'Exceptional: ' + tierCounts.Exceptional +
      ' | Strong: ' + tierCounts.Strong +
      ' | Moderate: ' + tierCounts.Moderate +
      ' | Marginal: ' + tierCounts.Marginal,
      ''
    );

    return lines.join('\n');
  }

  function formatBackfill(result) {
    return [
      'TOPTRACKS CONTROLLED BACKFILL',
      'Status: ' + (result.status || 'unknown'),
      'Found: ' + Number(result.found || 0),
      'Processed: ' + Number(result.processed || 0),
      'Parse errors: ' + Number(result.parseErrors || 0),
      'Runtime errors: ' + Number(result.runtimeErrors || 0),
      'Sheet errors: ' + Number(result.sheetErrors || 0),
      'Skipped: ' + Number(result.skipped || 0),
      '',
      'Run the same backfill control again to process the next unprocessed batch.'
    ].join('\n');
  }

  function logObject(label, value) {
    console.log(label + '\n' + JSON.stringify(value, null, 2));
    return value;
  }

  return {
    formatPreview: formatPreview,
    formatBackfill: formatBackfill,
    logObject: logObject
  };
})();

// Human-facing setup controls. During onboarding, keep src/Code.gs selected and
// use these functions in numeric order. Normal day-to-day use happens in Gmail;
// the Apps Script editor is only the setup/backend surface.
function TOPTRACKS_1_PREVIEW_25() {
  var result = TopTracksHistory.preview(25);
  console.log(TopTracksUi.formatPreview(result));
  return result;
}

function runTopTracksBackfillBatch(limit) {
  var result = TopTracksHistory.backfill(limit);
  console.log(TopTracksUi.formatBackfill(result));
  return result;
}

function TOPTRACKS_2_BACKFILL_25() {
  return runTopTracksBackfillBatch(25);
}

function TOPTRACKS_2_BACKFILL_100() {
  return runTopTracksBackfillBatch(100);
}

function TOPTRACKS_3_INSTALL_AUTOMATION() {
  return TopTracksUi.logObject('TOPTRACKS INSTALL RESULT', installTopTracks());
}

function TOPTRACKS_STATUS() {
  return TopTracksUi.logObject('TOPTRACKS STATUS', topTracksHealthCheck());
}

function TOPTRACKS_DISABLE_AUTOMATION() {
  var removed = removeTopTracksTriggers();
  console.log('TopTracks automation disabled. Removed ' + removed + ' trigger(s).');
  return removed;
}

function processTopTracks() {
  return TopTracksProcessor.processPending();
}

function topTracksHealthCheck() {
  var triggerInstalled = false;
  if (typeof ScriptApp !== 'undefined') {
    triggerInstalled = ScriptApp.getProjectTriggers().some(function (trigger) {
      return trigger.getHandlerFunction() === 'processTopTracks';
    });
  }

  var config = TopTracksConfig.get();
  return {
    status: 'ok',
    phase: 'mvp',
    liveProcessingAvailable: true,
    sheetLoggingEnabled: config.sheet.enabled,
    triggerInstalled: triggerInstalled
  };
}
