# Keepa parser fixtures

`sanitized/` contains public-safe copies of representative Keepa price-alert emails.
They preserve the MIME alternative layout, product/title/ASIN data, and the HTML
pricing table that TopTracks must parse.

`private/` is intentionally gitignored. Raw `.eml` exports belong there only for
local development because they can contain recipient addresses, Gmail transport
metadata, Keepa account tokens, unsubscribe identifiers, seller routing details,
and personalized image URLs.

Each committed `.eml` has a matching `.expected.json` parser/scoring contract.
When a new Keepa layout or price type is encountered:

1. Put the raw message under `private/` (never commit it).
2. Run `tools/sanitize_fixtures.py` to create a safe `.eml` under `sanitized/`.
3. Review the sanitized file for secrets before committing it.
4. Add/update its `.expected.json` contract.
5. Add a regression test before changing parser behavior.
