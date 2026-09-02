import io
import threading
import webbrowser
from datetime import date

from flask import Flask, jsonify, request, send_file, send_from_directory

import config
import db
import xlsx_io
from constants import ACTION_LABEL, STAGE_INDEX, STAGE_LABEL, STAGE_ORDER, STAGES, ACTION_TYPES

CONFIG = config.load_config()

app = Flask(__name__, static_folder="static", template_folder="templates")
db.init_app(app)


def today_iso():
    return date.today().isoformat()


def today_it():
    d = date.today()
    return d.strftime("%d/%m/%Y")


# ---------------------------------------------------------------- serializers

def serialize_company(row, today):
    stage_entered = date.fromisoformat(row["stage_entered_at"])
    giorni = (today - stage_entered).days
    next_ = None
    if row["next_data"]:
        next_ = {"tipo": row["next_tipo"], "data": row["next_data"], "stadio": row["next_stadio"]}
    return {
        "id": row["id"],
        "nome": row["nome"],
        "settore": row["settore"],
        "dip": row["dip"],
        "valore": row["valore"],
        "stage": row["stage"],
        "maxStageIndex": row["max_stage_index"],
        "portatoDa": row["portato_da"],
        "gestitoDa": row["gestito_da"],
        "bridgeId": row["bridge_id"],
        "giorni": giorni,
        "createdAt": row["created_at"],
        "next": next_,
    }


def serialize_activity(row):
    return {"data": row["data_label"], "tipo": row["tipo"], "testo": row["testo"]}


def serialize_contact(row):
    next_ = None
    if row["next_data"]:
        next_ = {"tipo": row["next_tipo"], "data": row["next_data"], "stadio": row["next_stadio"]}
    return {
        "id": row["id"],
        "companyId": row["company_id"],
        "nome": row["nome"],
        "cognome": row["cognome"],
        "ruolo": row["ruolo"],
        "email": row["email"],
        "tel": row["tel"],
        "linkedin": row["linkedin"],
        "social": row["social"],
        "socialLabel": row["social_label"],
        "note": row["note"],
        "created": row["created_at"],
        "portatoDa": row["portato_da"],
        "gestitoDa": row["gestito_da"],
        "next": next_,
        "dossier": {
            "fonte": row["dossier_fonte"],
            "temperatura": row["dossier_temperatura"],
            "potere": row["dossier_potere"],
            "orario": row["dossier_orario"],
            "interessi": row["dossier_interessi"],
            "competitor": row["dossier_competitor"],
            "argomentiUtili": row["dossier_argomenti_utili"],
            "argomentiEvitare": row["dossier_argomenti_evitare"],
            "eventi": row["dossier_eventi"],
            "libero": row["dossier_libero"],
        },
    }


def serialize_bridge(row, aziende):
    return {
        "id": row["id"],
        "nome": row["nome"],
        "ruolo": row["ruolo"],
        "relazione": row["relazione"],
        "email": row["email"],
        "tel": row["tel"],
        "linkedin": row["linkedin"],
        "note": row["note"],
        "introduzioni": row["introduzioni"],
        "aziende": aziende,
    }


def compute_stage_avg_days(conn, today):
    """Average days spent in each of the first 6 stages (prospect..negoziazione):
    closed stage_history durations plus elapsed time for companies currently
    sitting in that stage — mirrors the prototype's stageTimes panel."""
    tracked = STAGE_ORDER[:6]
    samples = {s: [] for s in tracked}

    for row in conn.execute(
        "SELECT stage, entered_at, left_at FROM stage_history WHERE left_at IS NOT NULL"
    ):
        if row["stage"] in samples:
            d = (date.fromisoformat(row["left_at"]) - date.fromisoformat(row["entered_at"])).days
            samples[row["stage"]].append(d)

    for row in conn.execute("SELECT stage, stage_entered_at FROM companies"):
        if row["stage"] in samples:
            d = (today - date.fromisoformat(row["stage_entered_at"])).days
            if d:
                samples[row["stage"]].append(d)

    out = []
    for s in tracked:
        vals = samples[s]
        avg = sum(vals) / len(vals) if vals else 0
        out.append({"stage": s, "avgDays": round(avg, 1)})
    return out


