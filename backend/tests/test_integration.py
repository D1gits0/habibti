"""Integration tests exercising multiple API endpoints in sequence.

Validates: Requirements 4.8, 5.2, 5.3, 6.12
"""
import pytest
from datetime import date
from fastapi.testclient import TestClient

from main import app
from database import init_db


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
    resp = client.post("/api/threads", json={"name": "Integration Project", "category": "test"})
    assert resp.status_code == 201
    return resp.json()


class TestSubtaskCascadeDelete:
    """Test subtask cascade delete via API → verify DB state.

    Validates: Requirement 4.8
    """

    def test_delete_parent_cascades_to_children(self, client, project):
        """Create a parent with multiple children, delete parent, verify all gone."""
        pid = project["id"]

        # Create parent subtask
        parent = client.post(
            f"/api/threads/{pid}/subtasks",
            json={"description": "Parent task"},
        ).json()
        assert parent["id"] is not None

        # Create child subtasks under the parent
        child1 = client.post(
            f"/api/threads/{pid}/subtasks",
            json={"description": "Child 1", "parent_subtask_id": parent["id"]},
        ).json()
        child2 = client.post(
            f"/api/threads/{pid}/subtasks",
            json={"description": "Child 2", "parent_subtask_id": parent["id"]},
        ).json()
        child3 = client.post(
            f"/api/threads/{pid}/subtasks",
            json={"description": "Child 3", "parent_subtask_id": parent["id"]},
        ).json()

        # Verify all 4 subtasks exist
        listing = client.get(f"/api/threads/{pid}/subtasks").json()
        assert len(listing["subtasks"]) == 4

        # Delete the parent
        resp = client.delete(f"/api/subtasks/{parent['id']}")
        assert resp.status_code == 204

        # Verify all children are also deleted
        listing = client.get(f"/api/threads/{pid}/subtasks").json()
        assert len(listing["subtasks"]) == 0

        # Verify specific child IDs are gone
        for child_id in [child1["id"], child2["id"], child3["id"]]:
            resp = client.put(f"/api/subtasks/{child_id}", json={"done": True})
            assert resp.status_code == 404

    def test_delete_parent_preserves_siblings(self, client, project):
        """Deleting one parent doesn't affect sibling subtask trees."""
        pid = project["id"]

        # Create two root-level subtasks
        parent_a = client.post(
            f"/api/threads/{pid}/subtasks",
            json={"description": "Parent A"},
        ).json()
        parent_b = client.post(
            f"/api/threads/{pid}/subtasks",
            json={"description": "Parent B"},
        ).json()

        # Add children to both
        client.post(
            f"/api/threads/{pid}/subtasks",
            json={"description": "Child of A", "parent_subtask_id": parent_a["id"]},
        )
        child_b = client.post(
            f"/api/threads/{pid}/subtasks",
            json={"description": "Child of B", "parent_subtask_id": parent_b["id"]},
        ).json()

        # Delete parent A
        resp = client.delete(f"/api/subtasks/{parent_a['id']}")
        assert resp.status_code == 204

        # Parent B and its child should remain
        listing = client.get(f"/api/threads/{pid}/subtasks").json()
        assert len(listing["subtasks"]) == 2
        subtask_ids = [s["id"] for s in listing["subtasks"]]
        assert parent_b["id"] in subtask_ids
        assert child_b["id"] in subtask_ids


