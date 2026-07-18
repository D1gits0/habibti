"""Property-based tests for chart-tap upsert semantics.

Feature: compound-v3, Property 8: Chart-tap upsert semantics

For any date, metric, and category combination, after submitting a value
through InlineInput, there SHALL exist exactly one Log_Entry with that
(date, metric, category) key, and its value SHALL equal the submitted value.

**Validates: Requirements 5.2, 5.3**
"""
import pytest
from datetime import date as _date
from hypothesis import given, settings, assume, HealthCheck
from hypothesis import strategies as st
from fastapi.testclient import TestClient

from main import app
from database import init_db, get_db


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


# ─── Strategies ──────────────────────────────────────────────────────────────────


# Dates in ISO format within a reasonable range
dates = st.dates(
    min_value=_date(2023, 1, 1),
    max_value=_date(2025, 12, 31),
).map(lambda d: d.isoformat())

# Metric names (exercise names, habit names, etc.)
metrics = st.text(
    alphabet=st.characters(categories=("L", "N", "S"), whitelist_characters=" -_"),
    min_size=1,
    max_size=30,
).filter(lambda s: len(s.strip()) > 0)

# Categories
categories = st.sampled_from(["gym", "habit", "health", "productivity"])

# Numeric values for logging
values = st.floats(min_value=0.0, max_value=1000.0, allow_nan=False, allow_infinity=False)


# ─── Helper: upsert logic (mimics what the frontend InlineInput does) ────────────


def upsert_log(client, date_str: str, metric: str, category: str, value: float):
    """Simulate the upsert behavior of InlineInput:
    1. Check if an entry exists for (date, metric, category)
    2. If yes, update it; if no, create it.
    """
    # Query existing entries for this (date, metric, category)
    resp = client.get(
        "/api/logs",
        params={
            "category": category,
            "metric": metric,
            "date_from": date_str,
            "date_to": date_str,
        },
    )
    assert resp.status_code == 200
    existing = resp.json()

    if existing:
        # Update the first matching entry
        log_id = existing[0]["id"]
        resp = client.put(f"/api/logs/{log_id}", json={"value": value})
        assert resp.status_code == 200
    else:
        # Create a new entry
        resp = client.post(
            "/api/logs",
            json={
                "date": date_str,
                "category": category,
                "metric": metric,
                "value": value,
            },
        )
        assert resp.status_code == 201

    return resp.json()


def clear_logs(client):
    """Remove all log entries from the database."""
    resp = client.get("/api/logs")
    for log in resp.json():
        client.delete(f"/api/logs/{log['id']}")


# ─── Property 8: Chart-tap upsert semantics ──────────────────────────────────────


class TestProperty8UpsertSemantics:
    """Feature: compound-v3, Property 8: Chart-tap upsert semantics

    For any date, metric, and category combination, after submitting a value
    through InlineInput, there SHALL exist exactly one Log_Entry with that
    (date, metric, category) key, and its value SHALL equal the submitted value.

    **Validates: Requirements 5.2, 5.3**
    """

    @settings(
        max_examples=100,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        deadline=None,
    )
    @given(
        date_str=dates,
        metric=metrics,
        category=categories,
        value=values,
    )
    def test_upsert_creates_single_entry(self, client, date_str, metric, category, value):
        """After an upsert, exactly one entry exists for (date, metric, category)
        and its value equals the submitted value."""
        # Perform the upsert
        upsert_log(client, date_str, metric, category, value)

        # Verify: query for this (date, metric, category)
        resp = client.get(
            "/api/logs",
            params={
                "category": category,
                "metric": metric,
                "date_from": date_str,
                "date_to": date_str,
            },
        )
        assert resp.status_code == 200
        entries = resp.json()

        # Exactly one entry should exist
        assert len(entries) == 1, (
            f"Expected exactly 1 entry for ({date_str}, {metric}, {category}), "
            f"got {len(entries)}"
        )
        # Value should match the submitted value
        assert entries[0]["value"] == pytest.approx(value, rel=1e-9), (
            f"Expected value {value}, got {entries[0]['value']}"
        )

    @settings(
        max_examples=100,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        deadline=None,
    )
    @given(
        date_str=dates,
        metric=metrics,
        category=categories,
        value1=values,
        value2=values,
    )
    def test_upsert_update_replaces_value(self, client, date_str, metric, category, value1, value2):
        """After two upserts on the same key, still exactly one entry exists
        and its value equals the LATEST submitted value."""
        # First upsert — creates or updates the entry
        upsert_log(client, date_str, metric, category, value1)

        # Second upsert — updates the entry
        upsert_log(client, date_str, metric, category, value2)

        # Verify: query for this (date, metric, category)
        resp = client.get(
            "/api/logs",
            params={
                "category": category,
                "metric": metric,
                "date_from": date_str,
                "date_to": date_str,
            },
        )
        assert resp.status_code == 200
        entries = resp.json()

        # Still exactly one entry
        assert len(entries) == 1, (
            f"Expected exactly 1 entry after double upsert on "
            f"({date_str}, {metric}, {category}), got {len(entries)}"
        )
        # Value should match the LATEST submission
        assert entries[0]["value"] == pytest.approx(value2, rel=1e-9), (
            f"Expected latest value {value2}, got {entries[0]['value']}"
        )

    @settings(
        max_examples=100,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
        deadline=None,
    )
    @given(
        date_str=dates,
        metric1=metrics,
        metric2=metrics,
        category=categories,
        value1=values,
        value2=values,
    )
    def test_upsert_different_metrics_independent(
        self, client, date_str, metric1, metric2, category, value1, value2
    ):
        """Upserting different metrics on the same date/category creates
        independent entries (one per metric)."""
        assume(metric1 != metric2)

        # Upsert for metric1
        upsert_log(client, date_str, metric1, category, value1)
        # Upsert for metric2
        upsert_log(client, date_str, metric2, category, value2)

        # Verify metric1 has exactly one entry with correct value
        resp = client.get(
            "/api/logs",
            params={
                "category": category,
                "metric": metric1,
                "date_from": date_str,
                "date_to": date_str,
            },
        )
        assert resp.status_code == 200
        entries1 = resp.json()
        assert len(entries1) == 1, (
            f"Expected 1 entry for metric1 ({metric1}), got {len(entries1)}"
        )
        assert entries1[0]["value"] == pytest.approx(value1, rel=1e-9)

        # Verify metric2 has exactly one entry with correct value
        resp = client.get(
            "/api/logs",
            params={
                "category": category,
                "metric": metric2,
                "date_from": date_str,
                "date_to": date_str,
            },
        )
        assert resp.status_code == 200
        entries2 = resp.json()
        assert len(entries2) == 1, (
            f"Expected 1 entry for metric2 ({metric2}), got {len(entries2)}"
        )
        assert entries2[0]["value"] == pytest.approx(value2, rel=1e-9)