def full_bootstrap():
    conn = db.get_db()
    today = date.today()

    companies = [serialize_company(r, today) for r in conn.execute("SELECT * FROM companies ORDER BY id")]
    for c in companies:
        att_rows = conn.execute(
            "SELECT * FROM activities WHERE company_id = ? ORDER BY id DESC", (c["id"],)
        ).fetchall()
        c["attivita"] = [serialize_activity(r) for r in att_rows]

    contacts = [serialize_contact(r) for r in conn.execute("SELECT * FROM contacts ORDER BY id")]

    bridges = []
    for r in conn.execute("SELECT * FROM bridges ORDER BY id"):
        aziende = [
            row["id"] for row in conn.execute("SELECT id FROM companies WHERE bridge_id = ? ORDER BY id", (r["id"],))
        ]
        bridges.append(serialize_bridge(r, aziende))

    operators = [{"id": r["id"], "nome": r["nome"]} for r in conn.execute("SELECT * FROM operators ORDER BY id")]

    return {
        "today": today.isoformat(),
        "stages": STAGES,
        "actionTypes": ACTION_TYPES,
        "operators": operators,
        "companies": companies,
        "contacts": contacts,
        "bridges": bridges,
        "stageAvgDays": compute_stage_avg_days(conn, today),
        "dbConfig": {"path": CONFIG["db_path"], "source": config.db_path_source()},
    }


# --------------------------------------------------------------------- pages

@app.get("/")
def index():
    return send_from_directory(app.template_folder, "index.html")


# ---------------------------------------------------------------------- api

@app.get("/api/bootstrap")
def api_bootstrap():
    return jsonify(full_bootstrap())


def _parse_next(body):
    if body.get("nextData"):
        return body.get("nextTipo") or "followup", body["nextData"], body.get("nextStadio") or "lead"
    return None, None, None


@app.post("/api/companies")
def create_company():
    body = request.get_json(force=True) or {}

    def op(conn):
        stage = body.get("stage") or "prospect"
        if stage not in STAGE_INDEX:
            stage = "prospect"
        max_idx = 0 if stage == "perso" else STAGE_INDEX[stage]
        next_tipo, next_data, next_stadio = _parse_next(body)
        now_iso = today_iso()
        cur = conn.execute(
            "INSERT INTO companies (nome, settore, dip, valore, stage, max_stage_index, portato_da, gestito_da, "
            "bridge_id, next_tipo, next_data, next_stadio, stage_entered_at, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)",
            (
                body.get("nome") or "Nuova azienda",
                body.get("settore") or "—",
                int(body.get("dip") or 0),
                int(body.get("valore") or 0),
                stage,
                max_idx,
                body.get("portatoDa") or "",
                body.get("gestitoDa") or "",
                next_tipo,
                next_data,
                next_stadio,
                now_iso,
                now_iso,
            ),
        )
        company_id = cur.lastrowid
        conn.execute(
            "INSERT INTO stage_history (company_id, stage, entered_at, left_at) VALUES (?, ?, ?, NULL)",
            (company_id, stage, now_iso),
        )
        conn.execute(
            "INSERT INTO activities (company_id, data_label, tipo, testo, created_at) VALUES (?, ?, ?, ?, ?)",
            (company_id, today_it(), "Creazione", "Azienda aggiunta al CRM.", now_iso),
        )
        return company_id

    company_id = db.run_write(op)
    payload = full_bootstrap()
    payload["newCompanyId"] = company_id
    return jsonify(payload)


def _move_stage(conn, company_id, new_stage, today_iso_str):
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
    conn.execute(
        "INSERT INTO activities (company_id, data_label, tipo, testo, created_at) VALUES (?, ?, ?, ?, ?)",
        (company_id, today_it(), "Stadio", 'Spostata in "%s".' % STAGE_LABEL[new_stage], today_iso_str),
    )


