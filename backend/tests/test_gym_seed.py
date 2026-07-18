"""Tests for gym exercise seed endpoints (Task 7.1)."""
import pytest
from fastapi.testclient import TestClient
from datetime import date, timedelta

from main import app
from database import init_db, get_db, DB_PATH
import os


@pytest.fixture(autouse=True)
def setup_db(tmp_path, monkeypatch):
    """Use a temporary database for each test."""
    db_path = str(tmp_path / "test.db")
    monkeypatch.setattr("database.DB_PATH", db_path)
    init_db()
    yield


@pytest.fixture
def client():
    return TestClient(app)


class TestGetAllExercises:
    def test_returns_all_split_days(self, client):
        resp = client.get("/api/gym/exercises")
        assert resp.status_code == 200
        data = resp.json()
        day_types = [item["day_type"] for item in data]
        assert "Push" in day_types
        assert "Pull" in day_types
        assert "Legs" in day_types
        assert "Upper" in day_types
        assert "Lower" in day_types
        assert "Rest" in day_types
        assert "Abs" in day_types

    def test_push_day_exercises_in_order(self, client):
        resp = client.get("/api/gym/exercises")
        data = resp.json()
        push = next(d for d in data if d["day_type"] == "Push")
        names = [ex["name"] for ex in push["exercises"]]
        assert names == [
            "Incline DB Press",
            "Cable Chest Fly",
            "Machine Shoulder Press",
            "Lateral Raises",
            "Overhead Tricep Extension",
        ]

    def test_push_day_swap_for_cable_chest_fly(self, client):
        resp = client.get("/api/gym/exercises")
        data = resp.json()
        push = next(d for d in data if d["day_type"] == "Push")
        cable_fly = next(ex for ex in push["exercises"] if ex["name"] == "Cable Chest Fly")
        assert cable_fly["swap"] == "Pec Deck"

    def test_rest_day_has_no_exercises(self, client):
        resp = client.get("/api/gym/exercises")
        data = resp.json()
        rest = next(d for d in data if d["day_type"] == "Rest")
        assert rest["exercises"] == []

    def test_each_exercise_has_at_most_one_swap(self, client):
        resp = client.get("/api/gym/exercises")
        data = resp.json()
        for day in data:
            for ex in day["exercises"]:
                # swap is either None or a string
                assert ex["swap"] is None or isinstance(ex["swap"], str)


class TestGetExercisesForDay:
    def test_pull_day(self, client):
        resp = client.get("/api/gym/exercises/Pull")
        assert resp.status_code == 200
        data = resp.json()
        assert data["day_type"] == "Pull"
        names = [ex["name"] for ex in data["exercises"]]
        assert names == [
            "Lat Pulldowns",
            "Close Grip Cable Rows",
            "Reverse Fly",
            "Preacher Curls",
            "Cable Hammer Curls",
        ]

    def test_pull_day_swaps(self, client):
        resp = client.get("/api/gym/exercises/Pull")
        data = resp.json()
        reverse_fly = next(ex for ex in data["exercises"] if ex["name"] == "Reverse Fly")
        assert reverse_fly["swap"] == "Archer Pull"
        hammer = next(ex for ex in data["exercises"] if ex["name"] == "Cable Hammer Curls")
        assert hammer["swap"] == "DB Hammer Curl"

    def test_legs_day(self, client):
        resp = client.get("/api/gym/exercises/Legs")
        assert resp.status_code == 200
        data = resp.json()
        names = [ex["name"] for ex in data["exercises"]]
        assert names == [
            "Bulgarian Split Squat",
            "45 Degree Back Extension",
            "Leg Extensions",
            "Leg Curls",
            "Calf Raises",
        ]

    def test_lower_matches_legs(self, client):
        legs_resp = client.get("/api/gym/exercises/Legs")
        lower_resp = client.get("/api/gym/exercises/Lower")
        legs_exercises = legs_resp.json()["exercises"]
        lower_exercises = lower_resp.json()["exercises"]
        assert legs_exercises == lower_exercises

    def test_upper_day(self, client):
        resp = client.get("/api/gym/exercises/Upper")
        data = resp.json()
        names = [ex["name"] for ex in data["exercises"]]
        assert names == [
            "Weighted Dips",
            "Cable Chest Fly",
            "Pull Ups",
            "Wide Grip Cable Rows",
            "Lateral Raises",
            "Incline Curls",
            "Overhead Tricep Extension",
        ]

    def test_upper_cable_fly_swap(self, client):
        resp = client.get("/api/gym/exercises/Upper")
        data = resp.json()
        cable_fly = next(ex for ex in data["exercises"] if ex["name"] == "Cable Chest Fly")
        assert cable_fly["swap"] == "Pec Deck"

    def test_abs_day(self, client):
        resp = client.get("/api/gym/exercises/Abs")
        assert resp.status_code == 200
        data = resp.json()
        names = [ex["name"] for ex in data["exercises"]]
        assert names == ["Cable Crunches", "Leg Raises"]
        leg_raises = next(ex for ex in data["exercises"] if ex["name"] == "Leg Raises")
        assert leg_raises["swap"] == "Side Planks"

    def test_invalid_day_type_returns_404(self, client):
        resp = client.get("/api/gym/exercises/InvalidDay")
        assert resp.status_code == 404


