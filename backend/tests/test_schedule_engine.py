"""Property-based and example tests for schedule engine.

Feature: compound-v2, Property 6: Day_Type Computation via Modulo Arithmetic
**Validates: Requirements 4.3**
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from datetime import date, timedelta

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from schedule_engine import get_day_type, get_day_index, SPLIT_CYCLE


# --- Strategies ---

dates_strategy = st.dates(min_value=date(2020, 1, 1), max_value=date(2030, 12, 31))


# --- Property 6: Day_Type Computation via Modulo Arithmetic ---


@settings(max_examples=100)
@given(cycle_start=dates_strategy, query=dates_strategy)
def test_property_6_day_type_modulo(cycle_start, query):
    """Property 6: Day_Type computation via modulo arithmetic.

    For any valid cycle_start_date and any query_date (past, present, or future),
    the computed day_index SHALL equal (query_date - cycle_start_date).days % 7
    and the returned Day_Type SHALL equal SPLIT_CYCLE[day_index] where
    SPLIT_CYCLE = [Pull, Push, Legs, Rest, Upper, Rest, Lower].

    **Validates: Requirements 4.3**
    """
    expected_index = (query - cycle_start).days % 7
    assert get_day_index(cycle_start, query) == expected_index
    assert get_day_type(cycle_start, query) == SPLIT_CYCLE[expected_index]


# --- Additional property tests ---


@settings(max_examples=100)
@given(cycle_start=dates_strategy)
def test_same_day_query_returns_day_index_0(cycle_start):
    """When query_date equals cycle_start_date, day_index is 0.

    **Validates: Requirements 4.3**
    """
    assert get_day_index(cycle_start, cycle_start) == 0
    assert get_day_type(cycle_start, cycle_start) == SPLIT_CYCLE[0]


@settings(max_examples=100)
@given(cycle_start=dates_strategy, query=dates_strategy)
def test_consecutive_days_have_consecutive_indices(cycle_start, query):
    """Consecutive days have consecutive indices (mod 7).

    **Validates: Requirements 4.3**
    """
    idx_today = get_day_index(cycle_start, query)
    idx_tomorrow = get_day_index(cycle_start, query + timedelta(days=1))
    assert idx_tomorrow == (idx_today + 1) % 7


# --- Feature: compound-v3, Property 1: Split cycle day type computation ---


@settings(max_examples=100)
@given(
    cycle_start=dates_strategy,
    days_offset=st.integers(min_value=0, max_value=365),
)
def test_property_1_split_cycle_day_type_computation(cycle_start, days_offset):
    """Property 1: Split cycle day type computation.

    For any valid cycle_start_date and query_date (where query_date >= cycle_start_date),
    get_day_type(cycle_start_date, query_date) SHALL return
    SPLIT_CYCLE[(query_date - cycle_start_date).days % 7].

    Feature: compound-v3, Property 1: Split cycle day type computation
    **Validates: Requirements 2.5**
    """
    query_date = cycle_start + timedelta(days=days_offset)
    expected_index = (query_date - cycle_start).days % 7
    expected_day_type = SPLIT_CYCLE[expected_index]
    actual_day_type = get_day_type(cycle_start, query_date)
    assert actual_day_type == expected_day_type
