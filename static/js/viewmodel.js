// Builds the full view-model from Data (raw records) + State (UI state),
// mirroring the Claude Design prototype's renderVals().
function computeViewModel() {
  const cos = Data.companies;
  const total = cos.length;
  const won = cos.filter(c => c.stage === 'vinto');
  const lost = cos.filter(c => c.stage === 'perso');
  const closed = won.length + lost.length;
  const open = cos.filter(c => c.stage !== 'vinto' && c.stage !== 'perso' && c.stage !== 'prospect');
  const reached = k => cos.filter(c => c.maxStageIndex >= k).length;

  const conversions = [];
  for (let i = 0; i < 6; i++) {
    const from = reached(i), to = reached(i + 1);
    const r = from ? to / from : 0;
    conversions.push({
      label: Data.stages[i].label + ' → ' + Data.stages[i + 1].label.replace(' (Cliente)', ''),
      pct: H.pct(r), width: Math.round(r * 100) + '%',
    });
  }
  const funnel = Data.stages.slice(0, 7).map((s, i) => {
    const n = i === 6 ? won.length : reached(i);
    return {
      label: s.label.replace(' (Cliente)', ''), count: n, color: s.color,
      width: Math.max(6, Math.round((n / Math.max(1, total)) * 100)) + '%', pct: H.pct(n / Math.max(1, total)),
    };
  });

  const maxAvg = Math.max.apply(null, Data.stageAvgDays.map(s => s.avgDays).concat([1]));
  const stageTimes = Data.stageAvgDays.map(s => ({
    label: H.stageById(s.stage).label, days: s.avgDays,
    width: Math.round((s.avgDays / maxAvg) * 100) + '%',
  }));

  function plannerItems() {
    const out = [];
    cos.filter(c => H.matches(c)).forEach(co => {
      if (co.next && co.next.data) {
        out.push({ kind: 'deal', cid: co.id, titolo: co.nome, sotto: 'Trattativa · ' + H.stageById(co.stage).label, next: co.next, owner: co.gestitoDa });
      }
      H.contactsOf(co.id).forEach(p => {
        if (p.next && p.next.data) {
          out.push({ kind: 'person', cid: co.id, pid: p.id, titolo: p.nome + ' ' + p.cognome, sotto: p.ruolo + ' · ' + co.nome, next: p.next, owner: p.gestitoDa });
        }
      });
    });
    return out.sort((a, b) => a.next.data.localeCompare(b.next.data));
  }
  const items = plannerItems();
  const inRitardo = items.filter(i => H.dayDiff(i.next.data) < 0).length;
  const oggi = items.filter(i => H.dayDiff(i.next.data) === 0).length;

  const days = iso => (H.today() - new Date(iso + 'T00:00:00')) / 86400000;
  const kpi = {
    aziende: total, persone: Data.contacts.length, attive: open.length, bridge: Data.bridges.length,
    prospect: cos.filter(c => c.stage === 'prospect').length,
    valoreTotale: H.eur(cos.reduce((a, c) => a + c.valore, 0)),
    valoreAperto: H.eur(open.reduce((a, c) => a + c.valore, 0)),
    valoreVinto: H.eur(won.reduce((a, c) => a + c.valore, 0)),
    vinti: won.length, persi: lost.length, chiuse: closed,
    convTotale: H.pct(won.length / Math.max(1, total)),
    pctVinti: H.pct(closed ? won.length / closed : 0),
    pctPersi: H.pct(closed ? lost.length / closed : 0),
    barVinti: (closed ? Math.round((won.length / closed) * 100) : 0) + '%',
    barPersi: (closed ? Math.round((lost.length / closed) * 100) : 0) + '%',
    nuoviSettimana: Data.contacts.filter(c => days(c.created) <= 7).length,
    nuoviMese: Data.contacts.filter(c => days(c.created) <= 30).length,
    inRitardo, oggi,
  };

  const opStats = Data.operators.map(o => {
    const gest = cos.filter(c => c.gestitoDa === o.nome);
    return {
      nome: o.nome, initials: H.initials(o.nome, ''), gestite: gest.length,
      portate: cos.filter(c => c.portatoDa === o.nome).length,
      vinti: gest.filter(c => c.stage === 'vinto').length,
      valore: H.eur(gest.filter(c => c.stage !== 'perso').reduce((a, c) => a + c.valore, 0)),
    };
  });

  const visible = cos.filter(c => H.matches(c));

  const columns = Data.stages.map(s => {
    const deals = visible.filter(c => c.stage === s.id);
    return {
      id: s.id, label: s.label, color: s.color, count: deals.length, empty: deals.length === 0,
      total: H.eur(deals.reduce((a, c) => a + c.valore, 0)),
      deals: deals.map(c => {
        const people = H.contactsOf(c.id);
        const p = people[0];
        const u = H.urgencyColors(c.next && c.next.data);
        const br = c.bridgeId ? Data.bridges.find(b => b.id === c.bridgeId) : null;
        return {
          id: c.id, nome: c.nome, settore: c.settore, dip: c.dip, valore: H.eur(c.valore), giorni: c.giorni,
          initials: p ? H.initials(p.nome, p.cognome) : '–',
          referente: p ? p.nome + ' ' + p.cognome + (people.length > 1 ? ' +' + (people.length - 1) : '') : 'Referente da trovare',
          gestitoDa: c.gestitoDa,
          hasNext: !!(c.next && c.next.data), nextBg: u.bg, nextFg: u.fg,
          nextTipo: c.next ? H.actionById(c.next.tipo).label : '', nextQuando: c.next ? H.quando(c.next.data) : '',
          nextStadio: c.next ? H.stageLabelShort(c.next.stadio) : '',
          hasBridge: !!br, bridge: br ? br.nome : '',
        };
      }),
    };
  });

  const laneDefs = [
    { id: 'ritardo', label: 'In ritardo', test: d => d < 0, bg: 'oklch(0.975 0.02 25)', border: 'oklch(0.88 0.05 25)', fg: 'oklch(0.46 0.16 25)' },
    { id: 'oggi', label: 'Oggi', test: d => d === 0, bg: 'oklch(0.975 0.015 255)', border: 'oklch(0.86 0.06 255)', fg: 'oklch(0.42 0.13 255)' },
    { id: 'domani', label: 'Domani', test: d => d === 1, bg: 'oklch(0.985 0.002 95)', border: 'oklch(0.93 0.004 95)', fg: 'oklch(0.35 0.01 255)' },
    { id: 'settimana', label: 'Questa settimana', test: d => d > 1 && d <= 7, bg: 'oklch(0.985 0.002 95)', border: 'oklch(0.93 0.004 95)', fg: 'oklch(0.35 0.01 255)' },
    { id: 'dopo', label: 'Più avanti', test: d => d > 7, bg: 'oklch(0.985 0.002 95)', border: 'oklch(0.93 0.004 95)', fg: 'oklch(0.35 0.01 255)' },
  ];
  const mapItem = it => {
    const u = H.urgencyColors(it.next.data);
    return {
      kind: it.kind, cid: it.cid, pid: it.pid, titolo: it.titolo, sotto: it.sotto,
      tipo: H.actionById(it.next.tipo).label, tipoColor: H.actionById(it.next.tipo).color,
      dataLabel: H.quando(it.next.data), dataColor: u.fg, chipBg: u.bg, chipFg: u.fg,
      stadio: H.stageLabelShort(it.next.stadio), owner: it.owner || '—',
    };
  };
  const lanes = laneDefs.map(l => {
    const its = items.filter(i => l.test(H.dayDiff(i.next.data)));
    return { label: l.label, bg: l.bg, border: l.border, fg: l.fg, count: its.length, empty: its.length === 0, items: its.map(mapItem) };
  });

  const first = new Date(State.calY, State.calM, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(State.calY, State.calM + 1, 0).getDate();
  const cells = [];
  const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;
  let calCount = 0;
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - offset + 1;
    const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
    const iso = inMonth ? State.calY + '-' + String(State.calM + 1).padStart(2, '0') + '-' + String(dayNum).padStart(2, '0') : null;
    const dayItems = iso ? items.filter(x => x.next.data === iso) : [];
    calCount += dayItems.length;
    const isToday = iso === Data.today;
    cells.push({
      day: inMonth ? String(dayNum) : '', bg: inMonth ? (isToday ? 'oklch(0.97 0.02 255)' : '#fff') : 'oklch(0.985 0.002 95)',
      border: isToday ? 'oklch(0.75 0.08 255)' : 'oklch(0.94 0.004 95)',
      dayColor: isToday ? 'oklch(0.42 0.13 255)' : 'oklch(0.6 0.01 255)',
      items: dayItems.slice(0, 2).map(mapItem), hasMore: dayItems.length > 2, more: dayItems.length - 2,
    });
  }
  const calTitleRaw = new Date(State.calY, State.calM, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  const calTitle = calTitleRaw.charAt(0).toUpperCase() + calTitleRaw.slice(1);

  const rows = [];
  visible.forEach(co => {
    const s = H.stageById(co.stage);
    H.contactsOf(co.id).forEach(p => {
      const d = p.dossier || {};
      const u = H.urgencyColors(p.next && p.next.data);
      rows.push({
        id: p.id, companyId: co.id, persona: p.nome + ' ' + p.cognome, azienda: co.nome, ruolo: p.ruolo, email: p.email, tel: p.tel,
        initials: H.initials(p.nome, p.cognome), stage: s.label.replace(' (Cliente)', ''), stageColor: s.color,
        temperatura: (d.temperatura || 'Freddo') + ' · ' + (d.potere || 'Da capire'),
        hasNext: !!(p.next && p.next.data), noNext: !(p.next && p.next.data),
        nextTipo: p.next ? H.actionById(p.next.tipo).label : '', nextQuando: p.next ? H.quando(p.next.data) : '',
        nextBg: u.bg, nextFg: u.fg, owner: p.gestitoDa,
      });
    });
  });

  const groups = visible.map(co => {
    const people = H.contactsOf(co.id);
    const s = H.stageById(co.stage);
    const nexts = people.filter(p => p.next && p.next.data).map(p => p.next.data).concat(co.next && co.next.data ? [co.next.data] : []).sort();
    const firstNextTipo = nexts.length
      ? (co.next && co.next.data === nexts[0] ? co.next.tipo : ((people.find(p => p.next && p.next.data === nexts[0]) || { next: { tipo: 'followup' } }).next.tipo))
      : null;
    return {
      id: co.id, nome: co.nome, settore: co.settore, dip: co.dip, stage: s.label.replace(' (Cliente)', ''), stageColor: s.color,
      valore: H.eur(co.valore), nPersone: people.length, noPersone: people.length === 0,
      nextLabel: nexts.length ? (H.actionById(firstNextTipo).label + ' · ' + H.quando(nexts[0])) : 'nessuna azione',
      open: !!State.openGroups[co.id], chevron: State.openGroups[co.id] ? '▴' : '▾',
      persone: people.map(p => ({
        id: p.id, nomeCompleto: p.nome + ' ' + p.cognome, ruolo: p.ruolo, email: p.email,
        initials: H.initials(p.nome, p.cognome),
        nextLabel: p.next && p.next.data ? (H.actionById(p.next.tipo).label + ' · ' + H.quando(p.next.data)) : '—',
      })),
    };
  });

  const co = cos.find(c => c.id === State.detailId);
  const dossierLabels = [
    ['fonte', 'Fonte'], ['potere', 'Potere decisionale'], ['orario', 'Orario / canale'], ['interessi', 'Interessi'],
    ['competitor', 'Competitor in uso'], ['argomentiUtili', 'Argomenti utili'], ['argomentiEvitare', 'Da evitare'], ['eventi', 'Eventi / fiere'],
  ];
  let detail = null;
  if (co) {
    const brDetail = co.bridgeId ? Data.bridges.find(b => b.id === co.bridgeId) : null;
    detail = {
      id: co.id, nome: co.nome, settore: co.settore, dip: co.dip, stage: co.stage, valore: H.eur(co.valore), giorni: co.giorni,
      portatoDa: co.portatoDa, gestitoDa: co.gestitoDa, hasBridge: !!brDetail, bridge: brDetail ? brDetail.nome : '',
      nextTipo: co.next ? co.next.tipo : 'followup', nextData: co.next ? co.next.data : '',
      nextStadioId: co.next ? co.next.stadio : co.stage, nextQuando: co.next && co.next.data ? H.quando(co.next.data) : 'da pianificare',
      noContatti: H.contactsOf(co.id).length === 0,
      contatti: H.contactsOf(co.id).map(p => {
        const d = p.dossier || {};
        const u = H.urgencyColors(p.next && p.next.data);
        return {
          id: p.id, nomeCompleto: p.nome + ' ' + p.cognome, ruolo: p.ruolo, email: p.email, tel: p.tel,
          linkedin: p.linkedin, social: p.social, socialLabel: p.socialLabel, note: p.note, hasNote: !!p.note,
          initials: H.initials(p.nome, p.cognome), portatoDa: p.portatoDa, gestitoDa: p.gestitoDa,
          nextTipoLabel: p.next && p.next.data ? H.actionById(p.next.tipo).label : 'Nessuna azione',
          nextQuando: p.next && p.next.data ? H.quando(p.next.data) : 'da pianificare',
          nextStadio: p.next && p.next.data ? H.stageLabelShort(p.next.stadio) : '—',
          nextBg: u.bg, nextFg: u.fg,
          temperatura: d.temperatura || 'Freddo', tempColor: H.tempColor(d.temperatura),
          dossierOpen: State.openDossier === p.id, dossierLabel: State.openDossier === p.id ? 'Chiudi dossier' : 'Dossier',
          dossierRows: dossierLabels.map(k => ({ label: k[1], value: d[k[0]] || '—' })),
          libero: d.libero || '',
        };
      }),
      attivita: co.attivita,
    };
  }

  const bridgeCards = Data.bridges.map(b => ({
    id: b.id, nome: b.nome, ruolo: b.ruolo, relazione: b.relazione, email: b.email, tel: b.tel, linkedin: b.linkedin,
    note: b.note, hasNote: !!b.note, introduzioni: b.introduzioni, initials: H.initials.apply(null, b.nome.split(' ')),
    noAziende: b.aziende.length === 0,
    aziende: b.aziende.map(id => {
      const c = cos.find(x => x.id === id);
      return { id, nome: c ? c.nome : 'Azienda rimossa' };
    }),
  }));

  const titles = { dashboard: 'Dashboard commerciale', pipeline: 'Pipeline di vendita', planner: 'Planner azioni', contatti: 'Contatti', bridge: 'Bridge contact', impostazioni: 'Impostazioni' };
  const subs = {
    dashboard: 'Aggiornata al ' + H.dateLabelToday() + ' · ' + total + ' aziende, ' + Data.contacts.length + ' persone',
    pipeline: 'Trascina una card per cambiare stadio · ' + visible.length + ' aziende visibili',
    planner: inRitardo + ' azioni in ritardo · ' + oggi + ' da fare oggi',
    contatti: rows.length + ' persone su ' + visible.length + ' aziende',
    bridge: Data.bridges.length + ' persone che possono aprire porte',
    impostazioni: 'Operatori e struttura della pipeline',
  };

  const operatorRows = Data.operators.map(o => ({
    id: o.id, nome: o.nome, initials: H.initials(o.nome, ''),
    uso: cos.filter(c => c.gestitoDa === o.nome).length + ' aziende',
  }));

  return {
    stageOptions: Data.stages, actionTypes: Data.actionTypes, operators: Data.operators,
    companyOptions: cos.map(c => ({ id: c.id, nome: c.nome })),
    viewTitle: titles[State.view], viewSub: subs[State.view],
    kpi, funnel, conversions, stageTimes, opStats, columns, rows, noRows: rows.length === 0, groups,
    lanes, plannerCount: items.length,
    calCells: cells, calTitle, calCount,
    plannerBadge: inRitardo + oggi, plannerBadgeBg: inRitardo ? 'oklch(0.58 0.15 25)' : 'oklch(0.6 0.03 255)',
    bridgeCards, operatorRows,
    hasDetail: !!detail, detail,
    kpiValoreAperto: kpi.valoreAperto, kpiAttive: kpi.attive, kpiProspect: kpi.prospect, kpiPersone: kpi.persone, kpiBridge: kpi.bridge,
  };
}
