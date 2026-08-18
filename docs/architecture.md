# TopTracks MVP architecture

TopTracks runs in Douglas's dedicated Keepa Gmail account as a standalone Google
Apps Script project. The MVP has no Windows daemon, Keepa API dependency, Amazon
API dependency, or browser DOM scraper.

## Processing boundary

The parser accepts normalized Gmail message data (`receivedAt`, `subject`,
`plainBody`, `htmlBody`) and returns one email containing `offers[]`. Real Keepa
fixtures show that a single alert email can contain multiple condition/price rows.
The HTML Current/Desired/Difference/Cause table is authoritative; plain text and
subject data are secondary metadata only.

Every parsed offer is validated before scoring. In particular:

`keepaDifference ~= currentPrice - desiredPrice`

If required price values are missing, malformed, or inconsistent, the email must
fail closed and later receive `TopTracks/Parse Error`; it must never be silently
classified from uncertain values.

## Scoring

For every valid offer:

- `priceRatio = currentPrice / desiredPrice`
- `dollarBelowMax = desiredPrice - currentPrice`
- `dealDepth = dollarBelowMax / desiredPrice`
- `dealDepthPct = dealDepth * 100`

Default configurable tiers:

- Exceptional: `priceRatio <= 0.60`
- Strong: `priceRatio <= 0.80`
- Moderate: `priceRatio <= 0.90`
- Marginal: otherwise

For a multi-row email, the row with the greatest percentage below max is the
`bestOffer`. Absolute dollar savings is the secondary tie-breaker; an exact tie
keeps the first Keepa row. Gmail will eventually receive exactly one visible tier
based on `bestOffer`, while the Sheet can retain every row.

## Current phase

This repository currently implements and tests only parser/scoring foundations.
Live Gmail discovery, label application, deduplication, scheduling, and Sheets
logging are intentionally not enabled yet.
