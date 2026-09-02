"""Demo data seed — mirrors the dataset in the Claude Design prototype
(CRM Vendite.dc.html): 2 operators, 18 companies/deals, 22 contacts with
dossier profiling, 4 bridge contacts.

Only runs once, when the companies table is empty (see db.init_db).
"""
from datetime import date, timedelta

from constants import STAGE_ORDER

TODAY = date(2026, 9, 1)


def _iso(d):
    return d.strftime("%Y-%m-%d")


def _stage_chain(dur, current_stage, giorni):
    """Reconstruct (stage, entered_at, left_at) history plus the company's
    created_at and the entered_at of its current stage, from a list of
    per-stage day-counts (oldest first) and days-in-current-stage."""
    current_entered = TODAY - timedelta(days=giorni)
    history = []
    left_at = current_entered
    entered_at = current_entered
    for d in reversed(dur):
        idx = len(history)
        entered_at = left_at - timedelta(days=d)
        history.append((entered_at, left_at, d))
        left_at = entered_at
    history.reverse()
    stage_ids = STAGE_ORDER[: len(dur)]
    rows = [
        (stage_ids[i], _iso(history[i][0]), _iso(history[i][1]))
        for i in range(len(dur))
    ]
    created_at = _iso(history[0][0]) if history else _iso(current_entered)
    return rows, created_at, _iso(current_entered)


