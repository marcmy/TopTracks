# TopTracks

TopTracks prioritizes Keepa price-alert emails by how far the current book price
has fallen below Douglas's desired/max purchase price.

```text
priceRatio   = currentPrice / desiredPrice
dealDepthPct = ((desiredPrice - currentPrice) / desiredPrice) * 100
```

Default configurable tiers are Exceptional at 40%+ below max, Strong at 20%+,
Moderate at 10%+, and Marginal below 10%.

## MVP status

The repository now contains the full Apps Script MVP:

- fixture-driven Keepa HTML parsing with multiple offers per email;
- fail-closed Current / Desired / Difference validation;
- configurable scoring based primarily on percentage below max;
- colored Gmail tier labels and hidden `TopTracks/Processed` exact-once state;
- retry-safe one-minute Gmail processing with an Apps Script script lock;
- a `TopTracks` Google Sheet containing every parsed offer row;
- a `Best Deals` tab containing only Strong/Exceptional winning offers;
- bounded, read-only historical preview and controlled historical backfill.

No Gmail credentials, OAuth tokens, Keepa credentials, Amazon credentials, or raw
Douglas mailbox exports are stored in this public repository.

## Gmail labels

TopTracks provisions:

- `TopTracks/Exceptional` — dark green
- `TopTracks/Strong` — green
- `TopTracks/Moderate` — yellow
- `TopTracks/Marginal` — gray
- `TopTracks/Parse Error` — red
- `TopTracks/Processed` — hidden bookkeeping label

Exceptional alerts are starred by default. Strong starring is configurable.

## Google Sheet

Sheet logging is enabled by default. TopTracks creates a spreadsheet named
`TopTracks` and stores its ID in the Apps Script property `TOPTRACKS_SHEET_ID`.

The main tab contains one row per Keepa offer/condition with:

`Received`, `Title`, `Condition`, `Current Price`, `Desired Price`,
`Dollar Below Max`, `Percent Below Max`, `Tier`, `Best Offer`, `Cause`, `ASIN`,
`Amazon URL`, and Gmail message/thread IDs.

A hidden stable record key (`Gmail message ID + offer index`) makes writes
idempotent. Percentage is stored as a real numeric fraction and both tabs sort by
Percent Below Max descending, then Dollar Below Max descending.

`Best Deals` contains only the winning Strong and Exceptional offer for each
message. Parse failures are logged in the main tab for inspection.

Sheet text is escaped before writing if it begins with a spreadsheet formula
prefix (`=`, `+`, `-`, or `@`).

## Safe rollout

After pushing this repository into an Apps Script project owned by Douglas's
dedicated Keepa Gmail account, do **not** install the automatic trigger first.

### 1. Preview historical mail

Run an explicit, bounded read-only preview:

```js
previewTopTracksHistory(25)
```

The limit is mandatory and must be 1–100. Preview reads and scores messages but
does not apply labels, mark Processed, star messages, or write to the Sheet.

An optional Gmail query can narrow the test set:

```js
previewTopTracksHistory(25, 'from:pricealert@keepa.com newer_than:7d')
```

### 2. Backfill a controlled batch

After reviewing preview output:

```js
backfillTopTracksHistory(25)
```

Backfill uses the normal retry-safe pipeline, automatically excludes already
Processed messages, applies Gmail classification, and writes idempotent Sheet
rows. Repeat in bounded batches as desired.

### 3. Enable automatic processing

Only after the historical test looks correct:

```js
installTopTracks()
```

Installation creates/repairs labels, provisions the Sheet, removes duplicate
TopTracks clock triggers, and creates one `processTopTracks` trigger at a
one-minute interval.

To stop automation without removing any classifications:

```js
removeTopTracksTriggers()
```

## Failure and consistency behavior

Sheet rows are written before Gmail receives `TopTracks/Processed`. If the Sheet
write fails, Gmail remains unprocessed and the message can retry. If Sheet writing
succeeds but Gmail labeling subsequently fails, stable Sheet record keys prevent
duplicate rows on the retry.

Deterministic parser/validation failures receive `TopTracks/Parse Error`, are
logged, and are marked Processed. Unexpected Gmail/API/runtime failures remain
unprocessed so later executions retry them.

## Configuration

Change tier thresholds without editing code:

```js
configureTopTracksThresholds(0.60, 0.80, 0.90)
```

Supported Script Properties:

- `TOPTRACKS_EXCEPTIONAL_MAX_RATIO`
- `TOPTRACKS_STRONG_MAX_RATIO`
- `TOPTRACKS_MODERATE_MAX_RATIO`
- `TOPTRACKS_STAR_EXCEPTIONAL`
- `TOPTRACKS_STAR_STRONG`
- `TOPTRACKS_GMAIL_QUERY`
- `TOPTRACKS_MAX_RESULTS` (1–500; default 50 per automatic run)
- `TOPTRACKS_SHEET_LOGGING_ENABLED` (`true` by default)

## Tests

Requires Node.js 20+ and no npm dependencies:

```bash
npm test
```

The regression suite covers the five sanitized real-world Keepa fixtures, tier
boundaries, the `$61.13 / $78.00` Strong acceptance case, multi-offer ranking,
Gmail exact-once behavior, label provisioning/colors, runtime retries, Sheet
idempotency, spreadsheet formula-injection protection, and read-only historical
preview safety.

See `docs/architecture.md` and `test/fixtures/README.md` for the processing and
fixture-safety contracts.
