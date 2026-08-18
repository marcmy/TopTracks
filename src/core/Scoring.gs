var TopTracksScoring = (function () {
  function scoreOffer(offer, thresholds) {
    var priceRatio = offer.currentPrice / offer.desiredPrice;
    var dollarBelowMax = offer.desiredPrice - offer.currentPrice;
    var dealDepth = dollarBelowMax / offer.desiredPrice;
    var dealDepthPct = dealDepth * 100;
    var tier;

    if (priceRatio <= thresholds.exceptionalMaxRatio) {
      tier = 'Exceptional';
    } else if (priceRatio <= thresholds.strongMaxRatio) {
      tier = 'Strong';
    } else if (priceRatio <= thresholds.moderateMaxRatio) {
      tier = 'Moderate';
    } else {
      tier = 'Marginal';
    }

    return {
      condition: offer.condition,
      currentPrice: offer.currentPrice,
      desiredPrice: offer.desiredPrice,
      keepaDifference: offer.keepaDifference,
      cause: offer.cause,
      priceRatio: priceRatio,
      dollarBelowMax: dollarBelowMax,
      dealDepth: dealDepth,
      dealDepthPct: dealDepthPct,
      tier: tier
    };
  }

  function scoreEmail(parsedEmail, thresholds) {
    var scoredOffers = parsedEmail.offers.map(function (offer) {
      return scoreOffer(offer, thresholds);
    });

    var bestOfferIndex = 0;
    for (var i = 1; i < scoredOffers.length; i += 1) {
      var candidate = scoredOffers[i];
      var best = scoredOffers[bestOfferIndex];
      if (
        candidate.dealDepthPct > best.dealDepthPct ||
        (candidate.dealDepthPct === best.dealDepthPct && candidate.dollarBelowMax > best.dollarBelowMax)
      ) {
        bestOfferIndex = i;
      }
    }

    return {
      offers: scoredOffers,
      bestOfferIndex: bestOfferIndex,
      bestOffer: scoredOffers[bestOfferIndex],
      tier: scoredOffers[bestOfferIndex].tier
    };
  }

  return {
    scoreOffer: scoreOffer,
    scoreEmail: scoreEmail
  };
})();
