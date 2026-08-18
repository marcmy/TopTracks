var TopTracksValidation = (function () {
  function isFiniteNumber(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function validateOffer(offer, tolerance) {
    var errors = [];
    var allowedTolerance = typeof tolerance === 'number' ? tolerance : 0.011;

    if (!offer || typeof offer !== 'object') {
      return { ok: false, errors: ['Offer is missing.'] };
    }
    if (!offer.condition || !String(offer.condition).trim()) {
      errors.push('Condition/price type is missing.');
    }
    if (!isFiniteNumber(offer.currentPrice) || offer.currentPrice < 0) {
      errors.push('Current price is invalid.');
    }
    if (!isFiniteNumber(offer.desiredPrice) || offer.desiredPrice <= 0) {
      errors.push('Desired price is invalid.');
    }
    if (!isFiniteNumber(offer.keepaDifference)) {
      errors.push('Keepa difference is invalid.');
    }

    if (errors.length === 0) {
      var calculatedDifference = offer.currentPrice - offer.desiredPrice;
      if (Math.abs(calculatedDifference - offer.keepaDifference) > allowedTolerance) {
        errors.push('Keepa difference does not reconcile with Current - Desired.');
      }
    }

    return { ok: errors.length === 0, errors: errors };
  }

  function validateParsedEmail(parsed, tolerance) {
    var errors = [];
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, errors: ['Parsed email is missing.'] };
    }
    if (!parsed.title || !String(parsed.title).trim()) {
      errors.push('Book title is missing.');
    }
    if (!Array.isArray(parsed.offers) || parsed.offers.length === 0) {
      errors.push('No Keepa price rows were parsed.');
    } else {
      parsed.offers.forEach(function (offer, index) {
        var result = validateOffer(offer, tolerance);
        result.errors.forEach(function (error) {
          errors.push('Offer ' + (index + 1) + ': ' + error);
        });
      });
    }
    return { ok: errors.length === 0, errors: errors };
  }

  return {
    validateOffer: validateOffer,
    validateParsedEmail: validateParsedEmail
  };
})();
