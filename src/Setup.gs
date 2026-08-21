function installTopTracks() {
  var config = TopTracksConfig.get();
  var labelIds = TopTracksGmailLabels.ensureLabels(Gmail, config);

  // The spreadsheet now doubles as TopTracks' user-facing settings UI, so keep
  // it available even if history logging is later disabled from Settings.
  var ensured = TopTracksSheetLogger.ensureSpreadsheet(config);
  var spreadsheet = ensured.spreadsheet;
  var settingsSheet = TopTracksSettings.ensureSheet(spreadsheet, config);

  if (config.sheet.enabled) {
    var session = TopTracksSheetLogger.createSession(config);
    TopTracksSheetLogger.finalize(session);
  }

  var removed = removeTopTracksTriggers();
  var processingTrigger = ScriptApp.newTrigger('processTopTracks')
    .timeBased().everyMinutes(1).create();
  var settingsTrigger = ScriptApp.newTrigger('handleTopTracksSettingsEdit')
    .forSpreadsheet(spreadsheet)
    .onEdit()
    .create();

  return {
    status: 'installed',
    triggerId: processingTrigger.getUniqueId(),
    processingTriggerId: processingTrigger.getUniqueId(),
    settingsTriggerId: settingsTrigger.getUniqueId(),
    replacedTriggers: removed,
    labels: labelIds,
    sheet: {
      spreadsheetId: spreadsheet.getId(),
      spreadsheetUrl: spreadsheet.getUrl(),
      settingsSheet: settingsSheet.getName()
    }
  };
}

function removeTopTracksTriggers() {
  var removed = 0;
  var handlers = {
    processTopTracks: true,
    handleTopTracksSettingsEdit: true
  };
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (handlers[trigger.getHandlerFunction()]) {
      ScriptApp.deleteTrigger(trigger);
      removed += 1;
    }
  });
  return removed;
}

function configureTopTracksThresholds(exceptionalMaxRatio, strongMaxRatio, moderateMaxRatio) {
  return TopTracksConfig.setThresholds(exceptionalMaxRatio, strongMaxRatio, moderateMaxRatio);
}
