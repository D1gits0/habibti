"""Unit tests for exercise validation and notes encoding utilities."""

import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from exercise_utils import (
    validate_exercise_entry,
    encode_exercise_notes,
    decode_exercise_notes,
)


class TestValidateExerciseEntry:
    """Tests for validate_exercise_entry function."""

    def test_valid_basic_entry(self):
        valid, error = validate_exercise_entry("Incline DB Press", 45.0, 8)
        assert valid is True
        assert error is None

    def test_valid_half_increment_weight(self):
        valid, error = validate_exercise_entry("Lateral Raises", 12.5, 12)
        assert valid is True
        assert error is None

    def test_valid_zero_weight(self):
        valid, error = validate_exercise_entry("Pull Ups", 0, 10)
        assert valid is True
        assert error is None

    def test_valid_negative_weight_pull_ups(self):
        valid, error = validate_exercise_entry("Pull Ups", -15, 8)
        assert valid is True
        assert error is None

    def test_valid_max_negative_pull_ups(self):
        valid, error = validate_exercise_entry("Pull Ups", -100, 5)
        assert valid is True
        assert error is None

    def test_valid_max_weight(self):
        valid, error = validate_exercise_entry("Leg Press", 2000, 3)
        assert valid is True
        assert error is None

    def test_valid_min_reps(self):
        valid, error = validate_exercise_entry("Bench Press", 100, 1)
        assert valid is True
        assert error is None

    def test_valid_max_reps(self):
        valid, error = validate_exercise_entry("Calf Raises", 50, 100)
        assert valid is True
        assert error is None

    def test_invalid_empty_name(self):
        valid, error = validate_exercise_entry("", 50, 8)
        assert valid is False
        assert error is not None

    def test_invalid_whitespace_name(self):
        valid, error = validate_exercise_entry("   ", 50, 8)
        assert valid is False
        assert error is not None

    def test_invalid_name_too_long(self):
        valid, error = validate_exercise_entry("A" * 51, 50, 8)
        assert valid is False
        assert "50 characters" in error

    def test_valid_name_exactly_50_chars(self):
        valid, error = validate_exercise_entry("A" * 50, 50, 8)
        assert valid is True
        assert error is None

    def test_invalid_reps_zero(self):
        valid, error = validate_exercise_entry("Bench", 50, 0)
        assert valid is False
        assert "Reps" in error

    def test_invalid_reps_negative(self):
        valid, error = validate_exercise_entry("Bench", 50, -1)
        assert valid is False
        assert "Reps" in error

    def test_invalid_reps_too_high(self):
        valid, error = validate_exercise_entry("Bench", 50, 101)
        assert valid is False
        assert "Reps" in error

    def test_invalid_negative_weight_non_pullups(self):
        valid, error = validate_exercise_entry("Bench Press", -5, 8)
        assert valid is False
        assert "Weight" in error

    def test_invalid_weight_too_high(self):
        valid, error = validate_exercise_entry("Bench Press", 2001, 8)
        assert valid is False
        assert "Weight" in error

    def test_invalid_weight_not_half_increment(self):
        valid, error = validate_exercise_entry("Bench Press", 45.3, 8)
        assert valid is False
        assert "increments of 0.5" in error

    def test_invalid_weight_quarter_increment(self):
        valid, error = validate_exercise_entry("Bench Press", 45.25, 8)
        assert valid is False
        assert "increments of 0.5" in error

    def test_valid_with_failure_flag(self):
        valid, error = validate_exercise_entry("Bench Press", 100, 6, failure_flag=True)
        assert valid is True
        assert error is None


class TestEncodeExerciseNotes:
    """Tests for encode_exercise_notes function."""

    def test_encode_normal_set(self):
        result = encode_exercise_notes(8)
        assert result == "8r"

    def test_encode_failure_set(self):
        result = encode_exercise_notes(8, failure_flag=True)
        assert result == "failure:true|8r"

    def test_encode_dropset(self):
        result = encode_exercise_notes(6, dropset_flag=True)
        assert result == "dropset:true|6r"

    def test_encode_failure_takes_precedence_over_dropset(self):
        result = encode_exercise_notes(8, failure_flag=True, dropset_flag=True)
        assert result == "failure:true|8r"

    def test_encode_single_rep(self):
        result = encode_exercise_notes(1)
        assert result == "1r"

    def test_encode_max_reps(self):
        result = encode_exercise_notes(100)
        assert result == "100r"


class TestDecodeExerciseNotes:
    """Tests for decode_exercise_notes function."""

    def test_decode_normal_set(self):
        result = decode_exercise_notes("8r")
        assert result == {"reps": 8, "failure_flag": False, "dropset_flag": False}

    def test_decode_failure_set(self):
        result = decode_exercise_notes("failure:true|8r")
        assert result == {"reps": 8, "failure_flag": True, "dropset_flag": False}

    def test_decode_dropset(self):
        result = decode_exercise_notes("dropset:true|6r")
        assert result == {"reps": 6, "failure_flag": False, "dropset_flag": True}

    def test_decode_single_rep(self):
        result = decode_exercise_notes("1r")
        assert result == {"reps": 1, "failure_flag": False, "dropset_flag": False}

    def test_decode_max_reps(self):
        result = decode_exercise_notes("100r")
        assert result == {"reps": 100, "failure_flag": False, "dropset_flag": False}

    def test_decode_empty_string(self):
        result = decode_exercise_notes("")
        assert result["reps"] is None
        assert result["failure_flag"] is False
        assert result["dropset_flag"] is False

    def test_decode_none(self):
        result = decode_exercise_notes(None)
        assert result["reps"] is None


class TestNotesRoundTrip:
    """Tests for encode/decode round-trip correctness."""

    def test_roundtrip_normal(self):
        encoded = encode_exercise_notes(8, failure_flag=False, dropset_flag=False)
        decoded = decode_exercise_notes(encoded)
        assert decoded["reps"] == 8
        assert decoded["failure_flag"] is False
        assert decoded["dropset_flag"] is False

    def test_roundtrip_failure(self):
        encoded = encode_exercise_notes(12, failure_flag=True, dropset_flag=False)
        decoded = decode_exercise_notes(encoded)
        assert decoded["reps"] == 12
        assert decoded["failure_flag"] is True
        assert decoded["dropset_flag"] is False

    def test_roundtrip_dropset(self):
        encoded = encode_exercise_notes(6, failure_flag=False, dropset_flag=True)
        decoded = decode_exercise_notes(encoded)
        assert decoded["reps"] == 6
        assert decoded["failure_flag"] is False
        assert decoded["dropset_flag"] is True
