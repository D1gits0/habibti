from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from datetime import datetime, date

from database import init_db, get_db
from models import (
    ThreadCreate, ThreadUpdate, ThreadResponse,
    LogCreate, LogUpdate, LogResponse,
)

# Force fresh deploy
app = FastAPI(title="Compound API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