class TestGetExerciseHistory:
    def _insert_log(self, log_date, metric, value, notes=None):
        with get_db() as conn:
            conn.execute(
                "INSERT INTO logs (date, category, metric, value, notes) VALUES (?, 'gym', ?, ?, ?)",
                (log_date, metric, value, notes),
            )

    def test_returns_entries_for_exercise(self, client):
        today = date.today()
        self._insert_log(today.isoformat(), "Incline DB Press", 50.0, "8r")
        self._insert_log(today.isoformat(), "Incline DB Press", 55.0, "6r")

        resp = client.get("/api/gym/history/Incline DB Press?range=1m")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0]["metric"] == "Incline DB Press"
        assert data[0]["value"] == 50.0

    def test_filters_by_1m_range(self, client):
        today = date.today()
        recent = (today - timedelta(days=10)).isoformat()
        old = (today - timedelta(days=60)).isoformat()

        self._insert_log(recent, "Lat Pulldowns", 80.0, "10r")
        self._insert_log(old, "Lat Pulldowns", 70.0, "8r")

        resp = client.get("/api/gym/history/Lat Pulldowns?range=1m")
        data = resp.json()
        assert len(data) == 1
        assert data[0]["date"] == recent

    def test_filters_by_3m_range(self, client):
        today = date.today()
        recent = (today - timedelta(days=30)).isoformat()
        old = (today - timedelta(days=100)).isoformat()

        self._insert_log(recent, "Preacher Curls", 30.0, "12r")
        self._insert_log(old, "Preacher Curls", 25.0, "10r")

        resp = client.get("/api/gym/history/Preacher Curls?range=3m")
        data = resp.json()
        assert len(data) == 1
        assert data[0]["date"] == recent

    def test_filters_by_ytd_range(self, client):
        today = date.today()
        this_year = date(today.year, 1, 15).isoformat()
        last_year = date(today.year - 1, 12, 1).isoformat()

        self._insert_log(this_year, "Calf Raises", 100.0, "15r")
        self._insert_log(last_year, "Calf Raises", 90.0, "12r")

        resp = client.get("/api/gym/history/Calf Raises?range=ytd")
        data = resp.json()
        assert len(data) == 1
        assert data[0]["date"] == this_year

    def test_returns_empty_for_no_logs(self, client):
        resp = client.get("/api/gym/history/Nonexistent Exercise?range=3m")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_only_returns_gym_category(self, client):
        today = date.today().isoformat()
        # Insert a non-gym log with same metric name
        with get_db() as conn:
            conn.execute(
                "INSERT INTO logs (date, category, metric, value, notes) VALUES (?, 'habit', ?, ?, ?)",
                (today, "Incline DB Press", 999.0, "not gym"),
            )
        self._insert_log(today, "Incline DB Press", 50.0, "8r")

        resp = client.get("/api/gym/history/Incline DB Press?range=1m")
        data = resp.json()
        assert len(data) == 1
        assert data[0]["category"] == "gym"
        assert data[0]["value"] == 50.0
