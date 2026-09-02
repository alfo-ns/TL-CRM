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

// pointer-based drag state for the kanban board (mouse, touch and pen)
const dragCtx = { card: null, ghost: null, overCol: null, pointerId: null, started: false, suppressClick: false };

// holds the File object picked for import — not put in State, which is
// re-rendered to HTML and has no business holding binary blobs
let importFile = null;

// -------------------------------------------------------------- click actions
const clickActions = {
  'nav': (t) => setState({ view: t.dataset.view, sidebarOpen: false }),
  'toggle-sidebar': () => setState(s => ({ sidebarOpen: !s.sidebarOpen })),
  'close-sidebar': () => setState({ sidebarOpen: false }),

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

  'import-pick': () => document.getElementById('import-file-input').click(),
  'import-cancel': () => { importFile = null; setState({ importPreview: null, importFileName: '' }); },
  'import-confirm': () => {
    if (!importFile) return;
    Api.importApply(importFile).then((fresh) => {
      importFile = null;
      Data = fresh;
      const s = fresh.importSummary;
      setState({ importPreview: null, importFileName: '' });
      alert('Importazione completata: ' +
        s.aziende.nuove + ' aziende nuove / ' + s.aziende.aggiornate + ' aggiornate, ' +
        s.contatti.nuove + ' contatti nuovi / ' + s.contatti.aggiornate + ' aggiornati, ' +
        s.bridge.nuove + ' bridge nuovi / ' + s.bridge.aggiornate + ' aggiornati.' +
        (s.errori.length ? '\n' + s.errori.length + ' righe scartate per errori.' : ''));
    }).catch((e) => alert('Errore durante l\'importazione: ' + e.message));
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
    if (dragCtx.suppressClick) { dragCtx.suppressClick = false; return; }
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const action = t.dataset.action;
    if (clickActions[action]) clickActions[action](t, e);
  });

  app.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.actionInput === 'import-file') {
      const file = t.files && t.files[0];
      t.value = '';
      if (!file) return;
      importFile = file;
      setState({ importFileName: file.name, importPreview: null });
      Api.importPreview(file).then((summary) => {
        setState({ importPreview: summary });
      }).catch((e) => {
        setState({ importPreview: { error: e.message } });
      });
      return;
    }
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

  // ---- drag & drop (Pointer Events: works for mouse, touch and pen) ----
  app.addEventListener('pointerdown', (e) => {
    if (e.button != null && e.button !== 0) return; // left button / primary touch only
    const card = e.target.closest('[data-drag-id]');
    if (!card) return;
    dragCtx.card = card;
    dragCtx.id = parseInt(card.dataset.dragId, 10);
    dragCtx.startX = e.clientX;
    dragCtx.startY = e.clientY;
    dragCtx.pointerId = e.pointerId;
    dragCtx.started = false;
    dragCtx.suppressClick = false;
  });

  app.addEventListener('pointermove', (e) => {
    if (dragCtx.pointerId !== e.pointerId || !dragCtx.card) return;
    const dx = e.clientX - dragCtx.startX;
    const dy = e.clientY - dragCtx.startY;
    if (!dragCtx.started) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      dragCtx.started = true;
      dragCtx.suppressClick = true;
      dragCtx.card.setPointerCapture(dragCtx.pointerId);
      dragCtx.card.classList.add('dragging');
      dragCtx.ghost = dragCtx.card.cloneNode(true);
      dragCtx.ghost.classList.add('deal-ghost');
      const r = dragCtx.card.getBoundingClientRect();
      dragCtx.offX = dragCtx.startX - r.left;
      dragCtx.offY = dragCtx.startY - r.top;
      dragCtx.ghost.style.width = r.width + 'px';
      document.body.appendChild(dragCtx.ghost);
    }
    dragCtx.ghost.style.left = (e.clientX - dragCtx.offX) + 'px';
    dragCtx.ghost.style.top = (e.clientY - dragCtx.offY) + 'px';
    dragCtx.ghost.style.pointerEvents = 'none';
    const col = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-stage]');
    if (dragCtx.overCol && dragCtx.overCol !== col) dragCtx.overCol.classList.remove('drag-over');
    if (col) col.classList.add('drag-over');
    dragCtx.overCol = col || null;
  });

  function endDrag(e) {
    if (dragCtx.pointerId !== e.pointerId) return;
    const wasStarted = dragCtx.started;
    if (dragCtx.card) dragCtx.card.classList.remove('dragging');
    if (dragCtx.ghost) dragCtx.ghost.remove();
    if (dragCtx.overCol) dragCtx.overCol.classList.remove('drag-over');
    if (wasStarted && dragCtx.overCol) {
      const stage = dragCtx.overCol.dataset.stage;
      mutate(Api.moveCompanyStage(dragCtx.id, stage));
    }
    dragCtx.card = null; dragCtx.ghost = null; dragCtx.overCol = null; dragCtx.pointerId = null; dragCtx.started = false;
  }
  app.addEventListener('pointerup', endDrag);
  app.addEventListener('pointercancel', endDrag);
}