class TestChartTapUpsertFlow:
    """Test chart-tap upsert flow: create then update same date/metric → verify single entry.

    Validates: Requirements 5.2, 5.3
    """

    def test_create_then_update_same_date_metric(self, client):
        """Simulate the frontend upsert: POST to create, GET to find, PUT to update."""
        target_date = "2024-06-15"
        category = "habit"
        metric = "sleep_hours"

        # Step 1: POST a new log entry
        create_resp = client.post("/api/logs", json={
            "date": target_date,
            "category": category,
            "metric": metric,
            "value": 7.5,
        })
        assert create_resp.status_code == 201
        created_log = create_resp.json()
        assert created_log["value"] == 7.5

        # Step 2: GET to verify it was created (simulating frontend check)
        get_resp = client.get(
            "/api/logs",
            params={"category": category, "metric": metric, "date_from": target_date, "date_to": target_date},
        )
        assert get_resp.status_code == 200
        logs = get_resp.json()
        assert len(logs) == 1
        assert logs[0]["value"] == 7.5
        existing_id = logs[0]["id"]

        # Step 3: PUT to update the existing entry (upsert - update path)
        update_resp = client.put(f"/api/logs/{existing_id}", json={
            "value": 8.0,
        })
        assert update_resp.status_code == 200
        updated_log = update_resp.json()
        assert updated_log["value"] == 8.0

        # Step 4: Verify only 1 entry exists and value is 8.0
        final_resp = client.get(
            "/api/logs",
            params={"category": category, "metric": metric, "date_from": target_date, "date_to": target_date},
        )
        assert final_resp.status_code == 200
        final_logs = final_resp.json()
        assert len(final_logs) == 1
        assert final_logs[0]["value"] == 8.0
        assert final_logs[0]["id"] == existing_id

    def test_create_new_when_no_existing(self, client):
        """When no entry exists for date/metric, a new one is created."""
        target_date = "2024-06-16"
        category = "habit"
        metric = "water_liters"

        # Verify nothing exists
        get_resp = client.get(
            "/api/logs",
            params={"category": category, "metric": metric, "date_from": target_date, "date_to": target_date},
        )
        assert get_resp.status_code == 200
        assert len(get_resp.json()) == 0

        # Create new entry
        create_resp = client.post("/api/logs", json={
            "date": target_date,
            "category": category,
            "metric": metric,
            "value": 3.0,
        })
        assert create_resp.status_code == 201

        # Verify exactly one entry with correct value
        final_resp = client.get(
            "/api/logs",
            params={"category": category, "metric": metric, "date_from": target_date, "date_to": target_date},
        )
        assert final_resp.status_code == 200
        final_logs = final_resp.json()
        assert len(final_logs) == 1
        assert final_logs[0]["value"] == 3.0

    def test_multiple_metrics_same_date_independent(self, client):
        """Different metrics on the same date should not interfere."""
        target_date = "2024-06-15"
        category = "habit"

        # Create two different metrics on same date
        client.post("/api/logs", json={
            "date": target_date, "category": category, "metric": "sleep_hours", "value": 7.0,
        })
        client.post("/api/logs", json={
            "date": target_date, "category": category, "metric": "protein_grams", "value": 150.0,
        })

        # Verify each metric has its own entry
        sleep_resp = client.get(
            "/api/logs",
            params={"category": category, "metric": "sleep_hours", "date_from": target_date, "date_to": target_date},
        )
        assert len(sleep_resp.json()) == 1
        assert sleep_resp.json()[0]["value"] == 7.0

        protein_resp = client.get(
            "/api/logs",
            params={"category": category, "metric": "protein_grams", "date_from": target_date, "date_to": target_date},
        )
        assert len(protein_resp.json()) == 1
        assert protein_resp.json()[0]["value"] == 150.0