@app.put("/api/companies/<int:company_id>")
def update_company(company_id):
    body = request.get_json(force=True) or {}

    def op(conn):
        row = conn.execute("SELECT * FROM companies WHERE id = ?", (company_id,)).fetchone()
        if not row:
            return False
        fields = {
            "nome": body.get("nome", row["nome"]),
            "settore": body.get("settore", row["settore"]),
            "dip": int(body["dip"]) if body.get("dip") not in (None, "") else row["dip"],
            "valore": int(body["valore"]) if body.get("valore") not in (None, "") else row["valore"],
            "portato_da": body.get("portatoDa", row["portato_da"]),
            "gestito_da": body.get("gestitoDa", row["gestito_da"]),
        }
        conn.execute(
            "UPDATE companies SET nome=?, settore=?, dip=?, valore=?, portato_da=?, gestito_da=? WHERE id=?",
            (fields["nome"], fields["settore"], fields["dip"], fields["valore"], fields["portato_da"], fields["gestito_da"], company_id),
        )
        if "nextData" in body:
            next_tipo, next_data, next_stadio = _parse_next(body)
            conn.execute(
                "UPDATE companies SET next_tipo=?, next_data=?, next_stadio=? WHERE id=?",
                (next_tipo, next_data, next_stadio, company_id),
            )
        new_stage = body.get("stage")
        if new_stage and new_stage in STAGE_INDEX:
            _move_stage(conn, company_id, new_stage, today_iso())
        return True

    ok = db.run_write(op)
    if not ok:
        return jsonify({"error": "not found"}), 404
    return jsonify(full_bootstrap())


@app.post("/api/companies/<int:company_id>/stage")
def move_company_stage(company_id):
    body = request.get_json(force=True) or {}
    new_stage = body.get("stage")
    if new_stage not in STAGE_INDEX:
        return jsonify({"error": "invalid stage"}), 400

    def op(conn):
        _move_stage(conn, company_id, new_stage, today_iso())

    db.run_write(op)
    return jsonify(full_bootstrap())


@app.post("/api/companies/<int:company_id>/next")
def set_company_next(company_id):
    body = request.get_json(force=True) or {}

    def op(conn):
        row = conn.execute("SELECT * FROM companies WHERE id = ?", (company_id,)).fetchone()
        if not row:
            return
        tipo = body.get("tipo") or row["next_tipo"] or "followup"
        data_ = body.get("data") if "data" in body else row["next_data"]
        stadio = body.get("stadio") or row["next_stadio"] or row["stage"]
        conn.execute(
            "UPDATE companies SET next_tipo=?, next_data=?, next_stadio=? WHERE id=?",
            (tipo, data_, stadio, company_id),
        )

    db.run_write(op)
    return jsonify(full_bootstrap())


@app.post("/api/companies/<int:company_id>/complete-action")
def complete_company_action(company_id):
    def op(conn):
        row = conn.execute("SELECT * FROM companies WHERE id = ?", (company_id,)).fetchone()
        if not row or not row["next_data"]:
            return
        label = ACTION_LABEL.get(row["next_tipo"], row["next_tipo"])
        stage_label = STAGE_LABEL.get(row["next_stadio"], row["next_stadio"])
        conn.execute(
            "UPDATE companies SET next_tipo=NULL, next_data=NULL, next_stadio=NULL WHERE id=?",
            (company_id,),
        )
        conn.execute(
            "INSERT INTO activities (company_id, data_label, tipo, testo, created_at) VALUES (?, ?, ?, ?, ?)",
            (company_id, today_it(), label, "Azione completata sulla trattativa (obiettivo: %s)." % stage_label, today_iso()),
        )

    db.run_write(op)
    return jsonify(full_bootstrap())


@app.post("/api/companies/<int:company_id>/activities")
def add_activity(company_id):
    body = request.get_json(force=True) or {}
    testo = (body.get("testo") or "").strip()
    if not testo:
        return jsonify({"error": "empty"}), 400

    def op(conn):
        conn.execute(
            "INSERT INTO activities (company_id, data_label, tipo, testo, created_at) VALUES (?, ?, ?, ?, ?)",
            (company_id, today_it(), "Nota", testo, today_iso()),
        )

    db.run_write(op)
    return jsonify(full_bootstrap())


