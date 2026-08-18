# TopTracks

TopTracks prioritizes Keepa price-alert emails by how far the current book price
has fallen below Douglas's desired/max purchase price.

The primary ranking metric is percentage below max:

```text
priceRatio   = currentPrice / desiredPrice
dealDepthPct = ((desiredPrice - currentPrice) / desiredPrice) * 100
```

Default tiers are configurable: Exceptional at 40%+ below max, Strong at 20%+,
Moderate at 10%+, and Marginal below 10%.

## Status

Parser/scoring foundation only. Live Gmail processing is deliberately disabled
until the representative Keepa fixtures and failure behavior are proven.

Five sanitized real-world Keepa alerts currently cover single-row and multi-row
emails plus `Used, very good`, `Used, good`, and `New, 3rd Party FBA` price types.
The parser treats Keepa's HTML pricing table as authoritative and fails closed if
Current, Desired, and Difference do not reconcile.

## Tests

Requires Node.js 20+ and no npm dependencies:

```bash
npm test
```

The acceptance case `Current = 61.13`, `Desired = 78.00` produces `$16.87` below
max, approximately `21.63%` below max, and the `Strong` tier.

See `docs/architecture.md` and `test/fixtures/README.md` for the current contract
and fixture-safety rules.
