"""Utility functions for exercise entry validation and notes field encoding/decoding."""

from typing import Optional


def validate_exercise_entry(
    name: str, weight: float, reps: int, failure_flag: bool = False
) -> tuple[bool, Optional[str]]:
    """Validate an exercise entry.

    Rules:
    - name: trimmed length >= 1, total length <= 50
    - reps: integer in [1, 100]
    - weight: in [0, 2000] for most exercises, [-100, 2000] for "Pull Ups"
    - weight must be in increments of 0.5 (i.e., weight % 0.5 == 0)

    Args:
        name: Exercise name.
        weight: Weight in lbs (float).
        reps: Number of reps (integer).
        failure_flag: Whether this is a failure set (not used in validation logic).

    Returns:
        Tuple of (is_valid, error_message). error_message is None when valid.
    """
    # Name validation
    if not name or len(name.strip()) < 1:
        return False, "Exercise name must be 50 characters or fewer"
    if len(name) > 50:
        return False, "Exercise name must be 50 characters or fewer"

    # Reps validation
    if not isinstance(reps, int) or reps < 1 or reps > 100:
        return False, "Reps must be between 1 and 100"

    # Weight range validation
    min_weight = -100 if name == "Pull Ups" else 0
    if weight < min_weight or weight > 2000:
        if name == "Pull Ups":
            return False, "Weight must be between -100 and 2000 (or -100 to 2000 for Pull Ups)"
        else:
            return False, "Weight must be between 0 and 2000 (or -100 to 2000 for Pull Ups)"

    # Weight increment validation (must be multiple of 0.5)
    # Use round to avoid floating point issues
    if round(weight % 0.5, 10) != 0:
        return False, "Weight must be in increments of 0.5"

    return True, None


def encode_exercise_notes(
    reps: int, failure_flag: bool = False, dropset_flag: bool = False
) -> str:
    """Encode exercise entry data into the notes field format.

    Format: "[flags]|{reps}r" where flags are optional.
    - Normal set: "8r"
    - Failure set: "failure:true|8r"
    - Drop set: "dropset:true|6r"

    Only one flag (failure or dropset) should be set at a time.
    If both are set, failure takes precedence.

    Args:
        reps: Number of reps (integer).
        failure_flag: Whether this was a failure set.
        dropset_flag: Whether this was a drop set.

    Returns:
        Encoded notes string.
    """
    reps_part = f"{reps}r"

    if failure_flag:
        return f"failure:true|{reps_part}"
    elif dropset_flag:
        return f"dropset:true|{reps_part}"
    else:
        return reps_part


def decode_exercise_notes(notes_string: str) -> dict:
    """Decode a notes field string back into exercise entry data.

    Parses the format: "[flags]|{reps}r"

    Args:
        notes_string: The encoded notes string.

    Returns:
        Dict with keys: reps (int), failure_flag (bool), dropset_flag (bool).
        Returns None values if parsing fails.
    """
    if not notes_string:
        return {"reps": None, "failure_flag": False, "dropset_flag": False}

    failure_flag = False
    dropset_flag = False
    reps_str = notes_string

    # Check for flag prefix
    if "|" in notes_string:
        parts = notes_string.split("|", 1)
        flag_part = parts[0]
        reps_str = parts[1]

        if flag_part == "failure:true":
            failure_flag = True
        elif flag_part == "dropset:true":
            dropset_flag = True

    # Parse reps (remove trailing 'r')
    if reps_str.endswith("r"):
        try:
            reps = int(reps_str[:-1])
        except ValueError:
            reps = None
    else:
        reps = None

    return {"reps": reps, "failure_flag": failure_flag, "dropset_flag": dropset_flag}
