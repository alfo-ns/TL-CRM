let Data = null;

async function boot() {
  try {
    Data = await Api.bootstrap();
  } catch (e) {
    document.getElementById('content').innerHTML =
      '<div class="empty-state">Impossibile contattare il server locale. Riavvia l\'applicazione.<br><span class="mono" style="font-size:11px">' + H.esc(e.message) + '</span></div>';
    return;
  }
  wireEvents();
  render();
  setInterval(refreshQuietly, 20000);
}

async function refreshQuietly() {
  // picks up changes saved by other users on the network share, without
  // disturbing whatever the current user is doing (typing, an open modal).
  if (State.modal || document.activeElement.tagName === 'TEXTAREA') return;
  try {
    Data = await Api.bootstrap();
    render();
  } catch (e) {
    // offline blip — next tick will retry
  }
}

document.addEventListener('DOMContentLoaded', boot);
