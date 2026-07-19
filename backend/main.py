from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from datetime import datetime, date, timedelta
import os
import json

from database import init_db, get_db
from models import (
    ThreadCreate, ThreadUpdate, ThreadResponse,
    LogCreate, LogUpdate, LogResponse,
    ScheduleTodayResponse,
    SubtaskCreate, SubtaskUpdate, SubtaskResponse, SubtaskReorderRequest,
    ExerciseDefinition, SplitDayExercises,
    DeadlineCreate, DeadlineUpdate, DeadlineResponse,
)
from schedule_engine import get_day_type, get_day_index, SPLIT_CYCLE
from subtask_utils import compute_completion_percentage

# Load exercise seed data
_SEED_PATH = os.path.join(os.path.dirname(__file__), "exercise_seed.json")
with open(_SEED_PATH, "r") as f:
    EXERCISE_SEED: dict = json.load(f)


# Force fresh deploy
app = FastAPI(title="Compound API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.environ.get("CORS_ORIGIN", "http://localhost:5173"),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()


# ─── THREADS ────────────────────────────────────────────────────────────────────

@app.get("/api/threads", response_model=list[ThreadResponse])
def list_threads(
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
):
    with get_db() as conn:
        query = "SELECT * FROM threads WHERE 1=1"
        params = []
        if category:
            query += " AND category = ?"
            params.append(category)
        if status:
            query += " AND status = ?"
            params.append(status)
        query += " ORDER BY updated_at DESC"
        rows = conn.execute(query, params).fetchall()
        return [dict(row) for row in rows]


@app.get("/api/threads/{thread_id}", response_model=ThreadResponse)
def get_thread(thread_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM threads WHERE id = ?", (thread_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Thread not found")
        return dict(row)


@app.post("/api/threads", response_model=ThreadResponse, status_code=201)
def create_thread(thread: ThreadCreate):
    with get_db() as conn:
        now = datetime.now().isoformat(sep=" ", timespec="seconds")
        cursor = conn.execute(
            "INSERT INTO threads (name, category, status, next_action, updated_at) VALUES (?, ?, ?, ?, ?)",
            (thread.name, thread.category, thread.status, thread.next_action, now),
        )
        row = conn.execute("SELECT * FROM threads WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return dict(row)


@app.put("/api/threads/{thread_id}", response_model=ThreadResponse)
def update_thread(thread_id: int, thread: ThreadUpdate):
    with get_db() as conn:
        existing = conn.execute("SELECT * FROM threads WHERE id = ?", (thread_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Thread not found")
        updates = {}
        for field in ["name", "category", "status", "next_action"]:
            val = getattr(thread, field)
            if val is not None:
                updates[field] = val
        if updates:
            updates["updated_at"] = datetime.now().isoformat(sep=" ", timespec="seconds")
            set_clause = ", ".join(f"{k} = ?" for k in updates)
            conn.execute(
                f"UPDATE threads SET {set_clause} WHERE id = ?",
                list(updates.values()) + [thread_id],
            )
        row = conn.execute("SELECT * FROM threads WHERE id = ?", (thread_id,)).fetchone()
        return dict(row)


@app.delete("/api/threads/{thread_id}", status_code=204)
def delete_thread(thread_id: int):
    with get_db() as conn:
        existing = conn.execute("SELECT * FROM threads WHERE id = ?", (thread_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Thread not found")
        conn.execute("DELETE FROM threads WHERE id = ?", (thread_id,))


# ─── LOGS ────────────────────────────────────────────────────────────────────────

@app.get("/api/logs", response_model=list[LogResponse])
def list_logs(
    category: Optional[str] = Query(None),
    metric: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
):
    with get_db() as conn:
        query = "SELECT * FROM logs WHERE 1=1"
        params = []
        if category:
            query += " AND category = ?"
            params.append(category)
        if metric:
            query += " AND metric = ?"
            params.append(metric)
        if date_from:
            query += " AND date >= ?"
            params.append(date_from)
        if date_to:
            query += " AND date <= ?"
            params.append(date_to)
        query += " ORDER BY date DESC, id DESC"
        rows = conn.execute(query, params).fetchall()
        return [dict(row) for row in rows]


@app.get("/api/logs/{log_id}", response_model=LogResponse)
def get_log(log_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM logs WHERE id = ?", (log_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Log not found")
        return dict(row)


@app.post("/api/logs", response_model=LogResponse, status_code=201)
def create_log(log: LogCreate):
    with get_db() as conn:
        log_date = log.date or date.today().isoformat()
        cursor = conn.execute(
            "INSERT INTO logs (date, category, metric, value, notes) VALUES (?, ?, ?, ?, ?)",
            (log_date, log.category, log.metric, log.value, log.notes),
        )
        row = conn.execute("SELECT * FROM logs WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return dict(row)


@app.put("/api/logs/{log_id}", response_model=LogResponse)
def update_log(log_id: int, log: LogUpdate):
    with get_db() as conn:
        existing = conn.execute("SELECT * FROM logs WHERE id = ?", (log_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Log not found")
        updates = {}
        for field in ["date", "category", "metric", "value", "notes"]:
            val = getattr(log, field)
            if val is not None:
                updates[field] = val
        if updates:
            set_clause = ", ".join(f"{k} = ?" for k in updates)
            conn.execute(
                f"UPDATE logs SET {set_clause} WHERE id = ?",
                list(updates.values()) + [log_id],
            )
        row = conn.execute("SELECT * FROM logs WHERE id = ?", (log_id,)).fetchone()
        return dict(row)


@app.delete("/api/logs/{log_id}", status_code=204)
def delete_log(log_id: int):
    with get_db() as conn:
        existing = conn.execute("SELECT * FROM logs WHERE id = ?", (log_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Log not found")
        conn.execute("DELETE FROM logs WHERE id = ?", (log_id,))


# ─── SCHEDULE ────────────────────────────────────────────────────────────────────

@app.get("/api/schedule/today")
def get_today_schedule():
    """Returns today's day type or configured=false if no cycle_start_date set."""
    today = date.today()
    with get_db() as conn:
        row = conn.execute("SELECT cycle_start_date FROM schedule_state WHERE id = 1").fetchone()
        cycle_start = row["cycle_start_date"] if row else None

    if not cycle_start:
        return {
            "date": today.isoformat(),
            "day_type": None,
            "day_index": None,
            "configured": False,
        }

    cycle_start_date = date.fromisoformat(cycle_start)
    return {
        "date": today.isoformat(),
        "day_type": get_day_type(cycle_start_date, today),
        "day_index": get_day_index(cycle_start_date, today),
        "configured": True,
    }


# ─── GYM ─────────────────────────────────────────────────────────────────────────

@app.get("/api/gym/exercises", response_model=list[SplitDayExercises])
def get_all_exercises():
    """Return the full exercise seed data (all split days with primary/swap exercises)."""
    return [
        SplitDayExercises(day_type=day_type, exercises=[ExerciseDefinition(**ex) for ex in exercises])
        for day_type, exercises in EXERCISE_SEED.items()
    ]


@app.get("/api/gym/exercises/{day_type}", response_model=SplitDayExercises)
def get_exercises_for_day(day_type: str):
    """Return exercises for a specific split day."""
    if day_type not in EXERCISE_SEED:
        raise HTTPException(status_code=404, detail=f"Day type '{day_type}' not found")
    exercises = EXERCISE_SEED[day_type]
    return SplitDayExercises(day_type=day_type, exercises=[ExerciseDefinition(**ex) for ex in exercises])


@app.get("/api/gym/history/{exercise_name}")
def get_exercise_history(
    exercise_name: str,
    range: str = Query("3m", pattern="^(1m|3m|6m|ytd)$"),
):
    """Return logged entries for a specific exercise with time range filter."""
    today = date.today()

    if range == "1m":
        start_date = today - timedelta(days=30)
    elif range == "3m":
        start_date = today - timedelta(days=90)
    elif range == "6m":
        start_date = today - timedelta(days=180)
    elif range == "ytd":
        start_date = date(today.year, 1, 1)
    else:
        start_date = today - timedelta(days=90)

    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, date, category, metric, value, notes FROM logs "
            "WHERE category = 'gym' AND metric = ? AND date >= ? "
            "ORDER BY date ASC, id ASC",
            (exercise_name, start_date.isoformat()),
        ).fetchall()
        return [dict(row) for row in rows]




# ─── SUBTASKS ────────────────────────────────────────────────────────────────────

@app.get("/api/threads/{thread_id}/subtasks")
def list_subtasks(thread_id: int):
    with get_db() as conn:
        # Verify thread exists
        thread = conn.execute("SELECT id FROM threads WHERE id = ?", (thread_id,)).fetchone()
        if not thread:
            raise HTTPException(status_code=404, detail="Project not found")
        rows = conn.execute(
            "SELECT id, thread_id, parent_subtask_id, description, done, sort_order FROM subtasks WHERE thread_id = ? ORDER BY sort_order",
            (thread_id,),
        ).fetchall()
        subtasks = [
            {**dict(row), "done": bool(row["done"])}
            for row in rows
        ]
        completion_percentage = compute_completion_percentage(subtasks)
        return {
            "subtasks": subtasks,
            "completion_percentage": completion_percentage,
        }


@app.post("/api/threads/{thread_id}/subtasks", response_model=SubtaskResponse, status_code=201)
def create_subtask(thread_id: int, subtask: SubtaskCreate):
    with get_db() as conn:
        # Verify thread exists
        thread = conn.execute("SELECT id FROM threads WHERE id = ?", (thread_id,)).fetchone()
        if not thread:
            raise HTTPException(status_code=404, detail="Project not found")

        # Validate description (non-whitespace content, 1-300 chars)
        stripped = subtask.description.strip()
        if len(stripped) == 0 or len(subtask.description) > 300:
            raise HTTPException(status_code=422, detail="Description must be 1-300 non-whitespace characters")

        # Count validation: max 50 subtasks per project
        count = conn.execute(
            "SELECT COUNT(*) FROM subtasks WHERE thread_id = ?", (thread_id,)
        ).fetchone()[0]
        if count >= 50:
            raise HTTPException(status_code=422, detail="Maximum of 50 subtasks per project reached")

        # Nesting depth validation: max depth 2
        if subtask.parent_subtask_id is not None:
            # Verify parent exists and belongs to this thread
            parent = conn.execute(
                "SELECT id, parent_subtask_id, thread_id FROM subtasks WHERE id = ?",
                (subtask.parent_subtask_id,),
            ).fetchone()
            if not parent or parent["thread_id"] != thread_id:
                raise HTTPException(status_code=404, detail="Subtask not found")
            # If parent already has a parent, we'd be at depth 3 — reject
            if parent["parent_subtask_id"] is not None:
                raise HTTPException(status_code=422, detail="Maximum nesting depth of 2 levels reached")

        # Determine next sort_order within parent scope
        if subtask.parent_subtask_id is not None:
            max_sort = conn.execute(
                "SELECT MAX(sort_order) FROM subtasks WHERE thread_id = ? AND parent_subtask_id = ?",
                (thread_id, subtask.parent_subtask_id),
            ).fetchone()[0]
        else:
            max_sort = conn.execute(
                "SELECT MAX(sort_order) FROM subtasks WHERE thread_id = ? AND parent_subtask_id IS NULL",
                (thread_id,),
            ).fetchone()[0]

        next_sort = (max_sort + 1) if max_sort is not None else 0

        cursor = conn.execute(
            "INSERT INTO subtasks (thread_id, parent_subtask_id, description, done, sort_order) VALUES (?, ?, ?, 0, ?)",
            (thread_id, subtask.parent_subtask_id, subtask.description, next_sort),
        )
        row = conn.execute(
            "SELECT id, thread_id, parent_subtask_id, description, done, sort_order FROM subtasks WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
        return {**dict(row), "done": bool(row["done"])}


@app.put("/api/subtasks/{subtask_id}", response_model=SubtaskResponse)
def update_subtask(subtask_id: int, subtask: SubtaskUpdate):
    with get_db() as conn:
        existing = conn.execute(
            "SELECT id, thread_id, parent_subtask_id, description, done, sort_order FROM subtasks WHERE id = ?",
            (subtask_id,),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Subtask not found")

        updates = {}
        if subtask.description is not None:
            stripped = subtask.description.strip()
            if len(stripped) == 0 or len(subtask.description) > 300:
                raise HTTPException(status_code=422, detail="Description must be 1-300 non-whitespace characters")
            updates["description"] = subtask.description
        if subtask.done is not None:
            updates["done"] = 1 if subtask.done else 0
        if subtask.sort_order is not None:
            updates["sort_order"] = subtask.sort_order
        if subtask.due_date is not None:
            updates["due_date"] = subtask.due_date

        if updates:
            set_clause = ", ".join(f"{k} = ?" for k in updates)
            conn.execute(
                f"UPDATE subtasks SET {set_clause} WHERE id = ?",
                list(updates.values()) + [subtask_id],
            )

        row = conn.execute(
            "SELECT id, thread_id, parent_subtask_id, description, done, sort_order FROM subtasks WHERE id = ?",
            (subtask_id,),
        ).fetchone()
        return {**dict(row), "done": bool(row["done"])}


@app.delete("/api/subtasks/{subtask_id}", status_code=204)
def delete_subtask(subtask_id: int):
    with get_db() as conn:
        existing = conn.execute("SELECT id FROM subtasks WHERE id = ?", (subtask_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Subtask not found")
        # ON DELETE CASCADE handles children removal
        conn.execute("DELETE FROM subtasks WHERE id = ?", (subtask_id,))


@app.put("/api/threads/{thread_id}/subtasks/reorder")
def reorder_subtasks(thread_id: int, request: SubtaskReorderRequest):
    with get_db() as conn:
        # Verify thread exists
        thread = conn.execute("SELECT id FROM threads WHERE id = ?", (thread_id,)).fetchone()
        if not thread:
            raise HTTPException(status_code=404, detail="Project not found")

        for item in request.items:
            # Verify subtask belongs to this thread
            subtask = conn.execute(
                "SELECT id FROM subtasks WHERE id = ? AND thread_id = ?",
                (item.id, thread_id),
            ).fetchone()
            if not subtask:
                raise HTTPException(status_code=404, detail="Subtask not found")
            conn.execute(
                "UPDATE subtasks SET sort_order = ? WHERE id = ?",
                (item.sort_order, item.id),
            )
        return {"status": "ok"}


# ─── DEADLINES ───────────────────────────────────────────────────────────────────

@app.get("/api/deadlines", response_model=list[DeadlineResponse])
def list_deadlines(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    project_id: Optional[int] = Query(None),
):
    """List deadlines with optional date range and project filters."""
    with get_db() as conn:
        query = "SELECT id, title, due_date, source, project_id, created_at FROM deadlines WHERE 1=1"
        params = []
        if date_from:
            query += " AND due_date >= ?"
            params.append(date_from)
        if date_to:
            query += " AND due_date <= ?"
            params.append(date_to)
        if project_id is not None:
            query += " AND project_id = ?"
            params.append(project_id)
        query += " ORDER BY due_date ASC, id ASC"
        rows = conn.execute(query, params).fetchall()
        return [dict(row) for row in rows]


@app.post("/api/deadlines", response_model=DeadlineResponse, status_code=201)
def create_deadline(deadline: DeadlineCreate):
    """Create a new deadline."""
    with get_db() as conn:
        # Validate project_id if provided
        if deadline.project_id is not None:
            project = conn.execute("SELECT id FROM threads WHERE id = ?", (deadline.project_id,)).fetchone()
            if not project:
                raise HTTPException(status_code=404, detail="Project not found")

        cursor = conn.execute(
            "INSERT INTO deadlines (title, due_date, source, project_id) VALUES (?, ?, ?, ?)",
            (deadline.title, deadline.due_date, deadline.source, deadline.project_id),
        )
        row = conn.execute(
            "SELECT id, title, due_date, source, project_id, created_at FROM deadlines WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
        return dict(row)


@app.put("/api/deadlines/{deadline_id}", response_model=DeadlineResponse)
def update_deadline(deadline_id: int, deadline: DeadlineUpdate):
    """Update an existing deadline."""
    with get_db() as conn:
        existing = conn.execute("SELECT id FROM deadlines WHERE id = ?", (deadline_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Deadline not found")

        updates = {}
        if deadline.title is not None:
            updates["title"] = deadline.title
        if deadline.due_date is not None:
            updates["due_date"] = deadline.due_date
        if deadline.project_id is not None:
            updates["project_id"] = deadline.project_id

        if updates:
            set_clause = ", ".join(f"{k} = ?" for k in updates)
            conn.execute(
                f"UPDATE deadlines SET {set_clause} WHERE id = ?",
                list(updates.values()) + [deadline_id],
            )

        row = conn.execute(
            "SELECT id, title, due_date, source, project_id, created_at FROM deadlines WHERE id = ?",
            (deadline_id,),
        ).fetchone()
        return dict(row)


@app.delete("/api/deadlines/{deadline_id}", status_code=204)
def delete_deadline(deadline_id: int):
    """Delete a deadline."""
    with get_db() as conn:
        existing = conn.execute("SELECT id FROM deadlines WHERE id = ?", (deadline_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Deadline not found")
        conn.execute("DELETE FROM deadlines WHERE id = ?", (deadline_id,))


@app.get("/api/calendar/events")
def get_calendar_events(
    date_from: str = Query(...),
    date_to: str = Query(...),
):
    """Get all calendar events (deadlines + subtasks with due_dates) for a date range."""
    with get_db() as conn:
        events = []

        # Get deadlines in range
        deadline_rows = conn.execute(
            "SELECT d.id, d.title, d.due_date, d.source, d.project_id, t.name as project_name "
            "FROM deadlines d LEFT JOIN threads t ON d.project_id = t.id "
            "WHERE d.due_date >= ? AND d.due_date <= ? "
            "ORDER BY d.due_date ASC",
            (date_from, date_to),
        ).fetchall()
        for row in deadline_rows:
            events.append({
                "id": f"deadline-{row['id']}",
                "title": row["title"],
                "due_date": row["due_date"],
                "source": row["source"],
                "type": "deadline",
                "project_id": row["project_id"],
                "project_name": row["project_name"],
            })

        # Get subtasks with due_dates in range
        subtask_rows = conn.execute(
            "SELECT s.id, s.description, s.due_date, s.thread_id, s.done, t.name as project_name "
            "FROM subtasks s JOIN threads t ON s.thread_id = t.id "
            "WHERE s.due_date IS NOT NULL AND s.due_date >= ? AND s.due_date <= ? "
            "ORDER BY s.due_date ASC",
            (date_from, date_to),
        ).fetchall()
        for row in subtask_rows:
            events.append({
                "id": f"subtask-{row['id']}",
                "title": row["description"],
                "due_date": row["due_date"],
                "source": "project",
                "type": "subtask",
                "project_id": row["thread_id"],
                "project_name": row["project_name"],
                "done": bool(row["done"]),
            })

        return events


# ─── PUSH NOTIFICATIONS ──────────────────────────────────────────────────────────

@app.post("/api/push/subscribe", status_code=201)
def subscribe_push(subscription: dict):
    """Store a push subscription for notifications."""
    endpoint = subscription.get("endpoint")
    keys = subscription.get("keys", {})
    p256dh = keys.get("p256dh")
    auth = keys.get("auth")

    if not endpoint or not p256dh or not auth:
        raise HTTPException(status_code=422, detail="Invalid subscription format")

    with get_db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO push_subscriptions (endpoint, keys_p256dh, keys_auth) VALUES (?, ?, ?)",
            (endpoint, p256dh, auth),
        )
    return {"status": "subscribed"}


@app.delete("/api/push/unsubscribe", status_code=204)
def unsubscribe_push(subscription: dict):
    """Remove a push subscription."""
    endpoint = subscription.get("endpoint")
    if not endpoint:
        raise HTTPException(status_code=422, detail="Endpoint required")

    with get_db() as conn:
        conn.execute("DELETE FROM push_subscriptions WHERE endpoint = ?", (endpoint,))


@app.get("/api/push/vapid-key")
def get_vapid_key():
    """Return the VAPID public key for push subscription."""
    # In production, generate proper VAPID keys and store them
    # For now, return a placeholder that indicates push is available
    vapid_key = os.environ.get("VAPID_PUBLIC_KEY", "")
    return {"publicKey": vapid_key, "configured": bool(vapid_key)}
