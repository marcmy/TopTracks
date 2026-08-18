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
      var label = byName[definition.name];
      if (!label) {
        label = gmail.Users.Labels.create(buildResource(definition), 'me');
        byName[definition.name] = label;
      } else if (needsPatch(label, definition)) {
        label = gmail.Users.Labels.patch(buildResource(definition), 'me', label.id);
        byName[definition.name] = label;
      }
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
      ORDER: ORDER
    }
  };
})();
