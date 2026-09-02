// -------------------------------------------------------------- utilities
function setPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}
function companyById(id) { return Data.companies.find(c => c.id === id); }
function contactById(id) { return Data.contacts.find(c => c.id === id); }
function bridgeById(id) { return Data.bridges.find(b => b.id === id); }
function num(v) { const n = parseInt(String(v).replace(/\D/g, ''), 10); return isNaN(n) ? 0 : n; }

// -------------------------------------------------------------- click actions
const clickActions = {
  'nav': (t) => setState({ view: t.dataset.view }),

  'new-company': () => setState({ modal: 'company', editId: null, form: { stage: 'prospect' } }),
  'open-detail': (t) => setState({ detailId: parseInt(t.dataset.id, 10) }),
  'open-detail-stop': (t) => setState({ detailId: parseInt(t.dataset.id, 10) }),
  'open-detail-from-item': (t) => setState({ detailId: parseInt(t.dataset.cid, 10) }),
  'close-detail': () => setState({ detailId: null, openDossier: null }),
  'edit-company': (t) => {
    const co = companyById(parseInt(t.dataset.id, 10));
    if (!co) return;
    setState({
      modal: 'company', editId: co.id,
      form: Object.assign({}, co, {
        nextTipo: co.next ? co.next.tipo : 'followup', nextData: co.next ? co.next.data : '',
      }),
    });
  },
  'delete-company': (t) => {
    if (!confirm('Eliminare questa azienda e tutti i suoi contatti?')) return;
    mutate(Api.deleteCompany(parseInt(t.dataset.id, 10))).then((fresh) => { if (fresh) setState({ detailId: null }); });
  },
  'new-contact': () => {
    const co = companyById(State.detailId);
    if (!co) return;
    setState({ modal: 'contact', modalTab: 'dettagli', editId: null, form: { nextStadio: co.stage, portatoDa: co.portatoDa, gestitoDa: co.gestitoDa } });
  },
  'toggle-dossier': (t) => {
    const id = parseInt(t.dataset.id, 10);
    setState(s => ({ openDossier: s.openDossier === id ? null : id }));
  },
  'edit-contact': (t) => openContactModal(parseInt(t.dataset.id, 10), 'dettagli'),
  'edit-dossier': (t) => openContactModal(parseInt(t.dataset.id, 10), 'dossier'),
  'delete-contact': (t) => {
    if (!confirm('Eliminare questo contatto?')) return;
    mutate(Api.deleteContact(parseInt(t.dataset.id, 10)));
  },
  'complete-contact': (t) => mutate(Api.completeContactAction(parseInt(t.dataset.id, 10))),
  'complete-planner-item': (t) => {
    if (t.dataset.kind === 'deal') mutate(Api.completeCompanyAction(parseInt(t.dataset.cid, 10)));
    else mutate(Api.completeContactAction(parseInt(t.dataset.pid, 10)));
  },
  'add-activity': (t) => {
    const text = State.activityDraft.trim();
    if (!text) return;
    mutate(Api.addActivity(parseInt(t.dataset.id, 10), text)).then((fresh) => { if (fresh) setState({ activityDraft: '' }); });
  },

  'planner-mode': (t) => setState({ plannerMode: t.dataset.mode }),
  'contatti-mode': (t) => setState({ contattiMode: t.dataset.mode }),
  'toggle-group': (t) => {
    const id = parseInt(t.dataset.id, 10);
    setState(s => ({ openGroups: Object.assign({}, s.openGroups, { [id]: !s.openGroups[id] }) }));
  },
  'cal-prev': () => setState(s => s.calM === 0 ? { calY: s.calY - 1, calM: 11 } : { calM: s.calM - 1 }),
  'cal-next': () => setState(s => s.calM === 11 ? { calY: s.calY + 1, calM: 0 } : { calM: s.calM + 1 }),

  'new-bridge': () => setState({ modal: 'bridge', editId: null, form: { relazione: 'Referral' } }),
  'edit-bridge': (t) => {
    const b = bridgeById(parseInt(t.dataset.id, 10));
    if (!b) return;
    setState({ modal: 'bridge', editId: b.id, form: Object.assign({}, b) });
  },
  'delete-bridge': (t) => {
    if (!confirm('Eliminare questo bridge contact?')) return;
    mutate(Api.deleteBridge(parseInt(t.dataset.id, 10)));
  },
  'bridge-unlink': (t) => mutate(Api.unlinkBridge(parseInt(t.dataset.bridgeId, 10), parseInt(t.dataset.companyId, 10))),

  'add-operator': () => {
    const n = State.opDraft.trim();
    if (!n) return;
    mutate(Api.createOperator(n)).then((fresh) => { if (fresh) setState({ opDraft: '' }); });
  },
  'delete-operator': (t) => {
    if (!confirm('Eliminare questo operatore?')) return;
    const op = Data.operators.find(o => o.id === parseInt(t.dataset.id, 10));
    mutate(Api.deleteOperator(parseInt(t.dataset.id, 10))).then((fresh) => {
      if (fresh && op && State.filterOp === op.nome) setState({ filterOp: 'tutti' });
    });
  },

  'modal-tab': (t) => setState({ modalTab: t.dataset.tab }),
  'close-modal': () => setState({ modal: null, editId: null, form: {} }),
  'stop': () => {},
  'save-modal': () => saveModal(),
};

