var TopTracksSheetLogger = (function () {
  var HEADERS = [
    'Record Key',
    'Received',
    'Title',
    'Condition',
    'Current Price',
    'Desired Price',
    'Dollar Below Max',
    'Percent Below Max',
    'Tier',
    'Best Offer',
    'Cause',
    'ASIN',
    'Amazon URL',
    'Gmail Message ID',
    'Gmail Thread ID',
    'Error'
  ];

  function safeText(value) {
    if (value === undefined || value === null) return '';
    var text = String(value);
    return /^[=+\-@]/.test(text) ? "'" + text : text;
  }

  function recordKey(messageId, suffix) {
    return String(messageId) + ':' + String(suffix);
  }

  function asDate(value) {
    if (!value) return '';
    var date = new Date(value);
    return isNaN(date.getTime()) ? safeText(value) : date;
  }

  function errorText(error) {
    if (!error) return '';
    try {
      return safeText(JSON.stringify(error));
    } catch (_) {
      return safeText(String(error));
    }
  }

  function offerRow(normalized, parsed, scoredOffer, index, isBest, keySuffix) {
    return [
      recordKey(normalized.gmailMessageId, keySuffix === undefined ? index : keySuffix),
      asDate(normalized.receivedAt),
      safeText(parsed.title),
      safeText(scoredOffer.condition),
      scoredOffer.currentPrice,
      scoredOffer.desiredPrice,
      scoredOffer.dollarBelowMax,
      scoredOffer.dealDepth,
      safeText(scoredOffer.tier),
      Boolean(isBest),
      safeText(scoredOffer.cause),
      safeText(parsed.asin),
      safeText(parsed.amazonUrl),
      safeText(normalized.gmailMessageId),
      safeText(normalized.gmailThreadId),
      ''
    ];
  }

  function buildOfferRows(normalized, parsed, scored) {
    return scored.offers.map(function (offer, index) {
      return offerRow(
        normalized,
        parsed,
        offer,
        index,
        index === scored.bestOfferIndex
      );
    });
  }

  function buildBestDealRow(normalized, parsed, scored) {
    if (scored.tier !== 'Strong' && scored.tier !== 'Exceptional') return null;
    return offerRow(
      normalized,
      parsed,
      scored.bestOffer,
      scored.bestOfferIndex,
      true,
      'best'
    );
  }

  function buildParseErrorRow(normalized, error) {
    return [
      recordKey(normalized.gmailMessageId, 'parse-error'),
      asDate(normalized.receivedAt),
      safeText(normalized.subject),
      '', '', '', '', '',
      'Parse Error',
      false,
      '', '', '',
      safeText(normalized.gmailMessageId),
      safeText(normalized.gmailThreadId),
      errorText(error)
    ];
  }

  function ensureSchema(sheet) {
    var lastRow = sheet.getLastRow();
    if (lastRow === 0) {
      sheet.getRange(1, 1, 1, HEADERS.length)
        .setValues([HEADERS])
        .setFontWeight('bold');
      sheet.setFrozenRows(1);
      sheet.hideColumns(1);
      if (typeof sheet.autoResizeColumns === 'function') {
        sheet.autoResizeColumns(2, HEADERS.length - 1);
      }
      return;
    }

    var actual = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
    for (var i = 0; i < HEADERS.length; i += 1) {
      if (actual[i] !== HEADERS[i]) {
        throw new Error(
          'Unexpected TopTracks sheet schema in "' + sheet.getName() + '".'
        );
      }
    }
  }

  function ensureSpreadsheet(config, spreadsheetApp, propertiesService) {
    var app = spreadsheetApp || SpreadsheetApp;
    var properties = propertiesService || PropertiesService;
    var store = properties.getScriptProperties();
    var id = store.getProperty(config.sheet.spreadsheetIdProperty);
    var spreadsheet = null;

    if (id) {
      try {
        spreadsheet = app.openById(id);
      } catch (error) {
        console.warn('TopTracks saved spreadsheet could not be opened; creating a replacement.');
      }
    }

    if (!spreadsheet) {
      spreadsheet = app.create(config.sheet.spreadsheetName);
      store.setProperty(config.sheet.spreadsheetIdProperty, spreadsheet.getId());
    }

    var main = spreadsheet.getSheetByName(config.sheet.mainSheetName);
    if (!main) {
      var sheets = spreadsheet.getSheets();
      if (sheets.length === 1 && sheets[0].getLastRow() === 0) {
        main = sheets[0].setName(config.sheet.mainSheetName);
      } else {
        main = spreadsheet.insertSheet(config.sheet.mainSheetName);
      }
    }

    var best = spreadsheet.getSheetByName(config.sheet.bestDealsSheetName);
    if (!best) best = spreadsheet.insertSheet(config.sheet.bestDealsSheetName);

    ensureSchema(main);
    ensureSchema(best);

    return { spreadsheet: spreadsheet, mainSheet: main, bestDealsSheet: best };
  }

  function loadKeys(sheet) {
    var keys = {};
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) return keys;
    var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    values.forEach(function (row) {
      if (row[0]) keys[String(row[0])] = true;
    });
    return keys;
  }

  function createSession(config, spreadsheetApp, propertiesService) {
    if (!config.sheet.enabled) return null;
    var ensured = ensureSpreadsheet(config, spreadsheetApp, propertiesService);
    return {
      spreadsheet: ensured.spreadsheet,
      mainSheet: ensured.mainSheet,
      bestDealsSheet: ensured.bestDealsSheet,
      mainKeys: loadKeys(ensured.mainSheet),
      bestKeys: loadKeys(ensured.bestDealsSheet)
    };
  }

  function isTransientSpreadsheetError(error) {
    var message = error && error.message ? error.message : String(error || '');
    return /Service Spreadsheets failed|Service invoked too many times|Internal error|temporarily unavailable|timed out|try again/i.test(message);
  }

  function sleepForRetry(milliseconds) {
    if (typeof Utilities !== 'undefined' && Utilities && typeof Utilities.sleep === 'function') {
      Utilities.sleep(milliseconds);
    }
  }

  function retryTransientSpreadsheetOperation(operation) {
    var delays = [250, 750, 1500];
    var attempt = 0;
    while (true) {
      try {
        return operation();
      } catch (error) {
        if (!isTransientSpreadsheetError(error) || attempt >= delays.length) {
          throw error;
        }
        console.warn(
          'TopTracks transient Sheets error; retrying in ' + delays[attempt] + ' ms: ' +
          (error && error.message ? error.message : String(error))
        );
        sleepForRetry(delays[attempt]);
        attempt += 1;
      }
    }
  }

  function appendIfMissing(sheet, keyMap, row) {
    var key = String(row[0]);
    if (keyMap[key]) return false;

    // Use a fixed target row rather than appendRow(). If Google reports a
    // transient failure after the write actually reached the server, retrying
    // setValues() on the same row is idempotent and cannot create a duplicate.
    var targetRow = sheet.getLastRow() + 1;
    retryTransientSpreadsheetOperation(function () {
      sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
    });

    keyMap[key] = true;
    return true;
  }

  function logProcessed(session, normalized, parsed, scored) {
    if (!session) return { mainRows: 0, bestRows: 0 };
    var mainRows = 0;
    buildOfferRows(normalized, parsed, scored).forEach(function (row) {
      if (appendIfMissing(session.mainSheet, session.mainKeys, row)) mainRows += 1;
    });

    var bestRows = 0;
    var bestRow = buildBestDealRow(normalized, parsed, scored);
    if (bestRow && appendIfMissing(session.bestDealsSheet, session.bestKeys, bestRow)) {
      bestRows = 1;
    }
    return { mainRows: mainRows, bestRows: bestRows };
  }

  function logParseError(session, normalized, error) {
    if (!session) return false;
    return appendIfMissing(
      session.mainSheet,
      session.mainKeys,
      buildParseErrorRow(normalized, error)
    );
  }

  function formatAndSort(sheet) {
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;
    var count = lastRow - 1;
    sheet.getRange(2, 2, count, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
    sheet.getRange(2, 5, count, 3).setNumberFormat('$0.00');
    sheet.getRange(2, 8, count, 1).setNumberFormat('0.0%');
    sheet.getRange(2, 1, count, HEADERS.length).sort([
      { column: 8, ascending: false },
      { column: 7, ascending: false }
    ]);
  }

  function finalize(session) {
    if (!session) return;
    formatAndSort(session.mainSheet);
    formatAndSort(session.bestDealsSheet);
    if (typeof SpreadsheetApp !== 'undefined') SpreadsheetApp.flush();
  }

  return {
    ensureSpreadsheet: ensureSpreadsheet,
    createSession: createSession,
    logProcessed: logProcessed,
    logParseError: logParseError,
    finalize: finalize,
    _test: {
      HEADERS: HEADERS,
      safeText: safeText,
      recordKey: recordKey,
      buildOfferRows: buildOfferRows,
      buildBestDealRow: buildBestDealRow,
      buildParseErrorRow: buildParseErrorRow,
      isTransientSpreadsheetError: isTransientSpreadsheetError,
      retryTransientSpreadsheetOperation: retryTransientSpreadsheetOperation,
      appendIfMissing: appendIfMissing
    }
  };
})();
