# TopTracks MVP architecture

TopTracks runs in Douglas's dedicated Keepa Gmail account as a standalone Google
Apps Script project. The MVP has no Windows daemon, Keepa API dependency, Amazon
API dependency, or browser DOM scraper.

## Processing boundary

The parser accepts normalized Gmail message data (`receivedAt`, `subject`, and
`htmlBody`) and returns one email containing `offers[]`. Real Keepa fixtures show
that a single alert email can contain multiple condition/price rows. The HTML
Current/Desired/Difference/Cause table is authoritative; plain text and subject
data are secondary metadata only.

Every parsed offer is validated before scoring. In particular:

`keepaDifference ~= currentPrice - desiredPrice`

If required price values are missing, malformed, or inconsistent, the email fails
closed and receives `TopTracks/Parse Error`; it is never silently classified from
uncertain values.

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
keeps the first Keepa row. Gmail receives exactly one visible tier based on
`bestOffer`.

## Gmail discovery and exact-once state

`TopTracksGmailMessages.listPending()` uses the Gmail API message endpoint with a
bounded search query for Keepa price alerts that do not have
`TopTracks/Processed`. The default batch size is 50 messages per execution, which
is intentionally bounded so a backlog cannot consume an entire Apps Script run.

The stable Gmail message ID is the unit of processing. Before parsing, TopTracks
fetches the full message and rechecks its label IDs for `TopTracks/Processed`.
This protects against stale search results as well as duplicate work.

A successful classification is one Gmail message modification that:

1. adds exactly one tier label;
2. removes all other TopTracks tier/parse-error labels;
3. adds `TopTracks/Processed`; and
4. optionally adds Gmail's `STARRED` system label for configured high tiers.

Because the tier and Processed labels are applied in the same Gmail API request, a
process crash cannot normally leave a successfully classified message eligible
for another scheduled run.

Deterministic parser/validation failures use the same atomic operation with
`TopTracks/Parse Error + TopTracks/Processed`. Unexpected Gmail/API/runtime
failures are different: they are logged but deliberately left unprocessed so a
later run can retry them.

## Labels and colors

`TopTracksGmailLabels.ensureLabels()` creates missing labels and repairs their
visibility/color configuration. The default visible colors are dark green for
Exceptional, green for Strong, yellow for Moderate, gray for Marginal, and red
for Parse Error. `TopTracks/Processed` is hidden from the Gmail message list and
label list because it is bookkeeping rather than priority information.

## Scheduling and concurrency

`installTopTracks()` creates one time-driven `processTopTracks` trigger at a
one-minute interval. Before creating it, the installer deletes any existing
TopTracks processing triggers so rerunning setup is idempotent.

Every processing execution attempts to acquire an Apps Script script lock. If a
previous one-minute invocation is still active, the next invocation exits without
processing rather than overlapping it.

## Runtime configuration

Defaults live in `TOPTRACKS_CONFIG`. Deployment-specific overrides can be stored
in Apps Script Script Properties, so Douglas can tune tier thresholds and starring
behavior without changing the public repository. `configureTopTracksThresholds()`
is the convenience entry point for the three tier ratios.

No Gmail credentials or OAuth tokens are stored in this repository. Authorization
is handled by the Apps Script project owned by the dedicated Gmail account.

## Remaining MVP phase

The next phase is Google Sheet logging and historical/backfill testing. Sheet
logging should retain every scored offer row, flag the winning `bestOffer`, and
sort/rank primarily by percentage below max. A `Best Deals` view can then contain
only Strong and Exceptional winning rows.
