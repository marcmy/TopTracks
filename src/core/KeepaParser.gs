var TopTracksParser = (function () {
  function decodeHtmlEntities(value) {
    return String(value || '')
      .replace(/&nbsp;|&#160;/gi, ' ')
      .replace(/&quot;|&#34;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&#x3D;|&#61;/gi, '=')
      .replace(/&#x([0-9a-f]+);/gi, function (_, hex) {
        return String.fromCharCode(parseInt(hex, 16));
      })
      .replace(/&#(\d+);/g, function (_, decimal) {
        return String.fromCharCode(parseInt(decimal, 10));
      });
  }

  function stripHtml(value) {
    return decodeHtmlEntities(
      String(value || '')
        .replace(/<br\s*\/?\s*>/gi, ' ')
        .replace(/<\/p\s*>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
    )
      .replace(/[\uFEFF\u200B]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseMoney(value, requireDollarSign) {
    var text = stripHtml(value).replace(/,/g, '');
    if (requireDollarSign && text.indexOf('$') === -1) {
      return NaN;
    }
    var match = text.match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : NaN;
  }

  function extractTitle(html) {
    var text = stripHtml(html);
    var match = text.match(/(?:The following prices|The .*? Price) for\s*"\s*(.*?)\s*"\s*on Amazon\.com/i);
    return match ? match[1].trim() : null;
  }

  function extractAsin(html) {
    var decoded = decodeHtmlEntities(html);
    var match = decoded.match(/(?:[?&]asin=|product\/1-)([A-Z0-9]{10})/i);
    return match ? match[1].toUpperCase() : null;
  }

  function extractPricingTable(html) {
    var source = String(html || '');
    var headerRegex = /<thead\b[^>]*>[\s\S]*?<\/thead>/gi;
    var headerMatch;

    while ((headerMatch = headerRegex.exec(source)) !== null) {
      var headerText = stripHtml(headerMatch[0]);
      if (
        /\bCurrent\b/i.test(headerText) &&
        /\bDesired\b/i.test(headerText) &&
        /\bDifference\b/i.test(headerText) &&
        /\bCause\b/i.test(headerText)
      ) {
        var afterHeader = source.slice(headerRegex.lastIndex);
        var bodyMatch = afterHeader.match(/^\s*<tbody\b[^>]*>[\s\S]*?<\/tbody>/i);
        return bodyMatch ? headerMatch[0] + bodyMatch[0] : null;
      }
    }
    return null;
  }

  function extractOffers(tableHtml) {
    var rowMatches = String(tableHtml || '').match(/<tr\b[\s\S]*?<\/tr>/gi) || [];
    var offers = [];
    var malformedRows = [];

    rowMatches.forEach(function (rowHtml) {
      var cells = [];
      var cellRegex = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
      var cellMatch;
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        cells.push(cellMatch[1]);
      }
      if (cells.length === 0) {
        return;
      }
      if (cells.length !== 5) {
        malformedRows.push('Expected 5 cells, found ' + cells.length + '.');
        return;
      }

      offers.push({
        condition: stripHtml(cells[0]),
        currentPrice: parseMoney(cells[1], true),
        desiredPrice: parseMoney(cells[2], false),
        keepaDifference: parseMoney(cells[3], false),
        cause: stripHtml(cells[4])
      });
    });

    return { offers: offers, malformedRows: malformedRows };
  }

  function fail(code, message, details) {
    return {
      ok: false,
      error: {
        code: code,
        message: message,
        details: details || []
      }
    };
  }

  function parseEmail(input, options) {
    options = options || {};
    if (!input || !input.htmlBody) {
      return fail('HTML_BODY_MISSING', 'Keepa HTML body is required for price parsing.');
    }

    var title = extractTitle(input.htmlBody);
    var asin = extractAsin(input.htmlBody);
    var table = extractPricingTable(input.htmlBody);
    if (!table) {
      return fail('PRICING_TABLE_MISSING', 'Could not find the Keepa Current/Desired/Difference/Cause table.');
    }

    var rowResult = extractOffers(table);
    if (rowResult.malformedRows.length > 0) {
      return fail('PRICING_ROW_MALFORMED', 'One or more Keepa pricing rows were malformed.', rowResult.malformedRows);
    }

    var parsed = {
      receivedAt: input.receivedAt || null,
      subject: input.subject || null,
      title: title,
      asin: asin,
      amazonUrl: asin ? 'https://www.amazon.com/dp/' + asin : null,
      offers: rowResult.offers
    };

    if (typeof TopTracksValidation !== 'undefined') {
      var validation = TopTracksValidation.validateParsedEmail(parsed, options.differenceTolerance);
      if (!validation.ok) {
        return fail('VALIDATION_FAILED', 'Parsed Keepa values failed validation.', validation.errors);
      }
    }

    return { ok: true, value: parsed };
  }

  return {
    parseEmail: parseEmail,
    _test: {
      stripHtml: stripHtml,
      extractTitle: extractTitle,
      extractAsin: extractAsin,
      extractPricingTable: extractPricingTable,
      extractOffers: extractOffers
    }
  };
})();
