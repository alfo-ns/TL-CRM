"""Shared date formatting helpers, used by both app.py and xlsx_io.py
(kept in their own module to avoid a circular import between the two)."""
from datetime import date


def today_iso():
    return date.today().isoformat()


def today_it():
    return date.today().strftime("%d/%m/%Y")


def format_it(iso_date):
    return date.fromisoformat(iso_date).strftime("%d/%m/%Y")
