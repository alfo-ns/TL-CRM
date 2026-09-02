"""Pipeline stages and action types — fixed, as in the design prototype."""

STAGES = [
    {"id": "prospect", "label": "Prospect grezzo", "color": "oklch(0.7 0.02 255)"},
    {"id": "lead", "label": "Lead", "color": "oklch(0.66 0.04 255)"},
    {"id": "contattato", "label": "Contattato", "color": "oklch(0.62 0.07 255)"},
    {"id": "qualificato", "label": "Qualificato", "color": "oklch(0.58 0.1 255)"},
    {"id": "proposta", "label": "Proposta inviata", "color": "oklch(0.54 0.12 255)"},
    {"id": "negoziazione", "label": "Negoziazione", "color": "oklch(0.5 0.14 265)"},
    {"id": "vinto", "label": "Vinto (Cliente)", "color": "oklch(0.55 0.11 155)"},
    {"id": "perso", "label": "Perso", "color": "oklch(0.58 0.15 25)"},
]

ACTION_TYPES = [
    {"id": "linkedin", "label": "LinkedIn", "color": "oklch(0.5 0.12 255)"},
    {"id": "email", "label": "Email", "color": "oklch(0.55 0.09 230)"},
    {"id": "call", "label": "Call", "color": "oklch(0.55 0.12 300)"},
    {"id": "incontro", "label": "Incontro", "color": "oklch(0.52 0.11 155)"},
    {"id": "followup", "label": "Follow-up", "color": "oklch(0.58 0.08 95)"},
]

STAGE_ORDER = [s["id"] for s in STAGES]
STAGE_INDEX = {s["id"]: i for i, s in enumerate(STAGES)}
STAGE_LABEL = {s["id"]: s["label"] for s in STAGES}
ACTION_LABEL = {a["id"]: a["label"] for a in ACTION_TYPES}
