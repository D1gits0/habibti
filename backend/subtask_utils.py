"""Utility functions for subtask operations."""

import math


def compute_completion_percentage(subtasks: list[dict]) -> int:
    """Calculate the completion percentage for a list of subtasks.

    Formula: floor(done_count / total_count * 100)
    Returns 0 when total_count is 0.

    Args:
        subtasks: A list of dicts, each with a "done" field (bool or int).

    Returns:
        Integer percentage (0-100) representing completion, floored.
    """
    total = len(subtasks)
    if total == 0:
        return 0
    done_count = sum(1 for s in subtasks if s.get("done"))
    return math.floor(done_count / total * 100)