function openContactModal(id, tab) {
  const p = contactById(id);
  const co = p ? companyById(p.companyId) : null;
  if (!p || !co) return;
  const form = Object.assign({}, p, p.next || {}, {
    nextTipo: p.next ? p.next.tipo : 'followup', nextData: p.next ? p.next.data : '',
    nextStadio: p.next ? p.next.stadio : co.stage,
  }, p.dossier || {});
  setState({ modal: 'contact', modalTab: tab, editId: id, form });
}

// -------------------------------------------------------------- change actions (server-backed)
const changeActions = {
  'detail-stage': (t) => mutate(Api.moveCompanyStage(State.detailId, t.value)),
  'deal-next-tipo': (t) => mutate(Api.setCompanyNext(State.detailId, { tipo: t.value })),
  'deal-next-data': (t) => mutate(Api.setCompanyNext(State.detailId, { data: t.value })),
  'deal-next-stadio': (t) => mutate(Api.setCompanyNext(State.detailId, { stadio: t.value })),
  'bridge-link': (t) => {
    const companyId = parseInt(t.value, 10);
    if (!companyId) return;
    mutate(Api.linkBridge(parseInt(t.dataset.bridgeId, 10), companyId));
  },
};

// -------------------------------------------------------------- save modal
function saveModal() {
  const f = State.form || {};
  if (State.modal === 'company') {
    const payload = {
      nome: f.nome, settore: f.settore, dip: f.dip, valore: f.valore, stage: f.stage,
      portatoDa: f.portatoDa, gestitoDa: f.gestitoDa,
      nextTipo: f.nextTipo, nextData: f.nextData || '',
    };
    if (State.editId) {
      mutate(Api.updateCompany(State.editId, payload)).then((fresh) => { if (fresh) setState({ modal: null, editId: null, form: {} }); });
    } else {
      mutate(Api.createCompany(payload)).then((fresh) => { if (fresh) setState({ modal: null, form: {}, detailId: fresh.newCompanyId }); });
    }
  } else if (State.modal === 'bridge') {
    const payload = { nome: f.nome, ruolo: f.ruolo, relazione: f.relazione, email: f.email, tel: f.tel, linkedin: f.linkedin, note: f.note };
    if (State.editId) {
      mutate(Api.updateBridge(State.editId, payload)).then((fresh) => { if (fresh) setState({ modal: null, editId: null, form: {} }); });
    } else {
      mutate(Api.createBridge(payload)).then((fresh) => { if (fresh) setState({ modal: null, form: {} }); });
    }
  } else if (State.modal === 'contact') {
    const payload = {
      nome: f.nome, cognome: f.cognome, ruolo: f.ruolo, email: f.email, tel: f.tel, linkedin: f.linkedin, social: f.social,
      note: f.note, portatoDa: f.portatoDa, gestitoDa: f.gestitoDa,
      nextTipo: f.nextTipo, nextData: f.nextData || '', nextStadio: f.nextStadio,
      fonte: f.fonte, temperatura: f.temperatura, potere: f.potere, orario: f.orario, interessi: f.interessi,
      competitor: f.competitor, argomentiUtili: f.argomentiUtili, argomentiEvitare: f.argomentiEvitare,
      eventi: f.eventi, libero: f.libero,
    };
    if (State.editId) {
      mutate(Api.updateContact(State.editId, payload)).then((fresh) => { if (fresh) setState({ modal: null, editId: null, form: {} }); });
    } else {
      payload.companyId = State.detailId;
      mutate(Api.createContact(payload)).then((fresh) => { if (fresh) setState({ modal: null, form: {} }); });
    }
  }
}

