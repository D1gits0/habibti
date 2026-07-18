"""Property-based tests for subtask logic.

Feature: compound-v3
Tests Properties 2-7 from the design document.
"""
import math
import pytest
from hypothesis import given, settings, assume, HealthCheck
from hypothesis import strategies as st
from fastapi.testclient import TestClient

from main import app
from database import init_db
from subtask_utils import compute_completion_percentage


# ─── Fixtures ────────────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def setup_db(tmp_path, monkeypatch):
    """Use a temporary database for each test."""
    db_path = str(tmp_path / "test.db")
    monkeypatch.setattr("database.DB_PATH", db_path)
    monkeypatch.setattr("main.DB_PATH", db_path, raising=False)
    init_db()
    yield


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def project(client):
    """Create a project (thread) to attach subtasks to."""
    resp = client.post("/api/threads", json={"name": "Test Project", "category": "test"})
    assert resp.status_code == 201
    return resp.json()


def _make_project(client):
    """Helper to create a fresh project for each Hypothesis iteration."""
    resp = client.post("/api/threads", json={"name": "Test Project", "category": "test"})
    assert resp.status_code == 201
    return resp.json()


# ─── Strategies ──────────────────────────────────────────────────────────────────


# Valid subtask descriptions: 1-300 chars with at least one non-whitespace
valid_descriptions = st.text(
    alphabet=st.characters(categories=("L", "N", "P", "S", "Z")),
    min_size=1,
    max_size=300,
).filter(lambda s: len(s.strip()) > 0)

# Invalid descriptions: empty, whitespace-only, or > 300 chars
invalid_descriptions_empty = st.just("")
invalid_descriptions_whitespace = st.text(
    alphabet=st.just(" "),
    min_size=1,
    max_size=50,
)
invalid_descriptions_too_long = st.text(
    alphabet=st.characters(categories=("L", "N")),
    min_size=301,
    max_size=400,
)


# ─── Property 2: Subtask nesting depth enforcement ───────────────────────────────


class TestProperty2NestingDepth:
    """Feature: compound-v3, Property 2: Subtask nesting depth enforcement

    The system SHALL never allow a subtask to exist at a nesting depth greater
    than 2 (where a root subtask is depth 1 and its child is depth 2).

    **Validates: Requirements 4.3, 4.4**
    """

    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @given(
        num_roots=st.integers(min_value=1, max_value=5),
        num_children=st.integers(min_value=1, max_value=3),
        attempt_grandchild=st.booleans(),
    )
    def test_nesting_depth_never_exceeds_2(
        self, client, num_roots, num_children, attempt_grandchild
    ):
        """Build random subtask trees and verify depth never exceeds 2."""
        project = _make_project(client)
        # Create root-level subtasks
        root_ids = []
        for i in range(num_roots):
            resp = client.post(
                f"/api/threads/{project['id']}/subtasks",
                json={"description": f"Root {i}"},
            )
            assert resp.status_code == 201
            root_ids.append(resp.json()["id"])

        # Create children (depth 2) under a random root
        child_ids = []
        for i in range(num_children):
            parent_id = root_ids[i % len(root_ids)]
            resp = client.post(
                f"/api/threads/{project['id']}/subtasks",
                json={"description": f"Child {i}", "parent_subtask_id": parent_id},
            )
            assert resp.status_code == 201
            child_ids.append(resp.json()["id"])

        # Attempt to create grandchildren (depth 3) — must be rejected
        if attempt_grandchild and child_ids:
            for child_id in child_ids:
                resp = client.post(
                    f"/api/threads/{project['id']}/subtasks",
                    json={
                        "description": "Grandchild attempt",
                        "parent_subtask_id": child_id,
                    },
                )
                assert resp.status_code == 422
                assert "Maximum nesting depth" in resp.json()["detail"]

        # Final verification: list all subtasks and confirm no depth > 2
        all_subtasks = client.get(
            f"/api/threads/{project['id']}/subtasks"
        ).json()["subtasks"]
        for subtask in all_subtasks:
            if subtask["parent_subtask_id"] is not None:
                # This subtask has a parent — find the parent
                parent = next(
                    (s for s in all_subtasks if s["id"] == subtask["parent_subtask_id"]),
                    None,
                )
                if parent is not None:
                    # Parent must be a root (no grandparent allowed)
                    assert parent["parent_subtask_id"] is None, (
                        f"Subtask {subtask['id']} is at depth > 2"
                    )


# ─── Property 3: Subtask description validation ─────────────────────────────────


