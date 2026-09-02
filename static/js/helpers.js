// Data (bootstrap payload) and State (UI state) are set up in main.js.
const H = (() => {
  function today() { return new Date(Data.today + 'T00:00:00'); }

  function eur(n) {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
  }
  function pct(n) {
    return (Math.round(n * 1000) / 10).toFixed(1).replace('.', ',') + '%';
  }
  function stageById(id) { return Data.stages.find(s => s.id === id) || Data.stages[0]; }
  function stageIndex(id) { return Data.stages.findIndex(s => s.id === id); }
  function stageLabelShort(id) { return stageById(id).label.replace(' (Cliente)', ''); }
  function actionById(id) { return Data.actionTypes.find(a => a.id === id) || Data.actionTypes[0]; }
  function initials(a, b) { return ((a || '?')[0] + ((b || '')[0] || '')).toUpperCase(); }
  function contactsOf(companyId) { return Data.contacts.filter(c => c.companyId === companyId); }

  function dayDiff(iso) {
    return Math.round((new Date(iso + 'T00:00:00') - today()) / 86400000);
  }
  function quando(iso) {
    if (!iso) return '—';
    const d = dayDiff(iso);
    if (d < -1) return Math.abs(d) + 'g di ritardo';
    if (d === -1) return 'ieri';
    if (d === 0) return 'oggi';
    if (d === 1) return 'domani';
    if (d <= 7) return 'fra ' + d + 'g';
    return new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  }
  function urgencyColors(iso) {
    if (!iso) return { bg: 'oklch(0.97 0.003 95)', fg: 'oklch(0.55 0.01 255)' };
    const d = dayDiff(iso);
    if (d < 0) return { bg: 'oklch(0.95 0.04 25)', fg: 'oklch(0.46 0.16 25)' };
    if (d === 0) return { bg: 'oklch(0.95 0.03 255)', fg: 'oklch(0.42 0.13 255)' };
    if (d <= 7) return { bg: 'oklch(0.97 0.012 255)', fg: 'oklch(0.47 0.06 255)' };
    return { bg: 'oklch(0.97 0.003 95)', fg: 'oklch(0.5 0.01 255)' };
  }
  function tempColor(t) {
    if (t === 'Caldo') return 'oklch(0.58 0.14 40)';
    if (t === 'Tiepido') return 'oklch(0.6 0.09 90)';
    return 'oklch(0.6 0.05 245)';
  }
  function dateLabelToday() {
    const d = new Date();
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  }
  function matchesOp(co) {
    const f = State.filterOp;
    if (f === 'tutti') return true;
    if (co.gestitoDa === f || co.portatoDa === f) return true;
    return contactsOf(co.id).some(p => p.gestitoDa === f || p.portatoDa === f);
  }
  function matches(co) {
    const q = State.query.trim().toLowerCase();
    if (State.filterStage !== 'tutti' && co.stage !== State.filterStage) return false;
    if (!matchesOp(co)) return false;
    if (!q) return true;
    const people = contactsOf(co.id).map(p => p.nome + ' ' + p.cognome + ' ' + p.ruolo + ' ' + p.email).join(' ');
    return (co.nome + ' ' + co.settore + ' ' + people).toLowerCase().includes(q);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  return {
    today, eur, pct, stageById, stageIndex, stageLabelShort, actionById, initials, contactsOf,
    dayDiff, quando, urgencyColors, tempColor, dateLabelToday, matchesOp, matches, esc,
  };
})();