// -------------------------------------------------------------- event wiring
function wireEvents() {
  const app = document.getElementById('app');

  app.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const action = t.dataset.action;
    if (clickActions[action]) clickActions[action](t, e);
  });

  app.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.action && changeActions[t.dataset.action]) {
      changeActions[t.dataset.action](t);
      return;
    }
    if (t.dataset.bind) {
      setPath(State, t.dataset.bind, t.value);
      render();
    }
  });

  app.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.bind) {
      setPath(State, t.dataset.bind, t.value);
      render();
      return;
    }
    if (t.dataset.actionInput === 'op-rename-draft') {
      State.dossierDraft['op' + t.dataset.id] = t.value;
      return; // avoid full re-render per keystroke on a plain text field with no live-filtered view
    }
    if (t.dataset.actionInput === 'dossier-draft') {
      State.dossierDraft['libero' + t.dataset.id] = t.value;
    }
  });

  app.addEventListener('focusout', (e) => {
    const t = e.target;
    const action = t.dataset.blurAction;
    if (action === 'op-rename-save') {
      const id = parseInt(t.dataset.id, 10);
      const draftKey = 'op' + id;
      const value = (State.dossierDraft[draftKey] !== undefined ? State.dossierDraft[draftKey] : t.value).trim();
      delete State.dossierDraft[draftKey];
      const op = Data.operators.find(o => o.id === id);
      if (op && value && value !== op.nome) {
        mutate(Api.renameOperator(id, value));
      } else {
        render();
      }
    } else if (action === 'dossier-save') {
      const id = parseInt(t.dataset.id, 10);
      const draftKey = 'libero' + id;
      const value = State.dossierDraft[draftKey] !== undefined ? State.dossierDraft[draftKey] : t.value;
      delete State.dossierDraft[draftKey];
      const contact = contactById(id);
      if (contact && value !== (contact.dossier.libero || '')) {
        mutate(Api.updateContact(id, { libero: value }));
      } else {
        render();
      }
    }
  });

  // ---- drag & drop (direct DOM class toggling; full render only after drop completes) ----
  app.addEventListener('dragstart', (e) => {
    const card = e.target.closest('[data-drag-id]');
    if (!card) return;
    e.dataTransfer.effectAllowed = 'move';
    State.dragId = parseInt(card.dataset.dragId, 10);
    card.classList.add('dragging');
  });
  app.addEventListener('dragend', (e) => {
    const card = e.target.closest('[data-drag-id]');
    if (card) card.classList.remove('dragging');
    State.dragId = null;
    document.querySelectorAll('.kanban-col.drag-over').forEach(el => el.classList.remove('drag-over'));
  });
  app.addEventListener('dragover', (e) => {
    const col = e.target.closest('[data-stage]');
    if (!col) return;
    e.preventDefault();
    col.classList.add('drag-over');
  });
  app.addEventListener('dragleave', (e) => {
    const col = e.target.closest('[data-stage]');
    if (!col) return;
    if (!col.contains(e.relatedTarget)) col.classList.remove('drag-over');
  });
  app.addEventListener('drop', (e) => {
    const col = e.target.closest('[data-stage]');
    if (!col) return;
    e.preventDefault();
    col.classList.remove('drag-over');
    const stage = col.dataset.stage;
    const dragId = State.dragId;
    State.dragId = null;
    if (dragId != null) mutate(Api.moveCompanyStage(dragId, stage));
  });
}
