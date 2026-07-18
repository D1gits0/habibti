"""Tests for compute_completion_percentage utility."""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from subtask_utils import compute_completion_percentage


class TestComputeCompletionPercentage:
    """Unit tests for completion percentage calculation."""

    def test_empty_list_returns_zero(self):
        assert compute_completion_percentage([]) == 0

    def test_all_done(self):
        subtasks = [{"done": True}, {"done": True}, {"done": True}]
        assert compute_completion_percentage(subtasks) == 100

    def test_none_done(self):
        subtasks = [{"done": False}, {"done": False}, {"done": False}]
        assert compute_completion_percentage(subtasks) == 0

    def test_partial_done_floors_result(self):
        # 1 out of 3 = 33.33... -> floor to 33
        subtasks = [{"done": True}, {"done": False}, {"done": False}]
        assert compute_completion_percentage(subtasks) == 33

    def test_two_thirds_done_floors(self):
        # 2 out of 3 = 66.66... -> floor to 66
        subtasks = [{"done": True}, {"done": True}, {"done": False}]
        assert compute_completion_percentage(subtasks) == 66

    def test_half_done(self):
        subtasks = [{"done": True}, {"done": False}]
        assert compute_completion_percentage(subtasks) == 50

    def test_single_done(self):
        subtasks = [{"done": True}]
        assert compute_completion_percentage(subtasks) == 100

    def test_single_not_done(self):
        subtasks = [{"done": False}]
        assert compute_completion_percentage(subtasks) == 0

    def test_done_as_int_truthy(self):
        # Support done as integer (1/0) from SQLite
        subtasks = [{"done": 1}, {"done": 0}, {"done": 1}]
        assert compute_completion_percentage(subtasks) == 66

    def test_large_list(self):
        # 7 out of 10 = 70
        subtasks = [{"done": True}] * 7 + [{"done": False}] * 3
        assert compute_completion_percentage(subtasks) == 70
