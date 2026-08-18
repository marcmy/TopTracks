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
