// Ancienne adresse de New Shape : redirige vers la nouvelle et propose d'y transférer les données de cet appareil.
(function () {
  var NEW_APP = '__NEW_APP_URL__'.replace(/\/$/, '');
  var NEW_ORIGIN = new URL(NEW_APP).origin;
  var KEY = 'new-shape-v1';
  var target = NEW_APP + '/' + (location.hash && location.hash !== '#transfer' ? location.hash : '');

  // L'ancien service worker n'a plus de raison d'exister ici.
  if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); }).catch(function () {});

  var link = document.getElementById('new-link');
  link.href = target;
  link.textContent = NEW_APP.replace(/^https:\/\//, '');

  var state;
  try {
    state = JSON.parse(localStorage.getItem(KEY) || 'null');
    state = state && state.state;
  } catch (e) {
    state = undefined;
  }
  var hasData = state && state.onboarded && ((state.workouts && state.workouts.length) || (state.body && state.body.length));
  var moved = false;
  try { moved = localStorage.getItem('new-shape-moved') === '1'; } catch (e) {}
  if (!hasData || moved) {
    location.replace(target);
    return;
  }

  document.getElementById('with-data').hidden = false;
  var status = document.getElementById('status');

  document.getElementById('transfer').addEventListener('click', function () {
    var win = window.open(NEW_APP + '/#transfer', '_blank');
    if (!win) {
      status.textContent = 'Fenêtre bloquée : autorise les fenêtres pop-up ou télécharge tes données.';
      return;
    }
    status.textContent = 'Transfert en cours…';
    var sent = false;
    window.addEventListener('message', function (e) {
      // Uniquement la nouvelle adresse, et uniquement la fenêtre qu'on vient d'ouvrir.
      if (e.origin !== NEW_ORIGIN || e.source !== win || !e.data) return;
      if (e.data.type === 'ns-ready' && !sent) {
        sent = true;
        win.postMessage({ type: 'ns-transfer', state: state }, NEW_ORIGIN);
      } else if (e.data.type === 'ns-received') {
        try { localStorage.setItem('new-shape-moved', '1'); } catch (err) {}
        status.textContent = 'Données transférées ✓ Tu peux fermer cette page.';
      }
    });
    setTimeout(function () {
      if (!sent) status.textContent = 'Pas de réponse de la nouvelle adresse : télécharge tes données puis importe-les là-bas.';
    }, 20000);
  });

  document.getElementById('download').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(Object.assign({ app: 'new-shape', exportedAt: new Date().toISOString() }, state), null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'new-shape-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  });

  document.getElementById('skip').addEventListener('click', function () {
    location.replace(target);
  });
})();
