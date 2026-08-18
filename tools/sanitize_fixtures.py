#!/usr/bin/env python3
"""Create public-safe Keepa .eml fixtures from private originals.

Raw source files must live outside git or under test/fixtures/private/. The output
keeps the subject, product data, ASIN, pricing table, and MIME alternative layout,
but replaces recipient/account secrets and strips original transport headers.
"""

from __future__ import annotations

import argparse
import re
from email import policy
from email.message import EmailMessage
from email.parser import BytesParser
from pathlib import Path

SAFE_TO = "fixture-recipient@example.invalid"


def sanitize_text(value: str) -> str:
    value = re.sub(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", SAFE_TO, value, flags=re.I)
    value = re.sub(r"([?&]token=)[^&\s\"<>]+", r"\1REDACTED", value, flags=re.I)
    value = re.sub(r"([?&]to(?:=|&#x3D;))[^&\s\"<>]+", r"\1REDACTED", value, flags=re.I)
    value = re.sub(r"([?&]seller=)[^&\s\"<>]+", r"\1REDACTED", value, flags=re.I)
    value = re.sub(r"(token=keepa\.)[^&\s\"<>]+", r"\1REDACTED", value, flags=re.I)
    return value


def sanitize_eml(source: Path, destination: Path) -> None:
    original = BytesParser(policy=policy.default).parsebytes(source.read_bytes())
    plain = ""
    html = ""
    for part in original.walk():
        if part.get_content_type() == "text/plain" and not plain:
            plain = part.get_content()
        elif part.get_content_type() == "text/html" and not html:
            html = part.get_content()

    if not html:
        raise ValueError(f"No HTML part found in {source}")

    clean = EmailMessage(policy=policy.default)
    clean["From"] = '"Keepa.com" <pricealert@keepa.com>'
    clean["To"] = SAFE_TO
    clean["Subject"] = original.get("Subject", "Keepa fixture")
    if original.get("Date"):
        clean["Date"] = original.get("Date")
    clean.set_content(sanitize_text(plain), subtype="plain", charset="utf-8", cte="8bit")
    clean.add_alternative(sanitize_text(html), subtype="html", charset="utf-8", cte="8bit")

    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(clean.as_bytes())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    sanitize_eml(args.source, args.destination)


if __name__ == "__main__":
    main()