COMPANIES = [
    dict(nome="Rossi Meccanica Srl", settore="Meccanica di precisione", dip=45, valore=68000, stage="negoziazione", giorni=11, dur=[3, 3, 6, 8, 15], portatoDa="Alfonso", gestitoDa="Alfonso", bridge=3, next=("call", "2026-09-02", "vinto"), att=[
        ("18/08/2026", "Call", "Revisione condizioni di pagamento, richiesta dilazione a 60 giorni."),
        ("05/08/2026", "Proposta", "Inviata offerta per 3 linee di collaudo."),
        ("22/07/2026", "Visita", "Sopralluogo stabilimento con il responsabile produzione."),
    ]),
    dict(nome="NordVetro SpA", settore="Vetro industriale", dip=220, valore=154000, stage="proposta", giorni=8, dur=[4, 5, 9, 12], portatoDa="Angelo", gestitoDa="Alfonso", bridge=1, next=("followup", "2026-09-03", "negoziazione"), att=[
        ("24/08/2026", "Email", "Offerta inviata al CFO, attesa feedback del comitato acquisti."),
        ("10/08/2026", "Call", "Definiti volumi annuali attesi."),
    ]),
    dict(nome="Caffè Aurora", settore="Food & Beverage", dip=12, valore=18500, stage="contattato", giorni=6, dur=[5, 4], portatoDa="Angelo", gestitoDa="Angelo", bridge=None, next=("call", "2026-08-28", "qualificato"), att=[
        ("26/08/2026", "Email", "Primo contatto, inviata presentazione aziendale."),
    ]),
    dict(nome="Delta Logistica", settore="Logistica", dip=90, valore=96000, stage="qualificato", giorni=13, dur=[3, 6, 7], portatoDa="Alfonso", gestitoDa="Angelo", bridge=2, next=("incontro", "2026-09-08", "proposta"), att=[
        ("19/08/2026", "Call", "Budget confermato per Q4, decisore identificato nel COO."),
    ]),
    dict(nome="Bianchi Costruzioni", settore="Edilizia", dip=60, valore=120000, stage="vinto", giorni=4, dur=[2, 4, 5, 9, 11, 7], portatoDa="Alfonso", gestitoDa="Alfonso", bridge=None, next=None, att=[
        ("28/08/2026", "Chiusura", "Contratto firmato, avvio lavori a settembre."),
        ("20/08/2026", "Negoziazione", "Accordato sconto 4% su volume."),
    ]),
    dict(nome="Studio Legale Ferri", settore="Servizi professionali", dip=8, valore=12000, stage="lead", giorni=3, dur=[6], portatoDa="Angelo", gestitoDa="Angelo", bridge=None, next=("email", "2026-09-01", "contattato"), att=[
        ("29/08/2026", "Lead", "Richiesta informazioni dal sito web."),
    ]),
    dict(nome="TecnoPlast Srl", settore="Materie plastiche", dip=35, valore=54000, stage="perso", giorni=21, dur=[4, 5, 8, 10], portatoDa="Alfonso", gestitoDa="Alfonso", bridge=None, next=None, att=[
        ("12/08/2026", "Perso", "Scelto fornitore storico, prezzo non competitivo."),
    ]),
    dict(nome="Verdi Agroalimentare", settore="Agroalimentare", dip=150, valore=88000, stage="vinto", giorni=9, dur=[3, 3, 7, 10, 9, 6], portatoDa="Angelo", gestitoDa="Angelo", bridge=4, next=None, att=[
        ("21/08/2026", "Chiusura", "Ordine confermato, primo lotto in consegna."),
    ]),
    dict(nome="Moda Lenti", settore="Retail ottica", dip=25, valore=32000, stage="lead", giorni=5, dur=[7], portatoDa="Alfonso", gestitoDa="Alfonso", bridge=None, next=("linkedin", "2026-09-02", "contattato"), att=[
        ("27/08/2026", "Lead", "Contatto raccolto in fiera MIDO."),
    ]),
    dict(nome="Sicura Impianti", settore="Impiantistica", dip=40, valore=47500, stage="contattato", giorni=9, dur=[4, 6], portatoDa="Angelo", gestitoDa="Alfonso", bridge=None, next=("call", "2026-09-04", "qualificato"), att=[
        ("23/08/2026", "Call", "Interesse su manutenzione programmata."),
    ]),
    dict(nome="Marina Yachting Service", settore="Nautica", dip=18, valore=76000, stage="qualificato", giorni=7, dur=[3, 5, 10], portatoDa="Alfonso", gestitoDa="Angelo", bridge=None, next=("incontro", "2026-09-10", "proposta"), att=[
        ("25/08/2026", "Riunione", "Qualificato: refitting di 4 imbarcazioni entro marzo."),
    ]),
    dict(nome="Alpe Termotecnica", settore="HVAC", dip=55, valore=61000, stage="negoziazione", giorni=15, dur=[5, 4, 6, 11, 13], portatoDa="Angelo", gestitoDa="Angelo", bridge=1, next=("call", "2026-08-31", "vinto"), att=[
        ("20/08/2026", "Negoziazione", "Trattativa su tempi di consegna e penali."),
    ]),
    dict(nome="Byte Officina", settore="Servizi IT", dip=22, valore=29000, stage="proposta", giorni=5, dur=[2, 3, 5, 8], portatoDa="Alfonso", gestitoDa="Alfonso", bridge=2, next=("followup", "2026-09-07", "negoziazione"), att=[
        ("27/08/2026", "Proposta", "Preventivo annuale inviato al CTO."),
    ]),
    dict(nome="Ceramiche Solaro", settore="Ceramica", dip=130, valore=138000, stage="perso", giorni=30, dur=[4, 6, 9, 14, 12], portatoDa="Angelo", gestitoDa="Angelo", bridge=None, next=None, att=[
        ("02/08/2026", "Perso", "Investimento rinviato al prossimo esercizio."),
    ]),
    dict(nome="Officine Zanetti", settore="Carpenteria", dip=28, valore=40000, stage="prospect", giorni=6, dur=[], portatoDa="Alfonso", gestitoDa="Alfonso", bridge=None, next=("linkedin", "2026-09-01", "lead"), att=[
        ("26/08/2026", "Raccolta", "Inserita da lista Camera di Commercio, in target da verificare."),
    ]),
    dict(nome="GreenPack Srl", settore="Packaging sostenibile", dip=65, valore=72000, stage="prospect", giorni=2, dur=[], portatoDa="Angelo", gestitoDa="Angelo", bridge=None, next=("linkedin", "2026-09-03", "lead"), att=[
        ("30/08/2026", "Raccolta", "Trovata su ricerca settore packaging, referente non ancora identificato."),
    ]),
    dict(nome="Tessitura Brenta", settore="Tessile", dip=110, valore=95000, stage="prospect", giorni=9, dur=[], portatoDa="Angelo", gestitoDa="Alfonso", bridge=3, next=("email", "2026-08-29", "lead"), att=[
        ("23/08/2026", "Raccolta", "Segnalata in associazione di categoria, verificare volumi."),
    ]),
    dict(nome="Hotel Belvedere", settore="Ospitalità", dip=34, valore=26000, stage="prospect", giorni=4, dur=[], portatoDa="Alfonso", gestitoDa="Alfonso", bridge=None, next=("followup", "2026-09-15", "lead"), att=[
        ("28/08/2026", "Raccolta", "Lista strutture 4 stelle area lacustre."),
    ]),
]

