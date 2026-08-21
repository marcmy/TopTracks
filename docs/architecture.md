# TopTracks architecture

TopTracks runs as a standalone Google Apps Script project against a dedicated
Keepa-alert Gmail mailbox. It has no Windows daemon, Keepa API dependency, Amazon
API dependency, or browser DOM scraper.

## Parser and scoring boundary

The parser consumes normalized Gmail message data (`receivedAt`, `subject`, and
`htmlBody`) and returns an email containing `offers[]`. One Keepa alert can contain
multiple condition/price rows. The HTML Current/Desired/Difference/Cause table is
authoritative.

Every offer is validated before scoring, including:

`keepaDifference ~= currentPrice - desiredPrice`

Uncertain or inconsistent values fail closed rather than receiving a guessed tier.
Keepa's dash-only Difference representation for an exact desired-price match is
normalized to zero.

For every valid offer:

- `priceRatio = currentPrice / desiredPrice`
- `dollarBelowMax = desiredPrice - currentPrice`
- `dealDepth = dollarBelowMax / desiredPrice`
- `dealDepthPct = dealDepth * 100`

Default tiers are Exceptional at ratio `<= 0.50`, Strong at `<= 0.70`, Moderate
at `<= 0.90`, and Marginal otherwise. These correspond to 50%+, 30%+, 10%+, and
less than 10% below max. Multi-row emails use the greatest percentage below max
as `bestOffer`; absolute dollar savings is the secondary tie-breaker and an exact
tie keeps the first Keepa row.

## Gmail discovery and exact-once state

The automatic pipeline searches a bounded set of Keepa messages without
`TopTracks/Processed`. The stable Gmail message ID is the unit of processing. A
candidate is fetched by ID and its current label IDs are rechecked before parsing.

Successful classification uses one Gmail message modification to add exactly one
visible compact tier tag (`EXC`, `STR`, `MOD`, or `MAR`), remove the other visible
classification tags, add `TopTracks/Processed`, and optionally add `STARRED`.

Parser/validation failures atomically receive `ERR` plus `TopTracks/Processed`.
Unexpected Gmail/API/runtime failures remain unprocessed so a later run retries
them.

## Sheet transaction boundary

TopTracks uses one reusable spreadsheet. When history logging is enabled, the
Sheet write occurs **before** Gmail receives `TopTracks/Processed`.

Every offer row has a stable hidden record key:

`<gmail-message-id>:<offer-index>`

The `Best Deals` row uses `<gmail-message-id>:best`; parse errors use
`<gmail-message-id>:parse-error`. Existing keys are loaded at the start of a run,
so retries do not append duplicate rows.

Transient Spreadsheet service failures are retried with short backoff. Writes use
a fixed target row with `setValues()` so an ambiguous service retry cannot create
a duplicate row.

This ordering gives the pipeline useful retry semantics:

1. If a Sheet write fails, Gmail is left unprocessed and the whole message can retry.
2. If the Sheet succeeds but Gmail labeling fails, the retry sees the existing
   record key and does not duplicate the Sheet row.
3. After Gmail successfully receives the tier + Processed mutation, future normal
   runs no longer discover the message.

The main `TopTracks` tab stores every parsed offer. `Best Deals` stores only the
winning Strong/Exceptional offer. Percentage is stored as a numeric fraction and
both tabs sort by Percent Below Max descending, then Dollar Below Max descending.
Text beginning with `=`, `+`, `-`, or `@` is escaped before it reaches a cell.

## User-facing Settings

The same spreadsheet contains a `Settings` tab. It exposes common configuration
without requiring access to the Apps Script source editor:

- Exceptional minimum percentage below max;
- Strong minimum percentage below max;
- Moderate minimum percentage below max;
- Exceptional starring;
- Strong starring;
- spreadsheet history logging.

An installable spreadsheet edit trigger validates changes and persists valid
values to Apps Script Script Properties. The normal one-minute Gmail processor
reads those properties, not the spreadsheet, so Settings does not add a Sheet read
to every processing cycle.

## Labels and colors

Visible Gmail labels use compact three-character names so inbox subjects remain
nearly flush-left regardless of tier:

- `EXC` — dark green Exceptional;
- `STR` — green Strong;
- `MOD` — yellow Moderate;
- `MAR` — gray Marginal;
- `ERR` — red Parse Error.

`TopTracks/Processed` remains hidden bookkeeping state. During label provisioning,
legacy visible names such as `TopTracks/Exceptional` are patched to the compact
name using the same Gmail label ID. Existing messages therefore update in place
without historical reprocessing. Label configuration is repaired idempotently
during setup and every normal processing run.

## Scheduling and concurrency

`installTopTracks()` provisions labels, the spreadsheet, and Settings state;
removes duplicate TopTracks triggers; and creates:

- one time-driven `processTopTracks` trigger at a one-minute interval;
- one installable spreadsheet edit trigger for Settings changes.

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
4. run `installTopTracks()` to enable automatic processing.

## Runtime configuration and privacy

Defaults live in `TOPTRACKS_CONFIG`; deployment-specific overrides use Apps Script
Script Properties. The spreadsheet Settings UI is the preferred interface for
normal threshold and behavior changes.

The public repository contains no Gmail credentials, OAuth tokens, Keepa API
credentials, Amazon credentials, raw mailbox exports, or user-identifying account
information. Committed real-world Keepa regression fixtures are sanitized copies
preserving only parser-relevant MIME/layout/product data.
