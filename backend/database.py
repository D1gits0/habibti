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
