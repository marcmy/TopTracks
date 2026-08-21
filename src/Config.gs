var TOPTRACKS_CONFIG = Object.freeze({
  thresholds: Object.freeze({
    exceptionalMaxRatio: 0.50,
    strongMaxRatio: 0.70,
    moderateMaxRatio: 0.90
  }),
  differenceTolerance: 0.011,
  starExceptional: true,
  starStrong: false,
  gmail: Object.freeze({
    query: 'from:pricealert@keepa.com subject:"Price alert"',
    maxResults: 50,
    lockTimeoutMs: 1000
  }),
  sheet: Object.freeze({
    enabled: true,
    spreadsheetName: 'TopTracks',
    mainSheetName: 'TopTracks',
    bestDealsSheetName: 'Best Deals',
    settingsSheetName: 'Settings',
    spreadsheetIdProperty: 'TOPTRACKS_SHEET_ID'
  }),
  labels: Object.freeze({
    parent: Object.freeze({
      name: 'TopTracks',
      messageListVisibility: 'hide',
      labelListVisibility: 'labelShow'
    }),
    Exceptional: Object.freeze({
      name: 'TopTracks/Exceptional',
      messageListVisibility: 'show',
      labelListVisibility: 'labelShow',
      backgroundColor: '#0b804b',
      textColor: '#ffffff'
    }),
    Strong: Object.freeze({
      name: 'TopTracks/Strong',
      messageListVisibility: 'show',
      labelListVisibility: 'labelShow',
      backgroundColor: '#16a766',
      textColor: '#ffffff'
    }),
    Moderate: Object.freeze({
      name: 'TopTracks/Moderate',
      messageListVisibility: 'show',
      labelListVisibility: 'labelShow',
      backgroundColor: '#fad165',
      textColor: '#000000'
    }),
    Marginal: Object.freeze({
      name: 'TopTracks/Marginal',
      messageListVisibility: 'show',
      labelListVisibility: 'labelShow',
      backgroundColor: '#efefef',
      textColor: '#666666'
    }),
    ParseError: Object.freeze({
      name: 'TopTracks/Parse Error',
      messageListVisibility: 'show',
      labelListVisibility: 'labelShow',
      backgroundColor: '#fb4c2f',
      textColor: '#ffffff'
    }),
    Processed: Object.freeze({
      name: 'TopTracks/Processed',
      messageListVisibility: 'hide',
      labelListVisibility: 'labelHide',
      backgroundColor: '#f3f3f3',
      textColor: '#999999'
    })
  })
});

