// ---------------------------------------------------------------- UI state
const now = new Date();
let State = {
  view: 'dashboard', query: '', filterStage: 'tutti', filterOp: 'tutti',
  plannerMode: 'lanes', contattiMode: 'persone', calY: now.getFullYear(), calM: now.getMonth(),
  detailId: null, modal: null, modalTab: 'dettagli', editId: null, form: {},
  activityDraft: '', openGroups: {}, openDossier: null,
  opDraft: '', dossierDraft: {}, sidebarOpen: false,
};

function setState(patch) {
  Object.assign(State, typeof patch === 'function' ? patch(State) : patch);
  render();
}

async function mutate(promise) {
  try {
    Data = await promise;
    render();
    return Data;
  } catch (e) {
    alert('Errore: ' + e.message);
    return null;
  }
}

const esc = H.esc;

// ---------------------------------------------------------- focus-preserving render
function captureFocus() {
  const el = document.activeElement;
  if (!el || !(el.matches && el.matches('input, textarea, select'))) return null;
  const id = el.getAttribute('data-focus-id') || el.getAttribute('name');
  if (!id) return null;
  let sel = null;
  try { sel = [el.selectionStart, el.selectionEnd]; } catch (e) {}
  return { id, sel };
}
function restoreFocus(info) {
  if (!info) return;
  const els = document.querySelectorAll('[data-focus-id="' + info.id + '"], [name="' + info.id + '"]');
  if (!els.length) return;
  const el = els[0];
  el.focus();
  if (info.sel && el.setSelectionRange) {
    try { el.setSelectionRange(info.sel[0], info.sel[1]); } catch (e) {}
  }
}

function render() {
  const focusInfo = captureFocus();
  const vm = computeViewModel();
  document.getElementById('app').classList.toggle('sidebar-open', State.sidebarOpen);
  document.getElementById('nav').innerHTML = navHTML(vm);
  document.getElementById('sidebar-footer').innerHTML = footerHTML(vm);
  document.getElementById('topbar').innerHTML = topbarHTML(vm);
  document.getElementById('content').innerHTML = contentHTML(vm);
  document.getElementById('overlay-root').innerHTML = overlaysHTML(vm);
  restoreFocus(focusInfo);
}

// ------------------------------------------------------------------- sidebar
function navHTML(vm) {
  const items = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'pipeline', label: 'Pipeline', count: vm.kpiAttive },
    { id: 'planner', label: 'Planner', badge: vm.plannerBadge, badgeBg: vm.plannerBadgeBg },
    { id: 'contatti', label: 'Contatti', count: vm.kpiPersone },
    { id: 'bridge', label: 'Bridge contact', count: vm.kpiBridge },
    { id: 'impostazioni', label: 'Impostazioni' },
  ];
  return items.map(it => `
    <button class="nav-btn ${State.view === it.id ? 'active' : ''}" data-action="nav" data-view="${it.id}">
      <span>${it.label}</span>
      ${it.count !== undefined ? `<span class="nav-count">${it.count}</span>` : ''}
      ${it.badge !== undefined ? `<span class="nav-badge" style="background:${it.badgeBg}">${it.badge}</span>` : ''}
    </button>
  `).join('');
}

function footerHTML(vm) {
  return `
    <div class="label">Pipeline aperta</div>
    <div class="value mono">${vm.kpiValoreAperto}</div>
    <div class="sub">${vm.kpiAttive} trattative attive · ${vm.kpiProspect} prospect grezzi</div>
  `;
}

function stageOptionsHTML(selected, includeEmpty) {
  return (includeEmpty ? `<option value="tutti">Tutti gli stadi</option>` : '') +
    Data.stages.map(s => `<option value="${s.id}" ${s.id === selected ? 'selected' : ''}>${s.label}</option>`).join('');
}
function operatorOptionsHTML(selected, includeEmpty) {
  return (includeEmpty ? `<option value="tutti">Tutti gli operatori</option>` : '') +
    Data.operators.map(o => `<option value="${esc(o.nome)}" ${o.nome === selected ? 'selected' : ''}>${esc(o.nome)}</option>`).join('');
}
function actionOptionsHTML(selected) {
  return Data.actionTypes.map(a => `<option value="${a.id}" ${a.id === selected ? 'selected' : ''}>${a.label}</option>`).join('');
}

function topbarHTML(vm) {
  return `
    <button class="menu-btn" data-action="toggle-sidebar" aria-label="Menu">☰</button>
    <div style="min-width:0">
      <h1>${vm.viewTitle}</h1>
      <div class="sub">${vm.viewSub}</div>
    </div>
    <div class="actions">
      <input type="text" placeholder="Cerca azienda, persona, ruolo…" value="${esc(State.query)}" data-focus-id="search" data-bind="query" style="width:230px">
      <select data-bind="filterStage">${stageOptionsHTML(State.filterStage, true)}</select>
      <select data-bind="filterOp">${operatorOptionsHTML(State.filterOp, true)}</select>
      <button class="btn" data-action="new-company">+ Azienda</button>
    </div>
  `;
}