class TestProperty3DescriptionValidation:
    """Feature: compound-v3, Property 3: Subtask description validation

    Subtask creation SHALL be accepted if and only if s has at least one
    non-whitespace character and len(s) <= 300.

    **Validates: Requirements 4.5**
    """

    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @given(description=valid_descriptions)
    def test_valid_descriptions_accepted(self, client, description):
        """Valid descriptions (1-300 chars, non-whitespace) are accepted."""
        project = _make_project(client)
        resp = client.post(
            f"/api/threads/{project['id']}/subtasks",
            json={"description": description},
        )
        assert resp.status_code == 201, (
            f"Expected 201 for valid description '{description[:50]}...', got {resp.status_code}: {resp.json()}"
        )

    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @given(description=invalid_descriptions_whitespace)
    def test_whitespace_only_rejected(self, client, description):
        """Whitespace-only descriptions are rejected."""
        project = _make_project(client)
        resp = client.post(
            f"/api/threads/{project['id']}/subtasks",
            json={"description": description},
        )
        assert resp.status_code == 422, (
            f"Expected 422 for whitespace-only description, got {resp.status_code}"
        )

    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @given(description=invalid_descriptions_too_long)
    def test_too_long_descriptions_rejected(self, client, description):
        """Descriptions exceeding 300 characters are rejected."""
        project = _make_project(client)
        resp = client.post(
            f"/api/threads/{project['id']}/subtasks",
            json={"description": description},
        )
        assert resp.status_code == 422, (
            f"Expected 422 for {len(description)}-char description, got {resp.status_code}"
        )

    def test_empty_string_rejected(self, client, project):
        """Empty string description is rejected."""
        resp = client.post(
            f"/api/threads/{project['id']}/subtasks",
            json={"description": ""},
        )
        assert resp.status_code == 422


# ─── Property 4: Subtask reorder preserves integrity ─────────────────────────────


class TestProperty4ReorderIntegrity:
    """Feature: compound-v3, Property 4: Subtask reorder preserves integrity

    Resulting sort_order values SHALL be unique within that parent scope
    and the set of subtask IDs SHALL be unchanged.

    **Validates: Requirements 4.6**
    """

    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @given(num_subtasks=st.integers(min_value=2, max_value=10))
    def test_reorder_preserves_ids_and_unique_sort_orders(
        self, client, num_subtasks
    ):
        """After reorder, IDs are unchanged and sort_orders are unique."""
        project = _make_project(client)
        # Create subtasks
        created_ids = []
        for i in range(num_subtasks):
            resp = client.post(
                f"/api/threads/{project['id']}/subtasks",
                json={"description": f"Task {i}"},
            )
            assert resp.status_code == 201
            created_ids.append(resp.json()["id"])

        original_id_set = set(created_ids)

        # Generate a new unique sort_order assignment (reversed)
        reorder_items = [
            {"id": created_ids[i], "sort_order": num_subtasks - 1 - i}
            for i in range(num_subtasks)
        ]

        resp = client.put(
            f"/api/threads/{project['id']}/subtasks/reorder",
            json={"items": reorder_items},
        )
        assert resp.status_code == 200

        # Verify: list subtasks and check invariants
        listing = client.get(f"/api/threads/{project['id']}/subtasks").json()["subtasks"]
        result_ids = {s["id"] for s in listing}
        result_sort_orders = [s["sort_order"] for s in listing]

        # IDs unchanged
        assert result_ids == original_id_set, "Subtask IDs changed after reorder"
        # sort_orders are unique
        assert len(result_sort_orders) == len(set(result_sort_orders)), (
            "sort_order values are not unique after reorder"
        )


# ─── Property 5: Subtask insertion assigns next sort_order ───────────────────────