var TopTracksConfig = (function () {
  var PROPERTY_NAMES = Object.freeze({
    exceptionalMaxRatio: 'TOPTRACKS_EXCEPTIONAL_MAX_RATIO',
    strongMaxRatio: 'TOPTRACKS_STRONG_MAX_RATIO',
    moderateMaxRatio: 'TOPTRACKS_MODERATE_MAX_RATIO',
    starExceptional: 'TOPTRACKS_STAR_EXCEPTIONAL',
    starStrong: 'TOPTRACKS_STAR_STRONG',
    gmailQuery: 'TOPTRACKS_GMAIL_QUERY',
    maxResults: 'TOPTRACKS_MAX_RESULTS',
    sheetLoggingEnabled: 'TOPTRACKS_SHEET_LOGGING_ENABLED'
  });

  function copyLabels(labels) {
    var result = {};
    Object.keys(labels).forEach(function (key) {
      var source = labels[key];
      var target = {};
      Object.keys(source).forEach(function (property) {
        target[property] = source[property];
      });
      result[key] = target;
    });
    return result;
  }

  function validateThresholds(thresholds) {
    if (!thresholds) {
      throw new Error('Thresholds are required.');
    }
    var exceptional = Number(thresholds.exceptionalMaxRatio);
    var strong = Number(thresholds.strongMaxRatio);
    var moderate = Number(thresholds.moderateMaxRatio);
    if (
      !isFinite(exceptional) || !isFinite(strong) || !isFinite(moderate) ||
      exceptional <= 0 || exceptional > strong || strong > moderate || moderate > 1
    ) {
      throw new Error('Thresholds must satisfy 0 < Exceptional <= Strong <= Moderate <= 1.');
    }
    return {
      exceptionalMaxRatio: exceptional,
      strongMaxRatio: strong,
      moderateMaxRatio: moderate
    };
  }

  function parseBoolean(value, fallback) {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }
    var normalized = String(value).toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no') {
      return false;
    }
    return fallback;
  }

  function getPropertyBag() {
    if (typeof PropertiesService === 'undefined') {
      return {};
    }
    return PropertiesService.getScriptProperties().getProperties() || {};
  }

  function get(propertyBag) {
    var properties = propertyBag || getPropertyBag();
    var thresholds = validateThresholds({
      exceptionalMaxRatio: properties[PROPERTY_NAMES.exceptionalMaxRatio] || TOPTRACKS_CONFIG.thresholds.exceptionalMaxRatio,
      strongMaxRatio: properties[PROPERTY_NAMES.strongMaxRatio] || TOPTRACKS_CONFIG.thresholds.strongMaxRatio,
      moderateMaxRatio: properties[PROPERTY_NAMES.moderateMaxRatio] || TOPTRACKS_CONFIG.thresholds.moderateMaxRatio
    });
    var maxResults = Number(properties[PROPERTY_NAMES.maxResults] || TOPTRACKS_CONFIG.gmail.maxResults);
    if (!isFinite(maxResults) || maxResults < 1 || maxResults > 500) {
      maxResults = TOPTRACKS_CONFIG.gmail.maxResults;
    }

    return {
      thresholds: thresholds,
      differenceTolerance: TOPTRACKS_CONFIG.differenceTolerance,
      starExceptional: parseBoolean(properties[PROPERTY_NAMES.starExceptional], TOPTRACKS_CONFIG.starExceptional),
      starStrong: parseBoolean(properties[PROPERTY_NAMES.starStrong], TOPTRACKS_CONFIG.starStrong),
      gmail: {
        query: properties[PROPERTY_NAMES.gmailQuery] || TOPTRACKS_CONFIG.gmail.query,
        maxResults: Math.floor(maxResults),
        lockTimeoutMs: TOPTRACKS_CONFIG.gmail.lockTimeoutMs
      },
      sheet: {
        enabled: parseBoolean(
          properties[PROPERTY_NAMES.sheetLoggingEnabled],
          TOPTRACKS_CONFIG.sheet.enabled
        ),
        spreadsheetName: TOPTRACKS_CONFIG.sheet.spreadsheetName,
        mainSheetName: TOPTRACKS_CONFIG.sheet.mainSheetName,
        bestDealsSheetName: TOPTRACKS_CONFIG.sheet.bestDealsSheetName,
        settingsSheetName: TOPTRACKS_CONFIG.sheet.settingsSheetName,
        spreadsheetIdProperty: TOPTRACKS_CONFIG.sheet.spreadsheetIdProperty
      },
      labels: copyLabels(TOPTRACKS_CONFIG.labels)
    };
  }

  function setThresholds(exceptionalMaxRatio, strongMaxRatio, moderateMaxRatio) {
    var thresholds = validateThresholds({
      exceptionalMaxRatio: exceptionalMaxRatio,
      strongMaxRatio: strongMaxRatio,
      moderateMaxRatio: moderateMaxRatio
    });
    if (typeof PropertiesService === 'undefined') {
      throw new Error('PropertiesService is only available in Google Apps Script.');
    }
    var values = {};
    values[PROPERTY_NAMES.exceptionalMaxRatio] = String(thresholds.exceptionalMaxRatio);
    values[PROPERTY_NAMES.strongMaxRatio] = String(thresholds.strongMaxRatio);
    values[PROPERTY_NAMES.moderateMaxRatio] = String(thresholds.moderateMaxRatio);
    PropertiesService.getScriptProperties().setProperties(values, false);
    return thresholds;
  }

  function setUserSettings(settings) {
    if (!settings) throw new Error('Settings are required.');
    var thresholds = validateThresholds(settings.thresholds);
    if (typeof PropertiesService === 'undefined') {
      throw new Error('PropertiesService is only available in Google Apps Script.');
    }

    var values = {};
    values[PROPERTY_NAMES.exceptionalMaxRatio] = String(thresholds.exceptionalMaxRatio);
    values[PROPERTY_NAMES.strongMaxRatio] = String(thresholds.strongMaxRatio);
    values[PROPERTY_NAMES.moderateMaxRatio] = String(thresholds.moderateMaxRatio);
    values[PROPERTY_NAMES.starExceptional] = String(Boolean(settings.starExceptional));
    values[PROPERTY_NAMES.starStrong] = String(Boolean(settings.starStrong));
    values[PROPERTY_NAMES.sheetLoggingEnabled] = String(Boolean(settings.sheetLoggingEnabled));
    PropertiesService.getScriptProperties().setProperties(values, false);

    return {
      thresholds: thresholds,
      starExceptional: Boolean(settings.starExceptional),
      starStrong: Boolean(settings.starStrong),
      sheetLoggingEnabled: Boolean(settings.sheetLoggingEnabled)
    };
  }

  return {
    get: get,
    setThresholds: setThresholds,
    setUserSettings: setUserSettings,
    validateThresholds: validateThresholds,
    _test: {
      parseBoolean: parseBoolean,
      PROPERTY_NAMES: PROPERTY_NAMES
    }
  };
})();