@app.delete("/api/companies/<int:company_id>")
def delete_company(company_id):
    def op(conn):
        conn.execute("DELETE FROM companies WHERE id = ?", (company_id,))

    db.run_write(op)
    return jsonify(full_bootstrap())


# --------------------------------------------------------------------- contacts

DOSSIER_FIELDS = {
    "fonte": "dossier_fonte", "temperatura": "dossier_temperatura", "potere": "dossier_potere",
    "orario": "dossier_orario", "interessi": "dossier_interessi", "competitor": "dossier_competitor",
    "argomentiUtili": "dossier_argomenti_utili", "argomentiEvitare": "dossier_argomenti_evitare",
    "eventi": "dossier_eventi", "libero": "dossier_libero",
}


@app.post("/api/contacts")
def create_contact():
    body = request.get_json(force=True) or {}
    company_id = body.get("companyId")
    if not company_id:
        return jsonify({"error": "companyId required"}), 400

    def op(conn):
        next_tipo, next_data, next_stadio = _parse_next(body)
        cols = ["company_id", "nome", "cognome", "ruolo", "email", "tel", "linkedin", "social", "social_label",
                "note", "created_at", "portato_da", "gestito_da", "next_tipo", "next_data", "next_stadio"]
        vals = [
            company_id, body.get("nome") or "Nome", body.get("cognome") or "Cognome", body.get("ruolo") or "—",
            body.get("email") or "—", body.get("tel") or "—", body.get("linkedin") or "—",
            body.get("social") or "—", body.get("socialLabel") or "Instagram", body.get("note") or "",
            today_iso(), body.get("portatoDa") or "", body.get("gestitoDa") or "",
            next_tipo, next_data, next_stadio,
        ]
        for key, col in DOSSIER_FIELDS.items():
            cols.append(col)
            vals.append(body.get(key) or ("Freddo" if key == "temperatura" else "Da capire" if key == "potere" else ""))
        placeholders = ", ".join(["?"] * len(cols))
        conn.execute(f"INSERT INTO contacts ({', '.join(cols)}) VALUES ({placeholders})", vals)

    db.run_write(op)
    return jsonify(full_bootstrap())


@app.put("/api/contacts/<int:contact_id>")
def update_contact(contact_id):
    body = request.get_json(force=True) or {}

    def op(conn):
        row = conn.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,)).fetchone()
        if not row:
            return
        simple = ["nome", "cognome", "ruolo", "email", "tel", "linkedin", "social", "note", "portatoDa", "gestitoDa"]
        col_map = {"nome": "nome", "cognome": "cognome", "ruolo": "ruolo", "email": "email", "tel": "tel",
                   "linkedin": "linkedin", "social": "social", "note": "note",
                   "portatoDa": "portato_da", "gestitoDa": "gestito_da"}
        sets, vals = [], []
        for key in simple:
            if key in body:
                sets.append(f"{col_map[key]} = ?")
                vals.append(body[key])
        for key, col in DOSSIER_FIELDS.items():
            if key in body:
                sets.append(f"{col} = ?")
                vals.append(body[key])
        if "nextData" in body:
            next_tipo, next_data, next_stadio = _parse_next(body)
            sets += ["next_tipo = ?", "next_data = ?", "next_stadio = ?"]
            vals += [next_tipo, next_data, next_stadio]
        if sets:
            vals.append(contact_id)
            conn.execute(f"UPDATE contacts SET {', '.join(sets)} WHERE id = ?", vals)

    db.run_write(op)
    return jsonify(full_bootstrap())