class TestGymSessionEndToEnd:
    """Test gym session end-to-end: select split → log exercises → abs toggle → verify all persisted.

    Validates: Requirement 6.12
    """

    def test_full_gym_session_logging(self, client):
        """Log a complete push day session with abs exercises and verify persistence."""
        today = date.today().isoformat()

        # Step 1: POST a primary exercise entry (Incline DB Press)
        resp1 = client.post("/api/logs", json={
            "date": today,
            "category": "gym",
            "metric": "Incline DB Press",
            "value": 135.0,
            "notes": "failure:true|8r",
        })
        assert resp1.status_code == 201
        log1 = resp1.json()
        assert log1["metric"] == "Incline DB Press"
        assert log1["value"] == 135.0
        assert log1["notes"] == "failure:true|8r"

        # Step 2: POST another exercise entry (Cable Chest Fly)
        resp2 = client.post("/api/logs", json={
            "date": today,
            "category": "gym",
            "metric": "Cable Chest Fly",
            "value": 50.0,
            "notes": "12r",
        })
        assert resp2.status_code == 201
        log2 = resp2.json()
        assert log2["metric"] == "Cable Chest Fly"
        assert log2["value"] == 50.0
        assert log2["notes"] == "12r"

        # Step 3: POST abs exercise (Cable Crunches)
        resp3 = client.post("/api/logs", json={
            "date": today,
            "category": "gym",
            "metric": "Cable Crunches",
            "value": 70.0,
            "notes": "15r",
        })
        assert resp3.status_code == 201
        log3 = resp3.json()
        assert log3["metric"] == "Cable Crunches"
        assert log3["value"] == 70.0
        assert log3["notes"] == "15r"

        # Step 4: GET all gym logs and verify all 3 entries exist
        get_resp = client.get(
            "/api/logs",
            params={"category": "gym", "date_from": today, "date_to": today},
        )
        assert get_resp.status_code == 200
        gym_logs = get_resp.json()
        assert len(gym_logs) == 3

        # Verify each exercise is present with correct data
        logs_by_metric = {log["metric"]: log for log in gym_logs}

        assert "Incline DB Press" in logs_by_metric
        assert logs_by_metric["Incline DB Press"]["value"] == 135.0
        assert logs_by_metric["Incline DB Press"]["notes"] == "failure:true|8r"

        assert "Cable Chest Fly" in logs_by_metric
        assert logs_by_metric["Cable Chest Fly"]["value"] == 50.0
        assert logs_by_metric["Cable Chest Fly"]["notes"] == "12r"

        assert "Cable Crunches" in logs_by_metric
        assert logs_by_metric["Cable Crunches"]["value"] == 70.0
        assert logs_by_metric["Cable Crunches"]["notes"] == "15r"

    def test_notes_encoding_persists_correctly(self, client):
        """Verify the failure/dropset flag encoding in notes field round-trips through the API."""
        today = date.today().isoformat()

        # Normal set
        resp_normal = client.post("/api/logs", json={
            "date": today, "category": "gym", "metric": "Lat Pulldowns",
            "value": 120.0, "notes": "10r",
        })
        assert resp_normal.status_code == 201

        # Failure set
        resp_fail = client.post("/api/logs", json={
            "date": today, "category": "gym", "metric": "Preacher Curls",
            "value": 30.0, "notes": "failure:true|8r",
        })
        assert resp_fail.status_code == 201

        # Dropset
        resp_drop = client.post("/api/logs", json={
            "date": today, "category": "gym", "metric": "Cable Hammer Curls",
            "value": 25.0, "notes": "dropset:true|6r",
        })
        assert resp_drop.status_code == 201

        # Fetch and verify notes are stored exactly as submitted
        get_resp = client.get(
            "/api/logs",
            params={"category": "gym", "date_from": today, "date_to": today},
        )
        gym_logs = get_resp.json()
        logs_by_metric = {log["metric"]: log for log in gym_logs}

        assert logs_by_metric["Lat Pulldowns"]["notes"] == "10r"
        assert logs_by_metric["Preacher Curls"]["notes"] == "failure:true|8r"
        assert logs_by_metric["Cable Hammer Curls"]["notes"] == "dropset:true|6r"

    def test_exercise_history_after_session(self, client):
        """After logging exercises, the gym history endpoint returns them."""
        today = date.today().isoformat()

        # Log an exercise
        client.post("/api/logs", json={
            "date": today, "category": "gym", "metric": "Incline DB Press",
            "value": 135.0, "notes": "8r",
        })
        client.post("/api/logs", json={
            "date": today, "category": "gym", "metric": "Incline DB Press",
            "value": 140.0, "notes": "failure:true|6r",
        })

        # Fetch history for that exercise
        history_resp = client.get("/api/gym/history/Incline DB Press", params={"range": "3m"})
        assert history_resp.status_code == 200
        history = history_resp.json()
        assert len(history) == 2
        assert history[0]["value"] == 135.0
        assert history[1]["value"] == 140.0