# contacts: company index is 1-based, matching COMPANIES list order above
CONTACTS = [
    dict(cid=1, nome="Marco", cognome="Rossi", ruolo="Direttore Generale", email="m.rossi@rossimeccanica.it", tel="+39 335 214 8890", linkedin="/in/marcorossi", social="@rossimeccanica", socialLabel="Instagram", note="Decisore finale. Preferisce essere contattato la mattina.", created="2026-07-14", portatoDa="Alfonso", gestitoDa="Alfonso", next=("call", "2026-09-02", "vinto"), dossier=dict(fonte="Referral di Andrea Ceccato", temperatura="Caldo", potere="Decisore", orario="Mattina, telefono diretto", interessi="Ciclismo, vini del Collio", competitor="Fornitore storico locale", argomentiUtili="Riduzione fermi macchina, garanzia 5 anni", argomentiEvitare="Confronto diretto con il fornitore attuale", eventi="MECSPE, EMO Hannover", libero="Il figlio è entrato in azienda quest'anno: sta spingendo per digitalizzare, buon alleato interno.")),
    dict(cid=1, nome="Elena", cognome="Fabbri", ruolo="Responsabile Acquisti", email="e.fabbri@rossimeccanica.it", tel="+39 340 771 2214", linkedin="/in/elenafabbri", social="@e_fabbri", socialLabel="X", note="", created="2026-07-28", portatoDa="Alfonso", gestitoDa="Alfonso", next=("email", "2026-09-05", "vinto"), dossier=dict(fonte="LinkedIn", temperatura="Tiepido", potere="Gatekeeper", orario="Solo email", interessi="", competitor="", argomentiUtili="Tempi di consegna certi", argomentiEvitare="", eventi="", libero="")),
    dict(cid=2, nome="Giulia", cognome="Moretti", ruolo="CFO", email="g.moretti@nordvetro.com", tel="+39 02 4471 220", linkedin="/in/giuliamoretti", social="@gmoretti", socialLabel="X", note="Molto attenta al ROI: portare business case numerico.", created="2026-08-03", portatoDa="Angelo", gestitoDa="Alfonso", next=("followup", "2026-09-03", "negoziazione"), dossier=dict(fonte="Introdotta da Giovanni Sartori", temperatura="Tiepido", potere="Decisore", orario="Pomeriggio tardi", interessi="Maratone, finanza sostenibile", competitor="Soluzione interna a Excel", argomentiUtili="Payback in 14 mesi, contratto annuale", argomentiEvitare="Impegni pluriennali", eventi="Glasstec", libero="Parla tedesco, apprezza documentazione tecnica in inglese.")),
    dict(cid=2, nome="Andrea", cognome="Pozzi", ruolo="Plant Manager", email="a.pozzi@nordvetro.com", tel="+39 348 990 1177", linkedin="/in/andreapozzi", social="@nordvetro", socialLabel="Instagram", note="", created="2026-08-11", portatoDa="Angelo", gestitoDa="Angelo", next=("call", "2026-09-09", "negoziazione"), dossier=dict(fonte="Fiera Glasstec", temperatura="Tiepido", potere="Influenzatore", orario="Early morning", interessi="Automazione", competitor="", argomentiUtili="Formazione operatori inclusa", argomentiEvitare="", eventi="Glasstec", libero="")),
    dict(cid=3, nome="Sara", cognome="Conti", ruolo="Titolare", email="sara@caffeaurora.it", tel="+39 333 445 6621", linkedin="/in/saraconti", social="@caffeaurora", socialLabel="Instagram", note="Piccola realtà, sensibile al prezzo.", created="2026-08-26", portatoDa="Angelo", gestitoDa="Angelo", next=("call", "2026-08-28", "qualificato"), dossier=dict(fonte="Instagram DM", temperatura="Caldo", potere="Decisore", orario="Dopo le 15", interessi="Latte art, torrefazione", competitor="", argomentiUtili="Pagamento rateale", argomentiEvitare="Volumi minimi elevati", eventi="HostMilano", libero="Apre un secondo locale a novembre: leva perfetta per il timing.")),
    dict(cid=4, nome="Luca", cognome="Bernardi", ruolo="COO", email="l.bernardi@deltalogistica.it", tel="+39 339 220 4410", linkedin="/in/lucabernardi", social="@lbernardi", socialLabel="X", note="Decisore economico.", created="2026-08-02", portatoDa="Alfonso", gestitoDa="Angelo", next=("incontro", "2026-09-08", "proposta"), dossier=dict(fonte="Introdotto da Laura Meneghin", temperatura="Caldo", potere="Decisore", orario="Video call, mattina", interessi="Vela", competitor="WMS proprietario", argomentiUtili="Integrazione senza fermo operativo", argomentiEvitare="Migrazione dati massiva", eventi="LetExpo", libero="")),
    dict(cid=4, nome="Chiara", cognome="Vitale", ruolo="IT Manager", email="c.vitale@deltalogistica.it", tel="+39 351 118 7742", linkedin="/in/chiaravitale", social="@chiara.vitale", socialLabel="Instagram", note="Referente tecnico per integrazione WMS.", created="2026-08-18", portatoDa="Alfonso", gestitoDa="Angelo", next=("email", "2026-09-04", "proposta"), dossier=dict(fonte="LinkedIn", temperatura="Tiepido", potere="Influenzatore", orario="Slack/email", interessi="Open source", competitor="", argomentiUtili="API documentate, ambiente di test", argomentiEvitare="", eventi="", libero="")),
    dict(cid=5, nome="Paolo", cognome="Bianchi", ruolo="Amministratore", email="p.bianchi@bianchicostruzioni.it", tel="+39 335 990 1120", linkedin="/in/paolobianchi", social="@bianchicostruzioni", socialLabel="Instagram", note="Cliente acquisito: pianificare upsell manutenzione.", created="2026-06-22", portatoDa="Alfonso", gestitoDa="Alfonso", next=("followup", "2026-09-22", "vinto"), dossier=dict(fonte="Cold call", temperatura="Caldo", potere="Decisore", orario="Cantiere, dopo le 17", interessi="Calcio, caccia", competitor="", argomentiUtili="Manutenzione programmata", argomentiEvitare="", eventi="SAIE", libero="Ottimo candidato come bridge: conosce mezzo distretto edile.")),
    dict(cid=6, nome="Alessandro", cognome="Ferri", ruolo="Partner", email="a.ferri@studioferri.legal", tel="+39 02 7788 991", linkedin="/in/alessandroferri", social="@studioferri", socialLabel="X", note="Lead inbound da form sito.", created="2026-08-29", portatoDa="Angelo", gestitoDa="Angelo", next=("email", "2026-09-01", "contattato"), dossier=dict(fonte="Form sito web", temperatura="Tiepido", potere="Decisore", orario="Mattina presto", interessi="Arte contemporanea", competitor="", argomentiUtili="Compliance e privacy", argomentiEvitare="", eventi="", libero="")),
    dict(cid=7, nome="Davide", cognome="Gallo", ruolo="Responsabile Produzione", email="d.gallo@tecnoplast.it", tel="+39 347 552 3389", linkedin="/in/davidegallo", social="@tecnoplast", socialLabel="Instagram", note="Riprovare fra 6 mesi.", created="2026-06-30", portatoDa="Alfonso", gestitoDa="Alfonso", next=("followup", "2027-02-01", "lead"), dossier=dict(fonte="Cold email", temperatura="Freddo", potere="Influenzatore", orario="", interessi="", competitor="Fornitore storico", argomentiUtili="", argomentiEvitare="Prezzo", eventi="Plast", libero="")),
    dict(cid=8, nome="Martina", cognome="Verdi", ruolo="Direttore Commerciale", email="m.verdi@verdiagro.it", tel="+39 342 667 8812", linkedin="/in/martinaverdi", social="@martina.verdi", socialLabel="Instagram", note="", created="2026-07-06", portatoDa="Angelo", gestitoDa="Angelo", next=("incontro", "2026-09-18", "vinto"), dossier=dict(fonte="Referral di Silvia Trevisan", temperatura="Caldo", potere="Decisore", orario="Mattina", interessi="Cucina, agricoltura rigenerativa", competitor="", argomentiUtili="Tracciabilità filiera", argomentiEvitare="", eventi="Cibus, Tuttofood", libero="")),
    dict(cid=8, nome="Stefano", cognome="Rizzo", ruolo="Responsabile Qualità", email="s.rizzo@verdiagro.it", tel="+39 349 221 0034", linkedin="/in/stefanorizzo", social="@srizzo", socialLabel="X", note="Richiede certificazioni aggiornate.", created="2026-08-14", portatoDa="Angelo", gestitoDa="Angelo", next=None, dossier=dict(fonte="Interno", temperatura="Tiepido", potere="Gatekeeper", orario="", interessi="", competitor="", argomentiUtili="Certificazioni IFS", argomentiEvitare="", eventi="", libero="")),
    dict(cid=9, nome="Federica", cognome="Sala", ruolo="Buyer", email="f.sala@modalenti.it", tel="+39 366 447 1123", linkedin="/in/federicasala", social="@modalenti", socialLabel="Instagram", note="Contatto da fiera, da qualificare.", created="2026-08-27", portatoDa="Alfonso", gestitoDa="Alfonso", next=("linkedin", "2026-09-02", "contattato"), dossier=dict(fonte="Fiera MIDO", temperatura="Freddo", potere="Influenzatore", orario="", interessi="Design, occhiali vintage", competitor="", argomentiUtili="Margine sul riassortimento", argomentiEvitare="", eventi="MIDO", libero="")),
    dict(cid=10, nome="Nicola", cognome="Greco", ruolo="Titolare", email="n.greco@sicuraimpianti.it", tel="+39 331 889 2245", linkedin="/in/nicolagreco", social="@sicuraimpianti", socialLabel="Instagram", note="", created="2026-08-21", portatoDa="Angelo", gestitoDa="Alfonso", next=("call", "2026-09-04", "qualificato"), dossier=dict(fonte="Cold call", temperatura="Tiepido", potere="Decisore", orario="Pausa pranzo", interessi="Moto", competitor="", argomentiUtili="Manutenzione programmata", argomentiEvitare="", eventi="", libero="")),
    dict(cid=11, nome="Roberto", cognome="Marino", ruolo="General Manager", email="r.marino@marinayachting.it", tel="+39 335 004 7781", linkedin="/in/robertomarino", social="@marinayachting", socialLabel="Instagram", note="Budget confermato per refitting.", created="2026-08-08", portatoDa="Alfonso", gestitoDa="Angelo", next=("incontro", "2026-09-10", "proposta"), dossier=dict(fonte="LinkedIn", temperatura="Caldo", potere="Decisore", orario="Mattina in cantiere", interessi="Vela d'altura", competitor="", argomentiUtili="Tempi refitting invernali", argomentiEvitare="", eventi="Salone Nautico Genova", libero="")),
    dict(cid=11, nome="Ilaria", cognome="De Santis", ruolo="Ufficio Tecnico", email="i.desantis@marinayachting.it", tel="+39 340 332 5567", linkedin="/in/ilariadesantis", social="@ide_santis", socialLabel="X", note="", created="2026-08-24", portatoDa="Alfonso", gestitoDa="Angelo", next=("email", "2026-09-11", "proposta"), dossier=dict(fonte="Interno", temperatura="Tiepido", potere="Utente finale", orario="", interessi="", competitor="", argomentiUtili="Schede tecniche", argomentiEvitare="", eventi="", libero="")),
    dict(cid=12, nome="Matteo", cognome="Colombo", ruolo="Direttore Tecnico", email="m.colombo@alpetermo.it", tel="+39 346 771 9902", linkedin="/in/matteocolombo", social="@alpetermotecnica", socialLabel="Instagram", note="Trattativa in corso su penali di consegna.", created="2026-07-19", portatoDa="Angelo", gestitoDa="Angelo", next=("call", "2026-08-31", "vinto"), dossier=dict(fonte="Introdotto da Giovanni Sartori", temperatura="Caldo", potere="Decisore", orario="Sera", interessi="Sci alpinismo", competitor="Fornitore tedesco", argomentiUtili="Assistenza in 24h", argomentiEvitare="Penali reciproche", eventi="MCE Milano", libero="Molto tecnico: apprezza dettagli, non le presentazioni commerciali.")),
    dict(cid=13, nome="Simone", cognome="Fontana", ruolo="CTO", email="s.fontana@byteofficina.it", tel="+39 328 554 1190", linkedin="/in/simonefontana", social="@sfontana", socialLabel="X", note="Valuta anche due competitor.", created="2026-08-13", portatoDa="Alfonso", gestitoDa="Alfonso", next=("followup", "2026-09-07", "negoziazione"), dossier=dict(fonte="Introdotto da Laura Meneghin", temperatura="Tiepido", potere="Decisore", orario="Async, Slack", interessi="Rust, homelab", competitor="Due vendor cloud", argomentiUtili="SLA e on-prem opzionale", argomentiEvitare="Lock-in", eventi="Codemotion", libero="")),
    dict(cid=14, nome="Anna", cognome="Solaro", ruolo="CEO", email="a.solaro@ceramichesolaro.it", tel="+39 335 660 3321", linkedin="/in/annasolaro", social="@ceramichesolaro", socialLabel="Instagram", note="Ricontattare a gennaio per nuovo budget.", created="2026-06-11", portatoDa="Angelo", gestitoDa="Angelo", next=("followup", "2027-01-15", "lead"), dossier=dict(fonte="Referral", temperatura="Freddo", potere="Decisore", orario="", interessi="Design ceramico", competitor="", argomentiUtili="", argomentiEvitare="Budget 2026", eventi="Cersaie", libero="")),
    dict(cid=14, nome="Giorgio", cognome="Pinna", ruolo="Responsabile Export", email="g.pinna@ceramichesolaro.it", tel="+39 342 118 4457", linkedin="/in/giorgiopinna", social="@gpinna", socialLabel="X", note="", created="2026-07-02", portatoDa="Angelo", gestitoDa="Angelo", next=None, dossier=dict(fonte="", temperatura="Freddo", potere="Influenzatore", orario="", interessi="", competitor="", argomentiUtili="", argomentiEvitare="", eventi="Cersaie", libero="")),
    dict(cid=15, nome="Luigi", cognome="Zanetti", ruolo="Titolare (da confermare)", email="info@officinezanetti.it", tel="+39 030 771 4420", linkedin="/in/luigizanetti", social="@officinezanetti", socialLabel="Instagram", note="Referente ipotizzato da sito web, non ancora verificato.", created="2026-08-26", portatoDa="Alfonso", gestitoDa="Alfonso", next=("linkedin", "2026-09-01", "lead"), dossier=dict(fonte="Lista Camera di Commercio", temperatura="Freddo", potere="Da capire", orario="", interessi="", competitor="", argomentiUtili="", argomentiEvitare="", eventi="", libero="Da capire se l'azienda è davvero in target: verificare fatturato e parco macchine.")),
    dict(cid=17, nome="Elisa", cognome="Bregan", ruolo="Ufficio Acquisti", email="acquisti@tessiturabrenta.it", tel="+39 049 880 2231", linkedin="/in/elisabregan", social="@tessiturabrenta", socialLabel="Instagram", note="", created="2026-08-23", portatoDa="Angelo", gestitoDa="Alfonso", next=("email", "2026-08-29", "lead"), dossier=dict(fonte="Associazione di categoria", temperatura="Freddo", potere="Gatekeeper", orario="", interessi="", competitor="", argomentiUtili="", argomentiEvitare="", eventi="ITMA", libero="")),
]

