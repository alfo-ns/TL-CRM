"""Shared logic for moving a company between pipeline stages, keeping
stage_history and max_stage_index consistent. Used both by the live
"move stage" API action and by the XLSX import (a row that updates an
existing company to a different stage must go through the exact same
bookkeeping, or stats like the funnel and "time per stage" go stale)."""
from constants import STAGE_INDEX, STAGE_LABEL


def move_stage(conn, company_id, new_stage, today_iso_str, activity_label_fn):
    """Moves company_id to new_stage if it isn't already there: closes the
    open stage_history row, opens a new one, bumps max_stage_index, and logs
    an activity. activity_label_fn(company_id, text) inserts the activity row
    (callers already have their own today_it()-formatted label helper)."""
    row = conn.execute("SELECT * FROM companies WHERE id = ?", (company_id,)).fetchone()
    if not row or new_stage == row["stage"]:
        return
    conn.execute(
        "UPDATE stage_history SET left_at = ? WHERE company_id = ? AND left_at IS NULL",
        (today_iso_str, company_id),
    )
    conn.execute(
        "INSERT INTO stage_history (company_id, stage, entered_at, left_at) VALUES (?, ?, ?, NULL)",
        (company_id, new_stage, today_iso_str),
    )
    new_max = row["max_stage_index"] if new_stage == "perso" else max(row["max_stage_index"], STAGE_INDEX[new_stage])
    conn.execute(
        "UPDATE companies SET stage = ?, stage_entered_at = ?, max_stage_index = ? WHERE id = ?",
        (new_stage, today_iso_str, new_max, company_id),
    )
    activity_label_fn(company_id, 'Spostata in "%s".' % STAGE_LABEL[new_stage])
