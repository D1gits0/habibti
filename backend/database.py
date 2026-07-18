import sqlite3
import os
from contextlib import contextmanager

# Use /data volume on Railway (persistent), fallback to local dir for dev
DATA_DIR = "/data" if os.path.isdir("/data") else os.path.dirname(__file__)
print(f"[DEBUG] Using DATA_DIR: {DATA_DIR}, /data exists: {os.path.isdir('/data')}")
DB_PATH = os.path.join(DATA_DIR, "compound.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS threads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'not_started',
                next_action TEXT,
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL DEFAULT (date('now')),
                category TEXT NOT NULL,
                metric TEXT NOT NULL,
                value REAL NOT NULL,
                notes TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS split_schedule (
                day_index INTEGER PRIMARY KEY CHECK(day_index >= 0 AND day_index <= 6),
                day_type TEXT NOT NULL CHECK(day_type IN ('Pull','Push','Legs','Rest','Upper','Lower'))
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS schedule_state (
                id INTEGER PRIMARY KEY CHECK(id = 1),
                cycle_start_date TEXT
            )
        """)
        # Seed split_schedule if empty
        count = conn.execute("SELECT COUNT(*) FROM split_schedule").fetchone()[0]
        if count == 0:
            conn.executemany(
                "INSERT INTO split_schedule (day_index, day_type) VALUES (?, ?)",
                [(0, 'Pull'), (1, 'Push'), (2, 'Legs'), (3, 'Rest'), (4, 'Upper'), (5, 'Rest'), (6, 'Lower')]
            )
        conn.execute("""
            CREATE TABLE IF NOT EXISTS subtasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                thread_id INTEGER NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
                parent_subtask_id INTEGER REFERENCES subtasks(id) ON DELETE CASCADE,
                description TEXT NOT NULL CHECK(length(description) <= 300 AND length(trim(description)) > 0),
                done INTEGER NOT NULL DEFAULT 0,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_subtasks_thread ON subtasks(thread_id)
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_subtasks_parent ON subtasks(parent_subtask_id)
        """)
        # Ensure schedule_state single-row exists
        conn.execute("INSERT OR IGNORE INTO schedule_state (id, cycle_start_date) VALUES (1, NULL)")
