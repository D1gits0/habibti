"""Property-based and example tests for shift engine.

Feature: compound-v2, Property 8: Schedule Shift Algorithm Correctness
**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.8**
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from datetime import date, timedelta

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st

from shift_engine import compute_shift, validate_shift_request

SPLIT_CYCLE = ["Pull", "Push", "Legs", "Rest", "Upper", "Rest", "Lower"]


# --- Strategies ---

dates_strategy = st.dates(min_value=date(2020, 1, 1), max_value=date(2030, 12, 31))


# --- Property 8: Schedule Shift Algorithm Correctness ---


@settings(max_examples=100)
@given(cycle_start=dates_strategy, days_ahead=st.integers(min_value=1, max_value=365))
def test_property_8_shift_correctness(cycle_start, days_ahead):
    """Property 8: Schedule shift algorithm correctness.

    For any valid cycle_start_date and any unavailable_date strictly after today:
    - The cycle_start always shifts back by 1 day (pushing all future days forward by 1).
    - Whether or not a Rest day exists in the remaining range, the shift applies.

    **Validates: Requirements 6.1, 6.8**
    """
    today = cycle_start  # Use cycle_start as "today" for testing purposes
    unavailable = today + timedelta(days=days_ahead)

    new_start = compute_shift(cycle_start, unavailable, SPLIT_CYCLE)

    # Shift always moves cycle_start back by 1 day
    assert new_start == cycle_start - timedelta(days=1), (
        f"Expected cycle_start shifted back by 1 day ({cycle_start - timedelta(days=1)}), "
        f"got {new_start}."
    )



@settings(max_examples=100)
@given(cycle_start=dates_strategy, days_ahead=st.integers(min_value=1, max_value=365))
def test_property_8_shift_always_minus_one(cycle_start, days_ahead):
    """Property 8 sub-property: shift always produces cycle_start - 1 day.

    Regardless of rest days in range, the shift always moves start back by 1.

    **Validates: Requirements 6.1, 6.8**
    """
    unavailable = cycle_start + timedelta(days=days_ahead)
    new_start = compute_shift(cycle_start, unavailable, SPLIT_CYCLE)
    assert new_start == cycle_start - timedelta(days=1)


@settings(max_examples=100)
@given(cycle_start=dates_strategy, days_ahead=st.integers(min_value=1, max_value=365))
def test_property_8_shift_result_is_date(cycle_start, days_ahead):
    """Property 8 sub-property: compute_shift always returns a valid date.

    **Validates: Requirements 6.1, 6.8**
    """
    unavailable = cycle_start + timedelta(days=days_ahead)
    result = compute_shift(cycle_start, unavailable, SPLIT_CYCLE)
    assert isinstance(result, date)


# --- Property: validate_shift_request correctness ---


@settings(max_examples=100)
@given(today=dates_strategy, offset=st.integers(min_value=-365, max_value=365))
def test_validate_shift_request_rejects_today_and_past(today, offset):
    """validate_shift_request rejects today and past dates, accepts future dates.

    **Validates: Requirements 6.4, 6.7**
    """
    target = today + timedelta(days=offset)
    result = validate_shift_request(target, today)

    if offset <= 0:
        # Today or past: should be rejected
        assert result is not None, (
            f"Expected rejection for date {target} (offset={offset} from today={today})"
        )
        assert "future" in result.lower() or "unavailable" in result.lower()
    else:
        # Future: should be accepted
        assert result is None, (
            f"Expected acceptance for future date {target} (offset={offset} from today={today}), "
            f"got error: {result}"
        )


# --- Example-based tests ---


class TestComputeShiftExamples:
    """Example-based tests for compute_shift covering specific scenarios."""

    def test_unavailable_on_day_0_rest_at_day_3(self):
        """When unavailable is on Pull (idx 0), shift always applies.

        Remaining indices: [1, 2, 3, 4, 5, 6]
        Rest at idx 3 exists but shift always moves back by 1.
        """
        cycle_start = date(2024, 1, 1)  # Monday = Pull (idx 0)
        unavailable = date(2024, 1, 1)  # Same day -> idx 0
        result = compute_shift(cycle_start, unavailable, SPLIT_CYCLE)
        assert result == cycle_start - timedelta(days=1)

    def test_unavailable_on_day_5_no_rest_in_remaining(self):
        """When unavailable is on Rest (idx 5), remaining is just [6]=Lower.

        Shift back by 1.
        """
        cycle_start = date(2024, 1, 1)
        unavailable = date(2024, 1, 6)  # idx = 5
        result = compute_shift(cycle_start, unavailable, SPLIT_CYCLE)
        assert result == cycle_start - timedelta(days=1)

    def test_unavailable_on_day_6_empty_remaining(self):
        """When unavailable is on Lower (idx 6), remaining is empty [].

        Shift back by 1.
        """
        cycle_start = date(2024, 1, 1)
        unavailable = date(2024, 1, 7)  # idx = 6
        result = compute_shift(cycle_start, unavailable, SPLIT_CYCLE)
        assert result == cycle_start - timedelta(days=1)

    def test_unavailable_on_day_2(self):
        """When unavailable is on Legs (idx 2), shift back by 1."""
        cycle_start = date(2024, 1, 1)
        unavailable = date(2024, 1, 3)  # idx 2
        result = compute_shift(cycle_start, unavailable, SPLIT_CYCLE)
        assert result == cycle_start - timedelta(days=1)

    def test_unavailable_on_day_3(self):
        """When unavailable is on Rest (idx 3), shift back by 1."""
        cycle_start = date(2024, 1, 1)
        unavailable = date(2024, 1, 4)  # idx 3
        result = compute_shift(cycle_start, unavailable, SPLIT_CYCLE)
        assert result == cycle_start - timedelta(days=1)

    def test_unavailable_on_day_4(self):
        """When unavailable is on Upper (idx 4), shift back by 1."""
        cycle_start = date(2024, 1, 1)
        unavailable = date(2024, 1, 5)  # idx 4
        result = compute_shift(cycle_start, unavailable, SPLIT_CYCLE)
        assert result == cycle_start - timedelta(days=1)

    def test_unavailable_far_future_wraps_correctly(self):
        """Shift works correctly when unavailable_date is many cycles away."""
        cycle_start = date(2024, 1, 1)
        # 14 days ahead -> idx = 14 % 7 = 0 (Pull)
        unavailable = date(2024, 1, 15)
        result = compute_shift(cycle_start, unavailable, SPLIT_CYCLE)
        assert result == cycle_start - timedelta(days=1)

    def test_shift_with_different_cycle_start(self):
        """Shift works with a non-January-1 cycle start."""
        cycle_start = date(2024, 6, 15)
        unavailable = date(2024, 6, 21)  # idx 6
        result = compute_shift(cycle_start, unavailable, SPLIT_CYCLE)
        assert result == cycle_start - timedelta(days=1)


class TestValidateShiftRequestExamples:
    """Example-based tests for validate_shift_request."""

    def test_rejects_today(self):
        """Today should be rejected."""
        today = date(2024, 3, 15)
        result = validate_shift_request(today, today)
        assert result is not None

    def test_rejects_past_date(self):
        """A past date should be rejected."""
        today = date(2024, 3, 15)
        past = date(2024, 3, 10)
        result = validate_shift_request(past, today)
        assert result is not None

    def test_accepts_tomorrow(self):
        """Tomorrow should be accepted."""
        today = date(2024, 3, 15)
        tomorrow = date(2024, 3, 16)
        result = validate_shift_request(tomorrow, today)
        assert result is None

    def test_accepts_far_future(self):
        """A date far in the future should be accepted."""
        today = date(2024, 3, 15)
        future = date(2025, 1, 1)
        result = validate_shift_request(future, today)
        assert result is None

    def test_rejects_yesterday(self):
        """Yesterday should be rejected."""
        today = date(2024, 3, 15)
        yesterday = date(2024, 3, 14)
        result = validate_shift_request(yesterday, today)
        assert result is not None
