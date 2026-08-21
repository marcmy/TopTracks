var TopTracksGmailMessages = (function () {
  function buildPendingQuery(baseQuery, processedLabelName) {
    return String(baseQuery || '').trim() + ' -label:"' + String(processedLabelName).replace(/"/g, '\\"') + '"';
  }

  function listByQuery(query, maxResults, gmailService) {
    var gmail = gmailService || Gmail;
    var response = gmail.Users.Messages.list('me', {
      q: query,
      maxResults: maxResults,
      includeSpamTrash: false
    }) || {};
    return response.messages || [];
  }

  function listPending(config, gmailService) {
    return listByQuery(
      buildPendingQuery(config.gmail.query, config.labels.Processed.name),
      config.gmail.maxResults,
      gmailService
    );
  }

  function getFull(messageId, gmailService) {
    var gmail = gmailService || Gmail;
    return gmail.Users.Messages.get('me', messageId, { format: 'full' });
  }

  function getHeader(payload, name) {
    var headers = payload && payload.headers ? payload.headers : [];
    var lowerName = String(name).toLowerCase();
    for (var i = 0; i < headers.length; i += 1) {
      if (String(headers[i].name || '').toLowerCase() === lowerName) {
        return headers[i].value || null;
      }
    }
    return null;
  }

  function decodeBodyData(data, utilities) {
    var util = utilities || Utilities;

    // Gmail's REST representation is base64url, but Apps Script's Advanced
    // Gmail service can deserialize MessagePartBody.data directly to Byte[].
    // Accept both forms so the same code works in Apps Script and in tests.
    if (Array.isArray(data)) {
      return util.newBlob(data).getDataAsString('UTF-8');
    }

    if (typeof data !== 'string') {
      throw new Error('Unsupported Gmail body data type: ' + typeof data);
    }

    var bytes = util.base64DecodeWebSafe(data);
    return util.newBlob(bytes).getDataAsString('UTF-8');
  }

  function readPartData(part, messageId, gmailService, utilities) {
    var body = part && part.body ? part.body : {};
    var data = body.data;
    if (!data && body.attachmentId) {
      var attachment = gmailService.Users.Messages.Attachments.get('me', messageId, body.attachmentId);
      data = attachment && attachment.data;
    }
    return data ? decodeBodyData(data, utilities) : null;
  }

  function findHtmlBody(part, messageId, gmailService, utilities) {
    if (!part) return null;
    if (String(part.mimeType || '').toLowerCase() === 'text/html') {
      return readPartData(part, messageId, gmailService, utilities);
    }
    var parts = part.parts || [];
    for (var i = 0; i < parts.length; i += 1) {
      var found = findHtmlBody(parts[i], messageId, gmailService, utilities);
      if (found !== null) return found;
    }
    return null;
  }

  function normalizeFullMessage(message, gmailService, utilities) {
    var gmail = gmailService || Gmail;
    var receivedAt = null;
    if (message.internalDate !== undefined && message.internalDate !== null) {
      var millis = Number(message.internalDate);
      if (isFinite(millis)) receivedAt = new Date(millis).toISOString();
    }
    return {
      gmailMessageId: message.id,
      gmailThreadId: message.threadId || null,
      labelIds: message.labelIds || [],
      receivedAt: receivedAt,
      subject: getHeader(message.payload, 'Subject'),
      htmlBody: findHtmlBody(message.payload, message.id, gmail, utilities)
    };
  }

  function isProcessed(message, processedLabelId) {
    return (message.labelIds || []).indexOf(processedLabelId) !== -1;
  }

  function shouldStar(tier, config) {
    return tier === 'Exceptional' ? config.starExceptional : tier === 'Strong' ? config.starStrong : false;
  }

  function applyClassification(messageId, classificationKey, labelIds, config, gmailService) {
    var gmail = gmailService || Gmail;
    var targetId = labelIds[classificationKey];
    if (!targetId) throw new Error('Unknown TopTracks classification: ' + classificationKey);
    var addLabelIds = [targetId, labelIds.Processed];
    if (shouldStar(classificationKey, config)) addLabelIds.push('STARRED');
    var removeLabelIds = labelIds.classificationIds.filter(function (id) { return id !== targetId; });
    return gmail.Users.Messages.modify({
      addLabelIds: addLabelIds,
      removeLabelIds: removeLabelIds
    }, 'me', messageId);
  }

  return {
    listByQuery: listByQuery,
    listPending: listPending,
    getFull: getFull,
    normalizeFullMessage: normalizeFullMessage,
    isProcessed: isProcessed,
    applyClassification: applyClassification,
    _test: {
      buildPendingQuery: buildPendingQuery,
      getHeader: getHeader,
      decodeBodyData: decodeBodyData,
      findHtmlBody: findHtmlBody,
      shouldStar: shouldStar
    }
  };
})();
