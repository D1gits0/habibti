"""Property-based tests for exercise validation and notes encoding utilities.

Feature: compound-v3, Property 10: Exercise entry validation
Feature: compound-v3, Property 11: Exercise notes field round-trip
Validates: Requirements 6.7, 6.8, 6.12, 6.15
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from hypothesis import given, settings, assume
from hypothesis import strategies as st

from exercise_utils import (
    validate_exercise_entry,
    encode_exercise_notes,
    decode_exercise_notes,
)


# --- Generators ---

# Names: strings of length 0-60 to test both valid and invalid
exercise_names = st.text(min_size=0, max_size=60)

# Weights: floats including valid (multiples of 0.5 in range) and invalid values
# Mix of valid increments and arbitrary floats
exercise_weights = st.one_of(
    # Valid multiples of 0.5 in extended range
    st.integers(min_value=-200, max_value=4000).map(lambda x: x * 0.5),
    # Arbitrary floats that may not be multiples of 0.5
    st.floats(min_value=-200, max_value=4000, allow_nan=False, allow_infinity=False),
)

# Reps: integers including valid (1-100) and invalid values
exercise_reps = st.integers(min_value=-10, max_value=150)

# Failure flag: booleans
failure_flags = st.booleans()


# --- Property 10: Exercise entry validation ---


class TestProperty10ExerciseEntryValidation:
    """Feature: compound-v3, Property 10: Exercise entry validation

    For any exercise entry with fields (name, weight, reps, failure_flag),
    the validator SHALL accept it if and only if:
    len(name.trim()) >= 1 AND len(name) <= 50
    AND reps in [1, 100]
    AND weight in [-100, 2000] (if name == "Pull Ups") or weight in [0, 2000] (otherwise)
    AND weight % 0.5 == 0

    Validates: Requirements 6.7, 6.8, 6.15
    """

    @given(
        name=exercise_names,
        weight=exercise_weights,
        reps=exercise_reps,
        failure_flag=failure_flags,
    )
    @settings(max_examples=100)
    def test_validation_accepts_iff_all_constraints_met(
        self, name, weight, reps, failure_flag
    ):
        """**Validates: Requirements 6.7, 6.8, 6.15**"""
        # Compute expected validity based on the property specification
        name_valid = len(name.strip()) >= 1 and len(name) <= 50
        reps_valid = isinstance(reps, int) and 1 <= reps <= 100

        min_weight = -100 if name == "Pull Ups" else 0
        weight_in_range = min_weight <= weight <= 2000
        weight_increment_valid = round(weight % 0.5, 10) == 0

        weight_valid = weight_in_range and weight_increment_valid

        expected_valid = name_valid and reps_valid and weight_valid

        # Call the validator
        actual_valid, error_msg = validate_exercise_entry(
            name, weight, reps, failure_flag
        )

        # The validator should accept iff all constraints are met
        assert actual_valid == expected_valid, (
            f"Expected valid={expected_valid} but got valid={actual_valid} "
            f"for name={repr(name)}, weight={weight}, reps={reps}, "
            f"failure_flag={failure_flag}. "
            f"name_valid={name_valid}, reps_valid={reps_valid}, "
            f"weight_valid={weight_valid} (in_range={weight_in_range}, "
            f"increment={weight_increment_valid}). Error: {error_msg}"
        )

        # When invalid, there must be an error message
        if not actual_valid:
            assert error_msg is not None

        # When valid, error must be None
        if actual_valid:
            assert error_msg is None

    @given(
        weight=st.integers(min_value=-200, max_value=4000).map(lambda x: x * 0.5),
        reps=st.integers(min_value=1, max_value=100),
        failure_flag=failure_flags,
    )
    @settings(max_examples=100)
    def test_valid_inputs_always_accepted(self, weight, reps, failure_flag):
        """**Validates: Requirements 6.7, 6.8, 6.15**

        With a valid name and valid weight range, entries should always be accepted.
        """
        name = "Bench Press"
        # Constrain weight to valid range for non-Pull-Ups
        assume(0 <= weight <= 2000)

        valid, error = validate_exercise_entry(name, weight, reps, failure_flag)
        assert valid is True, f"Expected valid but got error: {error}"
        assert error is None

    @given(
        weight=st.integers(min_value=-200, max_value=4000).map(lambda x: x * 0.5),
        reps=st.integers(min_value=1, max_value=100),
        failure_flag=failure_flags,
    )
    @settings(max_examples=100)
    def test_pull_ups_accepts_negative_weights(self, weight, reps, failure_flag):
        """**Validates: Requirements 6.7, 6.8, 6.15**

        Pull Ups should accept weights in [-100, 2000].
        """
        assume(-100 <= weight <= 2000)

        valid, error = validate_exercise_entry("Pull Ups", weight, reps, failure_flag)
        assert valid is True, f"Expected valid for Pull Ups but got error: {error}"
        assert error is None


# --- Property 11: Exercise notes field round-trip ---


class TestProperty11ExerciseNotesRoundTrip:
    """Feature: compound-v3, Property 11: Exercise notes field round-trip

    For any valid exercise entry (reps integer, failure_flag boolean, dropset_flag boolean),
    encoding the entry to the notes field format and then decoding it back SHALL produce
    the original reps and flag values.

    Validates: Requirements 6.12
    """

    @given(
        reps=st.integers(min_value=1, max_value=100),
        failure_flag=st.booleans(),
        dropset_flag=st.booleans(),
    )
    @settings(max_examples=100)
    def test_encode_decode_roundtrip(self, reps, failure_flag, dropset_flag):
        """**Validates: Requirements 6.12**"""
        encoded = encode_exercise_notes(reps, failure_flag, dropset_flag)
        decoded = decode_exercise_notes(encoded)

        # Reps always round-trips
        assert decoded["reps"] == reps, (
            f"Reps mismatch: expected {reps}, got {decoded['reps']}. "
            f"Encoded: {repr(encoded)}"
        )

        # Account for precedence rule: when both flags are True, failure takes precedence
        if failure_flag:
            # Failure takes precedence regardless of dropset_flag
            assert decoded["failure_flag"] is True
            assert decoded["dropset_flag"] is False
        elif dropset_flag:
            # Only dropset is set
            assert decoded["failure_flag"] is False
            assert decoded["dropset_flag"] is True
        else:
            # Neither flag set
            assert decoded["failure_flag"] is False
            assert decoded["dropset_flag"] is False

    @given(
        reps=st.integers(min_value=1, max_value=100),
    )
    @settings(max_examples=100)
    def test_no_flags_roundtrip(self, reps):
        """**Validates: Requirements 6.12**

        With no flags, encode/decode produces exact original values.
        """
        encoded = encode_exercise_notes(reps, failure_flag=False, dropset_flag=False)
        decoded = decode_exercise_notes(encoded)

        assert decoded["reps"] == reps
        assert decoded["failure_flag"] is False
        assert decoded["dropset_flag"] is False

    @given(
        reps=st.integers(min_value=1, max_value=100),
    )
    @settings(max_examples=100)
    def test_failure_flag_roundtrip(self, reps):
        """**Validates: Requirements 6.12**

        With failure_flag=True, encode/decode preserves the flag.
        """
        encoded = encode_exercise_notes(reps, failure_flag=True, dropset_flag=False)
        decoded = decode_exercise_notes(encoded)

        assert decoded["reps"] == reps
        assert decoded["failure_flag"] is True
        assert decoded["dropset_flag"] is False

    @given(
        reps=st.integers(min_value=1, max_value=100),
    )
    @settings(max_examples=100)
    def test_dropset_flag_roundtrip(self, reps):
        """**Validates: Requirements 6.12**

        With dropset_flag=True, encode/decode preserves the flag.
        """
        encoded = encode_exercise_notes(reps, failure_flag=False, dropset_flag=True)
        decoded = decode_exercise_notes(encoded)

        assert decoded["reps"] == reps
        assert decoded["failure_flag"] is False
        assert decoded["dropset_flag"] is True
