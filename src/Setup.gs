function installTopTracks() {
  var config = TopTracksConfig.get();
  var labelIds = TopTracksGmailLabels.ensureLabels(Gmail, config);
  var removed = removeTopTracksTriggers();
  var trigger = ScriptApp.newTrigger('processTopTracks')
    .timeBased()
    .everyMinutes(1)
    .create();

  return {
    status: 'installed',
    triggerId: trigger.getUniqueId(),
    replacedTriggers: removed,
    labels: labelIds
  };
}

function removeTopTracksTriggers() {
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'processTopTracks') {
      ScriptApp.deleteTrigger(trigger);
      removed += 1;
    }
  });
  return removed;
}

function configureTopTracksThresholds(
  exceptionalMaxRatio,
  strongMaxRatio,
  moderateMaxRatio
) {
  return TopTracksConfig.setThresholds(
    exceptionalMaxRatio,
    strongMaxRatio,
    moderateMaxRatio
  );
}