BRIDGES = [
    dict(nome="Giovanni Sartori", ruolo="Consulente indipendente", relazione="Ex collega", email="g.sartori@sartoriadvisory.it", tel="+39 335 118 9922", linkedin="/in/giovannisartori", note="Conosce i CFO di mezzo distretto vetrario. Va aggiornato ogni 2 mesi con un caffè.", introduzioni=3),
    dict(nome="Laura Meneghin", ruolo="Partner, studio ADV Meneghin", relazione="Partner", email="laura@advmeneghin.it", tel="+39 348 220 7741", linkedin="/in/laurameneghin", note="Lavora con aziende logistiche e IT. Ricambia con segnalazioni sul suo servizio.", introduzioni=2),
    dict(nome="Andrea Ceccato", ruolo="Segretario associazione metalmeccanici", relazione="Associazione", email="a.ceccato@assometal.it", tel="+39 0444 771 220", linkedin="/in/andreaceccato", note="Accesso a liste soci e a due eventi annuali dove presentarsi.", introduzioni=4),
    dict(nome="Silvia Trevisan", ruolo="Ex cliente, ora Verdi Agroalimentare", relazione="Cliente", email="s.trevisan@verdiagro.it", tel="+39 342 990 1187", linkedin="/in/silviatrevisan", note="Referenza spendibile nel food: disponibile a call di referenza.", introduzioni=1),
]

