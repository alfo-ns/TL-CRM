"""Configuration loading: DB path (incl. network shares) and server options.

Precedence for the database path (highest wins):
  1. CRM_DB_PATH environment variable
  2. "db_path" in .env
  3. "db_path" in config.json
  4. default: <app dir>/data/crm.db
"""
import json
import os

APP_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB_PATH = os.path.join(APP_DIR, "data", "crm.db")


def _load_env_file(path):
    values = {}
    if not os.path.isfile(path):
        return values
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key:
                values[key] = value
    return values


def _load_config_json(path):
    if not os.path.isfile(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}


def load_config():
    env_file = _load_env_file(os.path.join(APP_DIR, ".env"))
    config_json = _load_config_json(os.path.join(APP_DIR, "config.json"))

    db_path = (
        os.environ.get("CRM_DB_PATH")
        or env_file.get("CRM_DB_PATH")
        or config_json.get("db_path")
        or DEFAULT_DB_PATH
    )
    db_path = os.path.expandvars(os.path.expanduser(db_path))

    host = os.environ.get("CRM_HOST") or env_file.get("CRM_HOST") or config_json.get("host") or "127.0.0.1"
    port = int(os.environ.get("CRM_PORT") or env_file.get("CRM_PORT") or config_json.get("port") or 5000)
    open_browser_raw = (
        os.environ.get("CRM_OPEN_BROWSER")
        or env_file.get("CRM_OPEN_BROWSER")
        or config_json.get("open_browser")
    )
    if open_browser_raw is None:
        open_browser = True
    else:
        open_browser = str(open_browser_raw).strip().lower() not in ("0", "false", "no")

    return {
        "db_path": db_path,
        "host": host,
        "port": port,
        "open_browser": open_browser,
    }
