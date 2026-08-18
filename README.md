# TopTracks

TopTracks prioritizes Keepa price-alert emails by how far the current book price
has fallen below Douglas's desired/max purchase price.

The primary ranking metric is percentage below max:

```text
priceRatio   = currentPrice / desiredPrice
dealDepthPct = ((desiredPrice - currentPrice) / desiredPrice) * 100
```

Default tiers are Exceptional at 40%+ below max, Strong at 20%+, Moderate at
10%+, and Marginal below 10%. Thresholds can be changed at runtime with Apps
Script properties or `configureTopTracksThresholds()`.

## Status

The parser/scoring foundation and Gmail classification pipeline are implemented.
The repository does not contain Gmail credentials, OAuth tokens, or Douglas's raw
mail exports, and merging the code does not itself install a trigger in anyone's
mailbox.

The Gmail phase:

- searches only Keepa price alerts without `TopTracks/Processed`;
- rechecks the stable Gmail message ID before doing work;
- extracts the HTML MIME part used by the fixture-driven Keepa parser;
- validates and scores every Keepa condition/price row;
- applies exactly one visible tier label plus `TopTracks/Processed` atomically;
- applies `TopTracks/Parse Error` instead of guessing when parsing is uncertain;
- stars Exceptional alerts by default;
- leaves unexpected Gmail/runtime failures unprocessed so they can retry;
- guards overlapping one-minute executions with an Apps Script script lock.

`TopTracks/Processed` is hidden from the Gmail message list so it can serve as
bookkeeping without adding another visible inbox chip.

## Gmail labels

TopTracks provisions and maintains these labels and colors:

- `TopTracks/Exceptional` — dark green
- `TopTracks/Strong` — green
- `TopTracks/Moderate` — yellow
- `TopTracks/Marginal` — gray
- `TopTracks/Parse Error` — red
- `TopTracks/Processed` — hidden bookkeeping label

## Install in the dedicated Keepa account

After pushing the project to an Apps Script project owned by Douglas's dedicated
Keepa Gmail account, run this function once from the Apps Script editor:

```js
installTopTracks()
```

The first run creates/repairs the labels, removes duplicate TopTracks clock
triggers, installs one `processTopTracks` trigger at a one-minute interval, and
prompts for the required Google authorization.

Use `removeTopTracksTriggers()` to stop automatic processing without deleting any
classification labels.

## Configuration

The default tier ratios are `0.60 / 0.80 / 0.90`. They can be changed without a
code edit:

```js
configureTopTracksThresholds(0.60, 0.80, 0.90)
```

Supported Script Properties also include:

- `TOPTRACKS_EXCEPTIONAL_MAX_RATIO`
- `TOPTRACKS_STRONG_MAX_RATIO`
- `TOPTRACKS_MODERATE_MAX_RATIO`
- `TOPTRACKS_STAR_EXCEPTIONAL`
- `TOPTRACKS_STAR_STRONG`
- `TOPTRACKS_GMAIL_QUERY`
- `TOPTRACKS_MAX_RESULTS` (1-500; default 50 per run)

## Tests

Requires Node.js 20+ and no npm dependencies:

```bash
npm test
```

The acceptance case `Current = 61.13`, `Desired = 78.00` produces `$16.87` below
max, approximately `21.63%` below max, and the `Strong` tier.

Five sanitized real-world Keepa fixtures cover single-row and multi-row alerts.
The original raw `.eml` exports remain private and are never committed.

See `docs/architecture.md` and `test/fixtures/README.md` for the processing and
fixture-safety contracts.
