PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS operators (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS bridges (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  nome         TEXT NOT NULL,
  ruolo        TEXT NOT NULL DEFAULT '',
  relazione    TEXT NOT NULL DEFAULT 'Referral',
  email        TEXT NOT NULL DEFAULT '',
  tel          TEXT NOT NULL DEFAULT '',
  linkedin     TEXT NOT NULL DEFAULT '',
  note         TEXT NOT NULL DEFAULT '',
  introduzioni INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS companies (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  nome             TEXT NOT NULL,
  settore          TEXT NOT NULL DEFAULT '',
  dip              INTEGER NOT NULL DEFAULT 0,
  valore           INTEGER NOT NULL DEFAULT 0,
  stage            TEXT NOT NULL DEFAULT 'prospect',
  max_stage_index  INTEGER NOT NULL DEFAULT 0,
  portato_da       TEXT NOT NULL DEFAULT '',
  gestito_da       TEXT NOT NULL DEFAULT '',
  bridge_id        INTEGER REFERENCES bridges(id) ON DELETE SET NULL,
  next_tipo        TEXT,
  next_data        TEXT,
  next_stadio      TEXT,
  stage_entered_at TEXT NOT NULL,
  created_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_companies_bridge ON companies(bridge_id);
CREATE INDEX IF NOT EXISTS idx_companies_stage ON companies(stage);

CREATE TABLE IF NOT EXISTS contacts (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id                INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nome                      TEXT NOT NULL DEFAULT '',
  cognome                   TEXT NOT NULL DEFAULT '',
  ruolo                     TEXT NOT NULL DEFAULT '',
  email                     TEXT NOT NULL DEFAULT '',
  tel                       TEXT NOT NULL DEFAULT '',
  linkedin                  TEXT NOT NULL DEFAULT '',
  social                    TEXT NOT NULL DEFAULT '',
  social_label              TEXT NOT NULL DEFAULT 'Instagram',
  note                      TEXT NOT NULL DEFAULT '',
  created_at                TEXT NOT NULL,
  portato_da                TEXT NOT NULL DEFAULT '',
  gestito_da                TEXT NOT NULL DEFAULT '',
  next_tipo                 TEXT,
  next_data                 TEXT,
  next_stadio               TEXT,
  dossier_fonte             TEXT NOT NULL DEFAULT '',
  dossier_temperatura       TEXT NOT NULL DEFAULT 'Freddo',
  dossier_potere            TEXT NOT NULL DEFAULT 'Da capire',
  dossier_orario            TEXT NOT NULL DEFAULT '',
  dossier_interessi         TEXT NOT NULL DEFAULT '',
  dossier_competitor        TEXT NOT NULL DEFAULT '',
  dossier_argomenti_utili   TEXT NOT NULL DEFAULT '',
  dossier_argomenti_evitare TEXT NOT NULL DEFAULT '',
  dossier_eventi            TEXT NOT NULL DEFAULT '',
  dossier_libero            TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);

CREATE TABLE IF NOT EXISTS stage_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  stage       TEXT NOT NULL,
  entered_at  TEXT NOT NULL,
  left_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_stage_history_company ON stage_history(company_id);
CREATE INDEX IF NOT EXISTS idx_stage_history_stage ON stage_history(stage);

CREATE TABLE IF NOT EXISTS activities (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  data_label  TEXT NOT NULL,
  tipo        TEXT NOT NULL,
  testo       TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activities_company ON activities(company_id);
