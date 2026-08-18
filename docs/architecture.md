# TopTracks MVP architecture

TopTracks runs in Douglas's dedicated Keepa Gmail account as a standalone Google
Apps Script project. The MVP has no Windows daemon, Keepa API dependency, Amazon
API dependency, or browser DOM scraper.

## Parser and scoring boundary

The parser consumes normalized Gmail message data (`receivedAt`, `subject`, and
`htmlBody`) and returns an email containing `offers[]`. Real Keepa fixtures show
that one alert can contain multiple condition/price rows. The HTML
Current/Desired/Difference/Cause table is authoritative.

Every offer is validated before scoring, including:

`keepaDifference ~= currentPrice - desiredPrice`

Uncertain or inconsistent values fail closed rather than receiving a guessed tier.

For every valid offer:

- `priceRatio = currentPrice / desiredPrice`
- `dollarBelowMax = desiredPrice - currentPrice`
- `dealDepth = dollarBelowMax / desiredPrice`
- `dealDepthPct = dealDepth * 100`

Default tiers are Exceptional at ratio `<= 0.60`, Strong at `<= 0.80`, Moderate
at `<= 0.90`, and Marginal otherwise. Multi-row emails use the greatest
percentage below max as `bestOffer`; absolute dollar savings is the secondary
tie-breaker and an exact tie keeps the first Keepa row.

## Gmail discovery and exact-once state

The automatic pipeline searches a bounded set of Keepa messages without
`TopTracks/Processed`. The stable Gmail message ID is the unit of processing. A
candidate is fetched by ID and its current label IDs are rechecked before parsing.

Successful classification uses one Gmail message modification to add exactly one
tier, remove other TopTracks classifications, add `TopTracks/Processed`, and
optionally add `STARRED`.

Parser/validation failures atomically receive `TopTracks/Parse Error +
TopTracks/Processed`. Unexpected Gmail/API/runtime failures remain unprocessed so
a later run retries them.

## Sheet transaction boundary

When Sheet logging is enabled, the Sheet write occurs **before** Gmail receives
`TopTracks/Processed`.

Every offer row has a stable hidden record key:

`<gmail-message-id>:<offer-index>`

The `Best Deals` row uses `<gmail-message-id>:best`; parse errors use
`<gmail-message-id>:parse-error`. Existing keys are loaded at the start of a run,
so retries do not append duplicate rows.

This ordering gives the pipeline useful retry semantics:

1. If a Sheet write fails, Gmail is left unprocessed and the whole message can
   retry.
2. If the Sheet succeeds but Gmail labeling fails, the retry sees the existing
   record key and does not duplicate the Sheet row.
3. After Gmail successfully receives the tier + Processed mutation, future normal
   runs no longer discover the message.

The main `TopTracks` tab stores every parsed offer. `Best Deals` stores only the
winning Strong/Exceptional offer. Percentage is stored as a numeric fraction and
both tabs sort by Percent Below Max descending, then Dollar Below Max descending.
Text beginning with `=`, `+`, `-`, or `@` is escaped before it reaches a cell.

## Labels and colors

TopTracks provisions dark green Exceptional, green Strong, yellow Moderate, gray
Marginal, red Parse Error, and a hidden Processed bookkeeping label. Label
configuration is repaired idempotently during setup/runs.

## Scheduling and concurrency

`installTopTracks()` provisions labels and the Sheet, removes duplicate TopTracks
processing triggers, and creates one time-driven `processTopTracks` trigger at a
one-minute interval.

Each processing run first attempts an Apps Script script lock. If another run is
still active, the new invocation exits instead of overlapping it.

## Historical safety gate

Historical testing is deliberately separated from trigger installation.

`previewTopTracksHistory(maxResults, queryOverride)` requires an explicit integer
limit from 1–100 and is read-only: it fetches, parses, validates, and scores but
never labels, stars, marks Processed, or writes Sheets.

`backfillTopTracksHistory(maxResults, queryOverride)` also requires an explicit
1–100 limit, then uses the normal pending pipeline. It therefore inherits
Processed exclusion, lock protection, Sheet idempotency, classification, and
retry behavior.

Recommended deployment sequence:

1. preview a small historical sample;
2. inspect classifications and parse errors;
3. backfill controlled batches if desired;
4. only then run `installTopTracks()` to enable the one-minute trigger.

## Runtime configuration and privacy

Defaults live in `TOPTRACKS_CONFIG`; deployment-specific overrides use Apps Script
Script Properties. Thresholds can be changed with
`configureTopTracksThresholds()` and Sheet logging can be disabled with
`TOPTRACKS_SHEET_LOGGING_ENABLED=false`.

The public repository contains no Gmail credentials, OAuth tokens, Keepa API
credentials, Amazon credentials, or raw Douglas mailbox exports. The five real
Keepa regression fixtures are sanitized copies preserving only parser-relevant
MIME/layout/product data.