class TestProperty5InsertionSortOrder:
    """Feature: compound-v3, Property 5: Subtask insertion assigns next sort_order

    New subtask SHALL get max(existing) + 1, or 0 if no siblings.

    **Validates: Requirements 4.7**
    """

    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @given(num_existing=st.integers(min_value=0, max_value=10))
    def test_new_subtask_gets_next_sort_order(self, client, num_existing):
        """Each new subtask gets the next sequential sort_order."""
        project = _make_project(client)
        # Create existing subtasks
        for i in range(num_existing):
            resp = client.post(
                f"/api/threads/{project['id']}/subtasks",
                json={"description": f"Existing {i}"},
            )
            assert resp.status_code == 201

        # Create one more — should get sort_order = num_existing
        resp = client.post(
            f"/api/threads/{project['id']}/subtasks",
            json={"description": "New one"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["sort_order"] == num_existing, (
            f"Expected sort_order {num_existing}, got {data['sort_order']}"
        )

    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @given(num_existing=st.integers(min_value=0, max_value=5))
    def test_child_subtask_gets_next_sort_order(self, client, num_existing):
        """Child subtasks get sequential sort_order within their parent scope."""
        project = _make_project(client)
        # Create parent
        parent_resp = client.post(
            f"/api/threads/{project['id']}/subtasks",
            json={"description": "Parent"},
        )
        assert parent_resp.status_code == 201
        parent_id = parent_resp.json()["id"]

        # Create existing children
        for i in range(num_existing):
            resp = client.post(
                f"/api/threads/{project['id']}/subtasks",
                json={"description": f"Child {i}", "parent_subtask_id": parent_id},
            )
            assert resp.status_code == 201

        # Create one more child — should get sort_order = num_existing
        resp = client.post(
            f"/api/threads/{project['id']}/subtasks",
            json={"description": "New child", "parent_subtask_id": parent_id},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["sort_order"] == num_existing, (
            f"Expected child sort_order {num_existing}, got {data['sort_order']}"
        )


# ─── Property 6: Cascade deletion removes all descendants ───────────────────────


class TestProperty6CascadeDeletion:
    """Feature: compound-v3, Property 6: Cascade deletion removes all descendants

    After deletion, the deleted node and all descendants SHALL no longer exist.

    **Validates: Requirements 4.8**
    """

    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @given(
        num_roots=st.integers(min_value=1, max_value=4),
        children_per_root=st.integers(min_value=0, max_value=4),
        delete_root_index=st.integers(min_value=0, max_value=100),
    )
    def test_cascade_delete_removes_all_descendants(
        self, client, num_roots, children_per_root, delete_root_index
    ):
        """Deleting a root removes it and all its children."""
        project = _make_project(client)
        # Create roots
        roots = []
        for i in range(num_roots):
            resp = client.post(
                f"/api/threads/{project['id']}/subtasks",
                json={"description": f"Root {i}"},
            )
            assert resp.status_code == 201
            roots.append(resp.json())

        # Create children for each root
        all_children = {}  # root_id -> list of child ids
        for root in roots:
            children = []
            for j in range(children_per_root):
                resp = client.post(
                    f"/api/threads/{project['id']}/subtasks",
                    json={
                        "description": f"Child {j} of {root['id']}",
                        "parent_subtask_id": root["id"],
                    },
                )
                assert resp.status_code == 201
                children.append(resp.json()["id"])
            all_children[root["id"]] = children

        # Pick a root to delete
        target_index = delete_root_index % num_roots
        target_root = roots[target_index]
        target_children = all_children[target_root["id"]]

        # Delete the target root
        resp = client.delete(f"/api/subtasks/{target_root['id']}")
        assert resp.status_code == 204

        # Verify: list all remaining subtasks
        listing = client.get(f"/api/threads/{project['id']}/subtasks").json()["subtasks"]
        remaining_ids = {s["id"] for s in listing}

        # The deleted root and all its children must not exist
        assert target_root["id"] not in remaining_ids, (
            f"Deleted root {target_root['id']} still exists"
        )
        for child_id in target_children:
            assert child_id not in remaining_ids, (
                f"Child {child_id} of deleted root still exists"
            )

        # Other roots and their children should still exist
        for i, root in enumerate(roots):
            if i == target_index:
                continue
            assert root["id"] in remaining_ids, (
                f"Unrelated root {root['id']} was incorrectly deleted"
            )
            for child_id in all_children[root["id"]]:
                assert child_id in remaining_ids, (
                    f"Unrelated child {child_id} was incorrectly deleted"
                )


# ─── Property 7: Completion percentage calculation ───────────────────────────────


class TestProperty7CompletionPercentage:
    """Feature: compound-v3, Property 7: Completion percentage calculation

    floor(count(done=true) / count(total) * 100), 0 when total is 0.

    **Validates: Requirements 4.10, 4.13**
    """

    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @given(done_flags=st.lists(st.booleans(), min_size=0, max_size=100))
    def test_completion_percentage_matches_formula(self, done_flags):
        """Completion percentage matches floor(done/total * 100), 0 for empty."""
        subtasks = [{"done": flag} for flag in done_flags]
        result = compute_completion_percentage(subtasks)

        total = len(done_flags)
        if total == 0:
            expected = 0
        else:
            done_count = sum(1 for f in done_flags if f)
            expected = math.floor(done_count / total * 100)

        assert result == expected, (
            f"Expected {expected}%, got {result}% "
            f"(done={sum(done_flags)}, total={total})"
        )

    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @given(done_flags=st.lists(st.booleans(), min_size=1, max_size=100))
    def test_completion_percentage_range(self, done_flags):
        """Result is always in [0, 100]."""
        subtasks = [{"done": flag} for flag in done_flags]
        result = compute_completion_percentage(subtasks)
        assert 0 <= result <= 100

    def test_completion_percentage_empty_returns_zero(self):
        """Empty list returns 0."""
        assert compute_completion_percentage([]) == 0

    def test_completion_percentage_all_done(self):
        """All done returns 100."""
        subtasks = [{"done": True} for _ in range(10)]
        assert compute_completion_percentage(subtasks) == 100

    def test_completion_percentage_none_done(self):
        """None done returns 0."""
        subtasks = [{"done": False} for _ in range(10)]
        assert compute_completion_percentage(subtasks) == 0
