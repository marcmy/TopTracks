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

  return {
    status: 'ok',
    phase: 'gmail-processing',
    liveProcessingAvailable: true,
    triggerInstalled: triggerInstalled
  };
}
