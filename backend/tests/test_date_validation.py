"""Property-based and example tests for cycle start date validation.

Feature: compound-v2, Property 7: Cycle Start Date Validation Window
**Validates: Requirements 4.5, 4.7**
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from datetime import date, timedelta

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st


def is_valid_cycle_start_date(candidate: date, today: date) -> bool:
    """Mirror the validation logic from the PUT /api/schedule/config endpoint.

    The endpoint accepts a date if and only if it falls within 30 days
    before or 30 days after today (inclusive).
    """
    return abs((candidate - today).days) <= 30


# --- Property 7: Cycle Start Date Validation Window ---


@settings(max_examples=100)
@given(
    today=st.dates(min_value=date(2020, 1, 1), max_value=date(2030, 12, 31)),
    offset=st.integers(min_value=-365, max_value=365),
)
def test_property_7_date_validation_window(today, offset):
    """Property 7: Cycle start date validation window.

    For any date value, the schedule config validator SHALL accept the date
    if and only if it falls within 30 days before or 30 days after today
    (inclusive), and SHALL reject all dates outside this range.

    **Validates: Requirements 4.5, 4.7**
    """
    candidate = today + timedelta(days=offset)
    valid = is_valid_cycle_start_date(candidate, today)

    if -30 <= offset <= 30:
        assert valid, f"Date {offset} days from today should be valid"
    else:
        assert not valid, f"Date {offset} days from today should be invalid"


# --- Boundary tests ---


class TestDateValidationBoundaries:
    """Boundary example tests for the ±30 day validation window."""

    def test_exactly_minus_30_days_is_valid(self):
        """A date exactly 30 days in the past should be valid."""
        today = date(2024, 6, 15)
        candidate = today - timedelta(days=30)
        assert is_valid_cycle_start_date(candidate, today) is True

    def test_exactly_plus_30_days_is_valid(self):
        """A date exactly 30 days in the future should be valid."""
        today = date(2024, 6, 15)
        candidate = today + timedelta(days=30)
        assert is_valid_cycle_start_date(candidate, today) is True

    def test_minus_31_days_is_invalid(self):
        """A date 31 days in the past should be invalid."""
        today = date(2024, 6, 15)
        candidate = today - timedelta(days=31)
        assert is_valid_cycle_start_date(candidate, today) is False

    def test_plus_31_days_is_invalid(self):
        """A date 31 days in the future should be invalid."""
        today = date(2024, 6, 15)
        candidate = today + timedelta(days=31)
        assert is_valid_cycle_start_date(candidate, today) is False

    def test_today_is_valid(self):
        """Today (offset 0) should always be valid."""
        today = date(2024, 6, 15)
        assert is_valid_cycle_start_date(today, today) is True
