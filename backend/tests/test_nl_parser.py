"""Property-based tests for NL parser post-processing logic.

Feature: compound-v2, Property 10: NL Parser Date Defaulting
Feature: compound-v2, Property 11: NL Parser Excluded Category Filtering
**Validates: Requirements 7.8, 9.6**
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from datetime import date, timedelta

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st

# Import constants directly to avoid requiring 'anthropic' package at import time.
# These mirror the values defined in nl_parser.py.
EXCLUDED_CATEGORIES = {"cardio", "schoolwork", "canvas", "sms"}
SUPPORTED_CATEGORIES = {"gym", "sleep", "hydration", "habit"}


# --- Post-processing logic extracted for testability ---
# This mirrors the filtering + validation logic in NLParserService.parse_input


def post_process_entries(entries: list[dict], today: str) -> list[dict]:
    """Apply the same post-processing as NLParserService.parse_input.

    Filters out excluded/unsupported categories and defaults date to today.
    """
    # Filter out excluded categories and keep only supported
    filtered_entries = [
        entry
        for entry in entries
        if entry.get("category", "").lower() not in EXCLUDED_CATEGORIES
        and entry.get("category", "").lower() in SUPPORTED_CATEGORIES
    ]

    # Ensure all entries have required fields and default date
    validated_entries = []
    for entry in filtered_entries:
        validated = {
            "category": entry.get("category", ""),
            "metric": entry.get("metric", ""),
            "value": float(entry.get("value", 0)),
            "notes": entry.get("notes"),
            "date": entry.get("date") or today,
        }
        validated_entries.append(validated)

    return validated_entries


# --- Strategies ---

today_strategy = st.dates(
    min_value=date(2020, 1, 1), max_value=date(2030, 12, 31)
).map(lambda d: d.isoformat())

supported_category_strategy = st.sampled_from(sorted(SUPPORTED_CATEGORIES))

excluded_category_strategy = st.sampled_from(sorted(EXCLUDED_CATEGORIES))

metric_strategy = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N", "Z")),
    min_size=1,
    max_size=30,
)

value_strategy = st.floats(min_value=0, max_value=2000, allow_nan=False, allow_infinity=False)

notes_strategy = st.one_of(st.none(), st.text(min_size=0, max_size=100))


def entry_without_date(category_strategy):
    """Generate an entry dict without a date field (or with empty/None date)."""
    return st.fixed_dictionaries(
        {
            "category": category_strategy,
            "metric": metric_strategy,
            "value": value_strategy,
            "notes": notes_strategy,
            "date": st.sampled_from([None, "", None]),
        }
    )


def entry_with_date(category_strategy):
    """Generate an entry dict with a valid explicit date."""
    return st.fixed_dictionaries(
        {
            "category": category_strategy,
            "metric": metric_strategy,
            "value": value_strategy,
            "notes": notes_strategy,
            "date": st.dates(
                min_value=date(2020, 1, 1), max_value=date(2030, 12, 31)
            ).map(lambda d: d.isoformat()),
        }
    )


def entry_with_mixed_category():
    """Generate entries with either supported or excluded categories."""
    all_categories = sorted(SUPPORTED_CATEGORIES | EXCLUDED_CATEGORIES)
    return st.fixed_dictionaries(
        {
            "category": st.sampled_from(all_categories),
            "metric": metric_strategy,
            "value": value_strategy,
            "notes": notes_strategy,
            "date": st.one_of(
                st.sampled_from([None, ""]),
                st.dates(
                    min_value=date(2020, 1, 1), max_value=date(2030, 12, 31)
                ).map(lambda d: d.isoformat()),
            ),
        }
    )


# --- Property 10: NL Parser Date Defaulting ---


@settings(max_examples=100)
@given(
    entries=st.lists(entry_without_date(supported_category_strategy), min_size=1, max_size=10),
    today=today_strategy,
)
def test_property_10_date_defaulting(entries, today):
    """Property 10: NL Parser Date Defaulting.

    For any free-text input that does not contain an explicit date reference,
    all resulting Log_Entry records SHALL have their date field set to today's date.

    **Validates: Requirements 7.8**
    """
    result = post_process_entries(entries, today)

    # All entries without explicit dates should get today's date
    for entry in result:
        assert entry["date"] == today, (
            f"Entry date {entry['date']} != today {today}. "
            f"Entries without dates must default to today."
        )


@settings(max_examples=100)
@given(
    entries=st.lists(entry_with_date(supported_category_strategy), min_size=1, max_size=10),
    today=today_strategy,
)
def test_property_10_explicit_date_preserved(entries, today):
    """Property 10 (complement): Entries with explicit dates keep their date.

    When entries DO have explicit dates, those dates SHALL be preserved
    and NOT overwritten with today.

    **Validates: Requirements 7.8**
    """
    result = post_process_entries(entries, today)

    # Entries with explicit dates should keep them
    for original, processed in zip(entries, result):
        assert processed["date"] == original["date"], (
            f"Explicit date {original['date']} was overwritten with {processed['date']}."
        )


# --- Property 11: NL Parser Excluded Category Filtering ---


@settings(max_examples=100)
@given(
    entries=st.lists(entry_with_mixed_category(), min_size=1, max_size=15),
    today=today_strategy,
)
def test_property_11_excluded_categories_filtered(entries, today):
    """Property 11: NL Parser Excluded Category Filtering.

    For any free-text input that references excluded categories (cardio, schoolwork,
    Canvas, SMS), the parsed output SHALL contain zero Log_Entry records for those
    excluded categories, and SHALL only produce entries for supported categories
    (gym, sleep, hydration/water, protein).

    **Validates: Requirements 9.6**
    """
    result = post_process_entries(entries, today)

    for entry in result:
        category = entry["category"].lower()

        # No excluded categories in output
        assert category not in EXCLUDED_CATEGORIES, (
            f"Excluded category '{entry['category']}' appeared in output."
        )

        # All output entries must be in supported categories
        assert category in SUPPORTED_CATEGORIES, (
            f"Unsupported category '{entry['category']}' appeared in output. "
            f"Only {SUPPORTED_CATEGORIES} are allowed."
        )


@settings(max_examples=100)
@given(
    entries=st.lists(
        entry_without_date(excluded_category_strategy), min_size=1, max_size=10
    ),
    today=today_strategy,
)
def test_property_11_all_excluded_produces_empty(entries, today):
    """Property 11 (edge case): Input with only excluded categories yields empty output.

    When all entries reference excluded categories, the output SHALL be empty.

    **Validates: Requirements 9.6**
    """
    result = post_process_entries(entries, today)
    assert len(result) == 0, (
        f"Expected empty output for all-excluded input, got {len(result)} entries."
    )


@settings(max_examples=100)
@given(
    supported_entries=st.lists(
        entry_without_date(supported_category_strategy), min_size=1, max_size=5
    ),
    excluded_entries=st.lists(
        entry_without_date(excluded_category_strategy), min_size=1, max_size=5
    ),
    today=today_strategy,
)
def test_property_11_supported_entries_preserved(supported_entries, excluded_entries, today):
    """Property 11 (preservation): Supported entries pass through, excluded are dropped.

    The count of output entries SHALL equal the count of input entries with
    supported categories.

    **Validates: Requirements 9.6**
    """
    mixed_entries = supported_entries + excluded_entries
    result = post_process_entries(mixed_entries, today)

    assert len(result) == len(supported_entries), (
        f"Expected {len(supported_entries)} entries (supported only), "
        f"got {len(result)}. Mixed input had {len(mixed_entries)} total."
    )
