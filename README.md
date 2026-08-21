# TopTracks

TopTracks prioritizes Keepa price-alert emails by how far the current book price
has fallen below the configured desired/max purchase price.

```text
priceRatio   = currentPrice / desiredPrice
dealDepthPct = ((desiredPrice - currentPrice) / desiredPrice) * 100
```

Default configurable tiers are Exceptional at 50%+ below max, Strong at 30%+,
Moderate at 10%+, and Marginal below 10%.

## MVP status

The repository contains a production Apps Script implementation with:

- fixture-driven Keepa HTML parsing with multiple offers per email;
- fail-closed Current / Desired / Difference validation;
- configurable scoring based primarily on percentage below max;
- colored Gmail tier labels and hidden `TopTracks/Processed` exact-once state;
- retry-safe one-minute Gmail processing with an Apps Script script lock;
- one reusable `TopTracks` Google Sheet containing parsed offer history;
- a `Best Deals` tab containing Strong/Exceptional winning offers;
- a user-facing `Settings` tab for changing thresholds and common behavior;
- bounded, read-only historical preview and controlled historical backfill.

No Gmail credentials, OAuth tokens, Keepa credentials, Amazon credentials, or raw
mailbox exports are stored in this public repository.

## Gmail labels

Visible inbox labels use the full tier names without the `TopTracks/` prefix:

- `Exceptional` — dark green
- `Strong` — green
- `Moderate` — yellow
- `Marginal` — gray
- `Parse Error` — red
- `TopTracks/Processed` — hidden bookkeeping label

Exceptional alerts are starred by default. Strong starring is configurable.
During label provisioning, legacy visible labels such as `TopTracks/Exceptional`
are renamed **in place** to `Exceptional`. Temporary compact names from an earlier
migration (`EXC`, `STR`, `MOD`, `MAR`, `ERR`) are also normalized to the full
unprefixed names. Because the Gmail label ID is preserved, already-classified
messages update at the same time and do not need to be reprocessed.

## Google Sheet and Settings UI

TopTracks creates one spreadsheet named `TopTracks` and stores its ID in the Apps
Script property `TOPTRACKS_SHEET_ID`. It reuses that spreadsheet; it does not
create a new spreadsheet per alert or per processing run.

The main tab contains one row per Keepa offer/condition with:

`Received`, `Title`, `Condition`, `Current Price`, `Desired Price`,
`Dollar Below Max`, `Percent Below Max`, `Tier`, `Best Offer`, `Cause`, `ASIN`,
`Amazon URL`, and Gmail message/thread IDs.

`Best Deals` contains only the winning Strong and Exceptional offer for each
message. Parse failures are logged in the main tab for inspection.

The `Settings` tab is the normal configuration UI. Editable settings include:

- Exceptional minimum percentage below max;
- Strong minimum percentage below max;
- Moderate minimum percentage below max;
- whether Exceptional alerts are starred;
- whether Strong alerts are starred;
- whether spreadsheet history logging is enabled.

Valid Settings edits are persisted to Apps Script Script Properties by an
installable spreadsheet edit trigger. The one-minute Gmail processor therefore
does not need to reread the Settings sheet on every run.

A hidden stable record key (`Gmail message ID + offer index`) makes Sheet writes
idempotent. Percentage is stored as a real numeric fraction and both data tabs
sort by Percent Below Max descending, then Dollar Below Max descending.
Spreadsheet-formula prefixes (`=`, `+`, `-`, or `@`) are escaped before writing.

## Safe rollout

Deploy the source to a standalone Apps Script project, then perform a bounded
read-only preview before enabling automatic processing.

### 1. Preview historical mail

```js
TOPTRACKS_1_PREVIEW_25()
```

Preview reads and scores messages but does not apply labels, mark Processed, star
messages, or write to the Sheet.

### 2. Backfill controlled batches

```js
TOPTRACKS_2_BACKFILL_100()
```

Backfill uses the normal retry-safe pipeline, automatically excludes already
Processed messages, applies Gmail classification, and writes idempotent Sheet
rows. Repeat as needed to work through older alerts.

### 3. Enable automatic processing

```js
TOPTRACKS_3_INSTALL_AUTOMATION()
```

Installation creates/repairs labels, provisions the spreadsheet and Settings tab,
replaces duplicate TopTracks triggers, and creates:

- one `processTopTracks` time trigger at a one-minute interval;
- one spreadsheet edit trigger for applying Settings changes.

To stop TopTracks automation without removing existing classifications:

```js
TOPTRACKS_DISABLE_AUTOMATION()
```

## Failure and consistency behavior

Sheet rows are written before Gmail receives `TopTracks/Processed`. If a Sheet
write fails, Gmail remains unprocessed and the message can retry. Transient Google
Sheets service failures receive short retries with backoff. If Sheet writing
succeeds but Gmail labeling subsequently fails, stable Sheet record keys prevent
duplicate rows on the retry.

Deterministic parser/validation failures receive the visible `Parse Error`
classification, are logged, and are marked Processed. Unexpected Gmail/API/runtime
failures remain unprocessed so later executions retry them.

## Configuration

The preferred configuration interface is the spreadsheet `Settings` tab.
Deployment-specific advanced overrides can also use Apps Script Script Properties:

- `TOPTRACKS_EXCEPTIONAL_MAX_RATIO`
- `TOPTRACKS_STRONG_MAX_RATIO`
- `TOPTRACKS_MODERATE_MAX_RATIO`
- `TOPTRACKS_STAR_EXCEPTIONAL`
- `TOPTRACKS_STAR_STRONG`
- `TOPTRACKS_GMAIL_QUERY`
- `TOPTRACKS_MAX_RESULTS` (1–500; default 50 per automatic run)
- `TOPTRACKS_SHEET_LOGGING_ENABLED` (`true` by default)

## Tests

Requires Node.js 26+ and no npm dependencies:

```bash
npm test
```

The regression suite covers sanitized real-world Keepa fixtures, tier boundaries,
multi-offer ranking, Gmail exact-once behavior, label provisioning/colors and
legacy-label migration, runtime retries, Sheet idempotency, Settings
conversion/validation, spreadsheet formula-injection protection, and read-only
historical preview safety.

See `docs/architecture.md` and `test/fixtures/README.md` for the processing and
fixture-safety contracts.
