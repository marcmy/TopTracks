var TopTracksGmailLabels = (function () {
  var ORDER = ['parent', 'Exceptional', 'Strong', 'Moderate', 'Marginal', 'ParseError', 'Processed'];

  function buildResource(definition) {
    var resource = {
      name: definition.name,
      messageListVisibility: definition.messageListVisibility,
      labelListVisibility: definition.labelListVisibility
    };
    if (definition.backgroundColor && definition.textColor) {
      resource.color = {
        backgroundColor: definition.backgroundColor,
        textColor: definition.textColor
      };
    }
    return resource;
  }

  function needsPatch(label, definition) {
    if (
      label.name !== definition.name ||
      label.messageListVisibility !== definition.messageListVisibility ||
      label.labelListVisibility !== definition.labelListVisibility
    ) {
      return true;
    }
    if (definition.backgroundColor && definition.textColor) {
      return !label.color ||
        label.color.backgroundColor !== definition.backgroundColor ||
        label.color.textColor !== definition.textColor;
    }
    return false;
  }

  function findExistingLabel(byName, definition) {
    if (byName[definition.name]) return byName[definition.name];
    var legacyNames = definition.legacyNames || [];
    for (var i = 0; i < legacyNames.length; i += 1) {
      if (byName[legacyNames[i]]) return byName[legacyNames[i]];
    }
    return null;
  }

  function ensureLabels(gmailService, config) {
    var gmail = gmailService || Gmail;
    var runtimeConfig = config || TopTracksConfig.get();
    var response = gmail.Users.Labels.list('me') || {};
    var byName = {};
    (response.labels || []).forEach(function (label) {
      byName[label.name] = label;
    });

    var ids = {};
    ORDER.forEach(function (key) {
      var definition = runtimeConfig.labels[key];
      var label = findExistingLabel(byName, definition);
      if (!label) {
        label = gmail.Users.Labels.create(buildResource(definition), 'me');
      } else if (needsPatch(label, definition)) {
        var oldName = label.name;
        label = gmail.Users.Labels.patch(buildResource(definition), 'me', label.id);
        if (oldName !== definition.name) delete byName[oldName];
      }
      byName[definition.name] = label;
      ids[key] = label.id;
    });

    ids.tierIds = [ids.Exceptional, ids.Strong, ids.Moderate, ids.Marginal];
    ids.classificationIds = ids.tierIds.concat([ids.ParseError]);
    return ids;
  }

  return {
    ensureLabels: ensureLabels,
    _test: {
      buildResource: buildResource,
      needsPatch: needsPatch,
      findExistingLabel: findExistingLabel,
      ORDER: ORDER
    }
  };
})();
