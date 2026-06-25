/* =====================================================================
   AI Notebook  -  pwa.js
   ---------------------------------------------------------------------
   - Registers the service worker.
   - Captures the `beforeinstallprompt` event and shows a custom
     "Install app" button (floating, dismissable).
   - Detects service-worker updates and shows an "Update available" toast.
   - Network status detection (online/offline banners).
   Loaded on every page AFTER app.js (so window.SS exists).
   ===================================================================== */
(function () {
  'use strict';

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  /* ---------- toast helper (use SS.toast if available) ---------- */
  function notify(msg, type) {
    if (window.SS && typeof SS.toast === 'function') return SS.toast(msg, type || 'success');
    console.log('[PWA]', msg);
  }

  /* ---------- 1. Register service worker ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          // Detect updates: a new worker installed while one is active.
          reg.addEventListener('updatefound', () => {
            const nw = reg.installing;
            if (!nw) return;
            nw.addEventListener('statechange', () => {
              if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                showUpdateBanner(reg);
              }
            });
          });
        })
        .catch((err) => console.warn('[PWA] SW registration failed:', err));

      // Reload once the new worker takes control.
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    });
  }

  function showUpdateBanner(reg) {
    const bar = document.createElement('div');
    bar.className = 'pwa-update-banner';
    bar.innerHTML =
      '<span><i class="fas fa-rotate"></i> A new version is available.</span>' +
      '<button id="pwaUpdateBtn">Update</button>';
    document.body.appendChild(bar);
    requestAnimationFrame(() => bar.classList.add('show'));
    document.getElementById('pwaUpdateBtn').addEventListener('click', () => {
      if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
      bar.remove();
    });
  }

  /* ---------- 2. Install prompt ---------- */
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!isStandalone) showInstallButton();
  });

  function showInstallButton() {
    if (document.getElementById('pwaInstallBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'pwaInstallBtn';
    btn.className = 'pwa-install-btn';
    btn.innerHTML = '<i class="fas fa-download"></i> Install app';
    btn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') notify('Installing AI Notebook…');
      deferredPrompt = null;
      btn.remove();
    });
    document.body.appendChild(btn);
    requestAnimationFrame(() => btn.classList.add('show'));
  }

  window.addEventListener('appinstalled', () => {
    notify('AI Notebook installed! 🎉');
    const btn = document.getElementById('pwaInstallBtn');
    if (btn) btn.remove();
  });

  // Expose a manual trigger (e.g. a button in settings can call it).
  window.SSPWA = {
    canInstall: () => !!deferredPrompt,
    promptInstall: () => deferredPrompt && document.getElementById('pwaInstallBtn')?.click(),
    isStandalone: () => isStandalone,
  };

  /* ---------- 3. Network status detection ---------- */
  function netBanner(text, cls) {
    let bar = document.getElementById('pwaNetBanner');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'pwaNetBanner';
      bar.className = 'pwa-net-banner';
      document.body.appendChild(bar);
    }
    bar.textContent = text;
    bar.className = 'pwa-net-banner show ' + cls;
    if (cls === 'online') setTimeout(() => bar.classList.remove('show'), 2500);
  }

  window.addEventListener('offline', () => netBanner("You're offline — some features are limited.", 'offline'));
  window.addEventListener('online', () => netBanner("Back online.", 'online'));
})();