// ------------------------------------------------------------------- content
function contentHTML(vm) {
  // Pipeline uses the full width (more kanban columns fit on wide screens);
  // every other view is capped and centered so text/cards stay readable on ultra-wide monitors.
  if (State.view === 'pipeline') return pipelineHTML(vm);
  const inner = (() => {
    switch (State.view) {
      case 'dashboard': return dashboardHTML(vm);
      case 'planner': return plannerHTML(vm);
      case 'contatti': return contattiHTML(vm);
      case 'bridge': return bridgeHTML(vm);
      case 'impostazioni': return settingsHTML(vm);
      default: return '';
    }
  })();
  return `<div class="view-wrap">${inner}</div>`;
}

function dashboardHTML(vm) {
  const k = vm.kpi;
  return `
  <div style="display:flex;flex-direction:column;gap:14px">
    <div class="grid-kpi">
      <div class="card">
        <div class="kpi-label">Aziende in pipeline</div>
        <div class="kpi-value">${k.aziende}</div>
        <div class="kpi-sub">${k.persone} persone · ${k.prospect} da verificare</div>
      </div>
      <div class="card">
        <div class="kpi-label">Valore totale pipeline</div>
        <div class="kpi-value">${k.valoreTotale}</div>
        <div class="kpi-sub">${k.valoreAperto} ancora aperti</div>
      </div>
      <div class="card">
        <div class="kpi-label">Prospect → Vinto</div>
        <div class="kpi-value" style="color:oklch(0.5 0.11 155)">${k.convTotale}</div>
        <div class="kpi-sub">${k.vinti} vinti su ${k.aziende}</div>
      </div>
      <div class="card">
        <div class="kpi-label">Azioni da fare</div>
        <div class="kpi-split">
          <div><div class="n" style="color:oklch(0.55 0.15 25)">${k.inRitardo}</div><div class="l">in ritardo</div></div>
          <div class="kpi-divider"></div>
          <div><div class="n">${k.oggi}</div><div class="l">oggi</div></div>
        </div>
      </div>
      <div class="card">
        <div class="kpi-label">Nuovi contatti</div>
        <div class="kpi-split">
          <div><div class="n">${k.nuoviSettimana}</div><div class="l">settimana</div></div>
          <div class="kpi-divider"></div>
          <div><div class="n">${k.nuoviMese}</div><div class="l">mese</div></div>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">
          <div class="card-title">Imbuto di vendita</div>
          <div style="font-size:12px;color:var(--text-dimmer)">trattative che hanno raggiunto lo stadio</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:18px">
          ${vm.funnel.map(f => `
            <div class="funnel-row">
              <div class="funnel-label">${f.label}</div>
              <div class="funnel-track"><div class="funnel-fill" style="width:${f.width};background:${f.color}">${f.count}</div></div>
              <div class="funnel-pct">${f.pct}</div>
            </div>`).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-title">Conversione per passaggio</div>
        <div style="display:flex;flex-direction:column;gap:11px;margin-top:18px">
          ${vm.conversions.map(c => `
            <div class="conv-row">
              <div class="conv-head"><span class="l">${c.label}</span><span class="v">${c.pct}</span></div>
              <div class="conv-track"><div class="conv-fill" style="width:${c.width}"></div></div>
            </div>`).join('')}
        </div>
      </div>
    </div>

    <div class="grid-3">
      <div class="card">
        <div class="card-title">Vinti vs persi</div>
        <div style="display:flex;align-items:baseline;gap:24px;margin-top:16px">
          <div><div class="mono" style="font-size:26px;font-weight:600;color:oklch(0.5 0.11 155)">${k.pctVinti}</div><div class="kpi-sub">${k.vinti} vinti</div></div>
          <div><div class="mono" style="font-size:26px;font-weight:600;color:oklch(0.57 0.15 25)">${k.pctPersi}</div><div class="kpi-sub">${k.persi} persi</div></div>
        </div>
        <div style="display:flex;height:10px;border-radius:5px;overflow:hidden;margin-top:16px;background:oklch(0.96 0.004 95)">
          <div style="background:oklch(0.55 0.11 155);width:${k.barVinti}"></div>
          <div style="background:oklch(0.6 0.15 25);width:${k.barPersi}"></div>
        </div>
        <div class="kpi-sub" style="margin-top:10px">${k.chiuse} trattative chiuse · valore vinto ${k.valoreVinto}</div>
      </div>
      <div class="card">
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">
          <div class="card-title">Tempo medio per stadio</div>
          <div style="font-size:12px;color:var(--text-dimmer)">giorni</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:9px;margin-top:18px">
          ${vm.stageTimes.map(t => `
            <div class="stage-time-row">
              <div class="stage-time-label">${t.label}</div>
              <div class="stage-time-track"><div class="stage-time-fill" style="width:${t.width}"></div></div>
              <div class="stage-time-days">${t.days}</div>
            </div>`).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-title">Per operatore</div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:16px">
          ${vm.opStats.map(o => `
            <div class="op-row">
              <span class="avatar avatar-md">${o.initials}</span>
              <div style="min-width:0">
                <div style="font-weight:500;font-size:13px">${esc(o.nome)}</div>
                <div style="font-size:11px;color:var(--text-dimmer)">${o.gestite} in gestione · ${o.portate} portate · ${o.vinti} vinti</div>
              </div>
              <div class="mono" style="margin-left:auto;font-size:13px;font-weight:500">${o.valore}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>
  </div>`;
}

function pipelineHTML(vm) {
  return `<div class="kanban">
    ${vm.columns.map(col => `
      <div class="kanban-col" data-stage="${col.id}">
        <div class="kanban-col-head">
          <span class="stage-dot" style="background:${col.color}"></span>
          <span style="font-weight:600;font-size:13px">${col.label}</span>
          <span class="kanban-col-count">${col.count}</span>
        </div>
        <div class="kanban-col-total mono">${col.total}</div>
        ${col.deals.map(d => `
          <div class="deal-card" data-drag-id="${d.id}" data-action="open-detail" data-id="${d.id}">
            <div class="deal-name">${esc(d.nome)}</div>
            <div class="deal-sub">${esc(d.settore)} · ${d.dip} dip.</div>
            <div class="deal-row">
              <span class="deal-value mono">${d.valore}</span>
              <span class="deal-days">${d.giorni}g in stadio</span>
            </div>
            ${d.hasNext ? `
              <div class="deal-next" style="background:${d.nextBg};color:${d.nextFg}">
                <span style="font-weight:600">${d.nextTipo}</span><span>${d.nextQuando}</span>
                <span style="margin-left:auto;opacity:0.8">→ ${d.nextStadio}</span>
              </div>` : ''}
            <div class="deal-foot">
              <span class="avatar avatar-sm">${d.initials}</span>
              <span class="who">${esc(d.referente)}</span>
              <span class="owner">${esc(d.gestitoDa)}</span>
            </div>
            ${d.hasBridge ? `<div class="deal-bridge">via bridge · ${esc(d.bridge)}</div>` : ''}
          </div>`).join('')}
        ${col.empty ? `<div class="drop-hint">Trascina qui</div>` : ''}
      </div>`).join('')}
  </div>`;
}

function plannerHTML(vm) {
  const lanesTab = State.plannerMode === 'lanes';
  const laneItemHTML = (it, isCal) => `
    <div class="${isCal ? 'cal-chip' : 'action-item'}" ${isCal ? `style="background:${it.chipBg};color:${it.chipFg}" data-action="open-detail-from-item" data-cid="${it.cid}"` : ''}>
      ${isCal ? `
        <div class="t">${it.tipo}</div><div class="n">${esc(it.titolo)}</div>
      ` : `
        <div class="action-item-head">
          <span class="action-chip" style="background:${it.tipoColor}">${it.tipo}</span>
          <span class="action-date mono" style="color:${it.dataColor}">${it.dataLabel}</span>
        </div>
        <div class="action-title" data-action="open-detail-from-item" data-cid="${it.cid}">${esc(it.titolo)}</div>
        <div class="action-sub">${esc(it.sotto)}</div>
        <div class="action-foot">
          <span class="stg">→ ${it.stadio}</span>
          <span class="own">· ${esc(it.owner)}</span>
          <button class="btn-ghost btn-sm" style="margin-left:auto" data-action="complete-planner-item" data-kind="${it.kind}" data-cid="${it.cid}" data-pid="${it.pid || ''}">Fatto</button>
        </div>
      `}
    </div>`;

  return `
    <div class="planner-head">
      <div class="tabs">
        <button class="tab-btn ${lanesTab ? 'active' : ''}" data-action="planner-mode" data-mode="lanes">Corsie urgenza</button>
        <button class="tab-btn ${!lanesTab ? 'active' : ''}" data-action="planner-mode" data-mode="cal">Calendario</button>
      </div>
      <div class="planner-count">${vm.plannerCount} azioni pianificate · ${vm.kpi.inRitardo} in ritardo</div>
    </div>
    ${lanesTab ? `
      <div class="lanes">
        ${vm.lanes.map(l => `
          <div class="lane" style="background:${l.bg};border-color:${l.border}">
            <div class="lane-head"><span class="lane-label" style="color:${l.fg}">${l.label}</span><span class="lane-count mono">${l.count}</span></div>
            ${l.items.map(it => laneItemHTML(it, false)).join('')}
            ${l.empty ? `<div class="drop-hint">Nessuna azione</div>` : ''}
          </div>`).join('')}
      </div>
    ` : `
      <div class="cal">
        <div class="cal-head">
          <button class="cal-nav-btn" data-action="cal-prev">‹</button>
          <div class="cal-title">${vm.calTitle}</div>
          <button class="cal-nav-btn" data-action="cal-next">›</button>
          <div class="cal-count">${vm.calCount} azioni nel mese</div>
        </div>
        <div class="cal-dow"><div>lun</div><div>mar</div><div>mer</div><div>gio</div><div>ven</div><div>sab</div><div>dom</div></div>
        <div class="cal-grid">
          ${vm.calCells.map(c => `
            <div class="cal-cell" style="background:${c.bg};border-color:${c.border}">
              <div class="cal-day mono" style="color:${c.dayColor}">${c.day}</div>
              ${c.items.map(it => laneItemHTML(it, true)).join('')}
              ${c.hasMore ? `<div class="cal-more">+${c.more} altre</div>` : ''}
            </div>`).join('')}
        </div>
      </div>
    `}
  `;
}

function contattiHTML(vm) {
  const personeTab = State.contattiMode === 'persone';
  return `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
      <div class="tabs">
        <button class="tab-btn ${personeTab ? 'active' : ''}" data-action="contatti-mode" data-mode="persone">Persone</button>
        <button class="tab-btn ${!personeTab ? 'active' : ''}" data-action="contatti-mode" data-mode="aziende">Aziende</button>
      </div>
    </div>
    ${personeTab ? `
      <div class="table">
        <div class="table-head"><div>Persona</div><div>Azienda</div><div>Ruolo</div><div>Contatti</div><div>Stadio</div><div>Prossima mossa</div></div>
        ${vm.rows.map(r => `
          <div class="table-row" data-action="open-detail" data-id="${r.companyId}">
            <div class="person-cell">
              <span class="avatar avatar-md">${r.initials}</span>
              <div style="min-width:0">
                <div class="person-name">${esc(r.persona)}</div>
                <div class="person-temp">${esc(r.temperatura)}</div>
              </div>
            </div>
            <div class="ellipsis">${esc(r.azienda)}</div>
            <div class="ellipsis" style="font-size:13px;color:var(--text-dim)">${esc(r.ruolo)}</div>
            <div style="font-size:12px;color:var(--text-dim);min-width:0">
              <div class="ellipsis">${esc(r.email)}</div>
              <div class="mono" style="font-size:11px;color:var(--text-faint)">${esc(r.tel)}</div>
            </div>
            <div><span class="pill" style="background:${r.stageColor}">${r.stage}</span></div>
            <div>
              ${r.hasNext ? `<div class="next-chip" style="background:${r.nextBg};color:${r.nextFg}"><div style="font-weight:600">${r.nextTipo} · ${r.nextQuando}</div><div style="opacity:.85">${esc(r.owner)}</div></div>` : `<span style="font-size:11px;color:var(--text-faint)">—</span>`}
            </div>
          </div>`).join('')}
        ${vm.noRows ? `<div class="empty-state">Nessun contatto corrisponde ai filtri.</div>` : ''}
      </div>
    ` : `
      <div class="groups">
        ${vm.groups.map(g => `
          <div class="group">
            <div class="group-head" data-action="toggle-group" data-id="${g.id}">
              <div style="min-width:0">
                <div class="ellipsis" style="font-weight:600;letter-spacing:-0.01em">${esc(g.nome)}</div>
                <div style="font-size:11px;color:var(--text-faint)">${esc(g.settore)} · ${g.dip} dip.</div>
              </div>
              <div><span class="pill" style="background:${g.stageColor}">${g.stage}</span></div>
              <div class="mono" style="font-size:13px;font-weight:500">${g.valore}</div>
              <div style="font-size:12px;color:oklch(0.55 0.01 255)">${g.nPersone} persone</div>
              <div style="font-size:11px;color:oklch(0.55 0.01 255)">${g.nextLabel}</div>
              <div class="group-actions">
                <button class="btn-ghost btn-sm" data-action="open-detail-stop" data-id="${g.id}">Scheda</button>
                <span style="font-size:12px;color:var(--text-dimmer);width:12px;text-align:center">${g.chevron}</span>
              </div>
            </div>
            ${g.open ? `
              <div class="group-body">
                ${g.persone.map(p => `
                  <div class="group-person">
                    <div style="display:flex;align-items:center;gap:8px;min-width:0">
                      <span class="avatar avatar-sm">${p.initials}</span>
                      <span class="ellipsis" style="font-weight:500">${esc(p.nomeCompleto)}</span>
                    </div>
                    <div class="ellipsis" style="color:oklch(0.52 0.01 255)">${esc(p.ruolo)}</div>
                    <div class="ellipsis" style="color:oklch(0.52 0.01 255);font-size:12px">${esc(p.email)}</div>
                    <div style="font-size:11px;color:oklch(0.55 0.01 255)">${p.nextLabel}</div>
                  </div>`).join('')}
                ${g.noPersone ? `<div style="padding:12px 0;font-size:12px;color:var(--text-dimmer)">Nessun referente ancora individuato — tipico dei prospect grezzi.</div>` : ''}
              </div>` : ''}
          </div>`).join('')}
      </div>
    `}
  `;
}

function bridgeHTML(vm) {
  return `
    <div class="bridge-intro">
      <p>Persone che non sono lead ma possono aprire porte: referral, partner, ex colleghi, associazioni. Collegali alle aziende che possono presentarti.</p>
      <button class="btn" style="margin-left:auto" data-action="new-bridge">+ Bridge</button>
    </div>
    <div class="bridge-grid">
      ${vm.bridgeCards.map(b => `
        <div class="bridge-card">
          <div class="bridge-head">
            <span class="avatar avatar-xl">${b.initials}</span>
            <div style="min-width:0"><div class="bridge-name">${esc(b.nome)}</div><div class="bridge-role">${esc(b.ruolo)}</div></div>
            <span class="bridge-rel">${esc(b.relazione)}</span>
          </div>
          <div class="bridge-meta">
            <div class="ellipsis">${esc(b.email)}</div>
            <div class="mono">${esc(b.tel)}</div>
            <div>LinkedIn · ${esc(b.linkedin)}</div>
            <div>Introduzioni · ${b.introduzioni}</div>
          </div>
          ${b.hasNote ? `<div class="bridge-note">${esc(b.note)}</div>` : ''}
          <div class="bridge-label">Può presentarti a</div>
          <div class="bridge-companies">
            ${b.aziende.map(a => `
              <span class="bridge-chip">
                <span class="nm" data-action="open-detail" data-id="${a.id}">${esc(a.nome)}</span>
                <span class="rm" data-action="bridge-unlink" data-bridge-id="${b.id}" data-company-id="${a.id}">✕</span>
              </span>`).join('')}
            ${b.noAziende ? `<span style="font-size:12px;color:var(--text-faint)">Nessun collegamento</span>` : ''}
          </div>
          <div class="bridge-actions">
            <select data-action="bridge-link" data-bridge-id="${b.id}">
              <option value="tutti">Collega azienda…</option>
              ${vm.companyOptions.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}
            </select>
            <button class="btn-ghost" data-action="edit-bridge" data-id="${b.id}">Modifica</button>
            <button class="btn-danger" data-action="delete-bridge" data-id="${b.id}">Elimina</button>
          </div>
        </div>`).join('')}
    </div>
  `;
}

function settingsHTML(vm) {
  return `
    <div class="settings-wrap">
      <div class="card">
        <div class="card-title">Operatori</div>
        <div class="settings-desc">Chi porta i contatti e chi li segue. Modifica il nome per aggiornarlo su tutte le schede.</div>
        <div class="op-list">
          ${vm.operatorRows.map(o => `
            <div class="op-list-row">
              <span class="avatar avatar-md">${o.initials}</span>
              <input value="${esc(State.dossierDraft['op' + o.id] !== undefined ? State.dossierDraft['op' + o.id] : o.nome)}" data-focus-id="op-name-${o.id}" data-action-input="op-rename-draft" data-id="${o.id}" data-blur-action="op-rename-save">
              <span class="uso">${o.uso}</span>
              <button class="btn-danger" data-action="delete-operator" data-id="${o.id}">Elimina</button>
            </div>`).join('')}
        </div>
        <div class="op-add">
          <input placeholder="Nome nuovo operatore" value="${esc(State.opDraft)}" data-focus-id="op-draft" data-bind="opDraft">
          <button class="btn" data-action="add-operator">Aggiungi</button>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Stadi della pipeline</div>
        <div class="stage-chips">
          ${vm.stageOptions.map(s => `<span class="stage-chip"><span class="stage-dot" style="background:${s.color}"></span>${s.label}</span>`).join('')}
        </div>
        <div class="settings-desc text-wrap">In questo prototipo gli stadi sono fissi: "Prospect grezzo" raccoglie le aziende non ancora verificate, "Lead" solo quelle in target con referente identificato.</div>
      </div>
    </div>
  `;
}

// ------------------------------------------------------------------ overlays
function overlaysHTML(vm) {
  return detailHTML(vm) + modalHTML(vm);
}

function detailHTML(vm) {
  if (!vm.hasDetail) return '';
  const d = vm.detail;
  return `
    <div class="scrim" data-action="close-detail"></div>
    <aside class="drawer">
      <div class="drawer-head">
        <div class="drawer-title-row">
          <div style="min-width:0">
            <div class="drawer-title">${esc(d.nome)}</div>
            <div class="drawer-sub">${esc(d.settore)} · ${d.dip} dipendenti</div>
          </div>
          <button class="close-btn" data-action="close-detail">✕</button>
        </div>
        <div class="drawer-stage-row">
          <select data-action="detail-stage">${stageOptionsHTML(d.stage, false)}</select>
          <div class="mono" style="font-size:16px;font-weight:600;margin-left:2px">${d.valore}</div>
          <div style="font-size:12px;color:var(--text-dimmer)">· ${d.giorni}g in stadio</div>
          <div style="margin-left:auto;display:flex;gap:6px">
            <button class="btn-ghost" data-action="edit-company" data-id="${d.id}">Modifica</button>
            <button class="btn-danger" data-action="delete-company" data-id="${d.id}">Elimina</button>
          </div>
        </div>
        <div class="drawer-meta-row">
          <span>Portata da <strong>${esc(d.portatoDa)}</strong></span>
          <span>In gestione a <strong>${esc(d.gestitoDa)}</strong></span>
          ${d.hasBridge ? `<span style="color:oklch(0.45 0.11 255)">Presentata da ${esc(d.bridge)}</span>` : ''}
        </div>
      </div>
      <div class="drawer-body">
        <div class="next-move-box">
          <div class="lbl">Prossima mossa sulla trattativa</div>
          <div class="next-move-row">
            <select data-action="deal-next-tipo">${actionOptionsHTML(d.nextTipo)}</select>
            <input type="date" value="${d.nextData || ''}" data-action="deal-next-data">
            <select data-action="deal-next-stadio">${stageOptionsHTML(d.nextStadioId, false)}</select>
            <div style="margin-left:auto;font-size:12px;color:oklch(0.5 0.01 255);align-self:center">${d.nextQuando}</div>
          </div>
        </div>

        <div class="section-head-row">
          <div class="section-label">Persone di contatto</div>
          <button class="btn-ghost btn-sm" data-action="new-contact">+ Persona</button>
        </div>
        <div style="margin-top:12px">
          ${d.contatti.map(p => `
            <div class="person-card">
              <div class="person-card-head">
                <span class="avatar avatar-lg">${p.initials}</span>
                <div style="min-width:0"><div class="person-card-name">${esc(p.nomeCompleto)}</div><div class="person-card-role">${esc(p.ruolo)}</div></div>
                <div class="person-card-actions">
                  <button class="btn-ghost btn-sm" data-action="toggle-dossier" data-id="${p.id}">${p.dossierLabel}</button>
                  <button class="btn-ghost btn-sm" data-action="edit-contact" data-id="${p.id}">Modifica</button>
                  <button class="btn-danger btn-sm" data-action="delete-contact" data-id="${p.id}">Elimina</button>
                </div>
              </div>
              <div class="person-fields">
                <div class="ellipsis">${esc(p.email)}</div>
                <div class="mono">${esc(p.tel)}</div>
                <div>LinkedIn · ${esc(p.linkedin)}</div>
                <div>${esc(p.socialLabel)} · ${esc(p.social)}</div>
                <div>Portato da ${esc(p.portatoDa)}</div>
                <div>Seguito da ${esc(p.gestitoDa)}</div>
              </div>
              <div class="person-next" style="background:${p.nextBg}">
                <span style="font-size:11px;font-weight:600;color:${p.nextFg}">${p.nextTipoLabel}</span>
                <span style="font-size:11px;color:${p.nextFg}">${p.nextQuando} · → ${p.nextStadio}</span>
                <button class="btn-ghost btn-sm" style="margin-left:auto" data-action="complete-contact" data-id="${p.id}">Fatto</button>
              </div>
              ${p.hasNote ? `<div class="person-note text-wrap">${esc(p.note)}</div>` : ''}
              ${p.dossierOpen ? `
                <div class="dossier-box">
                  <div class="dossier-head">
                    <span class="section-label">Dossier</span>
                    <span class="pill" style="background:${p.tempColor}">${p.temperatura}</span>
                    <button class="btn-ghost btn-sm" style="margin-left:auto" data-action="edit-dossier" data-id="${p.id}">Modifica dossier</button>
                  </div>
                  <div class="dossier-grid">
                    ${p.dossierRows.map(r => `<div><div class="k">${r.label}</div><div class="v text-wrap">${esc(r.value)}</div></div>`).join('')}
                  </div>
                  <div class="dossier-free">
                    <div class="k" style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:oklch(0.62 0.01 255)">Appunti liberi</div>
                    <textarea rows="3" placeholder="Osservazioni, aneddoti, dettagli utili raccolti sul campo…" data-focus-id="dossier-libero-${p.id}" data-action-input="dossier-draft" data-id="${p.id}" data-blur-action="dossier-save">${esc(State.dossierDraft['libero' + p.id] !== undefined ? State.dossierDraft['libero' + p.id] : p.libero)}</textarea>
                  </div>
                </div>` : ''}
            </div>`).join('')}
          ${d.noContatti ? `<div class="drop-hint">Nessun referente: prospect ancora da verificare.</div>` : ''}
        </div>

        <div class="section-label" style="margin-top:26px">Storico attività</div>
        <div class="activity-add-row">
          <input type="text" placeholder="Registra un'attività…" value="${esc(State.activityDraft)}" data-focus-id="activity-draft" data-bind="activityDraft">
          <button class="btn" data-action="add-activity" data-id="${d.id}">Aggiungi</button>
        </div>
        <div class="activity-list">
          ${d.attivita.map(a => `
            <div class="activity-item">
              <div class="activity-rail"><span class="activity-dot"></span><span class="activity-line"></span></div>
              <div style="min-width:0">
                <div class="activity-meta">${a.data} · ${esc(a.tipo)}</div>
                <div class="activity-text text-wrap">${esc(a.testo)}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </aside>
  `;
}

function field(label, name, value, opts) {
  opts = opts || {};
  const span = opts.span2 ? ' span2' : '';
  if (opts.type === 'select') {
    return `<label class="${span}"><span class="flabel">${label}</span>
      <select name="${name}" data-bind="form.${name}">${opts.options}</select></label>`;
  }
  if (opts.type === 'textarea') {
    return `<label class="${span}"><span class="flabel">${label}</span>
      <textarea name="${name}" rows="${opts.rows || 2}" placeholder="${opts.placeholder || ''}" data-bind="form.${name}">${esc(value || '')}</textarea></label>`;
  }
  return `<label class="${span}"><span class="flabel">${label}</span>
    <input name="${name}" type="${opts.type || 'text'}" placeholder="${opts.placeholder || ''}" value="${esc(value || '')}" data-bind="form.${name}" ${opts.mono ? 'class="mono"' : ''}></label>`;
}

function modalHTML(vm) {
  if (!State.modal) return '';
  const f = Object.assign({
    nome: '', cognome: '', settore: '', dip: '', valore: '', stage: 'prospect', ruolo: '', email: '', tel: '',
    linkedin: '', social: '', note: '', portatoDa: (Data.operators[0] || {}).nome || '', gestitoDa: (Data.operators[0] || {}).nome || '',
    nextTipo: 'followup', nextData: '', nextStadio: 'lead', relazione: 'Referral',
    fonte: '', temperatura: 'Freddo', potere: 'Da capire', orario: '', interessi: '', competitor: '',
    argomentiUtili: '', argomentiEvitare: '', eventi: '', libero: '',
  }, State.form);

  const title = State.modal === 'company' ? (State.editId ? 'Modifica azienda' : 'Nuova azienda')
    : State.modal === 'bridge' ? (State.editId ? 'Modifica bridge contact' : 'Nuovo bridge contact')
    : (State.editId ? 'Modifica persona di contatto' : 'Nuova persona di contatto');

  let body = '';
  if (State.modal === 'company') {
    body = `<div class="modal-grid">
      ${field('Nome azienda', 'nome', f.nome, { span2: true })}
      ${field('Settore', 'settore', f.settore)}
      ${field('Dimensione (dipendenti)', 'dip', f.dip, { mono: true })}
      ${field('Valore stimato (€)', 'valore', f.valore, { mono: true })}
      ${field('Stadio', 'stage', f.stage, { type: 'select', options: stageOptionsHTML(f.stage, false) })}
      ${field('Portata da', 'portatoDa', f.portatoDa, { type: 'select', options: operatorOptionsHTML(f.portatoDa, false) })}
      ${field('In gestione a', 'gestitoDa', f.gestitoDa, { type: 'select', options: operatorOptionsHTML(f.gestitoDa, false) })}
      ${field('Prossima mossa', 'nextTipo', f.nextTipo, { type: 'select', options: actionOptionsHTML(f.nextTipo) })}
      ${field('Quando', 'nextData', f.nextData, { type: 'date' })}
    </div>`;
  } else if (State.modal === 'contact') {
    const dettagliTab = State.modalTab === 'dettagli';
    body = `
      <div class="tabs" style="margin-top:16px">
        <button class="tab-btn ${dettagliTab ? 'active' : ''}" data-action="modal-tab" data-tab="dettagli">Dettagli operativi</button>
        <button class="tab-btn ${!dettagliTab ? 'active' : ''}" data-action="modal-tab" data-tab="dossier">Dossier</button>
      </div>
      ${dettagliTab ? `
      <div class="modal-grid">
        ${field('Nome', 'nome', f.nome)}
        ${field('Cognome', 'cognome', f.cognome)}
        ${field('Ruolo / posizione', 'ruolo', f.ruolo, { span2: true })}
        ${field('Email', 'email', f.email)}
        ${field('Telefono', 'tel', f.tel, { mono: true })}
        ${field('LinkedIn', 'linkedin', f.linkedin)}
        ${field('Instagram / X', 'social', f.social)}
        ${field('Portato da', 'portatoDa', f.portatoDa, { type: 'select', options: operatorOptionsHTML(f.portatoDa, false) })}
        ${field('Seguito da', 'gestitoDa', f.gestitoDa, { type: 'select', options: operatorOptionsHTML(f.gestitoDa, false) })}
        ${field('Prossima mossa', 'nextTipo', f.nextTipo, { type: 'select', options: actionOptionsHTML(f.nextTipo) })}
        ${field('Quando', 'nextData', f.nextData, { type: 'date' })}
        ${field('Stadio obiettivo', 'nextStadio', f.nextStadio, { type: 'select', options: stageOptionsHTML(f.nextStadio, false) })}
        ${field('Note operative', 'note', f.note, { type: 'textarea', span2: true })}
      </div>` : `
      <div style="margin-top:16px">
        <div class="modal-note">Profilazione: tutto quello che rende il prossimo contatto meno freddo. Nessun campo è obbligatorio.</div>
        <div class="modal-grid" style="margin-top:14px">
          ${field('Fonte del contatto', 'fonte', f.fonte, { placeholder: 'LinkedIn, fiera, referral…' })}
          ${field('Temperatura relazione', 'temperatura', f.temperatura, { type: 'select', options: ['Freddo', 'Tiepido', 'Caldo'].map(v => `<option value="${v}" ${v === f.temperatura ? 'selected' : ''}>${v}</option>`).join('') })}
          ${field('Potere decisionale', 'potere', f.potere, { type: 'select', options: ['Decisore', 'Influenzatore', 'Gatekeeper', 'Utente finale', 'Da capire'].map(v => `<option value="${v}" ${v === f.potere ? 'selected' : ''}>${v}</option>`).join('') })}
          ${field('Orario / canale preferito', 'orario', f.orario, { placeholder: 'es. mattina, solo email' })}
          ${field('Interessi personali', 'interessi', f.interessi)}
          ${field('Competitor in uso', 'competitor', f.competitor)}
          ${field('Argomenti utili', 'argomentiUtili', f.argomentiUtili)}
          ${field('Argomenti da evitare', 'argomentiEvitare', f.argomentiEvitare)}
          ${field('Eventi / fiere frequentate', 'eventi', f.eventi, { span2: true })}
          ${field('Appunti liberi', 'libero', f.libero, { type: 'textarea', rows: 4, span2: true, placeholder: 'Testo libero: qualsiasi cosa non entri nei campi sopra.' })}
        </div>
      </div>`}
    `;
  } else if (State.modal === 'bridge') {
    body = `<div class="modal-grid">
      ${field('Nome e cognome', 'nome', f.nome)}
      ${field('Ruolo / organizzazione', 'ruolo', f.ruolo)}
      ${field('Tipo di relazione', 'relazione', f.relazione, { type: 'select', options: ['Referral', 'Partner', 'Ex collega', 'Associazione', 'Cliente', 'Consulente'].map(v => `<option value="${v}" ${v === f.relazione ? 'selected' : ''}>${v}</option>`).join('') })}
      ${field('Email', 'email', f.email)}
      ${field('Telefono', 'tel', f.tel, { mono: true })}
      ${field('LinkedIn', 'linkedin', f.linkedin)}
      ${field('Note', 'note', f.note, { type: 'textarea', rows: 3, span2: true, placeholder: 'Come lo conosciamo, cosa può aprire, cosa gli interessa.' })}
    </div>`;
  }

  return `
    <div class="modal-scrim" data-action="close-modal">
      <div class="modal" data-action="stop">
        <div class="modal-title">${title}</div>
        ${body}
        <div class="modal-actions">
          <button class="btn-ghost" data-action="close-modal">Annulla</button>
          <button class="btn" data-action="save-modal">Salva</button>
        </div>
      </div>
    </div>
  `;
}
