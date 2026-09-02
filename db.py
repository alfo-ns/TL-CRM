"""SQLite access layer.

Designed for a database file that may live on a shared network drive and be
opened concurrently by several instances of this app on different PCs:
  - WAL journal mode (readers don't block writers, writers don't block readers)
  - a generous busy_timeout so a writer waits instead of failing immediately
  - an explicit retry-with-backoff wrapper around commits/writes for the
    rare case where SQLITE_BUSY/SQLITE_LOCKED still surfaces
  - writes use BEGIN IMMEDIATE to fail fast on a real conflict rather than
    upgrading a read lock to a write lock mid-transaction
"""
import os
import sqlite3
import time

from flask import g

from config import load_config

_CONFIG = load_config()
DB_PATH = _CONFIG["db_path"]

_SCHEMA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "schema.sql")

_MAX_RETRIES = 6
_RETRY_BASE_DELAY = 0.15


def _connect():
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=30, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA busy_timeout=8000")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def get_db():
    if "db" not in g:
        g.db = _connect()
    return g.db


def close_db(_exc=None):
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


def init_app(app):
    app.teardown_appcontext(close_db)


def _is_locked_error(exc):
    msg = str(exc).lower()
    return "locked" in msg or "busy" in msg


def run_write(fn):
    """Run fn(conn) inside a BEGIN IMMEDIATE transaction, retrying on
    SQLITE_BUSY/SQLITE_LOCKED with exponential backoff. fn must not commit
    itself; this wrapper commits (or rolls back) around it."""
    conn = get_db()
    last_exc = None
    for attempt in range(_MAX_RETRIES):
        try:
            conn.execute("BEGIN IMMEDIATE")
            try:
                result = fn(conn)
            except Exception:
                conn.execute("ROLLBACK")
                raise
            conn.execute("COMMIT")
            return result
        except sqlite3.OperationalError as exc:
            last_exc = exc
            if _is_locked_error(exc) and attempt < _MAX_RETRIES - 1:
                time.sleep(_RETRY_BASE_DELAY * (2 ** attempt))
                continue
            raise
    raise last_exc


def init_db(seed_if_empty=True):
    conn = _connect()
    try:
        with open(_SCHEMA_PATH, "r", encoding="utf-8") as f:
            conn.executescript(f.read())
        if seed_if_empty:
            row = conn.execute("SELECT COUNT(*) AS n FROM companies").fetchone()
            if row["n"] == 0:
                from seed import seed_demo_data
                seed_demo_data(conn)
    finally:
        conn.close()