@app.post("/api/contacts/<int:contact_id>/complete-action")
def complete_contact_action(contact_id):
    def op(conn):
        row = conn.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,)).fetchone()
        if not row or not row["next_data"]:
            return
        label = ACTION_LABEL.get(row["next_tipo"], row["next_tipo"])
        conn.execute(
            "UPDATE contacts SET next_tipo=NULL, next_data=NULL, next_stadio=NULL WHERE id=?",
            (contact_id,),
        )
        conn.execute(
            "INSERT INTO activities (company_id, data_label, tipo, testo, created_at) VALUES (?, ?, ?, ?, ?)",
            (row["company_id"], today_it(), label, "%s con %s %s completata." % (label, row["nome"], row["cognome"]), today_iso()),
        )

    db.run_write(op)
    return jsonify(full_bootstrap())


@app.delete("/api/contacts/<int:contact_id>")
def delete_contact(contact_id):
    def op(conn):
        conn.execute("DELETE FROM contacts WHERE id = ?", (contact_id,))

    db.run_write(op)
    return jsonify(full_bootstrap())


# --------------------------------------------------------------------- bridges

@app.post("/api/bridges")
def create_bridge():
    body = request.get_json(force=True) or {}

    def op(conn):
        conn.execute(
            "INSERT INTO bridges (nome, ruolo, relazione, email, tel, linkedin, note, introduzioni) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, 0)",
            (body.get("nome") or "Nuovo bridge", body.get("ruolo") or "—", body.get("relazione") or "Referral",
             body.get("email") or "—", body.get("tel") or "—", body.get("linkedin") or "—", body.get("note") or ""),
        )

    db.run_write(op)
    return jsonify(full_bootstrap())


@app.put("/api/bridges/<int:bridge_id>")
def update_bridge(bridge_id):
    body = request.get_json(force=True) or {}

    def op(conn):
        row = conn.execute("SELECT * FROM bridges WHERE id = ?", (bridge_id,)).fetchone()
        if not row:
            return
        conn.execute(
            "UPDATE bridges SET nome=?, ruolo=?, relazione=?, email=?, tel=?, linkedin=?, note=? WHERE id=?",
            (
                body.get("nome", row["nome"]), body.get("ruolo", row["ruolo"]), body.get("relazione", row["relazione"]),
                body.get("email", row["email"]), body.get("tel", row["tel"]), body.get("linkedin", row["linkedin"]),
                body.get("note", row["note"]) if body.get("note") is not None else row["note"], bridge_id,
            ),
        )

    db.run_write(op)
    return jsonify(full_bootstrap())


@app.delete("/api/bridges/<int:bridge_id>")
def delete_bridge(bridge_id):
    def op(conn):
        conn.execute("DELETE FROM bridges WHERE id = ?", (bridge_id,))

    db.run_write(op)
    return jsonify(full_bootstrap())


@app.post("/api/bridges/<int:bridge_id>/link")
def link_bridge(bridge_id):
    body = request.get_json(force=True) or {}
    company_id = body.get("companyId")

    def op(conn):
        bridge = conn.execute("SELECT * FROM bridges WHERE id = ?", (bridge_id,)).fetchone()
        if not bridge or not company_id:
            return
        conn.execute("UPDATE companies SET bridge_id = ? WHERE id = ?", (bridge_id, company_id))
        conn.execute(
            "INSERT INTO activities (company_id, data_label, tipo, testo, created_at) VALUES (?, ?, ?, ?, ?)",
            (company_id, today_it(), "Bridge", "Collegata al bridge contact %s." % bridge["nome"], today_iso()),
        )

    db.run_write(op)
    return jsonify(full_bootstrap())


@app.post("/api/bridges/<int:bridge_id>/unlink")
def unlink_bridge(bridge_id):
    body = request.get_json(force=True) or {}
    company_id = body.get("companyId")

    def op(conn):
        conn.execute(
            "UPDATE companies SET bridge_id = NULL WHERE id = ? AND bridge_id = ?", (company_id, bridge_id)
        )

    db.run_write(op)
    return jsonify(full_bootstrap())


# ------------------------------------------------------------------- operators