OPERATORS = ["Alfonso", "Angelo"]


def seed_demo_data(conn):
    now = _iso(TODAY)

    for nome in OPERATORS:
        conn.execute("INSERT INTO operators (nome) VALUES (?)", (nome,))

    bridge_ids = []
    for b in BRIDGES:
        cur = conn.execute(
            "INSERT INTO bridges (nome, ruolo, relazione, email, tel, linkedin, note, introduzioni) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (b["nome"], b["ruolo"], b["relazione"], b["email"], b["tel"], b["linkedin"], b["note"], b["introduzioni"]),
        )
        bridge_ids.append(cur.lastrowid)

    company_ids = []
    for c in COMPANIES:
        history, created_at, stage_entered_at = _stage_chain(c["dur"], c["stage"], c["giorni"])
        max_idx = STAGE_ORDER.index(c["stage"]) if c["stage"] != "perso" else max(len(c["dur"]), 0)
        bridge_id = bridge_ids[c["bridge"] - 1] if c["bridge"] else None
        next_tipo, next_data, next_stadio = c["next"] if c["next"] else (None, None, None)
        cur = conn.execute(
            "INSERT INTO companies (nome, settore, dip, valore, stage, max_stage_index, portato_da, gestito_da, "
            "bridge_id, next_tipo, next_data, next_stadio, stage_entered_at, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (c["nome"], c["settore"], c["dip"], c["valore"], c["stage"], max_idx, c["portatoDa"], c["gestitoDa"],
             bridge_id, next_tipo, next_data, next_stadio, stage_entered_at, created_at),
        )
        company_id = cur.lastrowid
        company_ids.append(company_id)

        for stage, entered_at, left_at in history:
            conn.execute(
                "INSERT INTO stage_history (company_id, stage, entered_at, left_at) VALUES (?, ?, ?, ?)",
                (company_id, stage, entered_at, left_at),
            )
        conn.execute(
            "INSERT INTO stage_history (company_id, stage, entered_at, left_at) VALUES (?, ?, ?, NULL)",
            (company_id, c["stage"], stage_entered_at),
        )

        # c["att"] is authored newest-first; insert oldest-first so that
        # "ORDER BY id DESC" (used everywhere activities are read) shows the
        # newest activity first for both seeded and future dynamically-added rows.
        for data_label, tipo, testo in reversed(c["att"]):
            conn.execute(
                "INSERT INTO activities (company_id, data_label, tipo, testo, created_at) VALUES (?, ?, ?, ?, ?)",
                (company_id, data_label, tipo, testo, now),
            )

    for p in CONTACTS:
        company_id = company_ids[p["cid"] - 1]
        next_tipo, next_data, next_stadio = p["next"] if p["next"] else (None, None, None)
        d = p["dossier"]
        conn.execute(
            "INSERT INTO contacts (company_id, nome, cognome, ruolo, email, tel, linkedin, social, social_label, "
            "note, created_at, portato_da, gestito_da, next_tipo, next_data, next_stadio, dossier_fonte, "
            "dossier_temperatura, dossier_potere, dossier_orario, dossier_interessi, dossier_competitor, "
            "dossier_argomenti_utili, dossier_argomenti_evitare, dossier_eventi, dossier_libero) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (company_id, p["nome"], p["cognome"], p["ruolo"], p["email"], p["tel"], p["linkedin"], p["social"],
             p["socialLabel"], p["note"], p["created"], p["portatoDa"], p["gestitoDa"], next_tipo, next_data,
             next_stadio, d["fonte"], d["temperatura"], d["potere"], d["orario"], d["interessi"], d["competitor"],
             d["argomentiUtili"], d["argomentiEvitare"], d["eventi"], d["libero"]),
        )
    # bridge_id was already set per-company above (from COMPANIES[i]["bridge"]),
    # consistent with each bridge's original "introduces" list.
