from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from datetime import datetime, date, timedelta
import os

from database import init_db, get_db
from models import (
    ThreadCreate, ThreadUpdate, ThreadResponse,
    LogCreate, LogUpdate, LogResponse,
    ScheduleConfigUpdate, ScheduleConfigResponse, ScheduleTodayResponse,
    WeekDayResponse, ShiftRequest, ShiftResponse,
)
from schedule_engine import get_day_type, get_day_index, get_week_schedule, SPLIT_CYCLE
from shift_engine import compute_shift, validate_shift_request

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


@app.get("/api/schedule/week")
def get_week_schedule_endpoint(start_date: Optional[str] = None):
    """Returns next 7 days with day_type for each. Uses today if start_date not provided."""
    with get_db() as conn:
        row = conn.execute("SELECT cycle_start_date FROM schedule_state WHERE id = 1").fetchone()
        cycle_start = row["cycle_start_date"] if row else None

    if not cycle_start:
        return {"configured": False, "days": []}

    cycle_start_date = date.fromisoformat(cycle_start)
    start = date.fromisoformat(start_date) if start_date else date.today()
    days = get_week_schedule(cycle_start_date, start)
    return days


@app.get("/api/schedule/config")
def get_schedule_config():
    """Returns current schedule configuration."""
    with get_db() as conn:
        row = conn.execute("SELECT cycle_start_date FROM schedule_state WHERE id = 1").fetchone()
        cycle_start = row["cycle_start_date"] if row else None
        split_rows = conn.execute("SELECT day_index, day_type FROM split_schedule ORDER BY day_index").fetchall()

    split_cycle = [{"day_index": r["day_index"], "day_type": r["day_type"]} for r in split_rows]
    return {
        "cycle_start_date": cycle_start,
        "split_cycle": split_cycle,
    }


@app.put("/api/schedule/config")
def update_schedule_config(body: ScheduleConfigUpdate):
    """Update cycle_start_date. Validates date range (±30 days from today)."""
    try:
        new_date = date.fromisoformat(body.cycle_start_date)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid date format")

    today = date.today()
    if abs((new_date - today).days) > 30:
        raise HTTPException(status_code=422, detail="Date must be within 30 days of today")

    with get_db() as conn:
        conn.execute(
            "UPDATE schedule_state SET cycle_start_date = ? WHERE id = 1",
            (new_date.isoformat(),),
        )

    return {"cycle_start_date": new_date.isoformat()}


@app.post("/api/schedule/shift")
def shift_schedule(body: ShiftRequest):
    """Mark a day unavailable, shift schedule forward. Validates future date."""
    try:
        unavailable = date.fromisoformat(body.unavailable_date)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid date format")

    today = date.today()
    error = validate_shift_request(unavailable, today)
    if error:
        raise HTTPException(status_code=422, detail=error)

    with get_db() as conn:
        row = conn.execute("SELECT cycle_start_date FROM schedule_state WHERE id = 1").fetchone()
        cycle_start = row["cycle_start_date"] if row else None

    if not cycle_start:
        raise HTTPException(status_code=422, detail="Schedule not configured")

    cycle_start_date = date.fromisoformat(cycle_start)
    new_cycle_start = compute_shift(cycle_start_date, unavailable, SPLIT_CYCLE)

    # Check if a rest day was absorbed (new_cycle_start == old means rest absorbed the shift)
    absorbed_rest = (new_cycle_start == cycle_start_date)

    # Persist the new cycle_start_date
    with get_db() as conn:
        conn.execute(
            "UPDATE schedule_state SET cycle_start_date = ? WHERE id = 1",
            (new_cycle_start.isoformat(),),
        )

    # Return updated week schedule starting from today
    week = get_week_schedule(new_cycle_start, today)
    return {
        "new_cycle_start_date": new_cycle_start.isoformat(),
        "week_schedule": week,
        "absorbed_rest": absorbed_rest,
    }


