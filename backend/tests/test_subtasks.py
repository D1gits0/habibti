"""Unit tests for subtask CRUD endpoints."""
import pytest
from fastapi.testclient import TestClient

from main import app
from database import init_db, get_db, DB_PATH
import os


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


class TestListSubtasks:
    def test_list_empty(self, client, project):
        resp = client.get(f"/api/threads/{project['id']}/subtasks")
        assert resp.status_code == 200
        data = resp.json()
        assert data["subtasks"] == []
        assert data["completion_percentage"] == 0

    def test_project_not_found(self, client):
        resp = client.get("/api/threads/9999/subtasks")
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Project not found"


class TestCreateSubtask:
    def test_create_root_subtask(self, client, project):
        resp = client.post(
            f"/api/threads/{project['id']}/subtasks",
            json={"description": "First subtask"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["description"] == "First subtask"
        assert data["done"] is False
        assert data["sort_order"] == 0
        assert data["parent_subtask_id"] is None
        assert data["thread_id"] == project["id"]

    def test_create_child_subtask(self, client, project):
        # Create root
        root = client.post(
            f"/api/threads/{project['id']}/subtasks",
            json={"description": "Root"},
        ).json()
        # Create child
        resp = client.post(
            f"/api/threads/{project['id']}/subtasks",
            json={"description": "Child", "parent_subtask_id": root["id"]},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["parent_subtask_id"] == root["id"]
        assert data["sort_order"] == 0

    def test_nesting_depth_rejected(self, client, project):
        """Cannot nest deeper than 2 levels."""
        root = client.post(
            f"/api/threads/{project['id']}/subtasks",
            json={"description": "Root"},
        ).json()
        child = client.post(
            f"/api/threads/{project['id']}/subtasks",
            json={"description": "Child", "parent_subtask_id": root["id"]},
        ).json()
        # Try to create grandchild
        resp = client.post(
            f"/api/threads/{project['id']}/subtasks",
            json={"description": "Grandchild", "parent_subtask_id": child["id"]},
        )
        assert resp.status_code == 422
        assert "Maximum nesting depth of 2 levels reached" in resp.json()["detail"]

    def test_description_whitespace_only_rejected(self, client, project):
        resp = client.post(
            f"/api/threads/{project['id']}/subtasks",
            json={"description": "   "},
        )
        assert resp.status_code == 422
        assert "Description must be 1-300 non-whitespace characters" in resp.json()["detail"]

    def test_description_too_long_rejected(self, client, project):
        resp = client.post(
            f"/api/threads/{project['id']}/subtasks",
            json={"description": "x" * 301},
        )
        assert resp.status_code == 422

    def test_max_50_subtasks(self, client, project):
        for i in range(50):
            r = client.post(
                f"/api/threads/{project['id']}/subtasks",
                json={"description": f"Subtask {i}"},
            )
            assert r.status_code == 201
        # 51st should fail
        resp = client.post(
            f"/api/threads/{project['id']}/subtasks",
            json={"description": "One too many"},
        )
        assert resp.status_code == 422
        assert "Maximum of 50 subtasks per project reached" in resp.json()["detail"]

    def test_sequential_sort_order(self, client, project):
        """New subtasks get sequential sort_order within parent scope."""
        r1 = client.post(
            f"/api/threads/{project['id']}/subtasks",
            json={"description": "First"},
        ).json()
        r2 = client.post(
            f"/api/threads/{project['id']}/subtasks",
            json={"description": "Second"},
        ).json()
        r3 = client.post(
            f"/api/threads/{project['id']}/subtasks",
            json={"description": "Third"},
        ).json()
        assert r1["sort_order"] == 0
        assert r2["sort_order"] == 1
        assert r3["sort_order"] == 2

    def test_project_not_found(self, client):
        resp = client.post(
            "/api/threads/9999/subtasks",
            json={"description": "test"},
        )
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Project not found"


class TestUpdateSubtask:
    def test_update_description(self, client, project):
        sub = client.post(
            f"/api/threads/{project['id']}/subtasks",
            json={"description": "Original"},
        ).json()
        resp = client.put(
            f"/api/subtasks/{sub['id']}",
            json={"description": "Updated"},
        )
        assert resp.status_code == 200
        assert resp.json()["description"] == "Updated"

    def test_update_done(self, client, project):
        sub = client.post(
            f"/api/threads/{project['id']}/subtasks",
            json={"description": "Task"},
        ).json()
        resp = client.put(f"/api/subtasks/{sub['id']}", json={"done": True})
        assert resp.status_code == 200
        assert resp.json()["done"] is True

    def test_update_sort_order(self, client, project):
        sub = client.post(
            f"/api/threads/{project['id']}/subtasks",
            json={"description": "Task"},
        ).json()
        resp = client.put(f"/api/subtasks/{sub['id']}", json={"sort_order": 5})
        assert resp.status_code == 200
        assert resp.json()["sort_order"] == 5

    def test_not_found(self, client):
        resp = client.put("/api/subtasks/9999", json={"done": True})
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Subtask not found"

    def test_update_invalid_description(self, client, project):
        sub = client.post(
            f"/api/threads/{project['id']}/subtasks",
            json={"description": "Task"},
        ).json()
        resp = client.put(f"/api/subtasks/{sub['id']}", json={"description": "   "})
        assert resp.status_code == 422


class TestDeleteSubtask:
    def test_delete_subtask(self, client, project):
        sub = client.post(
            f"/api/threads/{project['id']}/subtasks",
            json={"description": "To delete"},
        ).json()
        resp = client.delete(f"/api/subtasks/{sub['id']}")
        assert resp.status_code == 204
        # Verify it's gone
        listing = client.get(f"/api/threads/{project['id']}/subtasks").json()
        assert len(listing["subtasks"]) == 0

    def test_cascade_delete(self, client, project):
        """Deleting a parent removes its children."""
        root = client.post(
            f"/api/threads/{project['id']}/subtasks",
            json={"description": "Root"},
        ).json()
        child = client.post(
            f"/api/threads/{project['id']}/subtasks",
            json={"description": "Child", "parent_subtask_id": root["id"]},
        ).json()
        # Delete root
        resp = client.delete(f"/api/subtasks/{root['id']}")
        assert resp.status_code == 204
        # Both root and child should be gone
        listing = client.get(f"/api/threads/{project['id']}/subtasks").json()
        assert len(listing["subtasks"]) == 0

    def test_not_found(self, client):
        resp = client.delete("/api/subtasks/9999")
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Subtask not found"


class TestReorderSubtasks:
    def test_reorder(self, client, project):
        s1 = client.post(
            f"/api/threads/{project['id']}/subtasks",
            json={"description": "A"},
        ).json()
        s2 = client.post(
            f"/api/threads/{project['id']}/subtasks",
            json={"description": "B"},
        ).json()
        s3 = client.post(
            f"/api/threads/{project['id']}/subtasks",
            json={"description": "C"},
        ).json()
        # Reverse order
        resp = client.put(
            f"/api/threads/{project['id']}/subtasks/reorder",
            json={"items": [
                {"id": s1["id"], "sort_order": 2},
                {"id": s2["id"], "sort_order": 1},
                {"id": s3["id"], "sort_order": 0},
            ]},
        )
        assert resp.status_code == 200
        listing = client.get(f"/api/threads/{project['id']}/subtasks").json()["subtasks"]
        # Should be ordered by sort_order: C(0), B(1), A(2)
        assert listing[0]["description"] == "C"
        assert listing[1]["description"] == "B"
        assert listing[2]["description"] == "A"

    def test_project_not_found(self, client):
        resp = client.put(
            "/api/threads/9999/subtasks/reorder",
            json={"items": []},
        )
        assert resp.status_code == 404

    def test_subtask_not_in_project(self, client, project):
        """Reorder with a subtask ID that doesn't belong to the project."""
        resp = client.put(
            f"/api/threads/{project['id']}/subtasks/reorder",
            json={"items": [{"id": 9999, "sort_order": 0}]},
        )
        assert resp.status_code == 404