@app.post("/api/operators")
def create_operator():
    body = request.get_json(force=True) or {}
    nome = (body.get("nome") or "").strip()
    if not nome:
        return jsonify({"error": "nome required"}), 400

    def op(conn):
        conn.execute("INSERT OR IGNORE INTO operators (nome) VALUES (?)", (nome,))

    db.run_write(op)
    return jsonify(full_bootstrap())


@app.put("/api/operators/<int:operator_id>")
def rename_operator(operator_id):
    body = request.get_json(force=True) or {}
    new_name = (body.get("nome") or "").strip()
    if not new_name:
        return jsonify({"error": "nome required"}), 400

    def op(conn):
        row = conn.execute("SELECT * FROM operators WHERE id = ?", (operator_id,)).fetchone()
        if not row:
            return
        old_name = row["nome"]
        conn.execute("UPDATE operators SET nome = ? WHERE id = ?", (new_name, operator_id))
        if old_name != new_name:
            conn.execute("UPDATE companies SET portato_da = ? WHERE portato_da = ?", (new_name, old_name))
            conn.execute("UPDATE companies SET gestito_da = ? WHERE gestito_da = ?", (new_name, old_name))
            conn.execute("UPDATE contacts SET portato_da = ? WHERE portato_da = ?", (new_name, old_name))
            conn.execute("UPDATE contacts SET gestito_da = ? WHERE gestito_da = ?", (new_name, old_name))

    db.run_write(op)
    return jsonify(full_bootstrap())


@app.delete("/api/operators/<int:operator_id>")
def delete_operator(operator_id):
    def op(conn):
        conn.execute("DELETE FROM operators WHERE id = ?", (operator_id,))

    db.run_write(op)
    return jsonify(full_bootstrap())


# ------------------------------------------------------------------------ config

@app.post("/api/config/db-path")
def set_db_path():
    body = request.get_json(force=True) or {}
    new_path = (body.get("path") or "").strip()
    if not new_path:
        return jsonify({"error": "percorso mancante"}), 400
    if config.db_path_source() in ("env", "dotenv"):
        return jsonify({
            "error": "Il percorso è impostato da una variabile d'ambiente o da un file .env, "
                     "che hanno priorità su questa impostazione. Rimuovi CRM_DB_PATH da lì per "
                     "poterlo cambiare da qui."
        }), 409

    config.set_db_path(new_path)
    return jsonify({"path": new_path, "requiresRestart": True})


# --------------------------------------------------------------- export/import

@app.get("/api/export/xlsx")
def export_xlsx():
    conn = db.get_db()
    wb = xlsx_io.build_workbook(conn)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    filename = "vendite-crm-export-%s.xlsx" % today_iso()
    return send_file(
        buf, as_attachment=True, download_name=filename,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@app.post("/api/import/xlsx/preview")
def import_xlsx_preview():
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "nessun file ricevuto"}), 400
    conn = db.get_db()
    try:
        plan = xlsx_io.parse_workbook(file.stream, conn)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception:
        return jsonify({"error": "file non leggibile: verifica che sia un .xlsx esportato da questa app"}), 400
    return jsonify(plan.summary())


@app.post("/api/import/xlsx/apply")
def import_xlsx_apply():
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "nessun file ricevuto"}), 400
    conn = db.get_db()
    try:
        plan = xlsx_io.parse_workbook(file.stream, conn)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception:
        return jsonify({"error": "file non leggibile: verifica che sia un .xlsx esportato da questa app"}), 400

    def op(conn):
        xlsx_io.apply_import(conn, plan, today_iso(), today_it())

    db.run_write(op)
    payload = full_bootstrap()
    payload["importSummary"] = plan.summary()
    return jsonify(payload)


# ------------------------------------------------------------------------ boot

def _open_browser(host, port):
    webbrowser.open(f"http://{host}:{port}/")


if __name__ == "__main__":
    with app.app_context():
        db.init_db()
    if CONFIG["open_browser"]:
        threading.Timer(1.0, _open_browser, args=(CONFIG["host"], CONFIG["port"])).start()
    app.run(host=CONFIG["host"], port=CONFIG["port"], debug=False)
