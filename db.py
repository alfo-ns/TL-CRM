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


def _table_columns(conn, table):
    return {row["name"] for row in conn.execute("PRAGMA table_info(%s)" % table)}


def _migrate(conn):
    """Adds columns introduced after the initial schema to pre-existing
    databases, since CREATE TABLE IF NOT EXISTS leaves old tables untouched.
    Must run before schema.sql's CREATE INDEX statements, since those
    reference these columns and would fail on a pre-existing table that
    doesn't have them yet."""
    if "companies" in _existing_tables(conn):
        company_cols = _table_columns(conn, "companies")
        for col, ddl in (
            ("email", "TEXT NOT NULL DEFAULT ''"),
            ("sito_web", "TEXT NOT NULL DEFAULT ''"),
            ("note", "TEXT NOT NULL DEFAULT ''"),
            ("deleted_at", "TEXT"),
        ):
            if col not in company_cols:
                conn.execute("ALTER TABLE companies ADD COLUMN %s %s" % (col, ddl))
    if "contacts" in _existing_tables(conn):
        contact_cols = _table_columns(conn, "contacts")
        if "deleted_at" not in contact_cols:
            conn.execute("ALTER TABLE contacts ADD COLUMN deleted_at TEXT")
    if "activities" in _existing_tables(conn):
        activity_cols = _table_columns(conn, "activities")
        if "activity_date" not in activity_cols:
            conn.execute("ALTER TABLE activities ADD COLUMN activity_date TEXT NOT NULL DEFAULT ''")
            conn.execute("UPDATE activities SET activity_date = created_at WHERE activity_date = ''")


def _existing_tables(conn):
    return {row["name"] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}


def init_db(seed_if_empty=True):
    conn = _connect()
    try:
        _migrate(conn)
        with open(_SCHEMA_PATH, "r", encoding="utf-8") as f:
            conn.executescript(f.read())
        conn.execute("CREATE INDEX IF NOT EXISTS idx_companies_deleted ON companies(deleted_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_contacts_deleted ON contacts(deleted_at)")
        if seed_if_empty:
            row = conn.execute("SELECT COUNT(*) AS n FROM companies").fetchone()
            if row["n"] == 0:
                from seed import seed_demo_data
                seed_demo_data(conn)
    finally:
        conn.close()
